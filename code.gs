/**
 * Laura Dashboard Dashboard — Apps Script Web App (v5 — ROI + Anthropic Admin API)
 *
 * Reads ALL sheets from Abhinanda Deb's Laura Dashboard and serves a live dashboard.
 * Includes write-back capability for status updates and notes.
 * Adds Laura Value / ROI / Cost support via:
 *  - Master!J: "Est. Time Saved (min)"
 *  - Optional "BRIO VALUE & ROI" sheet (created by setupRoiSheets)
 *  - Anthropic Admin API (usage_report + cost_report) via Script Properties
 *
 * IMPORTANT: Do NOT store API keys in sheets. Store in Script Properties.
 */

// ── CONFIG ──────────────────────────────────────────────────────────────────────
// Default Laura Dashboard sheet (can be overridden via Script Property COMMAND_CENTER_SHEET_ID)
var SHEET_ID = '1jbYfle4rYoY1Z0BE9ets0U2BjbqFVdBR8iJlC_XVkpE';
var PROP_COMMAND_CENTER_SHEET_ID = 'COMMAND_CENTER_SHEET_ID';

// Ed's timezone — all "today" comparisons use this so the dashboard is correct
// regardless of the Apps Script server timezone setting.
var ED_TIMEZONE = 'America/New_York';

var ALLOWED_USERS = [
  'lpetersen@boldbusiness.com',
  'rrivero@boldbusiness.com',
  'mnurunnabi@boldbusiness.com'
];

var ROI_SHEET_NAME = 'BRIO VALUE & ROI';

// Script Properties keys
var PROP_ANTHROPIC_ADMIN_API_KEY = 'ANTHROPIC_ADMIN_API_KEY';
var PROP_ANTHROPIC_USAGE_FILTER_API_KEY_IDS = 'ANTHROPIC_USAGE_API_KEY_IDS'; // optional CSV
var PROP_ANTHROPIC_USAGE_FILTER_WORKSPACE_IDS = 'ANTHROPIC_USAGE_WORKSPACE_IDS'; // optional CSV

// Default Laura scope (safe to hardcode: api_key_id is an identifier, not a secret)
var DEFAULT_BRIO_API_KEY_IDS = ['apikey_01KySrhDBYigkA5dAwg7GWS5'];
var DEFAULT_BRIO_SCOPE_LABEL = 'Laura only';

var ANTHROPIC_VERSION = '2023-06-01';

var SHEET_NAMES = [
  'Master',
  'Task Acceptance',
  'DECISIONS',
  'DashBoard',
  'WEEKLY_REVIEW',
  'MAYBE_SOMEDAY',
  'Bold Business',
  'Mercury Z',
  'EDKOPKO.COM PR',
  'Personal',
  "DUSTIN'S BOARD",
  "MEL'S BOARD",
  "RELATIONSHIPS",
  "AMANDA'S BOARD",
  "LENORE'S BOARD",
  "BRIO'S BOARD",
  'LEADERSHIP CALL PREP',
  'BAIIT TEAM OVERVIEW',
  'MARKETING TEAM OVERVIEW',
  'GOAL DASHBOARD',
  'DAILY SYNC LOG',
  'ARCHIVE',
  ROI_SHEET_NAME
];

// ── WEB APP ENTRY ───────────────────────────────────────────────────────────────

function doGet(e) {
  // ── React Dashboard API ── must come BEFORE the user gate ──────────────────
  // Secured via REACT_API_SECRET stored in Script Properties.
  // In Apps Script editor: Project Settings → Script Properties → add:
  //   Key: REACT_API_SECRET   Value: any random string you choose
  if (e && e.parameter && e.parameter.api === '1') {
    var props = PropertiesService.getScriptProperties();
    var secret = props.getProperty('REACT_API_SECRET') || '';
    var provided = (e.parameter.secret || '');
    if (secret && provided !== secret) {
      return ContentService.createTextOutput(JSON.stringify({ error: 'Unauthorized' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    try {
      var data = buildDashboardData_();
      return ContentService.createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  // ── HTML Dashboard (original) — user-gated ─────────────────────────────────
  var user = Session.getActiveUser().getEmail().toLowerCase();
  if (ALLOWED_USERS.indexOf(user) === -1) {
    return HtmlService.createHtmlOutput('<h1>Access Denied</h1><p>You are not authorized.</p>')
      .setTitle('Laura Dashboard — Access Denied');
  }

  // Optional one-shot setup: /?setup=1
  if (e && e.parameter && e.parameter.setup === '1') {
    var result = setupRoiSheets();
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return HtmlService.createHtmlOutputFromFile('Dashboard')
    .setTitle("Abhinanda Deb — Laura Dashboard")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ── PUBLIC RPC (Dashboard.html calls) ───────────────────────────────────────────

function getDashboardData() {
  return buildDashboardData_();
}

function setupRoiSheets() {
  var ss = openCommandCenterSpreadsheet_();
  ensureMasterTimeSavedColumn_(ss);
  ensureRoiSheetExists_(ss);
  SpreadsheetApp.flush();
  return { success: true, message: 'ROI sheet + Master time-saved column ensured.' };
}

// ── DATA BUILDER ────────────────────────────────────────────────────────────────

function buildDashboardData_() {
  var ss = openCommandCenterSpreadsheet_();

  var raw = {};
  for (var i = 0; i < SHEET_NAMES.length; i++) {
    raw[SHEET_NAMES[i]] = getSheetData_(ss, SHEET_NAMES[i]);
  }

  var tasks = parseMasterTasks_(raw['Master']);
  var acceptance = parseTaskAcceptance_(raw['Task Acceptance']);
  var decisions = parseDecisions_(raw['DECISIONS']);
  var archive = parseArchive_(raw['ARCHIVE']);
  var syncLog = parseSyncLog_(raw['DAILY SYNC LOG']);
  var relationships = parseRelationships_(raw['RELATIONSHIPS']);
  var weeklyReview = parseWeeklyReview_(raw['WEEKLY_REVIEW']);
  var maybeSomeday = parseMaybeSomeday_(raw['MAYBE_SOMEDAY']);
  var mercuryZ = parseDomainSheet_(raw['Mercury Z']);
  var goalDashboard = parseGoalDashboard_(raw['GOAL DASHBOARD']);

  var boards = {
    dustin: parseBoard_(raw["DUSTIN'S BOARD"], 'Dustin'),
    mel: parseBoard_(raw["MEL'S BOARD"], 'Mel'),
    amanda: parseBoard_(raw["AMANDA'S BOARD"], 'Amanda'),
    lenore: parseBoard_(raw["LENORE'S BOARD"], 'Lenore'),
    laura: parseBoard_(raw["BRIO'S BOARD"], 'Laura')
  };

  var teamOverviews = {
    baiit: parseRawSheet_(raw['BAIIT TEAM OVERVIEW']),
    marketing: parseRawSheet_(raw['MARKETING TEAM OVERVIEW']),
    leadershipPrep: parseRawSheet_(raw['LEADERSHIP CALL PREP'])
  };

  var lauraActivity = parseLauraActivityLog_(raw['GOAL DASHBOARD']);

  var kpis = computeKPIs_(tasks, archive);
  var byOwner = groupByOwner_(tasks);
  var byDomain = groupByDomain_(tasks);

  // ROI payload: includes Master time saved rollups + Anthropic Admin API snapshots (cached)
  var roi = buildRoiData_(tasks);

  return {
    timestamp: new Date().toISOString(),
    sourceInfo: {
      spreadsheetId: ss.getId(),
      spreadsheetName: ss.getName(),
      mode: 'openById',
      configuredSheetId: getCommandCenterSheetId_()
    },
    kpis: kpis,
    roi: roi,
    tasks: tasks,
    acceptance: acceptance,
    decisions: decisions,
    archive: archive,
    syncLog: syncLog,
    weeklyReview: weeklyReview,
    maybeSomeday: maybeSomeday,
    mercuryZSheet: mercuryZ,
    goalDashboard: goalDashboard,
    boards: boards,
    teamOverviews: teamOverviews,
    relationships: relationships,
    lauraActivity: lauraActivity,
    byOwner: byOwner,
    byDomain: byDomain
  };
}

// ── ROI DATA ───────────────────────────────────────────────────────────────────

function buildRoiData_(tasks) {
  var timeSavedAll = 0;
  var timeSavedCompleted = 0;
  var lauraTaskCount = 0;

  for (var i = 0; i < tasks.length; i++) {
    var t = tasks[i];
    var owner = String(t.owner || '').toLowerCase();
    if (owner.indexOf('laura') < 0) continue;

    lauraTaskCount++;
    var min = toNumber_(t.timeSavedMin);
    if (min) timeSavedAll += min;

    var s = (t.statusRaw || t.status || '').toUpperCase();
    if (s.indexOf('DONE') >= 0 || s.indexOf('REJECTED') >= 0 || s.indexOf('ROUTED') >= 0) {
      if (min) timeSavedCompleted += min;
    }
  }

  var anthropic = getAnthropicUsageAndCostSnapshot_(7);

  return {
    timeSaved: {
      allTasksMin: Math.round(timeSavedAll * 10) / 10,
      completedTasksMin: Math.round(timeSavedCompleted * 10) / 10,
      lauraTaskCount: lauraTaskCount,
      scopeLabel: 'Laura-owned tasks only'
    },
    anthropic: anthropic
  };
}

// ── TEST FUNCTION (run from Apps Script editor to verify API key) ──────────────
function testAnthropicApi() {
  var adminKey = getProp_(PROP_ANTHROPIC_ADMIN_API_KEY);
  if (!adminKey) {
    Logger.log('ERROR: No ANTHROPIC_ADMIN_API_KEY in Script Properties');
    return;
  }
  Logger.log('Key found: ' + adminKey.substring(0, 20) + '...');

  var now = new Date();
  var end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  var start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 3);

  var url = 'https://api.anthropic.com/v1/organizations/usage' +
    '?starting_at=' + encodeURIComponent(start.toISOString()) +
    '&ending_at=' + encodeURIComponent(end.toISOString()) +
    '&bucket_width=1d' +
    '&group_by=model';

  Logger.log('Calling: ' + url);
  var resp = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {
      'anthropic-version': '2023-06-01',
      'x-api-key': adminKey
    },
    muteHttpExceptions: true
  });

  Logger.log('HTTP ' + resp.getResponseCode());
  Logger.log('Response: ' + resp.getContentText().substring(0, 2000));
}

function getAnthropicUsageAndCostSnapshot_(days) {
  var cache = CacheService.getScriptCache();
  var cacheKey = 'anthropic_usage_v2_' + String(days || 7);
  var cached = cache.get(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch (e) {}
  }

  var adminKey = getProp_(PROP_ANTHROPIC_ADMIN_API_KEY);
  if (!adminKey) {
    return {
      enabled: false,
      error: 'Missing Script Property: ANTHROPIC_ADMIN_API_KEY'
    };
  }

  var range = buildUtcDayRange_(days || 7);

  // Fetch usage (tokens by model by day)
  var usage = fetchAnthropicMessagesUsage_(adminKey, range.startingAt, range.endingAt, getAnthropicScopeConfig_());
  if (usage && usage.error) {
    return { enabled: false, error: usage.error, detail: usage.detail || '' };
  }

  // Fetch cost (org-wide — Anthropic cost API doesn't filter by api_key)
  var cost = fetchAnthropicCostReport_(adminKey, range.startingAt, range.endingAt);

  var stitched = stitchUsageAndCost_(usage, cost);
  stitched.enabled = true;
  stitched.costEnabled = true;
  stitched.startingAt = range.startingAt;
  stitched.endingAt = range.endingAt;

  // If cost had an error, still show usage but flag it
  if (cost && cost.error) {
    stitched.costEnabled = false;
    stitched.costError = cost.error;
  }

  try {
    cache.put(cacheKey, JSON.stringify(stitched), 600);
  } catch (e) {
    // cache payload too large — skip caching
  }
  return stitched;
}

function buildUtcDayRange_(days) {
  var now = new Date();
  // ending_at must be exclusive; use tomorrow 00:00Z to include today.
  var end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
  var start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days || 7));
  return {
    startingAt: start.toISOString(),
    endingAt: end.toISOString()
  };
}

function fetchAnthropicMessagesUsage_(adminKey, startingAtIso, endingAtIso, scope) {
  var url = 'https://api.anthropic.com/v1/organizations/usage_report/messages' +
    '?starting_at=' + encodeURIComponent(startingAtIso) +
    '&ending_at=' + encodeURIComponent(endingAtIso) +
    '&bucket_width=1d' +
    '&group_by[]=model';

  // Effective scope: Laura-only by default unless explicitly overridden in Script Properties.
  var apiKeyIds = (scope && scope.apiKeyIds) ? scope.apiKeyIds : [];
  for (var i = 0; i < apiKeyIds.length; i++) {
    url += '&api_key_ids[]=' + encodeURIComponent(apiKeyIds[i]);
  }
  var workspaceIds = (scope && scope.workspaceIds) ? scope.workspaceIds : [];
  for (var w = 0; w < workspaceIds.length; w++) {
    url += '&workspace_ids[]=' + encodeURIComponent(workspaceIds[w]);
  }

  var resp = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {
      'anthropic-version': ANTHROPIC_VERSION,
      'x-api-key': adminKey,
      'User-Agent': 'OpenClaw-CommandCenter/1.0 (https://boldbusiness.com)'
    },
    muteHttpExceptions: true
  });

  var code = resp.getResponseCode();
  var text = resp.getContentText();
  if (code < 200 || code >= 300) {
    return { error: 'Anthropic usage_report/messages HTTP ' + code, detail: safeTrunc_(text, 1200), raw: null };
  }

  try {
    return JSON.parse(text);
  } catch (e) {
    return { error: 'Anthropic usage_report/messages parse error', detail: String(e), raw: safeTrunc_(text, 1200) };
  }
}

function fetchAnthropicCostReport_(adminKey, startingAtIso, endingAtIso) {
  // cost_report groups by description, which includes model + token_type.
  var url = 'https://api.anthropic.com/v1/organizations/cost_report' +
    '?starting_at=' + encodeURIComponent(startingAtIso) +
    '&ending_at=' + encodeURIComponent(endingAtIso) +
    '&bucket_width=1d' +
    '&group_by[]=description';

  var resp = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {
      'anthropic-version': ANTHROPIC_VERSION,
      'x-api-key': adminKey,
      'User-Agent': 'OpenClaw-CommandCenter/1.0 (https://boldbusiness.com)'
    },
    muteHttpExceptions: true
  });

  var code = resp.getResponseCode();
  var text = resp.getContentText();
  if (code < 200 || code >= 300) {
    return { error: 'Anthropic cost_report HTTP ' + code, detail: safeTrunc_(text, 1200), raw: null };
  }

  try {
    return JSON.parse(text);
  } catch (e) {
    return { error: 'Anthropic cost_report parse error', detail: String(e), raw: safeTrunc_(text, 1200) };
  }
}

function stitchUsageAndCost_(usageReport, costReport) {
  var out = {
    usage: usageReport,
    cost: costReport,
    totalsByModel: {},
    dailyByModel: []
  };

  if (usageReport && usageReport.error) return out;
  if (costReport && costReport.error) return out;

  var usageMap = {}; // key = date|model

  if (usageReport && usageReport.data && usageReport.data.length) {
    for (var i = 0; i < usageReport.data.length; i++) {
      var bucket = usageReport.data[i];
      var date = isoToDate_(bucket.starting_at);
      var results = bucket.results || [];
      for (var r = 0; r < results.length; r++) {
        var item = results[r];
        var model = item.model || 'unknown';
        var key = date + '|' + model;
        var cacheCreation = 0;
        if (item.cache_creation) {
          cacheCreation += toNumber_(item.cache_creation.ephemeral_1h_input_tokens);
          cacheCreation += toNumber_(item.cache_creation.ephemeral_5m_input_tokens);
        }
        var row = {
          date: date,
          model: model,
          uncachedInputTokens: toNumber_(item.uncached_input_tokens),
          cacheReadInputTokens: toNumber_(item.cache_read_input_tokens),
          cacheCreationInputTokens: cacheCreation,
          outputTokens: toNumber_(item.output_tokens),
          totalTokens: 0,
          costUsd: 0
        };
        row.totalTokens = row.uncachedInputTokens + row.cacheReadInputTokens + row.cacheCreationInputTokens + row.outputTokens;
        usageMap[key] = row;
      }
    }
  }

  // Cost: sum token costs per day + model.
  if (costReport && costReport.data && costReport.data.length) {
    for (var c = 0; c < costReport.data.length; c++) {
      var cb = costReport.data[c];
      var cdate = isoToDate_(cb.starting_at);
      var cres = cb.results || [];
      for (var cr = 0; cr < cres.length; cr++) {
        var ci = cres[cr];
        if ((ci.cost_type || '') !== 'tokens') continue;
        var cmodel = ci.model || 'unknown';
        // Anthropic cost_report.amount is reported in lowest currency units (e.g., cents). Convert to USD.
        var amount = toNumber_(ci.amount);
        var currency = (ci.currency || 'USD');
        if (currency === 'USD') amount = amount / 100;
        var k = cdate + '|' + cmodel;
        if (!usageMap[k]) {
          usageMap[k] = {
            date: cdate,
            model: cmodel,
            uncachedInputTokens: 0,
            cacheReadInputTokens: 0,
            cacheCreationInputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            costUsd: 0
          };
        }
        usageMap[k].costUsd += amount;
      }
    }
  }

  // Flatten + totals
  var keys = Object.keys(usageMap);
  keys.sort();

  for (var k2 = 0; k2 < keys.length; k2++) {
    var row2 = usageMap[keys[k2]];
    out.dailyByModel.push({
      date: row2.date,
      model: row2.model,
      totalTokens: row2.totalTokens,
      inputTokens: row2.uncachedInputTokens,
      cacheReadTokens: row2.cacheReadInputTokens,
      cacheCreateTokens: row2.cacheCreationInputTokens,
      outputTokens: row2.outputTokens,
      costUsd: Math.round(row2.costUsd * 100) / 100
    });

    if (!out.totalsByModel[row2.model]) {
      out.totalsByModel[row2.model] = { tokens: 0, costUsd: 0 };
    }
    out.totalsByModel[row2.model].tokens += row2.totalTokens;
    out.totalsByModel[row2.model].costUsd += row2.costUsd;
  }

  // Round totals
  Object.keys(out.totalsByModel).forEach(function(m) {
    out.totalsByModel[m].costUsd = Math.round(out.totalsByModel[m].costUsd * 100) / 100;
  });

  return out;
}

function isoToDate_(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function getProp_(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function getCommandCenterSheetId_() {
  var overrideId = (getProp_(PROP_COMMAND_CENTER_SHEET_ID) || '').trim();
  return overrideId || SHEET_ID;
}

function openCommandCenterSpreadsheet_() {
  // Always open the canonical Laura Dashboard spreadsheet by explicit ID.
  // This avoids accidentally reading from whatever spreadsheet the script is
  // bound to, which can make the dashboard appear static or pointed at the
  // wrong workbook.
  return SpreadsheetApp.openById(getCommandCenterSheetId_());
}

function csvProp_(key) {
  var v = (getProp_(key) || '').trim();
  if (!v) return [];
  return v.split(',').map(function(s) { return s.trim(); }).filter(function(s) { return !!s; });
}

function getAnthropicScopeConfig_() {
  var apiKeyIds = csvProp_(PROP_ANTHROPIC_USAGE_FILTER_API_KEY_IDS);
  var workspaceIds = csvProp_(PROP_ANTHROPIC_USAGE_FILTER_WORKSPACE_IDS);

  if (workspaceIds.length) {
    return {
      label: DEFAULT_BRIO_SCOPE_LABEL,
      mode: 'workspace',
      workspaceIds: workspaceIds,
      apiKeyIds: apiKeyIds,
      source: 'script_properties'
    };
  }

  if (apiKeyIds.length) {
    return {
      label: DEFAULT_BRIO_SCOPE_LABEL,
      mode: 'api_key',
      workspaceIds: [],
      apiKeyIds: apiKeyIds,
      source: 'script_properties'
    };
  }

  return {
    label: DEFAULT_BRIO_SCOPE_LABEL,
    mode: 'api_key',
    workspaceIds: [],
    apiKeyIds: DEFAULT_BRIO_API_KEY_IDS.slice(),
    source: 'code_default'
  };
}

function safeTrunc_(s, n) {
  var t = String(s || '');
  return t.length > (n || 1000) ? t.slice(0, n || 1000) + '…' : t;
}

function toNumber_(v) {
  if (v === null || v === undefined || v === '') return 0;
  var num = Number(v);
  if (isNaN(num)) return 0;
  return num;
}

function ensureMasterTimeSavedColumn_(ss) {
  var sheet = ss.getSheetByName('Master');
  if (!sheet) return;

  // Ensure at least 10 columns so J exists.
  var maxCols = sheet.getMaxColumns();
  if (maxCols < 10) sheet.insertColumnsAfter(maxCols, 10 - maxCols);

  var header = sheet.getRange(1, 10).getValue();
  var target = 'Est. Time Saved (min)';
  if (String(header || '').trim() !== target) {
    sheet.getRange(1, 10).setValue(target);
    sheet.getRange(1, 10).setFontWeight('bold');
  }
}

function ensureRoiSheetExists_(ss) {
  var sheet = ss.getSheetByName(ROI_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(ROI_SHEET_NAME);
  }
  // Basic header scaffold (so the sheet exists even if we render ROI live from API)
  var headers = [[
    'Date', 'Model', 'Total Tokens', 'Input Tokens', 'Cache Read Tokens', 'Cache Create Tokens', 'Output Tokens', 'Cost (USD)', 'Notes'
  ]];
  sheet.getRange(1, 1, 1, headers[0].length).setValues(headers).setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers[0].length);
}

// ── WRITE-BACK FUNCTIONS ────────────────────────────────────────────────────────

/**
 * Update a task's status in the Master sheet.
 * Finds the row by Task ID (column A) and writes newStatus to column E.
 */
function updateTaskStatus(taskId, newStatus) {
  var ss = openCommandCenterSpreadsheet_();
  var sheet = ss.getSheetByName('Master');
  if (!sheet) throw new Error('Master sheet not found');

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(taskId).trim()) {
      sheet.getRange(i + 1, 5).setValue(newStatus); // Column E = Status
      SpreadsheetApp.flush();
      return { success: true, taskId: taskId, newStatus: newStatus };
    }
  }
  throw new Error('Task ID not found: ' + taskId);
}

/**
 * Append a note to a task in the Master sheet.
 * Finds the row by Task ID (column A) and appends to column H (Notes).
 */
function addTaskNote(taskId, note) {
  var ss = openCommandCenterSpreadsheet_();
  var sheet = ss.getSheetByName('Master');
  if (!sheet) throw new Error('Master sheet not found');

  var data = sheet.getDataRange().getValues();
  var now = new Date();
  var timestamp = (now.getMonth() + 1) + '/' + now.getDate() + ' ' +
    (now.getHours() < 10 ? '0' : '') + now.getHours() + ':' +
    (now.getMinutes() < 10 ? '0' : '') + now.getMinutes();
  var stampedNote = '[' + timestamp + '] ' + note;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(taskId).trim()) {
      var existing = String(data[i][7] || '').trim();
      var updated = existing ? existing + '\n' + stampedNote : stampedNote;
      sheet.getRange(i + 1, 8).setValue(updated); // Column H = Notes
      SpreadsheetApp.flush();
      return { success: true, taskId: taskId, note: stampedNote };
    }
  }
  throw new Error('Task ID not found: ' + taskId);
}

// ── SHEET READER ────────────────────────────────────────────────────────────────

function getSheetData_(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  var range = sheet.getDataRange();
  if (range.getNumRows() === 0) return [];
  return range.getValues();
}

// ── PARSERS ─────────────────────────────────────────────────────────────────────

function parseMasterTasks_(rows) {
  if (rows.length < 2) return [];
  var tasks = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var taskId = String(r[0] || '').trim();
    if (!taskId) continue;
    tasks.push({
      id: taskId,
      priority: cleanEmoji_(String(r[1] || '')),
      priorityRaw: String(r[1] || ''),
      name: String(r[2] || ''),
      owner: String(r[3] || ''),
      status: cleanEmoji_(String(r[4] || '')),
      statusRaw: String(r[4] || ''),
      dueDate: fmtDate_(r[5]),
      domain: String(r[6] || ''),
      notes: String(r[7] || ''),
      dateCompleted: fmtDate_(r[8]),
      timeSavedMin: toNumber_(r[9]), // Master!J
      hasDetails: false
    });
  }
  return tasks;
}

function parseTaskAcceptance_(rows) {
  if (rows.length < 3) return [];
  var items = [];
  var headerIdx = 0;
  for (var h = 0; h < Math.min(rows.length, 5); h++) {
    if (String(rows[h][0]).toLowerCase().indexOf('date') >= 0) { headerIdx = h; break; }
  }
  for (var i = headerIdx + 1; i < rows.length; i++) {
    var r = rows[i];
    var date = String(r[0] || '').trim();
    if (!date) continue;
    items.push({
      date: date,
      source: String(r[1] || ''),
      task: String(r[2] || ''),
      domain: String(r[3] || ''),
      priority: cleanEmoji_(String(r[4] || '')),
      priorityRaw: String(r[4] || ''),
      lauraStep: String(r[5] || ''),
      lauraAssignee: String(r[6] || ''),
      proposedDue: String(r[7] || ''),
      edDecision: String(r[9] || ''),
      edNextStep: String(r[10] || ''),
      edAssignTo: String(r[11] || ''),
      edDueDate: String(r[12] || ''),
      edNotes: String(r[13] || '')
    });
  }
  return items;
}

function parseDecisions_(rows) {
  if (rows.length < 2) return [];
  var items = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var taskId = String(r[0] || '').trim();
    if (!taskId) continue;
    items.push({
      id: taskId,
      decision: String(r[1] || ''),
      context: String(r[2] || ''),
      recommendation: String(r[3] || ''),
      dueDate: fmtDate_(r[4]),
      priority: cleanEmoji_(String(r[5] || '')),
      priorityRaw: String(r[5] || ''),
      edStatus: String(r[7] || ''),
      edDecision: String(r[8] || ''),
      edNextStep: String(r[9] || ''),
      edNotes: String(r[10] || '')
    });
  }
  return items;
}

function parseArchive_(rows) {
  if (rows.length < 2) return [];
  var items = [];
  var startIdx = 1;
  for (var h = 0; h < Math.min(rows.length, 3); h++) {
    if (String(rows[h][0]).toUpperCase().indexOf('ARCHIVE') >= 0) { startIdx = h + 1; }
    if (String(rows[h][0]).toLowerCase().indexOf('task id') >= 0) { startIdx = h + 1; break; }
  }
  for (var i = startIdx; i < rows.length; i++) {
    var r = rows[i];
    var taskId = String(r[0] || '').trim();
    if (!taskId) continue;
    items.push({
      id: taskId,
      priority: cleanEmoji_(String(r[1] || '')),
      priorityRaw: String(r[1] || ''),
      name: String(r[2] || ''),
      owner: String(r[3] || ''),
      status: cleanEmoji_(String(r[4] || '')),
      completedDate: fmtDate_(r[5]),
      domain: String(r[6] || ''),
      notes: String(r[7] || '')
    });
  }
  return items;
}

function parseRelationships_(rows) {
  if (!rows || rows.length < 2) return [];
  var contacts = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var name = String(r[0] || '').trim();
    if (!name) continue;
    contacts.push({
      name: name,
      preferredName: String(r[1] || ''),
      domain: String(r[2] || ''),
      circle: String(r[3] || ''),
      role: String(r[4] || ''),
      health: String(r[5] || ''),
      birthday: String(r[6] || ''),
      location: String(r[7] || ''),
      keyDetails: String(r[8] || ''),
      lastTouchpoint: String(r[9] || ''),
      nurtureStatus: String(r[10] || ''),
      pillarTags: String(r[11] || ''),
      openCommitments: String(r[12] || ''),
      notes: String(r[13] || '')
    });
  }
  return contacts;
}

function parseSyncLog_(rows) {
  if (rows.length < 2) return [];
  var entries = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var date = String(r[0] || '').trim();
    if (!date) continue;

    var time = String(r[1] || '');
    var highlights = String(r[2] || '');
    var metrics = String(r[3] || '');
    var nextActions = String(r[4] || '');

    // Skip rows that are purely numeric stats (e.g. "141 | 32 | 31 | 52")
    // — these are KPI summary rows, not readable sync entries.
    var allNumeric = [time, highlights, metrics, nextActions].every(function(v) {
      return !v || v === 'undefined' || /^\d+(\.\d+)?$/.test(v.trim());
    });
    if (allNumeric) continue;

    entries.push({
      date: date,
      time: time,
      highlights: highlights,
      metrics: metrics,
      nextActions: nextActions
    });
  }
  return entries;
}

function parseWeeklyReview_(rows) {
  if (rows.length < 2) return [];
  var items = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var section = String(r[0] || '').trim();
    if (!section) continue;
    items.push({
      section: section,
      item: String(r[1] || ''),
      statusOwner: String(r[2] || ''),
      notes: String(r[3] || '')
    });
  }
  return items;
}

function parseMaybeSomeday_(rows) {
  if (rows.length < 2) return [];
  var items = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var item = String(r[0] || '').trim();
    if (!item) continue;
    items.push({
      item: item,
      reason: String(r[1] || ''),
      reviewDate: String(r[2] || ''),
      moveWhen: String(r[3] || ''),
      notes: String(r[4] || '')
    });
  }
  return items;
}

function parseDomainSheet_(rows) {
  if (rows.length < 2) return [];
  var items = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var first = String(r[0] || '').trim();
    if (!first) continue;
    items.push({
      col0: first,
      col1: String(r[1] || ''),
      col2: String(r[2] || ''),
      col3: String(r[3] || ''),
      col4: String(r[4] || ''),
      col5: String(r[5] || ''),
      col6: String(r[6] || ''),
      col7: String(r[7] || '')
    });
  }
  return items;
}

function parseGoalDashboard_(rows) {
  if (rows.length < 1) return [];
  var items = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var vals = [];
    for (var j = 0; j < r.length; j++) {
      var v = String(r[j] || '').trim();
      if (v) vals.push(v);
    }
    if (vals.length > 0) items.push(vals);
  }
  return items;
}

function parseBoard_(rows, name) {
  if (rows.length < 1) return { name: name, tasks: [], raw: [] };
  var tasks = [];
  var raw = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var vals = [];
    for (var j = 0; j < r.length; j++) {
      var v = String(r[j] || '').trim();
      if (v) vals.push(v);
    }
    if (vals.length > 0) raw.push(vals.join(' | '));
  }
  return { name: name, tasks: tasks, raw: raw };
}

function parseRawSheet_(rows) {
  if (rows.length < 1) return [];
  var items = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var vals = [];
    for (var j = 0; j < r.length; j++) {
      var v = String(r[j] || '').trim();
      if (v) vals.push(v);
    }
    if (vals.length > 0) items.push(vals);
  }
  return items;
}

function parseLauraActivityLog_(rows) {
  if (!rows || !rows.length) return { items: [], counts: { hour: 0, day: 0, week: 0, month: 0 }, costs: { hour: 0, day: 0, week: 0, month: 0 } };

  var headerIdx = -1;
  for (var i = 0; i < rows.length; i++) {
    var cell0 = String((rows[i] && rows[i][0]) || '').trim();
    // Accept either "Timestamp UTC" header OR the section label (data starts on next non-empty row)
    if (cell0 === 'Timestamp UTC') {
      headerIdx = i;
      break;
    }
    if (cell0.toUpperCase().indexOf('BRIO ACTIVITY LOG') >= 0) {
      // Check if next row is the actual "Timestamp UTC" header
      if (i + 1 < rows.length) {
        var nextCell = String((rows[i + 1] && rows[i + 1][0]) || '').trim();
        if (nextCell === 'Timestamp UTC') {
          headerIdx = i + 1;
        } else if (nextCell && nextCell !== '') {
          // Next row is data directly (no header row)
          headerIdx = i; // treat the label row as pseudo-header
        }
      }
      break;
    }
  }
  if (headerIdx < 0) return { items: [], counts: { hour: 0, day: 0, week: 0, month: 0 }, costs: { hour: 0, day: 0, week: 0, month: 0 } };

  var items = [];
  for (var r = headerIdx + 1; r < rows.length; r++) {
    var row = rows[r] || [];
    var ts = String(row[0] || '').trim();
    if (!ts) continue;
    items.push({
      timestamp: ts,
      activityType: String(row[1] || ''),
      summary: String(row[2] || ''),
      domain: String(row[3] || ''),
      source: String(row[4] || ''),
      sourceRef: String(row[5] || ''),
      agent: String(row[6] || ''),
      status: String(row[7] || ''),
      estTimeSavedMin: toNumber_(row[8]),
      notes: String(row[9] || ''),
      costUsd: toNumber_(row[10]),
      totalTokens: toNumber_(row[11])
    });
  }

  items.sort(function(a, b) { return String(b.timestamp).localeCompare(String(a.timestamp)); });

  var nowMs = new Date().getTime();
  var counts = { hour: 0, day: 0, week: 0, month: 0 };
  var costs = { hour: 0, day: 0, week: 0, month: 0 };
  for (var k = 0; k < items.length; k++) {
    var d = new Date(items[k].timestamp);
    if (isNaN(d.getTime())) continue;
    var diff = nowMs - d.getTime();
    if (diff <= 3600000) { counts.hour++; costs.hour += items[k].costUsd || 0; }
    if (diff <= 86400000) { counts.day++; costs.day += items[k].costUsd || 0; }
    if (diff <= 7 * 86400000) { counts.week++; costs.week += items[k].costUsd || 0; }
    if (diff <= 30 * 86400000) { counts.month++; costs.month += items[k].costUsd || 0; }
  }

  return { items: items, counts: counts, costs: costs };
}

// ── KPI COMPUTATION (Enhanced with time-based metrics) ──────────────────────────

function computeKPIs_(tasks, archive) {
  var total = tasks.length;
  var done = 0, inProgress = 0, pending = 0, blocked = 0, overdue = 0;
  var critical = 0, high = 0, medium = 0, low = 0;
  var now = getTodayEdTz_();

  // Track done tasks from Master for time-based metrics
  var doneTasksFromMaster = [];

  for (var i = 0; i < tasks.length; i++) {
    var t = tasks[i];
    var s = t.status.toUpperCase();
    if (s.indexOf('DONE') >= 0 || s.indexOf('REJECTED') >= 0 || s.indexOf('ROUTED') >= 0) {
      done++;
      doneTasksFromMaster.push(t);
    }
    else if (s.indexOf('IN PROGRESS') >= 0) inProgress++;
    else if (s.indexOf('BLOCKED') >= 0 || s.indexOf('HOLD') >= 0) blocked++;
    else pending++;

    if (s.indexOf('DONE') < 0 && s.indexOf('REJECTED') < 0 && s.indexOf('ROUTED') < 0) {
      if (t.dueDate && t.dueDate !== 'TBD' && t.dueDate !== '') {
        var due = parseLocalDate_(t.dueDate);
        if (due && due < now) overdue++;
      }
    }
    var p = t.priority.toUpperCase();
    if (p.indexOf('CRITICAL') >= 0) critical++;
    else if (p.indexOf('HIGH') >= 0) high++;
    else if (p.indexOf('MEDIUM') >= 0) medium++;
    else if (p.indexOf('LOW') >= 0) low++;
  }

  // Time-based completion metrics from Archive
  var completedToday = 0, completedThisWeek = 0;
  var weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday start

  // Count from archive
  var archiveDates = [];
  if (archive && archive.length > 0) {
    for (var a = 0; a < archive.length; a++) {
      var cd = archive[a].completedDate;
      if (cd && cd !== '' && cd !== 'TBD') {
        var d = parseLocalDate_(cd);
        if (d) {
          archiveDates.push(d);
          if (d.getTime() === now.getTime()) completedToday++;
          if (d >= weekStart) completedThisWeek++;
        }
      }
    }
  }

  // Count done tasks in Master using the Date Completed column (col I)
  // NOTE: In V8, new Date('YYYY-MM-DD') parses as UTC, which can shift the day in local time.
  // We must parse YYYY-MM-DD as a *local* date to avoid "Completed Today = 0" bugs.
  for (var m = 0; m < doneTasksFromMaster.length; m++) {
    var dc = doneTasksFromMaster[m].dateCompleted;
    if (!dc || dc === '' || dc === 'TBD') {
      // Fallback to dueDate if no dateCompleted
      dc = doneTasksFromMaster[m].dueDate;
    }
    var dd = parseLocalDate_(dc);
    if (dd) {
      if (dd.getTime() === now.getTime()) completedToday++;
      if (dd >= weekStart) completedThisWeek++;
    }
  }

  // Compute averages (from archive dates over last 30 days)
  var thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  var recentCompletions = 0;
  for (var r = 0; r < archiveDates.length; r++) {
    if (archiveDates[r] && archiveDates[r] >= thirtyDaysAgo) recentCompletions++;
  }
  var avgPerDay = recentCompletions > 0 ? Math.round((recentCompletions / 30) * 10) / 10 : 0;
  var avgPerWeek = recentCompletions > 0 ? Math.round((recentCompletions / 4.3) * 10) / 10 : 0;

  // Laura task count
  var lauraActive = 0, lauraDone = 0;
  for (var b = 0; b < tasks.length; b++) {
    var own = (tasks[b].owner || '').toLowerCase();
    if (own.indexOf('laura') >= 0) {
      var bs = tasks[b].status.toUpperCase();
      if (bs.indexOf('DONE') >= 0) lauraDone++;
      else lauraActive++;
    }
  }

  return {
    total: total, done: done, inProgress: inProgress, pending: pending, blocked: blocked,
    overdue: overdue, critical: critical, high: high, medium: medium, low: low,
    completionRate: total > 0 ? Math.round((done / total) * 100) : 0,
    completedToday: completedToday,
    completedThisWeek: completedThisWeek,
    avgPerDay: avgPerDay,
    avgPerWeek: avgPerWeek,
    lauraActive: lauraActive,
    lauraDone: lauraDone,
    archiveCount: archive ? archive.length : 0
  };
}

// ── GROUPERS ────────────────────────────────────────────────────────────────────

function groupByOwner_(tasks) {
  var groups = {};
  for (var i = 0; i < tasks.length; i++) {
    var owner = normOwner_(tasks[i].owner);
    if (!groups[owner]) groups[owner] = [];
    groups[owner].push(tasks[i]);
  }
  return groups;
}

function normOwner_(raw) {
  var s = raw.toLowerCase();
  if (s.indexOf('dustin') >= 0) return 'Dustin';
  if (s.indexOf('mel') >= 0 && s.indexOf('melissa') < 0) return 'Mel';
  if (s.indexOf('amanda') >= 0) return 'Amanda';
  if (s.indexOf('lenore') >= 0) return 'Lenore';
  if (s.indexOf('laura') >= 0) return 'Laura';
  if (s.indexOf('ed') >= 0) return 'Ed';
  if (s.indexOf('ron') >= 0) return 'Ron';
  if (s.indexOf('muhammad') >= 0 || s.indexOf('jewel') >= 0 || s.indexOf('jp') >= 0) return 'BAIIT';
  if (s.indexOf('accounting') >= 0 || s.indexOf('louise') >= 0) return 'Accounting';
  if (s.indexOf('george') >= 0 || s.indexOf('bob') >= 0) return 'Leadership';
  if (s === '' || s === 'team') return 'Unassigned';
  return raw;
}

function groupByDomain_(tasks) {
  var groups = {};
  for (var i = 0; i < tasks.length; i++) {
    var d = tasks[i].domain || 'Unknown';
    if (!groups[d]) groups[d] = [];
    groups[d].push(tasks[i]);
  }
  return groups;
}

// ── UTILITIES ───────────────────────────────────────────────────────────────────

function cleanEmoji_(str) {
  return str.replace(/^[\u{1F534}\u{1F535}\u{1F7E1}\u{1F7E2}\u{1F504}\u{231B}\u{2705}\u{274C}\u{23F8}\u{FE0F}\u{1F4CB}\u{1F4C5}\u{1F4C4}]\s*/gu, '').trim();
}

function fmtDate_(val) {
  if (!val) return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    var m = val.getMonth() + 1, d = val.getDate(), y = val.getFullYear();
    return y + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d;
  }
  return String(val).trim();
}

/**
 * Return today's date string (YYYY-MM-DD) in Ed's timezone.
 * This ensures "Completed Today" and overdue counts match Ed's wall clock,
 * not the Apps Script server timezone.
 */
function getTodayEdTz_() {
  var formatted = Utilities.formatDate(new Date(), ED_TIMEZONE, 'yyyy-MM-dd');
  var parts = formatted.split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

// Parse a YYYY-MM-DD (or Date) into a LOCAL midnight Date object.
// Avoids the JS quirk where new Date('YYYY-MM-DD') is treated as UTC.
function parseLocalDate_(val) {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return new Date(val.getFullYear(), val.getMonth(), val.getDate());
  }
  var s = String(val).trim();
  if (!s || s === 'TBD') return null;
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  // Fallback: let Date parse it, then normalize to local date
  var d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
