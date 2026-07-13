import 'dotenv/config';
import express from 'express';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import pg from 'pg';
const { Pool } = pg;

// ── PostgreSQL — local laura DB (legacy, may not be running) ─────────────────
const pgPool = new Pool({
  host:     process.env.PG_HOST,
  port:     Number(process.env.PG_PORT) || 5432,
  user:     process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE || 'laura',
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
});
pgPool.on('error', (err) => console.error('PG pool error:', err.message));

// ── PostgreSQL — bb_agents RDS (shared multi-agent DB, built by Brio) ────────
const BB_AGENTS_HOST     = process.env.BB_AGENTS_HOST     || 'bb-agents-shared-db.cpsqyxgezuwr.us-east-2.rds.amazonaws.com';
const BB_AGENTS_DB       = process.env.BB_AGENTS_DB       || 'bb_agents';
const BB_AGENTS_USER     = process.env.BB_AGENTS_USER     || 'agent_writer';
const BB_AGENTS_PASSWORD = process.env.BB_AGENTS_PASSWORD || '';
const LAURA_AGENT_ID     = process.env.LAURA_AGENT_ID     || 'laura-abhi-agent';
const DARREN_AGENT_ID    = process.env.DARREN_AGENT_ID    || 'darren-abhi-agent';
const ZARA_AGENT_ID      = process.env.ZARA_AGENT_ID      || 'zara-mercuryz-agent';
const CAMILLA_AGENT_ID   = process.env.CAMILLA_AGENT_ID   || 'camilla-boldbusiness-agent';

const bbPool = new Pool({
  host:     BB_AGENTS_HOST,
  port:     5432,
  user:     BB_AGENTS_USER,
  password: BB_AGENTS_PASSWORD,
  database: BB_AGENTS_DB,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 8000,
});
bbPool.on('error', (err) => console.error('bb_agents pool error:', err.message));

// ── SMT DB (smt_db — recruiters performance) ─────────────────────────────────
// lola_readwrite — can read public schema tables
// lola_readonly  — can read recruiters schema (goals, activities, recruiters)
const SMT_HOST     = process.env.SMT_HOST     || 'smt-db.c5vzhv0mqgjy.us-east-1.rds.amazonaws.com';
const SMT_DATABASE = process.env.SMT_DATABASE || 'smt_db';

const smtPool = new Pool({
  host:     SMT_HOST,
  port:     5432,
  user:     process.env.SMT_USER          || 'lola_readwrite',
  password: process.env.SMT_PASSWORD      || 'lolapassword',
  database: SMT_DATABASE,
  ssl:      { rejectUnauthorized: false },
  max:      5,
});
smtPool.on('error', (err) => console.error('SMT pool error:', err.message));

// lola_readonly — can read sales.dashboard_campaigns / dashboard_skylead_ids
const smtReadPool = new Pool({
  host:     SMT_HOST,
  port:     5432,
  user:     process.env.SMT_READONLY_USER     || 'lola_readonly',
  password: process.env.SMT_READONLY_PASSWORD || 'lenorekopko',
  database: SMT_DATABASE,
  ssl:      { rejectUnauthorized: false },
  max:      5,
});
smtReadPool.on('error', (err) => console.error('SMT-read pool error:', err.message));

// postgres superuser — full access to sales schema (call_records, etc.)
const smtAdminPool = new Pool({
  host:     SMT_HOST,
  port:     5432,
  user:     process.env.SMT_ADMIN_USER     || 'postgres',
  password: process.env.SMT_ADMIN_PASSWORD || 'FeCvAStpTtNcrtQfqGeW',
  database: SMT_DATABASE,
  ssl:      { rejectUnauthorized: false },
  max:      3,
});
smtAdminPool.on('error', (err) => console.error('SMT-admin pool error:', err.message));

// ── bb_agents helpers ────────────────────────────────────────────────────────

/** Log an activity to agent_activities. agentId defaults to LAURA_AGENT_ID for backward compat. */
async function bbLogActivity({ agentId, type, category, requestedBy, title, request, actions, taskId,
  model, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, totalTokens,
  costUsd, timeSavedMin, source, sessionKey, timestamp }) {
  const resolvedAgentId = agentId || LAURA_AGENT_ID;
  try {
    await bbPool.query(`
      INSERT INTO agent_activities
        (id, agent_id, type, category, requested_by, title, request, actions, task_id,
         model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
         total_tokens, cost_usd, time_saved_min, source, session_key, timestamp)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
      [randomUUID(), resolvedAgentId, type||'task', category||'outreach', requestedBy||'system', title||'',
       request||'', JSON.stringify(typeof actions === 'string' ? [actions] : (actions||[])), taskId||null, model||null,
       inputTokens||0, outputTokens||0, cacheReadTokens||0, cacheWriteTokens||0,
       totalTokens||0, costUsd||0, timeSavedMin||0, source||'api', sessionKey||null,
       timestamp ? new Date(timestamp) : new Date()]
    );
    await bbPool.query(
      `UPDATE agent_registry SET last_active_at = NOW() WHERE agent_id = $1`,
      [resolvedAgentId]
    );
  } catch (e) {
    console.error('bbLogActivity error:', e.message);
  }
}

/** Upsert daily cost snapshot in agent_cost_snapshots. agentId defaults to LAURA_AGENT_ID. */
async function bbUpsertCostSnapshot(date, costUsd, byModel, taskCount, agentId) {
  const resolvedAgentId = agentId || LAURA_AGENT_ID;
  try {
    await bbPool.query(`
      INSERT INTO agent_cost_snapshots
        (agent_id, snapshot_date, total_cost_usd, by_model, task_count, source)
      VALUES ($1, $2, $3, $4, $5, 'anthropic_api')
      ON CONFLICT (agent_id, snapshot_date)
      DO UPDATE SET
        total_cost_usd = EXCLUDED.total_cost_usd,
        by_model       = EXCLUDED.by_model,
        task_count     = EXCLUDED.task_count,
        source         = EXCLUDED.source`,
      [resolvedAgentId, date, costUsd, JSON.stringify(byModel||{}), taskCount||0]
    );
  } catch (e) {
    console.error('bbUpsertCostSnapshot error:', e.message);
  }
}

// ── DB Migration: create messages + tasks tables if not present ───────────────
(async () => {
  try {
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        direction TEXT NOT NULL,
        session_key TEXT,
        inbound_message_id TEXT,
        user_name TEXT,
        channel TEXT,
        content TEXT,
        model TEXT,
        input_tokens INTEGER DEFAULT 0,
        output_tokens INTEGER DEFAULT 0,
        cache_read_tokens INTEGER DEFAULT 0,
        cache_write_tokens INTEGER DEFAULT 0,
        total_tokens INTEGER DEFAULT 0,
        cost_usd NUMERIC(10,6) DEFAULT 0,
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_messages_session   ON messages(session_key);
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_messages_direction ON messages(direction);

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        created_by TEXT,
        status TEXT DEFAULT 'open',
        task_id_ref TEXT,
        total_cost_usd NUMERIC(10,6) DEFAULT 0,
        total_tokens INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS dashboard_chat (
        id SERIAL PRIMARY KEY,
        session_id TEXT NOT NULL,
        sender TEXT NOT NULL,
        task_ref TEXT,
        message TEXT NOT NULL,
        timestamp TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_dc_session ON dashboard_chat(session_id);
      CREATE INDEX IF NOT EXISTS idx_dc_timestamp ON dashboard_chat(timestamp DESC);

      CREATE TABLE IF NOT EXISTS contacts (
        id            SERIAL PRIMARY KEY,
        agent         VARCHAR(20)  NOT NULL DEFAULT 'laura',
        campaign      VARCHAR(80),
        company       VARCHAR(200),
        contact_name  VARCHAR(200),
        title         VARCHAR(200),
        email         VARCHAR(200),
        linkedin_url  TEXT,
        role          VARCHAR(200),
        location      VARCHAR(200),
        touch1        VARCHAR(200),
        touch2        VARCHAR(200),
        touch3        VARCHAR(200),
        touch4        VARCHAR(200),
        touch5        VARCHAR(200),
        response_status   VARCHAR(200),
        response_date     VARCHAR(80),
        call_scheduled    VARCHAR(80),
        next_action       VARCHAR(200),
        notes         TEXT,
        tier          VARCHAR(50),
        hiring_evidence   TEXT,
        smtp_status   VARCHAR(100),
        assigned_to   VARCHAR(100),
        blacklisted   BOOLEAN NOT NULL DEFAULT false,
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        updated_at    TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_contacts_agent       ON contacts(agent);
      CREATE INDEX IF NOT EXISTS idx_contacts_campaign    ON contacts(campaign);
      CREATE INDEX IF NOT EXISTS idx_contacts_blacklisted ON contacts(blacklisted);
      CREATE INDEX IF NOT EXISTS idx_contacts_email       ON contacts(email);
      CREATE INDEX IF NOT EXISTS idx_contacts_company     ON contacts(company);
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contacts_email_agent_campaign_uq') THEN
          ALTER TABLE contacts ADD CONSTRAINT contacts_email_agent_campaign_uq UNIQUE (email, agent, campaign);
        END IF;
      END $$;
      CREATE TABLE IF NOT EXISTS abhi_tasks (
        id                TEXT PRIMARY KEY,
        agent_id          TEXT NOT NULL DEFAULT 'laura-abhi-agent',
        title             TEXT NOT NULL,
        description       TEXT,
        raw_message       TEXT,
        channel           VARCHAR(50)  DEFAULT 'googlechat',
        status            VARCHAR(20)  DEFAULT 'pending',
        priority          VARCHAR(20)  DEFAULT 'normal',
        model             VARCHAR(100),
        session_key       TEXT,
        inbound_message_id TEXT,
        input_tokens      BIGINT       DEFAULT 0,
        output_tokens     BIGINT       DEFAULT 0,
        cache_read_tokens BIGINT       DEFAULT 0,
        cache_write_tokens BIGINT      DEFAULT 0,
        total_tokens      BIGINT       DEFAULT 0,
        cost_usd          NUMERIC(10,6) DEFAULT 0,
        approval_status   VARCHAR(20)  DEFAULT 'pending',
        approved_at       TIMESTAMPTZ,
        rejected_at       TIMESTAMPTZ,
        assigned_at       TIMESTAMPTZ  DEFAULT NOW(),
        started_at        TIMESTAMPTZ,
        completed_at      TIMESTAMPTZ,
        updated_at        TIMESTAMPTZ  DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_abhi_tasks_agent    ON abhi_tasks(agent_id);
      CREATE INDEX IF NOT EXISTS idx_abhi_tasks_assigned ON abhi_tasks(assigned_at DESC);
      CREATE INDEX IF NOT EXISTS idx_abhi_tasks_status   ON abhi_tasks(status);
      ALTER TABLE abhi_tasks ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'pending';
      ALTER TABLE abhi_tasks ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
      ALTER TABLE abhi_tasks ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
    `);
    console.log('[db] messages + tasks + dashboard_chat tables ready');
  } catch (e) {
    console.error('[db] migration error (non-fatal):', e.message);
  }
})();

/**
 * Dual-write an activity entry to Postgres.
 * Non-blocking — failures are logged but never crash the API.
 */
async function pgWriteActivity(entry) {
  const resolvedAgent = entry.agentId || LAURA_AGENT_ID;
  const ts = entry.timestamp || new Date().toISOString();
  try {
    // Write to 'activities' table (legacy Laura dashboard)
    await pgPool.query(`
      INSERT INTO activities (
        id, type, category, requested_by, title, request, actions, task_id, model,
        input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
        total_tokens, cost_usd, time_saved_min, source, session_key, timestamp, agent_id, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
      ON CONFLICT (id) DO UPDATE SET
        cost_usd        = EXCLUDED.cost_usd,
        time_saved_min  = EXCLUDED.time_saved_min,
        title           = EXCLUDED.title,
        agent_id        = EXCLUDED.agent_id,
        category        = COALESCE(EXCLUDED.category, activities.category)
    `, [
      entry.id, entry.type || 'user-task', entry.category || null, entry.requestedBy || null,
      entry.title, entry.request || null, JSON.stringify(entry.actions || []), entry.taskId || null,
      entry.model || null, entry.inputTokens || 0, entry.outputTokens || 0,
      entry.cacheReadTokens || 0, entry.cacheWriteTokens || 0, entry.totalTokens || 0,
      entry.costUsd || 0, entry.timeSavedMin || 0, entry.source || 'api',
      entry.sessionKey || null, ts, resolvedAgent, ts,
    ]);
  } catch (e) { console.error('PG activities write failed:', e.message); }

  // Also write to agent_activities (analytics table used by /api/analytics)
  try {
    await pgPool.query(`
      INSERT INTO agent_activities
        (id, agent_id, type, category, requested_by, title, request, actions,
         model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
         total_tokens, cost_usd, time_saved_min, source, session_key, timestamp, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      ON CONFLICT (id) DO UPDATE SET
        cost_usd        = EXCLUDED.cost_usd,
        category        = COALESCE(EXCLUDED.category, agent_activities.category)
    `, [
      entry.id, resolvedAgent, entry.type || 'user-task', entry.category || null,
      entry.requestedBy || null, entry.title, entry.request || null,
      JSON.stringify(entry.actions || []), entry.model || null,
      entry.inputTokens || 0, entry.outputTokens || 0,
      entry.cacheReadTokens || 0, entry.cacheWriteTokens || 0, entry.totalTokens || 0,
      entry.costUsd || 0, entry.timeSavedMin || 0, entry.source || 'api',
      entry.sessionKey || null, ts, ts,
    ]);
  } catch (e) { console.error('PG agent_activities write failed:', e.message); }
}

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();

// ── Simple in-memory cache for slow Sheets endpoints (5-minute TTL) ──────────
const _cache = new Map(); // key → { data, expiresAt }
function cacheGet(key) {
  const e = _cache.get(key);
  return (e && Date.now() < e.expiresAt) ? e.data : null;
}
function cacheSet(key, data, ttlMs = 300_000) {
  _cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

app.use(express.json());

// ── CORS whitelist — restrict to known origins ────────────────────────────────
app.use((req, res, next) => {
  const allowedOrigins = ['https://openclaw.boldbusiness.com', 'http://localhost:5173', 'http://localhost:5174'];
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

const PORT = Number(process.env.PORT) || 3100;
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const ALLOWED_DOMAIN = process.env.ALLOWED_DOMAIN || 'boldbusiness.com';
// Comma-separated allowlist — if set, only these exact emails can log in
// e.g. ALLOWED_EMAILS=adeb@boldbusiness.com,lkopko@boldbusiness.com
const ALLOWED_EMAILS = process.env.ALLOWED_EMAILS
  ? process.env.ALLOWED_EMAILS.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
  : [];

// ── Google token verification ─────────────────────────────────────────────────
import { OAuth2Client } from 'google-auth-library';
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

async function verifyGoogleToken(idToken) {
  if (!googleClient) throw new Error('Google OAuth not configured');
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload) throw new Error('Empty token payload');
  const email = payload.email || '';
  const domain = email.split('@')[1] || '';
  if (domain !== ALLOWED_DOMAIN) {
    throw new Error(`Unauthorized: only @${ALLOWED_DOMAIN} accounts are allowed.`);
  }
  if (ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(email.toLowerCase())) {
    throw new Error(`${email} is not on the access list. Contact your administrator.`);
  }
  return { email, name: payload.name, picture: payload.picture, sub: payload.sub };
}

// ── Session store (Postgres-backed; survives restarts) ─────────────────────────
const sessions = new Map(); // in-memory cache; Postgres is source of truth

function makeSessionToken() {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function saveSession(token, { email, name, picture, expiresAt }) {
  try {
    await pgPool.query(
      `INSERT INTO dashboard_sessions (token, email, name, picture, expires_at)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (token) DO UPDATE SET expires_at = EXCLUDED.expires_at`,
      [token, email, name || '', picture || '', new Date(expiresAt).toISOString()]
    );
  } catch (e) { /* non-fatal — falls back to in-memory */ }
}

async function loadSession(token) {
  // Check memory cache first
  if (sessions.has(token)) {
    const s = sessions.get(token);
    if (s.expiresAt > Date.now()) return s;
    sessions.delete(token);
  }
  // Try Postgres
  try {
    const r = await pgPool.query(
      `SELECT email, name, picture, expires_at FROM dashboard_sessions
       WHERE token=$1 AND expires_at > NOW()`, [token]
    );
    if (r.rows.length > 0) {
      const row = r.rows[0];
      const sess = { email: row.email, name: row.name, picture: row.picture,
                     expiresAt: new Date(row.expires_at).getTime() };
      sessions.set(token, sess); // warm the in-memory cache
      return sess;
    }
  } catch (e) { /* non-fatal */ }
  return null;
}

// ── Auth middleware — protects all /api/ routes except public ones ────────────
async function authMiddleware(req, res, next) {
  // Always public
  if (req.path === '/api/health') return next();
  if (req.path === '/api/auth/verify') return next();
  if (req.path === '/api/auth/google') return next();
  if (req.path === '/api/auth/config') return next();
  // Internal writes (cron/plugin) — must be kept as they have no browser auth context
  if (req.path === '/api/activities' && req.method === 'POST') return next();
  if (req.path === '/api/tasks/cost' && req.method === 'POST') return next();
  if (req.path === '/api/messages' && req.method === 'POST') return next();
  if (req.path === '/api/abhi/tasks' && req.method === 'POST') return next();
  if (req.path.startsWith('/api/abhi/tasks/') && req.method === 'PATCH') return next();
  // Agent avatars — public so chat widget loads photos before login
  if (req.path === '/api/agents/avatars' && req.method === 'GET') return next();
  // Internal agent secret — allows Laura/Darren scripts to call dashboard APIs
  const AGENT_SECRET = process.env.AGENT_SECRET || '';
  if (AGENT_SECRET && req.headers['x-agent-secret'] === AGENT_SECRET) return next();

  // If neither Google nor token auth is configured → open (dev mode)
  if (!GOOGLE_CLIENT_ID && !AUTH_TOKEN) return next();

  const bearer = (req.headers.authorization || '').replace('Bearer ', '').trim();
  const query  = req.query.token || '';
  const token  = bearer || query;

  // Legacy token auth (still works if AUTH_TOKEN is set)
  if (AUTH_TOKEN && token === AUTH_TOKEN) return next();

  // Session token from Google login (Postgres-backed)
  if (token) {
    const sess = await loadSession(token);
    if (sess) { req.user = sess; return next(); }
  }

  res.status(401).json({ error: 'Unauthorized. Sign in with your @boldbusiness.com Google account.' });
}

app.use(authMiddleware);

// ── GET /api/auth/config — tells the frontend which auth mode is active ───────
app.get('/api/auth/config', (_req, res) => {
  res.json({
    googleEnabled: !!GOOGLE_CLIENT_ID,
    googleClientId: GOOGLE_CLIENT_ID || null,
    allowedDomain: ALLOWED_DOMAIN,
    tokenEnabled: !!AUTH_TOKEN,
  });
});

// ── POST /api/auth/google — exchange Google ID token for a session token ──────
app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential } = req.body; // Google One Tap credential (JWT)
    if (!credential) return res.status(400).json({ ok: false, error: 'Missing credential' });
    const user = await verifyGoogleToken(credential);
    const sessionToken = makeSessionToken();
    const expiresAt = Date.now() + 8 * 60 * 60 * 1000; // 8h
    sessions.set(sessionToken, { ...user, expiresAt }); // in-memory
    await saveSession(sessionToken, { ...user, expiresAt }); // Postgres (survives restart)
    // Clean up expired in-memory sessions
    for (const [k, v] of sessions.entries()) {
      if (v.expiresAt < Date.now()) sessions.delete(k);
    }
    console.log(`[auth] Google login: ${user.email}`);
    res.json({ ok: true, token: sessionToken, user });
  } catch (e) {
    console.error('[auth] Google verify failed:', e.message);
    res.status(401).json({ ok: false, error: e.message });
  }
});

// ── POST /api/auth/verify — legacy token check (kept for backward compat) ─────
app.post('/api/auth/verify', (req, res) => {
  const { token } = req.body;
  // Check legacy token
  if (AUTH_TOKEN && token === AUTH_TOKEN) {
    return res.json({ ok: true, message: 'Authenticated', mode: 'token' });
  }
  // Check session token
  if (token && sessions.has(token)) {
    const sess = sessions.get(token);
    if (sess.expiresAt > Date.now()) {
      return res.json({ ok: true, message: 'Authenticated', mode: 'google', user: { email: sess.email, name: sess.name, picture: sess.picture } });
    }
    sessions.delete(token);
  }
  res.status(401).json({ ok: false, error: 'Invalid or expired token' });
});

const ANTHROPIC_ADMIN_API_KEY = process.env.ANTHROPIC_ADMIN_API_KEY || '';
const ANTHROPIC_AGENT_API_KEY_ID = process.env.ANTHROPIC_AGENT_API_KEY_ID || '';
const ANTHROPIC_WORKSPACE_ID = process.env.ANTHROPIC_WORKSPACE_ID || '';
const ANTHROPIC_BASE = 'https://api.anthropic.com';

// ── Task cost log (persistent JSON file) ──────────────────────────────────────
import { mkdirSync } from 'fs';

const dataDir = join(__dirname, 'data');
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

const COST_LOG_PATH = join(dataDir, 'task-costs.json');

function loadCostLog() {
  try {
    if (existsSync(COST_LOG_PATH)) {
      return JSON.parse(readFileSync(COST_LOG_PATH, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to load cost log:', e.message);
  }
  return { tasks: [], lastUpdated: null };
}

function saveCostLog(log) {
  try {
    writeFileSync(COST_LOG_PATH, JSON.stringify(log, null, 2));
  } catch (e) {
    console.error('Failed to save cost log:', e.message);
  }
}

// ── In-memory cache for Anthropic API (10 minutes) ───────────────────────────
let cachedAnthropicResult = null;
let cachedAnthropicAt = 0;
const CACHE_TTL_MS = 10 * 60 * 1000;

// ── Model pricing (per 1M tokens) ────────────────────────────────────────────
// IMPORTANT: These are the ACTUAL billed rates for this org (verified against
// Anthropic cost_report 2026-04-02). This org pays ~1/3 of published rates
// (enterprise/volume discount). Published rates are in comments for reference.
const MODEL_PRICING = {
  'claude-opus-4-6':             { input: 5.00, cacheRead: 0.50,  cacheWrite: 6.25, output: 25.00 },    // published: 15/1.50/18.75/75
  'claude-opus-4':               { input: 5.00, cacheRead: 0.50,  cacheWrite: 6.25, output: 25.00 },
  'claude-sonnet-4-6':           { input: 1.00, cacheRead: 0.10,  cacheWrite: 1.25, output:  5.00 },    // published: 3/0.30/3.75/15
  'claude-sonnet-4-5-20250929':  { input: 1.00, cacheRead: 0.10,  cacheWrite: 1.25, output:  5.00 },
  'claude-sonnet-4':             { input: 1.00, cacheRead: 0.10,  cacheWrite: 1.25, output:  5.00 },
  'claude-haiku-4-5-20251001':   { input: 0.27, cacheRead: 0.027, cacheWrite: 0.33, output:  1.33 },   // published: 0.80/0.08/1.00/4.00
  'claude-haiku-4-5':            { input: 0.27, cacheRead: 0.027, cacheWrite: 0.33, output:  1.33 },
  // Google models (approximate — no discount assumed yet)
  'gemini-2.5-pro':              { input: 1.25, cacheRead: 0.31,  cacheWrite: 1.25, output:  5.00 },
  'gemini-3.1-pro-preview':      { input: 1.25, cacheRead: 0.31,  cacheWrite: 1.25, output:  5.00 },
};

function estimateCostFromTokens(model, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens) {
  // Try exact match, then prefix match
  let pricing = MODEL_PRICING[model];
  if (!pricing) {
    const key = Object.keys(MODEL_PRICING).find(k => model.includes(k) || k.includes(model));
    pricing = key ? MODEL_PRICING[key] : { input: 3.00, cacheRead: 0.30, cacheWrite: 3.75, output: 15.00 }; // default to sonnet-like
  }
  
  const cost = (
    (inputTokens || 0) * pricing.input / 1_000_000 +
    (cacheReadTokens || 0) * pricing.cacheRead / 1_000_000 +
    (cacheWriteTokens || 0) * pricing.cacheWrite / 1_000_000 +
    (outputTokens || 0) * pricing.output / 1_000_000
  );
  return Math.round(cost * 10000) / 10000; // 4 decimal places
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function isoToDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function toNumber(v) {
  if (!v) return 0;
  const num = Number(String(v).replace(/,/g, ''));
  return isNaN(num) ? 0 : num;
}

// ── Fetch + stitch Anthropic usage & cost data ────────────────────────────────
async function fetchAnthropicData() {
  if (!ANTHROPIC_ADMIN_API_KEY) {
    return { enabled: false, error: 'Missing ANTHROPIC_ADMIN_API_KEY' };
  }

  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 7);

  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const headers = {
    'anthropic-version': '2023-06-01',
    'x-api-key': ANTHROPIC_ADMIN_API_KEY,
  };

  let usageReport;

  try {
    let msgUrl = `${ANTHROPIC_BASE}/v1/organizations/usage_report/messages?starting_at=${encodeURIComponent(startIso)}&ending_at=${encodeURIComponent(endIso)}&bucket_width=1d&group_by[]=model`;
    if (ANTHROPIC_AGENT_API_KEY_ID) {
      msgUrl += `&api_key_ids[]=${encodeURIComponent(ANTHROPIC_AGENT_API_KEY_ID)}`;
    }
    if (ANTHROPIC_WORKSPACE_ID) {
      msgUrl += `&workspace_ids[]=${encodeURIComponent(ANTHROPIC_WORKSPACE_ID)}`;
    }
    const msgRes = await fetch(msgUrl, { headers });
    if (!msgRes.ok) {
      const body = await msgRes.text();
      throw new Error(`Usage API HTTP ${msgRes.status}: ${body.slice(0, 300)}`);
    }
    usageReport = await msgRes.json();
  } catch (e) {
    return { enabled: false, error: `Usage fetch failed: ${e.message}` };
  }

  // NOTE: cost_report does NOT support api_key_ids filtering, so we skip it
  // and calculate cost from usage tokens + our pricing table instead.
  // This ensures we only report Laura's costs, not org-wide.
  let costError = null;

  const out = {
    enabled: true,
    costEnabled: !costError,
    costError: costError || undefined,
    startingAt: startIso,
    endingAt: endIso,
    totalsByModel: {},
    dailyByModel: [],
  };

  const usageMap = {};

  if (usageReport?.data) {
    for (const bucket of usageReport.data) {
      const date = isoToDate(bucket.starting_at);
      for (const item of bucket.results || []) {
        const model = item.model || 'unknown';
        const key = `${date}|${model}`;

        let cacheCreation = 0;
        if (item.cache_creation) {
          cacheCreation += toNumber(item.cache_creation.ephemeral_1h_input_tokens);
          cacheCreation += toNumber(item.cache_creation.ephemeral_5m_input_tokens);
        }

        const uncached = toNumber(item.uncached_input_tokens);
        const cacheRead = toNumber(item.cache_read_input_tokens);
        const output = toNumber(item.output_tokens);

        usageMap[key] = {
          date, model,
          uncachedInputTokens: uncached,
          cacheReadInputTokens: cacheRead,
          cacheCreationInputTokens: cacheCreation,
          outputTokens: output,
          totalTokens: uncached + cacheRead + cacheCreation + output,
          costUsd: 0,
        };
      }
    }
  }

  // Calculate cost from tokens using our pricing table (Laura-key-filtered, not org-wide)
  for (const key of Object.keys(usageMap)) {
    const row = usageMap[key];
    row.costUsd = estimateCostFromTokens(row.model, row.uncachedInputTokens, row.outputTokens, row.cacheReadInputTokens, row.cacheCreationInputTokens);
  }

  const keys = Object.keys(usageMap).sort();
  for (const k of keys) {
    const row = usageMap[k];
    out.dailyByModel.push({
      date: row.date,
      model: row.model,
      totalTokens: row.totalTokens,
      inputTokens: row.uncachedInputTokens,
      cacheReadTokens: row.cacheReadInputTokens,
      cacheCreateTokens: row.cacheCreationInputTokens,
      outputTokens: row.outputTokens,
      costUsd: Math.round(row.costUsd * 100) / 100,
    });

    if (!out.totalsByModel[row.model]) {
      out.totalsByModel[row.model] = { tokens: 0, costUsd: 0 };
    }
    out.totalsByModel[row.model].tokens += row.totalTokens;
    out.totalsByModel[row.model].costUsd += row.costUsd;
  }

  Object.keys(out.totalsByModel).forEach((m) => {
    out.totalsByModel[m].costUsd = Math.round(out.totalsByModel[m].costUsd * 100) / 100;
  });

  return out;
}

// ══════════════════════════════════════════════════════════════════════════════
//  ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// ── Anthropic org-level usage (cached 10 min) ─────────────────────────────────
app.get('/api/anthropic/usage', async (_req, res) => {
  try {
    const now = Date.now();
    if (cachedAnthropicResult && (now - cachedAnthropicAt) < CACHE_TTL_MS) {
      return res.json(cachedAnthropicResult);
    }
    const data = await fetchAnthropicData();
    cachedAnthropicResult = data;
    cachedAnthropicAt = now;
    res.json(data);
  } catch (e) {
    console.error('Anthropic usage error:', e);
    res.status(500).json({ enabled: false, error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
//  ACTIVITIES — User-to-Agent interaction tracking
// ══════════════════════════════════════════════════════════════════════════════

const ACTIVITIES_PATH = join(dataDir, 'activities.json');

function loadActivities() {
  try {
    if (existsSync(ACTIVITIES_PATH)) return JSON.parse(readFileSync(ACTIVITIES_PATH, 'utf8'));
  } catch (e) { console.error('Failed to load activities:', e.message); }
  return { activities: [], lastUpdated: null };
}

function saveActivities(data) {
  try { writeFileSync(ACTIVITIES_PATH, JSON.stringify(data, null, 2)); }
  catch (e) { console.error('Failed to save activities:', e.message); }
}

// ── POST /api/activities — Log a user-to-agent interaction ────────────────────
// Body: {
//   type: "user-task" | "system" | "cron",        — who initiated
//   requestedBy: "Ed" | "Ron" | "Jewel" | "System",
//   request: "Email Brent Matthews about pricing",  — what they asked
//   title: "Email Brent re pricing",                — short display title
//   actions: [                                       — what Laura did (steps)
//     "Searched inbox for Brent thread",
//     "Drafted reply with pricing update",
//     "Updated Laura Dashboard task T-0147"
//   ],
//   taskId: "T-0147",                               — Master sheet task ID (optional)
//   model: "claude-opus-4-6",
//   inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens,
//   costUsd,                                        — (auto-calculated if missing)
//   timeSavedMin: 15,
// }
app.post('/api/activities', async (req, res) => {
  try {
    const {
      type, requestedBy, request, title, actions, taskId,
      model, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens,
      costUsd, timeSavedMin, timestamp,
      agentId: bodyAgentId, agentName: bodyAgentName,
    } = req.body;
    // Route to correct agent — Darren or Laura
    const activityAgentId = (bodyAgentId === DARREN_AGENT_ID || bodyAgentId === 'darren-abhi-agent')
      ? DARREN_AGENT_ID : LAURA_AGENT_ID;

    if (!title && !request) return res.status(400).json({ error: 'title or request is required' });

    // ── Auto-enrich: find the nearest outbound message with real token data ──
    let realTokens = null;
    try {
      const lookback = new Date(Date.now() - 120_000).toISOString(); // last 2 min
      const msgResult = await pgPool.query(`
        SELECT input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_usd, model
        FROM messages
        WHERE direction = 'outbound'
          AND timestamp >= $1
          AND (input_tokens > 0 OR output_tokens > 0 OR cache_read_tokens > 0)
        ORDER BY timestamp DESC
        LIMIT 1
      `, [lookback]);
      if (msgResult.rows.length > 0) {
        const m = msgResult.rows[0];
        realTokens = {
          inputTokens: Number(m.input_tokens) || 0,
          outputTokens: Number(m.output_tokens) || 0,
          cacheReadTokens: Number(m.cache_read_tokens) || 0,
          cacheWriteTokens: Number(m.cache_write_tokens) || 0,
          costUsd: Number(m.cost_usd) || 0,
          model: m.model || model || 'unknown',
          source: 'plugin-enriched',
        };
      }
    } catch (enrichErr) {
      // Non-fatal — fall back to agent-reported values
      console.warn('Activity enrichment failed:', enrichErr.message);
    }

    // Use real tokens if available, otherwise fall back to agent-reported
    const finalInput  = realTokens ? realTokens.inputTokens     : (inputTokens || 0);
    const finalOutput = realTokens ? realTokens.outputTokens    : (outputTokens || 0);
    const finalCR     = realTokens ? realTokens.cacheReadTokens : (cacheReadTokens || 0);
    const finalCW     = realTokens ? realTokens.cacheWriteTokens: (cacheWriteTokens || 0);
    const finalModel  = realTokens ? realTokens.model           : (model || 'unknown');
    const finalCost   = realTokens
      ? realTokens.costUsd
      : (costUsd != null ? costUsd : estimateCostFromTokens(model || '', inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens));

    const entry = {
      id: `ACT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: type || 'user-task',
      requestedBy: requestedBy || 'Unknown',
      request: request || '',
      title: title || (request || '').slice(0, 80),
      actions: actions || [],
      taskId: taskId || null,
      model: finalModel,
      inputTokens: finalInput,
      outputTokens: finalOutput,
      cacheReadTokens: finalCR,
      cacheWriteTokens: finalCW,
      totalTokens: finalInput + finalOutput + finalCR + finalCW,
      costUsd: Math.round((finalCost || 0) * 10000) / 10000,
      timeSavedMin: timeSavedMin || 0,
      timestamp: timestamp || new Date().toISOString(),
      costSource: realTokens ? 'plugin-enriched' : 'agent-reported',
    };

    // ── Write 1: activities.json (keeps dashboard working) ──
    const data = loadActivities();
    data.activities.push(entry);
    data.lastUpdated = new Date().toISOString();
    saveActivities(data);

    // ── Write 2: PostgreSQL RDS (durable, never lost) ──
    pgWriteActivity({ ...entry, agentId: activityAgentId, category: req.body.category || null, source: entry.costSource });

    res.json({ ok: true, activity: entry });
  } catch (e) {
    console.error('POST /api/activities error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/activities — Dashboard fetches activity feed ─────────────────────
app.get('/api/activities', (req, res) => {
  try {
    const data = loadActivities();
    let activities = data.activities || [];

    // Filters
    if (req.query.type) activities = activities.filter(a => a.type === req.query.type);
    if (req.query.requestedBy) activities = activities.filter(a => (a.requestedBy || '').toLowerCase() === req.query.requestedBy.toLowerCase());
    if (req.query.today === '1') {
      // Filter to today in Eastern Time — convert each activity's UTC timestamp to ET date
      const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); // YYYY-MM-DD
      activities = activities.filter(a => {
        if (!a.timestamp) return false;
        const actDateET = new Date(a.timestamp).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
        return actDateET === todayET;
      });
    } else if (req.query.since) {
      const since = new Date(req.query.since);
      activities = activities.filter(a => new Date(a.timestamp) >= since);
    }

    // Filter out session-tracker auto-entries — cost rows, not real tasks
    const SESSION_TRACKER_NOISE = ['Chat:', 'Group:', 'Delta:', 'Cron:'];
    activities = activities.filter(a => {
      if (a.source === 'session-tracker-v2' || a.source === 'session-tracker') return false;
      if ((a.title || '') === 'Heartbeat / System') return false;
      if (SESSION_TRACKER_NOISE.some(prefix => (a.title || '').startsWith(prefix))) return false;
      return true;
    });

    // Sort newest first
    activities.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

    // Separate user activities from system (background) totals
    const userActivities = activities.filter(a => a.type === 'user-task');
    const systemActivities = activities.filter(a => a.type !== 'user-task');

    // System total = actual Anthropic API usage (the real cost)
    let systemTotalCost = 0, systemTotalTokens = 0;
    for (const a of systemActivities) {
      systemTotalCost += a.costUsd || 0;
      systemTotalTokens += a.totalTokens || 0;
    }

    // User-attributed = what's been tagged to specific user tasks
    let userTotalCost = 0, userTotalTokens = 0, userTimeSaved = 0;
    const byRequester = {};
    for (const a of userActivities) {
      userTotalCost += a.costUsd || 0;
      userTotalTokens += a.totalTokens || 0;
      userTimeSaved += a.timeSavedMin || 0;

      const req = a.requestedBy || 'Unknown';
      if (!byRequester[req]) byRequester[req] = { count: 0, costUsd: 0, tokens: 0 };
      byRequester[req].count++;
      byRequester[req].costUsd += a.costUsd || 0;
      byRequester[req].tokens += a.totalTokens || 0;
    }

    // Unattributed = system total minus what's been claimed by user tasks
    const unattributedCost = Math.max(0, systemTotalCost - userTotalCost);
    const unattributedTokens = Math.max(0, systemTotalTokens - userTotalTokens);

    // Daily breakdown (user activities only — system is the total)
    const byDate = {};
    for (const a of userActivities) {
      const d = (a.timestamp || '').slice(0, 10);
      if (!byDate[d]) byDate[d] = { count: 0, costUsd: 0, tokens: 0, timeSaved: 0 };
      byDate[d].count++;
      byDate[d].costUsd += a.costUsd || 0;
      byDate[d].tokens += a.totalTokens || 0;
      byDate[d].timeSaved += a.timeSavedMin || 0;
    }

    // Model breakdown from system data (actual usage)
    const byModel = {};
    for (const a of systemActivities) {
      const m = a.model || 'unknown';
      if (!byModel[m]) byModel[m] = { tokens: 0, costUsd: 0 };
      byModel[m].tokens += a.totalTokens || 0;
      byModel[m].costUsd += a.costUsd || 0;
    }

    // Round
    systemTotalCost = Math.round(systemTotalCost * 100) / 100;
    userTotalCost = Math.round(userTotalCost * 100) / 100;
    Object.values(byRequester).forEach(v => { v.costUsd = Math.round(v.costUsd * 100) / 100; });
    Object.values(byDate).forEach(v => { v.costUsd = Math.round(v.costUsd * 100) / 100; });
    Object.values(byModel).forEach(v => { v.costUsd = Math.round(v.costUsd * 100) / 100; });

    const avgCostPerTask = userActivities.length > 0 ? Math.round((userTotalCost / userActivities.length) * 100) / 100 : 0;

    res.json({
      // Totals (from Anthropic API — the real number)
      totalCost: systemTotalCost,
      totalTokens: systemTotalTokens,
      // User-attributed portion
      userTaskCount: userActivities.length,
      userTotalCost,
      userTotalTokens,
      userTimeSaved,
      avgCostPerTask,
      // Unattributed (background/overhead)
      unattributedCost: Math.round(unattributedCost * 100) / 100,
      unattributedTokens,
      // Breakdowns
      byRequester,
      byDate,
      byModel,
      // Activities (user tasks only in the feed — system shown separately)
      activities: userActivities,
      systemActivities,
      lastUpdated: data.lastUpdated,
    });
  } catch (e) {
    console.error('GET /api/activities error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ── Legacy: POST /api/tasks/cost (kept for auto-tracker compatibility) ────────
app.post('/api/tasks/cost', (req, res) => {
  try {
    const {
      taskId, taskName, model, description,
      inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, totalTokens,
      costUsd, timeSavedMin, timestamp
    } = req.body;

    if (!taskId) return res.status(400).json({ error: 'taskId is required' });

    const calculatedCost = costUsd != null
      ? costUsd
      : estimateCostFromTokens(model || '', inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens);

    // Also write to activities as a "system" type
    const data = loadActivities();
    const existingIdx = data.activities.findIndex(a => a.taskId === taskId && a.type === 'system');
    
    if (existingIdx >= 0) {
      const existing = data.activities[existingIdx];
      existing.inputTokens = (existing.inputTokens || 0) + (inputTokens || 0);
      existing.outputTokens = (existing.outputTokens || 0) + (outputTokens || 0);
      existing.cacheReadTokens = (existing.cacheReadTokens || 0) + (cacheReadTokens || 0);
      existing.cacheWriteTokens = (existing.cacheWriteTokens || 0) + (cacheWriteTokens || 0);
      existing.totalTokens = existing.inputTokens + existing.outputTokens + existing.cacheReadTokens + existing.cacheWriteTokens;
      existing.costUsd = Math.round((existing.costUsd + calculatedCost) * 10000) / 10000;
      existing.timestamp = timestamp || new Date().toISOString();
      if (taskName) existing.title = taskName;
      if (description) existing.request = description;
      data.activities[existingIdx] = existing;
    } else {
      data.activities.push({
        id: `SYS-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'system',
        requestedBy: 'System',
        request: description || '',
        title: taskName || taskId,
        actions: description ? [description] : [],
        taskId: taskId,
        model: model || 'unknown',
        inputTokens: inputTokens || 0,
        outputTokens: outputTokens || 0,
        cacheReadTokens: cacheReadTokens || 0,
        cacheWriteTokens: cacheWriteTokens || 0,
        totalTokens: (inputTokens || 0) + (outputTokens || 0) + (cacheReadTokens || 0) + (cacheWriteTokens || 0),
        costUsd: Math.round((calculatedCost || 0) * 10000) / 10000,
        timeSavedMin: timeSavedMin || 0,
        timestamp: timestamp || new Date().toISOString(),
      });
    }

    data.lastUpdated = new Date().toISOString();
    saveActivities(data);

    res.json({ ok: true, taskId });
  } catch (e) {
    console.error('POST /api/tasks/cost error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ── Legacy: GET /api/tasks/costs — reads from abhi_tasks for real cost data ──────
app.get('/api/tasks/costs', async (req, res) => {
  try {
    const { rows } = await pgPool.query(`
      SELECT id, title, status, cost_usd AS "costUsd", model,
             input_tokens AS "inputTokens", output_tokens AS "outputTokens",
             total_tokens AS "totalTokens", assigned_at AS "assignedAt",
             completed_at AS "completedAt", agent_id AS "agentId"
      FROM abhi_tasks
      WHERE cost_usd > 0
      ORDER BY assigned_at DESC LIMIT 100
    `);
    res.json({ tasks: rows, lastUpdated: rows[0]?.assignedAt || null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/pricing — Expose model pricing for reference ─────────────────────
app.get('/api/pricing', (_req, res) => {
  res.json(MODEL_PRICING);
});

// ── GET /api/goals — Return Ed's strategic goals ──────────────────────────────
app.get('/api/goals', (req, res) => {
  const goalsPath = join(__dirname, 'data/goals.json');
  try {
    const goals = JSON.parse(readFileSync(goalsPath, 'utf8'));
    res.json(goals);
  } catch (e) {
    console.error('Goals fetch error:', e.message);
    res.status(500).json({ error: 'Failed to load goals', goals: [] });
  }
});

// ── PATCH /api/goals/:id — Update a goal's progress or status ─────────────────
app.patch('/api/goals/:id', (req, res) => {
  const goalsPath = join(__dirname, 'data/goals.json');
  try {
    const data = JSON.parse(readFileSync(goalsPath, 'utf8'));
    const idx = data.goals.findIndex(g => g.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Goal not found' });
    const allowed = ['progress', 'status', 'milestones'];
    allowed.forEach(k => { if (req.body[k] !== undefined) data.goals[idx][k] = req.body[k]; });
    data.lastUpdated = new Date().toISOString().split('T')[0];
    writeFileSync(goalsPath, JSON.stringify(data, null, 2));
    res.json({ ok: true, goal: data.goals[idx] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/goals — Create a new goal ────────────────────────────────────────
app.post('/api/goals', (req, res) => {
  const goalsPath = join(__dirname, 'data/goals.json');
  try {
    const data = JSON.parse(readFileSync(goalsPath, 'utf8'));
    const id = 'goal-' + Date.now();
    const goal = {
      id,
      company:      req.body.company || 'Bold Business',
      category:     req.body.category || 'Growth',
      priority:     req.body.priority || 'high',
      icon:         req.body.icon || '🎯',
      title:        req.body.title || 'New Goal',
      subtitle:     req.body.subtitle || '',
      description:  req.body.description || '',
      status:       req.body.status || 'planning',
      progress:     req.body.progress || 0,
      targetDate:   req.body.targetDate || '',
      initiatives:  req.body.initiatives || [],
      keyPeople:    req.body.keyPeople || [],
      taskKeywords: req.body.taskKeywords || [],
      milestones:   req.body.milestones || [],
    };
    data.goals.push(goal);
    data.lastUpdated = new Date().toISOString().split('T')[0];
    writeFileSync(goalsPath, JSON.stringify(data, null, 2));
    res.json({ ok: true, goal });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /api/goals/:id — Full update a goal ─────────────────────────────────
app.put('/api/goals/:id', (req, res) => {
  const goalsPath = join(__dirname, 'data/goals.json');
  try {
    const data = JSON.parse(readFileSync(goalsPath, 'utf8'));
    const idx = data.goals.findIndex(g => g.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Goal not found' });
    const fields = ['company','category','priority','icon','title','subtitle','description','status','progress','targetDate','initiatives','keyPeople','taskKeywords','milestones'];
    fields.forEach(k => { if (req.body[k] !== undefined) data.goals[idx][k] = req.body[k]; });
    data.lastUpdated = new Date().toISOString().split('T')[0];
    writeFileSync(goalsPath, JSON.stringify(data, null, 2));
    res.json({ ok: true, goal: data.goals[idx] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /api/goals/:id — Delete a goal ──────────────────────────────────
app.delete('/api/goals/:id', (req, res) => {
  const goalsPath = join(__dirname, 'data/goals.json');
  try {
    const data = JSON.parse(readFileSync(goalsPath, 'utf8'));
    const idx = data.goals.findIndex(g => g.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Goal not found' });
    data.goals.splice(idx, 1);
    data.lastUpdated = new Date().toISOString().split('T')[0];
    writeFileSync(goalsPath, JSON.stringify(data, null, 2));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/cost/today — Accurate real-time cost from Anthropic hourly API ──
let costTodayCache = null;
let costTodayCacheAt = 0;
const COST_CACHE_TTL = 300_000; // 5 min

// GET /api/cost/today — Laura-only cost from Anthropic usage_report (filtered by API key)
// Uses usage_report/messages with api_key_ids[] filter + our pricing table to calculate cost.
// cost_report does NOT support api_key_ids filtering and only supports bucket_width=1d,
// so we derive cost from token counts instead for accuracy.
app.get('/api/cost/today', async (_req, res) => {
  try {
    const now = Date.now();
    if (costTodayCache && (now - costTodayCacheAt) < COST_CACHE_TTL) {
      return res.json(costTodayCache);
    }

    if (!ANTHROPIC_ADMIN_API_KEY) {
      return res.json({ error: 'No admin API key' });
    }

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);

    const headers = {
      'anthropic-version': '2023-06-01',
      'x-api-key': ANTHROPIC_ADMIN_API_KEY,
    };

    // Build URL — filter by Laura API key + group by model for accurate pricing
    let url = `${ANTHROPIC_BASE}/v1/organizations/usage_report/messages?` +
      `starting_at=${encodeURIComponent(todayStart.toISOString())}` +
      `&ending_at=${encodeURIComponent(todayEnd.toISOString())}` +
      `&bucket_width=1h` +
      `&group_by[]=model`;

    if (ANTHROPIC_AGENT_API_KEY_ID) {
      url += `&api_key_ids[]=${encodeURIComponent(ANTHROPIC_AGENT_API_KEY_ID)}`;
    }
    if (ANTHROPIC_WORKSPACE_ID) {
      url += `&workspace_ids[]=${encodeURIComponent(ANTHROPIC_WORKSPACE_ID)}`;
    }

    const resp = await fetch(url, { headers });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Usage API HTTP ${resp.status}: ${body.slice(0, 300)}`);
    }
    const data = await resp.json();

    let totalIn = 0, totalOut = 0, totalCR = 0, totalCW = 0;
    let totalCostUsd = 0;
    const hourly = [];
    const byModel = {};

    for (const bucket of (data.data || [])) {
      for (const r of (bucket.results || [])) {
        const model = r.model || 'unknown';
        const inp = r.uncached_input_tokens || 0;
        const out = r.output_tokens || 0;
        const cr = r.cache_read_input_tokens || 0;
        let cw = 0;
        if (r.cache_creation) {
          cw += r.cache_creation.ephemeral_1h_input_tokens || 0;
          cw += r.cache_creation.ephemeral_5m_input_tokens || 0;
        }

        totalIn += inp;
        totalOut += out;
        totalCR += cr;
        totalCW += cw;

        // Calculate cost using our pricing table
        const cost = estimateCostFromTokens(model, inp, out, cr, cw);
        totalCostUsd += cost;

        // Track per-model
        if (!byModel[model]) byModel[model] = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0 };
        byModel[model].inputTokens += inp;
        byModel[model].outputTokens += out;
        byModel[model].cacheReadTokens += cr;
        byModel[model].cacheWriteTokens += cw;
        byModel[model].costUsd += cost;

        if (inp + out + cr + cw > 0) {
          hourly.push({
            hour: (bucket.starting_at || '').slice(11, 16),
            model,
            input: inp, output: out, cacheRead: cr, cacheWrite: cw,
            costUsd: Math.round(cost * 10000) / 10000,
          });
        }
      }
    }

    // Try to get actual cost from cost_report (finalized billing)
    let billingCost = null;
    let costSource = 'estimate';
    try {
      let costUrl = `${ANTHROPIC_BASE}/v1/organizations/cost_report?starting_at=${encodeURIComponent(todayStart.toISOString())}&ending_at=${encodeURIComponent(todayEnd.toISOString())}&bucket_width=1d`;
      if (ANTHROPIC_WORKSPACE_ID) {
        costUrl += `&workspace_ids[]=${encodeURIComponent(ANTHROPIC_WORKSPACE_ID)}`;
      }
      const costResp = await fetch(costUrl, { headers });
      if (costResp.ok) {
        const costData = await costResp.json();
        let sum = 0;
        for (const b of (costData.data || [])) {
          for (const r of (b.results || [])) {
            sum += parseFloat(r.amount || '0');
          }
        }
        if (sum > 0) {
          billingCost = Math.round(sum) / 100; // cents to dollars
          costSource = 'anthropic-billing';
        }
      }
    } catch {}

    // If no billing data yet, use our token-based estimate with calibration factor
    // Calibration: yesterday's actual/estimate ratio = 0.823 (Anthropic bills less than published rates)
    const CALIBRATION_FACTOR = 0.82;
    const estimatedCost = Math.round(totalCostUsd * CALIBRATION_FACTOR * 100) / 100;
    const finalCost = billingCost || estimatedCost;

    // Apply calibration to model costs too (when using estimates)
    const appliedFactor = billingCost ? 1 : CALIBRATION_FACTOR;
    for (const m of Object.keys(byModel)) {
      byModel[m].costUsd = Math.round(byModel[m].costUsd * appliedFactor * 100) / 100;
    }

    // ── Session-based cost attribution ──────────────────────────────────
    // Read session tracker state to attribute real API cost to categories
    // Uses daily snapshots for today-only deltas (not cumulative all-time).
    const SESSION_STATE_PATH = join(dataDir, 'session-tracker-state.json');
    const DAILY_SNAPSHOT_PATH = join(dataDir, 'session-daily-snapshots.json');
    let costByCategory = { user: 0, routine: 0, developer: 0 };
    let categorySource = 'none';
    try {
      if (existsSync(SESSION_STATE_PATH)) {
        const sessData = JSON.parse(readFileSync(SESSION_STATE_PATH, 'utf8'));
        const sessions = sessData.sessions || {};

        // Load today's baseline (start-of-day snapshot = yesterday's end-of-day totals)
        // The snapshot for "today" is taken at midnight rollover and represents
        // cumulative totals at that point — so today's usage = current - baseline.
        let baseline = null;
        const todayStr = todayStart.toISOString().slice(0, 10);
        try {
          if (existsSync(DAILY_SNAPSHOT_PATH)) {
            const snaps = JSON.parse(readFileSync(DAILY_SNAPSHOT_PATH, 'utf8'));
            // Use today's snapshot as baseline (captured at first run after midnight)
            baseline = snaps.snapshots?.[todayStr] || null;
          }
        } catch {}
        const useDeltas = baseline !== null;

        const catTokens = { user: 0, routine: 0, developer: 0 };
        let totalSessTokens = 0;

        for (const [name, s] of Object.entries(sessions)) {
          // Compute today-only delta if baseline exists, else use cumulative
          let t;
          if (useDeltas) {
            const base = baseline[name] || { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
            t = Math.max(0, (s.input || 0) - base.input)
              + Math.max(0, (s.output || 0) - base.output)
              + Math.max(0, (s.cacheRead || 0) - base.cacheRead)
              + Math.max(0, (s.cacheWrite || 0) - base.cacheWrite);
          } else {
            t = (s.input || 0) + (s.output || 0) + (s.cacheRead || 0) + (s.cacheWrite || 0);
          }
          if (t < 100) continue;

          // Classify by session name pattern
          let cat = 'routine'; // default: background/unknown → routine
          if (name.includes(':cron:')) cat = 'routine';
          else if (name.includes('ir_hmsaaaae')) cat = 'user';     // Ed's DM space
          else if (name.includes('79zumsaaaae')) cat = 'developer'; // Ron's DM space
          else if (name.includes('aaqacuwn39y')) cat = 'developer'; // Laura Tech Team
          else if (name.includes('kbbx1saaaae')) cat = 'developer'; // Jewel's DM space

          catTokens[cat] += t;
          totalSessTokens += t;
        }

        if (totalSessTokens > 0 && finalCost > 0) {
          costByCategory.user = Math.round(finalCost * (catTokens.user / totalSessTokens) * 100) / 100;
          costByCategory.routine = Math.round(finalCost * (catTokens.routine / totalSessTokens) * 100) / 100;
          costByCategory.developer = Math.round(finalCost * (catTokens.developer / totalSessTokens) * 100) / 100;
          // Ensure they sum exactly to finalCost (assign rounding remainder to routine)
          const catSum = costByCategory.user + costByCategory.routine + costByCategory.developer;
          costByCategory.routine = Math.round((costByCategory.routine + (finalCost - catSum)) * 100) / 100;
          categorySource = 'session-tracker-daily';
        }
      }
    } catch (e) {
      console.warn('Session-based cost attribution failed:', e.message);
    }

    // ── Per-agent cost split ────────────────────────────────────────────────
    // Laura: from Anthropic API (filtered by API key) — real-time accurate
    // Darren: from agent_activities sum today — real logged costs from log_darren_activity.py
    let costByAgent = { laura: finalCost, darren: 0, darrenSource: 'no-data' };
    try {
      const todayStr = todayStart.toISOString().slice(0, 10);

      // Laura cost = the Anthropic API figure (already computed as finalCost)
      costByAgent.laura = finalCost;

      // Darren cost = sum of cost_usd logged to agent_activities today
      const darrenActR = await pgPool.query(
        `SELECT COALESCE(SUM(cost_usd), 0) as total, COUNT(*) as cnt
         FROM agent_activities
         WHERE agent_id = $1 AND DATE(created_at) = $2 AND cost_usd > 0`,
        [DARREN_AGENT_ID, todayStr]
      );
      const darrenFromActs = parseFloat(darrenActR.rows[0]?.total || 0);
      const darrenActCount = parseInt(darrenActR.rows[0]?.cnt || 0);

      // Fall back to snapshot if no activities logged today
      if (darrenFromActs > 0) {
        costByAgent.darren = Math.round(darrenFromActs * 10000) / 10000;
        costByAgent.darrenSource = 'activities';
        costByAgent.darrenActivityCount = darrenActCount;
      } else {
        // Check snapshot as fallback
        const snapR = await pgPool.query(
          `SELECT total_cost_usd, source FROM agent_cost_snapshots
           WHERE agent_id = $1 AND snapshot_date = $2`,
          [DARREN_AGENT_ID, todayStr]
        );
        if (snapR.rows.length > 0 && parseFloat(snapR.rows[0].total_cost_usd) > 0) {
          costByAgent.darren = parseFloat(snapR.rows[0].total_cost_usd);
          costByAgent.darrenSource = snapR.rows[0].source || 'snapshot';
        } else {
          costByAgent.darren = 0;
          costByAgent.darrenSource = 'no-activity-today';
        }
      }
    } catch (e) { console.warn('costByAgent split failed:', e.message); }

    const result = {
      date: todayStart.toISOString().slice(0, 10),
      filteredByApiKey: !!ANTHROPIC_AGENT_API_KEY_ID,
      apiKeyId: ANTHROPIC_AGENT_API_KEY_ID || null,
      filteredByWorkspace: !!ANTHROPIC_WORKSPACE_ID,
      workspaceId: ANTHROPIC_WORKSPACE_ID || null,
      tokens: { input: totalIn, output: totalOut, cacheRead: totalCR, cacheWrite: totalCW },
      actualCostUsd: finalCost,
      costByAgent,
      costSource,
      rawEstimate: Math.round(totalCostUsd * 100) / 100,
      calibrationFactor: billingCost ? null : CALIBRATION_FACTOR,
      costByCategory,
      categorySource,
      byModel,
      hourly,
      fetchedAt: new Date().toISOString(),
    };

    costTodayCache = result;
    costTodayCacheAt = now;
    res.json(result);
  } catch (e) {
    console.error('GET /api/cost/today error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
//  POSTGRES QUERY ENDPOINTS
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/pg/activities — query activities from Postgres with rich filters
app.get('/api/pg/activities', async (req, res) => {
  try {
    const { today, category, requestedBy, limit = 200, offset = 0, days = 7 } = req.query;

    let where = [];
    const params = [];

    if (today === '1') {
      // No param needed — CURRENT_DATE is a SQL constant
      where.push(`timestamp AT TIME ZONE 'America/New_York' >= CURRENT_DATE`);
    } else if (days) {
      params.push(Number(days));
      where.push(`timestamp >= NOW() - ($${params.length} || ' days')::INTERVAL`);
    }

    if (category) {
      params.push(category);
      where.push(`category = $${params.length}`);
    }
    if (requestedBy) {
      params.push(requestedBy);
      where.push(`requested_by = $${params.length}`);
    }

    // Always exclude session-tracker auto-entries from task lists.
    // These are cost-attribution rows, not real tasks.
    // Kept in DB for cost totals but never shown in activity feeds.
    where.push(`(source IS NULL OR source NOT IN ('session-tracker-v2', 'session-tracker'))`);
    where.push(`title NOT LIKE 'Chat:%'`);
    where.push(`title NOT LIKE 'Group:%'`);
    where.push(`title NOT LIKE 'Delta:%'`);
    where.push(`title NOT LIKE 'Cron:%'`);
    where.push(`title != 'Heartbeat / System'`);

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(Number(limit), Number(offset));

    const result = await pgPool.query(`
      SELECT
        id, type, category, requested_by as "requestedBy", title, request,
        actions, task_id as "taskId", model,
        input_tokens as "inputTokens", output_tokens as "outputTokens",
        cache_read_tokens as "cacheReadTokens", cache_write_tokens as "cacheWriteTokens",
        total_tokens as "totalTokens", cost_usd as "costUsd",
        time_saved_min as "timeSavedMin", source, session_key as "sessionKey",
        timestamp
      FROM activities
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    // Summary stats
    const stats = await pgPool.query(`
      SELECT
        COUNT(*)::int                        AS total,
        COALESCE(SUM(cost_usd),0)::float     AS total_cost,
        COALESCE(SUM(time_saved_min),0)::int AS total_time_saved,
        COUNT(*) FILTER (WHERE category = 'user-generated')::int  AS user_count,
        COUNT(*) FILTER (WHERE category = 'developer')::int       AS dev_count,
        COUNT(*) FILTER (WHERE category = 'routine')::int         AS routine_count,
        COALESCE(SUM(cost_usd) FILTER (WHERE category = 'user-generated'),0)::float AS user_cost,
        COALESCE(SUM(cost_usd) FILTER (WHERE category = 'developer'),0)::float      AS dev_cost,
        COALESCE(SUM(cost_usd) FILTER (WHERE category = 'routine'),0)::float        AS routine_cost
      FROM activities
      ${whereClause}
    `, params.slice(0, params.length - 2));

    const s = stats.rows[0];

    // Pull actual cost from best available source
    let anthropicCost = null;
    const daysParam = params.length >= 2 ? Number(params[0]) : 7;
    try {
      // Always fetch today's live cost (same source as ROI tab)
      let todayCost = null;
      {
        try {
          const costResp = await fetch(`http://127.0.0.1:${PORT}/api/cost/today`, {
            headers: { 'Authorization': req.headers.authorization || '' },
          });
          if (costResp.ok) {
            const cd = await costResp.json();
            if (cd.actualCostUsd > 0) {
              todayCost = {
                total: Math.round(cd.actualCostUsd * 100) / 100,
                user: Math.round((cd.costByCategory?.user || 0) * 100) / 100,
                routine: Math.round((cd.costByCategory?.routine || 0) * 100) / 100,
                developer: Math.round((cd.costByCategory?.developer || 0) * 100) / 100,
                source: 'live-session-tracker',
              };
            }
          }
        } catch (e) { /* live fetch failed, fall through to snapshots */ }
      }

      // For multi-day views: pull historical snapshots (excluding today)
      let histTotal = 0, sr = { user_cost: 0, routine_cost: 0, dev_cost: 0 };
      if (daysParam > 1) {
        const snap = await pgPool.query(`
          SELECT COALESCE(SUM(total_cost_usd),0)::float AS total,
                 COALESCE(SUM(user_cost_usd),0)::float AS user_cost,
                 COALESCE(SUM(routine_cost_usd),0)::float AS routine_cost,
                 COALESCE(SUM(developer_cost_usd),0)::float AS dev_cost
          FROM cost_snapshots
          WHERE snapshot_date >= CURRENT_DATE - ($1 || ' days')::INTERVAL
            AND snapshot_date < CURRENT_DATE
        `, [daysParam]);
        sr = snap.rows[0] || sr;
        histTotal = sr.total || 0;
      }

      if (todayCost && histTotal > 0) {
        // Multi-day: today's live + historical snapshots
        anthropicCost = {
          total: Math.round((todayCost.total + histTotal) * 100) / 100,
          user: Math.round((todayCost.user + (sr.user_cost || 0)) * 100) / 100,
          routine: Math.round((todayCost.routine + (sr.routine_cost || 0)) * 100) / 100,
          developer: Math.round((todayCost.developer + (sr.dev_cost || 0)) * 100) / 100,
          source: 'live+snapshots',
        };
      } else if (todayCost) {
        // Today only
        anthropicCost = todayCost;
      } else if (histTotal > 0) {
        // Snapshots only (live unavailable)
        anthropicCost = {
          total: Math.round(histTotal * 100) / 100,
          user: Math.round((sr.user_cost || 0) * 100) / 100,
          routine: Math.round((sr.routine_cost || 0) * 100) / 100,
          developer: Math.round((sr.dev_cost || 0) * 100) / 100,
          source: 'anthropic-api',
        };
      }
    } catch (e) { /* cost data unavailable */ }

    res.json({
      activities: result.rows,
      summary: {
        total: s.total,
        totalCost: anthropicCost ? anthropicCost.total.toFixed(4) : parseFloat(s.total_cost).toFixed(4),
        totalTimeSaved: s.total_time_saved,
        byCategory: {
          userGenerated: { count: s.user_count, cost: anthropicCost ? anthropicCost.user.toFixed(4) : parseFloat(s.user_cost).toFixed(4) },
          developer:     { count: s.dev_count,  cost: anthropicCost ? anthropicCost.developer.toFixed(4) : parseFloat(s.dev_cost).toFixed(4) },
          routine:       { count: s.routine_count, cost: anthropicCost ? anthropicCost.routine.toFixed(4) : parseFloat(s.routine_cost).toFixed(4) },
        },
        costSource: anthropicCost ? 'anthropic-api' : 'activity-self-report',
      },
      source: 'postgresql',
    });
  } catch (e) {
    console.error('GET /api/pg/activities error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/pg/summary — daily/weekly cost + task summary from Postgres
app.get('/api/pg/summary', async (req, res) => {
  try {
    const result = await pgPool.query(`
      SELECT
        DATE(timestamp AT TIME ZONE 'America/New_York') AS day,
        category,
        COUNT(*)::int                        AS tasks,
        COALESCE(SUM(cost_usd),0)::float     AS cost,
        COALESCE(SUM(time_saved_min),0)::int AS time_saved,
        COALESCE(SUM(total_tokens),0)::bigint AS tokens
      FROM activities
      WHERE timestamp >= NOW() - INTERVAL '30 days'
      GROUP BY day, category
      ORDER BY day DESC, category
    `);

    res.json({ rows: result.rows, source: 'postgresql' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/pg/health — confirm Postgres connection is alive
app.get('/api/pg/health', async (req, res) => {
  try {
    const r = await pgPool.query('SELECT COUNT(*) as total FROM activities');
    res.json({ ok: true, totalActivities: parseInt(r.rows[0].total), source: 'postgresql' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Dashboard Chat Routes ─────────────────────────────────────────────────────
import { exec } from 'child_process';

// ── Dashboard chat — routes through the OpenClaw gateway (full agent) ─────────
// Falls back to lightweight Anthropic Haiku if the gateway is unavailable.
const ANTHROPIC_CHAT_KEY    = process.env.ANTHROPIC_API_KEY || '';
const OPENCLAW_GATEWAY_URL  = 'http://127.0.0.1:18789/v1/chat/completions';
const OPENCLAW_GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || '';

/**
 * callGateway — send a dashboard chat message to the full OpenClaw agent.
 * Uses /v1/chat/completions with a stable per-session user key so each
 * dashboard chat session maps to its own isolated gateway session.
 * Returns the agent reply text, or null on failure.
 */
async function callGateway(sessionId, taskRef, userMessage, agentName = 'laura') {
  if (!OPENCLAW_GATEWAY_TOKEN) return null;

  const agentId = agentName === 'darren' ? 'darren' : 'main';
  // Stable session key = one isolated session per dashboard chat session per agent
  const userKey = `dashboard-${agentName}-${sessionId}`;

  // Prefix the message with dashboard page context so the agent knows where the user is
  let enrichedMessage = userMessage;
  if (taskRef) {
    enrichedMessage = `[Dashboard — ${taskRef} page]\n\n${userMessage}`;
  }

  try {
    const resp = await fetch(OPENCLAW_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENCLAW_GATEWAY_TOKEN}`,
        'Content-Type': 'application/json',
        'x-openclaw-agent-id': agentId,
      },
      body: JSON.stringify({
        model: `openclaw:${agentId}`,
        messages: [{ role: 'user', content: enrichedMessage }],
        user: userKey,
        max_tokens: 2048,
      }),
      signal: AbortSignal.timeout(120_000), // 2 min — allows tool use
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      console.warn(`[chat-gateway] HTTP ${resp.status}:`, errText.slice(0, 200));
      return null;
    }

    const data = await resp.json();
    return data?.choices?.[0]?.message?.content || null;
  } catch (e) {
    console.warn('[chat-gateway] error:', e.message);
    return null;
  }
}

/**
 * callLauraFallback — lightweight Haiku fallback when gateway is unavailable.
 * Preserves the original inline Anthropic logic.
 */
async function callLauraFallback(sessionId, taskRef, userMessage, agentName = 'laura') {
  if (!ANTHROPIC_CHAT_KEY) return null;
  try {
    const histRes = await pgPool.query(
      `SELECT sender, message FROM dashboard_chat
       WHERE (task_ref = $1 OR (task_ref IS NULL AND session_id = $2))
       ORDER BY timestamp DESC LIMIT 10`,
      [taskRef || null, sessionId]
    );
    const history = histRes.rows.reverse().map(r => ({
      role: r.sender === 'ed' ? 'user' : 'assistant',
      content: r.message,
    }));

    const systemPrompt = agentName === 'darren'
      ? `You are Darren, a Bold Business SDR focused on DWDM network technology and BEAD broadband outreach. Keep responses concise and actionable.`
      : `You are Laura, a Bold Business SDR assistant for Abhinanda's outreach to construction tech professionals (CET Designers, Estimators, BIM Modelers, Sales Coordinators). Keep responses concise and actionable.`;

    history.push({ role: 'user', content: userMessage });

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_CHAT_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 512, system: systemPrompt, messages: history }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data?.content?.[0]?.text || null;
  } catch (e) {
    console.warn('[chat-fallback] error:', e.message);
    return null;
  }
}

/**
 * callLauraInline — main chat handler.
 * 1. Check dashboard action intent (fast-path: campaign briefs, tasks, calls)
 * 2. Check sheet update intent (fast-path, no AI needed)
 * 3. Try full OpenClaw gateway (all tools, full memory, Sonnet model)
 * 4. Fall back to lightweight Haiku if gateway is down
 */
async function callLauraInline(sessionId, taskRef, taskContext, userMessage, agentName = 'laura') {
  try {
    // ── Dashboard Action Intent (fast path — CRUD on dashboard data) ──────────
    const dashHandled = await handleDashboardIntent(userMessage, sessionId, taskRef, agentName, pgPool);
    if (dashHandled !== null) return;

    // ── Sheet Update Intent (fast path — skip AI entirely) ─────────────────
    if (agentName !== 'darren') {
      const intentHandled = await handleSheetUpdateIntent(userMessage, sessionId, taskRef, agentName, pgPool);
      if (intentHandled !== null) return;
    }

    // ── Route through full OpenClaw gateway ─────────────────────────────────
    console.log(`[chat] routing to gateway (agent=${agentName}, taskRef=${taskRef})`);
    let reply = await callGateway(sessionId, taskRef, userMessage, agentName);

    // ── Fallback to Haiku if gateway unavailable ─────────────────────────────
    if (!reply) {
      console.warn('[chat] gateway unavailable — falling back to Haiku');
      reply = await callLauraFallback(sessionId, taskRef, userMessage, agentName);
    }

    if (!reply) {
      console.warn('[chat] both gateway and fallback failed');
      return;
    }

    // ── Store reply in dashboard_chat ────────────────────────────────────────
    await pgPool.query(
      `INSERT INTO dashboard_chat (session_id, sender, task_ref, message, agent_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [sessionId, agentName || 'laura', taskRef || null, reply, agentName || 'laura']
    );

    await pgPool.query(
      `UPDATE chat_sessions SET updated_at=NOW(), message_count=message_count+1, last_message=$1 WHERE id=$2`,
      [reply.slice(0, 120), sessionId]
    ).catch(() => {});

  } catch (e) {
    console.error('[chat-inline] error:', e.message);
  }
}


// ── Chat Session Management ────────────────────────────────────────────────

/** GET /api/chat-sessions — list sessions for an agent */
app.get('/api/chat-sessions', async (req, res) => {
  const { agent = 'laura', user_id, limit = 20 } = req.query;
  try {
    const r = await pgPool.query(
      `SELECT id, agent_id, user_id, task_ref, title, created_at, updated_at, message_count, last_message
       FROM chat_sessions WHERE agent_id = $1
       ORDER BY updated_at DESC LIMIT $2`,
      [agent, parseInt(limit)]
    );
    res.json({ ok: true, sessions: r.rows });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

/** POST /api/chat-sessions — create new session */
app.post('/api/chat-sessions', async (req, res) => {
  const { agent_id = 'laura', user_id, task_ref, title } = req.body;
  try {
    const r = await pgPool.query(
      `INSERT INTO chat_sessions (agent_id, user_id, task_ref, title)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [agent_id, user_id || null, task_ref || null, title || (agent_id + ' chat')]
    );
    res.json({ ok: true, session: r.rows[0] });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

/** GET /api/chat-sessions/:id/messages */
app.get('/api/chat-sessions/:id/messages', async (req, res) => {
  const { limit = 100, since } = req.query;
  const q = since
    ? ['SELECT id,session_id,sender,task_ref,message,agent_id,cost_usd,input_tokens,output_tokens,timestamp FROM dashboard_chat WHERE session_id=$1 AND timestamp>$3 ORDER BY timestamp ASC LIMIT $2', [req.params.id, parseInt(limit), since]]
    : ['SELECT id,session_id,sender,task_ref,message,agent_id,cost_usd,input_tokens,output_tokens,timestamp FROM dashboard_chat WHERE session_id=$1 ORDER BY timestamp ASC LIMIT $2', [req.params.id, parseInt(limit)]];
  try {
    const r = await pgPool.query(...q);
    res.json({ ok: true, messages: r.rows });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/api/chat/message', async (req, res) => {
  try {
    const { sessionId, taskRef, message, taskContext, agentName } = req.body;
    if (!sessionId || !message) return res.status(400).json({ ok: false, error: 'sessionId and message required' });
    const r = await pgPool.query(
      'INSERT INTO dashboard_chat (session_id, sender, task_ref, message) VALUES ($1, $2, $3, $4) RETURNING id',
      [sessionId, 'ed', taskRef || null, message]
    );
    // Respond to client immediately, then call Anthropic inline (non-blocking)
    res.json({ ok: true, id: r.rows[0].id });
    // Fire inline Laura response — no await, runs in background
    callLauraInline(sessionId, taskRef, taskContext, message, agentName || 'laura').catch(e =>
      console.error('[chat-inline] uncaught:', e.message)
    );
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/chat/messages', async (req, res) => {
  try {
    const { sessionId, taskRef, since } = req.query;
    const sinceTs = since || '1970-01-01T00:00:00Z';
    let r;
    if (taskRef) {
      // Per-task thread: filter by task_ref regardless of session
      r = await pgPool.query(
        'SELECT id, sender, task_ref AS "taskRef", message, timestamp FROM dashboard_chat WHERE task_ref=$1 AND timestamp > $2 ORDER BY timestamp ASC',
        [taskRef, sinceTs]
      );
    } else if (sessionId) {
      // Legacy session-based query
      r = await pgPool.query(
        'SELECT id, sender, task_ref AS "taskRef", message, timestamp FROM dashboard_chat WHERE session_id=$1 AND timestamp > $2 ORDER BY timestamp ASC',
        [sessionId, sinceTs]
      );
    } else {
      // Global query (used for unread badge polling — no filter, just since timestamp)
      r = await pgPool.query(
        'SELECT id, sender, task_ref AS "taskRef", message, timestamp FROM dashboard_chat WHERE timestamp > $1 ORDER BY timestamp ASC',
        [sinceTs]
      );
    }
    res.json({ messages: r.rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/chat/respond', async (req, res) => {
  try {
    const { sessionId, taskRef, message } = req.body;
    if (!sessionId || !message) return res.status(400).json({ ok: false, error: 'sessionId and message required' });
    const r = await pgPool.query(
      'INSERT INTO dashboard_chat (session_id, sender, task_ref, message) VALUES ($1, $2, $3, $4) RETURNING id',
      [sessionId, 'laura', taskRef || null, message]
    );
    res.json({ ok: true, id: r.rows[0].id });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// bb_agents API — shared RDS endpoints
// ════════════════════════════════════════════════════════════════════════════

/** GET /api/bb/status — connection health + agent info */
/** GET /api/agents/avatars — avatar URLs for all agents from agent_registry */
app.get('/api/agents/avatars', async (_req, res) => {
  try {
    const r = await bbPool.query(
      `SELECT agent_id, agent_name, avatar_url FROM agent_registry WHERE avatar_url IS NOT NULL ORDER BY agent_id`
    );
    // Shape into a convenient lookup map: { 'laura-abhi-agent': { name, avatarUrl }, ... }
    const map = {};
    for (const row of r.rows) {
      map[row.agent_id] = { name: row.agent_name, avatarUrl: row.avatar_url };
    }
    res.json({ ok: true, agents: map });
  } catch (e) {
    res.status(503).json({ ok: false, error: e.message });
  }
});

app.get('/api/bb/status', async (_req, res) => {
  try {
    const c = await bbPool.connect();
    const r = await c.query('SELECT * FROM agent_registry WHERE agent_id = $1', [LAURA_AGENT_ID]);
    c.release();
    res.json({ ok: true, agent: r.rows[0] || null, db: BB_AGENTS_DB, host: BB_AGENTS_HOST });
  } catch (e) {
    res.status(503).json({ ok: false, error: e.message });
  }
});

/** GET /api/bb/activities?limit=50&agent=laura|darren — recent activities */
app.get('/api/bb/activities', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const agentId = req.query.agent === 'darren' ? DARREN_AGENT_ID : LAURA_AGENT_ID;
  try {
    const r = await bbPool.query(
      `SELECT * FROM agent_activities WHERE agent_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [agentId, limit]
    );
    res.json({ ok: true, activities: r.rows, count: r.rows.length });
  } catch (e) {
    res.status(503).json({ ok: false, error: e.message });
  }
});

/** POST /api/bb/activities — log an activity
 *  Body may include: agentId | agent ('laura'|'darren') to route correctly.
 */
app.post('/api/bb/activities', async (req, res) => {
  try {
    const body = { ...req.body };
    // Resolve agentId from shorthand 'agent' field if caller used that
    if (!body.agentId && body.agent) {
      body.agentId = body.agent === 'darren' ? DARREN_AGENT_ID : LAURA_AGENT_ID;
    }
    await bbLogActivity(body);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/** GET /api/bb/cost-snapshots — recent daily cost snapshots (supports ?agent_id=, ?date_from=, ?date_to=, ?days=) */
app.get('/api/bb/cost-snapshots', async (req, res) => {
  const agentId  = req.query.agent_id || LAURA_AGENT_ID;
  const dateFrom = req.query.date_from || null;
  const dateTo   = req.query.date_to   || null;
  const days     = Math.min(parseInt(req.query.days) || 14, 90);
  try {
    let r;
    if (dateFrom && dateTo) {
      r = await bbPool.query(
        `SELECT * FROM agent_cost_snapshots WHERE agent_id = $1
         AND snapshot_date >= $2::date AND snapshot_date <= $3::date
         ORDER BY snapshot_date DESC`,
        [agentId, dateFrom, dateTo]
      );
    } else {
      r = await bbPool.query(
        `SELECT * FROM agent_cost_snapshots WHERE agent_id = $1
         AND snapshot_date >= NOW() - ($2 || ' days')::INTERVAL
         ORDER BY snapshot_date DESC`,
        [agentId, days]
      );
    }
    const totalCost = r.rows.reduce((s, row) => s + (Number(row.total_cost_usd) || 0), 0);
    res.json({ ok: true, snapshots: r.rows, agentId, totalCost: Math.round(totalCost * 10000) / 10000 });
  } catch (e) {
    res.status(503).json({ ok: false, error: e.message });
  }
});

/** GET /api/bb/tasks — active tasks */
app.get('/api/bb/tasks', async (req, res) => {
  try {
    const r = await bbPool.query(
      `SELECT * FROM agent_tasks WHERE agent_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [LAURA_AGENT_ID]
    );
    res.json({ ok: true, tasks: r.rows });
  } catch (e) {
    res.status(503).json({ ok: false, error: e.message });
  }
});

/** POST /api/bb/tasks — create a task */
app.post('/api/bb/tasks', async (req, res) => {
  const { title, description, createdBy, priority, status } = req.body;
  try {
    const r = await bbPool.query(
      `INSERT INTO agent_tasks (id, agent_id, title, description, created_by, priority, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [randomUUID(), LAURA_AGENT_ID, title||'Untitled', description||'', createdBy||'system', priority||'normal', status||'pending']
    );
    res.json({ ok: true, task: r.rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/** PATCH /api/bb/tasks/:id — update task status/cost */
app.patch('/api/bb/tasks/:id', async (req, res) => {
  const { status, totalCostUsd, totalTokens } = req.body;
  try {
    const sets = []; const vals = [req.params.id];
    if (status !== undefined)       { sets.push(`status = $${vals.push(status)}`); }
    if (totalCostUsd !== undefined) { sets.push(`total_cost_usd = $${vals.push(totalCostUsd)}`); }
    if (totalTokens !== undefined)  { sets.push(`total_tokens = $${vals.push(totalTokens)}`); }
    if (status === 'completed')     { sets.push(`completed_at = NOW()`); }
    sets.push(`updated_at = NOW()`);
    if (sets.length === 1) return res.json({ ok: true, noop: true });
    const r = await bbPool.query(
      `UPDATE agent_tasks SET ${sets.join(', ')} WHERE id = $1 AND agent_id = $2 RETURNING *`,
      [...vals, LAURA_AGENT_ID]
    );
    res.json({ ok: true, task: r.rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// LAURA ACTIVITY ROUTES — agent_activities (RDS) + cost history
// ════════════════════════════════════════════════════════════════════════════

/** GET /api/laura/activities — activity feed from agent_activities (RDS) */
app.get('/api/laura/activities', async (req, res) => {
  const limit    = Math.min(parseInt(req.query.limit)  || 50, 200);
  const days     = parseInt(req.query.days) || 7;
  const category = req.query.category || null;
  try {
    const params = [LAURA_AGENT_ID, days];
    let extra = '';
    if (category && category !== 'all') {
      params.push(category);
      extra = ` AND category = $${params.length}`;
    }
    params.push(limit);
    const r = await pgPool.query(
      `SELECT id, agent_id, type, category, requested_by, title, request, actions,
              time_saved_min AS "timeSavedMin", cost_usd AS "costUsd", model,
              input_tokens AS "inputTokens", output_tokens AS "outputTokens",
              cache_read_tokens AS "cacheReadTokens", cache_write_tokens AS "cacheWriteTokens",
              total_tokens AS "totalTokens", source,
              timestamp, created_at
       FROM agent_activities
       WHERE agent_id=$1
         AND timestamp >= NOW() - ($2::text || ' days')::INTERVAL
         AND source NOT IN ('cron-log','tracker')
         AND title NOT ILIKE 'approved'
         AND title NOT ILIKE 'Background:%'
         AND title NOT ILIKE 'HEARTBEAT%'
         AND title NOT ILIKE 'Delta:%'
         AND title NOT ILIKE 'Scheduled cron task'
         AND title <> 'HEARTBEAT_OK'
         ${extra}
       ORDER BY timestamp DESC
       LIMIT $${params.length}`,
      params
    );

    // Aggregate: cost by category
    const catAgg = {};
    for (const row of r.rows) {
      const cat = row.category || 'other';
      if (!catAgg[cat]) catAgg[cat] = { count: 0, cost: 0, timeSaved: 0 };
      catAgg[cat].count++;
      catAgg[cat].cost       += Number(row.costUsd)     || 0;
      catAgg[cat].timeSaved  += Number(row.timeSavedMin)|| 0;
    }

    const totals = r.rows.reduce((acc, row) => {
      acc.totalActivities++;
      acc.totalCost      += Number(row.costUsd)     || 0;
      acc.totalTimeSaved += Number(row.timeSavedMin)|| 0;
      return acc;
    }, { totalActivities: 0, totalCost: 0, totalTimeSaved: 0 });

    res.json({
      ok:         true,
      days,
      agentId:    LAURA_AGENT_ID,
      activities: r.rows,
      totals,
      byCategory: catAgg,
    });
  } catch (e) {
    console.error('/api/laura/activities error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

/** GET /api/laura/db-costs — Laura's AI cost summary from agent_activities (bb_agents RDS) */
app.get('/api/laura/db-costs', async (req, res) => {
  const days = Math.min(parseInt(req.query.days) || 30, 90);
  try {
    const dailyR = await pgPool.query(`
      SELECT
        DATE(timestamp AT TIME ZONE 'America/New_York') AS day,
        COALESCE(SUM(cost_usd),0)::float               AS cost,
        COUNT(*)::int                                   AS activity_count,
        COALESCE(SUM(time_saved_min),0)::int            AS time_saved_min
      FROM agent_activities
      WHERE agent_id = $1
        AND timestamp >= NOW() - ($2::text || ' days')::INTERVAL
        AND source NOT IN ('cron-log','tracker')
      GROUP BY 1
      ORDER BY 1 DESC
    `, [LAURA_AGENT_ID, days]);

    const catR = await pgPool.query(`
      SELECT
        COALESCE(category,'other')                      AS category,
        COUNT(*)::int                                   AS count,
        COALESCE(SUM(cost_usd),0)::float               AS cost,
        COALESCE(SUM(time_saved_min),0)::int            AS time_saved_min
      FROM agent_activities
      WHERE agent_id = $1
        AND timestamp >= NOW() - ($2::text || ' days')::INTERVAL
        AND source NOT IN ('cron-log','tracker')
      GROUP BY 1
      ORDER BY cost DESC
    `, [LAURA_AGENT_ID, days]);

    const modelR = await pgPool.query(`
      SELECT
        COALESCE(model,'unknown')                       AS model,
        COUNT(*)::int                                   AS count,
        COALESCE(SUM(cost_usd),0)::float               AS cost,
        COALESCE(SUM(input_tokens),0)::bigint           AS input_tokens,
        COALESCE(SUM(output_tokens),0)::bigint          AS output_tokens
      FROM agent_activities
      WHERE agent_id = $1
        AND timestamp >= NOW() - ($2::text || ' days')::INTERVAL
        AND source NOT IN ('cron-log','tracker')
        AND model IS NOT NULL
      GROUP BY 1
      ORDER BY cost DESC
    `, [LAURA_AGENT_ID, days]);

    const totalR = await pgPool.query(`
      SELECT
        COUNT(*)::int                                   AS total_activities,
        COALESCE(SUM(cost_usd),0)::float               AS total_cost,
        COALESCE(SUM(time_saved_min),0)::int            AS total_time_saved,
        COALESCE(SUM(input_tokens),0)::bigint           AS total_input_tokens,
        COALESCE(SUM(output_tokens),0)::bigint          AS total_output_tokens,
        MIN(timestamp)::text                            AS first_activity,
        MAX(timestamp)::text                            AS last_activity
      FROM agent_activities
      WHERE agent_id = $1
        AND timestamp >= NOW() - ($2::text || ' days')::INTERVAL
        AND source NOT IN ('cron-log','tracker')
    `, [LAURA_AGENT_ID, days]);

    res.json({
      ok:         true,
      days,
      agentId:    LAURA_AGENT_ID,
      totals:     totalR.rows[0] || {},
      byDay:      dailyR.rows,
      byCategory: catR.rows,
      byModel:    modelR.rows,
    });
  } catch (e) {
    console.error('/api/laura/db-costs error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// DARREN ROUTES — live from Google Sheets
// ════════════════════════════════════════════════════════════════════════════


/** GET /api/darren/counts — live row counts per Darren sheet tab */
app.get('/api/darren/counts', async (req, res) => {
  try {
    const contacts = await readDarrenContacts();
    const counts = {};
    for (const c of contacts) {
      counts[c.campaign] = (counts[c.campaign] || 0) + 1;
    }
    // add BEAD Winner count explicitly
    counts['BEAD Winner'] = counts['BEAD Winner'] || 0;
    // DWDM Dashboard KPIs from the sheet itself
    const [dwdmRows, taskRows] = await Promise.all([
      readDarrenSheet('DWDM Companies', 'A1:N1000'),
      readDarrenSheet('DWDM Task plan', 'A1:J500'),
    ]);
    counts['DWDM'] = dwdmRows.length;
    counts['DWDM Tasks'] = taskRows.length;
    res.json({ ok: true, counts });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

/** GET /api/darren/dashboard */
app.get('/api/darren/dashboard', async (req, res) => {
  try {
    const [dwdmRows, taskRows, beadRows] = await Promise.all([
      readDarrenSheet('DWDM Companies', 'A1:N1000'),
      readDarrenSheet('DWDM Task plan',  'A1:J500'),
      readDarrenSheet('BEAD',            'A1:O1000'),
    ]);
    const countStatus = (rows, col, val) => rows.filter(r => (r[col]||'').toLowerCase().includes(val.toLowerCase())).length;
    const smtpVerified = dwdmRows.filter(r => (r['SMTP Status']||'').toLowerCase() === 'valid').length;
    const wsMap = {};
    let costTotal = 0;
    taskRows.forEach(t => {
      const ws = t['Workstream'] || 'General';
      const cost = parseFloat((t['Cost']||'0').replace(/[^0-9.]/g,'')) || 0;
      costTotal += cost;
      if (!wsMap[ws]) wsMap[ws] = { workstream: ws, count: 0, cost: 0 };
      wsMap[ws].count++; wsMap[ws].cost += cost;
    });
    res.json({ ok: true,
      campaign: { totalCompanies: dwdmRows.length, totalContacts: dwdmRows.length, smtpVerified,
        t1Sent: countStatus(dwdmRows,'Touch 1 Status','sent'), t2Sent: countStatus(dwdmRows,'Touch 2 Status','sent'),
        t3Sent: countStatus(dwdmRows,'Touch 3 Status','sent'), t4Sent: countStatus(dwdmRows,'Touch 4 Status','sent'), t5Sent: 0,
        beadTotal: beadRows.length },
      tasks: { total: taskRows.length, approved: taskRows.filter(t=>(t['Approval (Yes/No)']||'').toLowerCase()==='yes').length,
        completed: taskRows.filter(t=>(t['Status']||'').toLowerCase().includes('complete')).length,
        costTotal: parseFloat(costTotal.toFixed(4)), byWorkstream: Object.values(wsMap) }
    });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

/** GET /api/darren/task-list */
app.get('/api/darren/task-list', async (req, res) => {
  try {
    const rows = await readDarrenSheet('DWDM Task plan', 'A1:J500');
    const tasks = rows.map((t, i) => ({
      sheetRow: i + 2, week: t['Week']||'', day: t['Day']||'', workstream: t['Workstream']||'General',
      title: t['Task']||'', target: t['Target / Output']||'', owner: t['Owner']||'',
      approved: (t['Approval (Yes/No)']||'').toLowerCase() === 'yes',
      status: t['Status']||'', cost: t['Cost']||'', notes: t['Notes']||'',
    }));
    res.json({ ok: true, tasks, approved: tasks.filter(t=>t.approved), pending: tasks.filter(t=>!t.approved) });
  } catch (e) { res.json({ ok: true, tasks: [], approved: [], pending: [], note: e.message }); }
});

app.post('/api/darren/task-list/approve', async (req, res) => {
  const { sheetRow, approvedBy } = req.body;
  if (!sheetRow) return res.status(400).json({ ok: false, error: 'sheetRow required' });
  res.json({ ok: true, approvedBy, note: 'Approval logged (sheet write not yet wired)' });
});

app.post('/api/darren/task-list/cost', async (req, res) => {
  const { sheetRow, cost } = req.body;
  if (!sheetRow) return res.status(400).json({ ok: false, error: 'sheetRow required' });
  res.json({ ok: true, cost, note: 'Cost logged (sheet write not yet wired)' });
});

/** GET /api/darren/dwdm — full DWDM Companies */
app.get('/api/darren/dwdm', async (req, res) => {
  try {
    const cacheKey = 'darren_dwdm';
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);
    
    const rows = await readDarrenSheet('DWDM Companies', 'A1:N1000');
    const result = { ok: true, rows, total: rows.length };
    cacheSet(cacheKey, result);
    res.json(result);
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

/** GET /api/darren/db-costs — Darren's AI cost summary from agent_activities (bb_agents RDS) */
app.get('/api/darren/db-costs', async (req, res) => {
  const days = Math.min(parseInt(req.query.days)||30, 90);
  try {
    // Daily cost series
    const dailyR = await pgPool.query(`
      SELECT
        DATE(timestamp AT TIME ZONE 'America/New_York') AS day,
        COALESCE(SUM(cost_usd),0)::float               AS cost,
        COUNT(*)::int                                   AS activity_count,
        COALESCE(SUM(time_saved_min),0)::int            AS time_saved_min
      FROM agent_activities
      WHERE agent_id = $1
        AND timestamp >= NOW() - ($2::text || ' days')::INTERVAL
        AND source NOT IN ('cron-log','tracker')
      GROUP BY 1
      ORDER BY 1 DESC
    `, [DARREN_AGENT_ID, days]);

    // Cost by category
    const catR = await pgPool.query(`
      SELECT
        COALESCE(category,'other')                      AS category,
        COUNT(*)::int                                   AS count,
        COALESCE(SUM(cost_usd),0)::float               AS cost,
        COALESCE(SUM(time_saved_min),0)::int            AS time_saved_min
      FROM agent_activities
      WHERE agent_id = $1
        AND timestamp >= NOW() - ($2::text || ' days')::INTERVAL
        AND source NOT IN ('cron-log','tracker')
      GROUP BY 1
      ORDER BY cost DESC
    `, [DARREN_AGENT_ID, days]);

    // Cost by model
    const modelR = await pgPool.query(`
      SELECT
        COALESCE(model,'unknown')                       AS model,
        COUNT(*)::int                                   AS count,
        COALESCE(SUM(cost_usd),0)::float               AS cost,
        COALESCE(SUM(input_tokens),0)::bigint           AS input_tokens,
        COALESCE(SUM(output_tokens),0)::bigint          AS output_tokens
      FROM agent_activities
      WHERE agent_id = $1
        AND timestamp >= NOW() - ($2::text || ' days')::INTERVAL
        AND source NOT IN ('cron-log','tracker')
        AND model IS NOT NULL
      GROUP BY 1
      ORDER BY cost DESC
    `, [DARREN_AGENT_ID, days]);

    // Totals
    const totalR = await pgPool.query(`
      SELECT
        COUNT(*)::int                                   AS total_activities,
        COALESCE(SUM(cost_usd),0)::float               AS total_cost,
        COALESCE(SUM(time_saved_min),0)::int            AS total_time_saved,
        COALESCE(SUM(input_tokens),0)::bigint           AS total_input_tokens,
        COALESCE(SUM(output_tokens),0)::bigint          AS total_output_tokens,
        MIN(timestamp)::text                            AS first_activity,
        MAX(timestamp)::text                            AS last_activity
      FROM agent_activities
      WHERE agent_id = $1
        AND timestamp >= NOW() - ($2::text || ' days')::INTERVAL
        AND source NOT IN ('cron-log','tracker')
    `, [DARREN_AGENT_ID, days]);

    res.json({
      ok:         true,
      days,
      agentId:    DARREN_AGENT_ID,
      totals:     totalR.rows[0] || {},
      byDay:      dailyR.rows,
      byCategory: catR.rows,
      byModel:    modelR.rows,
    });
  } catch (e) {
    console.error('/api/darren/db-costs error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

/** GET /api/darren/bead — full BEAD sheet */
app.get('/api/darren/bead', async (req, res) => {
  try {
    const cacheKey = 'darren_bead';
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);
    
    const rows = await readDarrenSheet('BEAD', 'A1:O1000');
    const result = { ok: true, rows, total: rows.length };
    cacheSet(cacheKey, result);
    res.json(result);
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

/** GET /api/darren/activities */
app.get('/api/darren/activities', async (req, res) => {
  const limit    = Math.min(parseInt(req.query.limit)||50, 200);
  const days     = parseInt(req.query.days)||7;
  const category = req.query.category || null;
  try {
    const params = [DARREN_AGENT_ID, days];
    let extra = '';
    if (category && category !== 'all') {
      params.push(category);
      extra = ` AND category = $${params.length}`;
    }
    params.push(limit);
    const r = await pgPool.query(
      `SELECT id, agent_id, type, category, requested_by, title, request, actions,
              time_saved_min AS "timeSavedMin", cost_usd AS "costUsd", model,
              input_tokens AS "inputTokens", output_tokens AS "outputTokens",
              cache_read_tokens AS "cacheReadTokens", cache_write_tokens AS "cacheWriteTokens",
              total_tokens AS "totalTokens", source,
              timestamp, created_at
       FROM agent_activities
       WHERE agent_id=$1
         AND timestamp >= NOW() - ($2::text || ' days')::INTERVAL
         AND source NOT IN ('cron-log','tracker')
         ${extra}
       ORDER BY timestamp DESC
       LIMIT $${params.length}`,
      params
    );

    // Aggregate: cost by category
    const catAgg = {};
    for (const row of r.rows) {
      const cat = row.category || 'other';
      if (!catAgg[cat]) catAgg[cat] = { count: 0, cost: 0, timeSaved: 0 };
      catAgg[cat].count++;
      catAgg[cat].cost      = Math.round((catAgg[cat].cost      + (Number(row.costUsd)||0)) * 10000) / 10000;
      catAgg[cat].timeSaved = catAgg[cat].timeSaved + (Number(row.timeSavedMin)||0);
    }

    res.json({
      ok:         true,
      activities: r.rows,
      total:      r.rowCount,
      byCategory: catAgg,
    });
  } catch (e) {
    console.error('/api/darren/activities error:', e.message);
    res.json({ ok: true, activities: [], total: 0, byCategory: {}, note: e.message });
  }
});

/** GET /api/today/tasks */
app.get('/api/today/tasks', async (req, res) => {
  const nyDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  try {
    const [lauraR, darrenR] = await Promise.all([
      pgPool.query(
        `SELECT id, title, status, cost_usd AS "costUsd", channel AS category, assigned_at AS created_at
         FROM abhi_tasks WHERE agent_id=$1 AND DATE(assigned_at AT TIME ZONE 'America/New_York')=$2 ORDER BY assigned_at DESC`,
        [LAURA_AGENT_ID, nyDate]
      ).catch(()=>({rows:[]})),
      pgPool.query(
        `SELECT id, title, status, cost_usd AS "costUsd", channel AS category, assigned_at AS created_at
         FROM abhi_tasks WHERE agent_id=$1 AND DATE(assigned_at AT TIME ZONE 'America/New_York')=$2 ORDER BY assigned_at DESC`,
        [DARREN_AGENT_ID, nyDate]
      ).catch(()=>({rows:[]})),
    ]);
    res.json({ ok: true, date: nyDate, laura: lauraR.rows, darren: darrenR.rows });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

/** GET /api/bb/tasks/next-steps?agent=laura|darren — top 3 pending tasks */
app.get('/api/bb/tasks/next-steps', async (req, res) => {
  try {
    const agentId = req.query.agent === 'darren' ? DARREN_AGENT_ID : LAURA_AGENT_ID;
    const { rows } = await pgPool.query(`
      SELECT id, title, description, priority, status, assigned_at
      FROM abhi_tasks
      WHERE agent_id = $1
        AND status IN ('pending', 'in_progress')
      ORDER BY
        CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
        assigned_at DESC
      LIMIT 3
    `, [agentId]);
    res.json({ tasks: rows });
  } catch (e) {
    res.json({ tasks: [] });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// ABHI TASKS API — track every task Abhinanda assigns + cost per task
// ════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/abhi/tasks — called by the agent when Abhi assigns a task.
 * Body: { title, description, rawMessage, channel, sessionKey, inboundMessageId, priority }
 */
app.post('/api/abhi/tasks', async (req, res) => {
  try {
    const {
      title, description, rawMessage, channel,
      sessionKey, inboundMessageId, priority,
    } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const id = `ABHI-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    await pgPool.query(`
      INSERT INTO abhi_tasks
        (id, agent_id, title, description, raw_message, channel,
         status, priority, session_key, inbound_message_id, assigned_at)
      VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$8,$9,NOW())
    `, [
      id, LAURA_AGENT_ID,
      title.slice(0, 200),
      description || null,
      rawMessage  || null,
      channel     || 'googlechat',
      priority    || 'normal',
      sessionKey  || null,
      inboundMessageId || null,
    ]);

    res.json({ ok: true, id });
  } catch (e) {
    console.error('POST /api/abhi/tasks error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

/**
 * PATCH /api/abhi/tasks/:id — update status + attach real token cost when done.
 * Body: { status, model, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, costUsd }
 */
app.patch('/api/abhi/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      status, model,
      inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, costUsd,
    } = req.body;

    const inTok  = Number(inputTokens)        || 0;
    const outTok = Number(outputTokens)       || 0;
    const crTok  = Number(cacheReadTokens)    || 0;
    const cwTok  = Number(cacheWriteTokens)   || 0;
    const totTok = inTok + outTok + crTok + cwTok;
    const finalCost = costUsd != null
      ? Number(costUsd)
      : estimateCostFromTokens(model || '', inTok, outTok, crTok, cwTok);

    const sets = ['updated_at = NOW()'];
    const vals = [id];
    let pi = 2;

    if (status) {
      sets.push(`status = $${pi}`); vals.push(status); pi++;
      if (status === 'in_progress') { sets.push(`started_at = COALESCE(started_at, NOW())`); }
      if (status === 'completed')   { sets.push(`completed_at = NOW()`); }
    }
    if (model)  { sets.push(`model = $${pi}`); vals.push(model); pi++; }
    if (totTok > 0) {
      sets.push(`input_tokens = input_tokens + $${pi}`);          vals.push(inTok);  pi++;
      sets.push(`output_tokens = output_tokens + $${pi}`);        vals.push(outTok); pi++;
      sets.push(`cache_read_tokens = cache_read_tokens + $${pi}`);vals.push(crTok);  pi++;
      sets.push(`cache_write_tokens = cache_write_tokens + $${pi}`);vals.push(cwTok);pi++;
      sets.push(`total_tokens = total_tokens + $${pi}`);          vals.push(totTok); pi++;
      sets.push(`cost_usd = cost_usd + $${pi}`);                  vals.push(finalCost); pi++;
    }

    await pgPool.query(
      `UPDATE abhi_tasks SET ${sets.join(', ')} WHERE id = $1`,
      vals
    );

    res.json({ ok: true });
  } catch (e) {
    console.error('PATCH /api/abhi/tasks error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/abhi/tasks/:id/approval', async (req, res) => {
  try {
    const { decision } = req.body;
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ error: 'decision must be approved or rejected' });
    }
    const tsCol = decision === 'approved' ? 'approved_at' : 'rejected_at';
    await pgPool.query(
      `UPDATE abhi_tasks SET approval_status=$1, ${tsCol}=NOW(), updated_at=NOW() WHERE id=$2`,
      [decision, req.params.id]
    );
    res.json({ ok: true, decision });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/abhi/tasks — list tasks with summary stats.
 * Sources: abhi_tasks (laura/darren) + agent_tasks (ava/lola/zara/camilla/brio)
 * Query: ?days=30&status=all|pending|completed|in_progress&limit=200&agent=laura
 */
app.get('/api/abhi/tasks', async (req, res) => {
  try {
    const days   = Math.min(Number(req.query.days)  || 30,  365);
    const limit  = Math.min(Number(req.query.limit) || 200, 500);
    const status = req.query.status || 'all';
    const agent  = req.query.agent  || 'all';

    // Agents stored in abhi_tasks (legacy/primary table)
    const ABHI_TASK_AGENTS = new Set(['laura', 'darren']);

    // Agents stored in agent_tasks (bb_agents RDS, bbPool)
    const AGENT_TASKS_AGENTS = new Set(['zara', 'camilla', 'lola', 'ava', 'brio']);

    const AGENT_ID_MAP = {
      'laura':   'laura-abhi-agent',
      'darren':  'darren-abhi-agent',
      'zara':    'zara-mercuryz-agent',
      'camilla': 'camilla-boldbusiness-agent',
      'lola':    'lola-boldbusiness-agent',
      'ava':     'ava-marketing-agent',
      'brio':    'brio-ed-agent',
    };

    const resolvedAgentId = agent !== 'all' ? (AGENT_ID_MAP[agent] || null) : null;

    // ── Branch: agent_tasks table (Ava / Lola / Zara / Camilla / Brio) ──────
    if (agent !== 'all' && AGENT_TASKS_AGENTS.has(agent)) {
      const params = [];
      const conds  = [];

      // agent_tasks uses created_at, not assigned_at
      params.push(days);
      conds.push(`created_at >= NOW() - ($${params.length} || ' days')::INTERVAL`);

      if (resolvedAgentId) { params.push(resolvedAgentId); conds.push(`agent_id = $${params.length}`); }

      // Normalize status — agent_tasks uses 'open'/'todo' alongside 'completed'/'in_progress'
      if (status && status !== 'all') {
        if (status === 'pending') {
          conds.push(`status IN ('pending','open','todo')`);
        } else {
          params.push(status); conds.push(`status = $${params.length}`);
        }
      }

      const where = 'WHERE ' + conds.join(' AND ');

      const [rows, stats, daily] = await Promise.all([
        bbPool.query(`
          SELECT
            id, title, description,
            NULL::text AS "rawMessage", NULL::text AS channel,
            status, COALESCE(priority,'normal') AS priority,
            NULL::text AS model,
            0 AS "inputTokens", 0 AS "outputTokens",
            0 AS "cacheReadTokens", 0 AS "cacheWriteTokens",
            COALESCE(total_tokens,0) AS "totalTokens",
            COALESCE(total_cost_usd,0) AS "costUsd",
            created_at  AS "assignedAt",
            NULL::timestamptz AS "startedAt",
            completed_at AS "completedAt",
            'n/a' AS "approvalStatus",
            NULL::timestamptz AS "approvedAt",
            NULL::timestamptz AS "rejectedAt",
            created_by  AS "requestedBy",
            due_date    AS "dueDate"
          FROM agent_tasks
          ${where}
          ORDER BY created_at DESC
          LIMIT $${params.length + 1}
        `, [...params, limit]),

        bbPool.query(`
          SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status IN ('pending','open','todo'))::int AS pending,
            COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
            COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
            COALESCE(SUM(total_cost_usd),0)::float AS total_cost,
            COALESCE(SUM(total_tokens),0)::bigint  AS total_tokens,
            COALESCE(AVG(total_cost_usd) FILTER (WHERE total_cost_usd > 0), 0)::float AS avg_cost_per_task,
            0::float AS avg_duration_min
          FROM agent_tasks ${where}
        `, params),

        bbPool.query(`
          SELECT
            DATE(created_at AT TIME ZONE 'America/New_York') AS day,
            COUNT(*)::int AS tasks,
            COALESCE(SUM(total_cost_usd),0)::float AS cost
          FROM agent_tasks ${where}
          GROUP BY day ORDER BY day DESC
        `, params),
      ]);

      const s = stats.rows[0];
      return res.json({
        tasks:  rows.rows,
        source: 'agent_tasks',
        summary: {
          total:          s.total,
          pending:        s.pending,
          inProgress:     s.in_progress,
          completed:      s.completed,
          totalCost:      Math.round(Number(s.total_cost) * 10000) / 10000,
          totalTokens:    Number(s.total_tokens),
          avgCostPerTask: Math.round(Number(s.avg_cost_per_task) * 10000) / 10000,
          avgDurationMin: 0,
        },
        daily: daily.rows,
      });
    }

    // ── Default branch: abhi_tasks (Laura / Darren / all) ────────────────────
    const params = [days];
    let where = `WHERE assigned_at >= NOW() - ($1 || ' days')::INTERVAL`;
    let pi = 2;

    if (status && status !== 'all') {
      where += ` AND status = $${pi}`; params.push(status); pi++;
    }
    if (resolvedAgentId) {
      where += ` AND agent_id = $${pi}`; params.push(resolvedAgentId); pi++;
    } else if (agent !== 'all' && !AGENT_TASKS_AGENTS.has(agent)) {
      // Unknown agent — return empty
      where += ` AND agent_id = $${pi}`; params.push(`unknown-${agent}`); pi++;
    }

    const [rows, stats, daily] = await Promise.all([
      pgPool.query(`
        SELECT
          id, title, description, raw_message AS "rawMessage",
          channel, status, priority, model,
          input_tokens AS "inputTokens", output_tokens AS "outputTokens",
          cache_read_tokens AS "cacheReadTokens", cache_write_tokens AS "cacheWriteTokens",
          total_tokens AS "totalTokens", cost_usd AS "costUsd",
          assigned_at AS "assignedAt", started_at AS "startedAt",
          completed_at AS "completedAt",
          approval_status AS "approvalStatus",
          approved_at AS "approvedAt", rejected_at AS "rejectedAt"
        FROM abhi_tasks
        ${where}
        ORDER BY assigned_at DESC
        LIMIT $${pi}
      `, [...params, limit]),

      pgPool.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status='pending')::int AS pending,
          COUNT(*) FILTER (WHERE status='in_progress')::int AS in_progress,
          COUNT(*) FILTER (WHERE status='completed')::int AS completed,
          COALESCE(SUM(cost_usd),0)::float AS total_cost,
          COALESCE(SUM(total_tokens),0)::bigint AS total_tokens,
          COALESCE(AVG(cost_usd) FILTER (WHERE cost_usd > 0), 0)::float AS avg_cost_per_task,
          COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - assigned_at))/60) FILTER (WHERE completed_at IS NOT NULL), 0)::float AS avg_duration_min
        FROM abhi_tasks ${where}
      `, params),

      pgPool.query(`
        SELECT
          DATE(assigned_at AT TIME ZONE 'America/New_York') AS day,
          COUNT(*)::int AS tasks,
          COALESCE(SUM(cost_usd),0)::float AS cost
        FROM abhi_tasks ${where}
        GROUP BY day ORDER BY day DESC
      `, params),
    ]);

    const s = stats.rows[0];
    return res.json({
      tasks:  rows.rows,
      source: 'abhi_tasks',
      summary: {
        total:          s.total,
        pending:        s.pending,
        inProgress:     s.in_progress,
        completed:      s.completed,
        totalCost:      Math.round(Number(s.total_cost) * 10000) / 10000,
        totalTokens:    Number(s.total_tokens),
        avgCostPerTask: Math.round(Number(s.avg_cost_per_task) * 10000) / 10000,
        avgDurationMin: Math.round(Number(s.avg_duration_min) * 10) / 10,
      },
      daily: daily.rows,
    });
  } catch (e) {
    console.error('GET /api/abhi/tasks error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// CONTACTS API
// ════════════════════════════════════════════════════════════════════════════

/** Read all Laura leads from Google Sheets — combines CET, Estimators, BIM, SC/PM tabs
 *  Uses batched 333-row reads to work around gog CLI pagination cap.
 *  Reads from the authoritative "Laura's Lead Generation" sheet.
 */
async function readLauraContacts() {
  const sheetTabs = [
    { tab: 'CET Designers',            campaign: 'CET Designers',       headerRows: 1 },
    { tab: 'Estimators',               campaign: 'Estimators',           headerRows: 1 },
    { tab: 'BIM Modelers',             campaign: 'BIM Modelers',         headerRows: 1 },
    { tab: 'Sales Coordinators / PMs', campaign: 'Sales Coordinators - PMs', headerRows: 1 },
  ];
  const all = [];

  /** Fetch a tab in 333-row batches to bypass the gog CLI row cap */
  async function fetchTabBatched(tab) {
    return new Promise((resolve) => {
      const BATCH = 333;
      let allRows = [];
      let start = 1;
      const nextBatch = () => {
        const end = start + BATCH - 1;
        const cmd = `${GOG_PATH} sheets get "${LIVE_SHEET_ID}" "${tab}!A${start}:Z${end}" --account ${GOG_ACCOUNT} --json`;
        exec(cmd, { timeout: 25000 }, (err, stdout) => {
          if (err) return resolve(allRows);
          try {
            const d = JSON.parse(stdout);
            const batch = d.values || [];
            allRows = allRows.concat(batch);
            if (batch.length < BATCH || start + BATCH > 2000) {
              resolve(allRows);
            } else {
              start += BATCH;
              nextBatch();
            }
          } catch { resolve(allRows); }
        });
      };
      nextBatch();
    });
  }

  // Per-tab column maps — each tab has a different structure in the sheet
  const COL_MAPS = {
    'CET Designers': (r) => ({
      // A  B           C         D     E       F                    G         H       I       J       K       L                 M
      company: r[0]||'', role: r[1]||'', location: r[2]||'',
      name: r[3]||'', title: r[4]||'', email: r[5]||'', linkedin: r[6]||'',
      touch1: r[7]||'', touch2: r[8]||'', touch3: r[9]||'', touch4: r[10]||'',
      response_status: r[11]||'', response_date: r[12]||'',
      call_scheduled: '',
    }),
    'Estimators': (r) => ({
      // A  B           C         D     E       F              G         H              I       J       K       L                 M
      company: r[0]||'', role: r[1]||'', location: r[2]||'',
      name: r[3]||'', title: r[4]||'', email: r[5]||'', linkedin: r[6]||'',
      job_link: r[7]||'',
      touch1: r[8]||'', touch2: r[9]||'', touch3: r[10]||'', touch4: '',
      response_status: r[11]||'', response_date: r[12]||'',
      call_scheduled: '',
    }),
    'BIM Modelers': (r) => ({
      // A           B         C     D     E       F              G         H        I(date sent) J(status) K(next) L(resp date) M(resp summary) N(call booked)
      company: r[0]||'', location: r[1]||'', role: r[2]||'',
      name: r[3]||'', title: r[4]||'', job_link: r[5]||'', email: r[6]||'', linkedin: r[7]||'',
      added_date: r[8]||'',  // col I = Date Sent
      touch1: r[9]||'',      // col J = Status (touch status, not date)
      touch2: '', touch3: '', touch4: '',
      response_status: r[12]||'',  // col M = Response Summary (actual reply content)
      response_date:   r[11]||'',  // col L = Response Date
      call_scheduled:  r[13]||'',  // col N = Call Booked (Y/N)
    }),
    'Sales Coordinators / PMs': (r) => ({
      // A  B           C         D     E       F              G         H            I        J
      company: r[0]||'', role: r[1]||'', location: r[2]||'',
      name: r[3]||'', title: r[4]||'', email: r[5]||'', linkedin: r[6]||'',
      smtp_status: r[7]||'',
      touch1: r[8]||'', touch2: r[9]||'', touch3: '', touch4: '',
      response_status: '',
      call_scheduled: '',
    }),
  };

  await Promise.all(sheetTabs.map(async ({ tab, campaign, headerRows }) => {
    const allRows = await fetchTabBatched(tab);
    const rows = allRows.slice(headerRows); // skip header row(s)
    const mapRow = COL_MAPS[tab] || COL_MAPS['CET Designers'];
    rows.forEach((r, i) => {
      if (!r.some(c => (c||'').trim())) return; // skip fully empty rows
      const mapped = mapRow(r);
      all.push({
        id: `${tab.replace(/\s+/g,'-')}-${i}`,
        ...mapped,
        campaign,
        source: 'google_sheets',
      });
    });
  }));

  return all;
}




/** Read Darren's contacts from Google Sheets — all tabs with exact column mappings */
async function readDarrenContacts() {
  const results = [];

  /**
   * Schema-driven tab definitions.
   * response_status / call_scheduled intentionally OMITTED for tabs that don't track them.
   * This makes hasReplyField / hasCallField correctly return false in computeMetrics,
   * so the dashboard shows "—" instead of "0".
   *
   * Only DWDM Companies tracks outreach touches (Touch 1–5).
   * No Darren tab has a Reply or Call Scheduled column.
   */
  const reads = [
    // ── DWDM Companies ─────────────────────────────────────────────────────────
    // Cols: A=Company B=Contact C=Title D=Email E=SMTP F=LinkedIn G=Evidence
    //       H=Assigned I=Touch1 J=Touch2 K=Touch3 L=Touch4 M=Touch5 N=Tier
    { tab: 'DWDM Companies', campaign: 'DWDM', headerRow: 1, batchRead: true,
      hasTouch: true, hasReply: false,
      mapRow: (r) => ({
        company: r[0]||'', contact_name: r[1]||'', title: r[2]||'',
        email: r[3]||'', smtp_status: r[4]||'', linkedin_url: r[5]||'',
        hiring_evidence: r[6]||'', assigned_to: r[7]||'',
        touch1: r[8]||'', touch2: r[9]||'', touch3: r[10]||'',
        touch4: r[11]||'', touch5: r[12]||'', tier: r[13]||'',
        // NO response_status / call_scheduled — these columns do not exist
      })
    },
    // ── BEAD ───────────────────────────────────────────────────────────────────
    // Cols: A=# B=State C=BEAD Alloc D=Company E=Award F=Tech G=Tier H=MZ Approach
    //       I=MZ Hiring J=Assigned K=Contact L=Title M=Email N=LinkedIn O=SMTP
    { tab: 'BEAD', campaign: 'BEAD', headerRow: 1, batchRead: true,
      hasTouch: false, hasReply: false,
      mapRow: (r) => ({
        company: r[3]||'', contact_name: r[10]||'', title: r[11]||'',
        email: r[12]||'', linkedin_url: r[13]||'', smtp_status: r[14]||'',
        state: r[1]||'', bead_alloc: r[2]||'', award_amt: r[4]||'',
        technology: r[5]||'', tier_cat: r[6]||'', mz_approach: r[7]||'',
        mz_hiring_status: r[8]||'', assigned_to: r[9]||'',
      })
    },
    // ── BEAD Winner ────────────────────────────────────────────────────────────
    // Cols: A=Company B=Desc C=LinkedIn E=#Emp F=Industry G=Title H=First I=Last
    //       J=Contact LI K=Email L=Phone M=Location
    { tab: 'Copy of BEAD Winner', campaign: 'BEAD Winner', headerRow: 1, batchRead: true,
      hasTouch: false, hasReply: false,
      mapRow: (r) => ({
        company: (r[0]||'').trim(), company_desc: r[1]||'',
        linkedin_company: r[2]||'', employees: (r[4]||'').trim(),
        industry: r[5]||'', title: (r[6]||'').trim(),
        contact_name: ((r[7]||'').trim()+' '+(r[8]||'').trim()).trim(),
        linkedin_url: r[9]||'', email: r[10]||'',
        phone: r[11]||'', location: r[12]||'',
      })
    },
    // ── DC - Contacts ──────────────────────────────────────────────────────────
    { tab: 'DC - Contacts', campaign: 'DC Contacts', headerRow: 4, batchRead: false,
      hasTouch: false, hasReply: false,
      mapRow: (r) => ({
        company: r[2]||'', project_name: r[3]||'', general_contractor: r[4]||'',
        contact_name: r[5]||'', title: r[6]||'', email: r[7]||'',
        linkedin_url: r[8]||'', priority: r[1]||'', entry_point: r[9]||'',
        register: r[10]||'',
      })
    },
    // ── DC - All Projects ──────────────────────────────────────────────────────
    { tab: 'DC - All Projects', campaign: 'DC Projects', headerRow: 4, batchRead: false,
      hasTouch: false, hasReply: false,
      mapRow: (r) => ({
        company: r[2]||'', project_name: r[3]||'', city: r[4]||'',
        state: r[5]||'', investment: r[6]||'', status: r[7]||'',
        general_contractor: r[8]||'', fiber_roles: r[10]||'',
        open_roles: r[11]||'', urgency_score: r[14]||'',
        entry_point: r[15]||'', outreach_hook: r[16]||'',
      })
    },
    // ── DC - Job Demand ────────────────────────────────────────────────────────
    { tab: 'DC - Job Demand', campaign: 'DC Job Demand', headerRow: 3, batchRead: false,
      hasTouch: false, hasReply: false,
      mapRow: (r) => ({
        company: r[0]||'', title: r[1]||'', open_positions: r[2]||'',
        salary: r[3]||'', location: r[4]||'', days_open: r[5]||'',
        urgency: r[6]||'',
      })
    },
    // ── DC - Fiber & Optical Roles ─────────────────────────────────────────────
    { tab: 'DC - Fiber & Optical Roles', campaign: 'DC Fiber Roles', headerRow: 6, batchRead: false,
      hasTouch: false, hasReply: false,
      mapRow: (r) => ({
        company: r[0]||'', title: r[1]||'', skills: r[2]||'',
        certifications: r[3]||'', open_jobs: r[4]||'', rate_range: r[5]||'',
        salary_range: r[6]||'', dc_phase: r[7]||'', shortage: r[8]||'',
        mercury_z: r[9]||'',
      })
    },
  ];

  /** Fetch all rows for a tab, using 333-row batches for large tabs */
  function fetchRows(tab, headerRow, batchRead) {
    return new Promise((resolve) => {
      if (!batchRead) {
        // Single read for small tabs
        const cmd = `${GOG_PATH} sheets get "${DARREN_SHEET_ID}" "${tab}!A1:Z2000" --account ${GOG_ACCOUNT} --json`;
        exec(cmd, { timeout: 25000 }, (err, stdout) => {
          if (err) return resolve([]);
          try { resolve((JSON.parse(stdout).values || []).slice(headerRow)); }
          catch { resolve([]); }
        });
      } else {
        // Batched reads for tabs with 500+ rows (DWDM, BEAD, BEAD Winner)
        const BATCH = 333;
        let allRows = [];
        let start = 1;
        const nextBatch = () => {
          const end = start + BATCH - 1;
          const cmd = `${GOG_PATH} sheets get "${DARREN_SHEET_ID}" "${tab}!A${start}:Z${end}" --account ${GOG_ACCOUNT} --json`;
          exec(cmd, { timeout: 25000 }, (err, stdout) => {
            if (err) return resolve(allRows.slice(headerRow));
            try {
              const batch = JSON.parse(stdout).values || [];
              allRows = allRows.concat(batch);
              if (batch.length < BATCH || start + BATCH > 2000) {
                resolve(allRows.slice(headerRow));
              } else {
                start += BATCH;
                nextBatch();
              }
            } catch { resolve(allRows.slice(headerRow)); }
          });
        };
        nextBatch();
      }
    });
  }

  await Promise.all(reads.map(({ tab, campaign, headerRow, batchRead, mapRow }) =>
    fetchRows(tab, headerRow, batchRead).then(rows => {
      rows.forEach((r, i) => {
        if (!r.some(c => (c||'').trim())) return; // skip fully empty rows
        results.push({
          id: `${campaign}-${i}`,
          agent: 'darren',
          campaign,
          blacklisted: false,
          ...mapRow(r),
        });
      });
    })
  ));

  return results;
}



app.get('/api/contacts', async (req, res) => {
  try {
    const {
      agent, campaign, search, limit = 2000, offset = 0, blacklisted,
    } = req.query;

    // ── If blacklisted=true, serve directly from DB (source of truth) ─────────
    if (blacklisted === 'true') {
      const r = await pgPool.query(
        `SELECT id, agent, campaign, contact_name, company, title, email,
                linkedin_url, role, location, notes, blacklisted, updated_at
         FROM contacts
         WHERE blacklisted = true
         ORDER BY company, contact_name`
      );
      // Normalise field names to match what the BlacklistTab expects
      const rows = r.rows.map(c => ({
        id:             c.id,
        agent:          c.agent,
        campaign:       c.campaign,
        contact_name:   c.contact_name,
        company:        c.company,
        title:          c.title || '',
        email:          c.email || '',
        linkedin_url:   c.linkedin_url || '',
        notes:          c.notes || '',
        blacklisted:    true,
        updated_at:     c.updated_at,
      }));
      return res.json({ contacts: rows, total: rows.length });
    }

    // ── Normal path: read from Google Sheets, then overlay DB blacklist status ─
    const [laura, darren, dbBlacklist] = await Promise.all([
      (!agent || agent === 'all' || agent === 'laura') ? readLauraContacts() : Promise.resolve([]),
      (!agent || agent === 'all' || agent === 'darren') ? readDarrenContacts() : Promise.resolve([]),
      // Load blacklisted names+companies from DB for overlay
      pgPool.query(`SELECT LOWER(contact_name) AS name, LOWER(company) AS co FROM contacts WHERE blacklisted=true`)
        .then(r => r.rows).catch(() => []),
    ]);

    // Build fast lookup sets for blacklist overlay
    const blNameSet = new Set(dbBlacklist.map(b => b.name));
    const blCoSet   = new Set(dbBlacklist.map(b => b.co));

    let contacts = [...laura, ...darren].map(c => {
      const nameMatch = blNameSet.has((c.name || c.contact_name || '').toLowerCase());
      const coMatch   = blCoSet.has((c.company || '').toLowerCase());
      return { ...c, blacklisted: nameMatch || coMatch };
    });

    // Filters
    if (campaign && campaign !== 'all') contacts = contacts.filter(c => c.campaign === campaign);
    if (blacklisted === 'false') contacts = contacts.filter(c => !c.blacklisted);
    if (search) {
      const q = search.toLowerCase();
      contacts = contacts.filter(c =>
        (c.company       || '').toLowerCase().includes(q) ||
        (c.contact_name  || '').toLowerCase().includes(q) ||
        (c.email         || '').toLowerCase().includes(q)
      );
    }

    // Deduplicate on agent=all
    if (!agent || agent === 'all') {
      const seen = new Set();
      contacts = contacts.filter(c => {
        const key = c.email || c.id;
        if (!key || seen.has(key)) return !key;
        seen.add(key);
        return true;
      });
    }

    const total = contacts.length;
    const sliced = contacts.slice(Number(offset), Number(offset) + Number(limit));
    res.json({ contacts: sliced, total });
  } catch (e) {
    console.error('GET /api/contacts error:', e);
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/contacts/:id/blacklist', async (req, res) => {
  try {
    const { blacklisted } = req.body;
    if (typeof blacklisted !== 'boolean') return res.status(400).json({ error: 'blacklisted must be boolean' });
    const r = await pgPool.query(
      `UPDATE contacts SET blacklisted=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [blacklisted, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Contact not found' });
    res.json({ ok: true, contact: r.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/contacts/:id', async (req, res) => {
  try {
    const allowed = ['touch1','touch2','touch3','touch4','touch5','next_action','notes','call_scheduled','response_status','response_date'];
    const sets = [], vals = [req.params.id];
    for (const k of allowed) {
      if (req.body[k] !== undefined) sets.push(`${k}=$${vals.push(req.body[k])}`);
    }
    if (!sets.length) return res.json({ ok: true, noop: true });
    sets.push(`updated_at=NOW()`);
    const r = await pgPool.query(`UPDATE contacts SET ${sets.join(',')} WHERE id=$1 RETURNING *`, vals);
    res.json({ ok: true, contact: r.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Compute metrics from a contact list */
function computeMetrics(contacts, agent) {
  const isSent  = v => !!(v && v.trim() !== '');
  const isReply = v => {
    if (!v || !v.trim()) return false;
    const lower = v.trim().toLowerCase();
    // Must contain a genuine prospect response indicator
    const replyKeywords = ['replied','reply','response','auto-reply','declined',
      'interested','not interested','scheduled','call booked','meeting',
      'referred','✅','❌','⛔'];
    return replyKeywords.some(kw => lower.includes(kw));
  };
  const isCall  = v => !!(v && !['', 'no', 'false', 'n', 'tbd', 'n/a'].includes(v.trim().toLowerCase()));
  const companies = new Set(contacts.map(c => c.company || c['Company'] || '')).size;
  const rows = contacts;
  // Only count replies/calls if ANY contact in this agent's data has those fields populated
  const hasReplyField    = rows.some(c => c.response_status !== undefined || c['Response Status'] !== undefined);
  const hasCallField     = rows.some(c => c.call_scheduled  !== undefined || c['Call Scheduled?']  !== undefined);

  return {
    agent,
    companies,
    contacts:        rows.length,
    emails_sent:     rows.filter(c => isSent(c.touch1   || c['Touch 1 Status'] || '')).length,
    linkedin:        rows.filter(c => isSent(c.touch2   || c['Touch 2 Status'] || '')).length,
    replies:         hasReplyField ? rows.filter(c => isReply(c.response_status || c['Response Status'] || '')).length : null,
    calls_scheduled: hasCallField  ? rows.filter(c => isCall(c.call_scheduled   || c['Call Scheduled?'] || '')).length  : null,
    _meta: {
      hasReplyTracking: hasReplyField,
      hasCallTracking:  hasCallField,
    },
  };
}

app.get('/api/contacts/metrics', async (req, res) => {
  try {
    const { agent, date_from, date_to } = req.query;
    const cacheKey = `contacts_metrics_v4_${agent || 'all'}_${date_from || ''}_${date_to || ''}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);
    
    const [lauraContacts, darrenAll] = await Promise.all([
      readLauraContacts(),
      readDarrenContacts(),   // All Darren campaigns combined
    ]);

    // ── Date-filter contacts if range is provided ─────────────────────────────
    // response_date is the only per-contact date field from the sheet.
    // Touches (email/linkedin) have no per-row timestamp, so they always show all-time.
    let filteredLaura = lauraContacts;
    if (date_from || date_to) {
      const from = date_from ? new Date(date_from) : null;
      const to   = date_to   ? new Date(date_to + 'T23:59:59') : null;
      filteredLaura = lauraContacts.map(c => {
        // For reply/call fields: zero them out if outside date range
        const rd = c.response_date ? new Date(c.response_date) : null;
        const inRange = rd && (!from || rd >= from) && (!to || rd <= to);
        return {
          ...c,
          response_status: inRange ? c.response_status : '',
          call_scheduled:  inRange ? c.call_scheduled  : '',
        };
      });
    }

    const lauraM = computeMetrics(filteredLaura, 'laura');

    // ── Scoreboard override: ONLY for "This Month" requests ──────────────────
    // Task List scoreboard tracks the CURRENT MONTH only (manually curated by Abhinanda).
    // For All Time or other ranges → use raw sheet data from computeMetrics above.
    const todayStr     = new Date().toISOString().slice(0, 10);
    const monthStart   = todayStr.slice(0, 8) + '01'; // e.g. 2026-04-01
    const isThisMonth  = date_from === monthStart && (!date_to || date_to >= monthStart);
    const isAllTime    = !date_from && !date_to;

    const currentMonthKey = todayStr.slice(0, 7); // e.g. '2026-04'

    if (isThisMonth) {
      // "This Month" selected → read Task List scoreboard, then persist to DB
      try {
        const sbRaw = execSync(
          `${GOG_PATH} sheets get ${TASK_LIST_SHEET_ID} "Task List!A5:C10" --account ${GOG_ACCOUNT} --json`,
          { encoding: 'utf8', timeout: 15000, env: process.env }
        );
        const sbRows = JSON.parse(sbRaw).values || [];
        const findRow  = (label) => sbRows.find(r => (r[0]||'').toLowerCase().includes(label)) || [];
        const parseNum = (v) => parseInt((v||'0').replace(/\D/g,'')) || 0;
        const callsRow   = findRow('calls scheduled');
        const repliesRow = findRow('replies received');
        const callsVal   = callsRow[2]   !== undefined ? parseNum(callsRow[2])   : null;
        const repliesVal = repliesRow[2] !== undefined ? parseNum(repliesRow[2]) : null;
        if (callsVal   != null) lauraM.calls_scheduled = callsVal;
        if (repliesVal != null) lauraM.replies         = repliesVal;
        lauraM._meta = { ...lauraM._meta, callsSource: 'task-list-scoreboard (this month)', repliesSource: 'task-list-scoreboard (this month)' };

        // ── Persist to DB so All Time can accumulate across months ──
        const upsertSnap = (metric, value, source) =>
          pgPool.query(
            `INSERT INTO metrics_snapshots (agent, month_key, metric, value, source, updated_at)
             VALUES ($1,$2,$3,$4,$5,NOW())
             ON CONFLICT (agent, month_key, metric)
             DO UPDATE SET value=$4, source=$5, updated_at=NOW()`,
            ['laura', currentMonthKey, metric, value, source]
          ).catch(() => {}); // non-fatal
        if (callsVal   != null) upsertSnap('calls_scheduled', callsVal,   'task-list-scoreboard');
        if (repliesVal != null) upsertSnap('replies',         repliesVal, 'task-list-scoreboard');
      } catch(e) { /* non-fatal — keep computed fallback */ }

    } else if (isAllTime) {
      // "All Time" → sum all persisted monthly snapshots from DB
      try {
        const snapRes = await pgPool.query(
          `SELECT metric, SUM(value) AS total
           FROM metrics_snapshots WHERE agent = 'laura'
           GROUP BY metric`
        );
        const snapMap = {};
        snapRes.rows.forEach(r => { snapMap[r.metric] = parseInt(r.total) || 0; });
        if (snapMap.calls_scheduled != null) lauraM.calls_scheduled = snapMap.calls_scheduled;
        if (snapMap.replies         != null) lauraM.replies         = snapMap.replies;
        lauraM._meta = { ...lauraM._meta, callsSource: 'db-all-time-sum', repliesSource: 'db-all-time-sum' };
      } catch(e) { /* non-fatal — fall back to sheet counts */ }
    }
    // Other date ranges → lauraM has sheet counts filtered by response_date

    // ── Darren-specific extra metrics (computed from live sheet data) ──────────
    const dwdmRows = darrenAll.filter(c => c.campaign === 'DWDM');
    const beadRows = darrenAll.filter(c => c.campaign === 'BEAD');
    const dcContactRows = darrenAll.filter(c => c.campaign === 'DC Contacts');
    const dcProjRows    = darrenAll.filter(c => c.campaign === 'DC Projects');

    // dwdmOnly already defined above
    const dwdmOnly = dwdmRows; // alias for computeMetrics (touch1/touch2 from DWDM)
    const darrenM = {
      ...computeMetrics(dwdmOnly, 'darren'),
      // Total contacts + unique companies across ALL Darren campaigns
      contacts:  darrenAll.filter(c => c.contact_name || c.email || c.company).length,
      companies: new Set(darrenAll.filter(c => c.company).map(c => c.company.trim().toLowerCase())).size,
      // Force replies + calls to null — Darren's sheet has NO reply/call columns.
      // The scoreboard override below will set real values if the DWDM Dashboard has them.
      // null = "not tracked" → renders as "—" in the UI (not 0).
      replies:         null,
      calls_scheduled: null,
      // Pipeline depth metrics (kept for internal use / future tabs)
      t3_reached:    dwdmRows.filter(c => (c.touch3||'').trim()).length,
      tier1_targets: dwdmRows.filter(c => (c.tier||'').trim() === 'Tier 1').length,
      bead_verified: beadRows.filter(c => (c.smtp_status||'').includes('ACCEPTED')).length,
      dc_high_priority: dcContactRows.filter(c => {
        const p = (c.priority||'').toUpperCase();
        return p.includes('HIGH') || p.includes('HIGHEST') || p.includes('STRATEGIC');
      }).length,
    };

    // ── Darren Scoreboard override: ONLY for "This Month" (same rule as Laura) ──
    // DWDM Dashboard has aggregated monthly metrics for Darren.
    if (isThisMonth) {
      try {
        const dbRaw = execSync(
          `${GOG_PATH} sheets get ${DARREN_SHEET_ID} "DWDM Dashboard!A1:D20" --account ${GOG_ACCOUNT} --json`,
          { encoding: 'utf8', timeout: 15000, env: process.env }
        );
        const dbRows   = JSON.parse(dbRaw).values || [];
        const findRow  = (label) => dbRows.find(r => (r[0]||'').toLowerCase().includes(label)) || [];
        const parseNum = (v) => parseInt((v||'0').replace(/\D/g,'')) || 0;
        const callsRow   = findRow('calls scheduled');
        const repliesRow = findRow('replies received');
        const dCallsVal   = (callsRow   && callsRow[1]   !== undefined) ? parseNum(callsRow[1])   : null;
        const dRepliesVal = (repliesRow && repliesRow[1] !== undefined) ? parseNum(repliesRow[1]) : null;
        if (dCallsVal   != null) darrenM.calls_scheduled = dCallsVal;
        if (dRepliesVal != null) darrenM.replies         = dRepliesVal;
        darrenM._meta = { ...darrenM._meta, callsSource: 'dwdm-dashboard (this month)' };

        // ── Persist to DB ──
        const upsertDarren = (metric, value, source) =>
          pgPool.query(
            `INSERT INTO metrics_snapshots (agent, month_key, metric, value, source, updated_at)
             VALUES ($1,$2,$3,$4,$5,NOW())
             ON CONFLICT (agent, month_key, metric)
             DO UPDATE SET value=$4, source=$5, updated_at=NOW()`,
            ['darren', currentMonthKey, metric, value, source]
          ).catch(() => {});
        if (dCallsVal   != null) upsertDarren('calls_scheduled', dCallsVal,   'dwdm-dashboard');
        if (dRepliesVal != null) upsertDarren('replies',         dRepliesVal, 'dwdm-dashboard');
      } catch(e) { /* non-fatal */ }

    } else if (isAllTime) {
      // "All Time" → sum all persisted monthly snapshots from DB
      try {
        const dSnapRes = await pgPool.query(
          `SELECT metric, SUM(value) AS total
           FROM metrics_snapshots WHERE agent = 'darren'
           GROUP BY metric`
        );
        const dSnapMap = {};
        dSnapRes.rows.forEach(r => { dSnapMap[r.metric] = parseInt(r.total) || 0; });
        if (dSnapMap.calls_scheduled != null) darrenM.calls_scheduled = dSnapMap.calls_scheduled;
        if (dSnapMap.replies         != null) darrenM.replies         = dSnapMap.replies;
        darrenM._meta = { ...darrenM._meta, callsSource: 'db-all-time-sum', repliesSource: 'db-all-time-sum' };
      } catch(e) { /* non-fatal */ }
    }
    // Other ranges: darrenM stays null for calls/replies (not tracked per-row)

    const byAgent = {};
    if (!agent || agent === 'all' || agent === 'laura')  byAgent.laura  = lauraM;
    if (!agent || agent === 'all' || agent === 'darren') byAgent.darren = darrenM;

    const combined = {
      companies:       (lauraM.companies   || 0) + (darrenM.companies   || 0),
      contacts:        (lauraM.contacts    || 0) + (darrenM.contacts    || 0),
      emails_sent:     (lauraM.emails_sent || 0) + (darrenM.emails_sent || 0),
      linkedin:        (lauraM.linkedin    || 0) + (darrenM.linkedin    || 0),
      // null means "not tracked" — only add if at least one agent tracks it
      replies:         (lauraM.replies != null || darrenM.replies != null)
                         ? (lauraM.replies || 0) + (darrenM.replies || 0) : null,
      calls_scheduled: (lauraM.calls_scheduled != null || darrenM.calls_scheduled != null)
                         ? (lauraM.calls_scheduled || 0) + (darrenM.calls_scheduled || 0) : null,
    };
    const result = { byAgent, combined };
    cacheSet(cacheKey, result);
    res.json(result);
  } catch (e) {
    console.error('contacts/metrics error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/contacts/intelligence-feed', async (req, res) => {
  try {
    const { agent } = req.query;
    const isSent  = v => !!(v && v.trim() !== '');
    const isReply = v => {
    if (!v || !v.trim()) return false;
    const lower = v.trim().toLowerCase();
    // Must contain a genuine prospect response indicator
    const replyKeywords = ['replied','reply','response','auto-reply','declined',
      'interested','not interested','scheduled','call booked','meeting',
      'referred','✅','❌','⛔'];
    return replyKeywords.some(kw => lower.includes(kw));
  };
    const isCall  = v => !!(v && !['', 'no', 'false', 'n', 'tbd', 'n/a'].includes(v.trim().toLowerCase()));

    const contacts = await readLauraContacts();
    const items = [];

    // Priority 0 — replied but no call scheduled yet
    contacts.filter(c => isReply(c.response_status || '') && !isCall(c.call_scheduled || ''))
      .slice(0, 20).forEach(c => items.push({ ...c, urgent_reason: 'Replied — schedule call', priority_order: 0 }));

    // Priority 1 — T1 sent, T2 pending
    contacts.filter(c => isSent(c.touch1 || '') && !isSent(c.touch2 || ''))
      .slice(0, 20).forEach(c => items.push({ ...c, urgent_reason: 'T1 sent, T2 pending', priority_order: 1 }));

    // Priority 2 — T2 sent, T3 pending
    contacts.filter(c => isSent(c.touch2 || '') && !isSent(c.touch3 || ''))
      .slice(0, 20).forEach(c => items.push({ ...c, urgent_reason: 'T2 sent, T3 pending', priority_order: 2 }));

    items.sort((a, b) => a.priority_order - b.priority_order);
    res.json({ items: items.slice(0, 50) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/contacts/campaign-counts', async (req, res) => {
  try {
    const lauraContacts = await readLauraContacts();
    const result = { laura: { total: 0 } };
    for (const c of lauraContacts) {
      const camp = c.campaign || 'Other';
      result.laura[camp] = (result.laura[camp] || 0) + 1;
      result.laura.total++;
    }

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/contacts/cost-breakdown', async (req, res) => {
  try {
    const isSent  = v => !!(v && v.trim() !== '');
    const isReply = v => {
    if (!v || !v.trim()) return false;
    const lower = v.trim().toLowerCase();
    // Must contain a genuine prospect response indicator
    const replyKeywords = ['replied','reply','response','auto-reply','declined',
      'interested','not interested','scheduled','call booked','meeting',
      'referred','✅','❌','⛔'];
    return replyKeywords.some(kw => lower.includes(kw));
  };
    const isCall  = v => !!(v && !['', 'no', 'false', 'n', 'tbd', 'n/a'].includes(v.trim().toLowerCase()));

    const buildBuckets = (rows, touchKeys) => {
      const [t1k, t2k, t3k, t4k] = touchKeys;
      const t1 = rows.filter(c => isSent(c[t1k]  || '')).length;
      const t2 = rows.filter(c => isSent(c[t2k]  || '')).length;
      const t3 = rows.filter(c => isSent(c[t3k]  || '')).length;
      const t4 = rows.filter(c => isSent(c[t4k]  || '')).length;
      const replies  = rows.filter(c => isReply(c['response_status'] || c['Response Status'] || '')).length;
      const calls    = rows.filter(c => isCall(c['call_scheduled'] || c['Call Scheduled?'] || '')).length;
      const companies = new Set(rows.map(c => c.company || c['Company'] || '')).size;
      const total = Math.max(companies + t1 + t2 + t3 + t4 + calls + replies, 1);
      return {
        buckets: {
          lead_generation: { label: 'Lead Generation', count: companies,   pct: Math.round((companies / total) * 100) },
          outreach:        { label: 'Outreach',         count: t1+t2+t3,   pct: Math.round(((t1+t2+t3) / total) * 100) },
          follow_up:       { label: 'Follow-up',        count: t4,          pct: Math.round((t4 / total) * 100) },
          calls:           { label: 'Calls Scheduled',  count: calls,       pct: Math.round((calls / total) * 100) },
          replies:         { label: 'Replies Received', count: replies,     pct: Math.round((replies / total) * 100) },
        },
        total_contacts: rows.length,
        total_touches:  t1 + t2 + t3 + t4,
      };
    };

    const [lauraContacts, darrenAllContacts] = await Promise.all([
      readLauraContacts(),
      readDarrenContacts(),
    ]);
    const dwdmForBuckets = darrenAllContacts.filter(c => c.campaign === 'DWDM');

    const byAgent = {
      laura:  buildBuckets(lauraContacts, ['touch1','touch2','touch3','touch4']),
      darren: buildBuckets(dwdmForBuckets, ['touch1','touch2','touch3','touch4']),
    };
    res.json({ byAgent });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/fiber-connect-leads', (_req, res) => {
  try {
    const fiberPath = join(__dirname, '..', '..', '..', 'LEAD-GEN', 'FiberConnect_2026_Leads.html');
    if (existsSync(fiberPath)) return res.type('text/html').send(readFileSync(fiberPath, 'utf8'));
    // Graceful empty — tab shows "No leads" instead of 404
    res.type('text/html').send('<table><tr><th>name</th><th>company</th><th>title</th><th>email</th></tr></table>');
  } catch (e) {
    res.type('text/html').send('<table><tr><th>name</th><th>company</th><th>title</th><th>email</th></tr></table>');
  }
});

// ── Ensure both agents exist in agent_registry ────────────────────────────────
(async () => {
  try {
    for (const [id, agentName] of [[LAURA_AGENT_ID, 'Laura'], [DARREN_AGENT_ID, 'Darren']]) {
      await bbPool.query(`
        INSERT INTO agent_registry (agent_id, agent_name, active, first_seen_at, last_active_at)
        VALUES ($1, $2, true, NOW(), NOW())
        ON CONFLICT (agent_id) DO UPDATE SET last_active_at = NOW()
      `, [id, agentName]);
    }
  } catch (e) {
    // agent_registry may not exist yet on first boot — non-fatal
    console.warn('agent_registry seed skipped:', e.message);
  }
})();

// ── Zara routes ───────────────────────────────────────────────────────────────
/** GET /api/zara/activities */
app.get('/api/zara/activities', async (req, res) => {
  const limit    = Math.min(parseInt(req.query.limit)||50, 200);
  const days     = parseInt(req.query.days)||7;
  const category = req.query.category || null;
  try {
    const params = [ZARA_AGENT_ID, days];
    let extra = '';
    if (category && category !== 'all') {
      params.push(category);
      extra = ` AND category = $${params.length}`;
    }
    params.push(limit);
    const r = await pgPool.query(
      `SELECT id, agent_id, type, category, requested_by, title, request, actions,
              time_saved_min AS "timeSavedMin", cost_usd AS "costUsd", model,
              input_tokens AS "inputTokens", output_tokens AS "outputTokens",
              cache_read_tokens AS "cacheReadTokens", cache_write_tokens AS "cacheWriteTokens",
              total_tokens AS "totalTokens", source,
              timestamp, created_at
       FROM agent_activities
       WHERE agent_id=$1
         AND timestamp >= NOW() - ($2::text || ' days')::INTERVAL
         AND source NOT IN ('cron-log','tracker')
         ${extra}
       ORDER BY timestamp DESC
       LIMIT $${params.length}`,
      params
    );
    const catAgg = {};
    for (const row of r.rows) {
      const cat = row.category || 'other';
      if (!catAgg[cat]) catAgg[cat] = { count: 0, cost: 0, timeSaved: 0 };
      catAgg[cat].count++;
      catAgg[cat].cost      = Math.round((catAgg[cat].cost      + (Number(row.costUsd)||0)) * 10000) / 10000;
      catAgg[cat].timeSaved = catAgg[cat].timeSaved + (Number(row.timeSavedMin)||0);
    }
    res.json({ ok: true, activities: r.rows, total: r.rowCount, byCategory: catAgg });
  } catch (e) {
    console.error('/api/zara/activities error:', e.message);
    res.json({ ok: true, activities: [], total: 0, byCategory: {}, note: e.message });
  }
});

/** GET /api/zara/db-costs */
app.get('/api/zara/db-costs', async (req, res) => {
  const days = Math.min(parseInt(req.query.days)||30, 90);
  try {
    const dailyR = await pgPool.query(`
      SELECT DATE(timestamp AT TIME ZONE 'America/New_York') AS day,
             COALESCE(SUM(cost_usd),0)::float AS cost,
             COUNT(*)::int AS activity_count,
             COALESCE(SUM(time_saved_min),0)::int AS time_saved_min
      FROM agent_activities
      WHERE agent_id=$1 AND timestamp >= NOW() - ($2::text||' days')::INTERVAL
        AND source NOT IN ('cron-log','tracker')
      GROUP BY 1 ORDER BY 1 DESC`, [ZARA_AGENT_ID, days]);
    const catR = await pgPool.query(`
      SELECT COALESCE(category,'other') AS category,
             COUNT(*)::int AS count, COALESCE(SUM(cost_usd),0)::float AS cost,
             COALESCE(SUM(time_saved_min),0)::int AS time_saved_min
      FROM agent_activities
      WHERE agent_id=$1 AND timestamp >= NOW() - ($2::text||' days')::INTERVAL
        AND source NOT IN ('cron-log','tracker')
      GROUP BY 1 ORDER BY cost DESC`, [ZARA_AGENT_ID, days]);
    const modelR = await pgPool.query(`
      SELECT COALESCE(model,'unknown') AS model,
             COUNT(*)::int AS count, COALESCE(SUM(cost_usd),0)::float AS cost,
             COALESCE(SUM(input_tokens),0)::bigint AS input_tokens,
             COALESCE(SUM(output_tokens),0)::bigint AS output_tokens
      FROM agent_activities
      WHERE agent_id=$1 AND timestamp >= NOW() - ($2::text||' days')::INTERVAL
        AND source NOT IN ('cron-log','tracker') AND model IS NOT NULL
      GROUP BY 1 ORDER BY cost DESC`, [ZARA_AGENT_ID, days]);
    const totalR = await pgPool.query(`
      SELECT COUNT(*)::int AS total_activities,
             COALESCE(SUM(cost_usd),0)::float AS total_cost,
             COALESCE(SUM(time_saved_min),0)::int AS total_time_saved,
             COALESCE(SUM(input_tokens),0)::bigint AS total_input_tokens,
             COALESCE(SUM(output_tokens),0)::bigint AS total_output_tokens,
             MIN(timestamp)::text AS first_activity, MAX(timestamp)::text AS last_activity
      FROM agent_activities
      WHERE agent_id=$1 AND timestamp >= NOW() - ($2::text||' days')::INTERVAL
        AND source NOT IN ('cron-log','tracker')`, [ZARA_AGENT_ID, days]);
    res.json({ ok: true, days, agentId: ZARA_AGENT_ID, totals: totalR.rows[0]||{}, byDay: dailyR.rows, byCategory: catR.rows, byModel: modelR.rows });
  } catch (e) {
    console.error('/api/zara/db-costs error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Camilla routes ─────────────────────────────────────────────────────────────
/** GET /api/camilla/activities */
app.get('/api/camilla/activities', async (req, res) => {
  const limit    = Math.min(parseInt(req.query.limit)||50, 200);
  const days     = parseInt(req.query.days)||7;
  const category = req.query.category || null;
  try {
    const params = [CAMILLA_AGENT_ID, days];
    let extra = '';
    if (category && category !== 'all') {
      params.push(category);
      extra = ` AND category = $${params.length}`;
    }
    params.push(limit);
    const r = await pgPool.query(
      `SELECT id, agent_id, type, category, requested_by, title, request, actions,
              time_saved_min AS "timeSavedMin", cost_usd AS "costUsd", model,
              input_tokens AS "inputTokens", output_tokens AS "outputTokens",
              cache_read_tokens AS "cacheReadTokens", cache_write_tokens AS "cacheWriteTokens",
              total_tokens AS "totalTokens", source,
              timestamp, created_at
       FROM agent_activities
       WHERE agent_id=$1
         AND timestamp >= NOW() - ($2::text || ' days')::INTERVAL
         AND source NOT IN ('cron-log','tracker')
         ${extra}
       ORDER BY timestamp DESC
       LIMIT $${params.length}`,
      params
    );
    const catAgg = {};
    for (const row of r.rows) {
      const cat = row.category || 'other';
      if (!catAgg[cat]) catAgg[cat] = { count: 0, cost: 0, timeSaved: 0 };
      catAgg[cat].count++;
      catAgg[cat].cost      = Math.round((catAgg[cat].cost      + (Number(row.costUsd)||0)) * 10000) / 10000;
      catAgg[cat].timeSaved = catAgg[cat].timeSaved + (Number(row.timeSavedMin)||0);
    }
    res.json({ ok: true, activities: r.rows, total: r.rowCount, byCategory: catAgg });
  } catch (e) {
    console.error('/api/camilla/activities error:', e.message);
    res.json({ ok: true, activities: [], total: 0, byCategory: {}, note: e.message });
  }
});

/** GET /api/camilla/db-costs */
app.get('/api/camilla/db-costs', async (req, res) => {
  const days = Math.min(parseInt(req.query.days)||30, 90);
  try {
    const dailyR = await pgPool.query(`
      SELECT DATE(timestamp AT TIME ZONE 'America/New_York') AS day,
             COALESCE(SUM(cost_usd),0)::float AS cost,
             COUNT(*)::int AS activity_count,
             COALESCE(SUM(time_saved_min),0)::int AS time_saved_min
      FROM agent_activities
      WHERE agent_id=$1 AND timestamp >= NOW() - ($2::text||' days')::INTERVAL
        AND source NOT IN ('cron-log','tracker')
      GROUP BY 1 ORDER BY 1 DESC`, [CAMILLA_AGENT_ID, days]);
    const catR = await pgPool.query(`
      SELECT COALESCE(category,'other') AS category,
             COUNT(*)::int AS count, COALESCE(SUM(cost_usd),0)::float AS cost,
             COALESCE(SUM(time_saved_min),0)::int AS time_saved_min
      FROM agent_activities
      WHERE agent_id=$1 AND timestamp >= NOW() - ($2::text||' days')::INTERVAL
        AND source NOT IN ('cron-log','tracker')
      GROUP BY 1 ORDER BY cost DESC`, [CAMILLA_AGENT_ID, days]);
    const modelR = await pgPool.query(`
      SELECT COALESCE(model,'unknown') AS model,
             COUNT(*)::int AS count, COALESCE(SUM(cost_usd),0)::float AS cost,
             COALESCE(SUM(input_tokens),0)::bigint AS input_tokens,
             COALESCE(SUM(output_tokens),0)::bigint AS output_tokens
      FROM agent_activities
      WHERE agent_id=$1 AND timestamp >= NOW() - ($2::text||' days')::INTERVAL
        AND source NOT IN ('cron-log','tracker') AND model IS NOT NULL
      GROUP BY 1 ORDER BY cost DESC`, [CAMILLA_AGENT_ID, days]);
    const totalR = await pgPool.query(`
      SELECT COUNT(*)::int AS total_activities,
             COALESCE(SUM(cost_usd),0)::float AS total_cost,
             COALESCE(SUM(time_saved_min),0)::int AS total_time_saved,
             COALESCE(SUM(input_tokens),0)::bigint AS total_input_tokens,
             COALESCE(SUM(output_tokens),0)::bigint AS total_output_tokens,
             MIN(timestamp)::text AS first_activity, MAX(timestamp)::text AS last_activity
      FROM agent_activities
      WHERE agent_id=$1 AND timestamp >= NOW() - ($2::text||' days')::INTERVAL
        AND source NOT IN ('cron-log','tracker')`, [CAMILLA_AGENT_ID, days]);
    res.json({ ok: true, days, agentId: CAMILLA_AGENT_ID, totals: totalR.rows[0]||{}, byDay: dailyR.rows, byCategory: catR.rows, byModel: modelR.rows });
  } catch (e) {
    console.error('/api/camilla/db-costs error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// GET /api/agent-activities — shared filtered activity feed from bb_agents RDS
// Used by dashboard UI to show meaningful activities, noise filtered out.
//
// Query params:
//   agent_id   — required (e.g. laura-abhi-agent, darren-abhi-agent)
//   days       — default 30, max 90
//   limit      — default 200, max 2000
//   category   — optional filter (user | routine | developer | lead-gen | etc.)
//   type       — optional filter (user-task | system | cron)
//
// Noise filter (server-side, matches JP spec 2026-05-06):
//   - Exclude heartbeat/cron shells with no real work (zero tokens + noise title)
//   - Exclude title = 'Heartbeat / System'
//   - Exclude title starting with 'Delta:' or 'HEARTBEAT'
//   - Exclude HEARTBEAT_OK and 'Cron job%' bare shells
// ════════════════════════════════════════════════════════════════════════════
app.get('/api/agent-activities', async (req, res) => {
  try {
    const agentId  = req.query.agent_id;
    if (!agentId) return res.status(400).json({ error: 'agent_id is required' });

    const days     = Math.min(parseInt(req.query.days)  || 30,  90);
    const limit    = Math.min(parseInt(req.query.limit) || 200, 2000);
    const category = req.query.category || null;
    const type     = req.query.type     || null;

    const params = [agentId, days];
    const extraClauses = [];

    if (category && category !== 'all') {
      params.push(category);
      extraClauses.push(`category = $${params.length}`);
    }
    if (type && type !== 'all') {
      params.push(type);
      extraClauses.push(`type = $${params.length}`);
    }

    const extraWhere = extraClauses.length ? `AND ${extraClauses.join(' AND ')}` : '';

    // ── SQL noise filter (bare heartbeat/cron shells with no real work) ───────
    // Matches the spec: exclude entries where there are no tokens AND the title
    // pattern marks them as a heartbeat/cron shell.
    const noiseFilter = `
      AND NOT (
        (cost_usd = 0 OR cost_usd IS NULL)
        AND (input_tokens = 0 OR input_tokens IS NULL)
        AND (output_tokens = 0 OR output_tokens IS NULL)
        AND (
          title ILIKE 'HEARTBEAT%'
          OR title = 'HEARTBEAT_OK'
          OR title ILIKE 'Cron job%'
        )
      )
    `;

    params.push(limit);
    const { rows } = await bbPool.query(`
      SELECT
        id, agent_id, type, category, requested_by, title, request, actions,
        model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
        total_tokens, cost_usd, time_saved_min, source, session_key,
        timestamp, created_at
      FROM agent_activities
      WHERE agent_id = $1
        AND timestamp >= NOW() - ($2::text || ' days')::INTERVAL
        ${extraWhere}
        ${noiseFilter}
      ORDER BY timestamp DESC
      LIMIT $${params.length}
    `, params);

    // ── In-code noise filter (titles that slip through SQL) ───────────────────
    const filtered = rows.filter(a => {
      const t = (a.title || '').trim();
      if (t === 'Heartbeat / System')   return false;
      if (t.startsWith('Delta:'))       return false;
      if (t.startsWith('HEARTBEAT'))    return false;
      if (t === 'HEARTBEAT_OK')         return false;
      return true;
    });

    // ── Summary stats ─────────────────────────────────────────────────────────
    const totalCost   = filtered.reduce((s, a) => s + (Number(a.cost_usd)      || 0), 0);
    const totalTokens = filtered.reduce((s, a) => s + (Number(a.total_tokens)  || 0), 0);
    const timeSaved   = filtered.reduce((s, a) => s + (Number(a.time_saved_min)|| 0), 0);

    const byCategory = {};
    for (const a of filtered) {
      const cat = a.category || 'other';
      if (!byCategory[cat]) byCategory[cat] = { count: 0, cost: 0 };
      byCategory[cat].count++;
      byCategory[cat].cost += Number(a.cost_usd) || 0;
    }
    Object.values(byCategory).forEach(v => {
      v.cost = Math.round(v.cost * 10000) / 10000;
    });

    res.json({
      ok:         true,
      agentId,
      days,
      total:      filtered.length,
      totalCost:  Math.round(totalCost * 10000) / 10000,
      totalTokens,
      timeSavedMin: timeSaved,
      byCategory,
      activities: filtered,
    });
  } catch (e) {
    console.error('GET /api/agent-activities error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/performance/recruiters — recruiter performance data
// Aggregates agent_tasks from bb_agents, structured as a recruiter performance
// table. When SMT DB is connected, swap the source query here.
// ══════════════════════════════════════════════════════════════════════════════
app.get('/api/performance/recruiters', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 14, 90);

    // Pull recruiting-related tasks from agent_activities
    const { rows } = await bbPool.query(`
      SELECT
        agent_id,
        requested_by,
        title,
        category,
        timestamp,
        cost_usd,
        total_tokens
      FROM agent_activities
      WHERE timestamp >= NOW() - ($1::text || ' days')::INTERVAL
        AND (
          category IN ('lead-gen','outreach','enrichment','follow-up','research')
          OR title ILIKE '%recruit%' OR title ILIKE '%candidate%'
          OR title ILIKE '%designer%' OR title ILIKE '%estimator%'
        )
      ORDER BY timestamp DESC
      LIMIT 200
    `, [days]);

    // Aggregate by requested_by (proxy for recruiter)
    const recruiterMap = {};
    for (const row of rows) {
      const name = row.requested_by || row.agent_id || 'System';
      if (!recruiterMap[name]) {
        recruiterMap[name] = { name, midweek: 0, endweek: 0, totalActivities: 0, totalCost: 0 };
      }
      recruiterMap[name].totalActivities++;
      recruiterMap[name].totalCost += Number(row.cost_usd) || 0;

      // Split on Wed noon ET for mid/end-week
      const ts = new Date(row.timestamp);
      const dayOfWeek = ts.getDay(); // 0=Sun, 3=Wed
      const hour = ts.getHours();
      if (dayOfWeek < 3 || (dayOfWeek === 3 && hour < 12)) {
        recruiterMap[name].midweek++;
      } else {
        recruiterMap[name].endweek++;
      }
    }

    // Build rows with mock targets (replace with real SMT goals when available)
    const TARGET_MID = 5;
    const TARGET_END = 10;
    const recruiters = Object.values(recruiterMap).map(r => ({
      ...r,
      targetMidweek: TARGET_MID,
      targetEndweek: TARGET_END,
      midPct: Math.min(100, Math.round((r.midweek / TARGET_MID) * 100)),
      endPct: Math.min(100, Math.round((r.endweek / TARGET_END) * 100)),
    }));

    res.json({ ok: true, recruiters, days, note: 'Aggregated from agent_activities; connect SMT DB for full recruiter goals.' });
  } catch (e) {
    console.error('GET /api/performance/recruiters error:', e.message);
    res.status(500).json({ ok: false, error: e.message, recruiters: [] });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/performance/sales — SDR outreach performance
// Aggregates outreach activities from agent_activities per agent (SDR).
// ══════════════════════════════════════════════════════════════════════════════
app.get('/api/performance/sales', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 30, 90);

    const { rows: acts } = await bbPool.query(`
      SELECT
        agent_id,
        category,
        title,
        timestamp,
        cost_usd,
        total_tokens,
        source
      FROM agent_activities
      WHERE timestamp >= NOW() - ($1::text || ' days')::INTERVAL
        AND category IN ('outreach','follow-up','lead-gen','email','inbound')
      ORDER BY timestamp DESC
      LIMIT 500
    `, [days]);

    // SDR map: agent_id → stats
    const sdrMap = {};
    for (const row of acts) {
      const id = row.agent_id;
      if (!sdrMap[id]) {
        sdrMap[id] = {
          agentId: id,
          outreach: 0, connections: 0, connectionsAccepted: 0,
          replies: 0, emails: 0, calls: 0, totalCost: 0,
          campaigns: [],
        };
      }
      const s = sdrMap[id];
      const t = (row.title || '').toLowerCase();
      if (row.category === 'outreach')  s.outreach++;
      if (row.category === 'email')     s.emails++;
      if (row.category === 'follow-up') s.replies++;
      if (row.category === 'inbound')   s.replies++;
      if (t.includes('linkedin') || t.includes('connection')) s.connections++;
      if (t.includes('accepted') || t.includes('connected'))  s.connectionsAccepted++;
      s.totalCost += Number(row.cost_usd) || 0;
    }

    const sdrs = Object.values(sdrMap).map(s => ({
      ...s,
      acceptanceRate: s.connections > 0 ? Math.round((s.connectionsAccepted / s.connections) * 100) : 0,
    }));

    // Fleet totals
    const totals = sdrs.reduce((acc, s) => ({
      outreach:    acc.outreach + s.outreach,
      connections: acc.connections + s.connections,
      replies:     acc.replies + s.replies,
      emails:      acc.emails + s.emails,
      totalCost:   acc.totalCost + s.totalCost,
    }), { outreach: 0, connections: 0, replies: 0, emails: 0, totalCost: 0 });

    res.json({ ok: true, sdrs, totals, days });
  } catch (e) {
    console.error('GET /api/performance/sales error:', e.message);
    res.status(500).json({ ok: false, error: e.message, sdrs: [], totals: {} });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// Zara — MZ Candidates spreadsheet endpoints
// Spreadsheet: "MZ CANDIDATES - Zara" (1tXwJyHdrfHGqZR33NS6rBiFN0RBVU_25hefJDU0DcZo)
// ════════════════════════════════════════════════════════════════════════════

const zaraSheetCache = {};
const ZARA_CACHE_TTL = 5 * 60 * 1000; // 5 min

const ZARA_ROLE_TABS = [
  'Business Services Tech',
  'Lead Network Engineer',
  'Wireless Engineers',
  'Core Refresh Engineer',
  'Core Engineer',
  'Cradlepoint Engineer',
  'Data Center Sales',
  'DC Conf- Sales',
  'AI Architect',
  'Field Network Tech',
];

/** GET /api/zara/candidates/dashboard — summary stats + role pipeline */
app.get('/api/zara/candidates/dashboard', async (req, res) => {
  const cacheKey = 'dashboard';
  const now = Date.now();
  if (zaraSheetCache[cacheKey] && now - zaraSheetCache[cacheKey].ts < ZARA_CACHE_TTL) {
    return res.json(zaraSheetCache[cacheKey].data);
  }
  try {
    const cmd = `${GOG_PATH} sheets get "${ZARA_MZ_SHEET_ID}" "Recruitment Dashboard!A1:Z30" --account ${GOG_ACCOUNT} --json`;
    const raw = execSync(cmd, { encoding: 'utf8', timeout: 20000, env: process.env });
    const parsed = JSON.parse(raw);
    const rows = parsed.values || [];

    // Parse summary header row (row 2): Last updated, Active role tabs, Total approved, Reached out
    const summaryRow = rows[1] || [];
    const summary = {
      lastUpdated:    summaryRow[1] || '',
      activeRoleTabs: summaryRow[4] || '',
      totalApproved:  summaryRow[7] || '',
      reachedOut:     summaryRow[10] || '',
    };

    // Parse pipeline table — find "Role" header row, then read data rows (skipping blanks)
    const roleHeaderIdx = rows.findIndex(r => r[0] === 'Role');
    const pipeline = [];
    if (roleHeaderIdx >= 0) {
      for (let i = roleHeaderIdx + 1; i < rows.length; i++) {
        const r = rows[i];
        const cell = (r[0] || '').trim();
        if (cell === 'Active Task Tracker' || cell === 'Task') break;
        if (!cell) continue; // skip blank rows
        pipeline.push({
          role:            cell,
          totalCandidates: r[1] || '0',
          approved:        r[2] || '0',
          reachedOut:      r[3] || '0',
          reachedOutRate:  r[4] || '0%',
          pendingOutreach: r[5] || '0',
        });
      }
    }

    // Parse task tracker — find "Task" header, then read rows until blank
    const taskHeaderIdx = rows.findIndex(r => r[0] === 'Task');
    const tasks = [];
    if (taskHeaderIdx >= 0) {
      for (let i = taskHeaderIdx + 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r[0]?.trim()) continue; // skip blanks inside task section
        if (r[0].trim() === 'Role Pipeline Summary' || r[0].trim() === 'Role') break;
        tasks.push({ task: r[0], roleScope: r[1], status: r[2], nextAction: r[3] });
      }
    }

    const data = { summary, pipeline, tasks, rawRows: rows.length };
    zaraSheetCache[cacheKey] = { ts: now, data };
    res.json(data);
  } catch (e) {
    console.error('Zara dashboard error:', e.message?.slice(0, 200));
    res.status(500).json({ error: e.message, summary: {}, pipeline: [], tasks: [] });
  }
});

/** GET /api/zara/candidates/role/:roleName — candidates for a specific role tab */
app.get('/api/zara/candidates/role/:roleName', async (req, res) => {
  const roleName = decodeURIComponent(req.params.roleName);
  const cacheKey = `role_${roleName}`;
  const now = Date.now();
  if (zaraSheetCache[cacheKey] && now - zaraSheetCache[cacheKey].ts < ZARA_CACHE_TTL) {
    return res.json(zaraSheetCache[cacheKey].data);
  }
  try {
    const cmd = `${GOG_PATH} sheets get "${ZARA_MZ_SHEET_ID}" "${roleName}!A1:Z500" --account ${GOG_ACCOUNT} --json`;
    const raw = execSync(cmd, { encoding: 'utf8', timeout: 25000, env: process.env });
    const parsed = JSON.parse(raw);
    const rows = parsed.values || [];
    if (rows.length < 2) return res.json({ role: roleName, candidates: [], total: 0 });

    const headers = rows[0].map(h => (h || '').trim());
    const candidates = rows.slice(1)
      .filter(r => r.some(c => c?.trim()))
      .map(r => {
        const obj = {};
        headers.forEach((h, i) => { obj[h] = (r[i] || '').trim(); });
        return obj;
      });

    const data = { role: roleName, headers, candidates, total: candidates.length };
    zaraSheetCache[cacheKey] = { ts: now, data };
    res.json(data);
  } catch (e) {
    console.error(`Zara role [${roleName}] error:`, e.message?.slice(0, 200));
    res.status(500).json({ error: e.message, role: roleName, candidates: [], total: 0 });
  }
});

/** GET /api/zara/candidates/tabs — list of available role tabs */
app.get('/api/zara/candidates/tabs', (_req, res) => {
  res.json({ tabs: ZARA_ROLE_TABS });
});

// ════════════════════════════════════════════════════════════════════════════
// Camilla — BB Candidates spreadsheet endpoints
// Spreadsheet: "BB CANDIDATES - Camilla" (1dqHZ2iRqBbmE4Zi3jO83xWuLgkhLT6FweoDWU_Y-pAo)
// ════════════════════════════════════════════════════════════════════════════

const camillaSheetCache = {};
const CAMILLA_CACHE_TTL = 5 * 60 * 1000; // 5 min

const CAMILLA_ROLE_TABS = [
  'TX Licensed Architect',
  'Bookkeepers',
  'CET Designers',
  'HR Generalist',
  'Specifiers',
];

/** GET /api/camilla/candidates/dashboard — summary stats + role pipeline */
app.get('/api/camilla/candidates/dashboard', async (req, res) => {
  const cacheKey = 'dashboard';
  const now = Date.now();
  if (camillaSheetCache[cacheKey] && now - camillaSheetCache[cacheKey].ts < CAMILLA_CACHE_TTL) {
    return res.json(camillaSheetCache[cacheKey].data);
  }
  try {
    const cmd = `${GOG_PATH} sheets get "${CAMILLA_BB_SHEET_ID}" "Recruitment Dashboard!A1:Z30" --account ${GOG_ACCOUNT} --json`;
    const raw = execSync(cmd, { encoding: 'utf8', timeout: 20000, env: process.env });
    const parsed = JSON.parse(raw);
    const rows = parsed.values || [];

    // Row 2 (index 1): subtitle / last refreshed string  e.g. "Last refreshed: 2026-05-04 UTC | ..."
    const subtitleRow = rows[1] || [];
    const lastRefreshed = (subtitleRow[0] || '').replace('Last refreshed:', '').split('|')[0].trim();

    // Rows 3-4 (index 3,4): "Active Roles / / Total Approved / / Reached Out" then values
    // Find the label row dynamically
    const labelRowIdx = rows.findIndex(r => (r[0] || '').trim() === 'Active Roles');
    const valueRow    = rows[labelRowIdx + 1] || [];
    const labelRow    = rows[labelRowIdx]     || [];
    // Labels are in cols 0,2,4; values same cols in next row
    const summary = {
      lastRefreshed,
      activeRoles:   valueRow[0] || '—',
      totalApproved: valueRow[2] || '—',
      reachedOut:    valueRow[4] || '—',
    };

    // Pipeline: find "Role" header row
    const roleHeaderIdx = rows.findIndex(r => (r[0] || '').trim() === 'Role');
    const pipeline = [];
    if (roleHeaderIdx >= 0) {
      for (let i = roleHeaderIdx + 1; i < rows.length; i++) {
        const r = rows[i];
        const cell = (r[0] || '').trim();
        if (!cell) continue;
        if (cell === 'Current Task Tracker' || cell === 'Task') break;
        pipeline.push({
          role:          cell,
          totalSourced:  r[1] || '0',
          approved:      r[2] || '0',
          reachedOut:    r[3] || '0',
          taskStatus:    r[4] || '',
          notes:         r[5] || '',
        });
      }
    }

    // Tasks: find "Task" header row
    const taskHeaderIdx = rows.findIndex(r => (r[0] || '').trim() === 'Task');
    const tasks = [];
    if (taskHeaderIdx >= 0) {
      for (let i = taskHeaderIdx + 1; i < rows.length; i++) {
        const r = rows[i];
        if (!(r[0] || '').trim()) continue;
        tasks.push({
          task:       r[0],
          role:       r[1],
          status:     r[2],
          nextAction: r[3],
          reviewer:   r[4],
          priority:   r[5],
        });
      }
    }

    const data = { summary, pipeline, tasks };
    camillaSheetCache[cacheKey] = { ts: now, data };
    res.json(data);
  } catch (e) {
    console.error('Camilla dashboard error:', e.message?.slice(0, 200));
    res.status(500).json({ error: e.message, summary: {}, pipeline: [], tasks: [] });
  }
});

/** GET /api/camilla/candidates/role/:roleName — candidates for a specific role tab */
app.get('/api/camilla/candidates/role/:roleName', async (req, res) => {
  const roleName = decodeURIComponent(req.params.roleName);
  const cacheKey = `role_${roleName}`;
  const now = Date.now();
  if (camillaSheetCache[cacheKey] && now - camillaSheetCache[cacheKey].ts < CAMILLA_CACHE_TTL) {
    return res.json(camillaSheetCache[cacheKey].data);
  }
  try {
    const cmd = `${GOG_PATH} sheets get "${CAMILLA_BB_SHEET_ID}" "${roleName}!A1:Z500" --account ${GOG_ACCOUNT} --json`;
    const raw = execSync(cmd, { encoding: 'utf8', timeout: 25000, env: process.env });
    const parsed = JSON.parse(raw);
    const rows = parsed.values || [];
    if (rows.length < 2) return res.json({ role: roleName, candidates: [], total: 0 });

    const headers = rows[0].map(h => (h || '').trim());
    const candidates = rows.slice(1)
      .filter(r => r.some(c => c?.trim()))
      .map(r => {
        const obj = {};
        headers.forEach((h, i) => { obj[h] = (r[i] || '').trim(); });
        return obj;
      });

    const data = { role: roleName, headers, candidates, total: candidates.length };
    camillaSheetCache[cacheKey] = { ts: now, data };
    res.json(data);
  } catch (e) {
    console.error(`Camilla role [${roleName}] error:`, e.message?.slice(0, 200));
    res.status(500).json({ error: e.message, role: roleName, candidates: [], total: 0 });
  }
});

/** GET /api/camilla/candidates/tabs — list of available role tabs */
app.get('/api/camilla/candidates/tabs', (_req, res) => {
  res.json({ tabs: CAMILLA_ROLE_TABS });
});
// ══════════════════════════════════════════════════════════════════════════════
// SMT — Recruiter Performance Tracker
// Tables: recruiters.goals + recruiters.activities (lola_readonly — smtReadPool)
// ══════════════════════════════════════════════════════════════════════════════

/** GET /api/smt/recruiter/goals — goals with pre-computed mid/end actuals via DB join */
app.get('/api/smt/recruiter/goals', async (req, res) => {
  const { start, end, recruiter } = req.query;
  try {
    const params = [];
    const gConds = [];
    const aConds = [];

    if (start) {
      params.push(start);
      gConds.push(`g.created_at::date >= $${params.length}`);
      aConds.push(`a.created_at::date >= $${params.length}`);
    }
    if (end) {
      params.push(end);
      gConds.push(`g.created_at::date <= $${params.length}`);
      aConds.push(`a.created_at::date <= $${params.length}`);
    }
    if (recruiter && recruiter !== 'All') {
      params.push(recruiter);
      gConds.push(`g.recruiter_name ILIKE $${params.length}`);
    }
    const gWhere = gConds.length ? 'WHERE ' + gConds.join(' AND ') : '';
    const aWhere = aConds.length ? 'AND '  + aConds.join(' AND ') : '';

    const { rows } = await smtReadPool.query(
      `SELECT
         g.id, g.recruiter_name, g.role, g.client,
         g.mid_week_stage, g.mid_week_target,
         g.end_week_stage, g.weekly_target,
         g.notes, g.candidates, g.created_at,
         COUNT(CASE
           WHEN a.goal_period = 'Mid-week' THEN 1
           WHEN a.goal_period IS NULL AND (
             EXTRACT(DOW FROM a.created_at AT TIME ZONE 'America/New_York') < 3
             OR (EXTRACT(DOW FROM a.created_at AT TIME ZONE 'America/New_York') = 3
                 AND EXTRACT(HOUR FROM a.created_at AT TIME ZONE 'America/New_York') < 12)
           ) THEN 1
         END)::int AS mid_actual,
         COUNT(CASE
           WHEN a.goal_period = 'End-week' THEN 1
           WHEN a.goal_period IS NULL AND (
             EXTRACT(DOW FROM a.created_at AT TIME ZONE 'America/New_York') > 3
             OR (EXTRACT(DOW FROM a.created_at AT TIME ZONE 'America/New_York') = 3
                 AND EXTRACT(HOUR FROM a.created_at AT TIME ZONE 'America/New_York') >= 12)
           ) THEN 1
         END)::int AS end_actual
       FROM recruiters.goals g
       LEFT JOIN recruiters.activities a
         ON LOWER(REPLACE(a.recruiter_name,' ','')) = LOWER(REPLACE(g.recruiter_name,' ',''))
        AND LOWER(TRIM(a.role))   = LOWER(TRIM(g.role))
        AND LOWER(TRIM(a.client)) = LOWER(TRIM(g.client))
        AND (LOWER(TRIM(a.stage)) = LOWER(TRIM(g.mid_week_stage))
          OR LOWER(TRIM(a.stage)) = LOWER(TRIM(g.end_week_stage)))
        ${aWhere}
       ${gWhere}
       GROUP BY g.id, g.recruiter_name, g.role, g.client,
                g.mid_week_stage, g.mid_week_target,
                g.end_week_stage, g.weekly_target,
                g.notes, g.candidates, g.created_at
       ORDER BY g.created_at DESC, g.recruiter_name, g.role`,
      params
    );
    res.json({ ok: true, goals: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/** GET /api/smt/recruiter/activities — drill-down, supports period+stage filter */
app.get('/api/smt/recruiter/activities', async (req, res) => {
  const { start, end, recruiter, role, client, period, stage } = req.query;
  try {
    const params = [];
    const conds  = [];
    if (start)    { params.push(start);     conds.push(`created_at::date >= $${params.length}`); }
    if (end)      { params.push(end);       conds.push(`created_at::date <= $${params.length}`); }
    if (recruiter && recruiter !== 'All') {
      params.push(recruiter); conds.push(`LOWER(REPLACE(recruiter_name,' ','')) = LOWER(REPLACE($${params.length},' ',''))`);
    }
    if (role)   { params.push(role);   conds.push(`LOWER(TRIM(role))   = LOWER(TRIM($${params.length}))`); }
    if (client) { params.push(client); conds.push(`LOWER(TRIM(client)) = LOWER(TRIM($${params.length}))`); }
    if (stage)  { params.push(stage);  conds.push(`LOWER(TRIM(stage))  = LOWER(TRIM($${params.length}))`); }
    if (period === 'mid') {
      conds.push(`(goal_period = 'Mid-week' OR (goal_period IS NULL AND (
        EXTRACT(DOW FROM created_at AT TIME ZONE 'America/New_York') < 3
        OR (EXTRACT(DOW FROM created_at AT TIME ZONE 'America/New_York') = 3
            AND EXTRACT(HOUR FROM created_at AT TIME ZONE 'America/New_York') < 12)
      )))`);
    } else if (period === 'end') {
      conds.push(`(goal_period = 'End-week' OR (goal_period IS NULL AND (
        EXTRACT(DOW FROM created_at AT TIME ZONE 'America/New_York') > 3
        OR (EXTRACT(DOW FROM created_at AT TIME ZONE 'America/New_York') = 3
            AND EXTRACT(HOUR FROM created_at AT TIME ZONE 'America/New_York') >= 12)
      )))`);
    }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const { rows } = await smtReadPool.query(
      `SELECT id, recruiter_name, role, client, candidate_name, stage,
              goal_period, notes, status, created_at
       FROM recruiters.activities ${where}
       ORDER BY created_at DESC
       LIMIT 500`,
      params
    );
    res.json({ ok: true, activities: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/** GET /api/smt/recruiter/names */
app.get('/api/smt/recruiter/names', async (req, res) => {
  try {
    const { rows } = await smtReadPool.query(
      `SELECT DISTINCT recruiter_name FROM recruiters.goals ORDER BY 1`
    );
    res.json({ ok: true, recruiters: rows.map(r => r.recruiter_name) });
  } catch (e) {
    if (e.message.includes('does not exist')) return res.json({ ok: true, recruiters: [], pending: true });
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SMT — Sales Performance Tracker
// Tables: sales.dashboard_campaigns + sales.dashboard_skylead_ids (lola_readonly)
// ══════════════════════════════════════════════════════════════════════════════

/** GET /api/smt/sales/campaigns */
app.get('/api/smt/sales/campaigns', async (req, res) => {
  const { start, end, account_id } = req.query;
  try {
    const params = [];
    const conds  = [];
    if (start) { params.push(start); conds.push(`dc.created_at >= $${params.length}::date`); }
    if (end)   { params.push(end);   conds.push(`dc.created_at <= $${params.length}::date`); }
    if (account_id && account_id !== 'all') { params.push(account_id); conds.push(`dc.account_id = $${params.length}`); }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const { rows } = await smtReadPool.query(
      `SELECT dc.campaign_id, dc.campaign_name, dc.account_id, ds.account_name,
              dc.hiring, dc.linkedin_outreach_activity, dc.connections_requested,
              dc.connection_requests_accepted, dc.connection_replies,
              dc.emails_sent, dc.inmails_sent, dc.calls,
              dc.acceptance_rate, dc.response_rate, dc.created_at
       FROM sales.dashboard_campaigns dc
       JOIN sales.dashboard_skylead_ids ds ON dc.account_id = ds.account_id
       ${where}
       ORDER BY dc.created_at DESC, ds.account_name`,
      params
    );
    res.json({ ok: true, campaigns: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/** GET /api/smt/sales/sdrs */
app.get('/api/smt/sales/sdrs', async (req, res) => {
  try {
    const { rows } = await smtReadPool.query(
      `SELECT account_id, account_name FROM sales.dashboard_skylead_ids ORDER BY account_name`
    );
    res.json({ ok: true, sdrs: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// Command Center Skylead proxy endpoints
// /api/skylead/stats     → aggregates from smt.sales.dashboard_campaigns
// /api/skylead/sdr-summary → per-agent SDR breakdown
// /api/skylead/campaigns → pass-through of existing campaigns endpoint
// ══════════════════════════════════════════════════════════════════════════════

/** GET /api/skylead/stats — Sales overview KPIs */
app.get('/api/skylead/stats', async (req, res) => {
  try {
    // period: 'today' | '7d' (default) | '30d' | 'all' | custom startDate+endDate
    const period    = req.query.period    || '7d';
    const startDate = req.query.startDate || null;
    const endDate   = req.query.endDate   || null;

    let whereClause = '';
    let params = [];

    if (startDate && endDate) {
      params        = [startDate, endDate];
      whereClause   = 'WHERE dc.created_at BETWEEN $1::date AND $2::date';
    } else if (period === 'today') {
      whereClause   = "WHERE dc.created_at = CURRENT_DATE";
    } else if (period === '7d') {
      whereClause   = "WHERE dc.created_at >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (period === '30d') {
      whereClause   = "WHERE dc.created_at >= CURRENT_DATE - INTERVAL '30 days'";
    }
    // period === 'all' → no filter

    const { rows } = await smtAdminPool.query(`
      SELECT
        COUNT(DISTINCT dc.campaign_id)                    AS total_campaigns,
        COALESCE(SUM(dc.connections_requested), 0)        AS cr_sent,
        COALESCE(SUM(dc.connection_requests_accepted), 0) AS cr_accepted,
        COALESCE(SUM(dc.connection_replies), 0)           AS total_replies,
        COALESCE(SUM(dc.emails_sent), 0)                  AS emails_sent,
        COALESCE(SUM(dc.inmails_sent), 0)                 AS inmails_sent,
        COALESCE(SUM(dc.emails_bounced), 0)               AS emails_bounced,
        COALESCE(AVG(NULLIF(dc.bounce_rate, 0)), 0)       AS bounce_rate_avg,
        COALESCE(AVG(NULLIF(dc.acceptance_rate, 0)), 0)   AS acceptance_rate_avg,
        COALESCE(AVG(NULLIF(dc.response_rate, 0)), 0)     AS response_rate_avg,
        MAX(dc.created_at)                                AS latest_date,
        (
          SELECT COUNT(*) FROM sales.dashboard_call_records cr2
          WHERE cr2.campaign_name IN (
            SELECT DISTINCT dcx.campaign_name FROM sales.dashboard_campaigns dcx
            JOIN sales.dashboard_skylead_ids dsx ON dcx.account_id = dsx.account_id
            ${whereClause.replace(/\bdc\b/g,'dcx').replace(/\bds\b/g,'dsx')}
          )
        ) AS meetings_booked,
        (
          SELECT COUNT(*) FROM sales.dashboard_call_records cr2
          WHERE LOWER(cr2.outcome) = 'completed'
            AND cr2.campaign_name IN (
              SELECT DISTINCT dcx.campaign_name FROM sales.dashboard_campaigns dcx
              JOIN sales.dashboard_skylead_ids dsx ON dcx.account_id = dsx.account_id
              ${whereClause.replace(/\bdc\b/g,'dcx').replace(/\bds\b/g,'dsx')}
            )
        ) AS actual_meetings
      FROM sales.dashboard_campaigns dc
      JOIN sales.dashboard_skylead_ids ds ON dc.account_id = ds.account_id
      ${whereClause}
    `, params);

    const r        = rows[0] || {};
    const crSent   = Number(r.cr_sent)       || 0;
    const crAccepted = Number(r.cr_accepted) || 0;
    const emails   = Number(r.emails_sent)   || 0;
    const replies  = Number(r.total_replies) || 0;
    const bounced  = Number(r.emails_bounced)|| 0;

    // Prefer DB-stored rates if non-zero, else compute from counts
    const acceptRate = crSent > 0 ? Math.round((crAccepted / crSent) * 100) : 0;
    const replyRate  = crSent > 0 ? Math.round((replies    / crSent) * 100) : 0;
    const bounceRate = emails > 0 ? Math.round((bounced    / emails) * 100) : 0;

    res.json({
      ok:              true,
      period,
      latest_date:     r.latest_date || null,
      total_campaigns: Number(r.total_campaigns) || 0,
      cr_sent:         crSent,
      cr_accepted:     crAccepted,
      total_replies:   replies,
      emails_sent:     emails,
      inmails_sent:    Number(r.inmails_sent) || 0,
      emails_bounced:  bounced,
      accept_rate:     acceptRate,
      reply_rate:      replyRate,
      bounce_rate:     bounceRate,
      // aliases used by CommandCenterOverview
      new_contacts:    crSent,
      responses:       replies,
      meetings_booked: Number(r.meetings_booked) || 0,
      actual_meetings: Number(r.actual_meetings) || 0,
    });
  } catch (e) {
    console.error('GET /api/skylead/stats error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

/** GET /api/skylead/sdr-summary — per-agent SDR breakdown (includes account_id + campaigns[])
  *  created_at = campaign launch date (matches date prefix in campaign name).
 *  Filtering by date scopes to campaigns launched in that window. */
app.get('/api/skylead/sdr-summary', async (req, res) => {
  try {
    const period = req.query.period || 'all';
    const start  = req.query.startDate || null;
    const end    = req.query.endDate   || null;

    let dateWhere = '';
    let params    = [];
    if (start && end) {
      params    = [start, end];
      dateWhere = 'WHERE dc.created_at BETWEEN $1::date AND $2::date';
    } else if (period === 'today') {
      dateWhere = 'WHERE dc.created_at = CURRENT_DATE';
    } else if (period === '7d') {
      dateWhere = "WHERE dc.created_at >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (period === '30d') {
      dateWhere = "WHERE dc.created_at >= CURRENT_DATE - INTERVAL '30 days'";
    }
    // 'all' → no filter — returns lifetime totals across all campaigns

    // Build call_date filter matching the same period window
    let callDateFilter = '';
    if (start && end) {
      callDateFilter = `AND cr.call_date::date BETWEEN '${start}'::date AND '${end}'::date`;
    } else if (period === 'today') {
      callDateFilter = 'AND cr.call_date::date = CURRENT_DATE';
    } else if (period === '7d') {
      callDateFilter = "AND cr.call_date::date >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (period === '30d') {
      callDateFilter = "AND cr.call_date::date >= CURRENT_DATE - INTERVAL '30 days'";
    }
    // 'all' → callDateFilter stays '' → no date restriction on calls

    // Agent-level aggregates — calls filtered by call_date matching the selected period
    const { rows: agentRows } = await smtAdminPool.query(`
      SELECT
        ds.account_id,
        ds.account_name                                                   AS name,
        COUNT(DISTINCT dc.campaign_id)                                    AS campaigns,
        COALESCE(SUM(dc.connections_requested), 0)                        AS cr_sent,
        COALESCE(SUM(dc.connection_requests_accepted), 0)                 AS cr_accepted,
        COALESCE(SUM(dc.connection_replies), 0)                           AS replies,
        COALESCE(SUM(dc.emails_sent), 0)                                  AS emails,
        COALESCE(SUM(dc.inmails_sent), 0)                                 AS inmails,
        COALESCE((
          SELECT COUNT(*) FROM sales.dashboard_call_records cr
          WHERE cr.account_id = ds.account_id ${callDateFilter}
        ), 0)                                                             AS calls,
        COALESCE((
          SELECT COUNT(*) FROM sales.dashboard_call_records cr
          WHERE cr.account_id = ds.account_id
            AND LOWER(cr.outcome) = 'completed' ${callDateFilter}
        ), 0)                                                             AS actual_meetings
      FROM sales.dashboard_campaigns dc
      JOIN sales.dashboard_skylead_ids ds ON dc.account_id = ds.account_id
      ${dateWhere}
      GROUP BY ds.account_id, ds.account_name
      ORDER BY cr_sent DESC
    `, params);

    // Per-campaign detail (for modal breakdown) — calls + actual_meetings scoped to campaign_name + date
    const { rows: campRows } = await smtAdminPool.query(`
      SELECT
        dc.campaign_id,
        dc.campaign_name,
        dc.account_id,
        dc.connections_requested,
        dc.connection_requests_accepted,
        dc.connection_replies,
        dc.emails_sent,
        dc.activity,
        dc.created_at,
        COALESCE((
          SELECT COUNT(*) FROM sales.dashboard_call_records cr
          WHERE cr.campaign_name = dc.campaign_name AND cr.account_id = dc.account_id
          ${callDateFilter}
        ), 0) AS calls,
        COALESCE((
          SELECT COUNT(*) FROM sales.dashboard_call_records cr
          WHERE cr.campaign_name = dc.campaign_name AND cr.account_id = dc.account_id
            AND LOWER(cr.outcome) = 'completed' ${callDateFilter}
        ), 0) AS actual_meetings
      FROM sales.dashboard_campaigns dc
      JOIN sales.dashboard_skylead_ids ds ON dc.account_id = ds.account_id
      ${dateWhere}
      ORDER BY dc.account_id, dc.connection_replies DESC
    `, params);

    // Call records — filtered by the same date window as the SDR period
    const callRecordsWhere = callDateFilter
      ? callDateFilter.replace(/^AND cr\./, 'WHERE ').replace(/\bcr\./g, '')
      : '';
    const { rows: callRows } = await smtAdminPool.query(
      `SELECT * FROM sales.dashboard_call_records ${callRecordsWhere} ORDER BY created_at DESC`
    );

    // Group campaigns by account_id
    const campByAccount = {};
    for (const c of campRows) {
      if (!campByAccount[c.account_id]) campByAccount[c.account_id] = [];
      campByAccount[c.account_id].push({
        campaign_id:                   Number(c.campaign_id),
        campaign_name:                 c.campaign_name,
        account_id:                    Number(c.account_id),
        connections_requested:         Number(c.connections_requested)         || 0,
        connection_requests_accepted:  Number(c.connection_requests_accepted)  || 0,
        connection_replies:            Number(c.connection_replies)            || 0,
        emails_sent:                   Number(c.emails_sent)                   || 0,
        calls:                         Number(c.calls)                         || 0,
        actual_meetings:               Number(c.actual_meetings)               || 0,
        activity:                      c.activity || '',
      });
    }

    const agents = agentRows.map(r => ({
      account_id:      Number(r.account_id),
      account_name:    r.name,
      name:            r.name,
      campaigns:       Number(r.campaigns)       || 0,
      cr_sent:         Number(r.cr_sent)         || 0,
      cr_accepted:     Number(r.cr_accepted)     || 0,
      replies:         Number(r.replies)         || 0,
      emails:          Number(r.emails)          || 0,
      calls:           Number(r.calls)           || 0,
      actual_meetings: Number(r.actual_meetings) || 0,
      li_out:          Number(r.inmails)         || 0,
      accept_pct:  r.cr_sent > 0 ? `${Math.round((r.cr_accepted / r.cr_sent) * 100)}%` : '—',
      reply_pct:   r.cr_sent > 0 ? `${Math.round((r.replies     / r.cr_sent) * 100)}%` : '—',
      campaign_list: campByAccount[Number(r.account_id)] || [],
    }));

    res.json({ ok: true, agents, call_records: callRows });
  } catch (e) {
    console.error('GET /api/skylead/sdr-summary error:', e.message);
    res.status(500).json({ ok: false, error: e.message, agents: [] });
  }
});

/** GET /api/skylead/campaigns — ranked top + low performers */
app.get('/api/skylead/campaigns', async (req, res) => {
  try {
    const period    = req.query.period    || 'all';  // default all-time for ranking
    const startDate = req.query.startDate || null;
    const endDate   = req.query.endDate   || null;
    const limit     = Math.min(parseInt(req.query.limit) || 5, 20);

    let whereClause = '';
    let params = [];
    if (startDate && endDate) {
      params = [startDate, endDate];
      whereClause = 'AND dc.created_at BETWEEN $1::date AND $2::date';
    } else if (period === 'today') {
      whereClause = "AND dc.created_at = CURRENT_DATE";
    } else if (period === '7d') {
      whereClause = "AND dc.created_at >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (period === '30d') {
      whereClause = "AND dc.created_at >= CURRENT_DATE - INTERVAL '30 days'";
    }
    // 'all' → no date filter

    const baseQ = `
      WITH ranked AS (
        SELECT
          dc.campaign_id,
          dc.campaign_name,
          ds.account_name,
          dc.connections_requested                        AS cr_sent,
          dc.connection_requests_accepted                 AS cr_accepted,
          dc.connection_replies                           AS replies,
          dc.emails_sent,
          dc.inmails_sent,
          dc.emails_bounced,
          dc.created_at,
          CASE WHEN dc.connections_requested > 0
               THEN ROUND(dc.connection_replies::numeric / dc.connections_requested * 100, 1)
               ELSE 0 END AS reply_pct,
          CASE WHEN dc.connections_requested > 0
               THEN ROUND(dc.connection_requests_accepted::numeric / dc.connections_requested * 100, 1)
               ELSE 0 END AS accept_pct,
          CASE WHEN (dc.emails_sent + dc.connections_requested) > 0
               THEN ROUND(dc.connection_replies::numeric / NULLIF(dc.emails_sent + dc.connections_requested, 0) * 100, 1)
               ELSE 0 END AS overall_rate
        FROM sales.dashboard_campaigns dc
        JOIN sales.dashboard_skylead_ids ds ON dc.account_id = ds.account_id
        WHERE dc.connections_requested >= 5 ${whereClause}
      )
    `;

    const [topRows, lowRows] = await Promise.all([
      smtReadPool.query(
        baseQ + `SELECT * FROM ranked ORDER BY reply_pct DESC, accept_pct DESC LIMIT $${params.length + 1}`,
        [...params, limit]
      ),
      smtReadPool.query(
        baseQ + `SELECT * FROM ranked WHERE reply_pct <= 2 ORDER BY reply_pct ASC, accept_pct ASC LIMIT $${params.length + 1}`,
        [...params, limit]
      ),
    ]);

    const shape = r => ({
      id:          r.campaign_id,
      name:        r.campaign_name,
      agent:       r.account_name,
      cr_sent:     Number(r.cr_sent)     || 0,
      cr_accepted: Number(r.cr_accepted) || 0,
      replies:     Number(r.replies)     || 0,
      emails:      Number(r.emails_sent) || 0,
      accept_pct:  Number(r.accept_pct)  || 0,
      reply_pct:   Number(r.reply_pct)   || 0,
      overall_rate:Number(r.overall_rate)|| 0,
      created_at:  r.created_at,
    });

    res.json({
      ok:   true,
      period,
      top:  topRows.rows.map(shape),
      low:  lowRows.rows.map(shape),
    });
  } catch (e) {
    console.error('GET /api/skylead/campaigns error:', e.message);
    res.status(500).json({ ok: false, error: e.message, top: [], low: [] });
  }
});

/** POST /api/skylead/trigger-sync — pull fresh campaign stats from Skylead into the DB */
app.post('/api/skylead/trigger-sync', async (req, res) => {
  res.json({ ok: true, message: 'Skylead sync started in background.' });

  (async () => {

    const BASE = 'https://api.multilead.io/api/open-api/v1';
    const USER_ID = 36116;
    const headers = { Authorization: SKYLEAD_KEY };
    const client = await smtAdminPool.connect();
    try {
      const { rows: accounts } = await client.query(
        'SELECT account_id FROM sales.dashboard_skylead_ids'
      );
      for (const { account_id } of accounts) {
        try {
          const url = `${BASE}/users/${USER_ID}/accounts/${account_id}/campaigns?limit=100000`;
          const resp = await fetch(url, { headers });
          if (!resp.ok) { console.error(`Skylead ${account_id}: HTTP ${resp.status}`); continue; }
          const body = await resp.json();
          const campaigns = body?.result?.campaigns || [];
          if (campaigns.length === 0) { console.log(`Skylead ${account_id}: 0 campaigns returned, skipping.`); continue; }

          // Pure upsert — never delete. Insert new campaigns, update existing ones.
          let upserted = 0;
          for (const c of campaigns) {
            const s = c.campaignStats || {};
            const parts = (c.name || '').split(' - ');
            const industry = parts[1] || null;
            const hiringRaw = (parts[2] || '').toLowerCase().trim();
            const hiring = hiringRaw === 'hiring' ? true
              : (hiringRaw === 'nothiring' || hiringRaw === 'nonhiring') ? false
              : null;
            const activity = parts[3] || null;
            const createdAt = c.createdAt ? c.createdAt.split('T')[0] : new Date().toISOString().split('T')[0];
            try {
              await client.query(`
                INSERT INTO sales.dashboard_campaigns
                  (campaign_id, campaign_name, account_id, created_at,
                   connection_replies, connections_requested, connection_requests_accepted,
                   inmails_sent, emails_sent, emails_bounced,
                   response_rate, acceptance_rate, open_rate, click_rate, bounce_rate,
                   industry, hiring, activity)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
                ON CONFLICT (campaign_id) DO UPDATE SET
                  campaign_name               = EXCLUDED.campaign_name,
                  connection_replies          = EXCLUDED.connection_replies,
                  connections_requested       = EXCLUDED.connections_requested,
                  connection_requests_accepted= EXCLUDED.connection_requests_accepted,
                  inmails_sent               = EXCLUDED.inmails_sent,
                  emails_sent                = EXCLUDED.emails_sent,
                  emails_bounced             = EXCLUDED.emails_bounced,
                  response_rate              = EXCLUDED.response_rate,
                  acceptance_rate            = EXCLUDED.acceptance_rate,
                  open_rate                  = EXCLUDED.open_rate,
                  click_rate                 = EXCLUDED.click_rate,
                  bounce_rate                = EXCLUDED.bounce_rate,
                  industry                   = EXCLUDED.industry,
                  hiring                     = EXCLUDED.hiring,
                  activity                   = EXCLUDED.activity
              `, [
                c.id, c.name, account_id, createdAt,
                s.connectionReplies||0, s.connectionsRequested||0, s.connectionRequestsAccepted||0,
                s.inmailsSent||0, s.emailsSent||0, s.emailsBounced||0,
                s.responseRate||0, s.acceptanceRate||0, s.openRate||0, s.clickRate||0, s.bounceRate||0,
                industry, hiring, activity,
              ]);
              upserted++;
            } catch (rowErr) {
              console.error(`Skylead sync: campaign ${c.id} (${c.name}) upsert error —`, rowErr.message);
            }
          }
          console.log(`Skylead sync: account ${account_id} — ${upserted}/${campaigns.length} campaigns upserted.`);
        } catch (err) {
          console.error(`Skylead sync error account ${account_id}:`, err.message);
        }
      }
      console.log('Skylead sync: all accounts complete.');
    } finally {
      client.release();
    }
  })().catch(e => console.error('Skylead background sync error:', e.message));
});

/** GET /api/skylead/sandbox — campaign performance sandbox (per-campaign SDR breakdown) */
app.get('/api/skylead/sandbox', async (req, res) => {
  try {
    const period    = req.query.period || 'all';
    const startDate = req.query.startDate || null;
    const endDate   = req.query.endDate   || null;
    const limit     = parseInt(req.query.limit) || 0; // 0 = no limit

    let whereClause = '';
    let params = [];
    if (startDate && endDate) {
      params = [startDate, endDate];
      whereClause = 'AND dc.created_at BETWEEN $1::date AND $2::date';
    } else if (period === 'today') {
      whereClause = "AND dc.created_at = CURRENT_DATE";
    } else if (period === '7d') {
      whereClause = "AND dc.created_at >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (period === '30d') {
      whereClause = "AND dc.created_at >= CURRENT_DATE - INTERVAL '30 days'";
    }

    // Per-campaign, per-SDR breakdown — calls counted from call_records
    const q = `
      SELECT
        dc.campaign_name,
        ds.account_name,
        ds.account_id,
        MIN(dc.campaign_id)                   AS campaign_id,
        MIN(dc.activity)                      AS activity,
        MIN(dc.target_icp)                    AS target_icp,
        MIN(dc.channel)                       AS channel,
        SUM(dc.connections_requested)         AS cr_sent,
        SUM(dc.connection_requests_accepted)  AS cr_accepted,
        SUM(dc.connection_replies)            AS replies,
        SUM(dc.emails_sent)                   AS emails,
        SUM(dc.inmails_sent)                  AS li_out,
        COUNT(*)                              AS campaign_rows,
        COALESCE((
          SELECT COUNT(*) FROM sales.dashboard_call_records cr
          WHERE cr.campaign_name = dc.campaign_name AND cr.account_id = ds.account_id
        ), 0)                                 AS calls,
        COALESCE((
          SELECT COUNT(*) FROM sales.dashboard_call_records cr
          WHERE cr.campaign_name = dc.campaign_name AND cr.account_id = ds.account_id
            AND LOWER(cr.outcome) = 'completed'
        ), 0)                                 AS actual_meetings
      FROM sales.dashboard_campaigns dc
      JOIN sales.dashboard_skylead_ids ds ON dc.account_id = ds.account_id
      WHERE 1=1 ${whereClause}
      GROUP BY dc.campaign_name, ds.account_name, ds.account_id, dc.target_icp, dc.channel
      ORDER BY dc.campaign_name, ds.account_name
    `;

    const { rows } = await smtAdminPool.query(q, params);

    // Group by campaign_name
    const map = {};
    for (const r of rows) {
      const key = r.campaign_name;
      if (!map[key]) {
        map[key] = {
          name: key,
          target_icp: r.target_icp || '',
          channel: r.channel || 'LinkedIn + Email',
          agents: [],
          totals: { cr_sent: 0, cr_accepted: 0, replies: 0, calls: 0, actual_meetings: 0, emails: 0, li_out: 0, campaigns: 0 },
        };
      }
      const cr   = Number(r.cr_sent)        || 0;
      const acc  = Number(r.cr_accepted)    || 0;
      const rep  = Number(r.replies)        || 0;
      const cal  = Number(r.calls)          || 0;
      const act  = Number(r.actual_meetings)|| 0;
      const eml  = Number(r.emails)         || 0;
      const li   = Number(r.li_out)         || 0;
      const camp = Number(r.campaign_rows)  || 0;
      map[key].agents.push({
        agent:           r.account_name,
        account_id:      Number(r.account_id),
        campaign_id:     Number(r.campaign_id),
        activity:        r.activity || '',
        cr_sent:         cr,
        cr_accepted:     acc,
        replies:         rep,
        calls:           cal,
        actual_meetings: act,
        emails:          eml,
        li_out:          li,
        campaigns:       camp,
        accept_pct: cr > 0 ? `${Math.round(acc / cr * 100)}%` : '—',
        reply_pct:  cr > 0 ? `${(rep / cr * 100).toFixed(1)}%` : '—',
      });
      map[key].totals.cr_sent          += cr;
      map[key].totals.cr_accepted      += acc;
      map[key].totals.replies          += rep;
      map[key].totals.calls            += cal;
      map[key].totals.actual_meetings  += act;
      map[key].totals.emails           += eml;
      map[key].totals.li_out           += li;
      map[key].totals.campaigns        += camp;
    }

    const campaigns = Object.values(map).map(c => {
      const t = c.totals;
      return {
        ...c,
        key_metric: t.cr_sent > 0
          ? `${(t.replies / t.cr_sent * 100).toFixed(1)}% reply rate`
          : '0% reply rate',
        reply_pct: t.cr_sent > 0 ? t.replies / t.cr_sent * 100 : 0,
        totals: {
          ...t,
          accept_pct: t.cr_sent > 0 ? `${Math.round(t.cr_accepted / t.cr_sent * 100)}%` : '—',
          reply_pct:  t.cr_sent > 0 ? `${(t.replies / t.cr_sent * 100).toFixed(1)}%`    : '—',
        },
      };
    });

    // Sort: active (reply_pct > 2) first, then low performers; then apply limit
    campaigns.sort((a, b) => b.reply_pct - a.reply_pct);
    const pagedCampaigns = limit > 0 ? campaigns.slice(0, limit) : campaigns;

    res.json({ ok: true, period, campaigns: pagedCampaigns });
  } catch (e) {
    console.error('GET /api/skylead/sandbox error:', e.message);
    res.status(500).json({ ok: false, error: e.message, campaigns: [] });
  }
});

// ── HubSpot Follow-Up Command Center ──
const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN || '';
const SKYLEAD_KEY   = process.env.SKYLEAD_KEY   || 'ad7f28c6-58f1-4312-a133-10e34cc1b4b4';
const HS_BASE = 'https://api.hubapi.com';

async function hsGet(path, params = {}) {
  const qs = Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : '';
  const r = await fetch(`${HS_BASE}${path}${qs}`, {
    headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}` },
  });
  if (!r.ok) throw new Error(`HubSpot ${r.status}: ${await r.text()}`);
  return r.json();
}

async function hsPost(path, body) {
  const r = await fetch(`${HS_BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`HubSpot ${r.status}: ${await r.text()}`);
  return r.json();
}

const HS_STAGE_LABELS = {
  appointmentscheduled:   'Appointment Scheduled',
  qualifiedtobuy:         'Qualified To Buy',
  presentationscheduled:  'Presentation Scheduled',
  decisionmakerboughtin:  'Decision Maker Bought-In',
  contractsent:           'Contract Sent',
  '118109858':            'Scope Solution',
  '118108929':            'Develop Solution',
  '118109859':            'Proposal Sent',
  '118109860':            'SOW Sent',
  '118109861':            'Negotiation/Review',
};

const HS_STAGE_COLORS = {
  appointmentscheduled:   { color: '#06E5EC', bg: 'rgba(6,229,236,.14)' },
  qualifiedtobuy:         { color: '#4D8DFF', bg: 'rgba(77,141,255,.14)' },
  presentationscheduled:  { color: '#F5B945', bg: 'rgba(245,185,69,.14)' },
  decisionmakerboughtin:  { color: '#B79CFF', bg: 'rgba(183,156,255,.14)' },
  contractsent:           { color: '#2DD4BF', bg: 'rgba(45,212,191,.14)' },
  '118109859':            { color: '#4D8DFF', bg: 'rgba(77,141,255,.14)' },
  '118109860':            { color: '#B79CFF', bg: 'rgba(183,156,255,.14)' },
};

function fmtHsDate(s) {
  if (!s) return null;
  try {
    return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return s.slice(0, 10); }
}

app.get('/api/hubspot/followups', async (req, res) => {
  try {
    // Fetch all active deals with associations
    const CLOSED = new Set(['closedwon','closedlost','118108932','118108933']);
    const PROPS  = 'dealname,dealstage,pipeline,closedate,hs_lastmodifieddate,notes_next_activity_date,hubspot_owner_id,amount,description';
    let allDeals = []; let after = null;
    while (true) {
      const params = { limit: 100, properties: PROPS, archived: 'false', associations: 'contacts' };
      if (after) params.after = after;
      const data = await hsGet('/crm/v3/objects/deals', params);
      allDeals.push(...(data.results || []));
      after = data.paging?.next?.after;
      if (!after) break;
    }

    const active = allDeals.filter(d => !CLOSED.has(d.properties?.dealstage));
    active.sort((a, b) => {
      const ta = new Date(a.properties?.hs_lastmodifieddate || 0).getTime();
      const tb = new Date(b.properties?.hs_lastmodifieddate || 0).getTime();
      return tb - ta;
    });

    const P1_STAGES = new Set(['appointmentscheduled','presentationscheduled','decisionmakerboughtin',
      'contractsent','118109858','118108929','118109859','118109860','118109861']);
    const p1 = active.filter(d => P1_STAGES.has(d.properties?.dealstage)).slice(0, 6);
    let p2 = active.filter(d => d.properties?.dealstage === 'qualifiedtobuy'
      && d.properties?.notes_next_activity_date).slice(0, 8);
    if (p2.length < 3) {
      const extra = active.filter(d => d.properties?.dealstage === 'qualifiedtobuy'
        && !p2.includes(d)).slice(0, 8 - p2.length);
      p2 = [...p2, ...extra];
    }

    // Collect contact IDs
    const contactIds = new Set();
    [...p1, ...p2].forEach(d =>
      (d.associations?.contacts?.results || []).forEach(a => contactIds.add(a.id))
    );

    const contacts = {};
    if (contactIds.size > 0) {
      const resp = await hsPost('/crm/v3/objects/contacts/batch/read', {
        inputs: [...contactIds].slice(0, 100).map(id => ({ id })),
        properties: ['firstname','lastname','email','company','jobtitle'],
      });
      (resp.results || []).forEach(c => {
        const p = c.properties;
        contacts[c.id] = {
          name: `${p.firstname || ''} ${p.lastname || ''}`.trim() || p.email || '—',
          company: p.company || '',
          title: p.jobtitle || '',
        };
      });
    }

    const getContact = deal => {
      const assoc = deal.associations?.contacts?.results || [];
      return assoc.length ? contacts[assoc[0].id] || { name: '—', company: '', title: '' } : { name: '—', company: '', title: '' };
    };

    const now = Date.now();
    const daysAgo = ts => Math.round((now - new Date(ts || 0).getTime()) / 86400000);

    const HS_PORTAL = '40970945';
    const dealUrl = id => `https://app.hubspot.com/contacts/${HS_PORTAL}/deal/${id}`;

    const priority1 = p1.map(d => {
      const p = d.properties;
      const c = getContact(d);
      const sc = HS_STAGE_COLORS[p.dealstage] || { color: '#9FB0D8', bg: 'rgba(159,176,216,.14)' };
      const da = daysAgo(p.hs_lastmodifieddate);
      const note = p.description
        ? (p.description.length > 120 ? p.description.slice(0, 117) + '...' : p.description)
        : null;
      return {
        name: c.name, company: p.dealname || '?', contact_company: c.company,
        stage: HS_STAGE_LABELS[p.dealstage] || p.dealstage,
        stageClr: sc.color, stageBg: sc.bg,
        last_modified: fmtHsDate(p.hs_lastmodifieddate),
        note, deal_id: d.id,
        hs_url: dealUrl(d.id),
      };
    });

    const priority2 = p2.map(d => {
      const p = d.properties;
      const c = getContact(d);
      const da = daysAgo(p.hs_lastmodifieddate);
      const note = p.description
        ? (p.description.length > 120 ? p.description.slice(0, 117) + '...' : p.description)
        : `Last updated ${da}d ago — needs follow-up`;
      return {
        name: c.name, company: p.dealname || '?', contact_company: c.company,
        date: fmtHsDate(p.notes_next_activity_date) || `+${da}d overdue`,
        note, deal_id: d.id,
        hs_url: dealUrl(d.id),
      };
    });

    res.json({ ok: true, priority1, priority2, fetched_at: new Date().toISOString() });
  } catch (e) {
    console.error('GET /api/hubspot/followups error:', e.message);
    res.status(500).json({ ok: false, error: e.message, priority1: [], priority2: [] });
  }
});

/** GET /api/skylead/campaign-names — distinct campaign names for combobox, optionally filtered by account_id */
app.get('/api/skylead/campaign-names', async (req, res) => {
  try {
    const { account_id } = req.query;
    const params = account_id ? [account_id] : [];
    const where  = account_id ? 'WHERE account_id = $1' : '';
    const { rows } = await smtAdminPool.query(
      `SELECT DISTINCT campaign_name FROM sales.dashboard_campaigns ${where} ORDER BY campaign_name`,
      params
    );
    res.json({ ok: true, names: rows.map(r => r.campaign_name) });
  } catch (e) {
    console.error('GET /api/skylead/campaign-names error:', e.message);
    res.status(500).json({ ok: false, names: [] });
  }
});

// ── Campaign CRUD (sandbox manual add/edit/delete) — uses sales.dashboard_campaigns ──
// Manually-added rows use a dedicated sequence (sales.manual_campaign_id_seq, starts at 1,000,000,000).

/** POST /api/sales-dashboard/campaigns */
app.post('/api/sales-dashboard/campaigns', async (req, res) => {
  try {
    const { campaign_name, account_id, activity, target_icp, channel,
            connections_requested, connection_requests_accepted, connection_replies, emails_sent, created_at } = req.body;
    if (!campaign_name || !account_id) return res.status(400).json({ error: 'campaign_name and account_id are required' });
    // Use a dedicated sequence starting at 1,000,000,000 — well above any Skylead ID (~400k range)
    const idRes = await smtAdminPool.query(`SELECT nextval('sales.manual_campaign_id_seq') AS next_id`);
    const newId = Number(idRes.rows[0].next_id);
    const result = await smtAdminPool.query(`
      INSERT INTO sales.dashboard_campaigns
        (campaign_id, campaign_name, account_id, activity, target_icp, channel,
         connections_requested, connection_requests_accepted, connection_replies,
         emails_sent, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::date) RETURNING *`,
      [newId, campaign_name, account_id, activity||null,
       target_icp||null, channel||'LinkedIn + Email',
       connections_requested||0, connection_requests_accepted||0, connection_replies||0,
       emails_sent||0, created_at||new Date().toISOString().split('T')[0]]
    );
    res.status(201).json({ ...result.rows[0], ok: true });
  } catch (e) {
    console.error('POST /api/sales-dashboard/campaigns error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

/** PATCH /api/sales-dashboard/campaigns/:id */
app.patch('/api/sales-dashboard/campaigns/:id', async (req, res) => {
  try {
    const { campaign_name, account_id, activity, target_icp, channel,
            connections_requested, connection_requests_accepted,
            connection_replies, emails_sent, created_at } = req.body;
    const result = await smtAdminPool.query(`
      UPDATE sales.dashboard_campaigns SET
        campaign_name                = $1,
        account_id                   = $2,
        activity                     = $3,
        target_icp                   = $4,
        channel                      = $5,
        connections_requested        = $6,
        connection_requests_accepted = $7,
        connection_replies           = $8,
        emails_sent                  = $9,
        created_at                   = $10::date
      WHERE campaign_id = $11 RETURNING *`,
      [campaign_name, account_id, activity||null,
       target_icp||null, channel||'LinkedIn + Email',
       connections_requested||0, connection_requests_accepted||0,
       connection_replies||0, emails_sent||0,
       created_at||new Date().toISOString().split('T')[0], req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Campaign not found' });
    res.json(result.rows[0]);
  } catch (e) {
    console.error('PATCH /api/sales-dashboard/campaigns error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

/** DELETE /api/sales-dashboard/campaigns/:id */
app.delete('/api/sales-dashboard/campaigns/:id', async (req, res) => {
  try {
    await smtAdminPool.query('DELETE FROM sales.dashboard_campaigns WHERE campaign_id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/sales-dashboard/campaigns error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── User Tasks (users.user_tasks in smt_db) ──

/** GET /api/user-tasks — fetch tasks for the logged-in user (resolved by email) */
app.get('/api/user-tasks', async (req, res) => {
  try {
    const { status, limit = 200 } = req.query;
    // Resolve user_id from logged-in email
    const email = req.user?.email || null;
    if (!email) return res.status(401).json({ ok: false, error: 'Not authenticated' });
    const userRow = await smtAdminPool.query(
      `SELECT id FROM users.users WHERE email = $1 LIMIT 1`, [email]
    );
    if (!userRow.rows.length) return res.json({ ok: true, tasks: [], note: 'No user record found for ' + email });
    const userId = userRow.rows[0].id;
    const params = [userId];
    let where = 'WHERE user_id = $1';
    if (status) { params.push(status); where += ` AND status = $${params.length}`; }
    const { rows } = await smtAdminPool.query(
      `SELECT id, description, status, task_type, horizon, accountable_person,
              due_date_suggestion, priority_score, details, created_at
       FROM users.user_tasks ${where}
       ORDER BY
         CASE status WHEN 'pending' THEN 1 WHEN 'captured' THEN 2 WHEN 'done' THEN 3 ELSE 4 END,
         priority_score DESC NULLS LAST, created_at DESC
       LIMIT $${params.length + 1}`,
      [...params, Number(limit)]
    );
    res.json({ ok: true, tasks: rows, user_id: userId });
  } catch (e) {
    console.error('GET /api/user-tasks error:', e.message);
    res.status(500).json({ ok: false, tasks: [] });
  }
});

/** POST /api/user-tasks — create a new task for the logged-in user */
app.post('/api/user-tasks', async (req, res) => {
  try {
    const { description, status='pending', task_type='Next Action', horizon='Ground',
            accountable_person, due_date_suggestion, priority_score, details } = req.body;
    if (!description) return res.status(400).json({ error: 'description is required' });
    const email = req.user?.email || null;
    if (!email) return res.status(401).json({ ok: false, error: 'Not authenticated' });
    const userRow = await smtAdminPool.query(`SELECT id FROM users.users WHERE email = $1 LIMIT 1`, [email]);
    if (!userRow.rows.length) return res.status(404).json({ ok: false, error: 'User not found: ' + email });
    const userId = userRow.rows[0].id;
    const result = await smtAdminPool.query(
      `INSERT INTO users.user_tasks
         (user_id, description, status, task_type, horizon, accountable_person, due_date_suggestion, priority_score, details)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [userId, description, status, task_type, horizon,
       accountable_person||null, due_date_suggestion||null, priority_score||null, details||null]
    );
    res.status(201).json({ ok: true, task: result.rows[0] });
  } catch (e) {
    console.error('POST /api/user-tasks error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

/** PATCH /api/user-tasks/:id — update a task */
app.patch('/api/user-tasks/:id', async (req, res) => {
  try {
    const { description, status, task_type, horizon, accountable_person,
            due_date_suggestion, priority_score, details } = req.body;
    const result = await smtAdminPool.query(
      `UPDATE users.user_tasks SET
         description         = COALESCE($1, description),
         status              = COALESCE($2, status),
         task_type           = COALESCE($3, task_type),
         horizon             = COALESCE($4, horizon),
         accountable_person  = COALESCE($5, accountable_person),
         due_date_suggestion = COALESCE($6, due_date_suggestion),
         priority_score      = COALESCE($7, priority_score),
         details             = COALESCE($8, details)
       WHERE id = $9 RETURNING *`,
      [description||null, status||null, task_type||null, horizon||null,
       accountable_person||null, due_date_suggestion||null,
       priority_score||null, details||null, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Task not found' });
    res.json({ ok: true, task: result.rows[0] });
  } catch (e) {
    console.error('PATCH /api/user-tasks error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

/** DELETE /api/user-tasks/:id — delete a task */
app.delete('/api/user-tasks/:id', async (req, res) => {
  try {
    await smtAdminPool.query('DELETE FROM users.user_tasks WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/user-tasks error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Campaign Briefs (rich brief content stored as jsonb) ──

/** GET /api/campaign-briefs — fetch all user-created campaign briefs (ordered) */
// ── Campaign Briefs — now using dedicated sales.campaign_briefs table ──
// Completely separate from sales.dashboard_campaigns (Skylead performance data)

/** GET /api/campaign-briefs */
app.get('/api/campaign-briefs', async (req, res) => {
  try {
    const { rows } = await smtAdminPool.query(
      `SELECT id, title, subtitle, assignee, account_id, channel, activity,
              color, sort_order, brief_json, created_at
       FROM sales.campaign_briefs
       WHERE is_deleted = false OR is_deleted IS NULL
       ORDER BY sort_order ASC NULLS LAST, id ASC`
    );
    // Normalize shape so frontend receives consistent field names
    const briefs = rows.map(r => ({
      campaign_id:   r.id,
      campaign_name: r.title,
      account_id:    r.account_id,
      activity:      r.activity,
      target_icp:    r.subtitle,
      channel:       r.channel,
      brief_json:    r.brief_json,
      created_at:    r.created_at,
      sort_order:    r.sort_order,
      assignee:      r.assignee,
    }));
    res.json({ ok: true, briefs });
  } catch (e) {
    console.error('GET /api/campaign-briefs error:', e.message);
    res.status(500).json({ ok: false, briefs: [] });
  }
});

/** POST /api/campaign-briefs */
app.post('/api/campaign-briefs', async (req, res) => {
  try {
    const { campaign_name, account_id, activity, target_icp, channel, brief_json, assignee } = req.body;
    if (!campaign_name) return res.status(400).json({ error: 'campaign_name is required' });
    const sortRes = await smtAdminPool.query(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort FROM sales.campaign_briefs WHERE is_deleted = false OR is_deleted IS NULL`
    );
    const sortOrder = Number(sortRes.rows[0].next_sort) || 1;
    const bj = brief_json || {};
    const result = await smtAdminPool.query(
      `INSERT INTO sales.campaign_briefs
         (title, subtitle, assignee, account_id, channel, activity, color, sort_order, brief_json, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,CURRENT_DATE) RETURNING *`,
      [campaign_name, target_icp || bj.sub || null, assignee || bj.sdr || 'Laura',
       account_id || 32891, channel || 'LinkedIn + Email', activity || null,
       bj.color || null, sortOrder,
       brief_json ? JSON.stringify(brief_json) : null]
    );
    const r = result.rows[0];
    res.status(201).json({ ok: true, brief: {
      campaign_id: r.id, campaign_name: r.title, account_id: r.account_id,
      target_icp: r.subtitle, channel: r.channel, activity: r.activity,
      brief_json: r.brief_json, created_at: r.created_at,
      sort_order: r.sort_order, assignee: r.assignee,
    }});
  } catch (e) {
    console.error('POST /api/campaign-briefs error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

/** PATCH /api/campaign-briefs/:id */
app.patch('/api/campaign-briefs/:id', async (req, res) => {
  try {
    const { campaign_name, account_id, activity, target_icp, channel, brief_json, assignee } = req.body;
    const result = await smtAdminPool.query(
      `UPDATE sales.campaign_briefs SET
         title      = COALESCE($1, title),
         account_id = COALESCE($2, account_id),
         activity   = COALESCE($3, activity),
         subtitle   = COALESCE($4, subtitle),
         channel    = COALESCE($5, channel),
         brief_json = COALESCE($6, brief_json),
         assignee   = COALESCE($7, assignee),
         updated_at = NOW()
       WHERE id = $8 RETURNING *`,
      [campaign_name || null, account_id || null, activity || null,
       target_icp || null, channel || null,
       brief_json ? JSON.stringify(brief_json) : null,
       assignee !== undefined ? assignee : null, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Brief not found' });
    const r = result.rows[0];
    res.json({ ok: true, brief: {
      campaign_id: r.id, campaign_name: r.title, account_id: r.account_id,
      target_icp: r.subtitle, channel: r.channel, activity: r.activity,
      brief_json: r.brief_json, created_at: r.created_at,
      sort_order: r.sort_order, assignee: r.assignee,
    }});
  } catch (e) {
    console.error('PATCH /api/campaign-briefs error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

/** POST /api/campaign-briefs/reorder — bulk sort_order update */
app.post('/api/campaign-briefs/reorder', async (req, res) => {
  try {
    const { order } = req.body; // [{id, sort_order}]
    if (!Array.isArray(order)) return res.status(400).json({ error: 'order array required' });
    const client = await smtAdminPool.connect();
    try {
      await client.query('BEGIN');
      for (const item of order) {
        await client.query(
          `UPDATE sales.campaign_briefs SET sort_order = $1, updated_at = NOW() WHERE id = $2`,
          [item.sort_order, item.id]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK'); throw err;
    } finally { client.release(); }
    res.json({ ok: true });
  } catch (e) {
    console.error('POST /api/campaign-briefs/reorder error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

/** DELETE /api/campaign-briefs/:id — soft-delete */
app.delete('/api/campaign-briefs/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    await smtAdminPool.query(
      `UPDATE sales.campaign_briefs SET is_deleted = true, updated_at = NOW() WHERE id = $1`,
      [id]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/campaign-briefs/:id error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Call Records CRUD (proxied from frontend via laura-dashboard API) ──
app.post('/api/sales-dashboard/call-records', async (req, res) => {
  try {
    const { campaign_name, account_id, contact_name, contact_title, contact_company,
            contact_linkedin, call_date, outcome, notes } = req.body;
    const result = await smtAdminPool.query(
      `INSERT INTO sales.dashboard_call_records
         (campaign_name, account_id, contact_name, contact_title, contact_company,
          contact_linkedin, call_date, outcome, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [campaign_name, account_id||null, contact_name, contact_title, contact_company,
       contact_linkedin, call_date||null, outcome||'completed', notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (e) {
    console.error('POST /api/sales-dashboard/call-records error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/sales-dashboard/call-records/:id', async (req, res) => {
  try {
    const { campaign_name, contact_name, contact_title, contact_company,
            contact_linkedin, call_date, outcome, notes } = req.body;
    const result = await smtAdminPool.query(
      `UPDATE sales.dashboard_call_records SET
         campaign_name    = $1,
         contact_name     = $2,
         contact_title    = $3,
         contact_company  = $4,
         contact_linkedin = $5,
         call_date        = $6,
         outcome          = $7,
         notes            = $8
       WHERE id = $9 RETURNING *`,
      [campaign_name, contact_name, contact_title, contact_company,
       contact_linkedin, call_date||null, outcome||'completed', notes, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (e) {
    console.error('PATCH /api/sales-dashboard/call-records error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/sales-dashboard/call-records/:id', async (req, res) => {
  try {
    await smtAdminPool.query('DELETE FROM sales.dashboard_call_records WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/sales-dashboard/call-records error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

/** GET /api/skylead/meetings-breakdown — call records grouped by campaign, scoped to campaigns in the date window */
app.get('/api/skylead/meetings-breakdown', async (req, res) => {
  try {
    const period    = req.query.period    || 'all';
    const startDate = req.query.startDate || null;
    const endDate   = req.query.endDate   || null;

    let campWhere = '';
    let params    = [];
    if (startDate && endDate) {
      params    = [startDate, endDate];
      campWhere = 'AND dc.created_at BETWEEN $1::date AND $2::date';
    } else if (period === 'today') {
      campWhere = 'AND dc.created_at = CURRENT_DATE';
    } else if (period === '7d') {
      campWhere = "AND dc.created_at >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (period === '30d') {
      campWhere = "AND dc.created_at >= CURRENT_DATE - INTERVAL '30 days'";
    }
    // 'all' → no filter — show all call records

    const { rows } = await smtAdminPool.query(`
      SELECT
        cr.campaign_name,
        COUNT(*)                                                        AS booked,
        COUNT(*) FILTER (WHERE LOWER(cr.outcome) = 'completed')         AS completed
      FROM sales.dashboard_call_records cr
      WHERE cr.campaign_name IN (
        SELECT DISTINCT dc.campaign_name
        FROM sales.dashboard_campaigns dc
        JOIN sales.dashboard_skylead_ids ds ON dc.account_id = ds.account_id
        WHERE 1=1 ${campWhere}
      )
      GROUP BY cr.campaign_name
      ORDER BY booked DESC
    `, params);
    const max = rows.length > 0 ? Number(rows[0].booked) : 1;
    const items = rows.map(r => ({
      name:      r.campaign_name,
      booked:    Number(r.booked),
      completed: Number(r.completed),
      pct:       Math.round((Number(r.booked) / max) * 100),
    }));
    res.json({ ok: true, items });
  } catch (e) {
    console.error('GET /api/skylead/meetings-breakdown error:', e.message);
    res.status(500).json({ ok: false, error: e.message, items: [] });
  }
});

/** GET /api/skylead/campaign-leads?campaignId=&accountId=
 *  Returns leads that have replied (have a thread) for a given campaign.
 *  Uses the Skylead open-api to fetch campaign leads filtered to those with a thread/reply. */
app.get('/api/skylead/campaign-leads', async (req, res) => {
  try {
    const { campaignId, accountId } = req.query;
    if (!campaignId || !accountId) return res.status(400).json({ ok: false, error: 'campaignId and accountId are required' });


    const BASE        = 'https://api.multilead.io/api/open-api/v1';
    const USER_ID     = 36116;

    // Fetch all leads for the campaign (paginate if needed — default limit should cover typical campaigns)
    let allLeads = [];
    let page = 1;
    while (true) {
      const url = `${BASE}/users/${USER_ID}/accounts/${accountId}/campaigns/${campaignId}/leads?limit=200&page=${page}`;
      const r = await fetch(url, { headers: { Authorization: SKYLEAD_KEY } });
      if (!r.ok) break;
      const body = await r.json();
      const items = body?.result?.items || [];
      allLeads = allLeads.concat(items);
      if (items.length < 200) break;
      page++;
    }

    // Filter to leads that have replied (have a thread value)
    const repliedLeads = allLeads
      .filter(l => l.thread && Number(l.leadStatusId) === 4)
      .map(l => ({
        id:           l.id,
        fullName:     l.fullName || l.allFieldsData?.fullName || 'Unknown',
        occupation:   l.occupation || l.allFieldsData?.occupation || '',
        company:      l.company   || l.allFieldsData?.currentCompany || '',
        image:        l.image     || l.allFieldsData?.picture || null,
        linkedinUrl:  l.linkedinUrl || l.allFieldsData?.profileUrl || null,
        thread:       l.thread,
        firstMessage: l.firstMessage || null,
        leadStatusId: l.leadStatusId,
        stepChangeTimestamp: l.stepChangeTimestamp || null,
      }))
      .sort((a, b) => (b.stepChangeTimestamp || 0) - (a.stepChangeTimestamp || 0));

    res.json({ ok: true, leads: repliedLeads });
  } catch (e) {
    console.error('GET /api/skylead/campaign-leads error:', e.message);
    res.status(500).json({ ok: false, error: e.message, leads: [] });
  }
});

/** GET /api/skylead/lead-thread?leadId=&campaignId=&accountId=
 *  Returns the conversation thread for a specific lead.
 *  Uses the conversations endpoint + lead data to reconstruct the thread. */
app.get('/api/skylead/lead-thread', async (req, res) => {
  try {
    const { leadId, campaignId, accountId } = req.query;
    if (!leadId || !accountId) return res.status(400).json({ ok: false, error: 'leadId and accountId are required' });


    const BASE        = 'https://api.multilead.io/api/open-api/v1';
    const USER_ID     = 36116;

    // Fetch lead data from the campaign to get firstMessage + thread
    let lead = null;
    if (campaignId) {
      const r = await fetch(
        `${BASE}/users/${USER_ID}/accounts/${accountId}/campaigns/${campaignId}/leads?limit=200`,
        { headers: { Authorization: SKYLEAD_KEY } }
      );
      if (r.ok) {
        const body = await r.json();
        lead = (body?.result?.items || []).find(l => String(l.id) === String(leadId));
      }
    }

    // Fallback: fetch conversations and find the matching lead
    if (!lead) {
      const r = await fetch(
        `${BASE}/users/${USER_ID}/accounts/${accountId}/conversations?limit=200`,
        { headers: { Authorization: SKYLEAD_KEY } }
      );
      if (r.ok) {
        const body = await r.json();
        const conv = (body?.result?.items || []).find(c => String(c.lead?.id) === String(leadId));
        if (conv) {
          lead = { ...conv.lead, firstMessage: null, thread: conv.thread };
        }
      }
    }

    if (!lead) return res.status(404).json({ ok: false, error: 'Lead not found', messages: [] });

    // Build message thread from available data
    // For leadStatusId=4 (replied): firstMessage = prospect reply; outreach = step 1 outreach
    // For leadStatusId=3 (connected): firstMessage = outreach sent
    const messages = [];
    const isReplied = Number(lead.leadStatusId) === 4;

    if (isReplied && campaignId) {
      // Try to get the outreach message text from another lead in the same campaign (statusId=3)
      // so we can show the full sent → reply thread
      try {
        const r2 = await fetch(
          `${BASE}/users/${USER_ID}/accounts/${accountId}/campaigns/${campaignId}/leads?limit=200`,
          { headers: { Authorization: SKYLEAD_KEY } }
        );
        if (r2.ok) {
          const body2 = await r2.json();
          const templateLead = (body2?.result?.items || []).find(
            l => Number(l.leadStatusId) === 3 && l.firstMessage && String(l.id) !== String(leadId)
          );
          if (templateLead?.firstMessage) {
            // Replace the contact name portion with this lead's name (best effort)
            const outreachText = templateLead.firstMessage.replace(
              /^Hi \w+,/,
              `Hi ${(lead.fullName||'').split(' ')[0]},`
            );
            messages.push({
              id:        `sent-${leadId}`,
              sender:    'laura',
              text:      outreachText,
              timestamp: lead.createdAt || null,
            });
          }
        }
      } catch (_) { /* no-op — outreach template is best-effort */ }

      // Prospect reply
      if (lead.firstMessage) {
        messages.push({
          id:        `reply-${leadId}`,
          sender:    'prospect',
          text:      lead.firstMessage,
          timestamp: lead.stepChangeTimestamp
            ? new Date(lead.stepChangeTimestamp).toISOString()
            : null,
        });
      }
    } else if (lead.firstMessage) {
      // Connected but not replied — show outreach sent
      messages.push({
        id:        `sent-${leadId}`,
        sender:    'laura',
        text:      lead.firstMessage,
        timestamp: lead.createdAt || null,
      });
    }

    res.json({
      ok: true,
      leadId,
      fullName:    lead.fullName     || 'Unknown',
      company:     lead.company      || lead.allFieldsData?.currentCompany || '',
      image:       lead.image        || lead.allFieldsData?.picture        || null,
      linkedinUrl: lead.linkedinUrl  || lead.allFieldsData?.profileUrl     || null,
      thread:      lead.thread       || null,
      messages,
    });
  } catch (e) {
    console.error('GET /api/skylead/lead-thread error:', e.message);
    res.status(500).json({ ok: false, error: e.message, messages: [] });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Laura Dashboard API listening on 127.0.0.1:${PORT}`);
  console.log(`Anthropic key configured: ${ANTHROPIC_ADMIN_API_KEY ? 'yes' : 'NO'}`);
  console.log(`Laura/Darren API key ID: ${ANTHROPIC_AGENT_API_KEY_ID || '(not set — org-wide)'}`);
  console.log(`Workspace ID: ${ANTHROPIC_WORKSPACE_ID || '(not set — org-wide)'}`);
  const log = loadCostLog();
  console.log(`Task cost log: ${log.tasks.length} entries loaded`);
});

// ── Google Sheets Proxy (authenticated via GOG) ──────────────────────────────
// Fetches sheet data server-side so Ed's real sheet doesn't need to be public
import { execSync } from 'child_process';

const LIVE_SHEET_ID   = '1WEIHITpnk_Ymrk6RTaKYzMK55vLnSViU4RKg5Py34WU';
const DARREN_SHEET_ID = '1sP5lIYoCNFFU0xhh7SwWpTH_6L_EDO-ergHThYm4uGA';
const ZARA_MZ_SHEET_ID    = '1tXwJyHdrfHGqZR33NS6rBiFN0RBVU_25hefJDU0DcZo';
const CAMILLA_BB_SHEET_ID = '1dqHZ2iRqBbmE4Zi3jO83xWuLgkhLT6FweoDWU_Y-pAo';
const GOG_PATH    = '/usr/local/bin/gog';
const GOG_ACCOUNT = 'lpetersen@boldbusiness.com';

/** Read a Darren sheet tab and return rows as header-keyed objects */
async function readDarrenSheet(tab, range) {
  return new Promise((resolve) => {
    const cmd = `${GOG_PATH} sheets get "${DARREN_SHEET_ID}" "${tab}!${range}" --account ${GOG_ACCOUNT} --json`;
    exec(cmd, { timeout: 15000 }, (err, stdout) => {
      if (err) return resolve([]);
      try {
        const d = JSON.parse(stdout);
        const rows = d.values || [];
        if (rows.length < 2) return resolve([]);
        const headers = rows[0];
        resolve(rows.slice(1).map(r => {
          const obj = {};
          headers.forEach((h, i) => { obj[h] = r[i] || ''; });
          return obj;
        }));
      } catch { resolve([]); }
    });
  });
}

// Cache sheet data for 60 seconds to avoid hammering the API
const sheetCache = {};
const CACHE_TTL = 60_000;

app.get('/api/sheets/:sheetName', (req, res) => {
  const sheetName = req.params.sheetName;
  const now = Date.now();
  
  // Check cache
  if (sheetCache[sheetName] && (now - sheetCache[sheetName].ts) < CACHE_TTL) {
    return res.json(sheetCache[sheetName].data);
  }
  
  try {
    // Fetch via GOG — get a generous range
    const range = `${sheetName}!A1:AZ500`;
    const raw = execSync(
      `${GOG_PATH} sheets get ${LIVE_SHEET_ID} "${range}" --account ${GOG_ACCOUNT} --json`,
      { encoding: 'utf8', timeout: 30000, env: process.env }
    );
    const parsed = JSON.parse(raw);
    
    // Cache it
    sheetCache[sheetName] = { ts: now, data: parsed };
    res.json(parsed);
  } catch (e) {
    console.error(`Sheet fetch error [${sheetName}]:`, e.message?.substring(0, 200));
    res.status(500).json({ error: `Failed to fetch sheet: ${sheetName}` });
  }
});

// ── GET /api/qa/reconcile — QA: Compare Anthropic token costs vs logged tasks ──
// Token costs are the source of truth. Every dollar spent should map to a task or be classified.
app.get('/api/qa/reconcile', async (req, res) => {
  try {
    // 1. Get Anthropic API cost (source of truth)
    const costResp = await fetch(`http://127.0.0.1:${PORT}/api/cost/today`, {
      headers: { 'Authorization': req.headers.authorization || '' }
    });
    const costData = await costResp.json();
    const apiCost = costData?.actualCostUsd || 0;

    // 2. Get today's activities
    const actResp = await fetch(`http://127.0.0.1:${PORT}/api/activities?today=1`, {
      headers: { 'Authorization': req.headers.authorization || '' }
    });
    const actData = await actResp.json();
    const allActs = [...(actData?.activities || []), ...(actData?.systemActivities || [])];

    // 3. Classify activities into 3 categories
    const classified = { routine: [], user: [], developer: [] };
    let totalLoggedCost = 0;
    for (const a of allActs) {
      const cost = a.costUsd || 0;
      totalLoggedCost += cost;
      const rb = (a.requestedBy || '').toLowerCase();
      const typ = (a.type || '').toLowerCase();
      const cat = (a.category || '').toLowerCase();

      if (typ === 'system' || typ === 'routine' || cat === 'routine') {
        classified.routine.push(a);
      } else if (rb === 'ron' || rb === 'jewel' || cat === 'developer') {
        classified.developer.push(a);
      } else {
        classified.user.push(a);
      }
    }

    // 4. Get Master Sheet completed-today count
    const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    let sheetCompletedToday = 0;
    try {
      const raw = execSync(
        `${GOG_PATH} sheets get ${LIVE_SHEET_ID} "Master!I2:I500" --account ${GOG_ACCOUNT} --plain`,
        { encoding: 'utf8', timeout: 15000, env: process.env }
      );
      sheetCompletedToday = raw.split('\n').filter(line => line.trim() === todayET).length;
    } catch (e) {
      console.error('QA: Failed to read Master Sheet:', e.message?.substring(0, 100));
    }

    // 5. Calculate gaps
    const gap = Math.round((apiCost - totalLoggedCost) * 100) / 100;
    const activityCount = allActs.length;
    const userActsWithoutTaskId = classified.user.filter(a => !a.taskId).length;

    // 6. Build QA flags
    const flags = [];
    if (gap > 0.50) {
      flags.push({ level: 'warning', msg: `$${gap.toFixed(2)} in token costs not attributed to any activity`, action: 'Investigate: tokens were consumed but no activity was logged' });
    }
    if (sheetCompletedToday === 0 && classified.user.length > 0) {
      flags.push({ level: 'critical', msg: `${classified.user.length} user activities logged but 0 tasks completed on Master Sheet`, action: 'Add completed tasks to Master Sheet immediately' });
    } else if (sheetCompletedToday < classified.user.length * 0.3) {
      flags.push({ level: 'warning', msg: `Only ${sheetCompletedToday} tasks on Master Sheet vs ${classified.user.length} user activities`, action: 'Review: some user activities may need Master Sheet entries' });
    }
    if (userActsWithoutTaskId > 3) {
      flags.push({ level: 'info', msg: `${userActsWithoutTaskId} user activities have no taskId link`, action: 'Consider linking activities to Master Sheet task IDs for traceability' });
    }

    const status = flags.some(f => f.level === 'critical') ? 'FAIL' :
                   flags.some(f => f.level === 'warning') ? 'WARNING' : 'PASS';

    res.json({
      status,
      date: todayET,
      anthropicApiCost: Math.round(apiCost * 100) / 100,
      activitiesLoggedCost: Math.round(totalLoggedCost * 100) / 100,
      unattributedGap: gap,
      activityCount,
      masterSheetCompletedToday: sheetCompletedToday,
      categories: {
        routine: { count: classified.routine.length, cost: Math.round(classified.routine.reduce((s, a) => s + (a.costUsd || 0), 0) * 100) / 100 },
        user: { count: classified.user.length, cost: Math.round(classified.user.reduce((s, a) => s + (a.costUsd || 0), 0) * 100) / 100 },
        developer: { count: classified.developer.length, cost: Math.round(classified.developer.reduce((s, a) => s + (a.costUsd || 0), 0) * 100) / 100 },
      },
      flags,
    });
  } catch (e) {
    console.error('QA reconcile error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Batch endpoint — fetch multiple sheets at once
app.get('/api/sheets', (req, res) => {
  const names = (req.query.sheets || '').split(',').filter(Boolean);
  if (names.length === 0) {
    return res.status(400).json({ error: 'Provide ?sheets=Master,DECISIONS,...' });
  }
  
  const results = {};
  const now = Date.now();
  
  for (const sheetName of names) {
    if (sheetCache[sheetName] && (now - sheetCache[sheetName].ts) < CACHE_TTL) {
      results[sheetName] = sheetCache[sheetName].data;
      continue;
    }
    
    try {
      const range = `${sheetName}!A1:AZ500`;
      const raw = execSync(
        `${GOG_PATH} sheets get ${LIVE_SHEET_ID} "${range}" --account ${GOG_ACCOUNT} --json`,
        { encoding: 'utf8', timeout: 30000, env: process.env }
      );
      const parsed = JSON.parse(raw);
      sheetCache[sheetName] = { ts: now, data: parsed };
      results[sheetName] = parsed;
    } catch (e) {
      console.error(`Sheet fetch error [${sheetName}]:`, e.message?.substring(0, 200));
      results[sheetName] = { error: `Failed to fetch: ${sheetName}` };
    }
  }
  
  res.json(results);
});

// ── GET /api/cost/history — time series (cost + task counts per day) ──
// Cache is keyed per-days so different range selections don't collide.
const historyCacheMap = {};  // { days → { data, at } }
const HISTORY_CACHE_TTL = 5 * 60 * 1000; // 5 min

app.get('/api/cost/history', async (req, res) => {
  const now  = Date.now();
  const days = Math.min(parseInt(req.query.days) || 14, 90);
  const cached = historyCacheMap[days];
  if (cached && (now - cached.at) < HISTORY_CACHE_TTL) {
    return res.json(cached.data);
  }

  // ── 1. Pull daily cost from Anthropic Admin API ──
  const dailyCost = {}; // date → { total, byModel }
  if (ANTHROPIC_ADMIN_API_KEY) {
    try {
      // Fetch in two 7-day windows to get up to 14 days
      const windows = [];
      const endDate = new Date();
      endDate.setUTCHours(23, 59, 59, 999);
      for (let w = 0; w < Math.ceil(days / 7); w++) {
        const wEnd = new Date(endDate);
        wEnd.setUTCDate(wEnd.getUTCDate() - w * 7);
        const wStart = new Date(wEnd);
        wStart.setUTCDate(wStart.getUTCDate() - 7);
        windows.push({ start: wStart.toISOString(), end: wEnd.toISOString() });
      }

      for (const win of windows) {
        let url = `${ANTHROPIC_BASE}/v1/organizations/usage_report/messages?starting_at=${encodeURIComponent(win.start)}&ending_at=${encodeURIComponent(win.end)}&bucket_width=1d&group_by[]=model`;
        if (ANTHROPIC_AGENT_API_KEY_ID) url += `&api_key_ids[]=${encodeURIComponent(ANTHROPIC_AGENT_API_KEY_ID)}`;
        if (ANTHROPIC_WORKSPACE_ID) url += `&workspace_ids[]=${encodeURIComponent(ANTHROPIC_WORKSPACE_ID)}`;
        const r = await fetch(url, { headers: { 'anthropic-version': '2023-06-01', 'x-api-key': ANTHROPIC_ADMIN_API_KEY } });
        if (!r.ok) continue;
        const body = await r.json();
        for (const bucket of (body.data || [])) {
          const date = bucket.starting_at?.substring(0, 10);
          if (!date) continue;
          let dayCost = 0;
          if (!dailyCost[date]) dailyCost[date] = { total: 0, byModel: {} };
          for (const item of (bucket.results || [])) {
            const cc = item.cache_creation || {};
            const cacheCreate = (cc.ephemeral_1h_input_tokens || 0) + (cc.ephemeral_5m_input_tokens || 0);
            const mc = estimateCostFromTokens(item.model, item.uncached_input_tokens || 0, item.output_tokens || 0, item.cache_read_input_tokens || 0, cacheCreate);
            dayCost += mc;
            dailyCost[date].byModel[item.model] = Math.round(((dailyCost[date].byModel[item.model] || 0) + mc) * 10000) / 10000;
          }
          dailyCost[date].total = Math.round((dailyCost[date].total + dayCost) * 10000) / 10000;
        }
      }
    } catch (e) {
      console.error('History Anthropic fetch error:', e.message);
    }
  }

  // ── 2. Pull task counts + category splits from activities.json ──
  const _actsRaw = loadActivities();
  const acts = Array.isArray(_actsRaw) ? _actsRaw : (_actsRaw.activities || []);
  const tasksByDay = {}; // date → { total, user, routine, developer, costUser, costRoutine, costDev }
  for (const a of acts) {
    const ts = a.timestamp || a.createdAt || '';
    if (!ts) continue;
    const date = ts.substring(0, 10);
    if (!tasksByDay[date]) tasksByDay[date] = { total: 0, user: 0, routine: 0, developer: 0, costUser: 0, costRoutine: 0, costDev: 0 };
    const cat = (a.category || a.type || '').toLowerCase();
    const cost = estimateCostFromTokens(a.model, a.inputTokens || 0, a.outputTokens || 0, a.cacheReadTokens || 0, a.cacheWriteTokens || 0);
    tasksByDay[date].total++;
    if (cat.includes('user') || (a.requestedBy || '').toLowerCase() === 'ed') {
      tasksByDay[date].user++;
      tasksByDay[date].costUser += cost;
    } else if (cat.includes('routine') || cat.includes('system') || cat.includes('background') || cat.includes('cron')) {
      tasksByDay[date].routine++;
      tasksByDay[date].costRoutine += cost;
    } else if (cat.includes('developer')) {
      tasksByDay[date].developer++;
      tasksByDay[date].costDev += cost;
    }
  }

  // ── 2b. Load saved cost snapshots as fallback for days Anthropic API doesn't cover ──
  const snapshotsByDate = {};
  try {
    const snapRows = await pgPool.query(`SELECT snapshot_date::text, total_cost_usd, user_cost_usd, routine_cost_usd, developer_cost_usd FROM cost_snapshots WHERE snapshot_date >= NOW() - ($1 || ' days')::INTERVAL`, [days]);
    for (const row of snapRows.rows) {
      const d = row.snapshot_date.substring(0, 10);
      snapshotsByDate[d] = {
        total: Number(row.total_cost_usd) || 0,
        user: Number(row.user_cost_usd) || 0,
        routine: Number(row.routine_cost_usd) || 0,
        dev: Number(row.developer_cost_usd) || 0,
      };
    }
  } catch (e) { /* snapshots unavailable — continue without */ }

  // ── 3. Build unified time series (last N days) ──
  const series = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const date = d.toISOString().substring(0, 10);
    // Prefer live Anthropic API data, fall back to saved snapshots
    const apiCost = dailyCost[date]?.total || snapshotsByDate[date]?.total || 0;
    const td = tasksByDay[date] || { total: 0, user: 0, routine: 0, developer: 0, costUser: 0, costRoutine: 0, costDev: 0 };

    // Use API cost as total (source of truth); split proportionally if we have activity data
    const actTotal = td.costUser + td.costRoutine + td.costDev;
    const scale = actTotal > 0 && apiCost > 0 ? apiCost / actTotal : 1;
    series.push({
      date,
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' }),
      costTotal: apiCost,
      byModel: dailyCost[date]?.byModel || {},
      costUser: Math.round(td.costUser * scale * 100) / 100,
      costRoutine: Math.round(td.costRoutine * scale * 100) / 100,
      costDev: Math.round(td.costDev * scale * 100) / 100,
      tasks: td.total,
      tasksUser: td.user,
      tasksRoutine: td.routine,
      tasksDev: td.developer,
      hasData: apiCost > 0 || td.total > 0,
    });
  }

  const result = { series, generatedAt: new Date().toISOString(), days };
  historyCacheMap[days] = { data: result, at: now };

  // ── Save daily cost snapshots to Postgres (upsert each day with data) ──
  // This builds durable historical data so we don't depend on Anthropic API availability
  (async () => {
    for (const day of series) {
      if (!day.hasData || day.costTotal <= 0) continue;
      const td = tasksByDay[day.date] || {};
      // 1. Legacy local pgPool (non-fatal)
      try {
        await pgPool.query(`
          INSERT INTO cost_snapshots (snapshot_date, total_cost_usd, user_cost_usd, routine_cost_usd, developer_cost_usd, total_tokens, by_model, source)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (snapshot_date) DO UPDATE SET
            total_cost_usd = EXCLUDED.total_cost_usd,
            user_cost_usd = EXCLUDED.user_cost_usd,
            routine_cost_usd = EXCLUDED.routine_cost_usd,
            developer_cost_usd = EXCLUDED.developer_cost_usd,
            total_tokens = EXCLUDED.total_tokens,
            source = EXCLUDED.source
        `, [day.date, day.costTotal, day.costUser, day.costRoutine, day.costDev,
            td.total||0, JSON.stringify(dailyCost[day.date]||{}), 'anthropic-api']);
      } catch (_) {}
      // 2. bb_agents shared RDS — always write
      await bbUpsertCostSnapshot(day.date, day.costTotal, day.byModel || {}, td.total || 0);
    }
  })();

  res.json(result);
});

// ════════════════════════════════════════════════════════════════════════════
// MESSAGES API — automatic capture from laura-tracker plugin
// ════════════════════════════════════════════════════════════════════════════

// ── POST /api/messages — called by laura-tracker plugin (no auth required) ───
app.post('/api/messages', async (req, res) => {
  try {
    const {
      direction, session_key, inbound_message_id, user_name, channel,
      content, model, input_tokens, output_tokens, cache_read_tokens,
      cache_write_tokens, timestamp,
    } = req.body;

    if (!direction || !['inbound', 'outbound', 'delivery'].includes(direction)) {
      return res.status(400).json({ error: 'direction must be "inbound", "outbound", or "delivery"' });
    }

    const id = crypto.randomUUID();
    const inTok  = Number(input_tokens)        || 0;
    const outTok = Number(output_tokens)       || 0;
    const crTok  = Number(cache_read_tokens)   || 0;
    const cwTok  = Number(cache_write_tokens)  || 0;
    const totalTok = inTok + outTok + crTok + cwTok;
    const costUsd  = direction === 'outbound'
      ? estimateCostFromTokens(model || '', inTok, outTok, crTok, cwTok)
      : 0;

    await pgPool.query(`
      INSERT INTO messages (
        id, direction, session_key, inbound_message_id, user_name, channel,
        content, model, input_tokens, output_tokens, cache_read_tokens,
        cache_write_tokens, total_tokens, cost_usd, timestamp
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
    `, [
      id, direction, session_key || null, inbound_message_id || null,
      user_name || null, channel || null,
      content   || null, model   || null,
      inTok, outTok, crTok, cwTok, totalTok,
      costUsd,
      timestamp ? new Date(timestamp) : new Date(),
    ]);

    res.json({ ok: true, id });
  } catch (e) {
    console.error('POST /api/messages error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/messages — query message history ────────────────────────────────
app.get('/api/messages', async (req, res) => {
  try {
    const days      = Math.min(Number(req.query.days) || 7, 90);
    const direction = req.query.direction || 'all';
    const limit     = Math.min(Number(req.query.limit) || 200, 500);
    const sessionKey = req.query.session_key || null;

    const since = new Date(Date.now() - days * 86400000).toISOString();
    const params = [since, limit];
    let where = 'WHERE timestamp >= $1';

    if (direction !== 'all') {
      params.splice(1, 0, direction);
      where += ` AND direction = $2`;
      params.push(limit);
      params[params.length - 1] = limit; // re-set limit at end
    }
    if (sessionKey) {
      params.splice(params.length - 1, 0, sessionKey);
      where += ` AND session_key = $${params.length - 1}`;
    }

    // Clean rebuild to avoid param index confusion
    const qParams = [since];
    let qWhere = 'WHERE m.timestamp >= $1';
    let pi = 2;
    if (direction !== 'all') { qWhere += ` AND m.direction = $${pi}`; qParams.push(direction); pi++; }
    if (sessionKey)          { qWhere += ` AND m.session_key = $${pi}`; qParams.push(sessionKey); pi++; }
    qParams.push(limit);

    const rows = await pgPool.query(`
      SELECT m.*
      FROM messages m
      ${qWhere}
      ORDER BY m.timestamp DESC
      LIMIT $${pi}
    `, qParams);

    // Summary stats
    const stats = await pgPool.query(`
      SELECT
        COUNT(*)                                          AS total,
        COUNT(*) FILTER (WHERE direction='inbound')       AS inbound,
        COUNT(*) FILTER (WHERE direction='outbound')      AS outbound,
        COALESCE(SUM(cost_usd), 0)                        AS total_cost,
        COALESCE(SUM(total_tokens), 0)                    AS total_tokens,
        COUNT(DISTINCT session_key)                       AS sessions
      FROM messages
      WHERE timestamp >= $1
    `, [since]);

    const s = stats.rows[0];
    res.json({
      messages: rows.rows,
      summary: {
        total:       Number(s.total),
        inbound:     Number(s.inbound),
        outbound:    Number(s.outbound),
        totalCost:   Number(s.total_cost),
        totalTokens: Number(s.total_tokens),
        sessions:    Number(s.sessions),
      },
    });
  } catch (e) {
    console.error('GET /api/messages error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// MONTHLY SCOREBOARD — reads Task List sheet (separate spreadsheet)
// ════════════════════════════════════════════════════════════════════════════
const TASK_LIST_SHEET_ID = '1WEIHITpnk_Ymrk6RTaKYzMK55vLnSViU4RKg5Py34WU';

app.get('/api/scoreboard', (req, res) => {
  try {
    // Read full Task List: scoreboard (A5:C10) + task list (A26:H200)
    const raw = execSync(
      `${GOG_PATH} sheets get ${TASK_LIST_SHEET_ID} "Task List!A1:H200" --account ${GOG_ACCOUNT} --json`,
      { encoding: 'utf8', timeout: 20000, env: process.env }
    );
    const allRows = JSON.parse(raw).values || [];

    // ── Helpers ────────────────────────────────────────────────────────────────
    const parseNum    = (v) => { const n = parseInt((v||'0').replace(/[^\d]/g,'')); return isNaN(n) ? 0 : n; };
    const parseCost   = (v) => {
      if (!v || v === '—' || v.toLowerCase().includes('ongoing')) return null;
      const m = String(v).match(/[\d,]+\.?\d*/);
      return m ? parseFloat(m[0].replace(/,/g,'')) : null;
    };
    const stripEmoji  = (v) => (v||'').replace(/[\u{1F300}-\u{1FFFF}\u{2600}-\u{27FF}\u{FE00}-\u{FEFF}\u{1F000}-\u{1F9FF}]|[⚠️✅❌⛔🔴🟡🟢⏸📞🔥⏳🎯📊📋]/gu,'').trim();
    const priorityMap = { '🔴': 'High', '🟡': 'Medium', '🟢': 'Low', '⏸': 'Paused' };
    const statusMap   = { '✅': 'Done', '⏳': 'Upcoming', '🔄': 'Running', '⛔': 'Blocked', '⚠️': 'Warning', '🔥': 'Hot' };
    const getPriority = (v) => { for (const [e,t] of Object.entries(priorityMap)) if ((v||'').includes(e)) return t; return stripEmoji(v) || 'Normal'; };
    const getStatus   = (v) => {
      const lower = (v||'').toLowerCase();
      // Campaign status: check text keywords first (more reliable than emoji for multi-part strings)
      if (lower.includes('active'))  return 'Active';
      if (lower.includes('paused'))  return 'Paused';
      if (lower.includes('monitor')) return 'Paused';
      // Task status: emoji-based
      for (const [e,t] of Object.entries(statusMap)) if ((v||'').includes(e)) return t;
      return stripEmoji(v) || 'Unknown';
    };
    const isSubHeader = (row) => {
      // Sub-headers: row[0] is empty OR non-numeric, and row[1] starts with '—'
      const num = (row[0]||'').trim();
      const task = (row[1]||'').trim();
      return (!num || num === '#') && task.startsWith('—');
    };

    // ── Scoreboard section (rows 5–10) ────────────────────────────────────────
    const sbRows = allRows.slice(4, 10);
    const findRow = (label) => sbRows.find(r => (r[0]||'').toLowerCase().includes(label.toLowerCase())) || [];
    const calls    = findRow('calls scheduled');
    const touches  = findRow('total touches');
    const replies  = findRow('replies received');
    const newLeads = findRow('new leads');

    const scoreboard = {
      callsScheduled:  parseNum(calls[2]),   callsTarget:   parseNum(calls[1])   || 8,
      totalTouches:    parseNum(touches[2]),  touchesTarget: parseNum(touches[1]) || 400,
      repliesReceived: parseNum(replies[2]),  repliesTarget: parseNum(replies[1]) || 15,
      newLeadsAdded:   parseNum(newLeads[2]), newLeadsTarget:parseNum(newLeads[1])|| 80,
    };

    // ── Active campaigns section (rows 12–17) ─────────────────────────────────
    const campRows = allRows.slice(11, 17).filter(r => r[0] && r[0] !== 'Campaign');
    const campaigns = campRows.map(r => {
      // Some campaign rows (e.g. CET) overflow into cols 3-6 with text status notes.
      // Only treat cols 3/4/5 as numeric if they look like numbers or '—'
      const isNumericCol = (v) => !v || v === '—' || /^\d+$/.test((v||'').trim());
      const col3 = r[3]||'', col4 = r[4]||'', col5 = r[5]||'';
      return {
        name:        r[0] || '',
        tag:         r[1] || '',
        status:      (r[2]||'').substring(0, 200),
        statusClean: getStatus(r[2]||''),
        touches:     isNumericCol(col3) ? (parseNum(col3) || null) : null,
        replies:     isNumericCol(col4) ? (parseNum(col4) || null) : null,
        calls:       isNumericCol(col5) ? (parseNum(col5) || null) : null,
      };
    });

    // ── Task list (row 26 onwards) ────────────────────────────────────────────
    const taskRows = allRows.slice(25); // row 26 in sheet = index 25
    let currentWeek = '';
    const tasks = [];

    for (const row of taskRows) {
      if (isSubHeader(row)) {
        // Extract week label: "— WEEK 1: Apr 1–7 | Foundation —" → "Week 1: Apr 1–7"
        currentWeek = (row[1]||'').replace(/^—\s*|\s*—$/g,'').trim();
        continue;
      }
      const num = (row[0]||'').trim();
      if (!num || num === '#' || !row[1]) continue; // skip header/empty rows

      tasks.push({
        num:      parseInt(num) || null,
        task:     row[1] || '',
        campaign: row[2] || '',
        week:     row[3] || currentWeek,
        priority: getPriority(row[4]||''),
        status:   getStatus(row[5]||''),
        statusFull: row[5] || '',          // full rich text for tooltip/drill-down
        approval: (row[6]||'').trim(),
        costRaw:  row[7] || null,          // original string e.g. "~$53.43 (est.)"
        costUsd:  parseCost(row[7]||''),   // parsed number or null
        weekGroup: currentWeek,
      });
    }

    // ── Summary stats from task list ──────────────────────────────────────────
    const taskStats = {
      total:    tasks.length,
      done:     tasks.filter(t => t.status === 'Done').length,
      upcoming: tasks.filter(t => t.status === 'Upcoming').length,
      running:  tasks.filter(t => t.status === 'Running').length,
      // These are rough estimates entered manually in the Task Plan sheet by Abhinanda
      // NOT real Anthropic API costs — do not compare to /api/cost/today
      taskPlanEstimateUsd: tasks.reduce((s, t) => s + (t.costUsd || 0), 0).toFixed(2),
      taskPlanEstimateLabel: 'Sheet estimate (manual, not API cost)',
      byWeek: Object.fromEntries(
        [...new Set(tasks.map(t => t.weekGroup).filter(Boolean))].map(w => [
          w,
          { total: tasks.filter(t=>t.weekGroup===w).length,
            done:  tasks.filter(t=>t.weekGroup===w && t.status==='Done').length }
        ])
      ),
    };

    res.json({ ok: true, scoreboard, campaigns, tasks, taskStats });
  } catch (e) {
    console.error('GET /api/scoreboard error:', e.message?.slice(0, 200));
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// TASKS API
// ════════════════════════════════════════════════════════════════════════════

// ── POST /api/tracker-tasks — create a task ──────────────────────────────────
app.post('/api/tracker-tasks', async (req, res) => {
  try {
    const { title, description, created_by, task_id_ref } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const id = 'TASK-' + Date.now();
    await pgPool.query(`
      INSERT INTO tasks (id, title, description, created_by, status, task_id_ref)
      VALUES ($1, $2, $3, $4, 'open', $5)
    `, [id, title, description || null, created_by || 'System', task_id_ref || null]);

    res.json({ ok: true, id });
  } catch (e) {
    console.error('POST /api/tracker-tasks error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/tracker-tasks — list tasks ─────────────────────────────────────
app.get('/api/tracker-tasks', async (req, res) => {
  try {
    const status = req.query.status || null;
    const params = [];
    let where = '';
    if (status && status !== 'all') {
      where = 'WHERE status = $1';
      params.push(status);
    }
    const rows = await pgPool.query(
      `SELECT * FROM tasks ${where} ORDER BY created_at DESC LIMIT 200`,
      params
    );
    res.json({ tasks: rows.rows });
  } catch (e) {
    console.error('GET /api/tracker-tasks error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── PATCH /api/tracker-tasks/:id — update a task ────────────────────────────
app.patch('/api/tracker-tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, status, task_id_ref } = req.body;

    const completedAt = status === 'done' ? new Date() : null;

    await pgPool.query(`
      UPDATE tasks SET
        title        = COALESCE($2, title),
        description  = COALESCE($3, description),
        status       = COALESCE($4, status),
        task_id_ref  = COALESCE($5, task_id_ref),
        updated_at   = NOW(),
        completed_at = CASE WHEN $4 = 'done' THEN NOW() ELSE completed_at END
      WHERE id = $1
    `, [id, title || null, description || null, status || null, task_id_ref || null]);

    res.json({ ok: true });
  } catch (e) {
    console.error('PATCH /api/tracker-tasks error:', e.message);
    res.status(500).json({ error: e.message });
  }
});
/** GET /api/darren/dwdm-outreach — DWDM Outreach Plan sequence cards */
app.get('/api/darren/dwdm-outreach', async (req, res) => {
  try {
    // readDarrenSheet uses row A2 as headers → returns array of objects keyed by column name
    const rows = await readDarrenSheet('DWDM Outreach Plan', 'A2:H50');
    const data = rows.filter(r => r['Touch #']).map(r => ({
      touch:   r['Touch #']               || '',
      day:     r['Day']                   || '',
      channel: r['Channel']               || '',
      persona: r['Persona']               || '',
      subject: r['Subject / Hook']        || '',
      message: r['Message (copy)']        || '',
      tokens:  r['Personalization tokens']|| '',
      notes:   r['Notes']                 || '',
    }));
    res.json({ ok: true, touches: data });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});


/** GET /api/darren/dwdm-taskplan — DWDM Task Plan (A1 headers, A2+ data) */
app.get('/api/darren/dwdm-taskplan', async (req, res) => {
  try {
    const rows = await readDarrenSheet('DWDM Task plan', 'A1:J500');
    res.json({ ok: true, taskPlan: rows, total: rows.length });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});


/** GET /api/darren/dwdm-dashboard — DWDM KPI metrics from dashboard tab */
app.get('/api/darren/dwdm-dashboard', async (req, res) => {
  try {
    const cmd = `${GOG_PATH} sheets get "${DARREN_SHEET_ID}" "DWDM Dashboard!A1:C20" --account ${GOG_ACCOUNT} --json`;
    const rows = await new Promise((resolve) => {
      exec(cmd, { timeout: 15000 }, (err, stdout) => {
        if (err) return resolve([]);
        try { const d = JSON.parse(stdout); resolve(d.values || []); } catch { resolve([]); }
      });
    });
    const kpis = {};
    let lastUpdated = '';
    for (const r of rows) {
      if (!r[0]) continue;
      if (r[0] === 'Last updated (UTC)') { lastUpdated = r[1] || ''; continue; }
      if (r[1]) kpis[r[0]] = r[1];
    }
    res.json({ ok: true, kpis, lastUpdated });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

/** GET /api/darren/dc-executive-summary — DC Executive Summary narrative */
app.get('/api/darren/dc-executive-summary', async (req, res) => {
  try {
    const cmd = `${GOG_PATH} sheets get "${DARREN_SHEET_ID}" "DC - Executive Summary!A1:B200" --account ${GOG_ACCOUNT} --json`;
    const rows = await new Promise((resolve) => {
      exec(cmd, { timeout: 15000 }, (err, stdout) => {
        if (err) return resolve([]);
        try { const d = JSON.parse(stdout); resolve(d.values || []); } catch { resolve([]); }
      });
    });
    const lines = rows.map(r => ({ text: r[0] || '', value: r[1] || '' })).filter(l => l.text || l.value);
    res.json({ ok: true, lines, total: lines.length });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});


/** GET /api/analytics — Comprehensive cost + usage analytics
 * Query params: agent (laura|darren|all), from (YYYY-MM-DD), to (YYYY-MM-DD), preset (today|7d|30d|month)
 */
app.get('/api/analytics', async (req, res) => {
  try {
    const { agent = 'all', preset = 'today', from: qFrom, to: qTo } = req.query;

    // Resolve date range
    const now = new Date();
    const todayStr = now.toISOString().slice(0,10);
    let dateFrom, dateTo;
    switch (preset) {
      case 'yesterday': {
        const d = new Date(now); d.setUTCDate(d.getUTCDate()-1);
        dateFrom = dateTo = d.toISOString().slice(0,10); break;
      }
      case '7d': {
        const d = new Date(now); d.setUTCDate(d.getUTCDate()-7);
        dateFrom = d.toISOString().slice(0,10); dateTo = todayStr; break;
      }
      case '30d': {
        const d = new Date(now); d.setUTCDate(d.getUTCDate()-30);
        dateFrom = d.toISOString().slice(0,10); dateTo = todayStr; break;
      }
      case 'month': {
        const d = new Date(now.getFullYear(), now.getMonth(), 1);
        dateFrom = d.toISOString().slice(0,10); dateTo = todayStr; break;
      }
      case 'custom':
        dateFrom = qFrom || todayStr; dateTo = qTo || todayStr; break;
      default: // today
        dateFrom = dateTo = todayStr;
    }

    const agentMap = {
      'laura': [LAURA_AGENT_ID || 'laura-abhi-agent'],
      'darren': [DARREN_AGENT_ID || 'darren-abhi-agent'],
      'all': [LAURA_AGENT_ID || 'laura-abhi-agent', DARREN_AGENT_ID || 'darren-abhi-agent'],
    };
    const agentIds = agentMap[agent] || agentMap.all;

    // 1. Cost snapshots per day per agent
    const snapshots = await pgPool.query(`
      SELECT agent_id, snapshot_date::text, total_cost_usd, by_model, task_count, source
      FROM agent_cost_snapshots
      WHERE agent_id = ANY($1)
        AND snapshot_date >= $2::date AND snapshot_date <= $3::date
      ORDER BY snapshot_date DESC
    `, [agentIds, dateFrom, dateTo]);

    // 2. Tasks with costs
    const tasks = await pgPool.query(`
      SELECT id, agent_id, title, status, model, cost_usd,
             input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
             created_at::text, updated_at::text
      FROM abhi_tasks
      WHERE agent_id = ANY($1)
        AND DATE(created_at) >= $2::date AND DATE(created_at) <= $3::date
      ORDER BY created_at DESC
      LIMIT 500
    `, [agentIds, dateFrom, dateTo]);

    // 3. Activities
    const activities = await pgPool.query(`
      SELECT id, agent_id, category, title, time_saved_min, cost_usd,
             requested_by, created_at::text
      FROM agent_activities
      WHERE agent_id = ANY($1)
        AND DATE(created_at) >= $2::date AND DATE(created_at) <= $3::date
      ORDER BY created_at DESC
      LIMIT 200
    `, [agentIds, dateFrom, dateTo]);

    // 4. Compute summary
    const totalCostFromTasks = tasks.rows.reduce((s, t) => s + (Number(t.cost_usd)||0), 0);
    const totalTokensIn  = tasks.rows.reduce((s, t) => s + (Number(t.input_tokens)||0), 0);
    const totalTokensOut = tasks.rows.reduce((s, t) => s + (Number(t.output_tokens)||0), 0);
    const totalCRTokens  = tasks.rows.reduce((s, t) => s + (Number(t.cache_read_tokens)||0), 0);
    const totalCWTokens  = tasks.rows.reduce((s, t) => s + (Number(t.cache_write_tokens)||0), 0);

    // Cost by agent
    const costByAgent = {};
    for (const r of snapshots.rows) {
      costByAgent[r.agent_id] = (costByAgent[r.agent_id] || 0) + Number(r.total_cost_usd);
    }

    // Cost by category (from activities)
    const costByCategory = {};
    for (const a of activities.rows) {
      const cat = a.category || 'other';
      costByCategory[cat] = (costByCategory[cat] || 0) + (Number(a.cost_usd)||0);
    }

    // Daily series from snapshots
    const dailySeries = {};
    for (const r of snapshots.rows) {
      const d = r.snapshot_date;
      if (!dailySeries[d]) dailySeries[d] = {};
      dailySeries[d][r.agent_id] = Number(r.total_cost_usd);
    }

    // Fetch real-time cost from Anthropic API for today
    let anthropicCostToday = null;
    if ((preset === 'today' || dateTo === todayStr) && ANTHROPIC_AGENT_API_KEY_ID) {
      try {
        const costResp = await fetch(`http://127.0.0.1:${PORT}/api/cost/today`);
        const costData = await costResp.json();
        anthropicCostToday = costData.actualCostUsd || null;
      } catch {}
    }

    res.json({
      ok: true,
      preset, dateFrom, dateTo, agent,
      summary: {
        totalCostUsd:      anthropicCostToday ?? totalCostFromTasks,
        anthropicCostToday,
        totalCostFromTasks,
        totalInputTokens:  totalTokensIn,
        totalOutputTokens: totalTokensOut,
        totalCacheRead:    totalCRTokens,
        totalCacheWrite:   totalCWTokens,
        totalTasks:        tasks.rowCount,
        totalActivities:   activities.rowCount,
        costByAgent,
        costByCategory,
      },
      dailySeries: Object.entries(dailySeries).sort(([a],[b]) => a.localeCompare(b)).map(([date, agents]) => ({ date, ...agents })),
      tasks: tasks.rows,
      activities: activities.rows,
      snapshots: snapshots.rows,
    });
  } catch (e) {
    console.error('GET /api/analytics error:', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── GET /api/layouts/:tableId — get saved layout for current user ──────────────
app.get('/api/layouts/:tableId', async (req, res) => {
  try {
    const bearer = (req.headers.authorization || '').replace('Bearer ', '').trim();
    const token = bearer || req.query.token || '';
    
    if (!token) {
      return res.status(401).json({ ok: false, error: 'Missing authorization token' });
    }

    const sess = await loadSession(token);
    if (!sess) {
      return res.status(401).json({ ok: false, error: 'Invalid or expired session' });
    }

    const { tableId } = req.params;
    const result = await bbPool.query(
      `SELECT layout FROM table_layouts WHERE user_email=$1 AND table_id=$2 LIMIT 1`,
      [sess.email, tableId]
    );

    if (result.rows.length > 0) {
      res.json({ ok: true, layout: result.rows[0].layout });
    } else {
      res.json({ ok: true, layout: null });
    }
  } catch (e) {
    console.error('GET /api/layouts/:tableId error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── POST /api/layouts/:tableId — save layout for current user ─────────────────
app.post('/api/layouts/:tableId', async (req, res) => {
  try {
    const bearer = (req.headers.authorization || '').replace('Bearer ', '').trim();
    const token = bearer || req.query.token || '';
    
    if (!token) {
      return res.status(401).json({ ok: false, error: 'Missing authorization token' });
    }

    const sess = await loadSession(token);
    if (!sess) {
      return res.status(401).json({ ok: false, error: 'Invalid or expired session' });
    }

    const { tableId } = req.params;
    const { layout } = req.body;

    if (!layout) {
      return res.status(400).json({ ok: false, error: 'Missing layout in request body' });
    }

    await bbPool.query(
      `INSERT INTO table_layouts (user_email, table_id, layout, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_email, table_id)
       DO UPDATE SET layout = EXCLUDED.layout, updated_at = NOW()`,
      [sess.email, tableId, JSON.stringify(layout)]
    );

    res.json({ ok: true, message: 'Layout saved' });
  } catch (e) {
    console.error('POST /api/layouts/:tableId error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});



// ── Sheet Update Intent Handler (injected 2026-04-30 — Priority 1 build) ────
const INTENT_SHEET_ID  = '1WEIHITpnk_Ymrk6RTaKYzMK55vLnSViU4RKg5Py34WU';
const INTENT_GOG_PATH  = '/usr/local/bin/gog';
const INTENT_GOG_ACCT  = 'lpetersen@boldbusiness.com';

const INTENT_TAB_CFG = {
  'CET Designers':           { nameCol: 'D', companyCol: 'A', headerRows: 1, fields: { response_status:'L', response_date:'M', touch1:'H', touch2:'I', touch3:'J', touch4:'K', call_scheduled:'N' } },
  'Estimators':              { nameCol: 'D', companyCol: 'A', headerRows: 1, fields: { response_status:'L', response_date:'M', touch1:'I', touch2:'J', touch3:'K', call_scheduled:'N' } },
  'BIM Modelers':            { nameCol: 'D', companyCol: 'A', headerRows: 1, fields: { response_status:'M', response_date:'L', call_scheduled:'N', touch1:'J' } },  // J=Status col (I=Date Sent)
  'Sales Coordinators / PMs':{ nameCol: 'D', companyCol: 'A', headerRows: 1, fields: { response_status:'K', call_scheduled:'L', touch1:'I', touch2:'J' } },
};

// ── Dashboard Action Intent Handler ────────────────────────────────────────
// Handles natural-language commands to create/update/delete dashboard data:
// campaign briefs, call records, tasks — without going through the AI gateway.

function parseDashboardIntent(msg) {
  const m = msg.trim();
  const lo = m.toLowerCase();

  // ── CAMPAIGN BRIEFS ────────────────────────────────────────────────────────
  // Add brief: "add campaign brief <title>" / "create a new brief called <title>"
  let r = m.match(/^(?:add|create|new)\s+(?:a\s+)?(?:campaign\s+)?brief(?:\s+called|\s+named|:)?\s+(.+)$/i);
  if (r) return { action: 'brief_add', title: r[1].trim() };

  // Delete brief: "delete brief <title>" / "remove campaign brief <title>"
  r = m.match(/^(?:delete|remove)\s+(?:campaign\s+)?brief\s+(.+)$/i);
  if (r) return { action: 'brief_delete', title: r[1].trim() };

  // Update brief title: "rename brief <old> to <new>"
  r = m.match(/^rename\s+(?:campaign\s+)?brief\s+(.+?)\s+to\s+(.+)$/i);
  if (r) return { action: 'brief_rename', oldTitle: r[1].trim(), newTitle: r[2].trim() };

  // Update brief field: "set brief <title> assignee to Laura"
  r = m.match(/^(?:set|update)\s+(?:campaign\s+)?brief\s+(.+?)\s+(assignee|channel|activity|icp|subtitle)\s+to\s+(.+)$/i);
  if (r) return { action: 'brief_update_field', title: r[1].trim(), field: r[2].toLowerCase(), value: r[3].trim() };

  // List briefs
  if (/^(?:list|show)\s+(?:all\s+)?(?:campaign\s+)?briefs?$/.test(lo))
    return { action: 'brief_list' };

  // ── TASKS ─────────────────────────────────────────────────────────────────
  // Add task: "add task <description>" / "create task: <desc>"
  r = m.match(/^(?:add|create|new)\s+(?:a\s+)?task:?\s+(.+)$/i);
  if (r) return { action: 'task_add', description: r[1].trim() };

  // Update task status: "mark task <id> as done" / "update task <id> status to pending"
  r = m.match(/^(?:mark|update|set)\s+task\s+(\d+)\s+(?:as\s+|status\s+to\s+)(.+)$/i);
  if (r) return { action: 'task_update', id: r[1], status: r[2].trim().toLowerCase() };

  // Delete task: "delete task <id>"
  r = m.match(/^(?:delete|remove)\s+task\s+(\d+)$/i);
  if (r) return { action: 'task_delete', id: r[1] };

  // List tasks
  if (/^(?:list|show)\s+(?:all\s+)?(?:open\s+|pending\s+)?tasks?$/.test(lo))
    return { action: 'task_list' };

  // ── CALL RECORDS ──────────────────────────────────────────────────────────
  // Log call: "log call with <name> at <company> outcome <result>"
  r = m.match(/^log\s+(?:a\s+)?call\s+with\s+(.+?)(?:\s+at\s+(.+?))?(?:\s+outcome\s+(.+))?$/i);
  if (r) return { action: 'call_add', contact: r[1].trim(), company: (r[2]||'').trim(), outcome: (r[3]||'').trim() };

  return null;
}

async function handleDashboardIntent(userMessage, sessionId, taskRef, agentName, pgPool) {
  const intent = parseDashboardIntent(userMessage);
  if (!intent) return null;

  let replyText = '';
  try {
    // ── CAMPAIGN BRIEFS ──────────────────────────────────────────────────────
    if (intent.action === 'brief_add') {
      const sortRes = await smtAdminPool.query(
        `SELECT COALESCE(MAX(sort_order),0)+1 AS next FROM sales.campaign_briefs WHERE is_deleted=false OR is_deleted IS NULL`
      );
      const sortOrder = Number(sortRes.rows[0].next) || 1;
      const assignee = agentName === 'darren' ? 'Darren' : 'Laura';
      const account_id = agentName === 'darren' ? 32893 : 32891;
      const res = await smtAdminPool.query(
        `INSERT INTO sales.campaign_briefs (title, assignee, account_id, channel, sort_order, created_at)
         VALUES ($1,$2,$3,'LinkedIn + Email',$4,CURRENT_DATE) RETURNING id, title`,
        [intent.title, assignee, account_id, sortOrder]
      );
      replyText = `✅ Campaign brief "${res.rows[0].title}" added (id=${res.rows[0].id}, assigned to ${assignee}). Refresh the Campaign Brief section to see it.`;
    }

    else if (intent.action === 'brief_delete') {
      const res = await smtAdminPool.query(
        `UPDATE sales.campaign_briefs SET is_deleted=true, updated_at=NOW()
         WHERE LOWER(title) LIKE $1 AND (is_deleted=false OR is_deleted IS NULL)
         RETURNING id, title`,
        [`%${intent.title.toLowerCase()}%`]
      );
      if (!res.rows.length) replyText = `❌ No active brief found matching "${intent.title}". Check the exact title.`;
      else if (res.rows.length === 1) replyText = `✅ Deleted brief "${res.rows[0].title}".`;
      else replyText = `✅ Deleted ${res.rows.length} briefs matching "${intent.title}": ${res.rows.map(r=>r.title).join(', ')}.`;
    }

    else if (intent.action === 'brief_rename') {
      const res = await smtAdminPool.query(
        `UPDATE sales.campaign_briefs SET title=$1, updated_at=NOW()
         WHERE LOWER(title) LIKE $2 AND (is_deleted=false OR is_deleted IS NULL)
         RETURNING id, title`,
        [intent.newTitle, `%${intent.oldTitle.toLowerCase()}%`]
      );
      if (!res.rows.length) replyText = `❌ No brief found matching "${intent.oldTitle}".`;
      else replyText = `✅ Renamed to "${intent.newTitle}" (id=${res.rows[0].id}).`;
    }

    else if (intent.action === 'brief_update_field') {
      const colMap = { assignee:'assignee', channel:'channel', activity:'activity', icp:'subtitle', subtitle:'subtitle' };
      const col = colMap[intent.field];
      if (!col) { replyText = `❌ Unknown field "${intent.field}". Options: assignee, channel, activity, icp.`; }
      else {
        const res = await smtAdminPool.query(
          `UPDATE sales.campaign_briefs SET ${col}=$1, updated_at=NOW()
           WHERE LOWER(title) LIKE $2 AND (is_deleted=false OR is_deleted IS NULL)
           RETURNING id, title`,
          [intent.value, `%${intent.title.toLowerCase()}%`]
        );
        if (!res.rows.length) replyText = `❌ No brief found matching "${intent.title}".`;
        else replyText = `✅ Updated ${intent.field} → "${intent.value}" on "${res.rows[0].title}".`;
      }
    }

    else if (intent.action === 'brief_list') {
      const res = await smtAdminPool.query(
        `SELECT id, title, assignee, channel FROM sales.campaign_briefs
         WHERE is_deleted=false OR is_deleted IS NULL ORDER BY sort_order ASC NULLS LAST, id ASC LIMIT 30`
      );
      if (!res.rows.length) replyText = 'No campaign briefs found.';
      else replyText = `**Campaign Briefs (${res.rows.length})**\n` +
        res.rows.map((r,i) => `${i+1}. ${r.title} · ${r.assignee||'?'}`).join('\n');
    }

    // ── TASKS ────────────────────────────────────────────────────────────────
    else if (intent.action === 'task_add') {
      const res = await pgPool.query(
        `INSERT INTO user_tasks (description, status, task_type, horizon, accountable_person)
         VALUES ($1,'pending','Next Action','Ground',$2) RETURNING id, description`,
        [intent.description, agentName === 'darren' ? 'Darren' : 'Laura']
      );
      replyText = `✅ Task #${res.rows[0].id} created: "${res.rows[0].description}".`;
    }

    else if (intent.action === 'task_update') {
      const validStatuses = ['pending','captured','done','dismissed'];
      const status = validStatuses.find(s => intent.status.includes(s)) || intent.status;
      const res = await pgPool.query(
        `UPDATE user_tasks SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING id, description, status`,
        [status, intent.id]
      );
      if (!res.rows.length) replyText = `❌ Task #${intent.id} not found.`;
      else replyText = `✅ Task #${res.rows[0].id} "${res.rows[0].description}" → ${res.rows[0].status}.`;
    }

    else if (intent.action === 'task_delete') {
      const res = await pgPool.query(
        `DELETE FROM user_tasks WHERE id=$1 RETURNING id, description`, [intent.id]
      );
      if (!res.rows.length) replyText = `❌ Task #${intent.id} not found.`;
      else replyText = `✅ Deleted task #${res.rows[0].id} "${res.rows[0].description}".`;
    }

    else if (intent.action === 'task_list') {
      const res = await pgPool.query(
        `SELECT id, description, status, horizon FROM user_tasks
         WHERE status NOT IN ('done','dismissed') ORDER BY id DESC LIMIT 20`
      );
      if (!res.rows.length) replyText = 'No open tasks found.';
      else replyText = `**Open Tasks (${res.rows.length})**\n` +
        res.rows.map(r => `#${r.id} [${r.status}] ${r.description}`).join('\n');
    }

    // ── CALL RECORDS ─────────────────────────────────────────────────────────
    else if (intent.action === 'call_add') {
      const res = await smtAdminPool.query(
        `INSERT INTO sales.dashboard_call_records
           (contact_name, contact_company, campaign_name, account_id, call_date, outcome, notes)
         VALUES ($1,$2,$3,$4,CURRENT_DATE,$5,'Logged via chat') RETURNING id`,
        [intent.contact, intent.company||null, taskRef||null,
         agentName==='darren'?32893:32891, intent.outcome||'completed']
      );
      replyText = `✅ Call logged (id=${res.rows[0].id}) — ${intent.contact}${intent.company?' at '+intent.company:''}, outcome: ${intent.outcome||'completed'}.`;
    }

  } catch (e) {
    console.error('[dashboard-intent] error:', e.message);
    replyText = `❌ Action failed: ${e.message}`;
  }

  // Store reply in chat
  await pgPool.query(
    `INSERT INTO dashboard_chat (session_id, sender, task_ref, message) VALUES ($1,$2,$3,$4)`,
    [sessionId, agentName||'laura', taskRef||null, replyText]
  ).catch(() => {});
  await pgPool.query(
    `UPDATE chat_sessions SET updated_at=NOW(), message_count=message_count+1, last_message=$1 WHERE id=$2`,
    [replyText.slice(0,120), sessionId]
  ).catch(() => {});

  return replyText;
}
// ── End Dashboard Intent Handler ─────────────────────────────────────────────

const INTENT_FIELD_ALIASES = {
  'reply status':'response_status','response status':'response_status','status':'response_status',
  'call scheduled':'call_scheduled','call booked':'call_scheduled','called':'call_scheduled',
  'response date':'response_date','reply date':'response_date',
  'touch 1':'touch1','touch 2':'touch2','touch 3':'touch3','touch 4':'touch4',
  'touch1':'touch1','touch2':'touch2','touch3':'touch3','touch4':'touch4',
};
const INTENT_VALUE_ALIASES = {
  'called':'Y','yes':'Y','y':'Y','no':'N','n':'N',
  'call scheduled':'Call Scheduled','call booked':'Call Scheduled','scheduled':'Call Scheduled',
  'interested':'Interested','not interested':'Not Interested','replied':'Replied',
  'no reply':'No Reply','bounced':'Bounced','unsubscribed':'Unsubscribed','opted out':'Unsubscribed',
};

function parseSheetUpdateIntent(message) {
  const msg = message.trim();
  const normalizeField = (raw) => INTENT_FIELD_ALIASES[raw.toLowerCase().trim()] || raw.toLowerCase().replace(/ /g,'_');
  const normalizeValue = (raw) => INTENT_VALUE_ALIASES[raw.toLowerCase().trim()] || raw.trim();

  // Pattern 1: update/set/change <id> <field> to <value>
  let m = msg.match(/^(?:update|set|change)\s+(.+?)\s+(reply\s+status|response\s+status|status|call\s+scheduled|call\s+booked|response\s+date|reply\s+date|touch\s*[1-4]|notes)\s+to\s+(.+)$/i);
  if (m) return { identifier: m[1].trim(), field: normalizeField(m[2]), value: normalizeValue(m[3]) };

  // Pattern 2: mark <id> as <value>
  m = msg.match(/^mark\s+(.+?)\s+as\s+(.+)$/i);
  if (m) {
    const id = m[1].trim(), valRaw = m[2].trim(), valLow = valRaw.toLowerCase();
    if (['called','call scheduled','call booked','scheduled'].includes(valLow))
      return { identifier: id, field: 'call_scheduled', value: 'Y' };
    return { identifier: id, field: 'response_status', value: normalizeValue(valRaw) };
  }

  // Pattern 3: set row <n> to/as <value>
  m = msg.match(/^(?:set|update)\s+row\s+(\d+)\s+(?:to|as|status)\s+(.+)$/i);
  if (m) return { identifier: `row ${m[1]}`, field: 'response_status', value: normalizeValue(m[2]) };

  return null;
}

async function intentFetchRange(tab, range) {
  return new Promise((resolve) => {
    const cmd = `${INTENT_GOG_PATH} sheets get "${INTENT_SHEET_ID}" "'${tab}'!${range}" --account ${INTENT_GOG_ACCT} --json`;
    exec(cmd, { timeout: 20000 }, (err, stdout) => {
      if (err) return resolve([]);
      try { resolve(JSON.parse(stdout).values || []); } catch { resolve([]); }
    });
  });
}

async function intentFindContact(identifier) {
  const idLow = identifier.toLowerCase().trim();
  // Row number reference?
  const rowMatch = idLow.match(/^row\s*(\d+)$/);
  if (rowMatch) {
    const rowNum = parseInt(rowMatch[1]);
    for (const tabName of Object.keys(INTENT_TAB_CFG)) {
      const vals = await intentFetchRange(tabName, `A${rowNum}:D${rowNum}`);
      if (vals && vals[0] && vals[0].length > 3) {
        return [{ tab: tabName, rowNum, name: vals[0][3]||'', company: vals[0][0]||'' }];
      }
    }
    return [];
  }
  // Name search
  const matches = [];
  for (const [tabName, cfg] of Object.entries(INTENT_TAB_CFG)) {
    const vals = await intentFetchRange(tabName, `A1:D2000`);
    const data  = vals.slice(cfg.headerRows);
    data.forEach((row, i) => {
      const name = row[3] || '';
      const company = row[0] || '';
      if (name && name.toLowerCase().includes(idLow)) {
        matches.push({ tab: tabName, rowNum: i + 1 + cfg.headerRows, name, company });
      }
    });
  }
  return matches;
}

async function intentUpdateCell(tab, col, rowNum, value) {
  return new Promise((resolve) => {
    const range = `'${tab}'!${col}${rowNum}`;
    const cmd = `${INTENT_GOG_PATH} sheets update "${INTENT_SHEET_ID}" "${range}" "${value.replace(/"/g,'\\"')}" --account ${INTENT_GOG_ACCT} --force`;
    exec(cmd, { timeout: 20000 }, (err) => resolve(!err));
  });
}

async function handleSheetUpdateIntent(userMessage, sessionId, taskRef, agentName, pgPool) {
  const intent = parseSheetUpdateIntent(userMessage);
  if (!intent) return null; // not a sheet command

  const matches = await intentFindContact(intent.identifier);

  let replyText;
  if (matches.length === 0) {
    replyText = `I couldn't find a contact matching "${intent.identifier}". Try the exact name or "row <number>".`;
  } else if (matches.length > 1) {
    const opts = matches.slice(0,5).map(m => `  Row ${m.rowNum}: ${m.name} (${m.company}) — ${m.tab}`).join('\n');
    replyText = `Found ${matches.length} contacts matching "${intent.identifier}":\n${opts}\n\nWhich one? Reply with the row number to confirm.`;
  } else {
    const contact = matches[0];
    const tabCfg  = INTENT_TAB_CFG[contact.tab];
    const col     = tabCfg && tabCfg.fields[intent.field];
    if (!col) {
      const avail = tabCfg ? Object.keys(tabCfg.fields).join(', ') : 'unknown';
      replyText = `Field "${intent.field}" isn't available for ${contact.tab}. Available: ${avail}`;
    } else {
      const ok = await intentUpdateCell(contact.tab, col, contact.rowNum, intent.value);
      if (ok) {
        replyText = `Done. Updated ${contact.name} (${contact.company}) in ${contact.tab}, Row ${contact.rowNum}.\nField: ${intent.field} → "${intent.value}"`;
      } else {
        replyText = `Sheet update failed for ${contact.name} row ${contact.rowNum}. Check gog credentials or retry.`;
      }
    }
  }

  // Store the reply in dashboard_chat
  await pgPool.query(
    `INSERT INTO dashboard_chat (session_id, sender, task_ref, message) VALUES ($1, $2, $3, $4)`,
    [sessionId, agentName || 'laura', taskRef || null, replyText]
  ).catch(() => {});

  await pgPool.query(
    `UPDATE chat_sessions SET updated_at=NOW(), message_count=message_count+1, last_message=$1 WHERE id=$2`,
    [replyText.slice(0,120), sessionId]
  ).catch(() => {});

  return replyText; // non-null signals "handled"
}
// ── End Sheet Update Intent Handler ─────────────────────────────────────────
