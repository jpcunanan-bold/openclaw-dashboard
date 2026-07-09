// api/import-xlsx.js
// Usage: node api/import-xlsx.js  (from project root, with api/.env populated)
// Imports DWDM (Darren), BEAD, and Laura lead gen sheets into contacts table.
// Safe to re-run — uses INSERT ON CONFLICT DO NOTHING.

import 'dotenv/config';
import XLSX from 'xlsx';
import pg from 'pg';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { existsSync } from 'fs';

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

const pool = new Pool({
  host:     process.env.PG_HOST,
  port:     Number(process.env.PG_PORT) || 5432,
  user:     process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE || 'laura',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

// ── File paths — adjust if XLSX files move ────────────────────────────────────
const DATA_DIR   = resolve(__dirname, '..', 'docs', 'data');
const DWDM_PATH  = join(DATA_DIR, 'Copy of DWDM + BEAD.xlsx');
const LAURA_PATH = join(DATA_DIR, "Copy of Laura's Lead Generation.xlsx");

function readSheet(filePath, sheetName) {
  if (!existsSync(filePath)) {
    console.warn(`  File not found: ${filePath}`);
    return [];
  }
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    console.warn(`  Sheet "${sheetName}" not found in ${filePath}`);
    console.warn(`  Available sheets: ${wb.SheetNames.join(', ')}`);
    return [];
  }
  return XLSX.utils.sheet_to_json(ws, { defval: '' });
}

function str(v) { return String(v || '').trim(); }

// Bulk insert a batch of rows — much faster than one-at-a-time over RDS.
async function bulkUpsert(rows) {
  if (!rows.length) return;
  const COLS = [
    'agent','campaign','company','contact_name','title','email',
    'linkedin_url','role','location',
    'touch1','touch2','touch3','touch4','touch5',
    'response_status','response_date','call_scheduled',
    'next_action','notes','tier','hiring_evidence','smtp_status','assigned_to',
  ];
  const values = [];
  const placeholders = rows.map((row, ri) => {
    const offset = ri * COLS.length;
    COLS.forEach(c => values.push(row[c] ?? ''));
    return `(${COLS.map((_, ci) => `$${offset + ci + 1}`).join(',')})`;
  });
  await pool.query(`
    INSERT INTO contacts (${COLS.join(',')})
    VALUES ${placeholders.join(',')}
    ON CONFLICT ON CONSTRAINT contacts_email_agent_campaign_uq DO NOTHING
  `, values);
}

async function addUniqueConstraint() {
  // Add constraint idempotently — ignore error if already exists
  try {
    await pool.query(`
      ALTER TABLE contacts
      ADD CONSTRAINT contacts_email_agent_campaign_uq
      UNIQUE (email, agent, campaign)
    `);
    console.log('  Unique constraint added');
  } catch (e) {
    if (e.message.includes('already exists')) {
      console.log('  Unique constraint already present');
    } else {
      throw e;
    }
  }
}

// ── DWDM sheet → Darren contacts ─────────────────────────────────────────────
async function importDWDM() {
  console.log('\n[DWDM] Reading DWDM Companies sheet...');
  const rawRows = readSheet(DWDM_PATH, 'DWDM Companies');
  if (!rawRows.length) { console.warn('[DWDM] No rows.'); return 0; }
  const batch = [];
  for (const r of rawRows) {
    const email = str(r['Email']);
    if (!email && !str(r['Contact Name'])) continue;
    batch.push({
      agent: 'darren', campaign: 'DWDM',
      company:         str(r['Company']),
      contact_name:    str(r['Contact Name']),
      title:           str(r['Title']),
      email:           email || `no-email-dwdm-${batch.length}@placeholder.local`,
      linkedin_url:    str(r['LinkedIn Profile']),
      role: '', location: '',
      touch1:          str(r['Touch 1 Status']),
      touch2:          str(r['Touch 2 Status']),
      touch3:          str(r['Touch 3 Status']),
      touch4:          str(r['Touch 4 Status']),
      touch5:          str(r['Touch 5 Status']),
      response_status: str(r['Response Status'] || r['Response'] || ''),
      response_date:   str(r['Response Date'] || ''),
      call_scheduled:  str(r['Call Scheduled'] || r['Call'] || ''),
      next_action: '', notes: '',
      tier:            str(r['Tier']),
      hiring_evidence: str(r['DWDM Hiring Evidence (Link)']),
      smtp_status:     str(r['SMTP Status']),
      assigned_to:     str(r['Assigned To']),
    });
  }
  await bulkUpsert(batch);
  console.log(`[DWDM] Imported ${batch.length} rows`);
  return batch.length;
}

// ── BEAD sheet ────────────────────────────────────────────────────────────────
async function importBEAD() {
  console.log('\n[BEAD] Reading BEAD sheet...');
  const sheetNames = ['BEAD', 'BEAD Companies', 'Sheet2'];
  let rawRows = [];
  for (const name of sheetNames) {
    rawRows = readSheet(DWDM_PATH, name);
    if (rawRows.length) { console.log(`  Found data in sheet: "${name}"`); break; }
  }
  if (!rawRows.length) { console.warn('[BEAD] No rows found. Skipping.'); return 0; }
  const batch = [];
  for (const r of rawRows) {
    const email = str(r['Verified Email'] || r['Email'] || r['Contact Email'] || '');
    const company = str(r['Company'] || '');
    if (!company && !email) continue;
    const assignedTo = str(r['Assigned To'] || '');
    batch.push({
      agent:           assignedTo.toLowerCase().includes('laura') ? 'laura' : 'darren',
      campaign:        'BEAD', company,
      contact_name:    str(r['Contact Name'] || ''),
      title:           str(r['Title'] || ''),
      email:           email || `no-email-bead-${batch.length}@placeholder.local`,
      linkedin_url:    str(r['LinkedIn URL'] || r['LinkedIn Profile'] || ''),
      role:            str(r['Technology'] || r['Approach'] || ''),
      location:        str(r['State'] || ''),
      touch1: '', touch2: '', touch3: '', touch4: '', touch5: '',
      response_status: '', response_date: '', call_scheduled: '',
      next_action:     str(r['Mercury Z Approach'] || ''),
      notes:           str(r['Mercury Z-Relevant Hiring Status'] || r['Hiring Signals'] || ''),
      tier:            str(r['Tier Category'] || r['Tier'] || ''),
      hiring_evidence: str(r['Mercury Z-Relevant Hiring Status'] || r['Hiring Signals'] || ''),
      smtp_status:     str(r['SMTP Status'] || ''),
      assigned_to:     assignedTo,
    });
  }
  await bulkUpsert(batch);
  console.log(`[BEAD] Imported ${batch.length} rows`);
  return batch.length;
}

// ── BEAD Winner sheet ─────────────────────────────────────────────────────────
async function importBEADWinner() {
  console.log('\n[BEAD Winner] Reading "Copy of BEAD Winner" sheet...');
  const rawRows = readSheet(DWDM_PATH, 'Copy of BEAD Winner');
  if (!rawRows.length) { console.warn('[BEAD Winner] No rows.'); return 0; }
  const batch = [];
  for (const r of rawRows) {
    const firstName  = str(r['First Name '] || r['First Name'] || '');
    const lastName   = str(r['Last Name ']  || r['Last Name']  || '');
    const contactName = [firstName, lastName].filter(Boolean).join(' ');
    const email      = str(r['Contact Email '] || r['Contact Email'] || '');
    const company    = str(r['Company '] || r['Company'] || '');
    if (!company && !email) continue;
    batch.push({
      agent: 'darren', campaign: 'BEAD Winner', company,
      contact_name:    contactName,
      title:           str(r['Contact Title '] || r['Contact Title'] || ''),
      email:           email || `no-email-beadw-${batch.length}@placeholder.local`,
      linkedin_url:    str(r['Contact LI '] || r['Contact LI'] || ''),
      role:            str(r['Industry'] || ''),
      location:        str(r['Location'] || ''),
      touch1: '', touch2: '', touch3: '', touch4: '', touch5: '',
      response_status: '', response_date: '', call_scheduled: '',
      next_action: '',
      notes:           str(r['Company Description'] || '').slice(0, 500),
      tier: '', hiring_evidence: '', smtp_status: '',
      assigned_to:     str(r[''] || '') || 'darren',
    });
  }
  await bulkUpsert(batch);
  console.log(`[BEAD Winner] Imported ${batch.length} rows`);
  return batch.length;
}

// ── DC - Contacts sheet (headers at row 3) ────────────────────────────────────
async function importDCContacts() {
  console.log('\n[DC Contacts] Reading "DC - Contacts" sheet...');
  const wb = XLSX.readFile(DWDM_PATH);
  const ws = wb.Sheets['DC - Contacts'];
  if (!ws) { console.warn('[DC Contacts] Sheet not found.'); return 0; }
  const rawRows = XLSX.utils.sheet_to_json(ws, { range: 3, defval: '' });
  const batch = [];
  for (const r of rawRows) {
    const email = str(r['Contact Email'] || '');
    const contactName = str(r['Contact Name'] || '');
    if (!email && !contactName) continue;
    const priority = str(r['Priority'] || '');
    const tier = priority.includes('HIGHEST') ? 'Tier 1' :
                 priority.includes('HIGH')    ? 'Tier 2' :
                 priority.includes('MEDIUM')  ? 'Tier 3' : 'Tier 4';
    batch.push({
      agent: 'darren', campaign: 'Data Centers',
      company:         str(r['General Contractor'] || r['Owner/Operator'] || ''),
      contact_name:    contactName,
      title:           str(r['Contact Title'] || ''),
      email:           email || `no-email-dc-${batch.length}@placeholder.local`,
      linkedin_url:    str(r['Contact LinkedIn URL'] || ''),
      role:            [str(r['Owner/Operator']), str(r['Project Name'])].filter(Boolean).join(' — '),
      location: '',
      touch1: '', touch2: '', touch3: '', touch4: '', touch5: '',
      response_status: '', response_date: '', call_scheduled: '',
      next_action: '',
      notes:           str(r['Mercury Z Entry Point'] || '').slice(0, 500),
      tier,
      hiring_evidence: str(r['Mercury Z Entry Point'] || ''),
      smtp_status: '', assigned_to: 'darren',
    });
  }
  await bulkUpsert(batch);
  console.log(`[DC Contacts] Imported ${batch.length} rows`);
  return batch.length;
}

// ── DC - All Projects sheet (headers at row 3) ────────────────────────────────
async function importDCProjects() {
  console.log('\n[DC Projects] Reading "DC - All Projects" sheet...');
  const wb = XLSX.readFile(DWDM_PATH);
  const ws = wb.Sheets['DC - All Projects'];
  if (!ws) { console.warn('[DC Projects] Sheet not found.'); return 0; }
  const rawRows = XLSX.utils.sheet_to_json(ws, { range: 3, defval: '' });
  const batch = [];
  for (const r of rawRows) {
    const company = str(r['Owner / Operator'] || r['Owner/Operator'] || '');
    if (!company) continue;
    const urgency = str(r['Urgency\nScore'] || r['Urgency Score'] || '');
    const tier = urgency.includes('98') || urgency.includes('97') || urgency.includes('96') ? 'Tier 1' :
                 Number(urgency.replace(/\D.*/, '')) >= 80 ? 'Tier 2' :
                 Number(urgency.replace(/\D.*/, '')) >= 60 ? 'Tier 3' : 'Tier 4';
    batch.push({
      agent: 'darren', campaign: 'DC Projects', company,
      contact_name:    str(r['General Contractor (GC)'] || ''),
      title:           str(r['Project Name'] || ''),
      email:           `no-email-dcp-${batch.length}@placeholder.local`,
      linkedin_url: '',
      role:            str(r['Fiber Tech Roles Needed'] || ''),
      location:        [str(r['City']), str(r['State'])].filter(Boolean).join(', '),
      touch1: '', touch2: '', touch3: '', touch4: '', touch5: '',
      response_status: str(r['Status'] || ''),
      response_date: '', call_scheduled: '',
      next_action:     str(r['Mercury Z Entry Point'] || '').slice(0, 200),
      notes:           [str(r['Scale / Investment']), str(r['Mercury Z Entry Point'])].filter(Boolean).join(' | ').slice(0, 500),
      tier,
      hiring_evidence: str(r['Fiber Tech Roles Needed'] || ''),
      smtp_status: '', assigned_to: 'darren',
    });
  }
  await bulkUpsert(batch);
  console.log(`[DC Projects] Imported ${batch.length} rows`);
  return batch.length;
}

// ── Laura sheets ──────────────────────────────────────────────────────────────
const LAURA_SHEETS = ['CET Designers', 'Estimators', 'BIM Modelers', 'Sales Coordinators  PMs'];

async function importLaura() {
  let total = 0;
  for (const sheetName of LAURA_SHEETS) {
    console.log(`\n[Laura/${sheetName}] Reading...`);
    const rawRows = readSheet(LAURA_PATH, sheetName);
    if (!rawRows.length) { console.warn(`  No rows.`); continue; }
    const batch = [];
    for (const r of rawRows) {
      const email = str(r['Contact Email/LinkedIn'] || r['Contact Email'] || r['Email'] || '');
      const contactName = str(r['Contact Name'] || '');
      if (!email && !contactName) continue;
      batch.push({
        agent: 'laura',
        campaign:        sheetName.replace(/\s+/g, ' ').trim(),
        company:         str(r['Company Name'] || r['Company'] || ''),
        contact_name:    contactName,
        title:           str(r['Contact Title'] || r['Title'] || ''),
        email:           email || `no-email-laura-${sheetName}-${batch.length}@placeholder.local`,
        linkedin_url:    str(r['LinkedIn Profile'] || r['LinkedIn'] || ''),
        role:            str(r['Role Hiring For'] || r['Role'] || ''),
        location:        str(r['Location'] || ''),
        touch1:          str(r['Touch 1 Status'] || r['Touch 1'] || r['Date Sent'] || ''),
        touch2:          str(r['Touch 2 Status'] || r['Touch 2'] || r['Status'] || ''),
        touch3:          str(r['Touch 3 Status'] || r['Touch 3'] || r['Next Step Date'] || ''),
        touch4:          str(r['Touch 4 Status'] || r['Touch 4'] || ''),
        touch5:          '',
        response_status: str(r['Response Status'] || r['Response Summary'] || ''),
        response_date:   str(r['Response Date'] || ''),
        call_scheduled: '', next_action: '',
        notes:           str(r['Notes'] || ''),
        tier: '', hiring_evidence: '',
        smtp_status:     str(r['SMTP Status'] || r['Email Verified'] || ''),
        assigned_to:     'laura',
      });
    }
    await bulkUpsert(batch);
    console.log(`  [Laura/${sheetName}] Imported ${batch.length} rows`);
    total += batch.length;
  }
  return total;
}

async function main() {
  console.log('=== XLSX → Postgres Import ===');
  console.log('DWDM file:', existsSync(DWDM_PATH) ? '✓ found' : '✗ missing: ' + DWDM_PATH);
  console.log('Laura file:', existsSync(LAURA_PATH) ? '✓ found' : '✗ missing: ' + LAURA_PATH);

  try {
    await pool.query('SELECT 1');
    console.log('DB connected.');
  } catch (e) {
    console.error('DB connection failed:', e.message);
    console.error('Set PG_HOST/PG_USER/PG_PASSWORD/PG_DATABASE in api/.env and retry.');
    process.exit(1);
  }

  await addUniqueConstraint();

  const d  = await importDWDM();
  const b  = await importBEAD();
  const bw = await importBEADWinner();
  const dc = await importDCContacts();
  const dp = await importDCProjects();
  const l  = await importLaura();

  const r = await pool.query('SELECT agent, campaign, count(*) FROM contacts GROUP BY agent, campaign ORDER BY agent, campaign');
  console.log('\n=== Current contacts by agent/campaign ===');
  r.rows.forEach(row => console.log(`  ${row.agent.padEnd(10)} ${(row.campaign||'').padEnd(30)} ${row.count}`));
  console.log(`\nImported this run: ${d} DWDM + ${b} BEAD + ${bw} BEAD Winner + ${dc} DC Contacts + ${dp} DC Projects + ${l} Laura = ${d+b+bw+dc+dp+l}`);

  await pool.end();
}

main().catch(e => { console.error('Import failed:', e); process.exit(1); });
