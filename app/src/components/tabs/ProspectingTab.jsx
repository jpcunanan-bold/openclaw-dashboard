import { useState, useEffect } from 'react';

function parseLeadsFromHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const leads = [];
  let headers = [];
  const rows = doc.querySelectorAll('table tr');
  for (const row of rows) {
    const cells = [...row.querySelectorAll('th, td')].map(c => c.textContent.trim());
    if (!cells.length || cells.every(c => !c)) continue;
    if (row.querySelector('th') || (!headers.length && cells.length > 1)) {
      headers = cells.map(h => h.toLowerCase().replace(/[\s/]+/g, '_').replace(/[^a-z0-9_]/g, ''));
      continue;
    }
    const obj = {};
    headers.forEach((h, i) => { obj[h] = cells[i] || ''; });
    leads.push(obj);
  }
  return leads;
}

function csvExport(leads) {
  if (!leads.length) return;
  const keys = Object.keys(leads[0]);
  const rows = [keys.join(','), ...leads.map(l => keys.map(k => `"${(l[k]||'').replace(/"/g,'""')}"`).join(','))];
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'fiberconnect-2026.csv'; a.click();
  URL.revokeObjectURL(url);
}

export default function ProspectingTab() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [rawKeys, setRawKeys] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('cc_auth_token') || localStorage.getItem('authToken') || '';
    fetch('/api/fiber-connect-leads', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
      .then(html => {
        const parsed = parseLeadsFromHtml(html);
        setLeads(parsed);
        if (parsed.length) setRawKeys(Object.keys(parsed[0]));
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = search
    ? leads.filter(l => Object.values(l).some(v => v.toLowerCase().includes(search.toLowerCase())))
    : leads;

  const get = (l, ...keys) => { for (const k of keys) { if (l[k]) return l[k]; } return ''; };
  const getName  = l => get(l, 'name', 'full_name', 'first_name', 'attendee', 'contact_name', rawKeys[0]||'');
  const getEmail = l => get(l, 'email', 'contact_email', 'email_address', rawKeys.find(k=>k.includes('email'))||'');
  const getComp  = l => get(l, 'company', 'organization', 'company_name', 'employer', rawKeys.find(k=>k.includes('comp'))||'');
  const getTitle = l => get(l, 'title', 'job_title', 'role', 'position', rawKeys.find(k=>k.includes('title')||k.includes('role'))||'');

  return (
    <div className="tab-content active">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Fiber Connect 2026 — Prospects</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Scraped attendee list</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', fontSize: 12, width: 180 }} />
          {leads.length > 0 && (
            <button onClick={() => csvExport(filtered)}
              style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'rgba(6,229,236,0.1)', border: '1px solid #06E5EC40', color: '#06E5EC' }}>
              Export CSV
            </button>
          )}
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Loading leads…</div>}
      {error && (
        <div style={{ textAlign: 'center', padding: 30, color: '#EF4444' }}>
          {error}<br /><small style={{ color: 'var(--text-muted)' }}>Check that FiberConnect_2026_Leads.html exists at LEAD-GEN/</small>
        </div>
      )}
      {!loading && !error && (
        <>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
            {filtered.length} leads{search ? ' (filtered)' : ''}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {['Name','Email','Company','Title'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((l, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '7px 12px', color: 'var(--text-primary)', fontWeight: 600 }}>{getName(l) || '—'}</td>
                    <td style={{ padding: '7px 12px', fontSize: 11 }}>
                      {getEmail(l) ? <a href={`mailto:${getEmail(l)}`} style={{ color: '#3B82F6', textDecoration: 'none' }}>{getEmail(l)}</a> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ padding: '7px 12px', color: 'var(--text-secondary)' }}>{getComp(l) || '—'}</td>
                    <td style={{ padding: '7px 12px', color: 'var(--text-muted)', fontSize: 11 }}>{getTitle(l) || '—'}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No leads found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
