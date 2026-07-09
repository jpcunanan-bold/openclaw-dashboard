# Current Status: Sales Dashboard (Laura + Darren)

**Last updated:** 2026-04-29  
**PR:** https://github.com/BoldBusiness/laura-dashboard/pull/1 (open, ready for review)  
**Dev branch:** `feat/phase2-sales-dashboard-dual-agent`

---

## Running Locally

```bash
bash dev.sh          # API :3100 + Vite :5173
cd app && npm run build   # must pass before any push
```

DB: `bb-agents-shared-db` RDS → database `laura`  
- `contacts` table: 3,432 rows (all campaigns)  
- `agent_activities` table (bb_agents DB): 3,404 rows (Laura: 1,678 / Darren: 1,726)

---

## Phase 1 — Done ✅

All original Phase 1 spec items are complete. See `TRACKER_TASK.md` for the full list.

---

## Phase 2 — Done This Session ✅

| Item | Commit |
|------|--------|
| Darren tabs: DWDM, BEAD, BEAD Winners, DC Contacts, DC Projects | `319d309` |
| TrendsTab: Today vs Yesterday + This Week vs Last Week with delta badges | `6dba527` |
| Overview: stacked agent cards with metric chips + "View Dashboard →" CTA | `64ac0ca` |
| XLSX bulk import (3,432 rows, all 6 campaigns, single INSERT) | `501c3c4` |
| Agent-aware activity logging in server.js | `2fb34d7` |
| Historical activity seeder (`api/seed-activities.js`) | `2fb34d7` |

---

## Not Yet Done

See `TRACKER_TASK.md` → "NOT YET DONE" section for the full prioritized list.

**Short version:**

**Quick wins (do first):**
- Wire `GoalsTab` and `AcceptanceTab` into App.jsx router (both fully built, just invisible)
- `PLUS_FEATURES.md` file (pure markdown, no code)
- Blocked Tasks card + Agent Health dot on Overview

**Medium tasks:**
- Google Sheet–style column filters on all data tabs
- ROI per-bucket panel in RoiTab
- Cost per goal rollup in GoalsTab

**Larger:**
- Chat → dashboard action bridge (intent → actual state changes)
- Task type auto-classification
- Sessions tab, static HTML reports

---

## Testing Checklist (run locally before any merge)

| Check | Pass Criteria |
|-------|---------------|
| Header: "Sales Dashboard", no Brio/Mercury Z | Correct text visible |
| Overview: two stacked agent cards (Laura cyan / Darren amber) with chips | Cards present |
| "View Dashboard →" on each card switches top tab | Tab switch works |
| Laura sub-tabs: Pipeline, CET, Estimators, SCPM, BIM | All load contacts |
| Darren sub-tabs: DWDM, BEAD, BEAD Winners, DC Contacts, DC Projects | All load contacts |
| Trends → "Today vs Yesterday" → delta badges appear | Green/red deltas visible |
| Trends → "This Week vs Last Week" → comparison renders | Week cards visible |
| ROI tab works for both Laura and Darren | Data loads, no errors |
| Tasks tab works for both agents | Task list loads |
| `cd app && npm run build` | Zero errors |
