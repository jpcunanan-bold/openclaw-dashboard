import { useState, useEffect, useCallback } from 'react';
import { authHeaders } from '../LoginGate';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt$(n, fallback = '$0.00') {
  const v = Number(n) || 0;
  return v === 0 ? fallback : `$${v.toFixed(2)}`;
}
function fmtModelName(m = '') {
  return m.replace('claude-', '').replace(/-20\d{6}/, '').replace('4-6','4.6').replace('4-5','4.5');
}
function modelColor(name = '') {
  const n = (name || '').toLowerCase();
  if (n.includes('opus'))   return '#9b59b6';
  if (n.includes('sonnet')) return '#06E5EC';
  if (n.includes('haiku'))  return '#28c76f';
  return '#e67e22';
}
function parseEstCost(raw = '') {
  // handles ~$53.43 (est.) or $53.43 or — 
  return parseFloat(String(raw).replace(/[^0-9.]/g, '')) || 0;
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, color = '#06E5EC', live = false }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${live ? 'rgba(40,199,111,0.35)' : `${color}30`}`,
      borderTop: `3px solid ${live ? '#28c76f' : color}`,
      borderRadius: 10, padding: '16px 18px',
      flex: '1 1 130px', minWidth: 0, position: 'relative',
    }}>
      {live && <span style={{ position: 'absolute', top: 8, right: 10, fontSize: 8, fontWeight: 700,
        letterSpacing: 1, color: '#28c76f', border: '1px solid rgba(40,199,111,0.4)', borderRadius: 3, padding: '1px 4px' }}>LIVE</span>}
      <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: live ? '#28c76f' : color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── Period bar row ────────────────────────────────────────────────────────────
function BarRow({ label, cost, maxCost, color = '#06E5EC', isToday, isLive, sub }) {
  const pct = maxCost > 0 ? Math.max(cost > 0 ? 2 : 0, (cost / maxCost) * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: isToday ? '#e8eaff' : 'rgba(255,255,255,0.6)', fontWeight: isToday ? 700 : 400 }}>{label}</span>
          {isLive && <span style={{ fontSize: 8, fontWeight: 700, color: '#28c76f', border: '1px solid rgba(40,199,111,0.4)', borderRadius: 3, padding: '1px 4px' }}>LIVE</span>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color }}>{fmt$(cost)}</span>
          {sub && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginLeft: 8 }}>{sub}</span>}
        </div>
      </div>
      <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`,
          background: isToday
            ? 'linear-gradient(90deg,#28c76f,rgba(40,199,111,0.6))'
            : `linear-gradient(90deg,${color}cc,${color}55)`,
          borderRadius: 4, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}

// ── Model pill ────────────────────────────────────────────────────────────────
function ModelPill({ model, cost, pct }) {
  const c = modelColor(model);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7,
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', marginBottom: 5 }}>
      <div style={{ width: 9, height: 9, borderRadius: '50%', background: c, flexShrink: 0 }} />
      <div style={{ flex: 1, fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>{fmtModelName(model)}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: c }}>{fmt$(cost)}</div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', minWidth: 32, textAlign: 'right' }}>{pct}%</div>
    </div>
  );
}

// ── Hourly chart ──────────────────────────────────────────────────────────────
function HourlyChart({ hourly }) {
  if (!hourly?.length) return null;
  const byHour = {};
  for (const h of hourly) byHour[h.hour] = (byHour[h.hour] || 0) + (h.costUsd ?? h.cost ?? 0);
  const entries = Object.entries(byHour).sort();
  const maxH = Math.max(...entries.map(([,c]) => c), 0.001);
  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 9, padding: '12px 14px', marginTop: 14 }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>Spend by hour (UTC)</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 44 }}>
        {entries.map(([hr, c]) => (
          <div key={hr} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '1 0 14px' }}
            title={`${hr} UTC — ${fmt$(c)}`}>
            <div style={{ width: '100%', height: Math.max(4, (c / maxH) * 40), background: 'linear-gradient(180deg,#28c76f,#06E5EC)', borderRadius: '2px 2px 0 0', minWidth: 6 }} />
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)', marginTop: 2 }}>{hr.slice(0,2)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Task sheet row with sync button ──────────────────────────────────────────
function TaskSheetRow({ task, onSync, syncing, synced }) {
  const estCost = parseEstCost(task.estimatedCost);
  const isEst   = (task.estimatedCost || '').includes('est');
  const isDash  = !task.estimatedCost || task.estimatedCost === '—';
  const statusIcon = (s = '') => {
    if (s.includes('✅') || s.includes('Done')) return '✅';
    if (s.includes('🔄') || s.includes('Progress')) return '🔄';
    if (s.includes('⏳')) return '⏳';
    return '📋';
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      background: synced ? 'rgba(40,199,111,0.04)' : 'transparent' }}>
      <span style={{ fontSize: 13, flexShrink: 0 }}>{statusIcon(task.status)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: '#e8eaff', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {task.num && <span style={{ color: 'rgba(255,255,255,0.3)', marginRight: 5 }}>#{task.num}</span>}
          {task.title}
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>
          {task.campaign && <span style={{ color: '#06E5EC88', marginRight: 6 }}>{task.campaign}</span>}
          {task.week}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 80 }}>
        {isDash ? (
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>no cost</span>
        ) : (
          <span style={{ fontSize: 12, fontWeight: 700, color: isEst ? 'rgba(255,193,7,0.8)' : '#06E5EC' }}>
            {isEst ? '~' : ''}{fmt$(estCost)}
            {isEst && <span style={{ fontSize: 9, color: 'rgba(255,193,7,0.5)', marginLeft: 3 }}>est</span>}
          </span>
        )}
      </div>
      {!isDash && isEst && (
        <button
          onClick={() => onSync(task)}
          disabled={syncing || synced}
          title="Write actual cost to sheet"
          style={{
            padding: '4px 9px', borderRadius: 6, fontSize: 10, fontWeight: 700,
            border: '1px solid',
            borderColor: synced ? 'rgba(40,199,111,0.5)' : 'rgba(6,229,236,0.4)',
            background: synced ? 'rgba(40,199,111,0.1)' : 'rgba(6,229,236,0.07)',
            color: synced ? '#28c76f' : '#06E5EC',
            cursor: syncing || synced ? 'default' : 'pointer',
            flexShrink: 0, whiteSpace: 'nowrap',
          }}>
          {synced ? '✅ synced' : syncing ? '…' : '→ sheet'}
        </button>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function CostBreakdownTab() {
  const [data,     setData]    = useState(null);
  const [tasks,    setTasks]   = useState([]);
  const [loading,  setLoading] = useState(true);
  const [error,    setError]   = useState(null);
  const [period,   setPeriod]  = useState('daily');
  const [syncing,  setSyncing] = useState({}); // sheetRow → bool
  const [synced,   setSynced]  = useState({}); // sheetRow → bool

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [bRes, tRes] = await Promise.all([
        fetch(`/api/cost/breakdown?period=${period}`, { headers: authHeaders() }),
        fetch('/api/task-list-sheet', { headers: authHeaders() }),
      ]);
      if (!bRes.ok) throw new Error(`Cost API: HTTP ${bRes.status}`);
      const bd = await bRes.json();
      if (!bd.ok) throw new Error(bd.error || 'Cost API error');
      setData(bd);
      if (tRes.ok) {
        const td = await tRes.json();
        setTasks(td.tasks || []);
      }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  // Sync task's estimated cost to sheet as actual cost
  async function handleSync(task) {
    if (!task.sheetRow) return;
    setSyncing(s => ({ ...s, [task.sheetRow]: true }));
    try {
      const cost = parseEstCost(task.estimatedCost);
      const r = await fetch('/api/cost/write-to-sheet', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: 'laura', sheetRow: task.sheetRow, costUsd: cost }),
      });
      if (r.ok) setSynced(s => ({ ...s, [task.sheetRow]: true }));
    } catch (e) { console.error('Sync failed:', e.message); }
    finally { setSyncing(s => ({ ...s, [task.sheetRow]: false })); }
  }

  if (loading) return (
    <div style={{ padding: '60px 28px', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>💰</div>
      Loading cost data…
    </div>
  );
  if (error) return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ padding: 18, borderRadius: 10, background: 'rgba(234,84,85,0.1)', border: '1px solid rgba(234,84,85,0.3)', color: '#ea5455' }}>⚠️ {error}</div>
    </div>
  );

  const { today = {}, summary = {}, daily = [], weekly = [], monthly = [] } = data || {};

  const series   = period === 'monthly' ? monthly : period === 'weekly' ? weekly : daily;
  const labelKey = period === 'monthly' ? 'month' : period === 'weekly' ? 'weekOf' : 'date';
  const maxCost  = Math.max(...series.map(s => s.cost), 0.01);

  // All models across selected period
  const allModels = {};
  series.forEach(s => Object.entries(s.byModel || {}).forEach(([m, c]) => { allModels[m] = (allModels[m] || 0) + c; }));
  const modelEntries    = Object.entries(allModels).sort((a, b) => b[1] - a[1]);
  const totalForPeriod  = modelEntries.reduce((s, [, c]) => s + c, 0);

  const todayModels = Object.entries(today.byModel || {}).sort((a, b) => {
    const ca = typeof b[1] === 'object' ? b[1].costUsd : b[1];
    const cb = typeof a[1] === 'object' ? a[1].costUsd : a[1];
    return ca - cb;
  });
  const todayTotal = today.cost || 0;

  // Laura's tasks that have cost estimates (not — )
  const tasksWithCost = tasks.filter(t => t.estimatedCost && t.estimatedCost !== '—' && t.estimatedCost !== '');
  const tasksNoCost   = tasks.filter(t => !t.estimatedCost || t.estimatedCost === '—');

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 22 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#e8eaff' }}>💰 Laura — Cost Breakdown</h2>
          <p style={{ margin: '5px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
            Source: <strong style={{ color: 'rgba(255,255,255,0.6)' }}>Anthropic Admin API</strong> · token usage indexed by date · {summary.daysTracked || 0} days tracked
          </p>
        </div>
        <button onClick={load} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, border: '1px solid rgba(6,229,236,0.3)', background: 'rgba(6,229,236,0.07)', color: '#06E5EC', cursor: 'pointer' }}>
          ↻ Refresh
        </button>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <KpiCard icon="📅" label="Today"      value={fmt$(summary.today)}     color="#28c76f" live />
        <KpiCard icon="📆" label="This Week"  value={fmt$(summary.thisWeek)}  color="#06E5EC" />
        <KpiCard icon="🗓️" label="This Month" value={fmt$(summary.thisMonth)} color="#ffc107" />
        <KpiCard icon="🏦" label="All Time"   value={fmt$(summary.allTime)}   color="#9b59b6" sub={`${summary.daysTracked || 0} days`} />
      </div>

      {/* ── TODAY LIVE BLOCK ── */}
      <div style={{
        marginBottom: 18, padding: '16px 20px',
        background: 'rgba(40,199,111,0.04)', border: '1px solid rgba(40,199,111,0.2)', borderRadius: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#28c76f', boxShadow: '0 0 6px #28c76f' }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#e8eaff' }}>Today — {today.date}</span>
          <span style={{ fontSize: 10, color: '#28c76f', fontWeight: 700 }}>LIVE</span>
          <span style={{ marginLeft: 'auto', fontSize: 20, fontWeight: 800, color: '#28c76f' }}>{fmt$(todayTotal)}</span>
        </div>
        {todayModels.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 5 }}>
            {todayModels.map(([model, stats]) => {
              const cost = typeof stats === 'object' ? stats.costUsd : Number(stats);
              return <ModelPill key={model} model={model} cost={cost} pct={todayTotal > 0 ? Math.round((cost / todayTotal) * 100) : 0} />;
            })}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '10px 0' }}>
            No spend yet today — updates hourly
          </div>
        )}
        <HourlyChart hourly={today.hourly} />
      </div>

      {/* ── PERIOD SELECTOR + CHART ── */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '18px 20px', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>
            Spend over time — {period}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['daily', 'weekly', 'monthly'].map(p => (
              <button key={p} onClick={() => setPeriod(p)} style={{
                padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                border: `1px solid ${period === p ? '#06E5EC' : 'rgba(255,255,255,0.12)'}`,
                background: period === p ? 'rgba(6,229,236,0.12)' : 'rgba(255,255,255,0.03)',
                color: period === p ? '#06E5EC' : 'rgba(255,255,255,0.45)',
                cursor: 'pointer', textTransform: 'capitalize',
              }}>{p}</button>
            ))}
          </div>
        </div>

        {series.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>No data for this period</div>
        ) : (
          <div style={{ maxHeight: 480, overflowY: 'auto' }}>
            {[...series].reverse().map(s => {
              const key = s[labelKey];
              const isToday = key === today.date;
              const label = period === 'monthly'
                ? new Date(key + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                : period === 'weekly'
                ? `Week of ${new Date(key + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                : new Date(key + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
              return (
                <BarRow key={key} label={label} cost={s.cost} maxCost={maxCost}
                  color={isToday ? '#28c76f' : '#06E5EC'}
                  sub={s.daysCount ? `${s.daysCount}d` : undefined}
                  isToday={isToday} isLive={isToday || s.isLive} />
              );
            })}
          </div>
        )}
      </div>

      {/* Model breakdown for selected period */}
      {modelEntries.length > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px 20px', marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 12 }}>
            Model breakdown — {period} · {fmt$(totalForPeriod)} total
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 5 }}>
            {modelEntries.map(([model, cost]) => (
              <ModelPill key={model} model={model} cost={cost} pct={totalForPeriod > 0 ? Math.round((cost / totalForPeriod) * 100) : 0} />
            ))}
          </div>
        </div>
      )}

      {/* ── TASK SHEET COSTS ── */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden', marginBottom: 18 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>📋 Task List — Costs from Sheet</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
              {tasksWithCost.length} tasks with costs · {tasksNoCost.length} pending · click <strong style={{ color: '#06E5EC88' }}>→ sheet</strong> to write actual cost back
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
            ⚠️ est = estimate in sheet
          </div>
        </div>

        {tasksWithCost.length === 0 && (
          <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
            No task costs found in sheet — run tasks and sync
          </div>
        )}

        {tasksWithCost.map(task => (
          <TaskSheetRow
            key={task.sheetRow}
            task={task}
            onSync={handleSync}
            syncing={!!syncing[task.sheetRow]}
            synced={!!synced[task.sheetRow]}
          />
        ))}

        {tasksNoCost.length > 0 && (
          <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.1)', fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
            + {tasksNoCost.length} tasks with no cost logged yet
          </div>
        )}
      </div>

      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)', textAlign: 'center', marginTop: 8 }}>
        Token costs from Anthropic API (Laura API key · org discount applied) · Daily buckets indexed by date · Sheet = Task List col H
        {data?.cached && ' · (cached)'}
      </div>
    </div>
  );
}
