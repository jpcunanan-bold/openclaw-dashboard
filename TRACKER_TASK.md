# Sales Dashboard — Task Tracker

**Project:** Bold Business Sales Dashboard (Laura + Darren AI agents)  
**Repo:** https://github.com/BoldBusiness/laura-dashboard  
**Open PR:** https://github.com/BoldBusiness/laura-dashboard/pull/1 (feat/phase2-pr)  
**Last Updated:** 2026-04-29  

---

## Local Dev

```bash
bash dev.sh          # API :3100 + Vite :5173
cd app && npm run build   # prod build check
```

DB: `bb-agents-shared-db.cpsqyxgezuwr.us-east-2.rds.amazonaws.com` — database `laura`  
3,432 contacts seeded | 3,404 activities seeded in `agent_activities` (bb_agents DB)

---

## Phase 1 — Completed ✅

All Phase 1 items from the original spec are done and shipped.

| # | Item | Status |
|---|------|--------|
| 1 | Overview tab, branding ("Sales Dashboard") | ✅ |
| 2 | Laura + Darren separate KPI cards on Overview | ✅ |
| 3 | Contacts tab with filters (agent, campaign, company, touch, next action) | ✅ |
| 4 | Touch badges T1–T4 per row | ✅ |
| 5 | Blacklist tab (count + table + restore) | ✅ |
| 6 | AgentChat panel (Laura / Darren toggle) | ✅ |
| 7 | TrendsTab — 7d/14d cost history | ✅ |
| 8 | Calls Scheduled metric in Trends | ✅ |
| 9 | PostgreSQL contacts table (RDS) | ✅ |
| 10 | Login gate | ✅ |

---

## Phase 2 — Completed This Session ✅

| # | Item | Notes |
|---|------|-------|
| 1 | **Darren tabs: DWDM, BEAD, BEAD Winners, DC Contacts, DC Projects** | All wired into TabNav + App.jsx |
| 2 | **TrendsTab comparison mode** | "Today vs Yesterday" + "This Week vs Last Week" with delta badges |
| 3 | **Overview DashboardTab redesign** | Stacked full-width agent cards (cyan/amber), horizontal metric chips, "View Dashboard →" CTA |
| 4 | **XLSX bulk import** | Replaced row-by-row with single multi-value INSERT; 3,432 rows in <5s (DWDM, BEAD, BEAD Winners, DC Contacts, DC Projects, Laura leads) |
| 5 | **Agent-aware activity logging** | `bbLogActivity()` accepts `agentId` param; `POST /api/bb/activities` resolves from `body.agent` shorthand |
| 6 | **Both agents in `agent_registry`** | Startup upsert ensures Laura + Darren are always registered |
| 7 | **Historical activity seeder** (`api/seed-activities.js`) | Bulk-inserts 3,404 activities from contacts table into `agent_activities` (Darren: 1,726 / Laura: 1,678) |
| 8 | **PR #1 pushed** | `feat/phase2-pr` → BoldBusiness/laura-dashboard, PR description updated |
| 9 | **`.gitignore` hardened** | Excludes `*.xlsx`, `docs/data/`, credential `.txt` files, `.bak` files |

---

## NOT YET DONE — Prioritized

### Priority 1 — Quick Wins (< 2 hours each)

| # | Item | What's needed |
|---|------|---------------|
| Q1 | **Wire `GoalsTab` into App.jsx** | Component fully built in `GoalsTab.jsx`, just missing from tab router and TabNav |
| Q2 | **Wire `AcceptanceTab` into App.jsx** | Same — built but invisible; Ed's delegation approve/reject is inaccessible |
| Q3 | **`PLUS_FEATURES.md`** at repo root | Pure markdown, no code — explicit playbook deliverable Ed requested |
| Q4 | **Blocked Tasks card on Overview** | Filter existing task fetch by `status=blocked`, add one KPI chip to DashboardTab |
| Q5 | **Agent Health dot on Overview** | Ping existing `/api/health`, show green/red dot per agent on hero card |

### Priority 2 — Medium Tasks (2–8 hours each)

| # | Item | What's needed |
|---|------|---------------|
| M1 | **Google Sheet–style column filters** | `useColumnFilters` hook + `ColumnFilterHeader` component → wire into all 7 data tabs (DWDM, BEAD, BEAD Winners, DC Contacts, DC Projects, Pipeline, CET, Estimators, SCPM, BIM). Multi-select dropdown + text search + sort. Spec: `docs/superpowers/specs/2026-04-28-dashboard-filters-data-fixes-design.md` |
| M2 | **ROI per-bucket panel in RoiTab** | Add cost breakdown by outreach bucket (T1, T2, T3, T4, Responses, Calls) as a horizontal bar panel |
| M3 | **"Next Steps" section on Overview** | Pull top 3 tasks with `next_step` value from tasks table, display below agent cards |
| M4 | **Delegation 7-point checklist in AcceptanceTab** | Scored checklist UI on the existing approve/reject row |
| M5 | **Cost per goal rollup in GoalsTab** | Join `agent_activities.cost_usd` to goal tasks, show total per goal |
| M6 | **Highest-cost tasks leaderboard** | Sort `/api/tasks/costs` by `total_cost` desc, show top 10 in CostTab |
| M7 | **Prod chat connectivity fix** | Diagnose ECONNREFUSED in prod (wrong API base URL or missing auth header in AbhiTasksTab) |

### Priority 3 — Larger Effort (1–3 days each)

| # | Item | Complexity |
|---|------|------------|
| L1 | **Chat → dashboard action bridge** | Intent parser in `/api/chat/respond` that maps "add goal X" / "update task Y" to existing API calls + pushes refresh signal to frontend |
| L2 | **Task type auto-classification** | Add `task_type` column to `abhi_tasks`, run regex/LLM classifier at ingest, display badge in task rows |
| L3 | **Sessions tab** | Query `messages` grouped by `session_id`, display as read-only table with cost + duration |
| L4 | **Static HTML report generation** | API endpoint → builds HTML from template + data → saves to `/public/reports/` → returns URL |
| L5 | **Mobile chat UX** | Responsive redesign of `AgentChat.jsx` — bottom-sheet pattern for mobile |
| L6 | **Google Chat inbound webhook** | Handler for Google Chat → task capture pipeline |
| L7 | **Charting library** | Install Recharts, replace CSS bars with interactive charts |

---

## Open PR Checklist

PR #1 is open at https://github.com/BoldBusiness/laura-dashboard/pull/1

Before merge:
- [ ] Reviewer runs `bash dev.sh` — API :3100, App :5173
- [ ] All 5 Darren tabs load (DWDM, BEAD, BEAD Winners, DC Contacts, DC Projects)
- [ ] Overview shows stacked Laura + Darren hero cards with metric chips
- [ ] Trends "Today vs Yesterday" comparison shows delta badges
- [ ] `cd app && npm run build` passes (verified ✅ locally)
- [ ] Run `node api/seed-activities.js` once on prod server after deploy

---

## One-time Deploy Steps (when PR merges)

```bash
# On EC2 prod server
cd /var/www/laura-dashboard
git pull origin main
cd app && npm run build
pm2 restart laura-api   # or equivalent

# Seed historical activities (idempotent — safe to re-run)
cd /var/www/laura-dashboard/api
node seed-activities.js
```
