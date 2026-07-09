#!/usr/bin/env node
/**
 * Sheet Sync — Pushes activity data from activities.json to Ed's Google Sheet.
 * Runs via cron every 5 minutes.
 * 
 * Strategy: Clear data rows then append all activities one row at a time.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ACTIVITIES_FILE = path.join(__dirname, 'data', 'activities.json');
const STATE_FILE = path.join(__dirname, 'data', 'sheet-sync-state.json');
const SHEET_ID = '1jbYfle4rYoY1Z0BE9ets0U2BjbqFVdBR8iJlC_XVkpE';
const TAB = 'BRIO ACTIVITY & COST';
const ACCOUNT = 'lpetersen@boldbusiness.com';
const GOG = '/usr/local/bin/gog';

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return { lastSync: null, lastHash: '' }; }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function loadActivities() {
  try { return JSON.parse(fs.readFileSync(ACTIVITIES_FILE, 'utf8')); }
  catch { return { activities: [] }; }
}

function gog(args) {
  try {
    return execSync(`${GOG} ${args}`, { 
      encoding: 'utf8', 
      timeout: 30000,
      env: process.env,
    }).trim();
  } catch (e) {
    console.error(`  GOG error: ${e.stderr || e.message}`);
    return null;
  }
}

function esc(s) {
  // Escape pipe chars (GOG cell separator) and clean whitespace
  return String(s || '').replace(/\|/g, '-').replace(/\n/g, ' ').replace(/"/g, "'").substring(0, 200);
}

function main() {
  console.log(`[${new Date().toISOString()}] Sheet sync running...`);
  
  const state = loadState();
  const data = loadActivities();
  const activities = data.activities || [];
  
  // Create a simple hash to detect changes
  const hash = `${activities.length}-${data.lastUpdated || ''}`;
  if (hash === state.lastHash) {
    console.log(`  No changes. Skipping.`);
    return;
  }
  
  console.log(`  ${activities.length} activities to sync.`);
  
  // Sort: most recent first
  const sorted = [...activities].sort((a, b) => 
    (b.timestamp || '').localeCompare(a.timestamp || '')
  );
  
  // Clear existing data (keep header row 1)
  const clearResult = gog(`sheets clear ${SHEET_ID} "'${TAB}'!A2:L1000" --account ${ACCOUNT} --plain --force`);
  if (clearResult === null) {
    console.error('  Failed to clear sheet. Aborting.');
    return;
  }
  console.log('  Cleared existing data.');
  
  // Append rows one at a time using gog sheets append
  let written = 0;
  
  for (const a of sorted) {
    const ts = a.timestamp ? new Date(a.timestamp) : new Date();
    // Convert to Ed's timezone (America/New_York)
    const etDate = ts.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); // YYYY-MM-DD
    const etTime = ts.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false });
    const date = etDate;
    const time = etTime;
    const type = a.type === 'user-task' ? 'User Task' : 
                 a.type === 'cron' ? 'Cron' : 
                 a.type === 'heartbeat' ? 'Heartbeat' : 'System';
    const model = (a.model || '').replace('claude-', '').replace(/-\d{8}$/, '');
    const cost = (a.costUsd || 0).toFixed(4);
    
    const row = [
      date,
      time,
      esc(a.requestedBy || 'System'),
      esc(a.title || 'Untitled'),
      type,
      model,
      a.inputTokens || 0,
      a.outputTokens || 0,
      a.cacheReadTokens || 0,
      a.cacheWriteTokens || 0,
      cost,
      a.timeSavedMin || 0,
    ].join('|');
    
    const result = gog(`sheets append ${SHEET_ID} "'${TAB}'!A:L" "${row}" --account ${ACCOUNT} --plain`);
    if (result !== null) {
      written++;
    } else {
      console.error(`  Failed to append: ${a.title?.substring(0, 40)}`);
    }
  }
  
  // Update state
  state.lastSync = new Date().toISOString();
  state.lastHash = hash;
  saveState(state);
  
  console.log(`  Done. ${written}/${sorted.length} activities synced to sheet.`);
}

main();
