import { useState, useMemo, useEffect } from 'react';
import { PriorityDot, StatusBadge, DomainTag, DueDate, AgeDot, TaskDetailPanel } from '../TaskAtoms';
import { useTaskCosts } from '../../hooks/useTaskCosts';
import { fmtUsd } from '../../utils/helpers';
import LauraChat from '../LauraChat';

export default function MasterBoardTab({ tasks, externalFilter, onFilterConsumed }) {
  const [filterStr, setFilterStr] = useState('');
  const [activeFilter, setActiveFilter] = useState('My Tasks');
  const [expandedRowId, setExpandedRowId] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatTaskRef, setChatTaskRef] = useState(null);
  const { costs } = useTaskCosts(30_000);

  // Build a lookup map: taskId -> cost entry
  const costMap = useMemo(() => {
    const m = {};
    if (costs?.tasks) {
      for (const t of costs.tasks) {
        m[t.taskId] = t;
      }
    }
    return m;
  }, [costs]);

  // Map external filter names to internal filter labels
  const filterMap = {
    'active': 'Active', 'Active': 'Active',
    'all': 'All', 'All': 'All',
    'overdue': 'Overdue', 'Overdue': 'Overdue',
    'Done (30d)': 'Done (30d)', 'completed': 'Done (30d)',
    'pending': 'Pending', 'Pending': 'Pending',
    'blocked': 'Blocked', 'Blocked': 'Blocked',
    'laura': 'Laura Owner', 'Laura Owner': 'Laura Owner',
    'mytasks': 'My Tasks', 'My Tasks': 'My Tasks',
  };

  useEffect(() => {
    if (externalFilter) {
      const mapped = filterMap[externalFilter] || externalFilter;
      setActiveFilter(mapped);
      if (onFilterConsumed) onFilterConsumed();
    }
  }, [externalFilter, onFilterConsumed]);

  const isDoneFilter = (t) => {
    const s = (t.status || '').toLowerCase();
    return s.includes('done') || s.includes('rejected') || s.includes('routed') || s.includes('fyi');
  };

  const filters = [
    { label: 'All', fn: () => true },
    { label: 'Active', fn: (t) => { const s = (t.status || '').toLowerCase(); return !isDoneFilter(t) && !s.includes('routed') && !s.includes('fyi'); } },
    { label: 'Done (30d)', fn: isDoneFilter },
    { label: 'Laura Owner', fn: (t) => (t.owner || '').toLowerCase().includes('laura') },
    { label: 'My Tasks', fn: (t) => (t.owner || '').toLowerCase().includes('ed') && !isDoneFilter(t) },
    { label: 'Pending', fn: (t) => (t.status || '').toLowerCase().includes('pending') },
    { label: 'Blocked', fn: (t) => { const s = (t.status || '').toLowerCase(); return s.includes('blocked') || s.includes('hold'); } },
    { label: 'Team Board', fn: (t) => {
        const s = (t.status || '').toLowerCase();
        return s.includes('routed') || s.includes('fyi');
      }
    },
    { label: 'Overdue', fn: (t) => {
        if (!t.dueDate || t.dueDate === 'TBD') return false;
        const d = new Date(t.dueDate);
        const { status } = t;
        const statusLower = (status || '').toLowerCase();
        if (statusLower.includes('done') || statusLower.includes('rejected') || statusLower.includes('routed')) return false;
        return d < new Date(new Date().setHours(0,0,0,0));
      }
    }
  ];

  const showDoneView = activeFilter === 'Done (30d)';

  const filteredTasks = useMemo(() => {
    const act = filters.find((f) => f.label === activeFilter) || filters[0];
    let res = tasks.filter(act.fn);
    if (filterStr) {
      const q = filterStr.toLowerCase();
      res = res.filter((t) => {
        return (t.id || '').toLowerCase().includes(q) ||
               (t.name || '').toLowerCase().includes(q) ||
               (t.owner || '').toLowerCase().includes(q) ||
               (t.domain || '').toLowerCase().includes(q) ||
               (t.notes || '').toLowerCase().includes(q);
      });
    }
    // Sort completed tasks by dateCompleted descending (newest first)
    if (showDoneView) {
      res.sort((a, b) => {
        const da = a.dateCompleted || a.dueDate || '1970-01-01';
        const db = b.dateCompleted || b.dueDate || '1970-01-01';
        return db.localeCompare(da); // newest first
      });
    }
    return res;
  }, [tasks, activeFilter, filterStr, showDoneView]);

  // Format completed date for display
  const fmtCompleted = (dateStr) => {
    if (!dateStr || dateStr === 'TBD') return '—';
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const taskDate = new Date(d);
    taskDate.setHours(0, 0, 0, 0);

    if (taskDate.getTime() === today.getTime()) return 'Today';
    if (taskDate.getTime() === yesterday.getTime()) return 'Yesterday';

    const diff = Math.floor((today - taskDate) / (1000 * 60 * 60 * 24));
    if (diff <= 7) return `${diff}d ago`;

    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="tab-content active">
      <div className="filter-bar">
        {filters.map((f) => (
          <button key={f.label} className={`filter-btn${activeFilter === f.label ? ' active' : ''}`}
            onClick={() => { setActiveFilter(f.label); setExpandedRowId(null); }}>
            {f.label}
          </button>
        ))}
        <input type="text" className="filter-search" placeholder="Search tasks, IDs, notes..."
          value={filterStr} onChange={(e) => setFilterStr(e.target.value)} />
      </div>
      <p style={{fontSize:"11px", color:"#B0C2F5", margin:"4px 0 8px", opacity:0.8}}>
        Default shows your tasks. Use "Active" for all, "Team Board" for delegated items.
      </p>

      {!filteredTasks.length ? (
        <div className="tasks-table-wrap"><div className="empty-state">No tasks match the current filter.</div></div>
      ) : (
        <div className="tasks-table-wrap animate-in">
          <table>
            <thead>
              <tr>
                {showDoneView ? (
                  <>
                    <th style={{ width: 80 }}>Completed</th>
                    <th>Task ID</th><th>Task Name</th>
                    <th>Owner</th><th>Status</th><th>Domain</th>
                    <th style={{ width: 80 }}>Time Saved</th>
                    <th style={{ width: 70 }}>Cost</th>
                  </>
                ) : (
                  <>
                    <th style={{ width: 40 }}>Age</th>
                    <th>Priority</th><th>Task ID</th><th>Task Name</th>
                    <th>Owner</th><th>Status</th><th>Due Date</th><th>Domain</th>
                    <th style={{ width: 70 }}>Cost</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((t) => {
                const isExpanded = expandedRowId === t.id;
                const costEntry = costMap[t.id];
                const colCount = showDoneView ? 8 : 9;
                return (
                  <>
                    <tr key={t.id} className={`task-row${isExpanded ? ' expanded' : ''}`}
                      onClick={() => setExpandedRowId(isExpanded ? null : t.id)}>
                      {showDoneView ? (
                        <>
                          <td style={{ fontSize: 12, fontWeight: 600, color: 'var(--green)' }}>
                            {fmtCompleted(t.dateCompleted)}
                          </td>
                          <td className="task-id">{t.id || '—'}</td>
                          <td style={{ fontWeight: 600 }}>{t.name || '—'}</td>
                          <td>{t.owner || '—'}</td>
                          <td><StatusBadge status={t.statusRaw || t.status} /></td>
                          <td><DomainTag domain={t.domain} /></td>
                          <td style={{ fontSize: 12, color: t.timeSavedMin ? 'var(--cyan)' : 'var(--text-muted)' }}>
                            {t.timeSavedMin ? `${t.timeSavedMin} min` : '—'}
                          </td>
                          <td style={{ fontSize: 12, fontWeight: costEntry ? 600 : 400, color: costEntry ? 'var(--orange)' : 'var(--text-muted)' }}>
                            {costEntry ? `$${fmtUsd(costEntry.costUsd)}` : '—'}
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ textAlign: 'center' }}><AgeDot dueDate={t.dueDate} /></td>
                          <td><PriorityDot priority={t.priorityRaw || t.priority} /></td>
                          <td className="task-id">{t.id || '—'}</td>
                          <td style={{ fontWeight: 600 }}>{t.name || '—'}</td>
                          <td>{t.owner || '—'}</td>
                          <td><StatusBadge status={t.statusRaw || t.status} /></td>
                          <td><DueDate dateStr={t.dueDate} /></td>
                          <td><DomainTag domain={t.domain} /></td>
                          <td style={{ fontSize: 12, fontWeight: costEntry ? 600 : 400, color: costEntry ? 'var(--orange)' : 'var(--text-muted)' }}>
                            {costEntry ? `$${fmtUsd(costEntry.costUsd)}` : '—'}
                          </td>
                        </>
                      )}
                    </tr>
                    {isExpanded && (
                      <tr key={`det-${t.id}`} className="detail-row visible">
                        <td colSpan={colCount}>
                          <TaskDetailPanel task={t} costEntry={costEntry} />
                          <div style={{ padding: '8px 0 4px' }}>
                            <button
                              onClick={() => { setChatTaskRef(t['Task ID'] || t.id); setChatOpen(true); }}
                              style={{
                                background: 'rgba(6,229,236,0.1)',
                                border: '1px solid rgba(6,229,236,0.35)',
                                borderRadius: 6,
                                color: '#06E5EC',
                                fontSize: 12,
                                fontWeight: 600,
                                padding: '5px 12px',
                                cursor: 'pointer',
                              }}
                            >
                              💬 Chat Laura about this task
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
          <div style={{ padding: '12px 16px', fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
            Showing {filteredTasks.length} of {tasks.length} master tasks{showDoneView ? ' — sorted newest first' : ''}.
          </div>
        </div>
      )}
      <LauraChat
        taskRef={chatTaskRef}
        isOpen={chatOpen}
        onToggle={() => setChatOpen(o => !o)}
      />
    </div>
  );
}
