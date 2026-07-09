#!/usr/bin/env node
/**
 * anthropic-cost-sync.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Pulls per-agent usage from the Anthropic Admin API and upserts daily cost
 * snapshots into agent_cost_snapshots (bb_agents shared RDS).
 *
 * Run:   node scripts/anthropic-cost-sync.mjs [--days 2]
 * Cron:  0 1 * * * /usr/bin/node /var/www/laura-dashboard/api/scripts/anthropic-cost-sync.mjs --days 2
 *
 * Auth:  ANTHROPIC_ADMIN_API_KEY must have org-level usage access.
 * Map:   config/api-key-agent-map.json  ← api_key_id → agent_id
 *
 * Cost formula (per 1M tokens):
 *   uncached_input_tokens              × input_rate
 *   cache_creation.ephemeral_5m_*      × input_rate × 1.25
 *   cache_creation.ephemeral_1h_*      × input_rate × 2.00   (different rate!)
 *   cache_read_input_tokens            × input_rate × 0.10
 *   output_tokens                      × output_rate
 */

import 'dotenv/config';
import pg from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Args ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const daysArg = args.indexOf('--days');
const DAYS = daysArg >= 0 ? Math.max(1, parseInt(args[daysArg + 1]) || 2) : 2;

// ── Config ────────────────────────────────────────────────────────────────────
const ADMIN_KEY = process.env.ANTHROPIC_ADMIN_API_KEY;
if (!ADMIN_KEY) {
  console.error('[cost-sync] FATAL: ANTHROPIC_ADMIN_API_KEY not set');
  process.exit(1);
}

const API_KEY_MAP_PATH = join(__dirname, '../config/api-key-agent-map.json');
let apiKeyMap;
try {
  apiKeyMap = JSON.parse(readFileSync(API_KEY_MAP_PATH, 'utf8'));
  // Strip comment keys
  Object.keys(apiKeyMap).filter(k => k.startsWith('_')).forEach(k => delete apiKeyMap[k]);
  console.log(`[cost-sync] Loaded ${Object.keys(apiKeyMap).length} api_key_id mappings`);
} catch (e) {
  console.error('[cost-sync] FATAL: Cannot read api-key-agent-map.json:', e.message);
  process.exit(1);
}

// ── Model pricing (per 1M tokens — org discount rates, same as server.js) ────
const MODEL_PRICING = {
  'claude-opus-4-6':             { input: 5.00,  output: 25.00 },
  'claude-opus-4':               { input: 5.00,  output: 25.00 },
  'claude-sonnet-4-6':           { input: 1.00,  output:  5.00 },
  'claude-sonnet-4-5-20250929':  { input: 1.00,  output:  5.00 },
  'claude-sonnet-4':             { input: 1.00,  output:  5.00 },
  'claude-haiku-4-5-20251001':   { input: 0.27,  output:  1.33 },
  'claude-haiku-4-5':            { input: 0.27,  output:  1.33 },
  'claude-haiku-4':              { input: 0.27,  output:  1.33 },
};

function getPricing(model) {
  if (!model) return { input: 1.00, output: 5.00 };
  if (MODEL_PRICING[model]) return MODEL_PRICING[model];
  // Prefix match
  const key = Object.keys(MODEL_PRICING).find(k => model.includes(k) || k.includes(model));
  return key ? MODEL_PRICING[key] : { input: 1.00, output: 5.00 }; // default sonnet
}

/**
 * Calculate cost from token breakdown.
 * NOTE: ephemeral_5m cache write = input_rate × 1.25
 *       ephemeral_1h cache write = input_rate × 2.00  (different — common mistake)
 *       cache_read               = input_rate × 0.10
 */
function calcCost(model, tokens) {
  const p = getPricing(model);
  const M = 1_000_000;
  return (
    (tokens.uncachedInput   || 0) * p.input            / M +
    (tokens.cache5mWrite    || 0) * p.input * 1.25     / M +
    (tokens.cache1hWrite    || 0) * p.input * 2.00     / M +
    (tokens.cacheRead       || 0) * p.input * 0.10     / M +
    (tokens.output          || 0) * p.output           / M
  );
}

// ── DB ────────────────────────────────────────────────────────────────────────
const pool = new pg.Pool({
  host:     process.env.BB_AGENTS_HOST || process.env.PG_HOST,
  port:     5432,
  user:     process.env.PG_USER     || 'postgres',
  password: process.env.PG_PASSWORD || '',
  database: process.env.BB_AGENTS_DB || process.env.PG_DATABASE || 'bb_agents',
  ssl:      { rejectUnauthorized: false },
  max: 3,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 8000,
});

// ── Anthropic API call ────────────────────────────────────────────────────────
const ANTHROPIC_BASE = 'https://api.anthropic.com';
const HEADERS = {
  'x-api-key': ADMIN_KEY,
  'anthropic-version': '2023-06-01',
};

async function fetchUsageReport(startingAt, endingAt) {
  const url = new URL(`${ANTHROPIC_BASE}/v1/organizations/usage_report/messages`);
  url.searchParams.set('starting_at', startingAt);
  url.searchParams.set('ending_at',   endingAt);
  url.searchParams.set('bucket_width', '1d');
  url.searchParams.append('group_by[]', 'api_key_id');
  url.searchParams.append('group_by[]', 'model');

  console.log(`[cost-sync] Fetching usage: ${startingAt} → ${endingAt}`);
  const res = await fetch(url.toString(), { headers: HEADERS });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 400)}`);
  }
  return res.json();
}

// ── Upsert helper ─────────────────────────────────────────────────────────────
async function upsertSnapshot(agentId, snapshotDate, totalCostUsd, totalTokens, byModel) {
  const client = await pool.connect();
  try {
    await client.query(`
      INSERT INTO agent_cost_snapshots
        (agent_id, snapshot_date, total_cost_usd, total_tokens, by_model, source, created_at)
      VALUES ($1, $2, $3, $4, $5, 'anthropic_api', NOW())
      ON CONFLICT (agent_id, snapshot_date) DO UPDATE SET
        total_cost_usd = EXCLUDED.total_cost_usd,
        total_tokens   = EXCLUDED.total_tokens,
        by_model       = EXCLUDED.by_model,
        source         = 'anthropic_api'
    `, [
      agentId,
      snapshotDate,
      Math.round(totalCostUsd * 10000) / 10000,
      totalTokens,
      JSON.stringify(byModel),
    ]);
  } finally {
    client.release();
  }
}

// ── Ensure agent exists in registry (non-fatal) ───────────────────────────────
async function ensureAgent(agentId) {
  try {
    await pool.query(`
      INSERT INTO agent_registry (agent_id, agent_name, active, first_seen_at, last_active_at)
      VALUES ($1, $1, true, NOW(), NOW())
      ON CONFLICT (agent_id) DO NOTHING
    `, [agentId]);
  } catch (e) { /* non-fatal */ }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`[cost-sync] Starting — backfill ${DAYS} day(s)`);

  // Build date range: last N days up to tomorrow (catch late API data)
  const now    = new Date();
  const endUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const startUTC = new Date(endUTC);
  startUTC.setUTCDate(startUTC.getUTCDate() - DAYS);

  let report;
  try {
    report = await fetchUsageReport(startUTC.toISOString(), endUTC.toISOString());
  } catch (e) {
    console.error('[cost-sync] Usage fetch failed:', e.message);
    process.exit(1);
  }

  if (!report?.data?.length) {
    console.log('[cost-sync] No usage data returned from API');
    process.exit(0);
  }

  // ── Aggregate: date → agent_id → model → token totals ────────────────────
  // Structure: aggMap[date][agentId][model] = { uncachedInput, cache5mWrite, cache1hWrite, cacheRead, output }
  const aggMap = {};

  for (const bucket of report.data) {
    const dateStr = (bucket.starting_at || '').slice(0, 10);
    if (!dateStr) continue;

    for (const result of bucket.results || []) {
      const keyId   = result.api_key_id || result.organization_id || 'unknown';
      const model   = result.model || 'unknown';
      const agentId = apiKeyMap[keyId] || null;

      if (!agentId) {
        // Unknown key — skip (don't pollute any agent's data)
        continue;
      }

      const uncachedInput = parseInt(result.uncached_input_tokens) || 0;
      const cacheRead     = parseInt(result.cache_read_input_tokens) || 0;
      const cache5mWrite  = parseInt(result.cache_creation?.ephemeral_5m_input_tokens) || 0;
      const cache1hWrite  = parseInt(result.cache_creation?.ephemeral_1h_input_tokens) || 0;
      const output        = parseInt(result.output_tokens) || 0;

      if (!aggMap[dateStr])            aggMap[dateStr] = {};
      if (!aggMap[dateStr][agentId])   aggMap[dateStr][agentId] = {};
      if (!aggMap[dateStr][agentId][model]) {
        aggMap[dateStr][agentId][model] = {
          uncachedInput: 0, cache5mWrite: 0, cache1hWrite: 0, cacheRead: 0, output: 0
        };
      }
      const m = aggMap[dateStr][agentId][model];
      m.uncachedInput += uncachedInput;
      m.cache5mWrite  += cache5mWrite;
      m.cache1hWrite  += cache1hWrite;
      m.cacheRead     += cacheRead;
      m.output        += output;
    }
  }

  // ── Write snapshots ───────────────────────────────────────────────────────
  let snapshotCount = 0;

  for (const [dateStr, agentMap] of Object.entries(aggMap)) {
    for (const [agentId, modelMap] of Object.entries(agentMap)) {
      let totalCost   = 0;
      let totalTokens = 0;
      const byModel   = {};

      for (const [model, t] of Object.entries(modelMap)) {
        const cost = calcCost(model, t);
        const tokens = t.uncachedInput + t.cache5mWrite + t.cache1hWrite + t.cacheRead + t.output;

        totalCost   += cost;
        totalTokens += tokens;
        byModel[model] = {
          cost_usd:        Math.round(cost * 10000) / 10000,
          total_tokens:    tokens,
          uncached_input:  t.uncachedInput,
          cache_5m_write:  t.cache5mWrite,
          cache_1h_write:  t.cache1hWrite,
          cache_read:      t.cacheRead,
          output:          t.output,
        };
      }

      if (totalTokens === 0) continue;

      await ensureAgent(agentId);
      await upsertSnapshot(agentId, dateStr, totalCost, totalTokens, byModel);

      console.log(`[cost-sync] ✓ ${agentId} ${dateStr}: $${totalCost.toFixed(4)} (${totalTokens.toLocaleString()} tokens)`);
      snapshotCount++;
    }
  }

  console.log(`[cost-sync] Done — ${snapshotCount} snapshot(s) upserted`);
  await pool.end();
}

main().catch(e => {
  console.error('[cost-sync] Uncaught error:', e);
  pool.end().catch(() => {});
  process.exit(1);
});
