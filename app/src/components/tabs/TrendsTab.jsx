import { useState, useEffect } from 'react';
import { authHeaders } from '../LoginGate';

const API = import.meta.env.VITE_API_BASE || '';

// ── Colour tokens ────────────────────────────────────────────────────────────
const C = {
  user:    '#f59e0b',   // gold
  routine: '#10b981',  // green
  dev:     '#3b82f6',  // blue
  total:   '#8b5cf6',  // purple
  grid:    'rgba(255,255,255,0.07)',
  bg:      'var(--card-bg, #1e2030)',
  text:    'var(--text-main, #e2e8f0)',
  muted:   'var(--text-muted, #64748b)',
};

// ── Simple SVG stacked-bar chart ─────────────────────────────────────────────
function StackedBarChart({ series, window }) {
  const W = 820, H = 220, PAD = { top: 20, right: 20, bottom: 50, left: 56 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const visible = series.filter(s => window === 'all' || s.hasData || series.indexOf(s) >= series.length - (window === '7d' ? 7 : 14));
  const windowed = window === '7d' ? visible.slice(-7) : window === '14d' ? visible.slice(-14) : visible;
  const n = windowed.length;
  if (!n) return <div style={{ color: C.muted, padding: 24 }}>No data yet</div>;

  const maxCost = Math.max(...windowed.map(d => d.costTotal), 0.01);
  const barW = Math.max(4, (chartW / n) * 0.65);
  const gap = chartW / n;

  const yTick = (val) => PAD.top + chartH * (1 - val / maxCost);
  const gridLines = 4;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {/* Grid lines */}
      {Array.from({ length: gridLines + 1 }, (_, i) => {
        const v = (maxCost * i) / gridLines;
        const y = yTick(v);
        return (
          <g key={i}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke={C.grid} strokeWidth={1} />
            <text x={PAD.left - 6} y={y + 4} fill={C.muted} fontSize={10} textAnchor="end">
              ${v >= 1 ? v.toFixed(1) : v.toFixed(2)}
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {windowed.map((d, i) => {
        const x = PAD.left + i * gap + (gap - barW) / 2;
        const segments = [
          { val: d.costUser,    color: C.user },
          { val: d.costRoutine, color: C.routine },
          { val: d.costDev,     color: C.dev },
        ];
        // If we have API total but no category split, show as one bar
        const segSum = d.costUser + d.costRoutine + d.costDev;
        const bars = segSum > 0.001 ? segments : [{ val: d.costTotal, color: C.total }];

        let stackY = PAD.top + chartH; // start at bottom
        return (
          <g key={d.date}>
            {bars.map((seg, si) => {
              if (!seg.val) return null;
              const bH = (seg.val / maxCost) * chartH;
              stackY -= bH;
              return (
                <rect key={si} x={x} y={stackY} width={barW} height={bH}
                  fill={seg.color} opacity={0.85} rx={2} />
              );
            })}
            {/* X label */}
            <text x={x + barW / 2} y={H - PAD.bottom + 14} fill={C.muted} fontSize={9}
              textAnchor="middle" transform={`rotate(-35, ${x + barW / 2}, ${H - PAD.bottom + 14})`}>
              {d.label}
            </text>
            {/* Cost label on bar if space */}
            {d.costTotal >= maxCost * 0.1 && (
              <text x={x + barW / 2} y={yTick(d.costTotal) - 4} fill={C.text} fontSize={9} textAnchor="middle">
                ${d.costTotal.toFixed(2)}
              </text>
            )}
          </g>
        );
      })}

      {/* Axes */}
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + chartH} stroke={C.muted} strokeWidth={1} />
      <line x1={PAD.left} y1={PAD.top + chartH} x2={W - PAD.right} y2={PAD.top + chartH} stroke={C.muted} strokeWidth={1} />
    </svg>
  );
}

// ── Task count bar chart ──────────────────────────────────────────────────────
function TaskBarChart({ series, window }) {
  const W = 820, H = 180, PAD = { top: 16, right: 20, bottom: 46, left: 48 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const windowed = window === '7d' ? series.slice(-7) : window === '14d' ? series.slice(-14) : series;
  const n = windowed.length;
  if (!n) return null;

  const maxT = Math.max(...windowed.map(d => d.tasks), 1);
  const barW = Math.max(4, (chartW / n) * 0.65);
  const gap = chartW / n;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {[0, Math.round(maxT / 2), maxT].map((v, i) => {
        const y = PAD.top + chartH * (1 - v / maxT);
        return (
          <g key={i}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke={C.grid} strokeWidth={1} />
            <text x={PAD.left - 6} y={y + 4} fill={C.muted} fontSize={10} textAnchor="end">{v}</text>
          </g>
        );
      })}
      {windowed.map((d, i) => {
        const x = PAD.left + i * gap + (gap - barW) / 2;
        const segs = [
          { v: d.tasksUser,    c: C.user },
          { v: d.tasksRoutine, c: C.routine },
          { v: d.tasksDev,     c: C.dev },
        ];
        let sy = PAD.top + chartH;
        return (
          <g key={d.date}>
            {segs.map((seg, si) => {
              if (!seg.v) return null;
              const bH = (seg.v / maxT) * chartH;
              sy -= bH;
              return <rect key={si} x={x} y={sy} width={barW} height={bH} fill={seg.c} opacity={0.85} rx={2} />;
            })}
            {d.tasks > 0 && (
              <text x={x + barW / 2} y={PAD.top + chartH * (1 - d.tasks / maxT) - 3}
                fill={C.text} fontSize={9} textAnchor="middle">{d.tasks}</text>
            )}
            <text x={x + barW / 2} y={H - PAD.bottom + 13} fill={C.muted} fontSize={9}
              textAnchor="middle" transform={`rotate(-35, ${x + barW / 2}, ${H - PAD.bottom + 13})`}>
              {d.label}
            </text>
          </g>
        );
      })}
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + chartH} stroke={C.muted} strokeWidth={1} />
      <line x1={PAD.left} y1={PAD.top + chartH} x2={W - PAD.right} y2={PAD.top + chartH} stroke={C.muted} strokeWidth={1} />
    </svg>
  );
}

// ── Cost trend line (dev costs) ───────────────────────────────────────────────
function TrendLine({ series, window }) {
  const W = 820, H = 140, PAD = { top: 16, right: 20, bottom: 30, left: 56 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const windowed = window === '7d' ? series.slice(-7) : window === '14d' ? series.slice(-14) : series;
  const n = windowed.length;
  if (n < 2) return null;

  const lines = [
    { key: 'costTotal',   label: 'Total',    color: C.total,   dash: '' },
    { key: 'costUser',    label: 'Ed Tasks', color: C.user,    dash: '4,3' },
    { key: 'costRoutine', label: 'Routine',  color: C.routine, dash: '2,3' },
    { key: 'costDev',     label: 'Dev',      color: C.dev,     dash: '6,2' },
  ];

  const maxV = Math.max(...windowed.map(d => d.costTotal), 0.01);
  const xOf = (i) => PAD.left + (i / (n - 1)) * chartW;
  const yOf = (v) => PAD.top + chartH * (1 - v / maxV);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {/* Grid */}
      {[0, maxV / 2, maxV].map((v, i) => (
        <g key={i}>
          <line x1={PAD.left} y1={yOf(v)} x2={W - PAD.right} y2={yOf(v)} stroke={C.grid} strokeWidth={1} />
          <text x={PAD.left - 6} y={yOf(v) + 4} fill={C.muted} fontSize={10} textAnchor="end">
            ${v >= 1 ? v.toFixed(1) : v.toFixed(2)}
          </text>
        </g>
      ))}
      {/* Lines */}
      {lines.map(({ key, color, dash }) => {
        const pts = windowed.map((d, i) => `${xOf(i)},${yOf(d[key] || 0)}`).join(' ');
        return (
          <polyline key={key} points={pts} fill="none" stroke={color}
            strokeWidth={key === 'costTotal' ? 2 : 1.5} strokeDasharray={dash} opacity={0.9} />
        );
      })}
      {/* Dots on total */}
      {windowed.map((d, i) => (
        <circle key={i} cx={xOf(i)} cy={yOf(d.costTotal)} r={3} fill={C.total} />
      ))}
      {/* X ticks */}
      {windowed.filter((_, i) => i % Math.ceil(n / 7) === 0).map((d, i, arr) => {
        const idx = windowed.indexOf(d);
        return (
          <text key={i} x={xOf(idx)} y={H - 4} fill={C.muted} fontSize={9} textAnchor="middle">{d.label}</text>
        );
      })}
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + chartH} stroke={C.muted} strokeWidth={1} />
      <line x1={PAD.left} y1={PAD.top + chartH} x2={W - PAD.right} y2={PAD.top + chartH} stroke={C.muted} strokeWidth={1} />
    </svg>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────
function Legend() {
  const items = [
    { color: C.user,    label: 'Ed Tasks' },
    { color: C.routine, label: 'Routine' },
    { color: C.dev,     label: 'Developer' },
    { color: C.total,   label: 'Total (API)' },
  ];
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 4 }}>
      {items.map(({ color, label }) => (
        <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-muted)' }}>
          <span style={{ width: 12, height: 12, borderRadius: 2, background: color, display: 'inline-block' }} />
          {label}
        </span>
      ))}
    </div>
  );
}

// ── Summary row ───────────────────────────────────────────────────────────────
function SummaryRow({ series, window }) {
  const windowed = window === '7d' ? series.slice(-7) : window === '14d' ? series.slice(-14) : series;
  const withData = windowed.filter(d => d.hasData);
  if (!withData.length) return null;

  const totCost = withData.reduce((s, d) => s + d.costTotal, 0);
  const totTasks = withData.reduce((s, d) => s + d.tasks, 0);
  const avgCost = totCost / withData.length;
  const avgTasks = totTasks / withData.length;
  const devCosts = withData.map(d => d.costDev);
  const devTrend = devCosts.length > 1
    ? ((devCosts[devCosts.length - 1] - devCosts[0]) / (devCosts[0] || 0.001) * 100).toFixed(0)
    : '—';

  const stat = (label, value, sub) => (
    <div key={label} style={{ background: 'var(--sidebar-bg,#161927)', borderRadius: 8, padding: '10px 16px', minWidth: 120 }}>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: C.muted }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
      {stat('Total Cost', `$${totCost.toFixed(2)}`, `${withData.length}d window`)}
      {stat('Avg Cost/Day', `$${avgCost.toFixed(2)}`, 'from Anthropic API')}
      {stat('Total Tasks', totTasks, `${withData.length} days logged`)}
      {stat('Avg Tasks/Day', avgTasks.toFixed(1), 'self-reported')}
      {stat('Dev Cost Trend', devCosts[devCosts.length-1] > devCosts[0] ? `↑ ${devTrend}%` : `↓ ${Math.abs(devTrend)}%`,
        'first → last day')}
    </div>
  );
}

// ── Delta badge ──────────────────────────────────────────────────────────────
function DeltaBadge({ current, compare, unit = '' }) {
  if (current == null || compare == null) return null;
  const delta = current - compare;
  const pct = compare > 0 ? Math.round((delta / compare) * 100) : null;
  if (delta === 0) return <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>= same</span>;
  const up = delta > 0;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: up ? '#22C55E' : '#EF4444' }}>
      {up ? '▲' : '▼'} {unit}{Math.abs(delta).toFixed(unit === '$' ? 2 : 0)}{pct != null ? ` (${pct > 0 ? '+' : ''}${pct}%)` : ''}
    </span>
  );
}

// ── Comparison card ──────────────────────────────────────────────────────────
function CompareCard({ label, current, compare, currentLabel, compareLabel, color, unit = '' }) {
  const fmt = (v) => v == null ? '—' : unit === '$' ? `$${Number(v).toFixed(2)}` : String(v);
  return (
    <div style={{ flex: 1, minWidth: 180, padding: '14px 18px', borderRadius: 12,
      background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}30`, borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>{label}</div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color }}>{fmt(current)}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{currentLabel}</div>
        </div>
        <div style={{ opacity: 0.6 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>{fmt(compare)}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{compareLabel}</div>
        </div>
      </div>
      <DeltaBadge current={current} compare={compare} unit={unit === '$' ? '$' : ''} />
    </div>
  );
}

// ── Comparison banner (Today vs Yesterday / This Week vs Last Week) ───────────
function ComparisonBanner({ series, mode }) {
  const withData = series.filter(s => s.hasData);
  if (withData.length < 2) {
    return <div style={{ padding: 16, color: C.muted, fontSize: 13 }}>Not enough daily data yet for comparison.</div>;
  }

  let current, prior, currentLabel, priorLabel;

  if (mode === 'today') {
    // Last entry = today (or most recent), second-to-last = yesterday
    current = withData[withData.length - 1];
    prior   = withData[withData.length - 2];
    currentLabel = 'Today';
    priorLabel   = 'Yesterday';
  } else {
    // This week vs last week — split into two 7-day halves
    const last14 = withData.slice(-14);
    const thisWeek = last14.slice(-7);
    const lastWeek = last14.slice(0, 7);
    const sum = (arr, key) => arr.reduce((s, d) => s + (d[key] || 0), 0);
    current = {
      costTotal: sum(thisWeek, 'costTotal'), tasks: sum(thisWeek, 'tasks'),
      costUser: sum(thisWeek, 'costUser'), costRoutine: sum(thisWeek, 'costRoutine'),
      costDev: sum(thisWeek, 'costDev'),
    };
    prior = {
      costTotal: sum(lastWeek, 'costTotal'), tasks: sum(lastWeek, 'tasks'),
      costUser: sum(lastWeek, 'costUser'), costRoutine: sum(lastWeek, 'costRoutine'),
      costDev: sum(lastWeek, 'costDev'),
    };
    currentLabel = 'This Week';
    priorLabel   = 'Last Week';
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 12 }}>
        {currentLabel} vs {priorLabel}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <CompareCard label="Total Cost" current={current.costTotal} compare={prior.costTotal}
          currentLabel={currentLabel} compareLabel={priorLabel} color={C.total} unit="$" />
        <CompareCard label="Ed Tasks Cost" current={current.costUser} compare={prior.costUser}
          currentLabel={currentLabel} compareLabel={priorLabel} color={C.user} unit="$" />
        <CompareCard label="Routine Cost" current={current.costRoutine} compare={prior.costRoutine}
          currentLabel={currentLabel} compareLabel={priorLabel} color={C.routine} unit="$" />
        <CompareCard label="Dev Cost" current={current.costDev} compare={prior.costDev}
          currentLabel={currentLabel} compareLabel={priorLabel} color={C.dev} unit="$" />
        <CompareCard label="Tasks Completed" current={current.tasks} compare={prior.tasks}
          currentLabel={currentLabel} compareLabel={priorLabel} color="#8b5cf6" />
      </div>
    </div>
  );
}

// ── Main TrendsTab ────────────────────────────────────────────────────────────
export default function TrendsTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [window, setWindow] = useState('today'); // default: Today vs Yesterday
  const [view, setView] = useState('cost'); // 'cost' | 'tasks' | 'trends'
  const [contactMetrics, setContactMetrics] = useState(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        const r = await fetch(`${API}/api/cost/history?days=${days}`, { headers: authHeaders() });
        const d = await r.json();
        setData(d);
      } catch (e) {
        console.error('Trends fetch error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [days]);

  useEffect(() => {
    const token = localStorage.getItem('cc_auth_token') || localStorage.getItem('authToken') || '';
    fetch('/api/contacts/metrics', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => setContactMetrics(d))
      .catch(() => {});
  }, []);

  if (loading) return <div style={{ padding: 40, color: C.muted, textAlign: 'center' }}>Loading time series data…</div>;
  if (!data?.series) return <div style={{ padding: 40, color: C.muted }}>No time series data available.</div>;

  const { series } = data;
  const hasData = series.some(s => s.hasData);

  const isCompare = window === 'today' || window === 'week';
  // For chart windows, map compare modes to chart window sizes
  const chartWindow = window === 'today' ? '7d' : window === 'week' ? '14d' : window;

  const btnStyle = (active) => ({
    padding: '5px 14px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)',
    background: active ? 'var(--accent-color,#6366f1)' : 'transparent',
    color: active ? '#fff' : C.muted, cursor: 'pointer', fontSize: 12, fontWeight: active ? 600 : 400,
  });

  const section = (title, chart) => (
    <div style={{ background: C.bg, borderRadius: 10, padding: '16px 18px', marginBottom: 16, border: '1px solid rgba(255,255,255,0.07)' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</div>
      {chart}
    </div>
  );

  const WINDOW_BTNS = [
    { id: 'today', label: 'Today vs Yesterday' },
    { id: 'week',  label: 'This Week vs Last Week' },
    { id: '7d',    label: '7d' },
    { id: '14d',   label: '14d' },
  ];

  return (
    <div style={{ padding: '0 0 40px' }}>
      {/* Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: C.text }}>📈 Time Series &amp; Trends</h2>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
            Cost from Anthropic API (source of truth) · Task counts from activity log
            {!hasData && ' · Data collection started Apr 3, 2026'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Date range selector */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: C.muted, marginRight: 2 }}>Range:</span>
            {[7, 14, 30, 60, 90].map(d => (
              <button key={d} onClick={() => setDays(d)} style={{
                ...btnStyle(days === d),
                padding: '4px 10px', fontSize: 11,
              }}>{d}d</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4, marginLeft: 4 }}>
            {WINDOW_BTNS.map(({ id, label }) => (
              <button key={id} style={btnStyle(window === id)} onClick={() => setWindow(id)}>{label}</button>
            ))}
          </div>
          {!isCompare && (
            <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
              {[['cost', '💰 Cost'], ['tasks', '✅ Tasks'], ['trends', '📉 Trend Lines']].map(([v, label]) => (
                <button key={v} style={btnStyle(view === v)} onClick={() => setView(v)}>{label}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Comparison banner — highest priority view */}
      {isCompare && <ComparisonBanner series={series} mode={window} />}

      {/* Summary stats (non-compare modes) */}
      {!isCompare && <SummaryRow series={series} window={chartWindow} />}

      {/* Calls Scheduled metric */}
      {contactMetrics?.combined && (
        <div style={{ padding: '14px 18px', borderRadius: 10, background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)', marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: '#22C55E', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>Calls Scheduled (All Campaigns)</div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#22C55E' }}>{contactMetrics.combined.calls_scheduled}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total</div>
            </div>
            {contactMetrics.byAgent?.laura && (
              <div>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#06E5EC' }}>{contactMetrics.byAgent.laura.calls_scheduled}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Laura</div>
              </div>
            )}
            {contactMetrics.byAgent?.darren && (
              <div>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#F59E0B' }}>{contactMetrics.byAgent.darren.calls_scheduled}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Darren</div>
              </div>
            )}
          </div>
        </div>
      )}

      <Legend />

      {/* Charts (always shown, comparison mode shows last 7/14d context) */}
      {(view === 'cost' || view === 'trends' || isCompare) && section('Daily Cost by Category (USD)', <StackedBarChart series={series} window={chartWindow} />)}
      {(view === 'tasks' && !isCompare) && section('Tasks Completed Per Day', <TaskBarChart series={series} window={chartWindow} />)}
      {(view === 'trends' && !isCompare) && section('Cost Trend Lines (All Categories)', <TrendLine series={series} window={chartWindow} />)}

      {/* Data table */}
      <div style={{ background: C.bg, borderRadius: 10, padding: '16px 18px', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Daily Breakdown Table</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                {['Date', 'Total Cost', 'Ed Tasks $', 'Routine $', 'Dev $', 'Tasks', 'User', 'Routine', 'Dev'].map(h => (
                  <th key={h} style={{ padding: '6px 10px', textAlign: h === 'Date' ? 'left' : 'right', color: C.muted, fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(chartWindow === '7d' ? series.slice(-7) : series.slice(-14)).filter(d => d.hasData).reverse().map(d => (
                <tr key={d.date} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '6px 10px', color: C.text, fontWeight: 500 }}>{d.date}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', color: C.total, fontWeight: 700 }}>${d.costTotal.toFixed(2)}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', color: C.user }}>${d.costUser.toFixed(2)}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', color: C.routine }}>${d.costRoutine.toFixed(2)}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', color: C.dev }}>${d.costDev.toFixed(2)}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', color: C.text }}>{d.tasks}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', color: C.user }}>{d.tasksUser}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', color: C.routine }}>{d.tasksRoutine}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', color: C.dev }}>{d.tasksDev}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
