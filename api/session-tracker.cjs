#!/usr/bin/env node
/**
 * Session Tracker v2 — Captures ALL OpenClaw sessions automatically.
 * 
 * Reads sessions.json every run, computes token DELTAS since last check,
 * and POSTs new activity entries for any session that had new usage.
 * 
 * Maps session keys to human-readable names and requesters.
 * Runs via cron every 5 minutes.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { Pool } = require('pg');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const pgPool = new Pool({
  host:     process.env.PG_HOST,
  port:     Number(process.env.PG_PORT) || 5432,
  user:     process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE || 'laura',
  ssl: { rejectUnauthorized: false },
});

async function pgWriteActivity(entry) {
  try {
    await pgPool.query(`
      INSERT INTO activities (
        id, type, category, requested_by, title, actions, model,
        input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
        total_tokens, cost_usd, source, session_key, timestamp
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      ON CONFLICT (id) DO NOTHING
    `, [
      entry.id, entry.type, entry.category || null, entry.requestedBy || null,
      entry.title, JSON.stringify(entry.actions || []), entry.model || null,
      entry.inputTokens || 0, entry.outputTokens || 0,
      entry.cacheReadTokens || 0, entry.cacheWriteTokens || 0,
      entry.totalTokens || 0, entry.costUsd || 0,
      entry.source || 'session-tracker', entry.sessionKey || null,
      entry.timestamp || new Date().toISOString(),
    ]);
  } catch (e) {
    // Non-fatal — session tracker continues even if PG is down
  }
}

const SESSIONS_FILE = '/home/ubuntu/.openclaw/agents/main/sessions/sessions.json';
const STATE_FILE = path.join(__dirname, 'data', 'session-tracker-state.json');
const LOG_FILE = path.join(__dirname, 'data', 'session-tracker.log');
const API_URL = 'http://127.0.0.1:3100/api/activities';

// ── Known session mappings ───────────────────────────────────────────────────
const SPACE_LABELS = {
  'spaces/ir_hmsaaaae': { name: 'Abhinanda Deb DM', requester: 'Ed' },
  'spaces/79zumsaaaae': { name: 'Ron Rivero DM', requester: 'Ron' },
  'spaces/kbbx1saaaae': { name: 'Jewel DM', requester: 'Jewel' },
  'spaces/aaqacuwn39y': { name: 'Laura Tech Team', requester: 'Group' },
  'spaces/aaqaxoavkvs': { name: 'Group Space', requester: 'Group' },
};

const CRON_LABELS = {
  'b576eaa8': 'Heartbeat Health Check',
  '38abf2ff': 'Hourly Inbox Scan (Weekday)',
  '14473b65': 'Laura Dashboard Sync',
  'b5a827ed': '11 AM Mid-Day Check',
  'b9c775ab': '5 PM EOD Flush',
  '23e81f12': 'EOD Wrap',
  'e250eea6': 'Evening One-Liner Check',
  '0251e3d7': 'Hourly Inbox Scan (Weekend)',
  '679c0064': '6 AM Daily Sync',
  '903939a9': 'Weekly Rules & Playbook',
  'ab5e04dc': 'Morning Brief',
};

// ── Model pricing (per 1M tokens) — ORG-DISCOUNTED (~1/3 published) ─────────
// Must match server.js MODEL_PRICING for consistency
const PRICING = {
  'claude-opus-4-6':   { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  'claude-sonnet-4-6': { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
  'claude-sonnet-4-5': { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
  'claude-haiku-4-5':  { input: 0.27, output: 1.33, cacheRead: 0.027, cacheWrite: 0.33 },
  'gemini-2.5-pro':    { input: 1.25, output: 5, cacheRead: 0.315, cacheWrite: 1.25 },
  'gemini-3.1-pro-preview': { input: 1.25, output: 5, cacheRead: 0.315, cacheWrite: 1.25 },
};

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch {}
}

const DAILY_SNAPSHOT_FILE = path.join(__dirname, 'data', 'session-daily-snapshots.json');

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return { sessions: {}, lastRun: null }; }
}

function saveState(state) {
  state.lastRun = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Daily snapshot management — saves end-of-day cumulative totals per session
 * so /api/cost/today can compute today-only deltas.
 */
function loadDailySnapshots() {
  try { return JSON.parse(fs.readFileSync(DAILY_SNAPSHOT_FILE, 'utf8')); }
  catch { return { snapshots: {}, lastSnapshotDate: null }; }
}

function saveDailySnapshots(data) {
  fs.writeFileSync(DAILY_SNAPSHOT_FILE, JSON.stringify(data, null, 2));
}

function checkDailyRollover(state) {
  const today = new Date().toISOString().slice(0, 10);
  const snaps = loadDailySnapshots();

  if (snaps.lastSnapshotDate === today) return; // Already snapshotted today

  // Day rolled over — save yesterday's cumulative totals as baseline
  const sessions = state.sessions || {};
  const baseline = {};
  for (const [key, s] of Object.entries(sessions)) {
    baseline[key] = {
      input: s.input || 0,
      output: s.output || 0,
      cacheRead: s.cacheRead || 0,
      cacheWrite: s.cacheWrite || 0,
    };
  }

  // Keep last 7 days of snapshots
  snaps.snapshots[today] = baseline;
  const dates = Object.keys(snaps.snapshots).sort();
  while (dates.length > 7) {
    delete snaps.snapshots[dates.shift()];
  }
  snaps.lastSnapshotDate = today;
  saveDailySnapshots(snaps);
  log(`Daily snapshot saved for ${today} (${Object.keys(baseline).length} sessions baselined)`);
}

function calcCost(model, input, output, cacheRead, cacheWrite) {
  const p = PRICING[model] || PRICING['claude-opus-4-6']; // default to opus
  return (
    (input * p.input / 1e6) +
    (output * p.output / 1e6) +
    (cacheRead * p.cacheRead / 1e6) +
    (cacheWrite * p.cacheWrite / 1e6)
  );
}

/**
 * Parse session key to extract type and identify who's talking
 */
function parseSession(key, session) {
  const origin = session.origin || {};
  const label = origin.label || '';
  const chatType = session.chatType || origin.chatType || 'unknown';
  
  // Cron sessions
  if (key.includes(':cron:')) {
    // Skip individual cron run sub-sessions (they duplicate the parent)
    if (key.includes(':run:')) return null;
    const cronId = key.split(':cron:')[1]?.substring(0, 8) || 'unknown';
    const cronName = CRON_LABELS[cronId] || label || cronId;
    return {
      type: 'cron',
      requester: 'System',
      title: `Cron: ${cronName}`,
      sessionType: 'background',
    };
  }
  
  // Direct messages
  if (key.includes(':direct:')) {
    const spaceMatch = key.match(/spaces\/([a-z0-9_]+)/i);
    const spaceKey = spaceMatch ? `spaces/${spaceMatch[1]}` : '';
    const known = SPACE_LABELS[spaceKey.toLowerCase()];
    
    return {
      type: 'direct',
      requester: known?.requester || label || 'Unknown',
      title: `Chat: ${known?.name || label || spaceKey}`,
      sessionType: 'user-task',
    };
  }
  
  // Group chats
  if (key.includes(':group:')) {
    const spaceMatch = key.match(/spaces\/([a-z0-9_]+)/i);
    const spaceKey = spaceMatch ? `spaces/${spaceMatch[1]}` : '';
    const known = SPACE_LABELS[spaceKey.toLowerCase()];
    
    // Skip thread sub-sessions and user-reference sessions
    if (key.includes('/threads/') || key.includes('/messages/') || key.includes('users/')) return null;
    
    return {
      type: 'group',
      requester: known?.requester || 'Group',
      title: `Group: ${known?.name || label || spaceKey}`,
      sessionType: 'user-task',
    };
  }
  
  // Main/heartbeat session
  if (key === 'agent:main:main') {
    return {
      type: 'system',
      requester: 'System',
      title: 'Heartbeat / System',
      sessionType: 'background',
    };
  }
  
  return null; // Skip unknown/unhandled
}

/**
 * POST activity to API server
 */
function postActivity(activity) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(activity);
    const req = http.request(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  log('Session tracker v2 running...');
  
  let sessions;
  try {
    sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
  } catch (e) {
    log(`ERROR: Cannot read sessions.json: ${e.message}`);
    return;
  }
  
  const state = loadState();
  
  // Check for daily rollover — snapshot yesterday's baselines
  checkDailyRollover(state);
  const prevSessions = state.sessions || {};
  let tracked = 0;
  let skipped = 0;
  
  for (const [key, session] of Object.entries(sessions)) {
    const parsed = parseSession(key, session);
    if (!parsed) { skipped++; continue; }
    
    const input = session.inputTokens || 0;
    const output = session.outputTokens || 0;
    const cacheRead = session.cacheRead || 0;
    const cacheWrite = session.cacheWrite || 0;
    const totalTokens = session.totalTokens || 0;
    const model = session.model || 'claude-opus-4-6';
    const updatedAt = session.updatedAt || 0;
    
    // Get previous state for this session
    const prev = prevSessions[key] || { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, updatedAt: 0 };
    
    // Calculate deltas
    const dInput = Math.max(0, input - prev.input);
    const dOutput = Math.max(0, output - prev.output);
    const dCacheRead = Math.max(0, cacheRead - prev.cacheRead);
    const dCacheWrite = Math.max(0, cacheWrite - prev.cacheWrite);
    const dTotal = dInput + dOutput + dCacheRead + dCacheWrite;
    
    // Skip if no new tokens
    if (dTotal === 0) { skipped++; continue; }
    
    // Skip if session hasn't been updated since last check
    if (updatedAt <= prev.updatedAt) { skipped++; continue; }
    
    const cost = calcCost(model, dInput, dOutput, dCacheRead, dCacheWrite);
    
    // Build date string for ID
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const hourStr = now.toISOString().slice(11, 13);
    
    // ── Category inference (Option 2: auto-categorize by session identity) ──
    let category;
    if (parsed.type === 'cron' || parsed.type === 'system') {
      category = 'routine';
    } else if (parsed.requester === 'Ed') {
      category = 'user-generated';
    } else if (parsed.requester === 'Ron' || parsed.requester === 'Jewel') {
      category = 'developer';
    } else if (parsed.requester === 'Group') {
      category = 'developer'; // group chat is dev/ops context
    } else {
      category = 'routine';
    }

    const activity = {
      id: `SESSION-${dateStr}-${hourStr}-${key.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 40)}`,
      type: parsed.sessionType,
      category,                          // ← now always set
      requestedBy: parsed.requester,
      title: parsed.title,
      timestamp: new Date(updatedAt).toISOString(),
      model: model,
      inputTokens: dInput,
      outputTokens: dOutput,
      cacheReadTokens: dCacheRead,
      cacheWriteTokens: dCacheWrite,
      costUsd: Math.round(cost * 10000) / 10000,
      source: 'session-tracker-v2',
      sessionKey: key,
      actions: [`Delta: +${dInput} in, +${dOutput} out, +${dCacheRead} cache-read, +${dCacheWrite} cache-write`],
    };
    
    try {
      // Dual-write: API (activities.json) + Postgres
      const [resp] = await Promise.allSettled([
        postActivity(activity),
        pgWriteActivity(activity),
      ]);
      if (resp.value?.status === 200 || resp.value?.status === 201) {
        tracked++;
        log(`  ✓ ${parsed.title} | +${dTotal} tokens | $${cost.toFixed(4)} | ${parsed.requester} [${category}]`);
      } else {
        // API down — PG still got it
        pgWriteActivity(activity);
        tracked++;
        log(`  ⚡ ${parsed.title} | API down, wrote to PG only | $${cost.toFixed(4)}`);
      }
    } catch (e) {
      log(`  ✗ ${parsed.title} | both writes failed: ${e.message}`);
    }
    
    // Update state for this session
    prevSessions[key] = { input, output, cacheRead, cacheWrite, totalTokens, updatedAt };
  }
  
  // Save state
  state.sessions = prevSessions;
  saveState(state);
  
  log(`Done. Tracked: ${tracked}, Skipped: ${skipped}`);
}

main().catch(e => log(`FATAL: ${e.message}`));
