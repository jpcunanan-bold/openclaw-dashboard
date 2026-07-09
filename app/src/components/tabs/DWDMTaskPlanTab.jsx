import { useState, useEffect } from 'react';

const DARREN_COLOR = '#F59E0B';

const STATUS_STYLE = {
  'DONE':        { bg: 'rgba(16,185,129,0.15)', color: '#34d399', border: 'rgba(16,185,129,0.3)',  icon: '✅' },
  'IN PROGRESS': { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: 'rgba(245,158,11,0.3)',  icon: '🔄' },
  'TODO':        { bg: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)', border: 'rgba(255,255,255,0.12)', icon: '⬜' },
  'BLOCKED':     { bg: 'rgba(239,68,68,0.15)',  color: '#f87171', border: 'rgba(239,68,68,0.3)',   icon: '🔴' },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status?.toUpperCase()] || STATUS_STYLE['TODO'];
  return (
    <span style={{
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      borderRadius: 6, padding: '3px 9px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
    }}>{s.icon} {status || 'TODO'}</span>
  );
}

const WORKSTREAM_COLOR = {
  'Outreach':   '#60a5fa',
  'Enrichment': '#a78bfa',
  'Prospecting':'#34d399',
  'Ops/Tracking':'#f9a8d4',
  'Reporting':  '#fbbf24',
};

function WorkstreamDot({ ws }) {
  const color = WORKSTREAM_COLOR[ws] || '#94a3b8';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block' }} />
      <span style={{ fontSize: 11, color, fontWeight: 600 }}>{ws}</span>
    </span>
  );
}

export default function DWDMTaskPlanTab() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('ALL');
  const [wsFilter, setWsFilter] = useState('ALL');

  useEffect(() => {
    const token = localStorage.getItem('cc_auth_token') || localStorage.getItem('authToken') || '';
    fetch('/api/darren/dwdm-taskplan', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setTasks(d.taskPlan || []); setLoading(false); setError(null); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  const statuses = ['ALL', 'DONE', 'IN PROGRESS', 'TODO', 'BLOCKED'];
  const workstreams = ['ALL', ...new Set(tasks.map(t => t['Workstream']).filter(Boolean))];

  const filtered = tasks.filter(t => {
    const s = (t['Status'] || '').toUpperCase();
    const w = t['Workstream'] || '';
    return (filter === 'ALL' || s === filter) && (wsFilter === 'ALL' || w === wsFilter);
  });

  // Summary counts
  const counts = {};
  for (const t of tasks) {
    const s = (t['Status'] || 'TODO').toUpperCase();
    counts[s] = (counts[s] || 0) + 1;
  }

  // Total cost
  const totalCost = tasks.reduce((sum, t) => {
    const c = parseFloat((t['Cost'] || '').replace(/[^0-9.]/g, '')) || 0;
    return sum + c;
  }, 0);

  return (
    <div style={{ padding: '24px 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: DARREN_COLOR }}>📋 DWDM Task Plan</h2>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>Weekly execution tracker</div>
        </div>

        {!loading && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(STATUS_STYLE).map(([key, s]) => (
              counts[key] ? (
                <div key={key} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 8, padding: '6px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 17, fontWeight: 800, color: s.color }}>{counts[key]}</div>
                  <div style={{ fontSize: 10, color: s.color, opacity: 0.75, textTransform: 'uppercase', letterSpacing: 0.8 }}>{key}</div>
                </div>
              ) : null
            ))}
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: DARREN_COLOR }}>${totalCost.toFixed(2)}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Total Cost</div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div style={{ color: '#EF4444', padding: '32px', textAlign: 'center', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, marginBottom: 20 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Filters */}
      {!loading && tasks.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 5 }}>
            {statuses.map(s => (
              <button key={s} onClick={() => setFilter(s)} style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                background: filter === s ? 'rgba(245,158,11,0.15)' : 'transparent',
                border: filter === s ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(255,255,255,0.08)',
                color: filter === s ? DARREN_COLOR : 'rgba(255,255,255,0.45)',
              }}>{s}</button>
            ))}
          </div>
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ display: 'flex', gap: 5 }}>
            {workstreams.map(w => (
              <button key={w} onClick={() => setWsFilter(w)} style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                background: wsFilter === w ? 'rgba(255,255,255,0.08)' : 'transparent',
                border: wsFilter === w ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.06)',
                color: wsFilter === w ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.4)',
              }}>{w}</button>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', padding: 40 }}>Loading task plan…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', padding: 40 }}>No tasks match the current filter.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                {['Week', 'Day', 'Workstream', 'Task', 'Target / Output', 'Owner', 'Approval', 'Status', 'Cost', 'Notes'].map(h => (
                  <th key={h} style={{
                    padding: '9px 12px', textAlign: 'left', color: 'rgba(255,255,255,0.4)',
                    fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8,
                    whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => (
                <tr key={i} style={{
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                }}>
                  <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap', fontSize: 12 }}>{t['Week']}</td>
                  <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap', fontSize: 12 }}>{t['Day']}</td>
                  <td style={{ padding: '10px 12px' }}><WorkstreamDot ws={t['Workstream']} /></td>
                  <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.85)', maxWidth: 280 }}>{t['Task']}</td>
                  <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.55)', maxWidth: 180, fontSize: 12 }}>{t['Target / Output']}</td>
                  <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.55)', whiteSpace: 'nowrap', fontSize: 12 }}>{t['Owner']}</td>
                  <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>{t['Approval (Yes/No)']}</td>
                  <td style={{ padding: '10px 12px' }}><StatusBadge status={t['Status']} /></td>
                  <td style={{ padding: '10px 12px', color: DARREN_COLOR, fontWeight: 600, whiteSpace: 'nowrap', fontSize: 12 }}>{t['Cost']}</td>
                  <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.4)', fontSize: 11, maxWidth: 200 }}>{t['Notes']}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
