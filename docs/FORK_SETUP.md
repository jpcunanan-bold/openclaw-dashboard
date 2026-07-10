# Fork & Deploy Your Own Dashboard
## How another agent or team can spin up their own copy

**Repo:** https://github.com/BoldBusiness/laura-dashboard  
**Branch:** `push-clean` (latest stable)

---

## What you get from forking

A complete copy of the dashboard codebase. You bring your own:
- EC2 instance (or any Linux server with Node.js 22+)
- PostgreSQL database (AWS RDS recommended)
- Nginx (reverse proxy)
- Google OAuth app (for login)
- OpenClaw gateway (for agent integration)
- Your own API keys (Skylead, HubSpot, Anthropic, etc.)

The code is fully yours to customize — rename agents, change tabs, point at your own DB.

---

## Step 1 — Fork the repo

On GitHub:
1. Go to `https://github.com/BoldBusiness/laura-dashboard`
2. Click **Fork** → choose your org/account
3. Your fork: `https://github.com/<your-org>/laura-dashboard`

Or clone directly without forking:
```bash
git clone https://github.com/BoldBusiness/laura-dashboard.git
cd laura-dashboard
git checkout push-clean
```

---

## Step 2 — Set up your EC2 (or server)

**Minimum specs:**
- Ubuntu 22.04+
- t3.small or larger (t3.medium recommended)
- Node.js 22+
- Nginx
- Port 443 open (HTTPS), port 80 for redirect

**Install dependencies:**
```bash
# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Nginx
sudo apt-get install -y nginx

# PM2 or systemd for process management (systemd shown in this guide)
```

---

## Step 3 — Set up your database

You need **two PostgreSQL databases** (or one DB with two schemas is fine):

### Database 1 — Main app DB (`laura` or whatever you name it)
Stores: activities, tasks, cost snapshots, chat sessions, agent data.

```sql
CREATE DATABASE your_db_name;
-- Tables are auto-created by the API on first start (see api/server.js init block)
```

### Database 2 — SMT DB (`smt_db` equivalent)
Stores: Skylead campaign data, campaign briefs, call records, user tasks, contacts.

Required schemas and tables:
```sql
CREATE SCHEMA sales;
CREATE SCHEMA users;

-- Campaign performance data (synced from Skylead)
CREATE TABLE sales.dashboard_campaigns (
  campaign_id     integer PRIMARY KEY,
  campaign_name   text,
  account_id      integer,
  hiring          boolean,
  connections_requested integer DEFAULT 0,
  connection_requests_accepted integer DEFAULT 0,
  connection_replies integer DEFAULT 0,
  emails_sent     integer DEFAULT 0,
  inmails_sent    integer DEFAULT 0,
  emails_bounced  integer DEFAULT 0,
  calls           integer DEFAULT 0,
  created_at      date,
  activity        text,
  target_icp      text,
  channel         text DEFAULT 'LinkedIn + Email',
  brief_json      jsonb,
  response_rate   float,
  acceptance_rate float,
  open_rate       float,
  click_rate      float,
  bounce_rate     float,
  industry        text
);

-- SDR account ID → name mapping
CREATE TABLE sales.dashboard_skylead_ids (
  account_id   integer PRIMARY KEY,
  account_name text
);
-- Insert your SDRs:
INSERT INTO sales.dashboard_skylead_ids VALUES
  (32871, 'Lenore Kopko'),
  (32887, 'Abhinanda Deb'),
  (32891, 'Laura Petersen'),
  (32893, 'Darren Stuart');
-- Add your own SDR account IDs from Skylead

-- Campaign briefs (planning content — separate from performance data)
CREATE TABLE sales.campaign_briefs (
  id          SERIAL PRIMARY KEY,
  title       text NOT NULL,
  subtitle    text,
  assignee    text,
  account_id  integer,
  channel     text DEFAULT 'LinkedIn + Email',
  activity    text,
  color       text,
  sort_order  integer,
  brief_json  jsonb,
  is_deleted  boolean DEFAULT false,
  created_at  date DEFAULT CURRENT_DATE,
  updated_at  timestamptz DEFAULT NOW()
);

-- Call records
CREATE TABLE sales.dashboard_call_records (
  id              SERIAL PRIMARY KEY,
  campaign_name   text,
  account_id      integer,
  contact_name    text,
  contact_title   text,
  contact_company text,
  contact_linkedin text,
  call_date       date,
  outcome         text,
  notes           text,
  created_at      timestamptz DEFAULT NOW()
);

-- User accounts (for task list ownership)
CREATE TABLE users.users (
  id    SERIAL PRIMARY KEY,
  email text UNIQUE NOT NULL,
  name  text,
  created_at timestamptz DEFAULT NOW()
);

-- Task list
CREATE TABLE users.user_tasks (
  id                  SERIAL PRIMARY KEY,
  user_id             integer REFERENCES users.users(id),
  description         text NOT NULL,
  details             text,
  status              text DEFAULT 'pending',
  task_type           text DEFAULT 'Next Action',
  horizon             text DEFAULT 'Ground',
  accountable_person  text,
  due_date_suggestion text,
  priority_score      integer,
  created_at          timestamptz DEFAULT NOW(),
  updated_at          timestamptz DEFAULT NOW()
);
```

---

## Step 4 — Configure environment variables

Create `/var/www/your-dashboard/api/.env`:

```env
# Google OAuth (for user login)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
ALLOWED_DOMAIN=yourdomain.com
ALLOWED_EMAILS=user1@yourdomain.com,user2@yourdomain.com

# Main app DB (activities, tasks, costs)
PG_HOST=your-rds-host.us-east-1.rds.amazonaws.com
PG_PORT=5432
PG_USER=your_db_user
PG_PASSWORD=your_db_password
PG_DATABASE=your_db_name

# SMT DB (campaigns, briefs, call records)
# If using the same DB, point both at the same host
SMT_ADMIN_HOST=your-rds-host.us-east-1.rds.amazonaws.com
SMT_ADMIN_USER=postgres
SMT_ADMIN_PASSWORD=your_admin_password
SMT_ADMIN_DATABASE=your_smt_db

# Agent secret — agents use this to call the API without Google login
# Generate your own: openssl rand -hex 20
AGENT_SECRET=your_generated_secret_here

# API port
PORT=3100

# Anthropic (for cost tracking)
ANTHROPIC_ADMIN_API_KEY=sk-ant-...
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_AGENT_API_KEY_ID=your-key-id
ANTHROPIC_WORKSPACE_ID=your-workspace-id

# HubSpot (optional — for follow-up CRM data)
HUBSPOT_TOKEN=pat-na1-...

# OpenClaw gateway token (optional — for agent chat integration)
OPENCLAW_GATEWAY_TOKEN=your-openclaw-token

# bb_agents DB (optional — for multi-agent shared board)
BB_AGENTS_HOST=your-bb-agents-host
BB_AGENTS_DB=bb_agents
BB_AGENTS_USER=agent_writer
BB_AGENTS_PASSWORD=your-password
```

---

## Step 5 — Point the API code at your DB

In `api/server.js`, the SMT DB connection is currently hardcoded. Update the pool config to use env vars instead of hardcoded credentials:

```js
// Find this block (~line 73) and update:
const smtAdminPool = new Pool({
  host:     process.env.SMT_ADMIN_HOST || 'your-host',
  port:     5432,
  user:     process.env.SMT_ADMIN_USER || 'postgres',
  password: process.env.SMT_ADMIN_PASSWORD || '',
  database: process.env.SMT_ADMIN_DATABASE || 'smt_db',
  ssl:      { rejectUnauthorized: false },
  max:      3,
});
```

Also update `LAURA_AGENT_ID` and `DARREN_AGENT_ID` in the env or directly in the code to match your agent names.

---

## Step 6 — Set up Skylead (optional)

If you use Skylead for LinkedIn outreach:
1. Get your Skylead API key
2. Add each SDR's Skylead account ID to `sales.dashboard_skylead_ids`
3. Update `SKYLEAD_KEY` in `api/server.js` (or move to env var)
4. Trigger a sync via `POST /api/skylead/trigger-sync` to populate campaign data

If you don't use Skylead, the Campaign Performance Sandbox will be empty but everything else works fine.

---

## Step 7 — Install & build

```bash
# Install API dependencies
cd /var/www/your-dashboard/api
npm install --omit=dev

# Install and build frontend
cd /var/www/your-dashboard/app
npm install
npm run build

# Copy build output to web root
cp /var/www/your-dashboard/app/dist/index.html /var/www/your-dashboard/index.html
```

---

## Step 8 — Set up systemd service

Create `/etc/systemd/system/your-dashboard-api.service`:

```ini
[Unit]
Description=Your Dashboard API Server
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/var/www/your-dashboard/api
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5
EnvironmentFile=/var/www/your-dashboard/api/.env
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable your-dashboard-api
sudo systemctl start your-dashboard-api
sudo systemctl status your-dashboard-api
```

---

## Step 9 — Set up Nginx

```nginx
server {
    listen 443 ssl;
    server_name your-dashboard.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/your-dashboard.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-dashboard.yourdomain.com/privkey.pem;

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3100/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # React app assets
    location ~* ^/app/assets/ {
        root /var/www/your-dashboard/app/dist;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # React app
    location /app/ {
        root /var/www/your-dashboard/app/dist;
        index index.html;
        try_files $uri $uri/ /app/index.html;
        add_header Cache-Control "no-store, no-cache, must-revalidate";
    }

    # Root redirect
    location = / {
        return 301 /app/;
    }
}

server {
    listen 80;
    server_name your-dashboard.yourdomain.com;
    return 301 https://$host$request_uri;
}
```

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## Step 10 — Set up GitHub Actions CI/CD (optional)

The repo already has `.github/workflows/deploy.yml` set up for self-hosted runners.

**To use it:**

1. Set up a GitHub Actions self-hosted runner on your EC2:
   ```bash
   # Follow GitHub's guide: Settings → Actions → Runners → New self-hosted runner
   ```

2. Add these **GitHub Secrets** (Settings → Secrets and variables → Actions):

   | Secret | Value |
   |---|---|
   | `GOOGLE_CLIENT_SECRET` | Your Google OAuth secret |
   | `ANTHROPIC_ADMIN_API_KEY` | Anthropic admin key |
   | `ANTHROPIC_API_KEY` | Anthropic API key |
   | `HUBSPOT_TOKEN` | HubSpot token |
   | `BB_AGENTS_PASSWORD` | bb_agents DB password |
   | `PG_PASSWORD` | Main DB password |
   | `AGENT_SECRET` | Your generated agent secret |
   | `OPENCLAW_GATEWAY_TOKEN` | OpenClaw token |

3. Add these **GitHub Variables** (Settings → Secrets and variables → Variables):

   | Variable | Value |
   |---|---|
   | `GOOGLE_CLIENT_ID` | Your Google client ID |
   | `ALLOWED_DOMAIN` | yourdomain.com |
   | `ALLOWED_EMAILS` | comma-separated emails |
   | `PORT` | 3100 |
   | `BB_AGENTS_HOST` | RDS hostname |
   | `BB_AGENTS_DB` | bb_agents |
   | `BB_AGENTS_USER` | agent_writer |
   | `PG_HOST` | RDS hostname |
   | `PG_USER` | DB user |
   | `PG_DATABASE` | DB name |
   | `ANTHROPIC_AGENT_API_KEY_ID` | Key ID |

4. Push to `main` — the workflow auto-deploys.

---

## Connecting your OpenClaw agent to your forked dashboard

Once deployed, your agent needs just two things:

```
YOUR_DASHBOARD_SECRET=<your AGENT_SECRET value>
YOUR_DASHBOARD_URL=https://your-dashboard.yourdomain.com/api
```

Then call any endpoint with:
```bash
curl -H "x-agent-secret: <YOUR_DASHBOARD_SECRET>" \
     https://your-dashboard.yourdomain.com/api/health
```

See `DASHBOARD_DOCS.md` for the full API reference — all endpoints work the same on your fork.

---

## What to customize after forking

| File | What to change |
|---|---|
| `app/src/components/tabs/CommandCenterOverview.jsx` | Agent names, SDR list in modals, hardcoded campaign briefs |
| `app/src/components/TabNav.jsx` | Tab labels, which tabs show per agent |
| `api/server.js` | DB connections, agent IDs, Skylead key, HubSpot token |
| `app/src/components/LoginGate.jsx` | Login page branding |
| `index.html` | Page title |
