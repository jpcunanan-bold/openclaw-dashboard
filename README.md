# Laura Laura Dashboard

Real-time operational dashboard for **Laura Rhodes** — Abhinanda Deb's AI executive assistant. Built on OpenClaw + Claude, backed by PostgreSQL, served through a React dashboard.

## What This Is

A full-stack system that gives Ed visibility into what his AI agent is doing, how much it costs, and how much time it saves. The dashboard is Ed's "proof of work" — he opens it and sees every task completed, every dollar spent, every minute saved.

### Key Features

- **📊 Activity Tracking** — categorized by Ed's Tasks / Developer / Routine
- **💬 Automatic Conversation Capture** — every message in and out, logged by code (not the agent)
- **💰 Cost & ROI Dashboard** — real-time token costs from Anthropic API, broken down by model and category
- **📋 Task Management** — explicit task CRUD linked to the Master Board
- **📈 Trends** — 14-day time series of cost and activity
- **🗄️ PostgreSQL Database** — all data persisted in AWS RDS

## Architecture

```
OpenClaw Gateway ──▶ laura-tracker plugin ──▶ API Server ──▶ PostgreSQL
     │                                           │
     └── Claude API (Anthropic) ────────────────┘
                                                 │
                                          React Dashboard
```

**The critical design decision:** Message tracking is enforced by code (OpenClaw plugin hooks), not by agent behavior. The agent cannot forget, skip, or omit tracking. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full system design.

## Quick Start

### Prerequisites
- Node.js 22+
- PostgreSQL (AWS RDS or local)
- OpenClaw Gateway running
- Nginx (reverse proxy)

### Deploy

```bash
# 1. Install dependencies
cd api-server && npm install
cd ../react-dashboard && npm install

# 2. Configure environment
cp api-server/.env.example api-server/.env
# Edit .env with your PG credentials, Anthropic keys, auth token

# 3. Build dashboard
cd react-dashboard && npm run build

# 4. Start API server
systemctl --user start laura-api-server

# 5. Install the tracking plugin
mkdir -p ~/.openclaw/extensions/laura-tracker
cp plugins/laura-tracker/* ~/.openclaw/extensions/laura-tracker/
# Add to ~/.openclaw/openclaw.json (see docs/PLUGIN.md)
systemctl --user restart openclaw-gateway
```

## Documentation

| Doc | What It Covers |
|-----|---------------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Full system architecture, data flow, schema, API reference, deployment |
| [docs/PLUGIN.md](docs/PLUGIN.md) | laura-tracker plugin: installation, configuration, event shapes, troubleshooting |

## Project Structure

```
├── api-server/           # Express API (port 3100)
│   ├── server.js         # All endpoints + DB migrations
│   ├── auto-cost-tracker.js   # Anthropic API cost polling
│   └── data/             # JSON state files
├── plugins/
│   └── laura-tracker/     # OpenClaw message tracking plugin
├── react-dashboard/      # Vite + React 19 dashboard
│   ├── src/components/tabs/  # Tab components
│   ├── src/hooks/        # Data fetching hooks
│   └── dist/             # Built assets
├── docs/                 # Documentation
└── nginx-api.conf        # Nginx config
```

## Cost Model

Uses org-discounted Anthropic rates (~1/3 of published):

| Model | Input/1M | Output/1M | Cache Read/1M |
|-------|---------|-----------|---------------|
| Opus 4.6 | $5.00 | $25.00 | $0.50 |
| Sonnet 4.6 | $1.00 | $5.00 | $0.10 |
| Haiku 4.5 | $0.27 | $1.33 | $0.027 |

Steady-state agent cost: **$75–125/month** (Routine ~$10-15, User ~$50-90, Developer ~$10-20).

## License

Proprietary — Bold Business internal use only.

<!-- Dex agent access verified: 2026-07-10T20:37Z -->
