import { useState, useEffect, useCallback } from 'react';
import { authHeaders } from '../LoginGate';

const CAMILLA_COLOR = '#eab308';

const ROLE_TABS = [
  'TX Licensed Architect',
  'Bookkeepers',
  'CET Designers',
  'HR Generalist',
  'Specifiers',
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function feedbackColor(feedback) {
  const f = (feedback || '').toLowerCase();
  if (f.includes('solid lead') || f.includes('good lead') || f.includes('excellent') || f.includes('perfect') || f.includes('strong')) return '#10B981';
  if (f.includes('reject') || f.includes('not based') || f.includes('negative') || f.includes('fully negative')) return '#EF4444';
  if (f.includes('needs verification') || f.includes('pending') || f.includes('need')) return '#F59E0B';
  if (f.includes('keep')) return '#3B82F6';
  return '#64748B';
}

function completedColor(completed) {
  const c = (completed || '').toLowerCase();
  if (c.includes('completed')) return '#10B981';
  if (c.includes('pending'))   return '#F59E0B';
  if (c.includes('skipped'))   return '#64748B';
  return '#94A3B8';
}

function priorityColor(priority) {
  const p = (priority || '').toLowerCase();
  if (p === 'high')   return '#EF4444';
  if (p === 'medium') return '#F59E0B';
  if (p === 'low')    return '#10B981';
  return '#64748B';
}

function taskStatusColor(status) {
  const s = (status || '').toLowerCase();
  if (s.includes('active') || s.includes('progress')) return '#10B981';
  if (s.includes('waiting') || s.includes('hold'))    return '#F59E0B';
  if (s.includes('needs') || s.includes('restart'))   return '#EF4444';
  return '#94A3B8';
}

// ── Dashboard Summary ─────────────────────────────────────────────────────────
function DashboardSummary() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    fetch('/api/camilla/candidates/dashboard', { headers: authHeaders() })
      .then(r => r.ok ? r.json() : r.json().then(e => { throw new Error(e.error); }))
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading dashboard…</div>;
  if (error)   return <div style={{ textAlign: 'center', padding: 20, color: '#EF4444', fontSize: 12 }}>Error: {error}</div>;
  if (!data)   return null;

  const { summary, pipeline, tasks } = data;

  return (
    <div>
      {/* ── Stats strip ── */}
      <div style={{
        display: 'flex', gap: 0, borderRadius: 10, overflow: 'hidden',
        border: `1px solid ${CAMILLA_COLOR}30`, marginBottom: 20,
        background: `${CAMILLA_COLOR}06`,
      }}>
        {[
          { label: 'Last Refreshed',  value: summary.lastRefreshed  || '—' },
          { label: 'Active Roles',    value: summary.activeRoles    || '—' },
          { label: 'Total Approved',  value: summary.totalApproved  || '—' },
          { label: 'Reached Out',     value: summary.reachedOut     || '—' },
        ].map(({ label, value }, i) => (
          <div key={label} style={{
            flex: 1, textAlign: 'center', padding: '14px 10px',
            borderRight: i < 3 ? `1px solid ${CAMILLA_COLOR}20` : 'none',
          }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: CAMILLA_COLOR, lineHeight: 1.1 }}>{value}</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── Role Pipeline Summary ── */}
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
        Role Pipeline Summary
      </div>
      <div style={{ overflowX: 'auto', marginBottom: 24 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {['Role', 'Sourced', 'Approved', 'Reached Out', 'Task Status', 'Notes'].map(h => (
                <th key={h} style={{
                  padding: '7px 12px', textAlign: h === 'Role' || h === 'Notes' ? 'left' : 'center',
                  fontSize: 9, fontWeight: 700, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pipeline.map((r, i) => {
              const statusColor = taskStatusColor(r.taskStatus);
              return (
                <tr key={r.role + i} style={{ background: i % 2 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 700, color: CAMILLA_COLOR }}>{r.role}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600 }}>{r.totalSourced}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600 }}>{r.approved}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600 }}>{r.reachedOut}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                      background: `${statusColor}12`, border: `1px solid ${statusColor}30`, color: statusColor,
                      whiteSpace: 'nowrap',
                    }}>
                      {r.taskStatus || '—'}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: 11, maxWidth: 260 }}>
                    <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.notes}>
                      {r.notes || '—'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Task Tracker ── */}
      {tasks.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            Current Task Tracker
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {tasks.map((t, i) => {
              const pColor = priorityColor(t.priority);
              const sColor = taskStatusColor(t.status);
              return (
                <div key={i} style={{
                  padding: '12px 14px', borderRadius: 8,
                  border: `1px solid ${CAMILLA_COLOR}20`,
                  background: `${CAMILLA_COLOR}05`,
                  borderLeft: `3px solid ${pColor}`,
                }}>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{t.task}</div>
                      <div style={{ fontSize: 10, color: CAMILLA_COLOR, fontWeight: 600 }}>{t.role}</div>
                    </div>
                    <div style={{ minWidth: 130 }}>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 3 }}>STATUS</div>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                        background: `${sColor}12`, border: `1px solid ${sColor}30`, color: sColor,
                      }}>{t.status}</span>
                    </div>
                    <div style={{ minWidth: 80 }}>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 3 }}>PRIORITY</div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: pColor }}>{t.priority || '—'}</span>
                    </div>
                    <div style={{ minWidth: 80 }}>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 3 }}>REVIEWER</div>
                      <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{t.reviewer || '—'}</span>
                    </div>
                  </div>
                  {t.nextAction && (
                    <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-secondary)', paddingTop: 8, borderTop: `1px solid rgba(255,255,255,0.05)` }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 6 }}>Next:</span>
                      {t.nextAction}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── Candidate Table for a Role ────────────────────────────────────────────────
function CandidateTable({ roleName }) {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [search, setSearch]     = useState('');
  const [filter, setFilter]     = useState('all');
  const [selected, setSelected] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/camilla/candidates/role/${encodeURIComponent(roleName)}`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : r.json().then(e => { throw new Error(e.error); }))
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [roleName]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading candidates…</div>;
  if (error)   return (
    <div style={{ textAlign: 'center', padding: 20 }}>
      <div style={{ color: '#EF4444', fontSize: 12, marginBottom: 8 }}>Error: {error}</div>
      <button onClick={load} style={{ background: 'none', border: `1px solid ${CAMILLA_COLOR}40`, borderRadius: 8, color: CAMILLA_COLOR, padding: '5px 14px', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>Retry</button>
    </div>
  );
  if (!data) return null;

  const { candidates = [], total, headers = [] } = data;

  // Detect feedback column name (Bert feedback vs BK feedback)
  const feedbackField  = headers.find(h => h.toLowerCase().includes('feedback')) || 'Bert feedback';
  const completedField = headers.find(h => h.toLowerCase().includes('completed')) || 'Completed';
  const nameField      = 'Name';
  const linkedInField  = 'LinkedIn URL';
  const locationField  = 'Location';
  const emailField     = 'Email';
  const nextStepField  = 'Next Step';
  const sourcedField   = 'Sourced from';
  const dateField      = 'Date Sourced';

  // Filter
  const filtered = candidates.filter(c => {
    const text = `${c[nameField]||''} ${c[locationField]||''} ${c[emailField]||''} ${c[feedbackField]||''}`.toLowerCase();
    const matchesSearch = !search || text.includes(search.toLowerCase());
    const completed = (c[completedField] || '').toLowerCase();
    const feedback  = (c[feedbackField]  || '').toLowerCase();
    const matchesFilter =
      filter === 'all'       ? true :
      filter === 'completed' ? completed.includes('completed') :
      filter === 'pending'   ? (completed.includes('pending') || !completed.trim()) :
      filter === 'good'      ? (feedback.includes('solid') || feedback.includes('good lead') || feedback.includes('excellent') || feedback.includes('strong') || feedback.includes('perfect')) :
      filter === 'rejected'  ? (feedback.includes('reject') || feedback.includes('not based')) :
      true;
    return matchesSearch && matchesFilter;
  });

  // Stats
  const completedCount = candidates.filter(c => (c[completedField] || '').toLowerCase().includes('completed')).length;
  const pendingCount   = candidates.filter(c => { const comp = (c[completedField] || '').toLowerCase(); return comp.includes('pending') || !comp.trim(); }).length;
  const goodCount      = candidates.filter(c => { const f = (c[feedbackField] || '').toLowerCase(); return f.includes('solid') || f.includes('good lead') || f.includes('excellent') || f.includes('strong') || f.includes('perfect'); }).length;
  const rejectedCount  = candidates.filter(c => { const f = (c[feedbackField] || '').toLowerCase(); return f.includes('reject') || f.includes('not based'); }).length;

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {[
          { label: 'Total',     value: total,          color: CAMILLA_COLOR },
          { label: 'Completed', value: completedCount,  color: '#10B981' },
          { label: 'Pending',   value: pendingCount,    color: '#F59E0B' },
          { label: 'Good Match',value: goodCount,       color: '#3B82F6' },
          { label: 'Rejected',  value: rejectedCount,   color: '#EF4444' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            flex: 1, minWidth: 72, textAlign: 'center', padding: '10px 8px',
            borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}25`,
          }}>
            <div style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 3 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name, location, email…"
          style={{
            flex: 1, minWidth: 180, padding: '6px 12px', borderRadius: 8,
            background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
            color: 'var(--text-primary)', fontSize: 11,
          }}
        />
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {[
            { id: 'all',       label: 'All' },
            { id: 'completed', label: '✓ Completed' },
            { id: 'pending',   label: '⏳ Pending' },
            { id: 'good',      label: '👍 Good Match' },
            { id: 'rejected',  label: '✕ Rejected' },
          ].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{
              fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
              background: filter === f.id ? `${CAMILLA_COLOR}20` : 'transparent',
              border: filter === f.id ? `1px solid ${CAMILLA_COLOR}50` : '1px solid rgba(255,255,255,0.1)',
              color: filter === f.id ? CAMILLA_COLOR : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}>
              {f.label}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>{filtered.length} of {total}</span>
        <button onClick={load} style={{
          background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
          color: 'var(--text-muted)', fontSize: 11, padding: '4px 10px', cursor: 'pointer',
        }}>↻</button>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', maxHeight: 520, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              {[dateField, nameField, locationField, feedbackField, emailField, completedField, sourcedField].map(h => (
                <th key={h} style={{
                  padding: '7px 10px', textAlign: 'left',
                  fontSize: 9, fontWeight: 700, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  borderBottom: '1px solid var(--border)',
                  position: 'sticky', top: 0, background: 'var(--bg-card)', whiteSpace: 'nowrap',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 12 }}>
                  No candidates match the current filter
                </td>
              </tr>
            ) : filtered.map((c, i) => {
              const fbColor   = feedbackColor(c[feedbackField]);
              const compColor = completedColor(c[completedField]);
              const name      = c[nameField] || '—';
              const linkedIn  = c[linkedInField];
              return (
                <tr
                  key={i}
                  onClick={() => setSelected(selected?.i === i ? null : { ...c, i })}
                  style={{
                    background: selected?.i === i ? `${CAMILLA_COLOR}08` : i % 2 ? 'rgba(255,255,255,0.01)' : 'transparent',
                    cursor: 'pointer',
                    borderLeft: selected?.i === i ? `3px solid ${CAMILLA_COLOR}` : '3px solid transparent',
                  }}
                >
                  <td style={{ padding: '7px 10px', color: 'var(--text-muted)', fontSize: 10, whiteSpace: 'nowrap' }}>
                    {c[dateField] ? new Date(c[dateField]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                  </td>
                  <td style={{ padding: '7px 10px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                    {linkedIn ? (
                      <a href={linkedIn} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: CAMILLA_COLOR, textDecoration: 'none' }}>
                        {name} ↗
                      </a>
                    ) : name}
                  </td>
                  <td style={{ padding: '7px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{c[locationField] || '—'}</td>
                  <td style={{ padding: '7px 10px', maxWidth: 220 }}>
                    <span style={{
                      display: 'block', fontSize: 10, color: fbColor,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }} title={c[feedbackField]}>
                      {c[feedbackField] ? c[feedbackField].split('\n')[0] : '—'}
                    </span>
                  </td>
                  <td style={{ padding: '7px 10px', color: 'var(--text-muted)', fontSize: 10, whiteSpace: 'nowrap' }}>{c[emailField] || '—'}</td>
                  <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: compColor }}>{c[completedField] || '—'}</span>
                  </td>
                  <td style={{ padding: '7px 10px', color: 'var(--text-muted)', fontSize: 10, whiteSpace: 'nowrap' }}>{c[sourcedField] || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detail panel */}
      {selected && (
        <div style={{
          marginTop: 12, padding: 16, borderRadius: 10,
          border: `1px solid ${CAMILLA_COLOR}40`, background: `${CAMILLA_COLOR}06`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: CAMILLA_COLOR }}>{selected[nameField]}</span>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16 }}>✕</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {[
              { label: 'Location',  value: selected[locationField] },
              { label: 'Email',     value: selected[emailField] },
              { label: 'Completed', value: selected[completedField] },
              { label: 'Sourced',   value: selected[sourcedField] },
              { label: 'Next Step', value: selected[nextStepField] },
              { label: 'Date',      value: selected[dateField] },
            ].map(({ label, value }) => value ? (
              <div key={label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{value}</div>
              </div>
            ) : null)}
          </div>
          {selected[feedbackField] && (
            <div style={{ marginTop: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Bert Feedback</div>
              <div style={{ fontSize: 12, color: feedbackColor(selected[feedbackField]), lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{selected[feedbackField]}</div>
            </div>
          )}
          {selected[linkedInField] && (
            <div style={{ marginTop: 10 }}>
              <a href={selected[linkedInField]} target="_blank" rel="noreferrer" style={{
                display: 'inline-block', padding: '6px 14px', borderRadius: 20,
                background: `${CAMILLA_COLOR}15`, border: `1px solid ${CAMILLA_COLOR}40`,
                color: CAMILLA_COLOR, fontSize: 11, fontWeight: 700, textDecoration: 'none',
              }}>
                View LinkedIn Profile ↗
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// MAIN TAB
// ════════════════════════════════════════════════════════════════════════
export default function CamillaCandidatesTab() {
  const [activeTab, setActiveTab] = useState('__dashboard__');

  const tabList = [
    { id: '__dashboard__', label: '📊 Dashboard' },
    ...ROLE_TABS.map(r => ({ id: r, label: r })),
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: `${CAMILLA_COLOR}20`, border: `2px solid ${CAMILLA_COLOR}60`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 800, color: CAMILLA_COLOR,
          }}>C</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>BB Candidates — Camilla</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Bold Business · Recruitment Tracking · {ROLE_TABS.length} active role pipelines</div>
          </div>
          <a
            href="https://docs.google.com/spreadsheets/d/1dqHZ2iRqBbmE4Zi3jO83xWuLgkhLT6FweoDWU_Y-pAo/edit"
            target="_blank" rel="noreferrer"
            style={{
              marginLeft: 'auto', fontSize: 10, fontWeight: 700, padding: '4px 12px', borderRadius: 20,
              background: `${CAMILLA_COLOR}10`, border: `1px solid ${CAMILLA_COLOR}30`, color: CAMILLA_COLOR,
              textDecoration: 'none',
            }}
          >
            Open Spreadsheet ↗
          </a>
        </div>
      </div>

      {/* Role tab pills */}
      <div style={{
        display: 'flex', gap: 6, flexWrap: 'nowrap', overflowX: 'auto',
        marginBottom: 20, paddingBottom: 4, scrollbarWidth: 'none',
      }}>
        {tabList.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              fontSize: 11, fontWeight: 700, padding: '6px 14px', borderRadius: 20,
              cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s',
              background: activeTab === tab.id ? `${CAMILLA_COLOR}22` : 'rgba(255,255,255,0.04)',
              border: activeTab === tab.id ? `1px solid ${CAMILLA_COLOR}55` : '1px solid rgba(255,255,255,0.08)',
              color: activeTab === tab.id ? CAMILLA_COLOR : 'var(--text-muted)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="card">
        {activeTab === '__dashboard__' ? (
          <DashboardSummary />
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: CAMILLA_COLOR, display: 'inline-block' }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: CAMILLA_COLOR }}>{activeTab}</span>
            </div>
            <CandidateTable roleName={activeTab} />
          </>
        )}
      </div>
    </div>
  );
}
