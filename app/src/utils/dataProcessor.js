import { authHeaders } from '../components/LoginGate';

const API_BASE = '/api/sheets/';

// ── Tab names must match the actual Google Sheet tab titles exactly ──────────
const SHEET_NAMES = [
  'CET Designers',
  'Estimators',
  'BIM Modelers',
  'Sales Coordinators / PMs',   // was wrongly 'Sales Coordinators - PMs'
  'Sequence Content',
  // NOTE: 'Dashboard' tab removed — it does not exist in Laura's sheet
];

// ── Per-tab column maps (0-indexed, matching the actual sheet headers) ────────

// CET Designers: Company | Role | Location | Name | Title | Email | LinkedIn |
//                Touch1 | Touch2 | Touch3 | Touch4 | ResponseStatus | ResponseDate
const CET_COLS = {
  COMPANY: 0, ROLE: 1, LOCATION: 2, CONTACT_NAME: 3, CONTACT_TITLE: 4,
  EMAIL: 5, LINKEDIN: 6,
  T1: 7, T2: 8, T3: 9, T4: 10,
  RESPONSE_STATUS: 11, RESPONSE_DATE: 12,
};

// Estimators: Company | Role | Location | Name | Title | Email | LinkedIn | JobLink |
//             Touch1 | Touch2 | Touch3 | ResponseStatus | ResponseDate
const EST_COLS = {
  COMPANY: 0, ROLE: 1, LOCATION: 2, CONTACT_NAME: 3, CONTACT_TITLE: 4,
  EMAIL: 5, LINKEDIN: 6, JOB_LINK: 7,
  T1: 8, T2: 9, T3: 10,
  RESPONSE_STATUS: 11, RESPONSE_DATE: 12,
};

// BIM Modelers: Company | Location | Role | Name | Title | JobLink | Email | LinkedIn |
//               DateSent | Status | NextStep | ResponseDate | ResponseSummary | CallBooked
const BIM_COLS = {
  COMPANY: 0, LOCATION: 1, ROLE: 2, CONTACT_NAME: 3, CONTACT_TITLE: 4,
  JOB_LINK: 5, EMAIL: 6, LINKEDIN: 7,
  ADDED_DATE: 8, T1: 9, NEXT_STEP: 10,
  RESPONSE_DATE: 11, NOTES: 12, CALL_BOOKED: 13,
};

// Sales Coordinators / PMs: Company | Role | Location | Name | Title | Email | LinkedIn |
//                            SMTP | Touch1 | Touch2
const SCPM_COLS = {
  COMPANY: 0, ROLE: 1, LOCATION: 2, CONTACT_NAME: 3, CONTACT_TITLE: 4,
  EMAIL: 5, LINKEDIN: 6, SMTP_STATUS: 7,
  T1: 8, T2: 9,
};

// ── Per-tab row parsers ───────────────────────────────────────────────────────

function parseCET(row) {
  if (!row || !row[CET_COLS.COMPANY]) return null;
  return {
    company:        row[CET_COLS.COMPANY]        || '',
    role:           row[CET_COLS.ROLE]           || '',
    location:       row[CET_COLS.LOCATION]       || '',
    contactName:    row[CET_COLS.CONTACT_NAME]   || '',
    contactTitle:   row[CET_COLS.CONTACT_TITLE]  || '',
    email:          row[CET_COLS.EMAIL]          || '',
    linkedin:       row[CET_COLS.LINKEDIN]       || '',
    t1Status:       row[CET_COLS.T1]             || '',
    t2Status:       row[CET_COLS.T2]             || '',
    t3Status:       row[CET_COLS.T3]             || '',
    t4Status:       row[CET_COLS.T4]             || '',
    responseStatus: row[CET_COLS.RESPONSE_STATUS] || '',
    responseDate:   row[CET_COLS.RESPONSE_DATE]  || '',
    callScheduled:  false,
    campaign:       'CET Designers',
  };
}

function parseEstimator(row) {
  if (!row || !row[EST_COLS.COMPANY]) return null;
  return {
    company:        row[EST_COLS.COMPANY]        || '',
    role:           row[EST_COLS.ROLE]           || '',
    location:       row[EST_COLS.LOCATION]       || '',
    contactName:    row[EST_COLS.CONTACT_NAME]   || '',
    contactTitle:   row[EST_COLS.CONTACT_TITLE]  || '',
    email:          row[EST_COLS.EMAIL]          || '',
    linkedin:       row[EST_COLS.LINKEDIN]       || '',
    jobLink:        row[EST_COLS.JOB_LINK]       || '',
    t1Status:       row[EST_COLS.T1]             || '',
    t2Status:       row[EST_COLS.T2]             || '',
    t3Status:       row[EST_COLS.T3]             || '',
    t4Status:       '',
    responseStatus: row[EST_COLS.RESPONSE_STATUS] || '',
    responseDate:   row[EST_COLS.RESPONSE_DATE]  || '',
    callScheduled:  false,
    campaign:       'Estimators',
  };
}

function parseBIM(row) {
  if (!row || !row[BIM_COLS.COMPANY]) return null;
  const callRaw = (row[BIM_COLS.CALL_BOOKED] || '').toLowerCase();
  return {
    company:        row[BIM_COLS.COMPANY]       || '',
    role:           row[BIM_COLS.ROLE]          || '',
    location:       row[BIM_COLS.LOCATION]      || '',
    contactName:    row[BIM_COLS.CONTACT_NAME]  || '',
    contactTitle:   row[BIM_COLS.CONTACT_TITLE] || '',
    email:          row[BIM_COLS.EMAIL]         || '',
    linkedin:       row[BIM_COLS.LINKEDIN]      || '',
    jobLink:        row[BIM_COLS.JOB_LINK]      || '',
    addedDate:      row[BIM_COLS.ADDED_DATE]    || '',
    t1Status:       row[BIM_COLS.T1]            || '',
    t2Status:       '',
    t3Status:       '',
    t4Status:       '',
    responseDate:   row[BIM_COLS.RESPONSE_DATE] || '',
    responseStatus: row[BIM_COLS.RESPONSE_DATE] ? 'replied' : '',
    notes:          row[BIM_COLS.NOTES]         || '',
    callScheduled:  callRaw === 'y' || callRaw === 'yes' || callRaw.includes('✓'),
    campaign:       'BIM Modelers',
  };
}

function parseSCPM(row) {
  if (!row || !row[SCPM_COLS.COMPANY]) return null;
  return {
    company:        row[SCPM_COLS.COMPANY]       || '',
    role:           row[SCPM_COLS.ROLE]          || '',
    location:       row[SCPM_COLS.LOCATION]      || '',
    contactName:    row[SCPM_COLS.CONTACT_NAME]  || '',
    contactTitle:   row[SCPM_COLS.CONTACT_TITLE] || '',
    email:          row[SCPM_COLS.EMAIL]         || '',
    linkedin:       row[SCPM_COLS.LINKEDIN]      || '',
    smtpStatus:     row[SCPM_COLS.SMTP_STATUS]   || '',
    t1Status:       row[SCPM_COLS.T1]            || '',
    t2Status:       row[SCPM_COLS.T2]            || '',
    t3Status:       '',
    t4Status:       '',
    responseStatus: '',
    responseDate:   '',
    callScheduled:  false,
    campaign:       'Sales Coordinators / PMs',
  };
}

// ── Fetch one sheet tab from server proxy ────────────────────────────────────
async function fetchSheet(sheetName) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${API_BASE}${encodeURIComponent(sheetName)}`, {
      headers: authHeaders(),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.values || [];
  } catch (e) {
    clearTimeout(timer);
    console.warn(`Failed to fetch sheet [${sheetName}]:`, e.message);
    return [];
  }
}

// ── Main data fetch + process ─────────────────────────────────────────────────
export async function fetchAndProcessData() {
  // Fetch all sheets + scoreboard in parallel
  const [scoreboard, cetRaw, estRaw, bimRaw, scpmRaw, seqRaw] = await Promise.all([
    // Monthly scoreboard from Task List
    (async () => {
      try {
        const res = await fetch('/api/scoreboard', { headers: authHeaders() });
        if (res.ok) return await res.json();
      } catch (e) {
        console.warn('Failed to fetch scoreboard:', e.message);
      }
      return null;
    })(),
    fetchSheet('CET Designers'),
    fetchSheet('Estimators'),
    fetchSheet('BIM Modelers'),
    fetchSheet('Sales Coordinators / PMs'),
    fetchSheet('Sequence Content'),
  ]);

  // Parse each tab with its correct column map (skip header row 0)
  const cetDesigners = cetRaw.slice(1).map(parseCET).filter(Boolean);
  const estimators   = estRaw.slice(1).map(parseEstimator).filter(Boolean);
  const bimModelers  = bimRaw.slice(1).map(parseBIM).filter(Boolean);
  const salesCoords  = scpmRaw.slice(1).map(parseSCPM).filter(Boolean);
  const sequenceContent = seqRaw;

  // Compute KPIs
  const allLeads = [...cetDesigners, ...estimators, ...bimModelers, ...salesCoords];
  const kpis = computeKPIs(allLeads, cetDesigners, estimators, bimModelers, salesCoords);

  // Override with authoritative scoreboard values if available
  if (scoreboard?.ok) {
    kpis.callsScheduled = scoreboard.callsScheduled;
    kpis.callsTarget    = scoreboard.callsTarget;
    kpis.replies        = scoreboard.repliesReceived;
    kpis.totalTouches   = scoreboard.totalTouches;
  }

  return {
    timestamp: new Date().toISOString(),
    sourceInfo: {
      spreadsheetId: '1WEIHITpnk_Ymrk6RTaKYzMK55vLnSViU4RKg5Py34WU',
      spreadsheetName: "Laura's Lead Generation",
      mode: 'api_proxy'
    },
    kpis,
    cetDesigners,
    estimators,
    bimModelers,
    salesCoords,
    allLeads,
    sequenceContent,
    dashboardRows: [], // 'Dashboard' tab removed — does not exist in the sheet
  };
}

function computeKPIs(allLeads, cet, est, bim, sc) {
  const totalLeads = allLeads.length;

  let totalTouches = 0;
  for (const lead of allLeads) {
    if (lead.t1Status) totalTouches++;
    if (lead.t2Status) totalTouches++;
    if (lead.t3Status) totalTouches++;
    if (lead.t4Status) totalTouches++;
  }

  const replies        = allLeads.filter(l => l.responseStatus).length;
  const replyRate      = totalLeads > 0 ? Math.round((replies / totalLeads) * 100) : 0;
  const callsScheduled = allLeads.filter(l => l.callScheduled).length;
  const callsTarget    = 8;

  return {
    callsScheduled,
    callsTarget,
    totalLeads,
    totalTouches,
    replies,
    replyRate,
    cetRows:       cet.length,
    estimatorRows: est.length,
    bimRows:       bim.length,
    scpmRows:      sc.length,
  };
}
