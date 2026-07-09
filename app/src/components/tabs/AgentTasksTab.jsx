import { useState, useEffect, useCallback } from 'react';

const STATUS_COLORS = {
  pending:     { bg: 'rgba(255,193,7,0.15)',  border: '#ffc107', text: '#ffc107'  },
  open:        { bg: 'rgba(255,193,7,0.15)',  border: '#ffc107', text: '#ffc107'  },
  todo:        { bg: 'rgba(255,193,7,0.15)',  border: '#ffc107', text: '#ffc107'  },
  in_progress: { bg: 'rgba(6,229,236,0.12)',  border: '#06E5EC', text: '#06E5EC'  },
  completed:   { bg: 'rgba(40,199,111,0.12)', border: '#28c76f', text: '#28c76f'  },
  failed:      { bg: 'rgba(234,84,85,0.12)',  border: '#ea5455', text: '#ea5455'  },
  deleted:     { bg: 'rgba(150,150,150,0.1)', border: '#666',    text: '#666'     },
};

const PRIORITY_ICON = { high: '🔴', normal: '🟡', low: '🟢' };

function fmt$(n) { const v = Number(n) || 0; return v < 0.01 ? '<$0.01' : `$${v.toFixed(4)}`; }
function fmtTokens(n) { const v = Number(n) || 0; return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v); }
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York' });
}
function fmtDuration(start, end) {
  if (!start || !end) return null;
  const diff = (new Date(end) - new Date(start)) / 60000;
  if (diff < 1) return '<1m';
  if (diff < 60) return `${Math.round(diff)}m`;
  return `${(diff / 60).toFixed(1)}h`;
}

function KpiCard({ icon, label, value, sub, color = '#06E5EC' }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 20px', minWidth: 140, flex: '1 1 140px' }}>
      <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function TaskRow({ task, expanded, onToggle, onApprove, onReject, agentColor = '#06E5EC' }) {
  const sc = STATUS_COLORS[task.status] || STATUS_COLORS.pending;
  const dur = fmtDuration(task.assignedAt, task.completedAt || task.startedAt);
  const approvalStatus = task.approval_status || 'pending';

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
      <div onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', background: expanded ? 'rgba(255,255,255,0.04)' : 'transparent' }}>
        <span title={`Priority: ${task.priority}`} style={{ fontSize: 14 }}>{PRIORITY_ICON[task.priority] || '🟡'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e8eaff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.title}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{fmtDate(task.assignedAt)}{dur && <span style={{ marginLeft: 8 }}>⏱ {dur}</span>}</div>
        </div>
        <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text, whiteSpace: 'nowrap' }}>{task.status.replace('_', ' ')}</span>
        <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
          {approvalStatus === 'pending' && onApprove && (
            <>
              <button onClick={() => onApprove(task.id)} style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', color: '#22C55E' }}>✓ Approve</button>
              <button onClick={() => onReject(task.id)} style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444' }}>✕ Reject</button>
            </>
          )}
          {approvalStatus === 'approved' && <span style={{ fontSize: 11, color: '#22C55E', fontWeight: 700 }}>✓ Approved</span>}
          {approvalStatus === 'rejected' && <span style={{ fontSize: 11, color: '#EF4444', fontWeight: 700 }}>✕ Rejected</span>}
        </div>
        <div style={{ textAlign: 'right', minWidth: 70 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: agentColor }}>{fmt$(task.costUsd)}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{fmtTokens(task.totalTokens)} tok</div>
        </div>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginLeft: 4 }}>{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <div style={{ padding: '12px 16px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 12, color: 'rgba(255,255,255,0.55)', marginBottom: task.rawMessage ? 12 : 0 }}>
            <span>📥 Input: {(task.inputTokens||0).toLocaleString()}</span>
            <span>📤 Output: {(task.outputTokens||0).toLocaleString()}</span>
            <span>📖 Cache read: {(task.cacheReadTokens||0).toLocaleString()}</span>
            <span>✍️ Cache write: {(task.cacheWriteTokens||0).toLocaleString()}</span>
            {task.model && <span>🤖 {task.model.replace('claude-','')}</span>}
          </div>
          {task.rawMessage && (
            <div style={{ marginTop: 8, padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, fontSize: 13, color: 'rgba(255,255,255,0.7)', fontStyle: 'italic', maxHeight: 120, overflowY: 'auto' }}>"{task.rawMessage}"</div>
          )}
          {task.description && task.description !== task.rawMessage && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.5)', whiteSpace: 'pre-wrap' }}>{task.description}</div>
          )}
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 10, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
            <span>📋 Created: {fmtDate(task.assignedAt)}</span>
            {task.requestedBy && <span>👤 By: {task.requestedBy}</span>}
            {task.startedAt   && <span>▶️ Started: {fmtDate(task.startedAt)}</span>}
            {task.completedAt && <span>✅ Done: {fmtDate(task.completedAt)}</span>}
            {task.dueDate     && <span>📅 Due: {new Date(task.dueDate).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AgentTasksTab({ agentName = 'laura' }) {
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [days, setDays]           = useState(30);
  const [statusFilter, setStatus] = useState('all');
  const [expanded, setExpanded]   = useState(null);
  const [search, setSearch]       = useState('');

  const AGENT_COLORS = {
    laura:   '#06E5EC',
    darren:  '#34d399',
    zara:    '#f43f5e',
    camilla: '#eab308',
    lola:    '#a78bfa',
    ava:     '#f97316',
    brio:    '#3B82F6',
  };
  const agentColor = AGENT_COLORS[agentName] || '#06E5EC';
  const agentLabel = agentName.charAt(0).toUpperCase() + agentName.slice(1);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const token = localStorage.getItem('cc_auth_token') || localStorage.getItem('authToken') || '';
      const r = await fetch(
        `/api/abhi/tasks?days=${days}&status=${statusFilter}&limit=300&agent=${agentName}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [days, statusFilter, agentName]);

  useEffect(() => { load(); }, [load]);

  const tasks          = data?.tasks   || [];
  const summary        = data?.summary || {};
  const daily          = data?.daily   || [];
  const maxDailyTasks  = Math.max(...daily.map(x => x.tasks), 1);

  const filtered = search.trim()
    ? tasks.filter(t => (t.title||'').toLowerCase().includes(search.toLowerCase()) || (t.rawMessage||'').toLowerCase().includes(search.toLowerCase()))
    : tasks;

  async function handleApproval(taskId, decision) {
    const token = localStorage.getItem('cc_auth_token') || localStorage.getItem('authToken') || '';
    try {
      const r = await fetch(`/api/abhi/tasks/${taskId}/approval`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ decision }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      load();
    } catch (e) {
      alert(`Failed to ${decision} task: ${e.message}`);
    }
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: agentColor }}>📋 {agentLabel}'s Task Assignments</h2>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>Every task assigned to {agentLabel} — with real AI cost per task</p>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
        <KpiCard icon="📋" label="Total Tasks"  value={summary.total || 0}      sub={`Last ${days} days`} color={agentColor} />
        <KpiCard icon="⏳" label="Pending"      value={summary.pending || 0}     color="#ffc107" />
        <KpiCard icon="⚡" label="In Progress"  value={summary.inProgress || 0}  color="#06E5EC" />
        <KpiCard icon="✅" label="Completed"    value={summary.completed || 0}   color="#28c76f" />
        <KpiCard icon="💰" label="Total Cost"   value={summary.totalCost ? `$${Number(summary.totalCost).toFixed(2)}` : '$0.00'} color="#9b59b6" />
        <KpiCard icon="📊" label="Avg / Task"   value={summary.avgCostPerTask ? fmt$(summary.avgCostPerTask) : '$0.00'} sub={summary.avgDurationMin ? `~${summary.avgDurationMin}m avg` : ''} color="#e67e22" />
      </div>

      {daily.length > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 12 }}>Daily activity (last {days} days)</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 60, overflowX: 'auto' }}>
            {[...daily].reverse().map(d => {
              const h = Math.max(4, (d.tasks / maxDailyTasks) * 56);
              return (
                <div key={d.day} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '1 0 20px' }} title={`${d.day}: ${d.tasks} tasks, $${Number(d.cost).toFixed(3)}`}>
                  <div style={{ width: '100%', height: h, background: `linear-gradient(180deg,${agentColor},#003BDF)`, borderRadius: '3px 3px 0 0', minWidth: 8 }} />
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', marginTop: 3, whiteSpace: 'nowrap' }}>{new Date(d.day).toLocaleDateString('en-US',{month:'numeric',day:'numeric'})}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <input placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 12px', color: '#e8eaff', fontSize: 13, outline: 'none' }} />
        {[
          { value: 'all',         label: 'All'         },
          { value: 'pending',     label: 'Pending / Open' },
          { value: 'in_progress', label: 'In Progress' },
          { value: 'completed',   label: 'Completed'   },
        ].map(s => (
          <button key={s.value} onClick={() => setStatus(s.value)} style={{
            padding: '7px 14px', borderRadius: 8, fontSize: 12,
            border: `1px solid ${statusFilter === s.value ? agentColor : 'rgba(255,255,255,0.15)'}`,
            background: statusFilter === s.value ? `${agentColor}20` : 'rgba(255,255,255,0.04)',
            color: statusFilter === s.value ? agentColor : 'rgba(255,255,255,0.55)', cursor: 'pointer', fontWeight: statusFilter === s.value ? 700 : 400,
          }}>{s.label}</button>
        ))}
        <select value={days} onChange={e => setDays(Number(e.target.value))}
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '7px 10px', color: '#e8eaff', fontSize: 12, cursor: 'pointer' }}>
          {[7,14,30,60,90].map(d => <option key={d} value={d} style={{ background: '#1a1e3a' }}>Last {d}d</option>)}
        </select>
        <button onClick={load} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, border: `1px solid ${agentColor}50`, background: `${agentColor}15`, color: agentColor, cursor: 'pointer' }}>↻ Refresh</button>
      </div>

      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 12 }}>Showing {filtered.length} of {tasks.length} tasks</div>

      {loading && <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.4)' }}>Loading tasks...</div>}
      {!loading && error && <div style={{ padding: 20, borderRadius: 10, background: 'rgba(234,84,85,0.1)', border: '1px solid rgba(234,84,85,0.3)', color: '#ea5455', fontSize: 13 }}>⚠️ {error}</div>}
      {!loading && !error && tasks.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>No tasks for {agentLabel}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
            Tasks will appear here once {agentLabel} starts receiving assignments tracked in the system.
          </div>
        </div>
      )}
      {!loading && !error && tasks.length > 0 && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
          No tasks match your search / filter
        </div>
      )}
      {!loading && filtered.map(task => (
        <TaskRow key={task.id} task={task} expanded={expanded === task.id}
          onToggle={() => setExpanded(expanded === task.id ? null : task.id)}
          onApprove={id => handleApproval(id, 'approved')}
          onReject={id  => handleApproval(id, 'rejected')}
          agentColor={agentColor}
        />
      ))}
    </div>
  );
}
