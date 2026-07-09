import { useState, useEffect } from 'react';

const TOUCH_COLORS = ['#10B981', '#0EA5E9', '#8B5CF6', '#F59E0B'];

function apiFetch(path) {
  const token = localStorage.getItem('cc_auth_token') || localStorage.getItem('authToken') || '';
  return fetch(`/api${path}`, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });
}

function touchSent(v) { return !!(v && /sent|✓|yes/i.test(v)); }

function StatusBadge({ value }) {
  if (!value || value.trim() === '') return <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>—</span>;
  const v = value.toLowerCase();
  let color = 'rgba(255,255,255,0.4)';
  if (/warm|interest|yes|positive|call/i.test(value)) color = '#22C55E';
  else if (/not.*interest|decline|no thanks|unsubscr/i.test(value)) color = '#EF4444';
  else if (/sent|✓/i.test(value)) color = '#10B981';
  else if (/pending|follow/i.test(value)) color = '#F59E0B';
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 6,
      fontSize: 11, fontWeight: 600, background: `${color}18`, color, border: `1px solid ${color}40`,
      whiteSpace: 'nowrap', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis',
    }} title={value}>{value}</span>
  );
}

function TouchDot({ value, idx }) {
  const sent = touchSent(value);
  const color = TOUCH_COLORS[idx] || '#8B5CF6';
  return (
    <span title={value || 'Not sent'} style={{
      display: 'inline-block', width: 10, height: 10, borderRadius: '50%', margin: '0 2px',
      background: sent ? color : 'rgba(255,255,255,0.1)',
      border: `1px solid ${sent ? color : 'rgba(255,255,255,0.2)'}`,
      verticalAlign: 'middle',
    }} />
  );
}

export default function CampTab({ sheetTab, title, subtitle, accentColor = '#06E5EC', roleLabel = 'Role Hiring For' }) {
  const [rows, setRows]       = useState([]);
  const [headers, setHeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [search, setSearch]   = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    setLoading(true); setError(null);
    apiFetch(`/sheets/${encodeURIComponent(sheetTab)}`)
      .then(d => {
        const vals = d.values || [];
        if (vals.length < 2) { setRows([]); setHeaders([]); setLoading(false); return; }
        setHeaders(vals[0]);
        setRows(vals.slice(1));
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [sheetTab]);

  function colIdx(name) { return headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase())); }

  const iCompany  = colIdx('company');
  const iIndustry = colIdx('industry');
  const iRole     = headers.findIndex(h => h.toLowerCase().includes('role') || h.toLowerCase().includes('hiring'));
  const iName     = colIdx('contact name');
  const iTitle    = colIdx('title');
  const iEmail    = colIdx('email');
  const iLinkedin = colIdx('linkedin');
  const iT1       = colIdx('touch 1');
  const iT2       = colIdx('touch 2');
  const iT3       = colIdx('touch 3');
  const iT4       = colIdx('touch 4');
  const iReply    = colIdx('reply');
  const iStatus   = colIdx('status');
  const iNotes    = colIdx('notes');

  const touchCols = [iT1, iT2, iT3, iT4].filter(i => i >= 0);

  // Stats
  const total     = rows.length;
  const t1Sent    = rows.filter(r => iT1 >= 0 && touchSent(r[iT1])).length;
  const t2Sent    = rows.filter(r => iT2 >= 0 && touchSent(r[iT2])).length;
  const t3Sent    = rows.filter(r => iT3 >= 0 && touchSent(r[iT3])).length;
  const replied   = rows.filter(r => iReply >= 0 && r[iReply] && r[iReply].trim() !== '').length;

  // Filters
  const statuses = ['all', ...Array.from(new Set(rows.map(r => iStatus >= 0 ? r[iStatus] : '').filter(Boolean)))];
  const filtered = rows.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q || [iCompany, iName, iTitle, iIndustry, iRole]
      .filter(i => i >= 0)
      .some(i => (r[i] || '').toLowerCase().includes(q));
    const matchStatus = statusFilter === 'all' || (iStatus >= 0 && r[iStatus] === statusFilter);
    return matchSearch && matchStatus;
  });

  return (
    <div style={{ padding: '24px 28px' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: accentColor }}>{title}</h2>
        {subtitle && <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>{subtitle}</p>}
        <a href={`https://docs.google.com/spreadsheets/d/1WEIHITpnk_Ymrk6RTaKYzMK55vLnSViU4RKg5Py34WU`}
          target="_blank" rel="noreferrer"
          style={{ fontSize: 11, color: accentColor, opacity: 0.7, textDecoration: 'none', marginTop: 4, display: 'inline-block' }}>
          ↗ Open in Google Sheets
        </a>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        {[
          { label: 'Total Contacts', value: total, color: accentColor },
          { label: 'T1 Sent', value: t1Sent, color: TOUCH_COLORS[0] },
          { label: 'T2 Sent', value: t2Sent, color: TOUCH_COLORS[1] },
          { label: 'T3 Sent', value: t3Sent, color: TOUCH_COLORS[2] },
          { label: 'Replies', value: replied, color: '#22C55E' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            flex: '0 0 auto', padding: '12px 18px', borderRadius: 10,
            background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}30`,
            borderTop: `2px solid ${color}`, minWidth: 90, textAlign: 'center',
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 3 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search company, contact, industry…"
          style={{
            flex: '1 1 220px', minWidth: 160, padding: '7px 12px', borderRadius: 8, fontSize: 13,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
            color: '#e8eaff', outline: 'none',
          }}
        />
        {statuses.length > 1 && (
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{
            padding: '7px 10px', borderRadius: 8, fontSize: 12,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
            color: '#e8eaff', cursor: 'pointer',
          }}>
            {statuses.map(s => <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s}</option>)}
          </select>
        )}
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{filtered.length} of {total}</span>
      </div>

      {/* Table */}
      {loading && <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.4)' }}>Loading {title}…</div>}
      {error && <div style={{ padding: 16, color: '#EF4444' }}>Error: {error}</div>}
      {!loading && !error && (
        <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                {['Company', 'Industry', roleLabel, 'Contact', 'Title', 'Email', 'LinkedIn', 'Touches', 'Reply', 'Status', 'Notes'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: accentColor, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={11} style={{ padding: 24, textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>No results</td></tr>
              ) : filtered.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                  <td style={{ padding: '9px 12px', color: '#e8eaff', fontWeight: 600, whiteSpace: 'nowrap' }}>{r[iCompany] || '—'}</td>
                  <td style={{ padding: '9px 12px', color: 'rgba(255,255,255,0.55)', fontSize: 11, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{iIndustry >= 0 ? r[iIndustry] : '—'}</td>
                  <td style={{ padding: '9px 12px', color: accentColor, fontSize: 11, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{iRole >= 0 ? r[iRole] : '—'}</td>
                  <td style={{ padding: '9px 12px', color: '#e8eaff', whiteSpace: 'nowrap' }}>{iName >= 0 ? r[iName] : '—'}</td>
                  <td style={{ padding: '9px 12px', color: 'rgba(255,255,255,0.55)', fontSize: 11, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{iTitle >= 0 ? r[iTitle] : '—'}</td>
                  <td style={{ padding: '9px 12px', fontSize: 11 }}>
                    {iEmail >= 0 && r[iEmail] ? (
                      <a href={`mailto:${r[iEmail]}`} style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>{r[iEmail]}</a>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '9px 12px' }}>
                    {iLinkedin >= 0 && r[iLinkedin] ? (
                      <a href={r[iLinkedin]} target="_blank" rel="noreferrer" style={{ color: '#0077b5', fontSize: 11, textDecoration: 'none' }}>in ↗</a>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                    {touchCols.map((ti, idx) => <TouchDot key={idx} value={r[ti]} idx={idx} />)}
                  </td>
                  <td style={{ padding: '9px 12px' }}><StatusBadge value={iReply >= 0 ? r[iReply] : ''} /></td>
                  <td style={{ padding: '9px 12px' }}><StatusBadge value={iStatus >= 0 ? r[iStatus] : ''} /></td>
                  <td style={{ padding: '9px 12px', color: 'rgba(255,255,255,0.45)', fontSize: 11, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={iNotes >= 0 ? r[iNotes] : ''}>
                    {iNotes >= 0 ? r[iNotes] : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
