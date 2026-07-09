#!/usr/bin/env node
/**
 * Auto Cost Tracker — runs every 5 minutes via cron
 * 
 * Uses Anthropic Admin API with 1h bucket granularity (data fresh within ~5 min).
 * Tracks delta since last run and posts new usage to the cost API.
 * 
 * Supports two modes:
 *   --laura-only   Track only Laura's API key (default)
 *   --all-keys    Track all API keys in the org
 */

import 'dotenv/config';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const STATE_FILE = join(DATA_DIR, 'auto-tracker-state.json');
const API_URL = 'http://127.0.0.1:3100/api/tasks/cost';

const ANTHROPIC_ADMIN_API_KEY = process.env.ANTHROPIC_ADMIN_API_KEY || '';
const ANTHROPIC_AGENT_API_KEY_ID = process.env.ANTHROPIC_AGENT_API_KEY_ID || '';
const ANTHROPIC_WORKSPACE_ID = process.env.ANTHROPIC_WORKSPACE_ID || '';
const ANTHROPIC_BASE = 'https://api.anthropic.com';

const lauraOnly = !process.argv.includes('--all-keys');

// ── Model pricing (per 1M tokens) ────────────────────────────────────────────
// ── ORG-DISCOUNTED rates (~1/3 published) — must match server.js MODEL_PRICING ──
const MODEL_PRICING = {
  'claude-opus-4-6':             { input:  5.00, cacheRead: 0.50,  cacheWrite:  6.25, output: 25.00 },
  'claude-sonnet-4-6':           { input:  1.00, cacheRead: 0.10,  cacheWrite:  1.25, output:  5.00 },
  'claude-sonnet-4-5-20250929':  { input:  1.00, cacheRead: 0.10,  cacheWrite:  1.25, output:  5.00 },
  'claude-haiku-4-5-20251001':   { input:  0.27, cacheRead: 0.027, cacheWrite:  0.33, output:  1.33 },
  'gemini-3.1-pro-preview':      { input:  1.25, cacheRead: 0.31,  cacheWrite:  1.25, output:  5.00 },
};

function estimateCost(model, input, output, cacheRead, cacheWrite) {
  let pricing = MODEL_PRICING[model];
  if (!pricing) {
    const key = Object.keys(MODEL_PRICING).find(k => model.includes(k) || k.includes(model));
    pricing = key ? MODEL_PRICING[key] : { input: 1.00, cacheRead: 0.10, cacheWrite: 1.25, output: 5.00 };
  }
  return (
    (input || 0) * pricing.input / 1_000_000 +
    (cacheRead || 0) * pricing.cacheRead / 1_000_000 +
    (cacheWrite || 0) * pricing.cacheWrite / 1_000_000 +
    (output || 0) * pricing.output / 1_000_000
  );
}

function loadState() {
  try {
    if (existsSync(STATE_FILE)) return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch (e) { /* ignore */ }
  return { date: null, byModelHour: {}, lastRun: null };
}

function saveState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function fetchTodayUsage() {
  if (!ANTHROPIC_ADMIN_API_KEY) {
    console.error('No ANTHROPIC_ADMIN_API_KEY set');
    process.exit(1);
  }

  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
  const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));

  const headers = {
    'anthropic-version': '2023-06-01',
    'x-api-key': ANTHROPIC_ADMIN_API_KEY,
  };

  // Use 1h bucket for near-real-time data (fresh within ~5 min)
  let url = `${ANTHROPIC_BASE}/v1/organizations/usage_report/messages?starting_at=${encodeURIComponent(todayStart.toISOString())}&ending_at=${encodeURIComponent(todayEnd.toISOString())}&bucket_width=1h&group_by[]=model`;
  
  if (lauraOnly && ANTHROPIC_AGENT_API_KEY_ID) {
    url += `&api_key_ids[]=${encodeURIComponent(ANTHROPIC_AGENT_API_KEY_ID)}`;
  }
  if (lauraOnly && ANTHROPIC_WORKSPACE_ID) {
    url += `&workspace_ids[]=${encodeURIComponent(ANTHROPIC_WORKSPACE_ID)}`;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  
  // Build a map: "HH:00|model" -> { input, output, cacheRead, cacheWrite }
  const byModelHour = {};
  if (data?.data) {
    for (const bucket of data.data) {
      const hour = bucket.starting_at?.slice(11, 16) || '00:00';
      for (const item of bucket.results || []) {
        const model = item.model || 'unknown';
        const key = `${hour}|${model}`;
        
        let cacheCreation = 0;
        if (item.cache_creation) {
          cacheCreation += Number(item.cache_creation.ephemeral_1h_input_tokens || 0);
          cacheCreation += Number(item.cache_creation.ephemeral_5m_input_tokens || 0);
        }
        
        byModelHour[key] = {
          input: Number(item.uncached_input_tokens || 0),
          output: Number(item.output_tokens || 0),
          cacheRead: Number(item.cache_read_input_tokens || 0),
          cacheWrite: cacheCreation,
        };
      }
    }
  }

  return { date: todayStart.toISOString().slice(0, 10), byModelHour };
}

async function postCostDelta(model, input, output, cacheRead, cacheWrite) {
  const total = input + output + cacheRead + cacheWrite;
  if (total === 0) return;

  const cost = estimateCost(model, input, output, cacheRead, cacheWrite);
  const now = new Date();
  const scope = lauraOnly ? 'Laura' : 'Org';
  const taskId = `AUTO-${now.toISOString().slice(0, 10)}-${model.replace(/[^a-zA-Z0-9]/g, '-')}`;
  
  const shortModel = model.replace('claude-', '').replace(/-\d{8}$/, '');
  const body = {
    taskId,
    taskName: `${scope} activity — ${shortModel}`,
    description: `Automatic ${scope.toLowerCase()}-level usage tracked from Anthropic Admin API. Model: ${model}. Includes all API calls (chats, emails, research, document creation, cron tasks, heartbeats) made with this model during the tracking period.`,
    model,
    inputTokens: input,
    outputTokens: output,
    cacheReadTokens: cacheRead,
    cacheWriteTokens: cacheWrite,
    totalTokens: total,
    costUsd: Math.round(cost * 10000) / 10000,
  };

  try {
    await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    console.log(`  → ${taskId}: ${total.toLocaleString()} tokens, $${body.costUsd}`);
  } catch (e) {
    console.error(`  Failed: ${taskId}:`, e.message);
  }
}

async function main() {
  const mode = lauraOnly ? 'Laura-only' : 'all-keys';
  console.log(`[${new Date().toISOString()}] Auto cost tracker (${mode})...`);

  const today = await fetchTodayUsage();
  const state = loadState();

  // Reset state on new day
  if (state.date !== today.date) {
    console.log(`  New day: ${today.date}`);
    state.date = today.date;
    state.byModelHour = {};
  }

  // Calculate deltas per model (aggregate across all hours)
  const currentByModel = {};
  const prevByModel = {};

  for (const [key, usage] of Object.entries(today.byModelHour)) {
    const model = key.split('|')[1];
    if (!currentByModel[model]) currentByModel[model] = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
    currentByModel[model].input += usage.input;
    currentByModel[model].output += usage.output;
    currentByModel[model].cacheRead += usage.cacheRead;
    currentByModel[model].cacheWrite += usage.cacheWrite;
  }

  for (const [key, usage] of Object.entries(state.byModelHour)) {
    const model = key.split('|')[1];
    if (!prevByModel[model]) prevByModel[model] = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
    prevByModel[model].input += usage.input;
    prevByModel[model].output += usage.output;
    prevByModel[model].cacheRead += usage.cacheRead;
    prevByModel[model].cacheWrite += usage.cacheWrite;
  }

  let totalNewTokens = 0;
  for (const model of Object.keys(currentByModel)) {
    const cur = currentByModel[model];
    const prev = prevByModel[model] || { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

    const dI = Math.max(0, cur.input - prev.input);
    const dO = Math.max(0, cur.output - prev.output);
    const dCR = Math.max(0, cur.cacheRead - prev.cacheRead);
    const dCW = Math.max(0, cur.cacheWrite - prev.cacheWrite);
    const dTotal = dI + dO + dCR + dCW;

    if (dTotal > 0) {
      await postCostDelta(model, dI, dO, dCR, dCW);
      totalNewTokens += dTotal;
    }
  }

  // Save state
  state.byModelHour = today.byModelHour;
  state.lastRun = new Date().toISOString();
  saveState(state);

  if (totalNewTokens > 0) {
    console.log(`  Total new: ${totalNewTokens.toLocaleString()} tokens`);
  } else {
    console.log('  No new usage');
  }
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
