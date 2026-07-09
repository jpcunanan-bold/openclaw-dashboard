import { useState, useMemo, useEffect, useCallback } from 'react';
import { authHeaders } from '../LoginGate';
import BrioChat from '../BrioChat';

// ── Map Darren's sheet task to a normalized shape ─────────────────────────────
function mapDarrenTask(t) {
  const raw = (t.status || '').toLowerCase();
  let status = t.status || 'TODO';
  if (raw.includes('done') || raw.includes('✅') || raw.includes('complete')) status = 'Done';
  else if (raw.includes('in progress') || raw.includes('🔄'))                 status = 'In Progress';
  else if (raw.includes('block') || raw.includes('⚠️'))                       status = 'Blocked';
  else if (raw === 'todo' || raw === '')                                        status = 'Pending';

  return {
    id:          String(t.sheetRow || ''),
    name:        t.title || '—',
    owner:       t.owner || 'Darren',
    status,
    statusRaw:   t.status || '',
    domain:      t.workstream || '—',
    week:        t.week  || '—',
    day:         t.day   || '—',
    target:      t.target || '',
    notes:       t.notes || '',
    cost:        t.cost  || '',
    approval:    t.approval || '',
    isApproved:  t.isApproved || false,
    sheetRow:    t.sheetRow,
  };
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const s = (status || '').toLowerCase();
  let bg = 'rgba(255,193,7,0.12)', border = '#ffc107', color = '#ffc107', label = status || 'Pending';
  if (s.includes('done')) {
    bg = 'rgba(40,199,111,0.12)'; border = '#28c76f'; color = '#28c76f'; label = 'Done';
  } else if (s.includes('in progress')) {
    bg = 'rgba(6,229,236,0.12)'; border = '#06E5EC'; color = '#06E5EC'; label = 'In Progress';
  } else if (s.includes('blocked')) {
    bg = 'rgba(234,84,85,0.10)'; border = '#ea5455'; color = '#ea5455'; label = 'Blocked';
  }
  return (
    <span style={{
      background: bg, border: `1px solid ${border}`, color,
      borderRadius: 5, padding: '2px 8px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
    }}>{label}</span>
  );
}

// ── Workstream tag ────────────────────────────────────────────────────────────
function WsTag({ ws }) {
  const w = (ws || '').toLowerCase();
  let color = '#06E5EC';
  if (w.includes('linkedin'))   color = '#0a66c2';
  if (w.includes('enrich'))     color = '#e67e22';
  if (w.includes('verif'))      color = '#28c76f';
  if (w.includes('prospect'))   color = '#9b59b6';
  if (w.includes('report'))     color = '#ffc107';
  return (
    <span style={{ fontSize: 11, color, background: `${color}14`, borderRadius: 4, padding: '2px 7px' }}>
      {ws || '—'}
    </span>
  );
}

// ── Week section header ───────────────────────────────────────────────────────
function SectionRow({ label }) {
  return (
    <tr>
      <td colSpan={7} style={{
        background: 'rgba(139,92,246,0.08)', borderTop: '1px solid rgba(139,92,246,0.25)',
        padding: '6px 12px', fontSize: 11, fontWeight: 700, color: '#8B5CF6',
        letterSpacing: '0.06em', textTransform: 'uppercase',
      }}>{label}</td>
    </tr>
  );
}

// ── Expanded detail row ───────────────────────────────────────────────────────
function DetailRow({ task, onChatOpen }) {
  return (
    <tr className="detail-row visible">
      <td colSpan={7}>
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))', gap: 10 }}>
            {task.target && (
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>TARGET</div>
                <div style={{ fontSize: 12, color: '#F1F5F9' }}>{task.target}</div>
              </div>
            )}
            {task.notes && (
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>NOTES</div>
                <div style={{ fontSize: 12, color: '#B0C2F5' }}>{task.notes}</div>
              </div>
            )}
            {task.approval && (
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>APPROVAL</div>
                <div style={{ fontSize: 12, color: '#28c76f' }}>{task.approval}</div>
              </div>
            )}
            {task.cost && (
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>COST</div>
                <div style={{ fontSize: 12, color: 'var(--orange)', fontWeight: 600 }}>{task.cost}</div>
              </div>
            )}
          </div>
          <div style={{ paddingTop: 4 }}>
            <button
              onClick={() => onChatOpen(task.id)}
              style={{
                background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.35)',
                borderRadius: 6, color: '#8B5CF6', fontSize: 12, fontWeight: 600,
                padding: '5px 12px', cursor: 'pointer',
              }}
            >
              💬 Chat Brio about this task
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DarrenMasterBoardTab() {
  const [rawTasks, setRawTasks]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [filterStr, setFilterStr]       = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [expandedRowId, setExpandedRowId] = useState(null);
  const [chatOpen, setChatOpen]         = useState(false);
  const [chatTaskRef, setChatTaskRef]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/darren/task-list', { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRawTasks((data.tasks || data || []).map(mapDarrenTask));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const isDone = (t) => t.status === 'Done';

  const filters = [
    { label: 'All',         fn: () => true },
    { label: 'Active',      fn: (t) => !isDone(t) },
    { label: 'Done',        fn: isDone },
    { label: 'Pending',     fn: (t) => t.status === 'Pending' },
    { label: 'Blocked',     fn: (t) => t.status === 'Blocked' },
    { label: 'In Progress', fn: (t) => t.status === 'In Progress' },
  ];

  const filteredTasks = useMemo(() => {
    const act = filters.find((f) => f.label === activeFilter) || filters[0];
    let res = rawTasks.filter(act.fn);
    if (filterStr) {
      const q = filterStr.toLowerCase();
      res = res.filter((t) =>
        (t.name || '').toLowerCase().includes(q) ||
        (t.domain || '').toLowerCase().includes(q) ||
        (t.statusRaw || '').toLowerCase().includes(q) ||
        (t.notes || '').toLowerCase().includes(q) ||
        (t.owner || '').toLowerCase().includes(q)
      );
    }
    return res;
  }, [rawTasks, activeFilter, filterStr]);

  // Group by week
  const grouped = useMemo(() => {
    const weeks = [];
    const seen = new Map();
    for (const t of filteredTasks) {
      const w = t.week || 'General';
      if (!seen.has(w)) { seen.set(w, []); weeks.push(w); }
      seen.get(w).push(t);
    }
    return weeks.map((w) => ({ week: w, tasks: seen.get(w) }));
  }, [filteredTasks]);

  // KPI summary
  const kpis = useMemo(() => ({
    total:      rawTasks.length,
    done:       rawTasks.filter(isDone).length,
    active:     rawTasks.filter((t) => !isDone(t)).length,
    blocked:    rawTasks.filter((t) => t.status === 'Blocked').length,
  }), [rawTasks]);

  if (loading) return (
    <div className="tab-content active">
      <div className="empty-state" style={{ paddingTop: 40 }}>Loading Darren's Master Board…</div>
    </div>
  );

  if (error) return (
    <div className="tab-content active">
      <div className="empty-state" style={{ color: '#ea5455', paddingTop: 40 }}>
        Error: {error} &nbsp;
        <button onClick={load} style={{ color: '#8B5CF6', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Retry</button>
      </div>
    </div>
  );

  return (
    <div className="tab-content active">
      {/* KPI strip */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Tasks',   value: kpis.total,   color: '#8B5CF6' },
          { label: 'Done',          value: kpis.done,    color: '#28c76f' },
          { label: 'Active',        value: kpis.active,  color: '#06E5EC' },
          { label: 'Blocked',       value: kpis.blocked, color: '#ea5455' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10, padding: '10px 18px', minWidth: 100,
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        {filters.map((f) => (
          <button key={f.label}
            className={`filter-btn${activeFilter === f.label ? ' active' : ''}`}
            onClick={() => { setActiveFilter(f.label); setExpandedRowId(null); }}>
            {f.label}
          </button>
        ))}
        <input type="text" className="filter-search" placeholder="Search tasks, workstreams…"
          value={filterStr} onChange={(e) => setFilterStr(e.target.value)} />
      </div>
      <p style={{ fontSize: 11, color: '#B0C2F5', margin: '4px 0 8px', opacity: 0.8 }}>
        Darren's DWDM task plan from Google Sheets — grouped by week.
      </p>

      {!filteredTasks.length ? (
        <div className="tasks-table-wrap">
          <div className="empty-state">No tasks match the current filter.</div>
        </div>
      ) : (
        <div className="tasks-table-wrap animate-in">
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }}>Day</th>
                <th>Task</th>
                <th>Workstream</th>
                <th>Owner</th>
                <th>Status</th>
                <th style={{ width: 60 }}>Cost</th>
                <th style={{ width: 36 }}>✅</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map(({ week, tasks: weekTasks }) => (
                <>
                  <SectionRow key={`week-${week}`} label={week} />
                  {weekTasks.map((t) => {
                    const isExpanded = expandedRowId === t.id;
                    return (
                      <>
                        <tr key={t.id}
                          className={`task-row${isExpanded ? ' expanded' : ''}`}
                          onClick={() => setExpandedRowId(isExpanded ? null : t.id)}>
                          <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.day}</td>
                          <td style={{ fontWeight: 600 }}>{t.name}</td>
                          <td><WsTag ws={t.domain} /></td>
                          <td style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{t.owner}</td>
                          <td><StatusBadge status={t.status} /></td>
                          <td style={{ fontSize: 11, color: t.cost ? 'var(--orange)' : 'var(--text-muted)', fontWeight: t.cost ? 600 : 400 }}>{t.cost || '—'}</td>
                          <td style={{ textAlign: 'center', fontSize: 14 }}>{t.isApproved ? '✅' : ''}</td>
                        </tr>
                        {isExpanded && (
                          <DetailRow key={`det-${t.id}`} task={t}
                            onChatOpen={(id) => { setChatTaskRef(id); setChatOpen(true); }} />
                        )}
                      </>
                    );
                  })}
                </>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '12px 16px', fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
            Showing {filteredTasks.length} of {rawTasks.length} tasks.
          </div>
        </div>
      )}

      <BrioChat
        taskRef={chatTaskRef}
        isOpen={chatOpen}
        onToggle={() => setChatOpen((o) => !o)}
      />
    </div>
  );
}
