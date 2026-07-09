import { useState, useEffect, useCallback } from 'react';
import { authHeaders } from '../LoginGate';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt$(raw = '') {
  const n = parseFloat(String(raw).replace(/[^0-9.]/g, '')) || 0;
  if (n === 0) return raw || '—';
  return `$${n.toFixed(2)}`;
}

function statusBadge(status = '') {
  const s = status.toLowerCase();
  if (s.includes('done') || s.includes('✅') || s.includes('sent') || s.includes('complete'))
    return { bg: 'rgba(40,199,111,0.12)', border: '#28c76f', text: '#28c76f', label: status || 'Done' };
  if (s.includes('in progress') || s.includes('🔄'))
    return { bg: 'rgba(6,229,236,0.12)', border: '#06E5EC', text: '#06E5EC', label: status || 'In Progress' };
  if (s.includes('todo') || s === '')
    return { bg: 'rgba(255,193,7,0.10)', border: '#ffc107', text: '#ffc107', label: status || 'TODO' };
  if (s.includes('block') || s.includes('⚠️'))
    return { bg: 'rgba(234,84,85,0.10)', border: '#ea5455', text: '#ea5455', label: status || 'Blocked' };
  return { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.15)', text: 'rgba(255,255,255,0.55)', label: status };
}

function wsColor(ws = '') {
  const w = ws.toLowerCase();
  if (w.includes('outreach') || w.includes('email'))  return '#06E5EC';
  if (w.includes('linkedin'))                          return '#0077b5';
  if (w.includes('prospect'))                          return '#9b59b6';
  if (w.includes('enrich'))                            return '#e67e22';
  if (w.includes('verif'))                             return '#28c76f';
  if (w.includes('response') || w.includes('booking'))return '#ffc107';
  if (w.includes('ops') || w.includes('track'))       return '#e74c3c';
  if (w.includes('qa'))                               return '#1abc9c';
  return 'rgba(255,255,255,0.4)';
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, color = '#06E5EC' }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12, padding: '16px 20px', minWidth: 140, flex: '1 1 140px',
    }}>
      <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── Task card ─────────────────────────────────────────────────────────────────
function TaskCard({ task, showApproveButton, onApproved, onCostSaved }) {
  const [exp,        setExp]       = useState(false);
  const [approving,  setApproving] = useState(false);
  const [approveErr, setApproveErr]= useState(null);
  const [editCost,   setEditCost]  = useState(false);
  const [costVal,    setCostVal]   = useState(task.cost || '');
  const [savingCost, setSavingCost]= useState(false);

  const sb  = statusBadge(task.status);
  const wsc = wsColor(task.workstream);

  async function handleApprove(e) {
    e.stopPropagation();
    setApproving(true); setApproveErr(null);
    try {
      const r = await fetch('/api/darren/task-list/approve', {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetRow: task.sheetRow, approvedBy: 'Abhinanda Deb' }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || `HTTP ${r.status}`);
      if (onApproved) onApproved(task);
    } catch (err) {
      setApproveErr(err.message);
      setApproving(false);
    }
  }

  async function handleSaveCost(e) {
    e.stopPropagation();
    setSavingCost(true);
    try {
      const r = await fetch('/api/darren/task-list/cost', {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetRow: task.sheetRow, cost: costVal }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setEditCost(false);
      if (onCostSaved) onCostSaved();
    } catch (err) {
      alert('Cost save failed: ' + err.message);
    } finally { setSavingCost(false); }
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderLeft: `3px solid ${wsc}`,
      borderRadius: 10, marginBottom: 8, overflow: 'hidden',
    }}>
      <div onClick={() => setExp(e => !e)} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 14px', cursor: 'pointer' }}>

        {/* Week / Day badge */}
        <div style={{
          flexShrink: 0, minWidth: 48, textAlign: 'center',
          background: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: '4px 6px',
        }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: 0.5 }}>{task.week || '—'}</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>{task.day || ''}</div>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e8eaff', lineHeight: 1.35, marginBottom: 4 }}>{task.title}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{
              fontSize: 11, padding: '1px 7px', borderRadius: 20,
              background: `${wsc}18`, border: `1px solid ${wsc}40`, color: wsc,
            }}>{task.workstream || 'General'}</span>
            {task.owner && (
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>👤 {task.owner}</span>
            )}
          </div>
        </div>

        {/* Cost */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {editCost ? (
            <span onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input
                autoFocus
                value={costVal}
                onChange={e => setCostVal(e.target.value)}
                style={{ width: 70, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(6,229,236,0.4)', borderRadius: 5, padding: '3px 6px', color: '#e8eaff', fontSize: 12, outline: 'none' }}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveCost(e); if (e.key === 'Escape') setEditCost(false); }}
              />
              <button onClick={handleSaveCost} disabled={savingCost} style={{ padding: '3px 7px', borderRadius: 5, background: 'rgba(40,199,111,0.15)', border: '1px solid #28c76f', color: '#28c76f', fontSize: 11, cursor: 'pointer' }}>
                {savingCost ? '…' : '✓'}
              </button>
            </span>
          ) : (
            <div
              onClick={e => { e.stopPropagation(); setEditCost(true); }}
              title="Click to edit cost"
              style={{ fontSize: 13, fontWeight: 700, color: task.cost ? '#9b59b6' : 'rgba(255,255,255,0.2)', cursor: 'text', minWidth: 40, textAlign: 'right' }}
            >
              {task.cost ? fmt$(task.cost) : '+ cost'}
            </div>
          )}
        </div>

        {/* Status badge */}
        <span style={{
          padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600,
          background: sb.bg, border: `1px solid ${sb.border}`, color: sb.text,
          whiteSpace: 'nowrap', flexShrink: 0,
        }}>{sb.label}</span>

        {/* Approval badge */}
        {task.isApproved ? (
          <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'rgba(40,199,111,0.12)', border: '1px solid #28c76f', color: '#28c76f', whiteSpace: 'nowrap', flexShrink: 0 }}>
            ✅ Approved
          </span>
        ) : showApproveButton ? (
          <button
            onClick={handleApprove}
            disabled={approving}
            style={{
              padding: '5px 12px', borderRadius: 7, fontSize: 11, fontWeight: 700,
              border: '1px solid #28c76f',
              background: approving ? 'rgba(40,199,111,0.05)' : 'rgba(40,199,111,0.12)',
              color: approving ? 'rgba(40,199,111,0.4)' : '#28c76f',
              cursor: approving ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s',
            }}
          >{approving ? '…' : '✓ Approve'}</button>
        ) : null}

        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginLeft: 2, flexShrink: 0 }}>{exp ? '▲' : '▼'}</span>
      </div>

      {approveErr && (
        <div style={{ padding: '5px 14px 8px', fontSize: 11, color: '#ea5455', background: 'rgba(234,84,85,0.08)' }}>⚠️ {approveErr}</div>
      )}

      {exp && (
        <div style={{ padding: '10px 14px 14px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.15)' }}>
          {task.target && (
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>Target / Output </span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>{task.target}</span>
            </div>
          )}
          {task.notes && (
            <div style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>Notes </span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontStyle: 'italic' }}>{task.notes}</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 6 }}>
            <span>Approval: <span style={{ color: task.isApproved ? '#28c76f' : '#ffc107' }}>{task.approval || 'No'}</span></span>
            <span>Row #{task.sheetRow}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Week group ────────────────────────────────────────────────────────────────
function WeekGroup({ label, tasks, showApproveButton, onApproved, onCostSaved }) {
  if (!tasks.length) return null;
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: 1,
        color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase',
        padding: '6px 0', marginBottom: 8,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>{label}</div>
      {tasks.map((t, i) => (
        <TaskCard
          key={`${t.sheetRow}-${i}`}
          task={t}
          showApproveButton={showApproveButton}
          onApproved={onApproved}
          onCostSaved={onCostSaved}
        />
      ))}
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────
export default function DarrenTasksTab() {
  const [data,    setData]   = useState(null);
  const [loading, setLoad]   = useState(true);
  const [error,   setError]  = useState(null);
  const [subTab,  setSubTab] = useState('pending'); // 'pending' | 'approved'
  const [search,  setSearch] = useState('');

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

  const [justApproved, setJustApproved] = useState(new Set());
  function handleApproved(task) {
    setJustApproved(prev => new Set([...prev, task.sheetRow]));
    setTimeout(() => { setJustApproved(new Set()); load(); }, 1200);
  }

  const rawTasks = subTab === 'approved'
    ? (data?.approved || [])
    : (data?.pending  || []);

  const filteredTasks = rawTasks
    .filter(t => !justApproved.has(t.sheetRow))
    .filter(t => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (t.title || '').toLowerCase().includes(q)
          || (t.workstream || '').toLowerCase().includes(q)
          || (t.notes || '').toLowerCase().includes(q);
    });

  // Group by Week
  const grouped = filteredTasks.reduce((acc, t) => {
    const key = t.week || 'General';
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  // Total cost (all tasks)
  const totalCost = (data?.tasks || []).reduce((s, t) => {
    return s + (parseFloat(String(t.cost || '').replace(/[^0-9.]/g, '')) || 0);
  }, 0);

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#e8eaff' }}>
            📋 Darren — DWDM Task Plan
          </h2>
          <p style={{ margin: '5px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
            All tasks from the DWDM Task Plan tab · approval + cost tracking · live from Google Sheets
          </p>
        </div>
        <button onClick={load} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, border: '1px solid rgba(6,229,236,0.3)', background: 'rgba(6,229,236,0.08)', color: '#06E5EC', cursor: 'pointer' }}>↻ Refresh</button>
      </div>

      {/* KPI row */}
      {data && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
          <KpiCard icon="📋" label="Total Tasks"    value={data.total || 0}               color="#06E5EC" />
          <KpiCard icon="✅" label="Approved"        value={data.approved?.length || 0}    color="#28c76f" />
          <KpiCard icon="⏳" label="Pending Approval" value={data.pending?.length || 0}   color="#ffc107" />
          <KpiCard icon="💰" label="Total Cost"      value={totalCost ? `$${totalCost.toFixed(2)}` : '—'} color="#9b59b6" />
        </div>
      )}

      {/* Sub-tab toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {[
          { key: 'pending',  label: `⏳ Pending Approval (${data?.pending?.length || 0})` },
          { key: 'approved', label: `✅ Approved (${data?.approved?.length || 0})` },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setSubTab(key)} style={{
            padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            border: '1px solid',
            borderColor: subTab === key ? (key === 'approved' ? '#28c76f' : '#ffc107') : 'rgba(255,255,255,0.12)',
            background: subTab === key
              ? (key === 'approved' ? 'rgba(40,199,111,0.12)' : 'rgba(255,193,7,0.12)')
              : 'rgba(255,255,255,0.04)',
            color: subTab === key
              ? (key === 'approved' ? '#28c76f' : '#ffc107')
              : 'rgba(255,255,255,0.5)',
            cursor: 'pointer',
          }}>{label}</button>
        ))}
        <input
          placeholder="Search tasks..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ marginLeft: 'auto', minWidth: 200, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 12px', color: '#e8eaff', fontSize: 13, outline: 'none' }}
        />
      </div>

      {/* Loading / error / empty */}
      {loading && <div style={{ textAlign: 'center', padding: 32, color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Loading task plan from Google Sheets…</div>}
      {!loading && error && (
        <div style={{ padding: 16, borderRadius: 10, background: 'rgba(234,84,85,0.1)', border: '1px solid rgba(234,84,85,0.3)', color: '#ea5455', fontSize: 13 }}>⚠️ {error}</div>
      )}
      {!loading && !error && filteredTasks.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 24px', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>{subTab === 'approved' ? '✅' : '⏳'}</div>
          {search ? 'No matching tasks.' : subTab === 'approved' ? 'No approved tasks.' : 'No tasks pending approval.'}
        </div>
      )}

      {/* Column header */}
      {!loading && !error && filteredTasks.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '6px 14px 6px 14px', marginBottom: 4,
          fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
          color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}>
          <div style={{ flexShrink: 0, minWidth: 48 }}>Week</div>
          <div style={{ flex: 1 }}>Task · Workstream</div>
          <div style={{ width: 70, textAlign: 'right', color: 'rgba(155,89,182,0.6)' }}>$ Cost</div>
          <div style={{ width: 80, textAlign: 'center' }}>Status</div>
          <div style={{ width: 80, textAlign: 'center' }}>Approval</div>
          <div style={{ width: 16 }} />
        </div>
      )}

      {/* Task groups */}
      {!loading && !error && Object.entries(grouped).map(([week, tasks]) => (
        <WeekGroup
          key={week}
          label={week}
          tasks={tasks}
          showApproveButton={subTab === 'pending'}
          onApproved={handleApproved}
          onCostSaved={load}
        />
      ))}

      {/* Cost summary by workstream */}
      {!loading && !error && data?.costSummary?.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            💰 Cost by Workstream
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.costSummary.map(ws => {
              const maxCost = Math.max(...data.costSummary.map(x => x.totalCost), 0.01);
              const pct = maxCost > 0 ? Math.max(2, (ws.totalCost / maxCost) * 100) : 0;
              const c = wsColor(ws.workstream);
              return (
                <div key={ws.workstream} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 130, fontSize: 12, color: 'rgba(255,255,255,0.6)', flexShrink: 0, textAlign: 'right' }}>{ws.workstream}</div>
                  <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg,${c}cc,${c}66)`, borderRadius: 4 }} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: c, width: 60, textAlign: 'right' }}>
                    {ws.totalCost > 0 ? `$${ws.totalCost.toFixed(2)}` : '—'}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', width: 55 }}>{ws.tasks} task{ws.tasks !== 1 ? 's' : ''}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
