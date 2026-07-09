import { useState, useEffect, useCallback } from 'react';
import { authHeaders } from '../LoginGate';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt$(n, fallback = '$0.00') {
  const v = Number(n) || 0;
  return v < 0.001 ? fallback : `$${v.toFixed(v >= 10 ? 2 : 4)}`;
}
function fmtTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
    timeZone: 'America/New_York',
  });
}
function fmtDateShort(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });
}
function fmtTokens(n) {
  const v = Number(n) || 0;
  if (v === 0) return '—';
  return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v);
}

// ── Category meta ─────────────────────────────────────────────────────────────
const CAT_META = {
  'lead-gen':     { icon: '🎯', color: '#06E5EC' },
  'outreach':     { icon: '📤', color: '#3B82F6' },
  'enrichment':   { icon: '🔍', color: '#06E5EC' },
  'data-hygiene': { icon: '🧹', color: '#F59E0B' },
  'research':     { icon: '📊', color: '#22C55E' },
  'follow-up':    { icon: '🔁', color: '#0EA5E9' },
  'handoff':      { icon: '🤝', color: '#28c76f' },
  'admin':        { icon: '⚙️', color: 'rgba(255,255,255,0.35)' },
  'email':        { icon: '📧', color: '#6366F1' },
  'inbound':      { icon: '📥', color: '#EC4899' },
  'other':        { icon: '📌', color: '#94a3b8' },
};
function catMeta(c) { return CAT_META[(c||'').toLowerCase()] || { icon: '📌', color: '#94a3b8' }; }

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, color = '#8B5CF6', live = false }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${color}30`,
      borderTop: `3px solid ${live ? '#28c76f' : color}`,
      borderRadius: 10, padding: '16px 18px',
      flex: '1 1 140px', minWidth: 0, position: 'relative',
    }}>
      {live && (
        <span style={{
          position: 'absolute', top: 8, right: 10,
          fontSize: 8, fontWeight: 700, letterSpacing: 1,
          color: '#28c76f', border: '1px solid rgba(40,199,111,0.4)',
          borderRadius: 3, padding: '1px 4px',
        }}>LIVE</span>
      )}
      <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: live ? '#28c76f' : color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── Category pill ─────────────────────────────────────────────────────────────
function CatPill({ cat }) {
  const m = catMeta(cat);
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 10,
      background: `${m.color}18`, border: `1px solid ${m.color}40`, color: m.color,
      whiteSpace: 'nowrap',
    }}>
      {m.icon} {cat || 'other'}
    </span>
  );
}

// ── Activity row ──────────────────────────────────────────────────────────────
function ActivityRow({ act }) {
  const [open, setOpen] = useState(false);
  const m = catMeta(act.category);
  const actions = (() => {
    try { return Array.isArray(act.actions) ? act.actions : JSON.parse(act.actions || '[]'); }
    catch { return []; }
  })();

  return (
    <div
      onClick={() => setOpen(o => !o)}
      style={{
        padding: '10px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        cursor: 'pointer',
        background: open ? 'rgba(255,255,255,0.02)' : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>{m.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            color: '#e8eaff', fontWeight: 600, fontSize: 13,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {act.title}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span>{fmtTime(act.timestamp || act.created_at)}</span>
            {act.requestedBy && act.requestedBy !== 'System' && (
              <span style={{ color: '#06E5EC' }}>by {act.requestedBy}</span>
            )}
            {act.costUsd > 0 && (
              <span style={{ color: '#F59E0B' }}>💰 {fmt$(act.costUsd)}</span>
            )}
            {act.timeSavedMin > 0 && (
              <span style={{ color: '#28c76f' }}>⏱ {act.timeSavedMin}m saved</span>
            )}
            {act.totalTokens > 0 && (
              <span style={{ color: 'rgba(255,255,255,0.25)' }}>{fmtTokens(act.totalTokens)} tok</span>
            )}
          </div>
        </div>
        {act.category && <CatPill cat={act.category} />}
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', flexShrink: 0, marginLeft: 4 }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ marginTop: 8, paddingLeft: 25 }}>
          {act.request && act.request !== act.title && (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6, fontStyle: 'italic' }}>
              "{act.request}"
            </div>
          )}
          {actions.length > 0 && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', lineHeight: 1.7 }}>
              {actions.slice(0, 6).map((a, i) => <div key={i}>· {a}</div>)}
              {actions.length > 6 && <div style={{ color: 'rgba(255,255,255,0.2)' }}>+{actions.length - 6} more…</div>}
            </div>
          )}
          {act.model && (
            <div style={{ marginTop: 6, fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
              🤖 {act.model.replace('anthropic/','')} &nbsp;·&nbsp; 
              in {fmtTokens(act.inputTokens)} / out {fmtTokens(act.outputTokens)} / cr {fmtTokens(act.cacheReadTokens)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Mini bar ──────────────────────────────────────────────────────────────────
function MiniBar({ label, value, max, color, right }) {
  const p = max > 0 && value > 0 ? Math.max(3, (value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
        <span style={{ color: 'rgba(255,255,255,0.6)' }}>{label}</span>
        <span style={{ color, fontWeight: 700 }}>{right ?? value}</span>
      </div>
      <div style={{ height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.06)' }}>
        <div style={{ height: '100%', borderRadius: 4, background: `linear-gradient(90deg,${color}cc,${color}44)`, width: `${p}%`, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  );
}

// ── Sparkline bar chart (daily) ───────────────────────────────────────────────
function DailyBars({ rows }) {
  if (!rows || rows.length === 0) {
    return <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, textAlign: 'center', padding: '24px 0' }}>No daily data yet</div>;
  }
  const maxCost = Math.max(...rows.map(r => r.cost || 0), 0.001);
  const maxActs = Math.max(...rows.map(r => r.activity_count || 0), 1);
  const sorted  = [...rows].sort((a, b) => a.day > b.day ? 1 : -1);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80 }}>
      {sorted.map(r => {
        const costH    = Math.round(((r.cost || 0) / maxCost) * 70) || 2;
        const actsFrac = (r.activity_count || 0) / maxActs;
        return (
          <div
            key={r.day}
            title={`${fmtDateShort(r.day)}: ${r.activity_count} activities · ${fmt$(r.cost)}`}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: 'default' }}
          >
            <div style={{
              width: '100%', minWidth: 4,
              height: costH,
              background: `rgba(139,92,246,${0.3 + actsFrac * 0.7})`,
              borderRadius: '2px 2px 0 0',
              transition: 'height 0.4s ease',
            }} />
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', whiteSpace: 'nowrap', transform: 'rotate(-45deg)', transformOrigin: 'top left', marginTop: 2 }}>
              {fmtDateShort(r.day).replace(' ', ' ')}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LauraActivitiesTab() {
  const [acts,    setActs]    = useState([]);
  const [costs,   setCosts]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [costLoad, setCostLoad] = useState(true);
  const [error,   setError]   = useState(null);
  const [days,    setDays]    = useState(7);
  const [catFilter, setCatFilter] = useState('all');
  const [view,    setView]    = useState('activities'); // activities | costs | breakdown

  const loadActivities = useCallback(async (d, cat) => {
    setLoading(true); setError(null);
    try {
      const qs = new URLSearchParams({ days: d, limit: 100, ...(cat !== 'all' ? { category: cat } : {}) });
      const r = await fetch(`/api/laura/activities?${qs}`, { headers: authHeaders() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setActs(data.activities || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  const loadCosts = useCallback(async (d) => {
    setCostLoad(true);
    try {
      const r = await fetch(`/api/laura/db-costs?days=${d}`, { headers: authHeaders() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setCosts(data);
    } catch (e) { console.warn('Cost load error:', e.message); }
    finally { setCostLoad(false); }
  }, []);

  useEffect(() => {
    loadActivities(days, catFilter);
    loadCosts(days);
  }, [days, catFilter]); // eslint-disable-line

  // ── Aggregates from activities ────────────────────────────────────────────
  const totalTimeSaved = acts.reduce((s, a) => s + (Number(a.timeSavedMin) || 0), 0);
  const totalCostActs  = acts.reduce((s, a) => s + (Number(a.costUsd) || 0), 0);
  const uniqueDays     = new Set(acts.map(a => (a.timestamp || a.created_at || '').slice(0, 10))).size;

  // Category breakdown from activities
  const catMap = {};
  for (const a of acts) {
    const c = a.category || 'other';
    if (!catMap[c]) catMap[c] = { count: 0, timeSaved: 0, cost: 0 };
    catMap[c].count++;
    catMap[c].timeSaved += Number(a.timeSavedMin) || 0;
    catMap[c].cost = Math.round((catMap[c].cost + (Number(a.costUsd) || 0)) * 10000) / 10000;
  }
  const catRows = Object.entries(catMap).sort((a, b) => b[1].count - a[1].count);
  const maxCatCount = Math.max(...catRows.map(([,v]) => v.count), 1);

  const t = costs?.totals || {};
  const DAYS_LABEL = days === 1 ? 'Today' : `Last ${days}d`;

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1200, margin: '0 auto' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#e8eaff' }}>
            📊 Laura — Activities & Costs
          </h2>
          <p style={{ margin: '5px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
            Live from <strong style={{ color: 'rgba(255,255,255,0.6)' }}>bb_agents RDS</strong> · agent_activities · laura-abhi-agent
          </p>
        </div>
        {/* Day range selector */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {[1, 3, 7, 14, 30].map(d => (
            <button key={d} onClick={() => setDays(d)} style={{
              padding: '5px 12px', borderRadius: 7, fontSize: 11, fontWeight: 600,
              border: '1px solid',
              borderColor: days === d ? '#06E5EC' : 'rgba(255,255,255,0.12)',
              background:  days === d ? 'rgba(6,229,236,0.12)' : 'rgba(255,255,255,0.03)',
              color:       days === d ? '#06E5EC' : 'rgba(255,255,255,0.4)',
              cursor: 'pointer',
            }}>
              {d === 1 ? 'Today' : `${d}d`}
            </button>
          ))}
          <button onClick={() => { loadActivities(days, catFilter); loadCosts(days); }} style={{
            padding: '5px 11px', borderRadius: 7, fontSize: 11,
            border: '1px solid rgba(6,229,236,0.25)',
            background: 'rgba(139,92,246,0.07)', color: '#06E5EC', cursor: 'pointer',
          }}>↻</button>
        </div>
      </div>

      {/* ── KPI strip ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <KpiCard icon="⚡" label="Activities Logged"
          value={loading ? '…' : acts.length}
          sub={`${DAYS_LABEL} · ${uniqueDays} days active`}
          color="#06E5EC" />
        <KpiCard icon="💰" label="AI Cost (logged)"
          value={costLoad ? '…' : fmt$(t.total_cost || totalCostActs)}
          sub={`${DAYS_LABEL} · logged activities`}
          color="#F59E0B" />
        <KpiCard icon="⏱" label="Time Saved"
          value={loading ? '…' : totalTimeSaved >= 60
            ? `${Math.round(totalTimeSaved / 60 * 10) / 10}h`
            : `${totalTimeSaved}m`}
          sub={`${acts.filter(a => a.timeSavedMin > 0).length} tasks with savings`}
          color="#22C55E" />
        <KpiCard icon="🏷️" label="Categories Used"
          value={loading ? '…' : catRows.length}
          sub={catRows.slice(0, 3).map(([c]) => c).join(' · ')}
          color="#06E5EC" />
        <KpiCard icon="📅" label="Last Activity"
          value={acts.length ? fmtDateShort(acts[0]?.timestamp || acts[0]?.created_at) : '—'}
          sub={acts[0]?.title?.slice(0, 35) || 'No recent activity'}
          color="#0EA5E9" />
      </div>

      {/* ── View tabs ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {[
          { key: 'activities', label: '⚡ Activity Feed' },
          { key: 'costs',      label: '💰 Cost by Day' },
          { key: 'breakdown',  label: '🏷️ Category Breakdown' },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setView(key)} style={{
            padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            border: '1px solid',
            borderColor: view === key ? '#06E5EC' : 'rgba(255,255,255,0.1)',
            background:  view === key ? 'rgba(6,229,236,0.12)' : 'rgba(255,255,255,0.03)',
            color: view === key ? '#06E5EC' : 'rgba(255,255,255,0.45)',
            cursor: 'pointer',
          }}>{label}</button>
        ))}

        {/* Category filter (only in activities view) */}
        {view === 'activities' && (
          <select
            value={catFilter}
            onChange={e => setCatFilter(e.target.value)}
            style={{
              marginLeft: 8, padding: '6px 10px', borderRadius: 7, fontSize: 11,
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
            }}
          >
            <option value="all">All categories</option>
            {Object.keys(CAT_META).map(c => <option key={c} value={c}>{CAT_META[c].icon} {c}</option>)}
          </select>
        )}
      </div>

      {/* ── ACTIVITY FEED ───────────────────────────────────────────────────── */}
      {view === 'activities' && (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: 48, color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>
              ⏳ Loading activities…
            </div>
          )}
          {!loading && error && (
            <div style={{ padding: 16, color: '#ea5455', fontSize: 13 }}>⚠️ {error}</div>
          )}
          {!loading && !error && acts.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
              No activities logged in the last {DAYS_LABEL.toLowerCase()}.
              <div style={{ marginTop: 8, fontSize: 11 }}>
                Run <code style={{ color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: 4 }}>
                  python3 scripts/log_activity.py --title "..." --category admin --requested-by System
                </code>
              </div>
            </div>
          )}
          {!loading && !error && acts.map((a, i) => <ActivityRow key={a.id || i} act={a} />)}
          {!loading && acts.length > 0 && (
            <div style={{ padding: '10px 14px', fontSize: 11, color: 'rgba(255,255,255,0.2)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              {acts.length} activities · source: bb_agents.agent_activities · agent_id: laura-abhi-agent
            </div>
          )}
        </div>
      )}

      {/* ── COST BY DAY ─────────────────────────────────────────────────────── */}
      {view === 'costs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Daily bar chart */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '20px 22px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 14 }}>
              Daily Activity Volume &amp; Cost — {DAYS_LABEL}
            </div>
            {costLoad
              ? <div style={{ textAlign: 'center', padding: 24, color: 'rgba(255,255,255,0.3)' }}>Loading…</div>
              : <DailyBars rows={costs?.byDay || []} />
            }
          </div>

          {/* Per-day table */}
          {!costLoad && costs?.byDay?.length > 0 && (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 100px', gap: 8, padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>
                <span>Date</span><span style={{ textAlign: 'right' }}>Activities</span><span style={{ textAlign: 'right' }}>Time Saved</span><span style={{ textAlign: 'right' }}>AI Cost</span>
              </div>
              {[...costs.byDay].sort((a, b) => b.day > a.day ? 1 : -1).map(r => (
                <div key={r.day} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 100px', gap: 8, padding: '9px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12 }}>
                  <span style={{ color: '#e8eaff', fontWeight: 600 }}>{fmtDateShort(r.day)}</span>
                  <span style={{ textAlign: 'right', color: '#06E5EC', fontWeight: 700 }}>{r.activity_count}</span>
                  <span style={{ textAlign: 'right', color: '#22C55E' }}>{r.time_saved_min > 0 ? `${r.time_saved_min}m` : '—'}</span>
                  <span style={{ textAlign: 'right', color: r.cost > 0 ? '#F59E0B' : 'rgba(255,255,255,0.2)', fontWeight: r.cost > 0 ? 700 : 400 }}>{fmt$(r.cost)}</span>
                </div>
              ))}
              {/* Total row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 100px', gap: 8, padding: '9px 16px', background: 'rgba(6,229,236,0.04)', borderTop: '1px solid rgba(6,229,236,0.15)', fontSize: 12, fontWeight: 700 }}>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>Total ({DAYS_LABEL})</span>
                <span style={{ textAlign: 'right', color: '#06E5EC' }}>{t.total_activities || 0}</span>
                <span style={{ textAlign: 'right', color: '#22C55E' }}>{t.total_time_saved > 0 ? `${t.total_time_saved}m` : '—'}</span>
                <span style={{ textAlign: 'right', color: '#F59E0B' }}>{fmt$(t.total_cost)}</span>
              </div>
            </div>
          )}

          {/* Model breakdown */}
          {!costLoad && costs?.byModel?.filter(m => m.model !== 'unknown').length > 0 && (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '18px 22px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 14 }}>
                Cost by Model
              </div>
              {costs.byModel.filter(m => m.model !== 'unknown').map(r => {
                const maxModelCost = Math.max(...costs.byModel.map(m => m.cost), 0.001);
                return (
                  <MiniBar
                    key={r.model}
                    label={r.model.replace('anthropic/','').replace('claude-','')}
                    value={r.cost}
                    max={maxModelCost}
                    color="#06E5EC"
                    right={`${fmt$(r.cost)} · ${r.count} tasks`}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── CATEGORY BREAKDOWN ──────────────────────────────────────────────── */}
      {view === 'breakdown' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* Category bars */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '18px 22px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 14 }}>
              Activity Count by Category
            </div>
            {loading ? (
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>Loading…</div>
            ) : catRows.length === 0 ? (
              <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>No data</div>
            ) : catRows.map(([c, v]) => {
              const m = catMeta(c);
              return (
                <div key={c} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                    <span style={{ color: m.color, fontWeight: 600 }}>{m.icon} {c}</span>
                    <span style={{ color: m.color, fontWeight: 700 }}>
                      {v.count} {v.timeSaved > 0 ? <span style={{ color: '#22C55E', fontWeight: 400 }}>· {v.timeSaved}m saved</span> : ''}
                    </span>
                  </div>
                  <div style={{ height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.06)' }}>
                    <div style={{
                      height: '100%', borderRadius: 4,
                      background: `linear-gradient(90deg,${m.color}cc,${m.color}44)`,
                      width: `${Math.max(3, (v.count / maxCatCount) * 100)}%`,
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Category card grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, alignContent: 'start' }}>
            {catRows.map(([c, v]) => {
              const m = catMeta(c);
              return (
                <div key={c} style={{
                  padding: '14px 16px',
                  background: `${m.color}08`,
                  border: `1px solid ${m.color}25`,
                  borderRadius: 10,
                }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{m.icon}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: m.color }}>{v.count}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{c}</div>
                  {v.timeSaved > 0 && (
                    <div style={{ fontSize: 10, color: '#22C55E', marginTop: 4 }}>⏱ {v.timeSaved}m saved</div>
                  )}
                  {v.cost > 0 && (
                    <div style={{ fontSize: 10, color: '#F59E0B', marginTop: 2 }}>💰 {fmt$(v.cost)}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <div style={{ marginTop: 20, padding: '10px 14px', borderRadius: 8, background: 'rgba(6,229,236,0.04)', border: '1px solid rgba(6,229,236,0.12)', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
        🤖 Darren Stuart (laura-abhi-agent) · Data source: bb_agents RDS agent_activities table · Excludes cron-log and auto-tracker noise
      </div>
    </div>
  );
}
