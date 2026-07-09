import { useState, useEffect } from 'react';
import { authHeaders } from './LoginGate';

const STATUS_COLOR = {
  completed:   '#10B981',
  in_progress: '#06E5EC',
  blocked:     '#EF4444',
  pending:     '#F59E0B',
};

function statusDot(status) {
  return (
    <span style={{
      width: 8, height: 8, borderRadius: '50%', display: 'inline-block', flexShrink: 0,
      background: STATUS_COLOR[status] || '#64748B',
      boxShadow: `0 0 4px ${STATUS_COLOR[status] || '#64748B'}60`,
    }} />
  );
}

function Badge({ label, color }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, textTransform: 'uppercase',
      letterSpacing: '0.05em', whiteSpace: 'nowrap',
      background: `${color}18`, border: `1px solid ${color}40`, color,
    }}>
      {label}
    </span>
  );
}

function TaskModal({ task, onClose }) {
  if (!task) return null;
  const color = STATUS_COLOR[task.status] || '#64748B';
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
        zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)', borderRadius: 16, maxWidth: 520, width: '100%',
          border: `1px solid var(--border)`,
          borderTop: `3px solid ${color}`,
          padding: 24,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', flex: 1, paddingRight: 12 }}>
            {task.title}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18, lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Status',   value: task.status || '—' },
            { label: 'Priority', value: task.priority || 'normal' },
            { label: 'Requested by', value: task.requested_by || task.requestedBy || '—' },
            { label: 'Assigned',     value: task.assignedAt ? new Date(task.assignedAt).toLocaleDateString() : '—' },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{value}</div>
            </div>
          ))}
        </div>

        {(task.description || task.rawMessage) && (
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Description</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{task.description || task.rawMessage}</div>
          </div>
        )}

        {task.costUsd > 0 && (
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>AI Cost</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#10B981' }}>${Number(task.costUsd).toFixed(4)}</div>
            </div>
            {task.totalTokens > 0 && (
              <div style={{ flex: 1, background: 'rgba(6,229,236,0.08)', border: '1px solid rgba(6,229,236,0.2)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Tokens</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#06E5EC' }}>{Number(task.totalTokens).toLocaleString()}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const TABS = ['Active', 'Completed', 'All'];

export default function TodoPanel() {
  const [tab, setTab]         = useState(0);
  const [tasks, setTasks]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const statusFilter = ['pending,in_progress,blocked', 'completed', 'all'][tab];

  useEffect(() => {
    setLoading(true);
    const param = statusFilter === 'all' ? '' : `&status=${encodeURIComponent(statusFilter)}`;
    fetch(`/api/abhi/tasks?agent=laura&days=60${param}&limit=40`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : { tasks: [] })
      .then(d => { setTasks(d.tasks || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [statusFilter]);

  const now = Date.now();
  const isOverdue = (task) => {
    if (task.status === 'completed') return false;
    const age = now - new Date(task.assignedAt || task.assigned_at || now).getTime();
    return age > 7 * 86_400_000; // > 7 days old with no completion
  };

  return (
    <>
      <div className="card" style={{ height: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            ✅ To-do
          </span>
          {tasks.length > 0 && (
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
              background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#34D399',
            }}>
              {tasks.length}
            </span>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setTab(i)} style={{
              fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
              background: i === tab ? 'rgba(6,229,236,0.15)' : 'transparent',
              border: i === tab ? '1px solid rgba(6,229,236,0.35)' : '1px solid rgba(255,255,255,0.1)',
              color: i === tab ? '#06E5EC' : 'var(--text-muted)',
              cursor: 'pointer', transition: 'all 0.15s',
            }}>
              {t}
            </button>
          ))}
        </div>

        {/* Task list */}
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: 16 }}>Loading…</div>
        ) : tasks.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: 16 }}>
            {tab === 0 ? 'No active tasks ✓' : 'No tasks found'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 340, overflowY: 'auto' }}>
            {tasks.map((task, i) => {
              const overdue = isOverdue(task);
              const status  = task.status || 'pending';
              const done    = status === 'completed';
              return (
                <button
                  key={task.id || i}
                  onClick={() => setSelected(task)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px',
                    borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                    background: overdue ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.02)',
                    border: overdue ? '1px solid rgba(239,68,68,0.25)' : '1px solid transparent',
                    transition: 'background 0.15s',
                    width: '100%',
                  }}
                >
                  <div style={{ marginTop: 3 }}>{statusDot(status)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 12, fontWeight: 600, color: done ? 'var(--text-muted)' : 'var(--text-primary)',
                      textDecoration: done ? 'line-through' : 'none',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {overdue && <span style={{ marginRight: 4 }}>⚠️</span>}
                      {task.title}
                    </div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                      <Badge label={status.replace('_', ' ')} color={STATUS_COLOR[status] || '#64748B'} />
                      {task.priority && task.priority !== 'normal' && (
                        <Badge label={task.priority} color="#F59E0B" />
                      )}
                      {task.channel && <Badge label={task.channel} color="#64748B" />}
                    </div>
                  </div>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }}>
                    {task.assignedAt ? new Date(task.assignedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <TaskModal task={selected} onClose={() => setSelected(null)} />
    </>
  );
}
