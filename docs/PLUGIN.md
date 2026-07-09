# laura-tracker — OpenClaw Message Tracking Plugin

## What It Does

Automatically captures every inbound message and outbound agent response at the OpenClaw gateway layer. The agent (Laura) has **zero responsibility** for this tracking — it happens in code, not in prompts.

**Problem it solves:** Agent self-reporting is unreliable. The agent can forget, skip steps, or lose context across sessions. Code-enforced tracking guarantees every exchange is logged regardless of agent behavior.

## How It Works

The plugin uses OpenClaw's lifecycle hook system (`api.on(...)`) to intercept two events:

### `message_received` → Captures user input

Fires when any message arrives from a user (Ron, Ed, Jewel, etc.) through any channel (Google Chat, etc.).

**Captures:**
- User identity (sender name)
- Channel (googlechat, telegram, etc.)
- Full message content
- Session key (for grouping conversations)
- Timestamp

### `agent_end` → Captures agent response + token usage

Fires when the agent finishes processing and produces a response (including tool calls).

**Captures:**
- Response text (thinking blocks stripped, text-only)
- Model used (opus-4-6, sonnet-4-6, haiku-4-5)
- Token usage (input, output, cache read, cache write)
- Computed cost (using org-discounted rates)
- Link back to the triggering inbound message
- Duration

### Data Flow

```
User message → OpenClaw Gateway
                    │
                    ├── message_received hook fires
                    │   └── POST /api/messages { direction: "inbound", ... }
                    │
                    ├── Agent processes (Claude API call)
                    │
                    ├── agent_end hook fires
                    │   └── POST /api/messages { direction: "outbound", tokens, cost, ... }
                    │
                    └── Response delivered to user
```

All POSTs are **fire-and-forget**. If the API server is down, errors are logged but the agent continues normally. The plugin never blocks or crashes the agent.

## Installation

### 1. Plugin files

Copy to the OpenClaw extensions directory:

```bash
mkdir -p ~/.openclaw/extensions/laura-tracker
cp plugins/laura-tracker/* ~/.openclaw/extensions/laura-tracker/
```

### 2. Register in OpenClaw config

Add to `~/.openclaw/openclaw.json`:

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

### 3. Restart the gateway

```bash
systemctl --user restart openclaw-gateway
```

### 4. Verify

Check gateway logs:
```bash
journalctl --user -u openclaw-gateway.service --since "1 min ago" | grep laura-tracker
```

Expected output:
```
[laura-tracker] Message tracker plugin v1.2 loaded ✓
```

## API Endpoints

The plugin POSTs to the Laura Dashboard API server at `http://127.0.0.1:3100`.

### POST /api/messages (no auth required)

Called by the plugin on every message exchange.

**Inbound message payload:**
```json
{
  "direction": "inbound",
  "session_key": "agent:main:googlechat:direct:spaces/79ZuMSAAAAE",
  "user_name": "Ron",
  "channel": "googlechat",
  "content": "Hey, what's the status?",
  "timestamp": "2026-04-07T12:18:18.724Z"
}
```

**Outbound response payload:**
```json
{
  "direction": "outbound",
  "session_key": "agent:main:googlechat:direct:spaces/79ZuMSAAAAE",
  "inbound_message_id": "258234b6-72a2-45ed-...",
  "content": "Here's the current status...",
  "model": "claude-opus-4-6",
  "input_tokens": 5000,
  "output_tokens": 1200,
  "cache_read_tokens": 80000,
  "cache_write_tokens": 500,
  "timestamp": "2026-04-07T12:18:23.756Z"
}
```

### GET /api/messages (auth required)

Query message history for the dashboard.

**Parameters:**
- `days` (default: 7, max: 90) — lookback window
- `direction` (default: all) — `inbound`, `outbound`, or `all`
- `limit` (default: 200, max: 500)
- `session_key` — filter to specific session

**Response:**
```json
{
  "messages": [...],
  "summary": {
    "total": 42,
    "inbound": 21,
    "outbound": 21,
    "totalCost": 1.23,
    "totalTokens": 450000,
    "sessions": 5
  }
}
```

## Database Table

```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  direction TEXT NOT NULL,          -- "inbound" or "outbound"
  session_key TEXT,                 -- groups messages into conversations
  inbound_message_id TEXT,          -- links response → prompt
  user_name TEXT,                   -- Ron, Ed, Jewel, etc.
  channel TEXT,                     -- googlechat, telegram, etc.
  content TEXT,                     -- full message text
  model TEXT,                       -- claude-opus-4-6, etc.
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cache_read_tokens INTEGER DEFAULT 0,
  cache_write_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  cost_usd NUMERIC(10,6) DEFAULT 0,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Table is auto-created on API server startup (migration in server.js).

## Dashboard Integration

The **Database** tab in the React dashboard has a **💬 Conversations** sub-tab that:

- Groups messages by `session_key`
- Displays inbound (user) and outbound (agent) as chat bubbles
- Shows per-exchange cost, model, and token count
- Session cards are collapsible with summary stats
- Date range filter (Today / 7 / 14 / 30 days)

## Configuration

The plugin reads its API URL from the hardcoded constant:

```typescript
const API_URL = 'http://127.0.0.1:3100';
```

Future: make this configurable via the plugin's `configSchema`:

```json
{
  "plugins": {
    "entries": {
      "laura-tracker": {
        "enabled": true,
        "config": {
          "apiUrl": "http://127.0.0.1:3100"
        }
      }
    }
  }
}
```

## Debug Mode

Set `DEBUG = true` in `index.ts` to log event shapes to the gateway journal. Useful for discovering new fields or debugging field mapping issues.

```bash
journalctl --user -u openclaw-gateway.service -f | grep laura-tracker
```

## Event Shape Reference

Discovered via debug logging (OpenClaw 2026.3.8):

### message_received
```
{ from, content, timestamp, metadata }
```
- `from`: sender identifier (string or object)
- `content`: raw message text
- `timestamp`: ISO string
- `metadata`: channel/session context

### agent_end
```
{ messages, success, error, durationMs }
```
- `messages`: full conversation array `[{ role, content, model?, usage? }, ...]`
- `success`: boolean
- `error`: error object if failed
- `durationMs`: total processing time

Token usage is on individual message objects within the `messages` array, not on the top-level event.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Plugin not loading | Not in `openclaw.json` | Add to `plugins.entries` + `load.paths` |
| "plugins.allow is empty" warning | No allowlist configured | Safe to ignore, or set `plugins.allow: ["laura-tracker"]` |
| Messages not captured | API server down | Check `systemctl --user status laura-api-server` |
| session_key is "unknown" | Event shape changed | Enable DEBUG, check logs, update field mapping |
| Tokens showing as 0 | Usage not on expected path | Enable DEBUG, check `agent_end.messages[*].usage` |
| Content has thinking blocks | extractText() not filtering | Check content block types |

## Security Notes

- The plugin runs **in-process** with the OpenClaw gateway — treat it as trusted code.
- `POST /api/messages` has **no authentication** (called by the local plugin only). The API server binds to `127.0.0.1` (localhost only), so this is not exposed externally.
- Message content is stored in full — be aware that all user messages and agent responses are persisted in PostgreSQL.
