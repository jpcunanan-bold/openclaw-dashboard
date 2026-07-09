import { useState, useEffect, useRef } from 'react';
import { Chart, ArcElement, Tooltip, Legend, DoughnutController } from 'chart.js';
import { computeGroupStats, getInitials, sanitizeKey } from '../../utils/helpers';
import { PriorityDot, StatusBadge, DueDate, DomainTag } from '../TaskAtoms';

Chart.register(ArcElement, Tooltip, Legend, DoughnutController);

const GRADIENTS = [
  'linear-gradient(135deg,#7C3AED,#5B21B6)', 'linear-gradient(135deg,#10B981,#059669)',
  'linear-gradient(135deg,#F59E0B,#D97706)', 'linear-gradient(135deg,#3B82F6,#2563EB)',
  'linear-gradient(135deg,#14B8A6,#0D9488)', 'linear-gradient(135deg,#EC4899,#DB2777)',
];

function MiniStatusChart({ tasks }) {
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
    if (!data.length) return;
    chartRef.current = new Chart(canvasRef.current.getContext('2d'), {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderColor: '#161640', borderWidth: 2 }] },
      options: { responsive: true, maintainAspectRatio: true, cutout: '60%', plugins: { legend: { position: 'bottom', labels: { color: '#94A3B8', font: { family: 'Inter', size: 10 }, padding: 8, usePointStyle: true } }, tooltip: { backgroundColor: '#1C1C50', titleColor: '#F1F5F9', bodyColor: '#94A3B8', cornerRadius: 6 } } },
    });
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [tasks]);
  return <div className="chart-container-sm"><canvas ref={canvasRef} /></div>;
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 0' }}>
      {['Critical', 'High', 'Medium', 'Low'].map((k) => {
        const pct = Math.round((counts[k] / max) * 100);
        return (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 56, fontSize: 11, fontWeight: 600, color: colors[k], textAlign: 'right' }}>{k}</span>
            <div style={{ flex: 1, height: 18, background: 'rgba(255,255,255,0.04)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: colors[k], borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6, fontSize: 11, fontWeight: 700, transition: 'width 1s ease' }}>{counts[k]}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MemberTable({ tasks }) {
  const [expandedIdx, setExpandedIdx] = useState(null);
  if (!tasks.length) return <div className="empty-state">No tasks assigned.</div>;
  return (
    <table>
      <thead><tr><th>Priority</th><th>ID</th><th>Task</th><th>Status</th><th>Due</th><th>Domain</th></tr></thead>
      <tbody>
        {tasks.map((t, i) => (
          <>
            <tr key={t.id} className="task-row" onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}>
              <td><PriorityDot priority={t.priorityRaw || t.priority} /></td>
              <td className="task-id">{t.id || '—'}</td>
              <td style={{ fontWeight: 600 }}>{t.name || '—'}</td>
              <td><StatusBadge status={t.statusRaw || t.status} /></td>
              <td><DueDate dateStr={t.dueDate} /></td>
              <td><DomainTag domain={t.domain} /></td>
            </tr>
            {expandedIdx === i && (
              <tr key={`d-${i}`} className="detail-row visible">
                <td colSpan={6}>
                  <div className="detail-panel">
                    <div className="detail-grid">
                      <div className="detail-field"><div className="detail-label">Status</div><div className="detail-value">{t.statusRaw || t.status}</div></div>
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

export default function TeamTab({ byOwner }) {
  const owners = Object.keys(byOwner).filter((o) => (byOwner[o] || []).length > 0)
    .sort((a, b) => (byOwner[b] || []).length - (byOwner[a] || []).length);
  const [activeOwner, setActiveOwner] = useState(owners[0] || '');

  if (!owners.length) return <div className="tab-content active"><div className="empty-state">No team data.</div></div>;

  const tasks = byOwner[activeOwner] || [];
  const stats = computeGroupStats(tasks);
  const idx = owners.indexOf(activeOwner);
  const gradient = GRADIENTS[idx % GRADIENTS.length];
  const domains = [...new Set(tasks.map((t) => t.domain).filter(Boolean))].slice(0, 3);
  const role = domains.join(' · ') || 'Team Member';
  const completionPct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

  return (
    <div className="tab-content active">
      <div className="section-title">View by Team Member</div>
      <div className="sub-tab-nav">
        {owners.map((owner) => (
          <button key={owner} className={`sub-tab-btn${activeOwner === owner ? ' active' : ''}`}
            onClick={() => setActiveOwner(owner)}>
            {owner} <span className="tab-count">{(byOwner[owner] || []).length}</span>
          </button>
        ))}
      </div>
      <div className="sub-content active">
        <div className="member-card">
          <div className="member-header">
            <div className="member-avatar" style={{ background: gradient }}>{getInitials(activeOwner)}</div>
            <div>
              <div className="member-info-name">{activeOwner}</div>
              <div className="member-info-role">{role}</div>
            </div>
          </div>
          <div className="member-stats">
            <div className="member-stat-card"><div className="member-stat-val" style={{ color: 'var(--purple-light)' }}>{stats.total}</div><div className="member-stat-label">Total</div></div>
            <div className="member-stat-card"><div className="member-stat-val" style={{ color: 'var(--blue)' }}>{stats.active}</div><div className="member-stat-label">Active</div></div>
            <div className="member-stat-card"><div className="member-stat-val" style={{ color: 'var(--green)' }}>{stats.done}</div><div className="member-stat-label">Done</div></div>
            <div className="member-stat-card"><div className="member-stat-val" style={{ color: stats.overdue > 0 ? 'var(--red)' : 'var(--text-muted)' }}>{stats.overdue}</div><div className="member-stat-label">Overdue</div></div>
          </div>
          <div className="member-charts">
            <div className="member-chart-card">
              <div className="member-chart-title">Status Distribution</div>
              <MiniStatusChart tasks={tasks} />
            </div>
            <div className="member-chart-card">
              <div className="member-chart-title">Priority Breakdown</div>
              <PriorityBars tasks={tasks} />
            </div>
          </div>
          <div style={{ textAlign: 'center', marginBottom: 16, padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 10 }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Completion Rate: </span>
            <span style={{ fontSize: 20, fontWeight: 800, color: completionPct >= 50 ? 'var(--green)' : 'var(--orange)' }}>{completionPct}%</span>
          </div>
          <div className="tasks-table-wrap"><MemberTable tasks={tasks} /></div>
        </div>
      </div>
    </div>
  );
}
