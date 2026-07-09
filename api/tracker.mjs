#!/usr/bin/env node
/**
 * Laura Task Tracker — runs every 5 minutes via OpenClaw cron.
 * 
 * Scans OpenClaw session data + cron run logs, classifies each interaction,
 * computes cost, and writes to bb_agents RDS (agent_activities table).
 * 
 * Never crashes — all errors are caught and logged.
 */

import 'dotenv/config';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import pg from 'pg';

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

const DATA_DIR = join(__dirname, 'data');
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const STATE_FILE   = join(DATA_DIR, 'tracker-state.json');
const SESSIONS_FILE = '/home/ubuntu/.openclaw/agents/main/sessions/sessions.json';
const CRON_RUNS_DIR = '/home/ubuntu/.openclaw/cron/runs';

const LAURA_AGENT_ID = process.env.LAURA_AGENT_ID || 'laura-abhi-agent';

// ── DB pool ───────────────────────────────────────────────────────────────────
const pool = new Pool({
  host:     process.env.BB_AGENTS_HOST || 'bb-agents-shared-db.cpsqyxgezuwr.us-east-2.rds.amazonaws.com',
  port:     5432,
  database: process.env.BB_AGENTS_DB   || 'bb_agents',
  user:     process.env.BB_AGENTS_USER || 'agent_writer',
  password: process.env.BB_AGENTS_PASSWORD || '2YzkGnjiHNN8CxeNkI76d6ao0yNvTz8',
  ssl: { rejectUnauthorized: false },
  max: 3,
  connectionTimeoutMillis: 8000,
  idleTimeoutMillis: 10000,
});

// ── Pricing (org-discounted ~1/3 published) ───────────────────────────────────
const PRICING = {
  'claude-haiku-4-5':  { input: 0.27,  cacheRead: 0.027, cacheWrite: 0.33,  output: 1.33  },
  'claude-sonnet-4-6': { input: 1.00,  cacheRead: 0.10,  cacheWrite: 1.25,  output: 5.00  },
  'claude-opus-4-6':   { input: 5.00,  cacheRead: 0.50,  cacheWrite: 6.25,  output: 25.00 },
  'claude-opus-4-5':   { input: 5.00,  cacheRead: 0.50,  cacheWrite: 6.25,  output: 25.00 },
};

function calcCost(model = '', inp = 0, out = 0, cr = 0, cw = 0) {
  const key = Object.keys(PRICING).find(k => model.includes(k.replace(/-\d+$/, '')));
  const p = PRICING[key] || PRICING['claude-sonnet-4-6'];
  return (inp * p.input + out * p.output + cr * p.cacheRead + cw * p.cacheWrite) / 1_000_000;
}

// ── Known spaces → requester name ─────────────────────────────────────────────
const SPACE_MAP = {
  'spaces/jhbx0saaaae': 'Abhi',
  'spaces/ihzhusaaaae': 'Ron',
  'spaces/q4_ytsaaaae': 'Alex',
  'spaces/aaqa0k7coto': 'Group',
  'spaces/aaqalnesvim': 'System', // Darren
};

// ── State helpers ─────────────────────────────────────────────────────────────
function loadState() {
  try { return JSON.parse(readFileSync(STATE_FILE, 'utf8')); }
  catch { return { lastRun: 0, processedKeys: {}, processedCronFiles: {} }; }
}

function saveState(s) {
  writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
}

// ── Classify session ──────────────────────────────────────────────────────────
function classify(key, session) {
  const k = key.toLowerCase();
  if (session.origin?.provider === 'cron' || k.includes(':cron:')) return 'cron';
  if (session.origin?.label === 'heartbeat' || k.includes('heartbeat')) return 'heartbeat';
  for (const space of Object.keys(SPACE_MAP)) {
    if (k.includes(space)) return 'user-task';
  }
  return 'system';
}

function requesterFromKey(key) {
  const k = key.toLowerCase();
  for (const [space, name] of Object.entries(SPACE_MAP)) {
    if (k.includes(space)) return name;
  }
  return 'System';
}

// ── Extract first user message from .jsonl session file ───────────────────────
function extractTitle(sessionFile) {
  if (!sessionFile || !existsSync(sessionFile)) return null;
  try {
    const lines = readFileSync(sessionFile, 'utf8').split('\n').filter(Boolean);
    for (const line of lines) {
      let d;
      try { d = JSON.parse(line); } catch { continue; }
      if (d.type !== 'message') continue;
      let msg = d.message;
      if (typeof msg === 'string') {
        try { msg = JSON.parse(msg.replace(/\bTrue\b/g,'true').replace(/\bFalse\b/g,'false').replace(/\bNone\b/g,'null')); }
        catch { continue; }
      }
      if (!msg || msg.role !== 'user') continue;
      const content = msg.content;
      let text = '';
      if (Array.isArray(content)) {
        text = content.filter(c => c.type === 'text').map(c => c.text).join(' ');
      } else if (typeof content === 'string') {
        text = content;
      }
      // Strip OpenClaw metadata wrapper — take content after last ``` block
      const metaEnd = text.lastIndexOf('```\n\n');
      if (metaEnd >= 0) text = text.substring(metaEnd + 5).trim();
      else {
        const altEnd = text.lastIndexOf('```\n');
        if (altEnd >= 0 && text.includes('"sender"')) text = text.substring(altEnd + 4).trim();
      }
      // Skip system prompts / heartbeats
      if (!text || text.startsWith('Pre-compaction') || text.startsWith('Read HEARTBEAT')) continue;
      if (text.length < 3) continue;
      return text.substring(0, 120);
    }
  } catch (e) {
    console.error(`  extractTitle error for ${sessionFile}: ${e.message}`);
  }
  return null;
}

// ── Write activity to bb_agents ───────────────────────────────────────────────
async function writeActivity(client, entry) {
  try {
    await client.query(`
      INSERT INTO agent_activities
        (id, agent_id, type, category, requested_by, title, actions,
         model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
         total_tokens, cost_usd, time_saved_min, source, session_key, timestamp)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      ON CONFLICT (id) DO NOTHING`,
      [
        randomUUID(), LAURA_AGENT_ID,
        entry.type, entry.category,
        entry.requestedBy, entry.title, entry.actions,
        entry.model,
        entry.inputTokens, entry.outputTokens, entry.cacheRead, entry.cacheWrite,
        entry.totalTokens, entry.costUsd,
        entry.timeSavedMin, entry.source, entry.sessionKey,
        entry.timestamp,
      ]
    );
    // Bump last_active_at
    await client.query(
      `UPDATE agent_registry SET last_active_at = NOW() WHERE agent_id = $1`,
      [LAURA_AGENT_ID]
    ).catch(() => {});
    return true;
  } catch (e) {
    console.error(`  writeActivity error: ${e.message}`);
    return false;
  }
}

// ── Process sessions ──────────────────────────────────────────────────────────
async function processSessions(client, state) {
  let sessions;
  try { sessions = JSON.parse(readFileSync(SESSIONS_FILE, 'utf8')); }
  catch (e) { console.error(`  Cannot read sessions.json: ${e.message}`); return 0; }

  let count = 0;
  for (const [key, session] of Object.entries(sessions)) {
    try {
      const updatedAt = session.updatedAt || 0;
      if (updatedAt <= state.lastRun) continue;
      if (state.processedKeys[key] === updatedAt) continue;

      const totalTokens = session.totalTokens || 0;
      if (totalTokens < 100) { state.processedKeys[key] = updatedAt; continue; }

      const type     = classify(key, session);
      const requester = requesterFromKey(key);
      const model    = session.model || '';
      const inp  = session.inputTokens  || 0;
      const out  = session.outputTokens || 0;
      const cr   = session.cacheRead    || 0;
      const cw   = session.cacheWrite   || 0;
      const cost = calcCost(model, inp, out, cr, cw);

      // Skip cron and heartbeat sessions — they generate noise with no signal.
      // Meaningful heartbeat summaries are logged via log_activity.py instead.
      if (type === 'cron' || type === 'heartbeat') {
        state.processedKeys[key] = updatedAt;
        continue;
      }

      let title = '';
      let category = 'routine';

      if (type === 'user-task') {
        title    = extractTitle(session.sessionFile) || 'Chat interaction';
        category = 'user';
      } else {
        title = `Background: ${model.split('-').slice(1,4).join('-') || 'system'}`;
      }

      const ok = await writeActivity(client, {
        type, category,
        requestedBy: requester,
        title: title.substring(0, 255),
        actions: JSON.stringify([]),
        model,
        inputTokens: inp, outputTokens: out, cacheRead: cr, cacheWrite: cw,
        totalTokens, costUsd: Math.round(cost * 100000) / 100000,
        timeSavedMin: type === 'user-task' ? Math.max(2, Math.round(out / 300)) : 0,
        source: 'tracker',
        sessionKey: key,
        timestamp: new Date(updatedAt).toISOString(),
      });

      if (ok) {
        count++;
        console.log(`  ✓ [${type}] ${requester}: ${title.substring(0,60)} — $${cost.toFixed(4)}`);
      }
      state.processedKeys[key] = updatedAt;
    } catch (e) {
      console.error(`  Session ${key.substring(0,40)}: ${e.message}`);
    }
  }
  return count;
}

// ── Process cron run logs ─────────────────────────────────────────────────────
async function processCronRuns(client, state) {
  if (!existsSync(CRON_RUNS_DIR)) return 0;
  let count = 0;
  let files;
  try { files = readdirSync(CRON_RUNS_DIR).filter(f => f.endsWith('.jsonl')); }
  catch { return 0; }

  for (const file of files) {
    const filePath = join(CRON_RUNS_DIR, file);
    try {
      const mtime = statSync(filePath).mtimeMs;
      if (mtime <= state.lastRun && state.processedCronFiles[file] === mtime) continue;

      const lines = readFileSync(filePath, 'utf8').split('\n').filter(Boolean);
      for (const line of lines) {
        let run;
        try { run = JSON.parse(line); } catch { continue; }
        if (!run.runAtMs || !run.jobId) continue;

        // Skip already processed (use jobId + runAtMs as dedup key)
        const dedupKey = `${run.jobId}:${run.runAtMs}`;
        if (state.processedKeys[dedupKey]) continue;

        const title = run.summary
          ? run.summary.substring(0, 120)
          : `Cron job ${run.jobId.substring(0, 8)}`;

        // Skip writing cron run logs to agent_activities — zero-cost noise.
        // Meaningful summaries are logged via log_activity.py.
        state.processedKeys[dedupKey] = true;
        const ok = true; // mark as processed without writing
      }

      state.processedCronFiles[file] = mtime;
    } catch (e) {
      console.error(`  Cron file ${file}: ${e.message}`);
    }
  }
  return count;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] Laura tracker starting...`);

  const state = loadState();
  console.log(`  Last run: ${state.lastRun ? new Date(state.lastRun).toISOString() : 'never'}`);

  let client;
  try {
    client = await pool.connect();
    console.log('  DB connected ✓');
  } catch (e) {
    console.error(`  DB connection failed: ${e.message}`);
    return;
  }

  try {
    const sessionCount = await processSessions(client, state);
    const cronCount    = await processCronRuns(client, state);
    const total = sessionCount + cronCount;
    console.log(`  Done: ${sessionCount} sessions + ${cronCount} cron runs = ${total} activities logged`);
    console.log(`  Duration: ${Date.now() - startTime}ms`);
  } finally {
    client.release();
    await pool.end();
  }

  state.lastRun = startTime;
  saveState(state);
}

main().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(0); // exit 0 so cron doesn't alarm
});
