# Handoff — Next Session Prompt

> Copy everything below this line and paste into a new Claude Code chat to start the next session.

---

## Context: Bold Business Sales Dashboard

**Project:** React 18 + Vite frontend + Express 5 ESM API (`api/server.js`) + PostgreSQL on AWS RDS.
**Working directory:** `c:\Users\w3jbt\_ORGANIZED\Small-Projects\mn-jewel (wj3dev)\01-BOLD-BUSINESS\Dashboard\laura-dashboard-main\laura-dashboard-main`
**Dev branch:** `feat/phase2-sales-dashboard-dual-agent`
**Open PR:** https://github.com/BoldBusiness/laura-dashboard/pull/1 (`feat/phase2-pr`)

### What was built in the last two sessions
- Full dual-agent dashboard: Laura (cyan #06E5EC) + Darren (amber #F59E0B) — both have complete tab sets, task lists, ROI, cost tracking, chat
- Darren's 5 campaign tabs: DWDM, BEAD, BEAD Winners, DC Contacts, DC Projects — all wired
- Overview rebuilt: stacked hero cards with horizontal metric chips and "View Dashboard →" CTA
- TrendsTab: "Today vs Yesterday" + "This Week vs Last Week" with delta badges
- 3,432 contacts + 3,404 historical activities seeded into PostgreSQL (no longer on Google Sheets)
- Activity logging is agent-aware: `POST /api/bb/activities` accepts `{ agent: 'darren', ... }`

### Key rules (never break these)
- **Parity rule:** Every feature Laura has must exist identically for Darren. Never add to one only.
- **Auth:** `app.use(authMiddleware)` covers all routes. Do NOT add `requireAuth` as a route-level arg — it's undefined.
- **DB migrations:** Always use `ADD COLUMN IF NOT EXISTS` — runs at every server startup.
- **No test runner** — validation is `cd app && npm run build` (must pass before anything is "done").
- **Bulk inserts only:** Never loop `await pool.query()` per row — use multi-value INSERT. RDS times out.
- **Agent colors:** Laura = `#06E5EC`, Darren = `#F59E0B`. Never change.
- **`agent_activities.actions`** column is `jsonb` — always `JSON.stringify([string])` + `::jsonb` cast.

---

## Today's Tasks — Do In This Order

### Task Q1 — Wire GoalsTab into App.jsx (~20 min)
**What:** `GoalsTab.jsx` is fully built but invisible. Add it to the tab router and TabNav.
**Files to touch:** `app/src/App.jsx`, `app/src/components/TabNav.jsx`
**Where to wire it:**
- In TabNav: add "Goals" sub-tab under both `laura` and `darren` top-tabs
- In App.jsx: add `{topTab === 'laura' && lauraSub === 'goals' && <GoalsTab agentName="laura" />}` and same for darren
- In TAB_CONTEXT: add `laura_goals` and `darren_goals` entries
**Validate:** `npm run build` passes. Click Goals sub-tab for Laura → goals list renders. Same for Darren.
**Commit:** `feat(goals): wire GoalsTab into nav for both agents`

---

### Task Q2 — Wire AcceptanceTab into App.jsx (~20 min)
**What:** `AcceptanceTab.jsx` is fully built (approve/reject agent tasks) but invisible in the UI. Abhi specifically asked for approve/reject on tasks (requirement 7.3).
**Files to touch:** `app/src/App.jsx`, `app/src/components/TabNav.jsx`
**Where to wire it:**
- Same pattern as Q1 — add "Acceptance" sub-tab under both laura and darren
- In App.jsx: `{topTab === 'laura' && lauraSub === 'acceptance' && <AcceptanceTab agentName="laura" />}`
**Validate:** `npm run build` passes. Click Acceptance tab → approve/reject task rows appear.
**Commit:** `feat(acceptance): wire AcceptanceTab into nav — unlocks approve/reject for Abhi`

---

### Task Q3 — Create PLUS_FEATURES.md at repo root (~20 min)
**What:** Pure markdown file documenting what this dashboard can do. Explicit Ed Kopko deliverable per OpenClaw playbook.
**File to create:** `PLUS_FEATURES.md` at repo root
**Content to include:**
- Agent names, roles, and dashboard URL
- Standard features (contacts, tasks, ROI, cost, trends, chat, blacklist, prospecting)
- Role-specific features (Laura: CET/Estimators/SCPM/BIM outreach tabs | Darren: DWDM/BEAD/DC tabs)
- Activity logging API endpoint
- How to seed historical data
- How to add a new campaign
**Validate:** File exists at repo root, readable, accurate.
**Commit:** `docs: add PLUS_FEATURES.md — agent feature registry per playbook`

---

### Task M1 — Google Sheet–Style Column Filters (~3–4 hours)
**What:** Every data tab (DWDM, BEAD, BEAD Winners, DC Contacts, DC Projects, Pipeline, CET, Estimators, SCPM, BIM) needs Google Sheets–style filtering: multi-select dropdown per column + text search + sort. This is Abhi's #1 UX ask (requirement 1.2).

**Design spec:** `docs/superpowers/specs/2026-04-28-dashboard-filters-data-fixes-design.md`

**Approach — build shared hook + component, then wire into each tab:**

**Step 1 — Create `app/src/hooks/useColumnFilters.js`**
```js
// Manages filter state for a set of columns
// Returns: { filters, setFilter, clearFilters, applyFilters(rows) }
// filters = { columnKey: { type: 'multiselect'|'text', values: Set|string } }
```
- `applyFilters(rows)` returns filtered rows based on active filters
- `getUniqueValues(rows, columnKey)` helper to build dropdown options

**Step 2 — Create `app/src/components/ColumnFilterHeader.jsx`**
```jsx
// Props: column { key, label, filterable: true, type: 'multiselect'|'text' }
//        filters (from useColumnFilters)
//        onFilterChange
// Renders: column label + filter icon — clicking opens a dropdown
// Dropdown: checkbox list for multiselect, text input for text search
// Active filter: highlight the column header (e.g. blue dot)
```

**Step 3 — Wire into CampaignContactsTab.jsx**
- `CampaignContactsTab` is the shared component used by ALL 10 data tabs
- Add `useColumnFilters` hook, pass `ColumnFilterHeader` to each `<th>`
- Apply `filters` to the rows before rendering
- Add "Clear all filters" button when any filter is active

**Columns to filter per tab:**
- All tabs: Company, Contact Name, Title, Response Status, Touch 1–4 status
- Add sort (asc/desc arrow) on: Company, Contact Name, Response Status

**Validate:**
- [ ] `npm run build` passes
- [ ] Open DWDM tab → click Company header → dropdown shows all unique company names
- [ ] Check 2 companies → table filters to those rows only
- [ ] Text search on Contact Name → live filter as you type
- [ ] Sort arrow on Company → rows sort A→Z / Z→A
- [ ] "Clear filters" resets to all rows
- [ ] Same works on BEAD, BEAD Winners, DC Contacts, DC Projects, Pipeline, CET tabs
**Commit:** `feat(filters): Google Sheet–style column filters on all data tabs`

---

### Task M2 — ROI Per-Bucket Panel in RoiTab (~2 hours)
**What:** Add a "Cost by Outreach Bucket" section to `RoiTab.jsx` showing cost breakdown across T1, T2, T3, T4 outreach, Responses, and Calls.

**API:** `GET /api/roi?agent=laura|darren` already returns activity data. Check what fields it returns. If it doesn't return bucket-level costs, add a query to `server.js`:
```sql
SELECT category, type, COUNT(*) as activity_count, SUM(cost_usd) as total_cost
FROM agent_activities
WHERE agent_id = $1
GROUP BY category, type
ORDER BY total_cost DESC
```

**UI — add below existing ROI content in RoiTab.jsx:**
- Section title: "Cost by Outreach Activity"
- Horizontal bar per bucket: T1 Outreach, T2 Follow-up, T3 Follow-up, T4 Follow-up, Responses, Calls
- Each bar shows: bucket name, activity count, total cost ($X.XX), % of total
- Color: match agent accent color (Laura cyan, Darren amber)
- Works for both `agentName="laura"` and `agentName="darren"`

**Validate:**
- [ ] `npm run build` passes
- [ ] Laura ROI tab → bucket panel shows bars with real data
- [ ] Darren ROI tab → same panel, amber color, Darren's data
- [ ] Bars are proportional — highest cost bucket is widest
**Commit:** `feat(roi): add per-bucket cost breakdown panel to RoiTab`

---

## After All 4 Tasks

1. Run `cd app && npm run build` — confirm zero errors
2. Update `TRACKER_TASK.md` — mark Q1, Q2, Q3, M1, M2 complete
3. Update `docs/superpowers/plans/current-status.md`
4. Commit docs update: `docs: mark Q1–Q3 + M1–M2 complete`
5. Push to PR branch:
   ```bash
   git checkout feat/phase2-pr
   git checkout feat/phase2-sales-dashboard-dual-agent -- app/src/ api/ PLUS_FEATURES.md TRACKER_TASK.md docs/
   git add -A
   git commit -m "feat(phase3): goals, acceptance, column filters, ROI buckets"
   git push origin feat/phase2-pr
   ```
6. Push dev branch to mnjbold backup:
   ```bash
   git checkout feat/phase2-sales-dashboard-dual-agent
   git push mnjbold feat/phase2-sales-dashboard-dual-agent
   ```

---

## File Map (for orientation)

```
app/src/
  App.jsx                          ← top-level router, add new sub-tab entries here
  components/
    TabNav.jsx                     ← add new tab labels here
    tabs/
      DashboardTab.jsx             ← Overview hero cards (rebuilt)
      TrendsTab.jsx                ← comparison mode (done)
      RoiTab.jsx                   ← add bucket panel here (M2)
      GoalsTab.jsx                 ← fully built, wire into router (Q1)
      AcceptanceTab.jsx            ← fully built, wire into router (Q2)
      CampaignContactsTab.jsx      ← shared table — add filters here (M1)
      [DWDM/BEAD/BEADWinner/DCContacts/DCProjects/Pipeline/CET/Estimators/SCPM/BIM]Tab.jsx
  hooks/
    useDashboardData.js
    useCampaignCounts.js
    useColumnFilters.js            ← CREATE THIS (M1)
  components/
    ColumnFilterHeader.jsx         ← CREATE THIS (M1)
api/
  server.js                        ← Express 5 ESM, all routes
  seed-activities.js               ← historical activity seeder (done, idempotent)
  import-xlsx.js                   ← XLSX → PostgreSQL (done)
TRACKER_TASK.md                    ← update after each task
PLUS_FEATURES.md                   ← CREATE THIS (Q3)
```
