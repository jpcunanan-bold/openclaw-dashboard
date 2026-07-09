#!/usr/bin/env node
/**
 * Daily Log Sync — Option 1
 * 
 * HOW IT WORKS:
 * 1. Reads today's memory/YYYY-MM-DD.md (Laura's flat file log)
 * 2. Parses task entries marked with [TASK], [DONE], or structured sections
 * 3. Writes new tasks to activities.json (avoiding duplicates by log-line hash)
 * 4. Runs every 15 minutes via cron
 * 
 * This means: even if the API server is down, Laura writes to the flat file.
 * When the server comes back up, this script catches up automatically.
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
        id, type, category, requested_by, title, request, actions, model,
        time_saved_min, source, timestamp
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (id) DO NOTHING
    `, [
      entry.id || `DLS-${Date.now()}`,
      entry.type || 'user-task', entry.category || null,
      entry.requestedBy || null, entry.title, entry.request || null,
      JSON.stringify(entry.actions || []), entry.model || null,
      entry.timeSavedMin || 0, entry.source || 'daily-log-sync',
      entry.timestamp || new Date().toISOString(),
    ]);
  } catch (e) { /* non-fatal */ }
}

const WORKSPACE = '/home/ubuntu/.openclaw/workspace';
const DATA_DIR = path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'daily-log-sync-state.json');
const LOG_FILE = path.join(DATA_DIR, 'daily-log-sync.log');
const API_BASE = 'http://127.0.0.1:3100';
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';

// Category inference from log context
const CATEGORY_MAP = {
  'Ed': 'user-generated',
  'Ron': 'developer',
  'Jewel': 'developer',
  'cron': 'routine',
  'system': 'routine',
  'Cron': 'routine',
};

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch {}
}

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return { synced: [] }; }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function getTodayLogPath() {
  const now = new Date();
  // Use ET timezone
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const y = et.getFullYear();
  const m = String(et.getMonth() + 1).padStart(2, '0');
  const d = String(et.getDate()).padStart(2, '0');
  return path.join(WORKSPACE, 'memory', `${y}-${m}-${d}.md`);
}

/**
 * Parse task lines from daily log.
 * Looks for patterns like:
 *   - [x] Task title (completed)
 *   - [TASK] Title | requester | time_saved_min
 *   - ## Section headings to infer context
 */
function parseTasksFromLog(content) {
  const tasks = [];
  const lines = content.split('\n');
  let currentRequester = 'System';
  let currentSection = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Track section headings for context
    if (line.startsWith('## ') || line.startsWith('# ')) {
      currentSection = line.replace(/^#+\s*/, '');
      // Infer requester from section heading
      if (/ed/i.test(currentSection)) currentRequester = 'Ed';
      else if (/ron/i.test(currentSection)) currentRequester = 'Ron';
      else if (/jewel/i.test(currentSection)) currentRequester = 'Jewel';
      else if (/cron|sync|heartbeat|routine/i.test(currentSection)) currentRequester = 'Cron';
      continue;
    }

    // Pattern 1: [TASK] structured entry
    // Format: [TASK] Title | requester | timeSavedMin
    const taskMatch = line.match(/^\[TASK\]\s+(.+?)(?:\s*\|\s*(\w+))?(?:\s*\|\s*(\d+))?$/i);
    if (taskMatch) {
      tasks.push({
        title: taskMatch[1].trim(),
        requester: taskMatch[2] || currentRequester,
        timeSavedMin: parseInt(taskMatch[3] || '0'),
        lineHash: hashLine(line + i),
        rawLine: line,
      });
      continue;
    }

    // Pattern 2: - [x] completed task
    const doneMatch = line.match(/^-\s*\[x\]\s+(.+)/i);
    if (doneMatch) {
      const title = doneMatch[1].trim();
      // Skip trivial lines
      if (title.length < 10) continue;
      tasks.push({
        title,
        requester: currentRequester,
        timeSavedMin: 0,
        lineHash: hashLine(line + i),
        rawLine: line,
      });
      continue;
    }

    // Pattern 3: - [x] with Ed/Ron context tags like "- [x] TASK (Ed)"
    const taggedMatch = line.match(/^-\s*\[x\]\s+(.+?)\s*\((Ed|Ron|Jewel|Cron|System)\)/i);
    if (taggedMatch) {
      tasks.push({
        title: taggedMatch[1].trim(),
        requester: taggedMatch[2],
        timeSavedMin: 0,
        lineHash: hashLine(line + i),
        rawLine: line,
      });
    }
  }

  return tasks;
}

function hashLine(str) {
  // Simple hash for dedup
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return `LH${Math.abs(h).toString(36)}`;
}

function postActivity(activity) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(activity);
    const req = http.request(`${API_BASE}/api/activities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Authorization': `Bearer ${AUTH_TOKEN}`,
      },
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

/**
 * Flush any activities that were queued when API was down
 */
async function flushPending() {
  const pendingFile = path.join(DATA_DIR, 'pending-activities.jsonl');
  if (!fs.existsSync(pendingFile)) return;

  const lines = fs.readFileSync(pendingFile, 'utf8').trim().split('\n').filter(Boolean);
  if (lines.length === 0) return;

  log(`Flushing ${lines.length} pending activities from offline queue...`);
  const remaining = [];

  for (const line of lines) {
    try {
      const activity = JSON.parse(line);
      const resp = await postActivity(activity);
      if (resp.status === 200 || resp.status === 201) {
        log(`  ✓ Flushed: ${activity.title}`);
      } else {
        remaining.push(line); // Keep for next attempt
      }
    } catch {
      remaining.push(line); // API still down
    }
  }

  if (remaining.length > 0) {
    fs.writeFileSync(pendingFile, remaining.join('\n') + '\n');
  } else {
    fs.unlinkSync(pendingFile);
    log('Pending queue cleared.');
  }
}

async function main() {
  log('Daily log sync running...');

  // First flush any tasks queued while API was offline
  await flushPending();

  const logPath = getTodayLogPath();
  if (!fs.existsSync(logPath)) {
    log(`No daily log found at ${logPath} — skipping`);
    return;
  }

  const content = fs.readFileSync(logPath, 'utf8');
  const tasks = parseTasksFromLog(content);
  const state = loadState();
  const alreadySynced = new Set(state.synced || []);

  log(`Found ${tasks.length} task entries in daily log`);

  let synced = 0;
  let skipped = 0;

  for (const task of tasks) {
    if (alreadySynced.has(task.lineHash)) {
      skipped++;
      continue;
    }

    const category = CATEGORY_MAP[task.requester] || 'routine';

    const activity = {
      type: 'user-task',
      category,
      requestedBy: task.requester,
      title: task.title,
      request: `From daily log: ${task.rawLine}`,
      actions: ['Captured from daily log file (memory/YYYY-MM-DD.md)'],
      source: 'daily-log-sync',
      model: 'anthropic/claude-sonnet-4-6',
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      timeSavedMin: task.timeSavedMin,
      timestamp: new Date().toISOString(),
    };

    try {
      // Dual-write: API (activities.json) + Postgres
      const [apiResult] = await Promise.allSettled([
        postActivity(activity),
        pgWriteActivity({ ...activity, id: task.lineHash }),
      ]);
      const apiOk = apiResult.value?.status === 200 || apiResult.value?.status === 201;
      if (apiOk) {
        synced++;
        alreadySynced.add(task.lineHash);
        log(`  ✓ [${category}] ${task.title}`);
      } else {
        // API down — PG still got it, queue for JSON sync later
        const fallback = path.join(DATA_DIR, 'pending-activities.jsonl');
        fs.appendFileSync(fallback, JSON.stringify(activity) + '\n');
        alreadySynced.add(task.lineHash);
        log(`  ⚡ API down — PG written, queued for JSON: ${task.title}`);
        synced++;
      }
    } catch (e) {
      const fallback = path.join(DATA_DIR, 'pending-activities.jsonl');
      fs.appendFileSync(fallback, JSON.stringify(activity) + '\n');
      log(`  ⚠ Both writes failed — queued: ${task.title}`);
      alreadySynced.add(task.lineHash);
    }
  }

  state.synced = [...alreadySynced];
  state.lastRun = new Date().toISOString();
  saveState(state);

  log(`Done. Synced: ${synced}, Skipped (already done): ${skipped}`);
}

main().catch(e => log(`FATAL: ${e.message}`));
