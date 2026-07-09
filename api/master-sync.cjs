#!/usr/bin/env node
/**
 * Master Sheet Sync — Writes completed activities back to Ed's Master sheet.
 * Runs via cron every 5 minutes.
 * 
 * Logic:
 *   - Reads activities.json for user-task entries not yet synced to Master
 *   - Generates next Task ID (BB-XXX or PER-XXX based on domain)
 *   - Appends new rows to the Master sheet
 *   - Marks activities as synced so they don't get re-added
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ACTIVITIES_FILE = path.join(__dirname, 'data', 'activities.json');
const STATE_FILE = path.join(__dirname, 'data', 'master-sync-state.json');
const SHEET_ID = '1jbYfle4rYoY1Z0BE9ets0U2BjbqFVdBR8iJlC_XVkpE';
const ACCOUNT = 'lpetersen@boldbusiness.com';
const GOG = '/usr/local/bin/gog';

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return { syncedIds: [], lastTaskNum: 0 }; }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function loadActivities() {
  try { return JSON.parse(fs.readFileSync(ACTIVITIES_FILE, 'utf8')); }
  catch { return { activities: [] }; }
}

function saveActivities(data) {
  data.lastUpdated = new Date().toISOString();
  fs.writeFileSync(ACTIVITIES_FILE, JSON.stringify(data, null, 2));
}

function gog(args) {
  try {
    return execSync(`${GOG} ${args}`, {
      encoding: 'utf8',
      timeout: 30000,
      env: process.env,
    }).trim();
  } catch (e) {
    console.error(`  GOG error: ${e.message?.substring(0, 200)}`);
    return null;
  }
}

function esc(s) {
  // Escape: pipes (GOG cell sep), commas (GOG row sep), double quotes, newlines
  return String(s || '').replace(/\|/g, '-').replace(/,/g, ';').replace(/\n/g, ' ').replace(/"/g, "'").substring(0, 500);
}

/**
 * Get the next task ID by scanning existing IDs on the Master sheet
 */
function getNextTaskId(prefix) {
  try {
    const raw = gog(`sheets get ${SHEET_ID} "Master!A:A" --account ${ACCOUNT} --json`);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const ids = (data.values || []).flat().filter(id => id && id.startsWith(prefix + '-'));
    
    let maxNum = 0;
    for (const id of ids) {
      const num = parseInt(id.split('-')[1], 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
    
    return `${prefix}-${String(maxNum + 1).padStart(3, '0')}`;
  } catch (e) {
    console.error(`  Error getting next task ID: ${e.message}`);
    return null;
  }
}

/**
 * Determine domain and task ID prefix from activity data
 */
function getDomain(activity) {
  const title = (activity.title || '').toLowerCase();
  const request = (activity.request || '').toLowerCase();
  const combined = title + ' ' + request;
  
  if (combined.includes('personal') || combined.includes('kopko.com') || 
      combined.includes('dentist') || combined.includes('doctor') ||
      combined.includes('lenore') || combined.includes('apartment')) {
    return { domain: 'Personal', prefix: 'PER' };
  }
  if (combined.includes('mercury') || combined.includes('mercuryz')) {
    return { domain: 'Mercury Z', prefix: 'MZ' };
  }
  return { domain: 'Bold Business', prefix: 'BB' };
}

/**
 * Map requester to priority
 */
function getPriority(activity) {
  const req = activity.requestedBy || '';
  if (req === 'Ed') return '🔴 HIGH';
  if (req === 'Ron' || req === 'Jewel') return '🟡 MEDIUM';
  return '🟢 LOW';
}

function main() {
  console.log(`[${new Date().toISOString()}] Master sync running...`);
  
  const state = loadState();
  const data = loadActivities();
  const activities = data.activities || [];
  const syncedIds = new Set(state.syncedIds || []);
  
  // Find user-task activities not yet synced — ONLY Ed's tasks go to Master
  const unsyncedTasks = activities.filter(a => 
    a.type === 'user-task' && 
    a.id && 
    !syncedIds.has(a.id) &&
    !a.masterSynced &&
    (a.requestedBy || '').toLowerCase() === 'ed'
  );
  
  if (unsyncedTasks.length === 0) {
    console.log('  No new tasks to sync.');
    return;
  }
  
  console.log(`  ${unsyncedTasks.length} new tasks to sync to Master.`);
  
  // Track prefix counters so we don't re-scan for each task
  const prefixCounters = {};
  
  let synced = 0;
  
  for (const activity of unsyncedTasks) {
    const { domain, prefix } = getDomain(activity);
    
    // Get next ID for this prefix
    if (!prefixCounters[prefix]) {
      const nextId = getNextTaskId(prefix);
      if (!nextId) {
        console.error(`  Failed to get next ID for prefix ${prefix}. Skipping.`);
        continue;
      }
      const num = parseInt(nextId.split('-')[1], 10);
      prefixCounters[prefix] = num;
    } else {
      prefixCounters[prefix]++;
    }
    
    const taskId = `${prefix}-${String(prefixCounters[prefix]).padStart(3, '0')}`;
    
    // Build row data
    const ts = activity.timestamp ? new Date(activity.timestamp) : new Date();
    const dateCompleted = ts.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const priority = getPriority(activity);
    const model = activity.model || '';
    const cost = (activity.costUsd || 0).toFixed(4);
    const timeSaved = activity.timeSavedMin || 0;
    
    // Build notes from actions
    const actions = (activity.actions || []).join('. ');
    const notes = activity.request 
      ? `[${activity.requestedBy}] ${activity.request}. Actions: ${actions}`.substring(0, 500)
      : actions.substring(0, 500);
    
    const row = [
      taskId,
      priority,
      esc(activity.title),
      'Laura',
      '✅ DONE',
      dateCompleted,
      domain,
      esc(notes),
      dateCompleted,
      timeSaved,
      model,
      cost,
    ].join('|');
    
    const result = gog(`sheets append ${SHEET_ID} "Master!A:L" "${row}" --account ${ACCOUNT} --plain`);
    
    if (result !== null) {
      synced++;
      syncedIds.add(activity.id);
      
      // Also mark in activities.json
      activity.masterSynced = true;
      activity.masterTaskId = taskId;
      
      console.log(`  → ${taskId}: ${activity.title?.substring(0, 50)} [${domain}]`);
    } else {
      console.error(`  Failed to append: ${activity.title?.substring(0, 40)}`);
    }
  }
  
  // Save state
  state.syncedIds = [...syncedIds];
  saveState(state);
  
  // Save activities with masterSynced flags
  saveActivities(data);
  
  console.log(`  Done. ${synced}/${unsyncedTasks.length} tasks synced to Master.`);
}

main();
