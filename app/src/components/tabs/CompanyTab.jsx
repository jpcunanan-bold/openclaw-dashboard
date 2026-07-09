import { useState, useEffect, useRef } from 'react';
import { Chart, ArcElement, Tooltip, Legend, DoughnutController } from 'chart.js';
import { computeGroupStats } from '../../utils/helpers';
import { PriorityDot, StatusBadge, DueDate } from '../TaskAtoms';

Chart.register(ArcElement, Tooltip, Legend, DoughnutController);

const COMPANIES = [
  { key: 'bold', match: ['bold'], icon: '💼', label: 'Bold Business', color: 'var(--purple-light)', chartColor: '#7C3AED' },
  { key: 'mercury', match: ['mercury'], icon: '🔋', label: 'Mercury Z', color: 'var(--teal)', chartColor: '#14B8A6' },
  { key: 'personal', match: ['personal'], icon: '🏠', label: 'Personal', color: 'var(--green)', chartColor: '#10B981' },
  { key: 'pr', match: ['pr', 'kopko', 'laura'], icon: '📰', label: 'EdKopko.com PR', color: 'var(--orange)', chartColor: '#F59E0B' },
];

function MiniStatusChart({ id, tasks }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    const counts = { 'In Progress': 0, 'Pending': 0, 'Done': 0, 'Other': 0 };
    tasks.forEach((t) => {
      const s = (t.statusRaw || t.status || '').toLowerCase();
      if (s.includes('in progress')) counts['In Progress']++;
      else if (s.includes('pending')) counts['Pending']++;
      else if (s.includes('done') || s.includes('complete')) counts['Done']++;
      else counts['Other']++;
    });
    const palette = { 'In Progress': '#3B82F6', 'Pending': '#F59E0B', 'Done': '#10B981', 'Other': '#6B7280' };
    const labels = [], data = [], colors = [];
    Object.keys(counts).forEach((k) => { if (counts[k] > 0) { labels.push(k); data.push(counts[k]); colors.push(palette[k]); } });
    if (data.length === 0) return;
    chartRef.current = new Chart(canvasRef.current.getContext('2d'), {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderColor: '#161640', borderWidth: 2 }] },
      options: {
        responsive: true, maintainAspectRatio: true, cutout: '60%',
        plugins: {
          legend: { position: 'bottom', labels: { color: '#94A3B8', font: { family: 'Inter', size: 10 }, padding: 8, usePointStyle: true } },
          tooltip: { backgroundColor: '#1C1C50', titleColor: '#F1F5F9', bodyColor: '#94A3B8', cornerRadius: 6 },
        },
      },
    });
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [tasks]);

  return <div className="chart-container"><canvas ref={canvasRef} /></div>;
}

function PriorityBars({ tasks }) {
  const counts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  const colors = { Critical: 'var(--red)', High: 'var(--orange)', Medium: 'var(--blue)', Low: 'var(--gray)' };
  tasks.forEach((t) => {
    const p = (t.priorityRaw || t.priority || '').toLowerCase();
    if (p.includes('critical')) counts.Critical++;
    else if (p.includes('high')) counts.High++;
    else if (p.includes('medium')) counts.Medium++;
    else counts.Low++;
  });
  const max = Math.max(...Object.values(counts), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '10px 0' }}>
      {['Critical', 'High', 'Medium', 'Low'].map((k) => {
        const pct = Math.round((counts[k] / max) * 100);
        return (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 60, fontSize: 11, fontWeight: 600, color: colors[k], textAlign: 'right' }}>{k}</span>
            <div style={{ flex: 1, height: 20, background: 'rgba(255,255,255,0.04)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: colors[k], borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8, fontSize: 11, fontWeight: 700, transition: 'width 1s ease' }}>
                {counts[k]}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatCard({ val, label, color }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: 16 }}>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{val}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
    </div>
  );
}

function CompanyTable({ tasks }) {
  const [expandedIdx, setExpandedIdx] = useState(null);
  if (!tasks.length) return <div className="empty-state">No tasks for this company.</div>;
  return (
    <table>
      <thead>
        <tr><th>Priority</th><th>ID</th><th>Task</th><th>Owner</th><th>Status</th><th>Due</th></tr>
      </thead>
      <tbody>
        {tasks.map((t, i) => (
          <>
            <tr key={t.id} className="task-row" onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}>
              <td><PriorityDot priority={t.priorityRaw || t.priority} /></td>
              <td className="task-id">{t.id || '—'}</td>
              <td style={{ fontWeight: 600 }}>{t.name || '—'}</td>
              <td>{t.owner || '—'}</td>
              <td><StatusBadge status={t.statusRaw || t.status} /></td>
              <td><DueDate dateStr={t.dueDate} /></td>
            </tr>
            {expandedIdx === i && (
              <tr key={`det-${t.id}`} className="detail-row visible">
                <td colSpan={6}>
                  <div className="detail-panel">
                    <div className="detail-grid">
                      <div className="detail-field"><div className="detail-label">Domain</div><div className="detail-value">{t.domain}</div></div>
                      <div className="detail-field"><div className="detail-label">Owner</div><div className="detail-value">{t.owner}</div></div>
                      {t.notes && <><div className="detail-divider" /><div className="detail-field detail-full"><div className="detail-label">Notes</div><div className="detail-value notes-full">{t.notes}</div></div></>}
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </>
        ))}
      </tbody>
    </table>
  );
}

export default function CompanyTab({ tasks }) {
  const [activeCompany, setActiveCompany] = useState('bold');

  return (
    <div className="tab-content active">
      <div className="section-title">View by Company</div>
      <div className="sub-tab-nav">
        {COMPANIES.map((co) => {
          const coTasks = tasks.filter((t) => {
            const d = (t.domain || '').toLowerCase();
            return co.match.some((m) => d.includes(m));
          });
          return (
            <button key={co.key} className={`sub-tab-btn${activeCompany === co.key ? ' active' : ''}`}
              onClick={() => setActiveCompany(co.key)}>
              {co.icon} {co.label} <span className="tab-count">{coTasks.length}</span>
            </button>
          );
        })}
      </div>
      {COMPANIES.filter((co) => co.key === activeCompany).map((co) => {
        const coTasks = tasks.filter((t) => {
          const d = (t.domain || '').toLowerCase();
          return co.match.some((m) => d.includes(m));
        });
        const stats = computeGroupStats(coTasks);
        return (
          <div key={co.key} className="sub-content active">
            <div className="company-header">
              <div className="company-icon">{co.icon}</div>
              <div>
                <div className="company-name" style={{ color: co.color }}>{co.label}</div>
                <div className="company-stat">
                  {stats.total} tasks · {stats.active} active · {stats.done} done{stats.overdue > 0 ? ` · ${stats.overdue} overdue` : ''}
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
              <StatCard val={stats.total} label="Total" color="var(--purple-light)" />
              <StatCard val={stats.active} label="Active" color="var(--blue)" />
              <StatCard val={stats.done} label="Done" color="var(--green)" />
              <StatCard val={stats.overdue} label="Overdue" color={stats.overdue > 0 ? 'var(--red)' : 'var(--text-muted)'} />
            </div>
            <div className="two-col" style={{ marginBottom: 20 }}>
              <div className="card">
                <div className="card-title"><span className="icon">📊</span> Status Breakdown</div>
                <MiniStatusChart id={`co-${co.key}`} tasks={coTasks} />
              </div>
              <div className="card">
                <div className="card-title"><span className="icon">📋</span> Priority Mix</div>
                <PriorityBars tasks={coTasks} />
              </div>
            </div>
            <div className="tasks-table-wrap"><CompanyTable tasks={coTasks} /></div>
          </div>
        );
      })}
    </div>
  );
}
