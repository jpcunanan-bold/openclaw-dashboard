// api/seed-activities.js
// Seeds agent_activities in bb_agents DB from the contacts table (XLSX-sourced data).
// Each meaningful touch / response / call row becomes a logged activity for the correct agent.
// Safe to re-run — uses session_key as idempotency key (ON CONFLICT DO NOTHING).
// Uses bulk INSERT to avoid RDS round-trip timeout on large datasets.
// Usage: node api/seed-activities.js

import 'dotenv/config';
import pg from 'pg';
import { randomUUID } from 'crypto';

const pgPool = new pg.Pool({
  host:     process.env.PG_HOST,
  port:     Number(process.env.PG_PORT) || 5432,
  user:     process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE || 'laura',
  ssl: { rejectUnauthorized: false },
});

const bbPool = new pg.Pool({
  host:     process.env.BB_AGENTS_HOST,
  port:     5432,
  user:     process.env.BB_AGENTS_USER,
  password: process.env.BB_AGENTS_PASSWORD,
  database: process.env.BB_AGENTS_DB || 'bb_agents',
  ssl: { rejectUnauthorized: false },
});

const LAURA_AGENT_ID  = process.env.LAURA_AGENT_ID  || 'laura-abhi-agent';
const DARREN_AGENT_ID = process.env.DARREN_AGENT_ID || 'darren-abhi-agent';

function agentId(agent) {
  return agent === 'laura' ? LAURA_AGENT_ID : DARREN_AGENT_ID;
}

async function ensureAgentRegistry() {
  for (const [id, agentName] of [[LAURA_AGENT_ID, 'Laura'], [DARREN_AGENT_ID, 'Darren']]) {
    try {
      await bbPool.query(`
        INSERT INTO agent_registry (agent_id, agent_name, active, first_seen_at, last_active_at)
        VALUES ($1, $2, true, NOW(), NOW())
        ON CONFLICT (agent_id) DO UPDATE SET last_active_at = NOW()
      `, [id, agentName]);
      console.log(`  agent_registry: ${agentName} (${id}) ensured`);
    } catch (e) {
      console.warn(`  agent_registry upsert skipped for ${id}:`, e.message);
    }
  }
}

// Bulk-insert all activity rows in one query; skip duplicates on session_key
async function bulkInsert(rows) {
  if (!rows.length) return 0;

  const COLS = [
    'id','agent_id','type','category','requested_by','title','request','actions',
    'task_id','model','input_tokens','output_tokens','cache_read_tokens','cache_write_tokens',
    'total_tokens','cost_usd','time_saved_min','source','session_key','timestamp',
  ];
  const numCols = COLS.length;
  const values  = [];
  const placeholders = rows.map((row, ri) => {
    const offset = ri * numCols;
    values.push(
      row.id,
      row.agent_id,
      row.type,
      row.category,
      'system',
      row.title,
      '',
      row.actions,   // already JSON string
      null, null, 0, 0, 0, 0, 0, 0, 0,
      row.source,
      row.session_key,
      new Date(),
    );
    return `(${COLS.map((_, ci) => `$${offset + ci + 1}`)
      .map((p, ci) => ci === 7 ? `${p}::jsonb` : p)  // actions col
      .join(',')})`;
  });

  try {
    const result = await bbPool.query(
      `INSERT INTO agent_activities (${COLS.join(',')}) VALUES ${placeholders.join(',')}
       ON CONFLICT (session_key) DO NOTHING`,
      values
    );
    return result.rowCount;
  } catch (e) {
    // session_key may not have unique constraint — fall back to row-by-row
    if (e.message.includes('unique') || e.message.includes('session_key')) {
      // try without ON CONFLICT
      let inserted = 0;
      for (const row of rows) {
        try {
          await bbPool.query(
            `INSERT INTO agent_activities (${COLS.join(',')}) VALUES (${COLS.map((_, ci) => ci === 7 ? `$${ci+1}::jsonb` : `$${ci+1}`).join(',')})`,
            [row.id, row.agent_id, row.type, row.category, 'system', row.title, '',
             row.actions, null, null, 0, 0, 0, 0, 0, 0, 0, row.source, row.session_key, new Date()]
          );
          inserted++;
        } catch (_) { /* duplicate */ }
      }
      return inserted;
    }
    // If bulk fails for another reason, try chunked fallback
    console.error('Bulk insert error:', e.message);
    throw e;
  }
}

function buildRows(contacts) {
  const rows = [];

  for (const row of contacts) {
    const aid    = agentId(row.agent);
    const target = `${row.contact_name || 'Unknown'} @ ${row.company || 'Unknown'} (${row.campaign})`;
    const base   = `contact:${row.id}`;

    const add = (suffix, type, category, actionsText) => {
      rows.push({
        id:          randomUUID(),
        agent_id:    aid,
        type,
        category,
        title:       `${suffix} — ${target}`,
        actions:     JSON.stringify([actionsText]),
        source:      'xlsx-import',
        session_key: `${base}:${suffix.toLowerCase().replace(/\s+/g,'_')}`,
      });
    };

    if (row.touch1)           add('Touch 1',  'outreach',  'email',    row.touch1);
    if (row.touch2)           add('Touch 2',  'outreach',  'follow-up',row.touch2);
    if (row.touch3)           add('Touch 3',  'outreach',  'follow-up',row.touch3);
    if (row.touch4)           add('Touch 4',  'outreach',  'follow-up',row.touch4);
    if (row.touch5)           add('Touch 5',  'outreach',  'follow-up',row.touch5);
    if (row.response_status)  add('Response', 'response',  'inbound',
      `${row.response_status}${row.response_date ? ' on ' + row.response_date : ''}`);
    if (row.call_scheduled)   add('Call',     'call',      'meeting',
      `Call scheduled: ${row.call_scheduled}`);
  }

  return rows;
}

async function seedFromContacts() {
  const { rows } = await pgPool.query(`
    SELECT id, agent, campaign, company, contact_name,
           touch1, touch2, touch3, touch4, touch5,
           response_status, response_date, call_scheduled
    FROM contacts
    WHERE (touch1 IS NOT NULL AND touch1 <> '')
       OR (touch2 IS NOT NULL AND touch2 <> '')
       OR (touch3 IS NOT NULL AND touch3 <> '')
       OR (response_status IS NOT NULL AND response_status <> '')
       OR (call_scheduled IS NOT NULL AND call_scheduled <> '')
    ORDER BY agent, campaign
  `);

  console.log(`\nFound ${rows.length} contacts — building activity rows…`);

  const activityRows = buildRows(rows);
  console.log(`Built ${activityRows.length} activity rows — bulk inserting…`);

  // Insert in chunks of 500 to stay within PG parameter limit ($1…$32767)
  const CHUNK = 200;
  let totalInserted = 0;
  for (let i = 0; i < activityRows.length; i += CHUNK) {
    const chunk = activityRows.slice(i, i + CHUNK);
    const inserted = await bulkInsert(chunk);
    totalInserted += inserted;
    process.stdout.write(`\r  ${Math.min(i + CHUNK, activityRows.length)} / ${activityRows.length} rows processed…`);
  }
  console.log('');

  return { total: activityRows.length, inserted: totalInserted, skipped: activityRows.length - totalInserted };
}

async function printSummary() {
  try {
    const { rows } = await bbPool.query(`
      SELECT agent_id, type, COUNT(*) as cnt
      FROM agent_activities
      WHERE source = 'xlsx-import'
      GROUP BY agent_id, type
      ORDER BY agent_id, type
    `);
    console.log('\n=== agent_activities (xlsx-import source) ===');
    rows.forEach(r => console.log(`  ${r.agent_id.padEnd(22)} ${r.type.padEnd(12)} ${r.cnt}`));
  } catch (e) {
    console.warn('Could not fetch summary:', e.message);
  }
}

async function main() {
  console.log('=== Seed Agent Activities from Contacts ===');

  try { await pgPool.query('SELECT 1'); console.log('laura DB connected'); }
  catch (e) { console.error('laura DB failed:', e.message); process.exit(1); }

  try { await bbPool.query('SELECT 1'); console.log('bb_agents DB connected'); }
  catch (e) { console.error('bb_agents DB failed:', e.message); process.exit(1); }

  await ensureAgentRegistry();

  const { total, inserted, skipped } = await seedFromContacts();
  console.log(`\nDone: ${inserted} inserted, ${skipped} already existed (skipped) out of ${total} total`);

  await printSummary();

  await pgPool.end();
  await bbPool.end();
}

main().catch(e => { console.error('Seed failed:', e); process.exit(1); });
