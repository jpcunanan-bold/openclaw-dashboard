# Data Mapping Document
## Laura + Darren Sales Dashboard

**Dashboard URL:** https://openclaw.boldbusiness.com/app  
**Backend API:** `/var/www/laura-dashboard/api/server.js` (Node.js/Express)  
**Frontend:** `/var/www/laura-dashboard/app/src/` (React + Vite)

---

## Executive Summary

The Laura + Darren Sales Dashboard integrates data from **Google Sheets** (Laura and Darren's prospect lists), **PostgreSQL** (activity tracking, tasks, and cost snapshots), and the **Anthropic Admin API** (cost data) to provide real-time visibility into outreach metrics, pipeline activity, and agent performance. Each dashboard tab maps to a specific data source—either a Google Sheet tab or a backend API endpoint—with KPIs calculated from contact touches, response status, and engagement tracking. This document serves as the single source of truth for where dashboard data comes from and how metrics are computed.

---

## 1. Data Sources

The dashboard draws from four primary data sources:

### Google Sheets — Laura Petersen

**Sheet ID:** `1WEIHITpnk_Ymrk6RTaKYzMK55vLnSViU4RKg5Py34WU`

Contains four prospect tabs (CET Designers, Estimators, BIM Modelers, Sales Coordinators / PMs) plus a Task List tab used for metric overrides.

- **Purpose:** Source of truth for Laura's campaign contacts, outreach touches, and response tracking
- **Update Frequency:** Real-time (manual entry by Laura/team)
- **Key Fields:** Contact name, title, company, email, LinkedIn, touch history (Touch1–Touch4), response status, response date

### Google Sheets — Darren Derosha

**Sheet ID:** `1sP5lIYoCNFFU0xhh7SwWpTH_6L_EDO-ergHThYm4uGA`

Contains eight prospect/project tabs covering DWDM, BEAD, Data Center initiatives, and strategic opportunities.

- **Purpose:** Source of truth for Darren's prospect accounts, hiring signals, and project tracking
- **Update Frequency:** Real-time (manual entry by Darren/team)
- **Key Fields:** Company, contact, title, email, project details, tier, hiring signals, evidence

### PostgreSQL Database (Local)

**Host:** localhost | **Tables:** `contacts`, `agent_activities`, `agent_cost_snapshots`, `abhi_tasks`, `dashboard_chat`

- **contacts:** Master contact records (synced from Google Sheets via API)
- **agent_activities:** Activity logs (calls, meetings, touches) with timestamps
- **agent_cost_snapshots:** Historical Anthropic API cost tracking
- **abhi_tasks:** Abhinanda's task list (separate from Google Sheets)
- **dashboard_chat:** Real-time chat log for dashboard collaboration

### Anthropic Admin API

**Purpose:** Real-time and historical API cost tracking for ROI/cost analysis  
**Data Returned:** Daily cost snapshots, cumulative spend, token usage  
**Frequency:** Updated hourly

---

## 2. Laura's Sheet Tabs → Dashboard Pages Mapping

Laura's Google Sheet contains four campaign tabs plus a Task List override sheet. Each tab maps to a corresponding dashboard page.

| Sheet Tab | Campaign Tag | Key Columns | Dashboard Page | Notes |
|---|---|---|---|---|
| **CET Designers** | CET Designers | Company (A), Role (B), Location (C), Name (D), Title (E), Email (F), LinkedIn (G), Touch1 (H), Touch2 (I), Touch3 (J), Touch4 (K), Response Status (L), Response Date (M) | CET Tab | Design/engineering hiring focus |
| **Estimators** | Estimators | Company (A), Role (B), Location (C), Name (D), Title (E), Email (F), LinkedIn (G), Job Link (H), Touch1 (I), Touch2 (J), Touch3 (K), Response Status (L), Response Date (M) | Estimators Tab | Commercial contractors & estimating roles |
| **BIM Modelers** | BIM Modelers | Company (A), Location (B), Role (C), Name (D), Title (E), Job Link (F), Email (G), LinkedIn (H), Touch1 (I), Response Summary (M), Response Date (L), Call Booked (N) | BIM Tab | Building Information Modeling specialists |
| **Sales Coordinators / PMs** | Sales Coordinators - PMs | Company (A), Role (B), Location (C), Name (D), Title (E), Email (F), LinkedIn (G), SMTP Status (H), Touch1 (I), Touch2 (J) | SCPM Tab | Project management & coordination roles |
| **Task List** | (override only) | Labels (A), (B), Values (C) | N/A - Scoreboard Override | Rows 5-10: "Calls Scheduled" and "Replies Received" override computed metrics |

### Key Field Definitions

- **Touch1:** Email outreach sent (date or ✓)
- **Touch2:** LinkedIn message sent (date or ✓)
- **Touch3/Touch4:** Follow-up touchpoints (varies by campaign)
- **Response Status:** Keywords like "replied", "interested", "declined", "call booked", "not interested", etc.
- **Response Date:** Date of response received
- **Call Booked:** (BIM Modelers only) Yes/No or date of scheduled call
- **SMTP Status:** (SCPM only) Email deliverability status

---

## 3. Darren's Sheet Tabs → Dashboard Pages Mapping

Darren's Google Sheet contains eight tabs covering major strategic initiatives: DWDM, BEAD (broadband funding), Data Center expansion, and staffing strategy.

| Sheet Tab | Campaign Tag | Key Columns | Dashboard Page | Has Touches | Has Reply Tracking | Has Call Tracking |
|---|---|---|---|---|---|---|
| **DWDM Companies** | DWDM | Company (A), Contact (B), Title (C), Email (D), SMTP (E), LinkedIn (F), Evidence (G), Assigned (H), Touch1 (I), Touch2 (J), Touch3 (K), Touch4 (L), Touch5 (M), Tier (N) | DWDM Tab | ✅ Yes | ❌ No | ❌ No |
| **BEAD** | BEAD | # (A), State (B), BEAD Alloc (C), Company (D), Award (E), Tech (F), Tier (G), MZ Approach (H), MZ Hiring (I), Assigned (J), Contact (K), Title (L), Email (M), LinkedIn (N), SMTP (O) | BEAD Tab | ❌ No | ❌ No | ❌ No |
| **Copy of BEAD Winner** | BEAD Winner | Company (A), Desc (B), LinkedIn (C), #Emp (E), Industry (F), Title (G), FirstName (H), LastName (I), Contact LI (J), Email (K), Phone (L), Location (M) | BEAD Winner Tab | ❌ No | ❌ No | ❌ No |
| **DC - Contacts** | DC Contacts | Priority (B), Company (C), Project (D), GC (E), Contact (F), Title (G), Email (H), LinkedIn (I), Entry (J), Register (K) | DC Contacts Tab | ❌ No | ❌ No | ❌ No |
| **DC - All Projects** | DC Projects | Company (C), Project (D), City (E), State (F), Investment (G), Status (H), GC (I), Fiber Roles (K), Open Roles (L), Urgency (O), Entry (P), Hook (Q) | DC Projects Tab | ❌ No | ❌ No | ❌ No |
| **DC - Job Demand** | DC Job Demand | Company (A), Title (B), Open Positions (C), Salary (D), Location (E), Days Open (F), Urgency (G) | DC Job Demand Tab | ❌ No | ❌ No | ❌ No |
| **DC - Fiber & Optical Roles** | DC Fiber Roles | Company (A), Title (B), Skills (C), Certs (D), Open Jobs (E), Rate (F), Salary (G), DC Phase (H), Shortage (I), Mercury Z (J) | DC Fiber Roles Tab | ❌ No | ❌ No | ❌ No |

### Darren-Specific Endpoints

- **DWDM Dashboard:** `/api/darren/dwdm-dashboard` (reads DWDM Dashboard sheet tab for executive summary)
- **DC Executive Summary:** `/api/darren/dc-executive-summary` (aggregated data center metrics)

---

## 4. Dashboard KPI & Metrics Calculations

All KPIs are computed in the backend function `computeMetrics()` in `server.js`. Below is the formula for each metric and any caveats.

### Contact Metrics

| KPI | Formula | Notes |
|---|---|---|
| **Companies** | `new Set(contacts.map(c => c.company)).size` | Count of unique company names |
| **Total Contacts** | `rows.length` | Count of all non-empty rows in sheet tab |
| **Emails Sent** | `rows where touch1 ≠ empty` | Touch1 column = email outreach (marker or date) |
| **LinkedIn Touches** | `rows where touch2 ≠ empty` | Touch2 column = LinkedIn message sent |
| **Replies Received** | `rows where response_status matches reply keywords` | See keyword list below; only counted if tab has response_status field |
| **Calls Scheduled** | `rows where call_booked ≠ empty` | Only BIM Modelers tab has this field for Laura; Darren tabs do not have this field |

### Reply Keywords

Responses are counted if the `Response Status` field contains any of these keywords:
- `replied`
- `reply`
- `response`
- `auto-reply`
- `declined`
- `interested`
- `not interested`
- `scheduled`
- `call booked`
- `meeting`
- `referred`
- `✅` (checkmark emoji, means positive reply)
- `❌` (X emoji, means declined)
- `⛔` (blocked emoji, means unresponsive)

### Scoreboard Override (Task List Sheet)

**For Laura agent only:** The `Task List` tab (same spreadsheet as campaigns) contains a manual override for two metrics:

- **Location:** Rows 5–10, Column A (label), Column C (numeric value)
- **Read from:** Rows with labels "Calls Scheduled" and "Replies Received" in Column A; values in Column C override computed metrics
- **Applied to:** Laura's dashboard scoreboard metrics
- **Date filtering:** Override ignores any date filters applied in the UI; always uses the stored value

**Example:**
- Task List row 5: `Calls Scheduled` | (blank B) | `12` → replaces computed metric with `12`
- Task List row 6: `Replies Received` | (blank B) | `27` → replaces computed metric with `27`

---

## 5. Known Issues & Limitations

### Issue 1: Calls Scheduled Always Shows All-Time Total ⚠️

**Severity:** Medium  
**Description:** The `/api/contacts/metrics` endpoint ignores the `date_from` and `date_to` query parameters passed by the frontend. When "This Month" is selected in the UI, the "Calls Scheduled" metric does NOT filter to that date range; it returns the all-time count instead.

**Root Cause:** Backend filtering not implemented for Calls Scheduled KPI.

**Workaround:** Use the Task List manual override (Section 4) to set a specific month's value.

**Fix Required:** Modify `computeMetrics()` to respect date_from/date_to parameters for the Calls Scheduled KPI.

---

### Issue 2: Darren Has No Reply/Call Tracking ⚠️

**Severity:** Low–Medium  
**Description:** All Darren sheet tabs currently do not map `response_status` or `call_scheduled` fields in their column definitions. Darren's dashboard shows only contact count and companies, not engagement metrics.

**Impact:** Darren's scoreboard lacks "Replies Received" and "Calls Scheduled" metrics.

**Fix Required:** 
1. Map reply/call columns in Darren's sheets (if they exist).
2. Update `readDarrenContacts()` in server.js to extract and populate these fields.
3. Compute reply/call metrics for Darren's dashboard.

---

### Issue 3: Sales Coordinators / PMs Tab Name Mismatch ⚠️

**Severity:** Low (fixed)  
**Description:** The sheet tab is named `Sales Coordinators / PMs` (with forward slash) but the campaign tag used in the API is `Sales Coordinators - PMs` (with hyphen). This mismatch previously caused 500 errors when reading from Google Sheets using the old single-quoted range query syntax.

**Status:** Fixed on 2026-04-30. The sheet read now uses proper escaping or dynamic tab name lookup.

**Note:** If the tab name or campaign tag is ever changed, ensure both references stay in sync.

---

## 6. Dashboard Pages Index

### Laura Agent — All Tabs

| Tab Name | Data Source | KPIs | Notes |
|---|---|---|---|
| **Overview/Dashboard** | `/api/contacts/metrics` + `/api/cost/today` | Companies, Total Contacts, Emails, LinkedIn, Replies, Calls | Real-time scoreboard; subject to date filter |
| **CET Tab** | Sheet: CET Designers | Same as above (campaign-specific) | Design/engineering hiring focus |
| **Estimators Tab** | Sheet: Estimators | Same as above (campaign-specific) | Commercial contractors |
| **BIM Tab** | Sheet: BIM Modelers | Same as above + Call Booked | Only tab with call tracking |
| **SCPM Tab** | Sheet: Sales Coordinators / PMs | Same as above (no call tracking) | Project management roles |
| **Pipeline Tab** | `/api/contacts` (all Laura campaigns) | Full contact list, company, status | Unfiltered view of all contacts |
| **Contacts Tab** | `/api/contacts` | Full contact list with filters | Sortable/filterable contact viewer |
| **Campaign Contacts Tab** | `/api/contacts` + campaign filter | Filtered by selected campaign | Campaign-specific contact list |
| **Master Board Tab** | Sheet: `Master` tab (via `/api/sheets/Master`) | Campaign overview, summary data | Manual entry sheet for campaign rollup |
| **Analytics Tab** | `/api/contacts/metrics` + time series | Metrics over time, trends | Line chart view of KPI evolution |
| **Trends Tab** | Computed from `/api/contacts` | Response rate, email-to-reply ratio, etc. | Calculated engagement trends |
| **Relationships Tab** | Contact relationship tracking (PostgreSQL) | Connection graph, referrals | Network relationship view |
| **Goals Tab** | `/api/contacts/metrics` | Target vs. actual KPIs | Goal tracking and variance |
| **ROI Tab** | `/api/cost/history` (Anthropic Admin API) | Cost per contact, cost per reply, payback | Cost efficiency analysis |
| **Cost Tab** | `/api/cost/today` + `/api/cost/history` | Daily spend, cumulative cost | Detailed cost breakdown |
| **Agent Tasks Tab** | `/api/activities` | Activity log, task history | All Laura agent activities |
| **Abhi Tasks Tab** | `/api/abhi/tasks` (PostgreSQL `abhi_tasks`) | Abhinanda's personal task list | Pulled from separate task table |
| **Blacklist Tab** | `/api/contacts` filtered by `blacklisted=true` | Opted-out/blocked contacts | Contacts not to reach out to |
| **Database Tab** | Raw `/api/contacts` (all fields) | Unformatted contact data | Developer/QA view of raw data |
| **Team Tab** | Agent overview (static or computed) | Team member roles, stats | Laura agent team summary |

### Darren Agent — All Tabs

| Tab Name | Data Source | KPIs | Notes |
|---|---|---|---|
| **Darren Dashboard Tab** | `/api/contacts/metrics?agent=darren` | Companies, Contacts (Darren-specific) | Darren's version of Overview tab |
| **DWDM Tab** | Sheet: DWDM Companies | Companies, Contacts, Touches (no reply/call) | Darren's primary DWDM prospects |
| **BEAD Tab** | Sheet: BEAD | Companies, Contacts, State allocation data | Federal broadband funding initiative |
| **BEAD Winner Tab** | Sheet: Copy of BEAD Winner | Companies, Contacts, Hiring signals | Post-award data center expansion |
| **DC Contacts Tab** | Sheet: DC - Contacts | Companies, Contacts, Project priority | Data center contact list |
| **DC Projects Tab** | Sheet: DC - All Projects | Project count, Investment, Status | Data center project portfolio |
| **DC Job Demand Tab** | Sheet: DC - Job Demand | Open positions, Salary ranges | Staffing needs by role/location |
| **DC Fiber Roles Tab** | Sheet: DC - Fiber & Optical Roles | Skills, Certifications, Open jobs | Specialized fiber/optical roles |
| **DWDM Dashboard Tab** | `/api/darren/dwdm-dashboard` | DWDM-specific metrics | Executive summary for DWDM campaign |
| **DC Executive Summary Tab** | `/api/darren/dc-executive-summary` | Data center aggregated KPIs | Strategic DC opportunity summary |
| **DWDM Outreach Tab** | Outreach tracking (PostgreSQL/Sheets) | Touches, engagement | DWDM outreach progression |
| **Darren Master Board Tab** | Sheet: `Master` (Darren sheet) | Campaign rollup, overview | Darren's campaign summary sheet |
| **Darren Tasks Tab** | `/api/activities?agent=darren` | Activity log for Darren | Darren-specific activity history |
| **Darren Cost Tab** | `/api/cost/today?agent=darren` | Cost allocation to Darren | Darren's portion of API spend |

---

## 7. API Endpoints Reference

### Contacts & Metrics

- **`GET /api/contacts`** → Returns all contacts across both agents; supports filters (campaign, agent, company, date range)
- **`GET /api/contacts/metrics`** → Returns computed KPIs (companies, total, emails, linkedin, replies, calls); supports agent and date range query params ⚠️ (see Issue 1)
- **`GET /api/sheets/{tab_name}`** → Returns raw data from a Google Sheet tab by name

### Cost Tracking

- **`GET /api/cost/today`** → Current day's Anthropic API spend
- **`GET /api/cost/history`** → Historical cost data (by day/week/month)
- **`GET /api/cost/today?agent=darren`** → Darren's cost allocation

### Activities & Tasks

- **`GET /api/activities`** → Agent activity log (calls, meetings, notes)
- **`GET /api/activities?agent=darren`** → Darren-specific activity log
- **`GET /api/abhi/tasks`** → Abhinanda's task list (PostgreSQL)

### Darren-Specific

- **`GET /api/darren/dwdm-dashboard`** → DWDM executive summary
- **`GET /api/darren/dc-executive-summary`** → Data center strategic summary

---

## 8. Data Refresh & Update Cadence

| Data Source | Refresh Frequency | Who Updates | Notes |
|---|---|---|---|
| Laura's Google Sheet | Real-time | Laura / Sales team | Manual entry; synced to PostgreSQL on read |
| Darren's Google Sheet | Real-time | Darren / Team | Manual entry; synced to PostgreSQL on read |
| PostgreSQL `contacts` | On API call | Sync job or API read | Lag: 0–30 seconds from sheet update |
| PostgreSQL `agent_activities` | Real-time | Automated logging | Records touches, calls, notes |
| PostgreSQL `agent_cost_snapshots` | Hourly | Cron job | Pulls from Anthropic Admin API hourly |
| Anthropic Admin API | Hourly | Anthropic | Billing data; may lag by 1–2 hours |

---

## Appendix: Contact Column Format Guide

### Standard Columns (Laura & Darren)

| Column | Format | Example | Required |
|---|---|---|---|
| Company | Text | "Steelcase Inc." | ✅ Yes |
| Contact / Name | Text | "John Smith" | ✅ Yes |
| Title | Text | "Hiring Manager" | ✅ Yes |
| Email | Email | "john.smith@example.com" | ✅ Yes |
| LinkedIn | URL | "linkedin.com/in/johnsmith" | ⭕ Preferred |
| Job Link | URL | "linkedin.com/jobs/view/12345" | ⭕ Optional |
| Location | Text | "Chicago, IL" | ⭕ Preferred |
| Role / Role Description | Text | "BIM Modeler" | ⭕ Preferred |

### Touch Columns (Laura)

| Column | Format | Example | Notes |
|---|---|---|---|
| Touch1 | Date or ✓ | "2026-04-15" or "✓" | Email outreach sent |
| Touch2 | Date or ✓ | "2026-04-16" | LinkedIn message sent |
| Touch3 | Date or ✓ | "2026-04-18" | Follow-up call/email |
| Touch4 | Date or ✓ | "2026-04-22" | Secondary follow-up |

### Response Columns (Laura)

| Column | Format | Example | Notes |
|---|---|---|---|
| Response Status | Keyword | "replied" / "interested" / "declined" | See Section 4 for full keyword list |
| Response Date | Date | "2026-04-17" | Date reply was received |
| Call Booked | Yes / Date / ✓ | "2026-04-25" or "Yes" | (BIM Modelers only) |
| Call Booked (Laura BIM) | Date or ✓ | "2026-04-25" | Scheduled call date |

### DWDM Columns (Darren)

| Column | Format | Example | Notes |
|---|---|---|---|
| Touch1–Touch5 | Date or ✓ | "2026-04-15" | Multiple follow-up touches |
| Evidence | Text | "Posted hiring on LinkedIn" | Signal or proof of opportunity |
| Tier | Text | "Tier 1" / "Tier 2" | Priority ranking |
| Assigned | Name | "Darren" | Owner of account |

---

## Footer

**Last updated:** 2026-04-30  
**Maintained by:** Laura Agent (Abhinanda Deb, Lenore Kopko, Alessandro Olivar, Ron Rivero)  
**Questions or updates?** Contact the Bold Business development team.

---

*This document is a stakeholder-ready reference. For technical implementation details, refer to `server.js` and the React component source code in `/app/src/`.*
