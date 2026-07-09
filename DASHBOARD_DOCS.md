# Bold Business Sales Dashboard — Configuration & Architecture Reference

## Overview
Dual-agent sales dashboard for Bold Business (Laura) and Mercury Z (Darren).
Live at: https://openclaw.boldbusiness.com/app/

---

## Infrastructure

### Services
- laura-dashboard-api.service — Production API, port 3100, WorkDir: /var/www/laura-dashboard/api
- laura-dashboard-staging.service — Staging API, port 3101, WorkDir: /var/www/laura-dashboard-staging/api
- Health check: GET /api/health → 200

### Nginx
- Config: /etc/nginx/sites-enabled/openclaw.conf
- /app/ → /var/www/laura-dashboard/app/dist
- /staging/ → /var/www/laura-dashboard-staging/app/dist-staging
- /api/ → proxy_pass http://127.0.0.1:3100
- /staging-api/ → proxy_pass http://127.0.0.1:3101

### Build Commands
```
# Production frontend
cd /var/www/laura-dashboard/app && npm run build

# Staging frontend  
cd /var/www/laura-dashboard-staging/app && npm run build -- --config vite.staging.config.js

# Restart services
sudo systemctl restart laura-dashboard-api
sudo systemctl restart laura-dashboard-staging
```

---

## Authentication

### Method
Google OAuth (One Tap) — @boldbusiness.com domain required.

### Allowed emails (set in .env)
adeb@boldbusiness.com, lkopko@boldbusiness.com, rrivero@boldbusiness.com,
ekopko@boldbusiness.com, aolivar@boldbusiness.com, mnurunnabi@boldbusiness.com, jcunanan@boldbusiness.com

### Session storage
Postgres table: dashboard_sessions (token, email, name, expires_at)
Sessions survive service restarts. 8-hour expiry. Written on Google login.

### Staging bypass
AUTH_TOKEN=boldstaging2026 — Bearer token accepted in staging only.

### Token key (IMPORTANT)
LoginGate writes token to: laura_auth_token, cc_auth_token, authToken (all three keys)
Hooks read from: cc_auth_token || authToken
authHeaders() reads from: laura_auth_token

---

## API Route Security

### Auth-protected (all require Bearer token or Google session)
All /api/* routes except the whitelist below.

### Public whitelist (no auth required)
- GET  /api/health
- GET  /api/auth/config
- POST /api/auth/google
- GET  /api/auth/verify
- POST /api/activities      (internal agent logging)
- POST /api/tasks/cost      (internal agent logging)
- POST /api/messages        (internal plugin)
- POST /api/abhi/tasks      (internal agent logging)
- PATCH /api/abhi/tasks/:id (internal agent logging)

---

## Database

### Connection pools
- pgPool — Primary: bb-agents-shared-db, db=bb_agents, user=postgres (env: PG_HOST/USER/PASSWORD/DATABASE)
- bbPool — Shared agents: same host, db=bb_agents, user=agent_writer (env: BB_AGENTS_*)

### Key tables
- dashboard_sessions — Google OAuth sessions (restart-proof)
- dashboard_chat — Chat message history (session_id, sender, message, agent_id, cost_usd)
- chat_sessions — Chat session metadata (agent_id, user_id, title, message_count)
- abhi_tasks — All Laura/Darren tasks (agent_id: laura-abhi-agent / darren-abhi-agent)
- agent_activities — Activity log for analytics (cost, tokens, category)
- agent_cost_snapshots — Daily cost per agent (source: anthropic_api or dwdm-task-plan)
- table_layouts — Saved table column layouts per user per table_id

### No longer used
- contacts table (empty, all data comes from Google Sheets)
- agent_tasks table (has only ava-marketing-agent entries, not used by Laura/Darren)

---

## Google Sheets

### Laura sheet
ID: 1fnchheGNniLXEGLg0VgmLGhe6JuCiB82mW7COJH0eqQ
Tabs: CET Designers (row 11 headers), Estimators, BIM Modelers, Sales Coordinators - PMs
Combined: 797 contacts
Account: lpetersen@boldbusiness.com

### Darren sheet
ID: 1sP5lIYoCNFFU0xhh7SwWpTH_6L_EDO-ergHThYm4uGA
Tabs: DWDM Companies (A1), BEAD (A1), Copy of BEAD Winner (A1), DC - Contacts (A4),
      DC - All Projects (A4), DC - Job Demand (A2 headers/A3 data), DC - Fiber & Optical Roles (A5 headers/A6 data),
      DWDM Outreach Plan, DWDM Task plan, DWDM Dashboard, DC - Executive Summary
Combined: ~2,693 contacts across all campaigns

---

## Cost Tracking

### Laura cost
Source: Anthropic Admin API filtered by API key apikey_012UW196UNRYiNkbkTFdSJVb (Laura 2)
Endpoint: GET /api/cost/today → actualCostUsd, costByAgent

### Darren cost
Source: agent_cost_snapshots (seeded from DWDM Task Plan costs + anthropic_api snapshots Apr 1–19)
Note: Not a live Darren-specific API key — estimated from task data for recent dates.

### Combined cost label
DashboardTab combined strip shows "Combined AI Cost Today"

---

## Monitoring

### Dashboard health cron
Runs every 15 minutes via OpenClaw cron.
Checks: 8 endpoints, 2 services.
Alerts: Muhammad Nurunnabi (users/100268710252835442788) on failure.
Script: /home/ubuntu/.openclaw/workspace/scripts/dashboard_monitor.py

---

## Agent Logging

### Laura activities
Script: scripts/log_activity.py
Endpoint: POST https://oc-agent-edkopko-brio-rhodes.boldbusiness.com/api/activities
Agent ID: laura

### Darren activities
Script: scripts/log_darren_activity.py
Endpoint: POST http://127.0.0.1:3100/api/activities (local — routes to darren-abhi-agent)
Agent ID: darren-abhi-agent

### Task tracking
Script: scripts/task_tracker.py
Table: abhi_tasks (agent_id: laura-abhi-agent or darren-abhi-agent)

---

## Chat System

### Architecture
- Messages stored in: dashboard_chat table (Postgres)
- Session management: chat_sessions table
- AI model: claude-haiku-4-5 (cost-efficient for chat)
- Typing indicator: animated 3-dot bounce in AgentChat.jsx
- Markdown rendering: inline renderer in AgentChat.jsx (no external lib)
- Suggestion pills: context-aware per taskRef (defined in SUGGESTIONS map)
- Error display: red banner with dismiss button

### Endpoints
- GET  /api/chat/messages?taskRef=&since=
- POST /api/chat/message (body: sessionId, taskRef, message, agentName, taskContext)
- GET  /api/chat-sessions?agent=
- POST /api/chat-sessions
- GET  /api/chat-sessions/:id/messages

---

## Remaining Strategic Work (Queued for Tomorrow)

Cron reminder set for 2026-04-30 10:00 UTC. Plan:
1. Expert sub-agents: DevOps, FullStack, API, DB, Sheets, GitHub — wake on demand or error
2. Dashboard-change agent: responds to Abhi/Lenore/Alex, asks questions before executing
3. Auto-wake on any dashboard error → report if complex, fix if simple
4. Lowest-token strategy: Haiku for background, Sonnet for interactive, Opus only for escalation
5. Lock all configs → full documentation (this file)

---

Last updated: 2026-04-29 by Laura (automated session with Jewel/Muhammad Nurunnabi)
