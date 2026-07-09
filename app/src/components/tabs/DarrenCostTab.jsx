import { useState, useEffect, useCallback } from 'react';
import { authHeaders } from '../LoginGate';

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseCost(raw = '') {
  return parseFloat(String(raw).replace(/[^0-9.]/g, '')) || 0;
}
function fmt$(n, fallback = '—') {
  const v = Number(n) || 0;
  return v === 0 ? fallback : `$${v.toFixed(2)}`;
}
function wsColor(ws = '') {
  const w = ws.toLowerCase();
  if (w.includes('outreach') || w.includes('email'))   return '#06E5EC';
  if (w.includes('linkedin'))                           return '#0077b5';
  if (w.includes('prospect'))                           return '#9b59b6';
  if (w.includes('enrich'))                             return '#e67e22';
  if (w.includes('verif'))                              return '#28c76f';
  if (w.includes('response') || w.includes('booking')) return '#ffc107';
  if (w.includes('ops') || w.includes('track'))        return '#e74c3c';
  if (w.includes('qa'))                                 return '#1abc9c';
  return '#94a3b8';
}
function statusColor(s = '') {
  const v = s.toLowerCase();
  if (v.includes('done') || v.includes('✅'))         return '#28c76f';
  if (v.includes('in progress') || v.includes('🔄')) return '#06E5EC';
  if (v.includes('todo'))                             return '#ffc107';
  return '#94a3b8';
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, color = '#8B5CF6' }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${color}30`,
      borderTop: `3px solid ${color}`,
      borderRadius: 10, padding: '16px 18px',
      flex: '1 1 130px', minWidth: 0,
    }}>
      <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── Bar row ───────────────────────────────────────────────────────────────────
function BarRow({ label, cost, maxCost, color, right, sub, bold }) {
  const pct = maxCost > 0 ? Math.max(cost > 0 ? 3 : 0, (cost / maxCost) * 100) : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: bold ? '#e8eaff' : 'rgba(255,255,255,0.7)', fontWeight: bold ? 700 : 400,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240 }}>{label}</span>
          {sub && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', flexShrink: 0 }}>{sub}</span>}
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, color: cost > 0 ? color : 'rgba(255,255,255,0.2)', minWidth: 56, textAlign: 'right' }}>
          {right ?? fmt$(cost)}
        </span>
      </div>
      <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`,
          background: cost > 0 ? `linear-gradient(90deg,${color}cc,${color}55)` : 'transparent',
          borderRadius: 4, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  );
}

// ── Task row ──────────────────────────────────────────────────────────────────
function TaskRow({ task, rank }) {
  const cost = parseCost(task.cost);
  const wsc  = wsColor(task.workstream);
  const sc   = statusColor(task.status);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 14px',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
    }}>
      <div style={{ width: 22, flexShrink: 0, fontSize: 11, color: 'rgba(255,255,255,0.2)', textAlign: 'right' }}>{rank + 1}</div>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: wsc, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: '#e8eaff', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {task.title}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
          {task.week}{task.day ? ` · ${task.day}` : ''} &nbsp;·&nbsp; {task.workstream}
        </div>
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
        background: `${sc}18`, border: `1px solid ${sc}44`, color: sc, whiteSpace: 'nowrap', flexShrink: 0 }}>
        {task.status || 'TODO'}
      </span>
      <span style={{ fontSize: 11, flexShrink: 0 }}>{task.isApproved ? '✅' : '⏳'}</span>
      <div style={{ minWidth: 60, textAlign: 'right', flexShrink: 0, fontSize: 14, fontWeight: 700,
        color: cost > 0 ? '#8B5CF6' : 'rgba(255,255,255,0.18)' }}>
        {cost > 0 ? fmt$(cost) : '—'}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function DarrenCostTab() {
  const [data,    setData]  = useState(null);
  const [loading, setLoad]  = useState(true);
  const [error,   setError] = useState(null);
  const [view,    setView]  = useState('week'); // week | workstream | status | tasks

  const load = useCallback(async () => {
    setLoad(true); setError(null);
    try {
      const r = await fetch('/api/darren/task-list', { headers: authHeaders() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
    } catch (e) { setError(e.message); }
    finally { setLoad(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const tasks = data?.tasks || [];

  // ── Aggregations ──────────────────────────────────────────────────────────
  const totalCost    = tasks.reduce((s, t) => s + parseCost(t.cost), 0);
  const doneCost     = tasks.filter(t => /done|✅|sent|complete/i.test(t.status)).reduce((s, t) => s + parseCost(t.cost), 0);
  const inProgCost   = tasks.filter(t => /in progress|🔄/i.test(t.status)).reduce((s, t) => s + parseCost(t.cost), 0);
  const todoCost     = tasks.filter(t => !(/done|✅|sent|complete|in progress|🔄/i.test(t.status))).reduce((s, t) => s + parseCost(t.cost), 0);
  const loggedCount  = tasks.filter(t => parseCost(t.cost) > 0).length;

  // ── By Week (primary view) ─────────────────────────────────────────────────
  const weekMap = {};
  for (const t of tasks) {
    const k = t.week || 'Other';
    if (!weekMap[k]) weekMap[k] = { label: k, cost: 0, done: 0, inProg: 0, todo: 0, tasks: 0 };
    const c = parseCost(t.cost);
    weekMap[k].cost  = Math.round((weekMap[k].cost + c) * 10000) / 10000;
    weekMap[k].tasks++;
    if (/done|✅|sent|complete/i.test(t.status))     weekMap[k].done++;
    else if (/in progress|🔄/i.test(t.status))        weekMap[k].inProg++;
    else                                               weekMap[k].todo++;
  }
  const weekRows   = Object.values(weekMap).sort((a, b) => a.label.localeCompare(b.label));
  const maxWeekCost = Math.max(...weekRows.map(r => r.cost), 0.01);

  // ── By Workstream ─────────────────────────────────────────────────────────
  const wsMap = {};
  for (const t of tasks) {
    const k = t.workstream || 'Other';
    if (!wsMap[k]) wsMap[k] = { label: k, cost: 0, tasks: 0 };
    wsMap[k].cost  = Math.round((wsMap[k].cost + parseCost(t.cost)) * 10000) / 10000;
    wsMap[k].tasks++;
  }
  const wsRows    = Object.values(wsMap).sort((a, b) => b.cost - a.cost);
  const maxWsCost = Math.max(...wsRows.map(r => r.cost), 0.01);

  // ── By Status ─────────────────────────────────────────────────────────────
  const statusMap = {};
  for (const t of tasks) {
    const k = t.status || 'TODO';
    if (!statusMap[k]) statusMap[k] = { label: k, cost: 0, tasks: 0 };
    statusMap[k].cost  = Math.round((statusMap[k].cost + parseCost(t.cost)) * 10000) / 10000;
    statusMap[k].tasks++;
  }
  const statusRows    = Object.values(statusMap).sort((a, b) => b.cost - a.cost);
  const maxStatusCost = Math.max(...statusRows.map(r => r.cost), 0.01);

  // ── Per task sorted by cost ────────────────────────────────────────────────
  const sortedTasks = [...tasks].sort((a, b) => parseCost(b.cost) - parseCost(a.cost));

  const views = [
    { key: 'week',       label: '📅 By Week' },
    { key: 'workstream', label: '🏷️ By Workstream' },
    { key: 'status',     label: '🔵 By Status' },
    { key: 'tasks',      label: '📋 Per Task' },
  ];

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 22, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#e8eaff' }}>💸 Darren — Cost Breakdown</h2>
          <p style={{ margin: '5px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
            Source: <strong style={{ color: 'rgba(255,255,255,0.6)' }}>DWDM Task Plan</strong> · col I · {tasks.length} tasks · {loggedCount} with costs
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'rgba(139,92,246,0.7)' }}>
            Costs entered directly in sheet — real values, not estimates
          </p>
        </div>
        <button onClick={load} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, border: '1px solid rgba(139,92,246,0.35)', background: 'rgba(139,92,246,0.08)', color: '#8B5CF6', cursor: 'pointer' }}>
          ↻ Refresh
        </button>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 22 }}>
        <KpiCard icon="💰" label="Total Cost"      value={fmt$(totalCost, '$0.00')}  color="#8B5CF6" sub={`${loggedCount} of ${tasks.length} tasks`} />
        <KpiCard icon="✅" label="Done"             value={fmt$(doneCost,  '$0.00')}  color="#28c76f" sub={`${tasks.filter(t => /done|✅|sent|complete/i.test(t.status)).length} tasks`} />
        <KpiCard icon="🔄" label="In Progress"      value={fmt$(inProgCost,'$0.00')}  color="#06E5EC" sub={`${tasks.filter(t => /in progress|🔄/i.test(t.status)).length} tasks`} />
        <KpiCard icon="⏳" label="Remaining (TODO)" value={fmt$(todoCost,  '$0.00')}  color="#ffc107" sub={`projected spend`} />
        <KpiCard icon="📅" label="Weeks Tracked"    value={weekRows.length}            color="#3B82F6" sub={weekRows.map(w => w.label).join(' · ')} />
      </div>

      {/* View toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {views.map(({ key, label }) => (
          <button key={key} onClick={() => setView(key)} style={{
            padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            border: '1px solid',
            borderColor: view === key ? '#8B5CF6' : 'rgba(255,255,255,0.1)',
            background:  view === key ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.03)',
            color: view === key ? '#c084fc' : 'rgba(255,255,255,0.45)',
            cursor: 'pointer',
          }}>{label}</button>
        ))}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 48, color: 'rgba(255,255,255,0.35)' }}>Loading DWDM Task Plan…</div>}
      {!loading && error && <div style={{ padding: 16, borderRadius: 10, background: 'rgba(234,84,85,0.1)', border: '1px solid rgba(234,84,85,0.3)', color: '#ea5455', fontSize: 13 }}>⚠️ {error}</div>}

      {!loading && !error && (
        <>
          {/* ── BY WEEK ── */}
          {view === 'week' && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '20px 22px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 18 }}>
                $ Cost by Week — DWDM Task Plan
              </div>
              {weekRows.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>No week data found</div>
              ) : weekRows.map(row => (
                <div key={row.label} style={{ marginBottom: 20 }}>
                  <BarRow
                    label={row.label}
                    cost={row.cost}
                    maxCost={maxWeekCost}
                    color="#8B5CF6"
                    bold
                    sub={`${row.tasks} tasks`}
                  />
                  {/* mini status breakdown per week */}
                  <div style={{ marginLeft: 20, display: 'flex', gap: 12, marginTop: -4 }}>
                    {[
                      { label: 'Done',        count: row.done,   color: '#28c76f' },
                      { label: 'In Progress', count: row.inProg, color: '#06E5EC' },
                      { label: 'To Do',       count: row.todo,   color: '#ffc107' },
                    ].filter(s => s.count > 0).map(s => (
                      <span key={s.label} style={{ fontSize: 11, color: s.color }}>
                        {s.count} {s.label}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700 }}>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>Total across all weeks</span>
                <span style={{ color: '#8B5CF6' }}>{fmt$(totalCost, '$0.00')}</span>
              </div>
            </div>
          )}

          {/* ── BY WORKSTREAM ── */}
          {view === 'workstream' && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '20px 22px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 18 }}>
                $ Cost by Workstream
              </div>
              {wsRows.map(row => (
                <BarRow key={row.label} label={row.label} cost={row.cost} maxCost={maxWsCost}
                  color={wsColor(row.label)} sub={`${row.tasks} tasks`} />
              ))}
            </div>
          )}

          {/* ── BY STATUS ── */}
          {view === 'status' && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '20px 22px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 18 }}>
                $ Cost by Status
              </div>
              {statusRows.map(row => (
                <BarRow key={row.label} label={row.label} cost={row.cost} maxCost={maxStatusCost}
                  color={statusColor(row.label)} sub={`${row.tasks} tasks`} />
              ))}
            </div>
          )}

          {/* ── PER TASK ── */}
          {view === 'tasks' && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
                fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)',
              }}>
                <div style={{ width: 22, flexShrink: 0 }}>#</div>
                <div style={{ width: 8, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>Task · Week · Workstream</div>
                <div style={{ width: 80, textAlign: 'center' }}>Status</div>
                <div style={{ width: 22, textAlign: 'center' }}>✓</div>
                <div style={{ width: 60, textAlign: 'right', color: 'rgba(139,92,246,0.7)' }}>$ Cost</div>
              </div>
              {sortedTasks.map((task, i) => <TaskRow key={task.sheetRow} task={task} rank={i} />)}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '11px 14px',
                borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(139,92,246,0.05)' }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>TOTAL</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#8B5CF6', minWidth: 60, textAlign: 'right' }}>
                  {fmt$(totalCost, '$0.00')}
                </span>
              </div>
            </div>
          )}

          <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.1)', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
            🔬 Costs sourced directly from <strong style={{ color: 'rgba(255,255,255,0.5)' }}>DWDM Task Plan · column I</strong> — real token costs written by Darren as tasks are completed.
          </div>
        </>
      )}
    </div>
  );
}
