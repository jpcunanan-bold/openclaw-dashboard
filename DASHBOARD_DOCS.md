# Bold Business — Laura Dashboard
## Complete Documentation for Agents & Operators

**Last updated:** 2026-07-10  
**Maintained by:** Ron Rivero / Alex Olivar  
**Purpose:** Reference for connecting an OpenClaw agent to read or edit this dashboard programmatically.

---

## 1. Dashboard Overview

The Laura Dashboard is a full-stack web app running on EC2. It tracks AI SDR agent performance, outreach campaigns, contacts, cost/ROI, campaign briefs, and task management across multiple Bold Business agents.

| Property | Value |
|---|---|
| **Public URL** | `https://openclaw.boldbusiness.com/app/` |
| **API base URL** | `https://openclaw.boldbusiness.com/api/` |
| **API internal** | `http://127.0.0.1:3100` |
| **Auth required** | Yes (Google SSO or Agent Secret header) |
| **Stack** | Node.js + Express (API) · React + Vite (frontend) · PostgreSQL (data) |

---

## 2. Authentication

### For Agents (no browser login needed)

All API calls from an agent must include this header:

```
x-agent-secret: 391e1c99222c1bb4c06197bd2ff4a69a22412a11f38d2dac
```

This bypasses Google SSO and grants full API access. Keep this secret.

**Example curl:**
```bash
curl -H "x-agent-secret: 391e1c99222c1bb4c06197bd2ff4a69a22412a11f38d2dac" \
     https://openclaw.boldbusiness.com/api/health
```

**Example fetch (JavaScript):**
```js
const headers = { 'x-agent-secret': '391e1c99222c1bb4c06197bd2ff4a69a22412a11f38d2dac', 'Content-Type': 'application/json' };
const res = await fetch('https://openclaw.boldbusiness.com/api/campaign-briefs', { headers });
```

### For Users (browser)
Google SSO via `@boldbusiness.com` account. Token returned as a session token stored in Postgres, sent as `Authorization: Bearer <token>`.

---

## 3. Connected External Tools & Databases

### 3.1 PostgreSQL Databases

| Pool | Host | Database | Used For |
|---|---|---|---|
| `pgPool` | BB Agents RDS (us-east-2) | `laura` (local EC2) | Activities, tasks, cost snapshots, chat sessions |
| `bbPool` | `bb-agents-shared-db.cpsqyxgezuwr.us-east-2.rds.amazonaws.com` | `bb_agents` | Multi-agent shared DB (Laura, Darren, Zara, Camilla tasks + activities) |
| `smtPool` | `smt-db.c5vzhv0mqgjy.us-east-1.rds.amazonaws.com` | `smt_db` | Recruiter goals, activities (read-only) |
| `smtAdminPool` | same smt-db host | `smt_db` | Sales campaigns, briefs, call records, user tasks (full write access) |

### 3.2 External APIs

| Service | Purpose | Key/Token location |
|---|---|---|
| **Skylead** | LinkedIn outreach stats sync | Hardcoded in server.js: `ad7f28c6-58f1-4312-a133-10e34cc1b4b4` |
| **HubSpot** | Follow-up CRM data | `HUBSPOT_TOKEN` env var · Portal ID: `40970945` |
| **Anthropic Admin API** | Cost tracking / usage reports | `ANTHROPIC_ADMIN_API_KEY` in `/var/www/laura-dashboard/api-server/.env` |
| **Google Sheets** | Contact data sync (CET, Estimators, BIM, SC/PM tabs) | `gog` CLI · account: `lpetersen@boldbusiness.com` |
| **Google OAuth** | User authentication | `GOOGLE_CLIENT_ID` env var |

### 3.3 Key Database Tables

| Table | Database | Purpose |
|---|---|---|
| `sales.dashboard_campaigns` | smt_db | Skylead campaign stats (synced automatically) + manually-added sandbox campaigns (negative IDs) |
| `sales.campaign_briefs` | smt_db | Campaign brief planning content (ICP, personas, hook, value prop, sequence steps) |
| `sales.dashboard_call_records` | smt_db | Call logs tied to campaigns |
| `sales.dashboard_skylead_ids` | smt_db | SDR account ID → name mapping (Skylead accounts) |
| `users.user_tasks` | smt_db | Task list per user |
| `users.users` | smt_db | User records (email → user_id) |
| `laura.activities` | bb_agents | Laura agent activity log |
| `laura.tasks` | bb_agents | Laura agent task board |
| `laura.contacts` | bb_agents | Laura contacts DB |
| `laura.cost_snapshots` | bb_agents | Per-day cost tracking |

---

## 4. Dashboard Sections & Tabs

The dashboard has two top-level modes: **Sales** and **Recruiting**.

### Sales Mode Tabs
| Tab | ID | What it shows |
|---|---|---|
| Overview | `overview` | Command Center: SDR stats, campaign performance, campaign briefs, task list |
| Contacts | `contacts` | Lead contacts database with campaign tags |
| Blacklist | `blacklist` | Do-not-contact list |

### Recruiting Mode Tabs (Laura)
| Tab | ID | What it shows |
|---|---|---|
| Dashboard | `dashboard` | Agent overview + KPIs |
| CET | `cet` | CET Designer contacts from Google Sheets |
| Estimators | `estimators` | Estimator contacts |
| SC/PM | `scpm` | Sales Coordinator / PM contacts |
| BIM | `bim` | BIM Modeler contacts |
| ROI | `roi` | ROI calculator |
| Activities & Costs | `activities` | Agent activity log + cost breakdown |
| Tasks | `tasks` | Laura's task board |
| Costs | `costs` | Detailed cost history |

### Recruiting Mode Tabs (Darren)
| Tab | ID | What it shows |
|---|---|---|
| Dashboard | `dashboard` | Darren agent overview |
| DWDM Companies | `dwdm` | DWDM outreach company list |
| DWDM Outreach Plan | `dwdm_outreach` | Outreach plan |
| DWDM Task Plan | `dwdm_tasks` | Task plan |
| BEAD | `bead` | BEAD program contacts |
| DC Contacts | `dc` | Data Center contacts |
| DC All Projects | `dc_projects` | DC project list |
| DC Job Demand | `dc_jobs` | DC job demand data |
| DC Fiber Roles | `dc_fiber` | Fiber roles |
| ROI | `roi` | ROI |
| Activities & Costs | `activities` | Darren activity log |
| Tasks | `tasks` | Darren task board |
| Costs | `costs` | Cost history |
| Analytics | `analytics` | Analytics view |

---

## 5. Full API Reference

All endpoints require `x-agent-secret` header (see Section 2).  
Base URL: `https://openclaw.boldbusiness.com/api`

---

### 5.1 Health

```
GET /api/health
→ { ok: true, uptime: <seconds> }
```

---

### 5.2 Campaign Performance Sandbox

These endpoints power the **Campaign Performance Sandbox** section (Skylead outreach stats).

#### Get sandbox campaign stats
```
GET /api/skylead/sandbox?period=<period>&startDate=<YYYY-MM-DD>&endDate=<YYYY-MM-DD>
```
- `period`: `today` | `7d` | `30d` | `all` (default: `all`)
- `startDate` / `endDate`: custom range (overrides period)

Response:
```json
{
  "ok": true,
  "period": "7d",
  "campaigns": [
    {
      "name": "7/8/26-CET-T2-LI-ConnReq",
      "target_icp": "",
      "channel": "LinkedIn + Email",
      "agents": [
        {
          "agent": "Laura Petersen",
          "account_id": 32891,
          "campaign_id": 408814,
          "cr_sent": 120,
          "cr_accepted": 18,
          "replies": 4,
          "calls": 0,
          "actual_meetings": 0,
          "emails": 0,
          "accept_pct": "15%",
          "reply_pct": "3.3%"
        }
      ],
      "totals": { "cr_sent": 120, "cr_accepted": 18, "replies": 4, ... },
      "key_metric": "3.3% reply rate",
      "reply_pct": 3.33
    }
  ]
}
```

#### Add a manual sandbox campaign
```
POST /api/sales-dashboard/campaigns
Body: {
  "campaign_name": "7/10/26-CET-Email3",   // required
  "account_id": 32891,                       // required — see SDR account IDs below
  "activity": "Email",                       // optional
  "target_icp": "CET Designers",            // optional
  "channel": "LinkedIn + Email",            // optional
  "connections_requested": 0,               // optional
  "connection_requests_accepted": 0,        // optional
  "connection_replies": 0,                  // optional
  "emails_sent": 150,                       // optional
  "created_at": "2026-07-10"               // optional, defaults to today
}
→ { campaign_id: -1, campaign_name: "...", ... }
```

**SDR Account IDs:**
| SDR | account_id |
|---|---|
| Lenore Kopko | 32871 |
| Abhinanda Deb | 32887 |
| Vernalyn Puno | 32889 |
| Elaine B. | 32890 |
| Laura Petersen | 32891 |
| Darren Stuart | 32893 |
| George Georgiou | 32894 |
| Bob Toll | 33347 |
| Cathy Guazon | 33361 |
| Mariana Lopez | 33364 |

#### Edit a campaign
```
PATCH /api/sales-dashboard/campaigns/:campaign_id
Body: same fields as POST
```

#### Delete a campaign
```
DELETE /api/sales-dashboard/campaigns/:campaign_id
→ { ok: true }
```

#### Trigger Skylead sync (refresh live stats from Skylead API)
```
POST /api/skylead/trigger-sync
→ { ok: true, message: "Skylead sync started in background." }
```

#### Get all Skylead campaign names
```
GET /api/skylead/campaign-names?account_id=32891
→ { names: ["7/8/26-CET-T2-LI...", ...] }
```

---

### 5.3 Campaign Briefs

These endpoints power the **Campaign Brief** section (planning content — ICP, personas, hook, sequence).

#### Get all campaign briefs
```
GET /api/campaign-briefs
→ {
  ok: true,
  briefs: [
    {
      "campaign_id": 1,
      "campaign_name": "RCM Specialist",
      "target_icp": "Hospitals, Health Systems & ASCs",
      "channel": "LinkedIn + Email",
      "assignee": "Laura",
      "sort_order": 1,
      "brief_json": {
        "sdr": "Laura",
        "color": "#4D8DFF",
        "title": "RCM Specialist",
        "sub": "Hospitals...",
        "hook": "...",
        "valueProp": "...",
        "personas": ["VP of Revenue Cycle", "..."],
        "signals": ["Job postings for RCM", "..."],
        "icp": [{ "label": "Industry", "value": "Healthcare" }, ...],
        "sequence": [
          { "n": "1", "title": "LinkedIn CR + Note", "meta": "Day 1", "subject": "", "body": "..." },
          ...
        ]
      }
    }
  ]
}
```

#### Create a new campaign brief
```
POST /api/campaign-briefs
Body: {
  "campaign_name": "New Campaign Title",   // required
  "target_icp": "Segment description",
  "assignee": "Laura",                     // Laura | Darren | Abhinanda | Lenore | etc.
  "account_id": 32891,
  "channel": "LinkedIn + Email",
  "brief_json": {
    "sdr": "Laura",
    "color": "#06E5EC",
    "hook": "Pain statement here",
    "valueProp": "Bold Business solution here",
    "personas": ["VP of Operations", "Director of..."],
    "signals": ["Job posts for...", "LinkedIn: companies hiring..."],
    "icp": [
      { "label": "Industry", "value": "AEC" },
      { "label": "Company Size", "value": "50-500" },
      { "label": "Geography", "value": "US + Canada" },
      { "label": "Trigger", "value": "Currently hiring" }
    ],
    "sequence": [
      { "n": "1", "title": "LinkedIn CR + Note", "meta": "Day 1", "subject": "", "body": "Hi [First Name]..." },
      { "n": "2", "title": "Email - Value prop", "meta": "Day 3", "subject": "Subject line", "body": "..." },
      { "n": "3", "title": "LinkedIn follow-up", "meta": "Day 7", "subject": "", "body": "..." },
      { "n": "4", "title": "Final email - CTA", "meta": "Day 14", "subject": "...", "body": "..." }
    ]
  }
}
→ { ok: true, brief: { campaign_id: 18, ... } }
```

#### Edit a campaign brief
```
PATCH /api/campaign-briefs/:id
Body: same fields as POST (all optional — only sends what changed)
→ { ok: true, brief: { ... } }
```

#### Reorder campaign briefs (drag-and-drop order)
```
POST /api/campaign-briefs/reorder
Body: {
  "order": [
    { "id": 1, "sort_order": 1 },
    { "id": 3, "sort_order": 2 },
    { "id": 2, "sort_order": 3 }
  ]
}
→ { ok: true }
```

#### Delete a campaign brief (soft-delete — won't come back on refresh)
```
DELETE /api/campaign-briefs/:id
→ { ok: true }
```

#### Seed built-in campaigns (idempotent — skips titles already in DB)
```
POST /api/campaign-briefs/seed-builtin
Body: {
  "campaigns": [
    { "title": "CET Designer", "sub": "Commercial Furniture...", "sdr": "Laura", "color": "#06E5EC", "sort_order": 1 }
  ]
}
→ { ok: true, inserted: 1, skipped: 0 }
```

---

### 5.4 Task List

Tasks per logged-in user. For agent calls, user is resolved by email from the session. To create tasks for a specific user from an agent, use `POST /api/user-tasks` — the `user_id` is resolved from the authenticated session's email.

#### Get tasks
```
GET /api/user-tasks?status=<status>&limit=200
- status: pending | captured | done | dismissed | all (default: all)
→ { ok: true, tasks: [...], user_id: 17 }
```

#### Create a task
```
POST /api/user-tasks
Body: {
  "description": "Task title / name",          // required
  "details": "More detail or notes here",      // optional — shows as second line in table
  "status": "pending",                         // pending | captured | done | dismissed
  "task_type": "Next Action",                  // Next Action | Project
  "horizon": "Ground",                         // Ground | Horizon 1-5
  "accountable_person": "JP",                  // optional
  "due_date_suggestion": "2026-07-15",         // optional
  "priority_score": 80                         // optional, 0-100
}
→ { ok: true, task: { id: 42, ... } }
```

#### Edit a task
```
PATCH /api/user-tasks/:id
Body: same fields as POST (all optional)
→ { ok: true, task: { ... } }
```

#### Delete a task
```
DELETE /api/user-tasks/:id
→ { ok: true }
```

---

### 5.5 Activities (Agent Activity Log)

#### Log an activity (Laura or Darren)
```
POST /api/activities
Body: {
  "agentId": "laura",           // laura | darren
  "title": "Lead gen: 10 contacts found",
  "category": "lead-gen",       // lead-gen | outreach | enrichment | data-hygiene | research | follow-up | handoff | admin
  "requestedBy": "Abhinanda",
  "actions": ["Searched Apollo", "Enriched contacts"],
  "timeSavedMin": 30,
  "model": "claude-sonnet-4-6",
  "inputTokens": 1200,
  "outputTokens": 400
}
→ { ok: true, id: "..." }
```

#### Get recent activities
```
GET /api/pg/activities?agent=laura&limit=20
→ { activities: [...] }
```

---

### 5.6 Agent Tasks (Board)

Laura/Darren task board (separate from user task list above).

#### Get tasks
```
GET /api/bb/tasks?agent=laura&limit=20
→ { tasks: [...] }
```

#### Create task
```
POST /api/bb/tasks
Body: {
  "agentId": "laura",
  "title": "Research 10 CET leads",
  "category": "lead-gen",
  "status": "queued",           // queued | in_progress | done | blocked
  "requestedBy": "Abhinanda"
}
```

#### Update task
```
PATCH /api/bb/tasks/:id
Body: { "status": "done" }
```

---

### 5.7 Contacts

#### Get contacts
```
GET /api/contacts?campaign=CET+Designers&limit=100&offset=0&agent=laura
→ { contacts: [...], total: 328 }
```

#### Update contact
```
PATCH /api/contacts/:id
Body: { "email": "...", "title": "...", "linkedin": "..." }
```

#### Blacklist a contact
```
PUT /api/contacts/:id/blacklist
Body: { "reason": "Declined outreach" }
```

---

### 5.8 SDR / Skylead Stats

#### Overall stats (top KPI cards)
```
GET /api/skylead/stats?period=7d
→ { total_campaigns, total_contacts, total_replies, total_meetings, ... }
```

#### Per-SDR breakdown table
```
GET /api/skylead/sdr-summary?period=7d
→ { agents: [{ name, cr_sent, cr_accepted, replies, campaigns, ... }] }
```

#### Campaign leads (replies list for a campaign)
```
GET /api/skylead/campaign-leads?campaignId=408814&accountId=32891
→ { leads: [...] }
```

#### Lead thread (full message thread for a lead)
```
GET /api/skylead/lead-thread?leadId=<id>&campaignId=<id>&accountId=32891
→ { thread: [...] }
```

---

### 5.9 Call Records

#### Log a call
```
POST /api/sales-dashboard/call-records
Body: {
  "campaign_name": "7/8/26-CET-T2",
  "account_id": 32891,
  "contact_name": "John Smith",
  "contact_title": "VP of Operations",
  "contact_company": "Acme Furniture",
  "contact_linkedin": "https://linkedin.com/in/...",
  "call_date": "2026-07-10",
  "outcome": "Completed",       // Completed | No Answer | Voicemail | Rescheduled
  "notes": "Interested, follow up next week"
}
```

#### Edit a call record
```
PATCH /api/sales-dashboard/call-records/:id
Body: same fields
```

#### Delete a call record
```
DELETE /api/sales-dashboard/call-records/:id
```

---

### 5.10 Cost & ROI

#### Today's cost
```
GET /api/cost/today
→ { costUsd: 12.45, inputTokens: 500000, outputTokens: 200000 }
```

#### Cost history (last N days)
```
GET /api/cost/history?days=14
→ { series: [{ date, costTotal, byModel: {...}, label, tasks }] }
```

---

### 5.11 HubSpot Follow-Ups
```
GET /api/hubspot/followups
→ { followUps: [{ name, company, hs_url, date, note }] }
```

---

### 5.12 Meetings Breakdown
```
GET /api/skylead/meetings-breakdown?period=30d
→ { breakdown: [...] }
```

---

## 6. Agent Access Levels — Three Ways to Connect

There are three distinct levels of access you can give another agent.
Choose based on what they actually need to do.

---

### Level 1 — Data Access Only (read/write dashboard data via API)
**What they can do:** Read and write all dashboard data — campaigns, briefs, tasks, activities, call records, contacts.
**What they cannot do:** Edit source code files, rebuild the frontend, restart the API.
**Good for:** Agents on a different machine/EC2 that just need to interact with data.

**Setup — give the agent these two values:**
```
LAURA_DASHBOARD_SECRET=391e1c99222c1bb4c06197bd2ff4a69a22412a11f38d2dac
LAURA_DASHBOARD_URL=https://openclaw.boldbusiness.com/api
```

Store them in the agent's `.secrets.md`:
```markdown
## Laura Dashboard
LAURA_DASHBOARD_URL=https://openclaw.boldbusiness.com/api
LAURA_DASHBOARD_SECRET=391e1c99222c1bb4c06197bd2ff4a69a22412a11f38d2dac
```

**How to call the API:**
```bash
# GET — read campaign briefs
curl -H "x-agent-secret: 391e1c99222c1bb4c06197bd2ff4a69a22412a11f38d2dac" \
     https://openclaw.boldbusiness.com/api/campaign-briefs

# POST — create a task
curl -X POST \
     -H "x-agent-secret: 391e1c99222c1bb4c06197bd2ff4a69a22412a11f38d2dac" \
     -H "Content-Type: application/json" \
     -d '{"description":"Research BEAD leads","status":"pending","details":"Focus on Texas ISPs"}' \
     https://openclaw.boldbusiness.com/api/user-tasks

# POST — log an activity
curl -X POST \
     -H "x-agent-secret: 391e1c99222c1bb4c06197bd2ff4a69a22412a11f38d2dac" \
     -H "Content-Type: application/json" \
     -d '{"agentId":"laura","title":"Enriched 15 CET contacts","category":"enrichment","requestedBy":"Abhinanda","timeSavedMin":20}' \
     https://openclaw.boldbusiness.com/api/activities
```

**Full list of what Level 1 can do:**
| Action | Endpoint |
|---|---|
| Read campaign performance | GET /api/skylead/sandbox |
| Add manual sandbox campaign | POST /api/sales-dashboard/campaigns |
| Edit/delete sandbox campaign | PATCH/DELETE /api/sales-dashboard/campaigns/:id |
| Read campaign briefs | GET /api/campaign-briefs |
| Create/edit/delete briefs | POST/PATCH/DELETE /api/campaign-briefs/:id |
| Reorder briefs | POST /api/campaign-briefs/reorder |
| Read/create/edit/delete tasks | GET/POST/PATCH/DELETE /api/user-tasks/:id |
| Log activity | POST /api/activities |
| Read activities | GET /api/pg/activities |
| Log call record | POST /api/sales-dashboard/call-records |
| Read contacts | GET /api/contacts |
| Blacklist contact | PUT /api/contacts/:id/blacklist |
| Trigger Skylead sync | POST /api/skylead/trigger-sync |
| Read cost/ROI data | GET /api/cost/history |

**What Level 1 cannot do:**
- ❌ Edit source code files
- ❌ Rebuild the frontend (`npm run build`)
- ❌ Restart the API server
- ❌ Change Google Sheets data (use `gog` CLI on the EC2 instead)
- ❌ Send outreach (requires operator approval per TOOLS.md)
- ❌ Write directly to the database (must go through the API)

---

### Level 2 — Code Access (edit files + rebuild via this EC2)
**What they can do:** Everything in Level 1 PLUS edit source files, rebuild frontend, restart services.
**Requirement:** The agent must run on **this same EC2 instance** (as a second OpenClaw agent on the same machine), OR you give them SSH access.
**Good for:** An agent you want to maintain/extend the dashboard itself.

**Option A — Add as a second agent on this EC2**

Add the agent to `/home/ubuntu/.openclaw/openclaw.json` under `agents.list`:
```json
{
  "id": "your-agent-id",
  "name": "Agent Name",
  "workspace": "/home/ubuntu/.openclaw/agents/your-agent/workspace"
}
```

That agent then has full `exec`, `read`, `write`, `edit` tool access to the same filesystem, including:
```
/var/www/laura-dashboard/     ← dashboard source
/var/www/laura-dashboard/api/.env  ← all credentials
```

And can run:
```bash
# Edit source files
edit /var/www/laura-dashboard/app/src/components/tabs/CommandCenterOverview.jsx

# Rebuild frontend
cd /var/www/laura-dashboard/app && npm run build
cp /var/www/laura-dashboard/app/dist/index.html /var/www/laura-dashboard/index.html

# Restart API
sudo systemctl restart laura-dashboard-api
```

**Option B — SSH access from a remote agent**

Generate an SSH key for the agent and add the public key to this EC2:
```bash
# On this EC2 — add the agent's public key
echo "ssh-rsa AAAA... agent-name" >> /home/ubuntu/.ssh/authorized_keys
```

The remote agent then connects via:
```bash
ssh ubuntu@openclaw.boldbusiness.com "cd /var/www/laura-dashboard && git pull && npm run build"
```

---

### Level 3 — Own Fork (full independent copy via GitHub)
**What they can do:** Everything — their own copy of the dashboard on their own EC2, connected to their own database.
**Good for:** A completely separate agent/team that wants their own dashboard instance.
**How:** Fork the repo at `https://github.com/BoldBusiness/laura-dashboard` and follow `docs/FORK_SETUP.md`.

They need:
1. Their own EC2
2. Their own PostgreSQL DB (or use the shared `smt_db` with their own schema)
3. Their own GitHub Secrets set (all values in `docs/FORK_SETUP.md`)
4. Their own `AGENT_SECRET` generated fresh: `openssl rand -hex 20`

---

### Which level should you choose?

| Scenario | Level |
|---|---|
| Agent needs to read/write data, runs on different machine | **1** |
| Agent needs to maintain/extend this dashboard's code | **2** |
| Agent/team wants their own independent dashboard | **3** |
| Agent just needs to log activities or check campaign data | **1** |
| Agent needs to add new tabs or change the UI | **2 or 3** |

---

## 7. File Structure

```
/var/www/laura-dashboard/
├── api/
│   └── server.js          # All API endpoints (Express)
├── app/
│   ├── src/
│   │   └── components/
│   │       ├── tabs/
│   │       │   ├── CommandCenterOverview.jsx   # Main sales overview + campaign sandbox + campaign briefs + task list
│   │       │   ├── CETTab.jsx                 # CET contacts
│   │       │   ├── PipelineTab.jsx            # Pipeline
│   │       │   ├── RoiTab.jsx                 # ROI calculator
│   │       │   ├── DarrenDashboardTab.jsx     # Darren overview
│   │       │   └── ...
│   │       ├── TabNav.jsx                     # Tab navigation
│   │       └── LoginGate.jsx                  # Auth wrapper
│   └── dist/                                  # Built frontend (served by nginx)
├── index.html                                 # Entry point (nginx serves this)
└── DASHBOARD_DOCS.md                          # This file
```

---

## 8. Key Identifiers Reference

### Agent IDs (for bb_agents DB)
| Agent | agent_id |
|---|---|
| Laura | `laura` |
| Darren | `darren` |
| Zara | `zara` |
| Org-level | `org` |

### Skylead SDR Account IDs
| SDR | account_id |
|---|---|
| Lenore Kopko | 32871 |
| Abhinanda Deb | 32887 |
| Vernalyn Puno | 32889 |
| Elaine B. | 32890 |
| Laura Petersen | 32891 |
| Darren Stuart | 32893 |
| George Georgiou | 32894 |
| Bob Toll | 33347 |
| Cathy Guazon | 33361 |
| Mariana Lopez | 33364 |

### Campaign Brief Colors
`#06E5EC` · `#4D8DFF` · `#8B7CF6` · `#F5B945` · `#f97316` · `#f43f5e` · `#a78bfa` · `#3B82F6` · `#2DD4BF` · `#ec4899`

---

## 9. Notes for Agent Developers

1. **Always use `x-agent-secret` header** — never try to simulate a Google login
2. **Campaign performance data is read-only** — Skylead syncs it automatically; you can only ADD manual campaigns (negative IDs), not overwrite Skylead data
3. **Campaign briefs are fully editable** — they live in `sales.campaign_briefs`, completely separate from performance data
4. **Task list is per-user** — the API resolves `user_id` from the session email; agent-created tasks will be owned by the agent session user
5. **Activity logging is mandatory** — after any meaningful action, POST to `/api/activities` so it shows in the dashboard feed
6. **Soft deletes on briefs** — deleted briefs set `is_deleted = true`, they don't actually disappear from the DB
7. **Negative campaign IDs** — manually-added sandbox campaigns always get negative `campaign_id` values; Skylead campaigns always have positive IDs

---

## 10. Direct Database Access (Level 2+ agents on this EC2)

If the agent runs on this EC2 and needs to query the DB directly (bypassing the API), use these connection strings. All credentials are in `/var/www/laura-dashboard/api/.env`.

### smt_db — campaigns, briefs, tasks (primary dashboard DB)
```bash
# Read-write (recruiter schema)
psql "host=smt-db.c5vzhv0mqgjy.us-east-1.rds.amazonaws.com port=5432 dbname=smt_db user=lola_readwrite password=lolapassword sslmode=require"

# Admin (sales schema — campaigns, briefs, call records)
psql "host=smt-db.c5vzhv0mqgjy.us-east-1.rds.amazonaws.com port=5432 dbname=smt_db user=postgres password=FeCvAStpTtNcrtQfqGeW sslmode=require"
```

### bb_agents — multi-agent shared DB (activities, tasks, cost snapshots)
```bash
psql "host=bb-agents-shared-db.cpsqyxgezuwr.us-east-2.rds.amazonaws.com port=5432 dbname=bb_agents user=agent_writer password=<BB_AGENTS_PASSWORD> sslmode=require"
```

### Key schemas and tables to know
```sql
-- Campaign performance (Skylead sync + manual adds)
SELECT * FROM sales.dashboard_campaigns WHERE campaign_id < 0;  -- manual only
SELECT * FROM sales.dashboard_campaigns WHERE campaign_id > 0;  -- Skylead only

-- Campaign briefs (planning content)
SELECT id, title, assignee, sort_order FROM sales.campaign_briefs WHERE is_deleted = false;

-- Call records
SELECT * FROM sales.dashboard_call_records ORDER BY created_at DESC LIMIT 20;

-- User tasks
SELECT t.* FROM users.user_tasks t JOIN users.users u ON t.user_id = u.id WHERE u.email = 'adeb@boldbusiness.com';

-- Laura activities
SELECT * FROM laura.activities ORDER BY created_at DESC LIMIT 20;

-- Laura task board
SELECT * FROM laura.tasks WHERE status != 'done' ORDER BY created_at DESC;
```

### Using the Python scripts (on this EC2)
The dashboard has ready-made scripts for common DB operations:
```bash
# Log an activity
python3 /home/ubuntu/.openclaw/workspace/scripts/log_activity.py \
  --title "Task completed" \
  --category admin \
  --requested-by Abhinanda \
  --time-saved 10

# Check task board
python3 /home/ubuntu/.openclaw/workspace/scripts/step_zero.py

# Log a Darren task
python3 /home/ubuntu/.openclaw/workspace/scripts/log_darren_task.py
```
