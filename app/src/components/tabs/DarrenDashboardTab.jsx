import { useState, useEffect, useCallback } from 'react';
import { authHeaders } from '../LoginGate';

// ── Helpers ───────────────────────────────────────────────────────────────────
function pct(num, denom) {
  if (!denom) return '0%';
  return `${Math.round((num / denom) * 100)}%`;
}

function fmt$(n) {
  const v = Number(n) || 0;
  return v === 0 ? '$0.00' : `$${v.toFixed(2)}`;
}


// ── KPI card — same pattern as Laura's ───────────────────────────────────────
function KpiCard({ icon, label, value, sub, color = '#06E5EC', live = false, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${live ? 'rgba(40,199,111,0.35)' : `${color}30`}`,
        borderTop: `3px solid ${live ? '#28c76f' : color}`,
        borderRadius: 10, padding: '16px 18px',
        cursor: onClick ? 'pointer' : 'default',
        flex: '1 1 130px', minWidth: 0,
        position: 'relative',
      }}
    >
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

// ── Funnel step ───────────────────────────────────────────────────────────────
function FunnelStep({ label, count, color, arrow = true, total }) {
  const fillPct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        textAlign: 'center', padding: '12px 16px',
        background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}40`,
        borderRadius: 8, minWidth: 88, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', bottom: 0, left: 0, width: '100%',
          height: `${fillPct}%`, background: `${color}12`, transition: 'height 0.5s ease',
        }} />
        <div style={{ fontSize: 22, fontWeight: 900, color, position: 'relative' }}>{count.toLocaleString()}</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 3, position: 'relative', whiteSpace: 'nowrap' }}>{label}</div>
        {total > 0 && <div style={{ fontSize: 10, color: `${color}99`, marginTop: 1, position: 'relative' }}>{fillPct}%</div>}
      </div>
      {arrow && <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 18, flexShrink: 0 }}>→</div>}
    </div>
  );
}

// ── Progress ring ─────────────────────────────────────────────────────────────
function ProgressRing({ pct: fillPct, color = '#06E5EC', size = 80, label, value }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const fill = circ * (1 - fillPct / 100);
  return (
    <div style={{ textAlign: 'center', flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={8} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={circ} strokeDashoffset={fill} strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
        <text x={size/2} y={size/2 - 5} textAnchor="middle" fill={color} fontSize={14} fontWeight={800}>{value}</text>
        <text x={size/2} y={size/2 + 10} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={9}>{label}</text>
      </svg>
    </div>
  );
}

// ── Mini bar ──────────────────────────────────────────────────────────────────
function MiniBar({ label, value, max, color, right }) {
  const p = max > 0 && value > 0 ? Math.max(3, (value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
        <span style={{ color: 'rgba(255,255,255,0.55)' }}>{label}</span>
        <span style={{ color, fontWeight: 700 }}>{right ?? value}</span>
      </div>
      <div style={{ height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.06)' }}>
        <div style={{ height: '100%', borderRadius: 4, background: `linear-gradient(90deg,${color}cc,${color}55)`, width: `${p}%`, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  );
}

// ── Task donut ────────────────────────────────────────────────────────────────
function TaskDonut({ done, inProgress, todo }) {
  const total = done + inProgress + todo;
  const donePct = total > 0 ? Math.round((done / total) * 100) : 0;
  const inpPct  = total > 0 ? Math.round((inProgress / total) * 100) : 0;
  const todoPct = 100 - donePct - inpPct;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <svg width={110} height={110} viewBox="0 0 110 110">
          {donePct > 0 && <circle cx={55} cy={55} r={44} fill="none" stroke="#28c76f" strokeWidth={14}
            strokeDasharray={`${276.5 * donePct / 100} 276.5`} strokeDashoffset={0}
            transform="rotate(-90 55 55)" strokeLinecap="butt" />}
          {inpPct > 0 && <circle cx={55} cy={55} r={44} fill="none" stroke="#06E5EC" strokeWidth={14}
            strokeDasharray={`${276.5 * inpPct / 100} 276.5`} strokeDashoffset={-(276.5 * donePct / 100)}
            transform="rotate(-90 55 55)" strokeLinecap="butt" />}
          <circle cx={55} cy={55} r={44} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={14}
            strokeDasharray={`${276.5 * todoPct / 100} 276.5`} strokeDashoffset={-(276.5 * (donePct + inpPct) / 100)}
            transform="rotate(-90 55 55)" strokeLinecap="butt" />
          <text x={55} y={50} textAnchor="middle" fill="#28c76f" fontSize={22} fontWeight={900}>{donePct}%</text>
          <text x={55} y={66} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={10}>complete</text>
        </svg>
      </div>
      <div style={{ flex: 1 }}>
        {[{ label: 'Done', count: done, color: '#28c76f' }, { label: 'In Progress', count: inProgress, color: '#06E5EC' }, { label: 'To Do', count: todo, color: 'rgba(255,255,255,0.2)' }]
          .map(({ label, count, color }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', flex: 1 }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color }}>{count}</span>
          </div>
        ))}
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>{total} total tasks</div>
      </div>
    </div>
  );
}


// ── Wscolor ───────────────────────────────────────────────────────────────────
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

// ── Category meta (mirrors TodayTasksFeed) ───────────────────────────────────
const CAT_META = {
  'lead-gen':     { icon: '🎯', color: '#06E5EC' },
  'outreach':     { icon: '📤', color: '#3B82F6' },
  'enrichment':   { icon: '🔍', color: '#8B5CF6' },
  'data-hygiene': { icon: '🧹', color: '#F59E0B' },
  'research':     { icon: '📊', color: '#22C55E' },
  'follow-up':    { icon: '🔁', color: '#0EA5E9' },
  'handoff':      { icon: '🤝', color: '#28c76f' },
  'admin':        { icon: '⚙️', color: 'rgba(255,255,255,0.4)' },
  'task':         { icon: '📋', color: '#8B5CF6' },
  'system':       { icon: '🤖', color: 'rgba(255,255,255,0.25)' },
};
function getCatMeta(cat) {
  return CAT_META[(cat || '').toLowerCase()] || { icon: '📌', color: '#8B5CF6' };
}

function fmtActTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
    timeZone: 'America/New_York',
  });
}

// ── Activity row ──────────────────────────────────────────────────────────────
function ActivityRow({ act }) {
  const [open, setOpen] = useState(false);
  const cat = getCatMeta(act.category);
  return (
    <div
      onClick={() => setOpen(o => !o)}
      style={{
        fontSize: 12, padding: '8px 0',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{cat.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            color: 'var(--text-primary)', fontWeight: 600,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {act.title}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 2 }}>
            {act.requestedBy && act.requestedBy !== 'System' && `${act.requestedBy} · `}
            {fmtActTime(act.timestamp)}
            {act.costUsd > 0 && <span style={{ color: '#F59E0B', marginLeft: 6 }}>${Number(act.costUsd).toFixed(3)}</span>}
            {act.timeSavedMin > 0 && <span style={{ color: '#28c76f', marginLeft: 6 }}>⏱ {act.timeSavedMin}m saved</span>}
          </div>
        </div>
        {act.category && (
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 10,
            background: `${cat.color}18`, border: `1px solid ${cat.color}40`, color: cat.color,
            flexShrink: 0, whiteSpace: 'nowrap',
          }}>
            {act.category}
          </span>
        )}
      </div>
      {open && act.actions && act.actions.length > 0 && (
        <div style={{ marginTop: 6, paddingLeft: 22, fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
          {act.actions.slice(0, 5).map((a, i) => <div key={i}>· {a}</div>)}
          {act.actions.length > 5 && <div style={{ color: 'rgba(255,255,255,0.2)' }}>+{act.actions.length - 5} more…</div>}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DarrenDashboardTab() {
  const [data,    setData]  = useState(null);
  const [loading, setLoad]  = useState(true);
  const [error,   setError] = useState(null);

  // Recent activity state
  const [activities,    setActivities]    = useState([]);
  const [actLoading,    setActLoading]    = useState(true);
  const [actError,      setActError]      = useState(null);
  const [actDays,       setActDays]       = useState(3);

  const loadActivities = useCallback(async (days = actDays) => {
    setActLoading(true); setActError(null);
    try {
      const r = await fetch(`/api/darren/activities?days=${days}&limit=30`, { headers: authHeaders() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setActivities(d.activities || []);
    } catch (e) { setActError(e.message); }
    finally { setActLoading(false); }
  }, [actDays]);

  const load = useCallback(async () => {
    setLoad(true); setError(null);
    try {
      const r = await fetch('/api/darren/dashboard', { headers: authHeaders() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
    } catch (e) { setError(e.message); }
    finally { setLoad(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadActivities(actDays); }, [actDays]); // eslint-disable-line

  const c   = data?.campaign || {};
  const t   = data?.tasks    || {};
  const ws  = t.byWorkstream || [];
  const base = c.totalContacts || 1;

  // Cost from Darren's DWDM Task Plan sheet (column I)
  const sheetCostTotal = t.costTotal || 0;
  const wsWithCost = ws.filter(w => w.cost > 0).sort((a, b) => b.cost - a.cost);

  // Funnel
  const funnelSteps = [
    { label: 'Contacts',  count: c.totalContacts || 0, color: '#3B82F6' },
    { label: 'Verified',  count: c.smtpVerified  || 0, color: '#06E5EC' },
    { label: 'T1 Sent',   count: c.t1Sent        || 0, color: '#0EA5E9' },
    { label: 'T2 Sent',   count: c.t2Sent        || 0, color: '#6366F1' },
    { label: 'T3 Sent',   count: c.t3Sent        || 0, color: '#8B5CF6' },
    { label: 'T4 Sent',   count: c.t4Sent        || 0, color: '#A855F7' },
    { label: 'T5 Sent',   count: c.t5Sent        || 0, color: '#EC4899' },
    { label: '💬 Replied', count: c.replies       || 0, color: '#22C55E' },
  ];

  const tierMax = Math.max(c.tier1 || 0, c.tier2 || 0, c.tier3 || 0, 1);
  const replyPct = Math.round(((c.replies || 0) / Math.max(c.t1Sent || 1, 1)) * 100);

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1200, margin: '0 auto' }}>

      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#e8eaff' }}>
            📡 Darren — DWDM Campaign Dashboard
          </h2>
          <p style={{ margin: '5px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
            Live from <strong style={{ color: 'rgba(255,255,255,0.6)' }}>DWDM Companies</strong> + <strong style={{ color: 'rgba(255,255,255,0.6)' }}>DWDM Task Plan</strong> · Mercury Z · Fiber/Telco vertical
          </p>
        </div>
        <button onClick={load} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, border: '1px solid rgba(139,92,246,0.3)', background: 'rgba(139,92,246,0.07)', color: '#8B5CF6', cursor: 'pointer' }}>
          ↻ Refresh
        </button>
      </div>

      {/* ── Loading / Error ─────────────────────────────────────────────────── */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>
          ⏳ Loading DWDM campaign data…
        </div>
      )}
      {!loading && error && (
        <div style={{ padding: 16, borderRadius: 10, background: 'rgba(234,84,85,0.1)', border: '1px solid rgba(234,84,85,0.3)', color: '#ea5455', fontSize: 13 }}>
          ⚠️ {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* ── HERO — Reply Rate (Darren's primary KPI, like Laura's Call Goal) ── */}
          <div className="card" style={{
            marginBottom: 16, padding: '20px 24px',
            background: 'linear-gradient(135deg,rgba(139,92,246,0.08),rgba(139,92,246,0.02))',
            border: '1px solid rgba(139,92,246,0.25)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              {/* Left: reply rate */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#8B5CF6', marginBottom: 6 }}>
                  💬 Outreach Performance
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                  <div style={{ fontSize: 52, fontWeight: 900, color: '#22C55E', lineHeight: 1 }}>{c.replies || 0}</div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#8B5CF6' }}>{replyPct}% rate</div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>replies of {(c.t1Sent || 0).toLocaleString()} T1 sent</div>
                  </div>
                </div>
              </div>
              {/* Right: reach progress */}
              <div style={{ minWidth: 220 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>Contact Reach</span>
                  <span style={{ color: '#8B5CF6', fontWeight: 700 }}>{pct(c.t1Sent, c.totalContacts)} of {(c.totalContacts || 0).toLocaleString()}</span>
                </div>
                <div style={{ height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.08)' }}>
                  <div style={{
                    height: '100%', borderRadius: 5,
                    background: 'linear-gradient(90deg,#6D28D9,#8B5CF6)',
                    width: `${Math.min(Math.round(((c.t1Sent || 0) / Math.max(c.totalContacts || 1, 1)) * 100), 100)}%`,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
                {/* Mini stats row */}
                <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {[
                    { label: 'Companies', val: (c.totalCompanies || 0).toLocaleString(), color: '#3B82F6' },
                    { label: 'Verified',  val: (c.smtpVerified   || 0).toLocaleString(), color: '#28c76f' },
                    { label: 'Sequences', val: (c.t5Sent         || 0).toLocaleString(), color: '#EC4899' },
                  ].map(({ label, val, color }) => (
                    <div key={label} style={{ textAlign: 'center', padding: '6px', background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color }}>{val}</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── KPI strip — matches Laura's 4-card layout ──────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
            <KpiCard icon="🏢" label="Companies"     value={(c.totalCompanies || 0).toLocaleString()} color="#3B82F6" sub="DWDM targets" />
            <KpiCard icon="👤" label="Total Contacts" value={(c.totalContacts  || 0).toLocaleString()} color="#0EA5E9" sub={`${c.smtpVerified || 0} verified`} />
            <KpiCard icon="📨" label="T1 Emails Sent" value={(c.t1Sent         || 0).toLocaleString()} color="#06E5EC" sub={pct(c.t1Sent, c.smtpVerified) + ' of verified'} />
            <KpiCard icon="💬" label="Replies"         value={c.replies || 0}                           color="#22C55E" sub={`${c.replyRate || 0}% reply rate`} />
            <KpiCard icon="💰" label="Task Cost (Sheet)" value={sheetCostTotal > 0 ? fmt$(sheetCostTotal) : '—'} color="#F59E0B" sub="from DWDM Task Plan" />
          </div>

          {/* ── Cost from DWDM Task Plan sheet ─────────────────────────────── */}
          {sheetCostTotal > 0 && (
            <div style={{
              marginBottom: 16, padding: '16px 20px',
              background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.2)',
              borderRadius: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#e8eaff' }}>Task Costs — DWDM Task Plan Sheet</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>col I</span>
                <span style={{ marginLeft: 'auto', fontSize: 20, fontWeight: 800, color: '#F59E0B' }}>{fmt$(sheetCostTotal)}</span>
              </div>

              {/* Workstream cost bars */}
              {wsWithCost.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 6 }}>
                  {wsWithCost.map(row => {
                    const sharePct = sheetCostTotal > 0 ? Math.round((row.cost / sheetCostTotal) * 100) : 0;
                    const c = wsColor(row.workstream);
                    return (
                      <div key={row.workstream} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 10px', borderRadius: 7,
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.07)',
                      }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: c, flexShrink: 0 }} />
                        <div style={{ flex: 1, fontSize: 11, color: 'rgba(255,255,255,0.65)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.workstream}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: c }}>{fmt$(row.cost)}</div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', minWidth: 30, textAlign: 'right' }}>{sharePct}%</div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ marginTop: 10, fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
                Source: Google Sheet · DWDM Task Plan · column I · {t.total || 0} tasks · {ws.filter(w => w.cost > 0).length} workstreams with costs
              </div>
            </div>
          )}

          {/* ── Pipeline funnel + Touch coverage ───────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, marginBottom: 16, alignItems: 'start' }}>

            {/* Funnel — same card style as Laura */}
            <div className="card" style={{ padding: '16px 20px' }}>
              <div className="card-title" style={{ marginBottom: 14 }}>📊 Outreach Pipeline Funnel</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                {funnelSteps.map((s, i) => (
                  <FunnelStep key={s.label} {...s} arrow={i < funnelSteps.length - 1} total={c.totalContacts} />
                ))}
              </div>
              <div style={{ marginTop: 12, fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
                Fill % relative to total contacts ({(c.totalContacts || 0).toLocaleString()})
              </div>
            </div>

            {/* Touch Coverage rings */}
            <div className="card" style={{ padding: '16px 18px', minWidth: 240 }}>
              <div className="card-title" style={{ marginBottom: 14 }}>🎯 Touch Coverage</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
                {[
                  { label: 'T1', color: '#0EA5E9', sent: c.t1Sent },
                  { label: 'T2', color: '#6366F1', sent: c.t2Sent },
                  { label: 'T3', color: '#8B5CF6', sent: c.t3Sent },
                  { label: 'T4', color: '#A855F7', sent: c.t4Sent },
                  { label: 'T5', color: '#EC4899', sent: c.t5Sent },
                ].map(({ label, color, sent }) => (
                  <ProgressRing
                    key={label}
                    pct={Math.round(((sent || 0) / base) * 100)}
                    color={color} label={label}
                    value={pct(sent, base)}
                  />
                ))}
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: 'rgba(255,255,255,0.25)', textAlign: 'center' }}>
                % of {(c.totalContacts || 0).toLocaleString()} contacts per touch
              </div>
            </div>
          </div>

          {/* ── Middle row: Task donut + Tier/Email breakdown ───────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

            {/* Task plan */}
            <div className="card" style={{ padding: '16px 20px' }}>
              <div className="card-title" style={{ marginBottom: 14 }}>📋 DWDM Task Plan — Completion</div>
              <TaskDonut done={t.done || 0} inProgress={t.inProgress || 0} todo={t.todo || 0} />

              {ws.length > 0 && (
                <div style={{ marginTop: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 10 }}>
                    Cost by Workstream
                  </div>
                  {ws.slice(0, 6).map(row => (
                    <MiniBar
                      key={row.workstream}
                      label={row.workstream}
                      value={row.cost}
                      max={Math.max(...ws.map(w => w.cost), 0.01)}
                      color={wsColor(row.workstream)}
                      right={row.cost > 0 ? fmt$(row.cost) : '—'}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Tier + email verification */}
            <div className="card" style={{ padding: '16px 20px' }}>
              <div className="card-title" style={{ marginBottom: 14 }}>🏷️ Lead Tiers + Verification</div>

              <MiniBar label="Tier 1 (Priority)" value={c.tier1 || 0} max={tierMax} color="#06E5EC" right={`${c.tier1 || 0} contacts`} />
              <MiniBar label="Tier 2"             value={c.tier2 || 0} max={tierMax} color="#6366F1" right={`${c.tier2 || 0} contacts`} />
              <MiniBar label="Tier 3"             value={c.tier3 || 0} max={tierMax} color="#94a3b8" right={`${c.tier3 || 0} contacts`} />

              <div style={{ margin: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }} />

              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 10 }}>
                📧 Email Verification
              </div>
              <MiniBar label="✅ SMTP Accepted"  value={c.smtpVerified || 0} max={c.totalContacts || 1} color="#28c76f"
                right={`${c.smtpVerified || 0} (${pct(c.smtpVerified, c.totalContacts)})`} />
              <MiniBar label="❌ Rejected / Bad" value={c.smtpRejected || 0} max={c.totalContacts || 1} color="#ea5455"
                right={`${c.smtpRejected || 0}`} />
              <MiniBar label="⬜ No Email / TBD"
                value={Math.max(0, (c.totalContacts || 0) - (c.smtpVerified || 0) - (c.smtpRejected || 0))}
                max={c.totalContacts || 1} color="#94a3b8"
                right={`${Math.max(0,(c.totalContacts||0)-(c.smtpVerified||0)-(c.smtpRejected||0))}`} />

              <div style={{ margin: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }} />

              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 10 }}>
                🏢 Company Reach
              </div>
              <MiniBar label="Companies targeted"    value={c.totalCompanies || 0}   max={c.totalCompanies || 1} color="#3B82F6"  right={c.totalCompanies || 0} />
              <MiniBar label="Companies with T1 out" value={c.companiesWithT1 || 0}  max={c.totalCompanies || 1} color="#06E5EC"  right={`${c.companiesWithT1 || 0} (${pct(c.companiesWithT1, c.totalCompanies)})`} />
              <MiniBar label="Companies with T5 out" value={c.companiesWithT5 || 0}  max={c.totalCompanies || 1} color="#EC4899"  right={`${c.companiesWithT5 || 0} (${pct(c.companiesWithT5, c.totalCompanies)})`} />
            </div>
          </div>

          {/* ── Sequence Velocity ──────────────────────────────────────────── */}
          <div className="card" style={{ padding: '16px 20px', marginBottom: 16 }}>
            <div className="card-title" style={{ marginBottom: 14 }}>⚡ Sequence Velocity — Touches per Stage</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {[
                { label: 'Touch 1', count: c.t1Sent || 0, total: c.smtpVerified || 0, color: '#0EA5E9' },
                { label: 'Touch 2', count: c.t2Sent || 0, total: c.t1Sent || 0,       color: '#6366F1' },
                { label: 'Touch 3', count: c.t3Sent || 0, total: c.t2Sent || 0,       color: '#8B5CF6' },
                { label: 'Touch 4', count: c.t4Sent || 0, total: c.t3Sent || 0,       color: '#A855F7' },
                { label: 'Touch 5', count: c.t5Sent || 0, total: c.t4Sent || 0,       color: '#EC4899' },
              ].map(({ label, count, total, color }) => {
                const p = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={label} style={{ flex: '1 1 140px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}30`, borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color }}>{label}</span>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>of {total.toLocaleString()}</span>
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 900, color, marginBottom: 6 }}>{count.toLocaleString()}</div>
                    <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', marginBottom: 4 }}>
                      <div style={{ height: '100%', borderRadius: 3, background: `linear-gradient(90deg,${color}cc,${color}44)`, width: `${p}%`, transition: 'width 0.5s ease' }} />
                    </div>
                    <div style={{ fontSize: 10, color: `${color}99` }}>{p}% progression</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Recent Activity ─────────────────────────────────────────────── */}
          <div className="card" style={{ padding: '16px 20px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <div className="card-title" style={{ margin: 0 }}>⚡ Recent Activity</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {/* Day range selector */}
                {[1, 3, 7].map(d => (
                  <button
                    key={d}
                    onClick={() => setActDays(d)}
                    style={{
                      padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                      border: '1px solid',
                      borderColor: actDays === d ? '#8B5CF6' : 'rgba(255,255,255,0.12)',
                      background:  actDays === d ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.03)',
                      color:       actDays === d ? '#8B5CF6' : 'rgba(255,255,255,0.4)',
                      cursor: 'pointer',
                    }}
                  >
                    {d === 1 ? 'Today' : `${d}d`}
                  </button>
                ))}
                <button
                  onClick={() => loadActivities(actDays)}
                  style={{
                    padding: '3px 10px', borderRadius: 6, fontSize: 11,
                    border: '1px solid rgba(139,92,246,0.25)',
                    background: 'rgba(139,92,246,0.07)', color: '#8B5CF6', cursor: 'pointer',
                  }}
                >↻</button>
              </div>
            </div>

            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {actLoading && (
                <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '12px 0' }}>Loading activity…</div>
              )}
              {!actLoading && actError && (
                <div style={{ color: '#ea5455', fontSize: 12 }}>⚠️ {actError}</div>
              )}
              {!actLoading && !actError && activities.length === 0 && (
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  No activity logged in the last {actDays === 1 ? 'day' : `${actDays} days`}.
                  <div style={{ marginTop: 6, fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
                    Activities are logged when Darren calls <code style={{ color: 'rgba(255,255,255,0.4)' }}>scripts/log_activity.py</code> or via the agent_activities table.
                  </div>
                </div>
              )}
              {!actLoading && !actError && activities
                .filter(a => !a.title?.toLowerCase().startsWith('heartbeat') && !a.title?.toLowerCase().startsWith('routine'))
                .map((a, i) => <ActivityRow key={a.id || i} act={a} />)
              }
            </div>
          </div>

          {/* ── Footer note ─────────────────────────────────────────────────── */}
          <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.12)', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
            🤖 Darren (dstuart@boldbusiness.com) runs fully automated DWDM outreach for Mercury Z · Data sourced live from Google Sheets
            {data.generatedAt && ` · Last loaded: ${new Date(data.generatedAt).toLocaleTimeString()}`}
          </div>
        </>
      )}
    </div>
  );
}
