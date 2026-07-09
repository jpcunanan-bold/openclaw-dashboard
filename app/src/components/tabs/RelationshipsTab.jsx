import { useState, useEffect, useRef } from 'react';
import { Chart, ArcElement, Tooltip, Legend, DoughnutController } from 'chart.js';

Chart.register(ArcElement, Tooltip, Legend, DoughnutController);

const CIRCLE_ORDER = ['Inner 4', 'Growing', 'Close Family', 'Close 15', 'Close 15 (rising)', 'Active', 'Active Family', 'Active 50', 'Extended', 'Extended / Complicated', 'Extended / At Risk', 'Complicated / At Risk', 'Aspirational'];

function SummaryCards({ rows }) {
  const green = rows.filter((r) => (r.health || '').includes('🟢')).length;
  const yellow = rows.filter((r) => (r.health || '').includes('🟡')).length;
  const red = rows.filter((r) => (r.health || '').includes('🔴') || (r.health || '').includes('⚠️')).length;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
      <div className="card" style={{ textAlign: 'center', padding: 16 }}><div style={{ fontSize: 28, fontWeight: 700, color: 'var(--purple)' }}>{rows.length}</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Contacts</div></div>
      <div className="card" style={{ textAlign: 'center', padding: 16 }}><div style={{ fontSize: 28, fontWeight: 700, color: '#22c55e' }}>🟢 {green}</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Strong</div></div>
      <div className="card" style={{ textAlign: 'center', padding: 16 }}><div style={{ fontSize: 28, fontWeight: 700, color: '#f59e0b' }}>🟡 {yellow}</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cooling / Warming</div></div>
      <div className="card" style={{ textAlign: 'center', padding: 16 }}><div style={{ fontSize: 28, fontWeight: 700, color: '#ef4444' }}>🔴 {red}</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>At Risk</div></div>
    </div>
  );
}

function DoughnutChart({ id, data, labels, colors }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    const filtered = data.map((v, i) => ({ v, l: labels[i], c: colors[i] })).filter((x) => x.v > 0);
    if (!filtered.length) return;
    chartRef.current = new Chart(canvasRef.current.getContext('2d'), {
      type: 'doughnut',
      data: { labels: filtered.map((x) => x.l), datasets: [{ data: filtered.map((x) => x.v), backgroundColor: filtered.map((x) => x.c), borderColor: '#161640', borderWidth: 2 }] },
      options: { responsive: true, maintainAspectRatio: true, cutout: '60%', plugins: { legend: { position: 'bottom', labels: { color: '#94A3B8', font: { family: 'Inter', size: 10 }, padding: 8, usePointStyle: true } }, tooltip: { backgroundColor: '#1C1C50', titleColor: '#F1F5F9', bodyColor: '#94A3B8', cornerRadius: 6 } } },
    });
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [data, labels, colors]);
  return <div className="chart-container"><canvas ref={canvasRef} /></div>;
}

function RelTable({ rows }) {
  if (!rows.length) return <div className="empty-state">No contacts in this view.</div>;
  const circles = {};
  rows.forEach((r) => { const c = r.circle || 'Other'; if (!circles[c]) circles[c] = []; circles[c].push(r); });
  const allCircles = [...CIRCLE_ORDER, ...Object.keys(circles).filter((c) => !CIRCLE_ORDER.includes(c))];

  return (
    <>
      {allCircles.filter((cn) => circles[cn]).map((cn) => {
        const group = circles[cn];
        return (
          <div key={cn} className="card" style={{ marginBottom: 16 }}>
            <div className="card-title"><span className="icon">❤️</span> {cn} ({group.length})</div>
            <table>
              <thead><tr><th>Name</th><th>Domain</th><th>Role</th><th>Health</th><th>Last Touch</th><th>Nurture</th><th>Key Details</th></tr></thead>
              <tbody>
                {group.map((r, i) => {
                  let hc = '';
                  if ((r.health || '').includes('🟢')) hc = '#22c55e';
                  else if ((r.health || '').includes('🟡')) hc = '#f59e0b';
                  else if ((r.health || '').includes('🔴') || (r.health || '').includes('⚠️')) hc = '#ef4444';
                  return (
                    <tr key={i}>
                      <td><strong>{r.preferredName || r.name}</strong>{r.birthday && <><br /><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>🎂 {r.birthday}</span></>}</td>
                      <td>{r.domain || ''}</td>
                      <td>{r.role || ''}</td>
                      <td style={{ color: hc }}>{r.health || ''}</td>
                      <td style={{ fontSize: 12 }}>{r.lastTouchpoint || ''}</td>
                      <td style={{ fontSize: 12 }}>{r.nurtureStatus || ''}</td>
                      <td style={{ fontSize: 12, maxWidth: 250 }}>{r.keyDetails || ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </>
  );
}

function ActionsPanel({ rows }) {
  if (!rows.length) return <div className="empty-state">No open commitments.</div>;
  return (
    <>
      <div className="section-title">Open Commitments &amp; Next Actions</div>
      {rows.map((r, i) => {
        let borderColor = '#ef4444';
        if ((r.health || '').includes('🟢')) borderColor = '#22c55e';
        else if ((r.health || '').includes('🟡')) borderColor = '#f59e0b';
        return (
          <div key={i} className="card" style={{ marginBottom: 12, padding: 16, borderLeft: `3px solid ${borderColor}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <strong style={{ fontSize: 15 }}>{r.preferredName || r.name}</strong>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.domain || ''} · {r.circle || ''}</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 6 }}>📋 {r.openCommitments}</div>
            {r.lastTouchpoint && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Last touch: {r.lastTouchpoint}</div>}
          </div>
        );
      })}
    </>
  );
}

export default function RelationshipsTab({ relationships }) {
  const [activeTab, setActiveTab] = useState('all');
  const rows = relationships || [];

  if (!rows.length) return <div className="tab-content active"><div className="empty-state">No relationship data found.</div></div>;

  const personal = rows.filter((r) => (r.domain || '').toLowerCase().includes('personal'));
  const business = rows.filter((r) => { const d = (r.domain || '').toLowerCase(); return d.includes('bold') || d.includes('business') || d.includes('mercury'); });
  const atRisk = rows.filter((r) => { const h = r.health || ''; return h.includes('🔴') || h.includes('⚠️') || h.includes('🟡'); });
  const withActions = rows.filter((r) => r.openCommitments && r.openCommitments.trim());

  const views = { all: rows, personal, business, atrisk: atRisk, actions: withActions };
  const current = views[activeTab] || rows;

  // Health chart data
  const green = rows.filter((r) => (r.health || '').includes('🟢')).length;
  const yellow = rows.filter((r) => (r.health || '').includes('🟡')).length;
  const red = rows.filter((r) => (r.health || '').includes('🔴') || (r.health || '').includes('⚠️')).length;
  const other = rows.length - green - yellow - red;

  // Domain chart data
  const domainCounts = {};
  rows.forEach((r) => { const d = r.domain || 'Unknown'; domainCounts[d] = (domainCounts[d] || 0) + 1; });
  const domainLabels = Object.keys(domainCounts);
  const domainData = domainLabels.map((k) => domainCounts[k]);
  const domainColors = ['#7C3AED', '#14B8A6', '#10B981', '#F59E0B', '#3B82F6', '#EC4899', '#EAB308', '#6B7280'];

  return (
    <div className="tab-content active">
      <div className="section-title">Relationship Performance — Bold Life Framework</div>
      <div className="sub-tab-nav">
        {[
          { id: 'all', label: `All (${rows.length})` },
          { id: 'personal', label: `🏠 Personal (${personal.length})` },
          { id: 'business', label: `💼 Business (${business.length})` },
          { id: 'atrisk', label: `⚠️ Needs Attention (${atRisk.length})` },
          { id: 'actions', label: `📋 Open Actions (${withActions.length})` },
        ].map((t) => (
          <button key={t.id} className={`sub-tab-btn${activeTab === t.id ? ' active' : ''}`} onClick={() => setActiveTab(t.id)}>{t.label}</button>
        ))}
      </div>
      {activeTab === 'all' && (
        <>
          <SummaryCards rows={current} />
          <div className="two-col" style={{ marginBottom: 20 }}>
            <div className="card"><div className="card-title"><span className="icon">💚</span> Health Distribution</div><DoughnutChart id="rel-health" data={[green, yellow, red, other]} labels={['Strong 🟢', 'Cooling/Warming 🟡', 'At Risk 🔴', 'Unknown']} colors={['#22c55e', '#f59e0b', '#ef4444', '#6B7280']} /></div>
            <div className="card"><div className="card-title"><span className="icon">🏢</span> Domain Breakdown</div><DoughnutChart id="rel-domain" data={domainData} labels={domainLabels} colors={domainColors} /></div>
          </div>
        </>
      )}
      {activeTab !== 'all' && activeTab !== 'actions' && <SummaryCards rows={current} />}
      {activeTab === 'actions' ? <ActionsPanel rows={current} /> : <RelTable rows={current} />}
    </div>
  );
}
