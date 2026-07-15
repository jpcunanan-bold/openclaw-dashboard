# Laura Laura Dashboard — Architecture & System Documentation

## Overview

The Laura Laura Dashboard is the operational dashboard for Abhinanda Deb's AI agent (Laura Rhodes). It provides real-time visibility into agent activity, cost tracking, task management, and ROI measurement across three domains: Bold Business (primary), Mercury Z (secondary), and Personal.

**Live URL:** `https://oc-agent-laura-laura-rhodes.boldbusiness.com/app/`

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                       OpenClaw Gateway                               │
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────────┐ │
│  │  Google Chat     │    │  Claude API      │    │  laura-tracker    │ │
│  │  Channel Plugin  │───▶│  (Anthropic)     │    │  Plugin (local)  │ │
│  └────────┬────────┘    └────────┬─────────┘    └────────┬─────────┘ │
│           │                      │                        │          │
│     message_received        agent_end              auto-POST to     │
│           │                      │                  API server       │
└───────────┼──────────────────────┼───────────────────────┼──────────┘
            │                      │                        │
            ▼                      ▼                        ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    API Server (Express, port 3100)                    │
│                                                                      │
│  POST /api/messages ◀── laura-tracker plugin (no auth)                │
│  POST /api/activities ◀── agent self-reports (legacy)                │
│  GET  /api/messages  ◀── dashboard (auth required)                   │
│  GET  /api/pg/*      ◀── dashboard (auth required)                   │
│  GET  /api/cost/today ◀── Anthropic Admin API (real-time)            │
│                                                                      │
│  ┌──────────────┐  ┌─────────────────┐  ┌────────────────────────┐  │
│  │ auto-cost-   │  │ session-tracker │  │ daily-log-sync         │  │
│  │ tracker.js   │  │ .cjs            │  │ .cjs                   │  │
│  │ (5min cron)  │  │ (session costs) │  │ (memory → activities)  │  │
│  └──────────────┘  └─────────────────┘  └────────────────────────┘  │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     PostgreSQL RDS (AWS)                              │
│                                                                      │
│  activities      — agent-reported task log (legacy + ongoing)        │
│  messages        — auto-captured conversations (laura-tracker)        │
│  tasks           — explicit task tracking                            │
│  session_costs   — per-session token costs                           │
│  cost_snapshots  — daily cost snapshots                              │
│  cron_runs       — cron execution log                                │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    React Dashboard (Vite + React 19)                  │
│                                                                      │
│  Tabs: Dashboard | Master | Acceptance | Decisions | Company |       │
│        Team | ROI | Relationships | Trends | Database                │
│                                                                      │
│  Database sub-tabs:                                                  │
│    📊 Activities    — categorized agent-reported logs                │
│    💬 Conversations — auto-captured messages (laura-tracker)          │
│    📋 Tasks         — explicit task CRUD with status management      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: How Tracking Works

### Layer 1: Automatic Message Capture (laura-tracker plugin)

**This is the code-enforced layer. The agent has ZERO responsibility here.**

The `laura-tracker` plugin registers two OpenClaw lifecycle hooks:

| Hook | Fires When | Captures |
|------|-----------|----------|
| `message_received` | User sends a message | sender, channel, content, session, timestamp |
| `agent_end` | Agent finishes responding | response text, model, token usage, cost |

Every exchange is automatically POSTed to `POST /api/messages` and stored in the `messages` table. The agent cannot skip, forget, or omit this. It happens at the gateway layer before and after the agent runs.

### Layer 2: Activity Self-Reporting (legacy, still active)

The agent POSTs to `POST /api/activities` after each response with a human-readable title, category, and time-saved estimate. This feeds the Activities tab and ROI calculations. 

**Why keep both?** Activities provide the *semantic* layer (what was done, for whom, time saved). Messages provide the *raw* layer (every word exchanged, exact token costs). Together they give both the "what" and the "how much."

### Layer 3: Anthropic Admin API (cost ground truth)

`auto-cost-tracker.js` polls the Anthropic Admin API every 5 minutes for actual billed token usage. This is the cost ground truth — it catches everything including heartbeats, crons, and background work that neither the agent nor the plugin might report.

---

## Database Schema

### `messages` (auto-captured by laura-tracker plugin)

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID, auto-generated |
| direction | TEXT | `inbound` or `outbound` |
| session_key | TEXT | OpenClaw session identifier |
| inbound_message_id | TEXT | Links outbound → its triggering inbound |
| user_name | TEXT | Sender name (Ron, Ed, Jewel, etc.) |
| channel | TEXT | googlechat, telegram, etc. |
| content | TEXT | Full message or response text |
| model | TEXT | claude-opus-4-6, claude-sonnet-4-6, etc. |
| input_tokens | INTEGER | Prompt tokens for this exchange |
| output_tokens | INTEGER | Response tokens |
| cache_read_tokens | INTEGER | Cached prompt tokens (90% discount) |
| cache_write_tokens | INTEGER | New cache entries |
| total_tokens | INTEGER | Sum of all token types |
| cost_usd | NUMERIC | Calculated cost using org-discounted rates |
| timestamp | TIMESTAMPTZ | When the message was sent/received |

Indexes: `session_key`, `timestamp DESC`, `direction`

### `tasks` (explicit task tracking)

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | `TASK-{timestamp}` |
| title | TEXT | Human-readable task name |
| description | TEXT | Optional details |
| created_by | TEXT | Ron, Ed, Jewel, System |
| status | TEXT | open, in_progress, done, cancelled |
| task_id_ref | TEXT | Links to Master sheet ID (e.g., BB-047) |
| total_cost_usd | NUMERIC | Aggregated cost |
| total_tokens | INTEGER | Aggregated tokens |
| created_at | TIMESTAMPTZ | Creation time |
| updated_at | TIMESTAMPTZ | Last modification |
| completed_at | TIMESTAMPTZ | When marked done |

### `activities` (agent self-reported)

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | `ACT-{timestamp}-{random}` |
| type | TEXT | user-task, system, cron |
| category | TEXT | user-generated, routine, developer |
| requested_by | TEXT | Ed, Ron, Jewel, System, Cron |
| title | TEXT | Human-readable activity title |
| request | TEXT | What was asked |
| actions | JSONB | Array of action descriptions |
| task_id | TEXT | Links to Master sheet task |
| model | TEXT | Model used |
| input/output/cache tokens | INTEGER | Token counts |
| cost_usd | NUMERIC | Calculated cost |
| time_saved_min | INTEGER | Estimated minutes saved for Ed |
| source | TEXT | api, session-tracker, auto-cost |
| session_key | TEXT | OpenClaw session |
| timestamp | TIMESTAMPTZ | When activity occurred |

### `session_costs` (auto-tracked per session)

Captures per-session token costs from the OpenClaw session tracker. Used by the dashboard's cost-by-category cards.

### `cost_snapshots` (daily rollups)

Daily cost snapshots for historical trending.

---

## API Endpoints

### No-Auth Endpoints (called by plugins/crons)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/messages` | laura-tracker plugin writes captured messages |
| POST | `/api/activities` | Agent self-reports activities |
| POST | `/api/tasks/cost` | Legacy cost tracker compatibility |
| GET | `/api/health` | Health check |

### Auth-Required Endpoints (dashboard)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/messages?days=7` | Query message history |
| GET | `/api/pg/activities?days=7` | Query activities from Postgres |
| GET | `/api/pg/summary` | Daily/weekly cost summary |
| GET | `/api/pg/health` | Postgres connection status |
| GET | `/api/cost/today` | Real-time cost from Anthropic API |
| GET | `/api/cost/history` | 14-day time series |
| GET | `/api/activities?today=1` | Today's activities |
| GET | `/api/tracker-tasks` | List tasks |
| POST | `/api/tracker-tasks` | Create task |
| PATCH | `/api/tracker-tasks/:id` | Update task status |
| GET | `/api/pricing` | Model pricing reference |
| GET | `/api/sheets/:name` | Google Sheets proxy |

---

## Cost & ROI Tracking

### How Costs Are Calculated

Token costs use **org-discounted rates** (verified against Anthropic billing):

| Model | Input/1M | Cache Read/1M | Cache Write/1M | Output/1M |
|-------|---------|---------------|----------------|-----------|
| Claude Opus 4.6 | $5.00 | $0.50 | $6.25 | $25.00 |
| Claude Sonnet 4.6 | $1.00 | $0.10 | $1.25 | $5.00 |
| Claude Haiku 4.5 | $0.27 | $0.027 | $0.33 | $1.33 |

These are ~1/3 of published rates (enterprise volume discount). The `estimateCostFromTokens()` function in server.js is the canonical cost calculator.

### ROI Framework

Ed's core KPI: **Value = Throughput + Time Saved**

- **Throughput**: How many tasks get done per day/week
- **Time Saved**: Hours Ed didn't have to spend
- **Cost Per Task**: Total tokens × rate, grouped by category

Categories:
- **Ed's Tasks** (user-generated): Work for Ed — core value metric
- **Routine** (automated): Inbox scans, heartbeats, cron jobs — low cost (Haiku)
- **Developer**: Dashboard fixes, config, infrastructure — investment cost (Sonnet)

### Dashboard Cost Cards

The ROI tab's 3 category cards use real token consumption from the OpenClaw session tracker (not self-reported). Session mapping:

| Session Pattern | Category |
|----------------|----------|
| `:cron:` | Routine |
| Ed DM (`ir_hmsaaaae`) | User (Ed's Tasks) |
| Ron DM (`79zumsaaaae`) | Developer |
| Jewel DM (`kbbx1saaaae`) | Developer |
| Group chat | Developer |
| Everything else | Routine |

---

## React Dashboard

### Tech Stack
- React 19 + Vite 8
- No component library — custom CSS with CSS variables for theming
- Single-page app with tab navigation
- Auth: Bearer token stored in localStorage

### Tab Structure

| Tab | Component | Data Source |
|-----|-----------|-------------|
| Dashboard | DashboardTab | Google Sheets + activities |
| Master Board | MasterBoardTab | Google Sheets (Master) |
| Task Acceptance | AcceptanceTab | Google Sheets (Task Acceptance) |
| Decisions | DecisionsTab | Google Sheets (DECISIONS) |
| Company | CompanyTab | Google Sheets |
| Team | TeamTab | Google Sheets |
| ROI | RoiTab | Anthropic API + activities |
| Relationships | RelationshipsTab | Google Sheets |
| Trends | TrendsTab | Cost history API |
| Database | DatabaseTab | PostgreSQL |

### Database Tab Sub-Views

- **📊 Activities**: Categorized activity feed (Ed/Developer/Routine) with expandable rows, cost breakdowns, and time-saved metrics
- **💬 Conversations**: Auto-captured messages grouped by session, displayed as chat bubbles with sender badges, model info, and per-exchange cost
- **📋 Tasks**: Explicit task tracker with status management (open/in_progress/done/cancelled), New Task modal, and filter bar

---

## Deployment

### Infrastructure
- **Host**: AWS EC2 (Ubuntu, `ip-172-31-19-180`)
- **Database**: AWS RDS PostgreSQL — `bb-agents-shared-db.cpsqyxgezuwr.us-east-2.rds.amazonaws.com` (bb_agents) and `smt-db.c5vzhv0mqgjy.us-east-1.rds.amazonaws.com` (smt_db, shared with `smt-api`)
- **Web Server**: Nginx (reverse proxy `/api/` → Express on port 3100, `/app/` → static build)
- **Process Manager**: systemd **system** service (`laura-dashboard-api.service`, not a user service) — `Restart=on-failure`, survives reboots and (critically) lives outside any CI job's process tree
- **CI/CD**: GitHub Actions self-hosted runner, registered on this same EC2 instance
- **Agent Runtime**: OpenClaw Gateway (systemd user service)

### Services

| Service | Type | Purpose |
|---------|------|---------|
| `openclaw-gateway.service` | systemd user | Agent runtime + plugin host |
| `laura-dashboard-api.service` | systemd **system** | Express API + dashboard serving (`/var/www/laura-dashboard/api`) |
| GitHub Actions self-hosted runner | systemd system | Picks up `.github/workflows/deploy.yml` on push to `main` |

### Build & Deploy

Deploys are automatic: pushing to `main` triggers `.github/workflows/deploy.yml` on the self-hosted
runner, which:
1. Checks out the repo into the runner's own workspace.
2. **`rsync`s** the checked-out `api/` and `app/` into `/var/www/laura-dashboard/{api,app}` — this
   step is load-bearing; without it, every later step just rebuilds/restarts whatever code already
   happened to be sitting in those directories, regardless of what was pushed. (This was broken for
   an unknown period before 2026-07-15 — every deploy reported success while silently deploying
   nothing. If a change mysteriously isn't live, this is the first thing to check.)
3. Writes `/var/www/laura-dashboard/api/.env` from repo variables/secrets.
4. `npm install` (api) and `npm install && npm run build` (app).
5. Copies `app/dist/*` into the web root (`/var/www/laura-dashboard/`).
6. Restarts the API via `sudo systemctl restart laura-dashboard-api` — **not** a raw
   `nohup node server.js &`. A backgrounded process started inside a job step gets killed by the
   runner's own post-job orphan-process cleanup even with `disown`; only a real systemd service
   (or something equally detached from the job's process tree) survives.

Manual deploy (rarely needed — pushing to `main` is the normal path):
```bash
cd /var/www/laura-dashboard/api && npm install --omit=dev
cd /var/www/laura-dashboard/app && npm install && npm run build
cp -r dist/* /var/www/laura-dashboard/
sudo systemctl restart laura-dashboard-api
```

### Git Workflow

```bash
git add -A
git commit -m "descriptive message"
git push origin main
```

Branch: `main` (production, auto-deploys). All changes must be pushed — the change is not done
until it's in GitHub *and* the resulting deploy run has actually succeeded (check `gh run list`).

---

## File Structure

```
/var/www/laura-dashboard/
├── api/
│   ├── server.js              # Main Express API (all endpoints)
│   ├── auto-cost-tracker.js   # Polls Anthropic Admin API (5min cron)
│   ├── session-tracker.cjs    # Session-level cost tracking
│   ├── daily-log-sync.cjs     # Memory → activity sync
│   ├── sheet-sync.cjs         # Google Sheets data sync
│   ├── master-sync.cjs        # Master board sync
│   ├── .env                   # Environment variables (PG, auth, API keys) — written by the deploy
│   │                            workflow, not checked into git
│   └── data/                  # JSON state files
├── plugins/
│   └── laura-tracker/          # OpenClaw plugin (source copy)
│       ├── openclaw.plugin.json
│       └── index.ts
├── app/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/tabs/   # All tab components
│   │   ├── hooks/             # Data fetching hooks
│   │   └── utils/             # Helpers
│   └── dist/                  # Built by `npm run build`, then copied into the web root above it
├── docs/
│   ├── ARCHITECTURE.md        # This file
│   └── PLUGIN.md              # laura-tracker plugin docs
├── nginx-api.conf             # Nginx config
└── laura-dashboard-api.service # systemd unit — installed at /etc/systemd/system/, not this path
```

`/var/www/laura-dashboard/api-server` and `/var/www/laura-dashboard/react-dashboard` may still exist
on disk as leftovers from before a project restructure — they're dead, not served by anything, and
not touched by the deploy pipeline. Ignore them; `api/` and `app/` are current.

### Plugin Location (runtime)

```
~/.openclaw/extensions/laura-tracker/
├── openclaw.plugin.json       # Plugin manifest
└── index.ts                   # Plugin code (loaded by jiti)
```

Registered in `~/.openclaw/openclaw.json`:
```json
{
  "plugins": {
    "entries": {
      "laura-tracker": { "enabled": true }
    },
    "load": {
      "paths": ["/home/ubuntu/.openclaw/extensions/laura-tracker"]
    }
  }
}
```

---

## Known Incidents

### 2026-07: Manually-added sandbox campaigns silently disappearing (resolved)

**Symptom:** campaigns added by hand in the Campaign Performance sandbox vanished from both the
dashboard and the database within a day of being added.

**Root cause — two independent bugs that compounded:**

1. **`sales.dashboard_campaigns` is a table shared with a separate service, `smt-api`**, which runs
   its own Skylead sync 3x/day. Its sync job unconditionally ran
   `DELETE FROM sales.dashboard_campaigns WHERE account_id = $1` for every account before
   re-inserting fresh data — wiping out any manually-added row under that same `account_id`,
   regardless of whether it came from Skylead at all. This app's own sync
   (`POST /api/skylead/trigger-sync`) was never at fault — it's always been a pure
   `INSERT ... ON CONFLICT DO UPDATE` that never deletes.
2. **The deploy pipeline (see Deployment above) was silently not deploying anything** for an unknown
   period before 2026-07-15 — `actions/checkout` populated the runner's workspace but nothing copied
   it into `/var/www/laura-dashboard/`, so every "successful" deploy just rebuilt and restarted
   stale code. This meant early fix attempts appeared to ship but never actually reached production,
   which is why this took multiple rounds to actually resolve — always verify a fix reached
   production (`gh run list`, then hit the endpoint) rather than trusting a green deploy.

**Fix, in this repo:**
- `sales.dashboard_campaigns.is_manual` (boolean, default `false`) is the authoritative way to
  identify a manually-added row — **not** the sign or size of `campaign_id`. This app's manual-add
  endpoint (`POST /api/sales-dashboard/campaigns`) sets it explicitly and pulls the ID from
  `sales.manual_campaign_id_seq` (starts at 1,000,000,000, safely disjoint from Skylead's ~300k–450k
  range).
- `sales.dashboard_campaigns_audit` logs every delete that goes through this app's own
  `DELETE /api/sales-dashboard/campaigns/:id`, with the caller's identity — see
  `GET /api/sales-dashboard/campaigns/audit`.
- A Postgres trigger, `trg_protect_manual_campaigns` (`BEFORE DELETE ON sales.dashboard_campaigns`),
  rejects deleting any `is_manual = true` row unless the deleting transaction explicitly sets
  `SET LOCAL app.allow_manual_campaign_delete = 'true'` — only this app's DELETE endpoint does that.
  This protects against *any* writer with DB credentials, not just this app's own code, which
  matters precisely because the table is shared.

**Fix, in `smt-api`:** its sync's delete now excludes `is_manual = true` rows, and its own
`POST /campaigns` insert/edit path sets `is_manual` once at insert time and never recomputes it on
edit (an earlier version derived it from `campaign_id < 0` on every edit/upsert, which would have
silently un-protected this app's positive-ID rows the first time anyone edited them there).

**Takeaway for future changes to this table:** `sales.dashboard_campaigns` has at least one other
writer outside this repo. Before changing anything about how manual rows are identified or
protected, check what's actually live on the database directly (`information_schema`, `pg_trigger`,
`pg_sequences`) rather than trusting either this repo's or `smt-api`'s committed schema files — both
have drifted from the live schema before without anyone noticing until data started disappearing.
