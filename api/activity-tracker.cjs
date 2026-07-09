#!/usr/bin/env node
/**
 * Activity Tracker — Parses OpenClaw session data to auto-log user↔Laura interactions.
 * Runs via cron every 2 minutes.
 * 
 * Data sources:
 *   1. sessions.json — lists all sessions with token counts, sender, model
 *   2. *.jsonl session files — contain actual message content
 * 
 * Logic:
 *   - Scan all sessions updated since last run
 *   - For each session with a user (not cron/heartbeat), extract user messages
 *   - Create/update activity entries with: who asked, what they asked, model, tokens, cost
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const SESSIONS_FILE = '/home/ubuntu/.openclaw/agents/main/sessions/sessions.json';
const STATE_FILE = path.join(__dirname, 'data', 'activity-tracker-state.json');
const ACTIVITIES_FILE = path.join(__dirname, 'data', 'activities.json');

// Model pricing per 1M tokens
const PRICING = {
  'claude-opus-4-6': { input: 15, cacheRead: 1.5, cacheWrite: 18.75, output: 75 },
  'claude-sonnet-4-6': { input: 3, cacheRead: 0.3, cacheWrite: 3.75, output: 15 },
  'claude-sonnet-4-5-20250929': { input: 3, cacheRead: 0.3, cacheWrite: 3.75, output: 15 },
  'claude-haiku-4-5-20251001': { input: 0.80, cacheRead: 0.08, cacheWrite: 1.0, output: 4 },
};

function getPricing(model) {
  if (PRICING[model]) return PRICING[model];
  for (const [k, v] of Object.entries(PRICING)) {
    if (model && model.includes(k.split('-').slice(0, 3).join('-'))) return v;
  }
  return PRICING['claude-sonnet-4-6']; // fallback
}

function calcCost(tokens, model) {
  const p = getPricing(model);
  return (
    (tokens.inputTokens || 0) * p.input / 1e6 +
    (tokens.outputTokens || 0) * p.output / 1e6 +
    (tokens.cacheRead || 0) * p.cacheRead / 1e6 +
    (tokens.cacheWrite || 0) * p.cacheWrite / 1e6
  );
}

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return { lastRun: 0, processedSessions: {} }; }
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function loadActivities() {
  try { return JSON.parse(fs.readFileSync(ACTIVITIES_FILE, 'utf8')); }
  catch { return { activities: [], lastUpdated: null }; }
}

function saveActivities(data) {
  data.lastUpdated = new Date().toISOString();
  fs.writeFileSync(ACTIVITIES_FILE, JSON.stringify(data, null, 2));
}

/**
 * Extract user messages from a session JSONL file.
 * Returns array of { timestamp, sender, text }
 */
function extractUserMessages(sessionFile) {
  if (!fs.existsSync(sessionFile)) return [];
  const messages = [];
  
  try {
    const lines = fs.readFileSync(sessionFile, 'utf8').split('\n').filter(Boolean);
    
    for (const line of lines) {
      let d;
      try { d = JSON.parse(line); } catch { continue; }
      if (d.type !== 'message') continue;
      
      let msg = d.message;
      if (typeof msg === 'string') {
        // Handle Python-style dict strings from OpenClaw
        try {
          // Replace Python True/False/None with JSON equivalents
          const jsonStr = msg
            .replace(/\bTrue\b/g, 'true')
            .replace(/\bFalse\b/g, 'false')
            .replace(/\bNone\b/g, 'null');
          msg = JSON.parse(jsonStr);
        } catch {
          try {
            // Try eval-like approach using Function
            msg = (new Function('return ' + msg.replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false').replace(/\bNone\b/g, 'null')))();
          } catch { continue; }
        }
      }
      
      if (!msg || msg.role !== 'user') continue;
      
      let text = '';
      const content = msg.content;
      if (Array.isArray(content)) {
        text = content.filter(c => c.type === 'text').map(c => c.text).join(' ');
      } else if (typeof content === 'string') {
        text = content;
      }
      
      // Extract actual user message (strip OpenClaw metadata wrappers)
      // Pattern: everything after the last ``` block from metadata
      const metaEnd = text.lastIndexOf('```\n\n');
      if (metaEnd > 0) {
        text = text.substring(metaEnd + 5).trim();
      } else {
        // Try simpler pattern — after "Sender (untrusted" block
        const senderEnd = text.lastIndexOf('```\n');
        if (senderEnd > 0 && text.indexOf('untrusted') > -1) {
          text = text.substring(senderEnd + 4).trim();
        }
      }
      
      // Skip system/compaction messages
      if (!text || text.startsWith('Pre-compaction') || text.startsWith('Current time:')) continue;
      if (text.length < 2) continue;
      
      // Extract sender from metadata if present
      let sender = 'Unknown';
      const senderMatch = msg.content?.[0]?.text?.match(/"sender":\s*"([^"]+)"/);
      if (senderMatch) sender = senderMatch[1].split(' ')[0]; // First name
      
      messages.push({
        timestamp: d.timestamp,
        sender,
        text: text.substring(0, 500),
      });
    }
  } catch (e) {
    console.error(`  Error reading ${sessionFile}: ${e.message}`);
  }
  
  return messages;
}

/**
 * Determine session type: user-task, cron, heartbeat
 */
function classifySession(key, session) {
  if (key.includes(':cron:')) return 'cron';
  if (session.origin?.label === 'heartbeat' || key.includes('heartbeat')) return 'heartbeat';
  if (session.origin?.label && session.origin.label !== 'unknown') return 'user-task';
  return 'system';
}

/**
 * Get a human-readable sender name from session data
 */
function getSenderName(session) {
  const label = session.origin?.label || '';
  if (label === 'heartbeat') return 'System';
  if (label === 'unknown' || !label) return 'System';
  
  // Known name mappings
  const nameMap = {
    'Edward Kopko': 'Ed',
    'Ron Rivero': 'Ron',
    'Muhammad Nurunnabi': 'Jewel',
    'Laura Rhodes': 'System', // Laura-initiated sessions are system
  };
  
  // Check full label match first
  for (const [full, short] of Object.entries(nameMap)) {
    if (label.toLowerCase().includes(full.toLowerCase())) return short;
  }
  
  // Check if label starts with a Google Chat display name
  const firstName = label.split(' ')[0];
  if (firstName === 'Laura' || firstName === 'Command') return 'System';
  
  return firstName || label;
}

/**
 * Generate an activity title from user messages
 */
function generateTitle(messages, sessionType) {
  if (sessionType === 'cron') return 'Scheduled cron task';
  if (sessionType === 'heartbeat') return 'Heartbeat health check';
  
  // Use the first meaningful user message as the title
  for (const m of messages) {
    let text = m.text.trim();
    if (text.length < 3) continue;
    // Truncate to a good title length
    if (text.length > 80) text = text.substring(0, 77) + '...';
    return text;
  }
  
  return 'Chat interaction';
}

async function postActivity(activity) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(activity);
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3100,
      path: '/api/activities',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const now = Date.now();
  const state = loadState();
  const lastRun = state.lastRun || 0;
  
  console.log(`[${new Date().toISOString()}] Activity tracker running...`);
  console.log(`  Last run: ${lastRun ? new Date(lastRun).toISOString() : 'never'}`);
  
  // Load sessions
  let sessions;
  try {
    sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
  } catch (e) {
    console.error(`  Failed to read sessions: ${e.message}`);
    return;
  }
  
  // Find sessions updated since last run
  let newActivities = 0;
  const processedSessions = state.processedSessions || {};
  
  for (const [key, session] of Object.entries(sessions)) {
    const updatedAt = session.updatedAt || 0;
    
    // Skip if not updated since last run
    if (updatedAt <= lastRun) continue;
    
    // Skip if we already processed this exact timestamp (dedup)
    if (processedSessions[key] === updatedAt) continue;
    
    const sessionType = classifySession(key, session);
    let senderName = getSenderName(session);
    const model = session.model || 'unknown';
    
    const tokens = {
      inputTokens: session.inputTokens || 0,
      outputTokens: session.outputTokens || 0,
      cacheRead: session.cacheRead || 0,
      cacheWrite: session.cacheWrite || 0,
    };
    
    const totalTokens = session.totalTokens || 0;
    const cost = calcCost(tokens, model);
    
    // Skip very small sessions (< 100 tokens — probably just session init)
    if (totalTokens < 100) continue;
    
    // Extract user messages for title/description
    let messages = [];
    let title = '';
    let request = '';
    
    if (session.sessionFile && sessionType === 'user-task') {
      messages = extractUserMessages(session.sessionFile);
      title = generateTitle(messages, sessionType);
      // Build request text from all user messages
      request = messages.map(m => m.text).join('\n---\n');
      if (request.length > 1000) request = request.substring(0, 997) + '...';
      
      // For group chats, try to extract real sender from message metadata
      if (senderName === 'System' || senderName === 'Laura' || senderName === 'Command') {
        for (const m of messages) {
          if (m.sender && m.sender !== 'Unknown' && m.sender !== 'System') {
            // Map known names
            const nameMap = { 'Ron': 'Ron', 'Edward': 'Ed', 'Ed': 'Ed', 'Muhammad': 'Jewel', 'Jewel': 'Jewel' };
            senderName = nameMap[m.sender] || m.sender;
            break;
          }
        }
      }
    } else {
      title = sessionType === 'cron' ? 'Scheduled cron task' :
              sessionType === 'heartbeat' ? 'Heartbeat health check' :
              `Background: ${model}`;
    }
    
    // Create activity
    const activity = {
      type: sessionType === 'user-task' ? 'user-task' : 'system',
      requestedBy: senderName,
      title,
      request: request || `Automatic ${sessionType} session`,
      actions: sessionType === 'user-task' 
        ? messages.map(m => `[${m.sender}] ${m.text.substring(0, 100)}`).slice(0, 10)
        : [`${sessionType} execution`],
      model: model,
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
      cacheReadTokens: tokens.cacheRead,
      cacheWriteTokens: tokens.cacheWrite,
      timeSavedMin: sessionType === 'user-task' ? Math.max(5, Math.round(tokens.outputTokens / 200)) : 0,
      sessionKey: key,
    };
    
    try {
      await postActivity(activity);
      newActivities++;
      console.log(`  → ${sessionType}: [${senderName}] ${title.substring(0, 60)} — $${cost.toFixed(4)}`);
      processedSessions[key] = updatedAt;
    } catch (e) {
      console.error(`  Failed to post activity for ${key}: ${e.message}`);
    }
  }
  
  // Save state
  state.lastRun = now;
  state.processedSessions = processedSessions;
  saveState(state);
  
  console.log(`  Done. ${newActivities} new activities logged.`);
}

main().catch(e => console.error('Fatal:', e));
