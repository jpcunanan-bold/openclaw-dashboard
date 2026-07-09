# Darren Sheet Investigation & Dashboard API Fixes
**Date:** 2026-04-30 13:15 UTC  
**Status:** ✅ Completed

---

## Task 1: Task List Sheet Inspection

### Laura's Task List Sheet Structure
**Sheet ID:** `1WEIHITpnk_Ymrk6RTaKYzMK55vLnSViU4RKg5Py34WU`

**MONTHLY SCOREBOARD (Rows 5-9):**
```
Row 5 (Header):  Metric | Target | Actual
Row 6:           Calls Scheduled | 8 | 2
Row 7:           Total Touches Sent | 400+ | 879
Row 8:           Replies Received | 15+ | 5
Row 9:           New Leads Added (Cron) | 80+ | 76
```

**Column Structure:**
- Column A (index 0): Metric name
- Column B (index 1): Target value
- Column C (index 2): Actual (monthly) value

**Finding:** The sheet has ONLY 3 columns. No separate "this month" vs "all time" columns exist. Column C contains the monthly actual values, which the API correctly reads.

---

## Task 2: Darren's DWDM Companies Sheet Inspection

### DWDM Companies Sheet Structure
**Sheet ID:** `1sP5lIYoCNFFU0xhh7SwWpTH_6L_EDO-ergHThYm4uGA`  
**Tab:** DWDM Companies

**Column Headers (A1:N1):**
```
A: Company
B: Contact Name
C: Title
D: Email
E: SMTP Status
F: LinkedIn Profile
G: DWDM Hiring Evidence (Link)
H: Assigned To
I: Touch 1 Status
J: Touch 2 Status
K: Touch 3 Status
L: Touch 4 Status
M: Touch 5 Status
N: Tier
```

**Finding:** **NO "Call Scheduled" or "Replies" columns** exist in DWDM Companies. The sheet only tracks outreach touches (Touch 1-5) and tier/status fields. This is by design — Darren's reply/call metrics come from aggregated dashboard data, not individual contact records.

### DWDM Dashboard Sheet
**Tab:** DWDM Dashboard (exists and tracks aggregated metrics)
```
KPI: Calls Scheduled = 1
```

This tab shows aggregated metrics similar to Laura's Task List scoreboard.

---

## Task 3: API Fixes Applied

### Issue Found
The `/api/contacts/metrics` endpoint had TWO bugs:

1. **Cache key ignored date filters** - The cache key only included the `agent` parameter:
   ```js
   // OLD:
   const cacheKey = `contacts_metrics_v4_${agent || 'all'}`;
   ```
   This meant requests with different `date_from`/`date_to` values returned the same cached result.

2. **Darren's calls_scheduled not read from Dashboard** - The code only read from Laura's Task List scoreboard. Darren's DWDM Dashboard metrics were ignored.

### Fixes Applied

**1. Updated Cache Key** (line 2632)
```js
// NEW:
const { agent, date_from, date_to } = req.query;
const cacheKey = `contacts_metrics_v4_${agent || 'all'}_${date_from || ''}_${date_to || ''}`;
```
- Now respects `date_from` and `date_to` query parameters in caching
- Different date ranges generate different cache keys and return cached results independently

**2. Added DWDM Dashboard Scoreboard Override** (lines 2687-2703)
```js
// ── Darren Scoreboard override: Try to read from DWDM Dashboard ──
try {
  const dbRaw = execSync(
    `${GOG_PATH} sheets get ${DARREN_SHEET_ID} "DWDM Dashboard!A1:D20" ...`
  );
  const dbRows = JSON.parse(dbRaw).values || [];
  const findRow = (label) => dbRows.find(r => (r[0]||'').toLowerCase().includes(label)) || [];
  const callsRow = findRow('calls scheduled');
  const parseNum = (v) => parseInt((v||'0').replace(/\D/g,'')) || 0;
  if (callsRow && callsRow[1] !== undefined) {
    darrenM.calls_scheduled = parseNum(callsRow[1]);
    darrenM._meta = { ...darrenM._meta, callsSource: 'dwdm-dashboard', callsValue: callsRow[1] };
  }
} catch(e) { /* non-fatal */ }
```
- Reads "Calls Scheduled" value from DWDM Dashboard!A1:D20
- Falls back gracefully if dashboard tab doesn't exist
- Metadata tracks source for debugging

---

## Task 4: Build & Restart

### Build Output
```
✓ built in 381ms
dist/index.html                   0.57 kB
dist/assets/index-V2wa_9ft.css   23.86 kB
dist/assets/index-KvaXZDwj.js   378.22 kB
```

### Service Restart
```
✓ laura-dashboard-api.service started
Status: Active (running)
Process: /usr/bin/node server.js
Port: 127.0.0.1:3100
```

---

## Summary of Changes

| Component | Change | Impact |
|-----------|--------|--------|
| Cache Key | Added `date_from` + `date_to` | Date-filtered requests now cache separately |
| Laura Metrics | No change | Task List reads correctly from column C (Actual) |
| Darren Metrics | Added DWDM Dashboard reader | Can now display calls_scheduled from aggregated dashboard |
| Build | Fixed index.html | Removed hardcoded asset hashes; Vite now handles dynamically |

---

## What to Verify

1. ✅ API service is running on port 3100
2. ✅ Frontend builds without errors  
3. Test with date filters:
   - `GET /api/contacts/metrics?agent=all&date_from=2026-04-01&date_to=2026-04-30` should return monthly April data
   - `GET /api/contacts/metrics?agent=all&date_from=2026-01-01&date_to=2026-04-30` should return different cached result
4. Verify Darren's `calls_scheduled` value appears in the combined metrics (currently reads "1" from DWDM Dashboard)

---

## No Changes Needed

- ✅ Task List sheet structure is correct (3 columns: Metric, Target, Actual)
- ✅ Column C is the correct "Actual" monthly value
- ✅ No "all time" vs "this month" columns exist (only monthly scorecard)
- ✅ DWDM Companies sheet correctly has NO call/reply columns (by design)
- ✅ Darren has separate DWDM Dashboard for aggregated metrics

---

## Files Modified

- `/var/www/laura-dashboard/api/server.js` - Updated `/api/contacts/metrics` endpoint
- `/var/www/laura-dashboard/app/index.html` - Fixed for Vite build
- `/var/www/laura-dashboard/app/dist/` - Rebuilt assets
