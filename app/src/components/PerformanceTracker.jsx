/**
 * PerformanceTracker — two-tab card: Recruiter (SMT) + Sales (Multilead/Skylead)
 * Recruiter: public.recruiters_goals + public.recruiters_activities (smt_db)
 * Sales:     sales.dashboard_campaigns + sales.dashboard_skylead_ids (smt_db)
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { authHeaders } from './LoginGate';

// ── Design tokens ─────────────────────────────────────────────────────────────
const REC_COLOR  = '#7C3AED';
const REC_GRAD   = 'linear-gradient(135deg,#7C3AED,#4F46E5)';
const SALES_COLOR = '#10B981';
const MID_COLOR  = '#818CF8';
const END_COLOR  = '#38BDF8';
const OK   = '#10B981';
const WARN = '#F59E0B';
const BAD  = '#EF4444';

function pctColor(actual, target) {
  if (!target) return 'var(--text-muted)';
  const p = actual / target;
  return p >= 1 ? OK : p >= 0.5 ? WARN : BAD;
}
function pctVal(actual, target) {
  if (!target) return null;
  return Math.min(100, Math.round((actual / target) * 100));
}
function ProgressBar({ actual, target, color, height = 4 }) {
  const p = pctVal(actual, target) ?? 0;
  return (
    <div style={{ height, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', marginTop: 3 }}>
      <div style={{ width: `${p}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.4s' }} />
    </div>
  );
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function toEST(d) {
  return new Date(d.toLocaleString('en-US', { timeZone: 'America/New_York' }));
}
function fmt(d) {
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), dd = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
}
function getRange(type) {
  const now = toEST(new Date());
  let start = new Date(now), end = new Date(now);
  if (type === 'Today') {
    start.setHours(0,0,0,0); end.setHours(23,59,59,999);
  } else if (type === 'Weekly') {
    const day = now.getDay();
    start.setDate(now.getDate() - day); start.setHours(0,0,0,0);
    end.setDate(now.getDate() + (6 - day)); end.setHours(23,59,59,999);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end   = new Date(now.getFullYear(), now.getMonth()+1, 0);
    end.setHours(23,59,59,999);
  }
  return { start: fmt(start), end: fmt(end) };
}
/** Wednesday noon EST boundary */
function isMidWeek(ts) {
  if (!ts) return false;
  const d = toEST(new Date(ts));
  const day = d.getDay(), hr = d.getHours();
  return day < 3 || (day === 3 && hr < 12);
}

// ── Shared filter bar ─────────────────────────────────────────────────────────
function FilterBar({ filterType, setFilterType, accentColor, gradient, names, selName, setSelName, nameLabel }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
      {/* Preset pills */}
      {['Today','Weekly','Monthly'].map(t => {
        const active = filterType === t;
        return (
          <button key={t} onClick={() => setFilterType(t)} style={{
            padding: '5px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 10,
            fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em',
            border: active ? 'none' : '1px solid rgba(255,255,255,0.1)',
            background: active ? (gradient || accentColor) : 'transparent',
            color: active ? '#fff' : 'var(--text-muted)',
            transition: 'all 0.15s',
          }}>{t}</button>
        );
      })}

      {/* Name dropdown */}
      {names.length > 0 && (
        <select value={selName} onChange={e => setSelName(e.target.value)} style={{
          padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
          background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
          color: 'var(--text-primary)', cursor: 'pointer', minWidth: 150,
        }}>
          <option value="All">All {nameLabel}</option>
          {names.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      )}
    </div>
  );
}

// ── Drill-down modal ──────────────────────────────────────────────────────────
function DrillModal({ title, rows, cols, onClose }) {
  if (rows === null) return (
    <div style={{ position:'fixed',inset:0,zIndex:9999,background:'rgba(0,0,0,0.75)',backdropFilter:'blur(6px)',display:'flex',alignItems:'center',justifyContent:'center' }}>
      <div style={{ color:'var(--text-muted)',fontSize:14 }}>Loading activities…</div>
    </div>
  );
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 16,
        width: '95vw', maxWidth: 1000, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: MID_COLOR, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Activity Drill-down</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
          {rows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)', fontSize: 13 }}>No activities recorded.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: 'var(--bg-primary)' }}>
                  {cols.map(c => (
                    <th key={c.key} style={{ padding: '9px 12px', textAlign: 'left', fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    {cols.map(c => (
                      <td key={c.key} style={{ padding: '8px 12px', color: 'var(--text-secondary)', maxWidth: c.maxWidth || 'none', wordBreak: 'break-word' }}>
                        {c.render ? c.render(r[c.key], r) : (r[c.key] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ padding: '10px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '6px 18px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 700, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 1 — Recruiter Performance
// ════════════════════════════════════════════════════════════════════════════
function RecruiterTab({ filterType }) {
  const [goals,       setGoals]       = useState([]);
  const [recruiters,  setRecruiters]  = useState([]);
  const [selRec,      setSelRec]      = useState('All');
  const [loading,     setLoading]     = useState(true);
  const [pending,     setPending]     = useState(false);
  const [drill,       setDrill]       = useState(null);

  const range = useMemo(() => getRange(filterType), [filterType]);

  const load = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams({ start: range.start, end: range.end });
    if (selRec !== 'All') qs.set('recruiter', selRec);

    Promise.all([
      fetch(`/api/smt/recruiter/goals?${qs}`, { headers: authHeaders() }).then(r => r.json()),
      fetch('/api/smt/recruiter/names',        { headers: authHeaders() }).then(r => r.json()),
    ]).then(([gd, rd]) => {
      setPending(gd.pending);
      setGoals(gd.goals || []);
      setRecruiters(rd.recruiters || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [range, selRec]);

  useEffect(() => { load(); }, [load]);

  const openDrill = async (goal, period) => {
    const title = `${goal.recruiter_name} — ${goal.role} (${period === 'mid' ? 'Mid-Week' : 'End-Week'}: ${period === 'mid' ? goal.mid_week_stage : goal.end_week_stage})`;
    setDrill({ title, rows: null, cols: [] }); // null = loading state
    const qs = new URLSearchParams({
      start: range.start, end: range.end,
      recruiter: goal.recruiter_name, role: goal.role, client: goal.client,
      period, stage: period === 'mid' ? goal.mid_week_stage : goal.end_week_stage,
    });
    const d = await fetch(`/api/smt/recruiter/activities?${qs}`, { headers: authHeaders() }).then(r => r.json());
    setDrill({
      title,
      rows: d.activities || [],
      cols: [
        { key: 'created_at',    label: 'Date',      render: v => v ? new Date(v).toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '—' },
        { key: 'candidate_name',label: 'Candidate'  },
        { key: 'stage',         label: 'Stage'      },
        { key: 'goal_period',   label: 'Period'     },
        { key: 'status',        label: 'Status'     },
        { key: 'notes',         label: 'Notes',     maxWidth: 300 },
      ]
    });
  };

  // Legend
  const legend = [
    { color: OK,   label: '≥ 100%' },
    { color: WARN, label: '50–99%' },
    { color: BAD,  label: '< 50%'  },
  ];

  if (pending) return (
    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>🗂️</div>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Tables not yet created</div>
      <div style={{ fontSize: 11, maxWidth: 420, margin: '0 auto', lineHeight: 1.6 }}>
        The recruiter performance tables (<code>public.recruiters_goals</code> and <code>public.recruiters_activities</code>) need to be created by a superadmin. Once created and populated via the SMT app, data will appear here automatically.
      </div>
    </div>
  );

  return (
    <div>
      {drill && <DrillModal {...drill} onClose={() => setDrill(null)} />}

      {/* Recruiter filter */}
      <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={selRec} onChange={e => setSelRec(e.target.value)} style={{
          padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
          background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
          color: 'var(--text-primary)', cursor: 'pointer', minWidth: 160,
        }}>
          <option value="All">All Recruiters</option>
          {recruiters.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <button onClick={load} style={{ padding: '5px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>↻</button>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)' }}>
          {range.start} → {range.end} · {goals.length} goal{goals.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Loading…</div>
      ) : goals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 12 }}>No goals found for this period.</div>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  {[
                    { label: 'Recruiter', align: 'left' },
                    { label: 'Role',      align: 'left' },
                    { label: 'Client',    align: 'left' },
                    { label: 'Mid-Week Stage', align: 'center', color: MID_COLOR },
                    { label: 'Mid Actual / Target', align: 'center', color: MID_COLOR },
                    { label: 'End-Week Stage',  align: 'center', color: END_COLOR },
                    { label: 'End Actual / Target', align: 'center', color: END_COLOR },
                    { label: 'Notes', align: 'left' },
                  ].map(h => (
                    <th key={h.label} style={{
                      padding: '8px 12px', textAlign: h.align, fontSize: 9, fontWeight: 800,
                      letterSpacing: '0.06em', textTransform: 'uppercase',
                      color: h.color || 'var(--text-muted)',
                      borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
                    }}>{h.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {goals.map((g, i) => {
                  const midActual = Number(g.mid_actual) || 0;
                  const endActual = Number(g.end_actual) || 0;
                  const midTarget = Number(g.mid_week_target) || 0;
                  const endTarget = Number(g.weekly_target)   || 0;
                  const midColor  = pctColor(midActual, midTarget);
                  const endColor  = pctColor(endActual, endTarget);

                  return (
                    <tr key={g.id || i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i%2===0?'transparent':'rgba(255,255,255,0.01)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{g.recruiter_name}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', maxWidth: 200, wordBreak: 'break-word' }}>{g.role}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{g.client}</td>

                      {/* Mid-week stage */}
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '3px 8px', borderRadius: 6, background: `${MID_COLOR}15`, color: MID_COLOR }}>
                          {g.mid_week_stage || '—'}
                        </span>
                      </td>

                      {/* Mid actual/target */}
                      <td style={{ padding: '10px 12px', textAlign: 'center', minWidth: 90 }}>
                        <button onClick={() => openDrill(g,'mid')} style={{ background:'none', border:'none', cursor:'pointer', padding:0, display:'inline-flex', alignItems:'center', gap:4 }}>
                          <span style={{ fontWeight: 800, fontSize: 14, color: midColor }}>{midActual}</span>
                          <span style={{ color: 'var(--text-muted)' }}>/</span>
                          <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{midTarget}</span>
                        </button>
                        <ProgressBar actual={midActual} target={midTarget} color={midColor} />
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
                          {pctVal(midActual,midTarget) !== null ? `${pctVal(midActual,midTarget)}%` : '—'}
                        </div>
                      </td>

                      {/* End-week stage */}
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '3px 8px', borderRadius: 6, background: `${END_COLOR}15`, color: END_COLOR }}>
                          {g.end_week_stage || '—'}
                        </span>
                      </td>

                      {/* End actual/target */}
                      <td style={{ padding: '10px 12px', textAlign: 'center', minWidth: 90 }}>
                        <button onClick={() => openDrill(g,'end')} style={{ background:'none', border:'none', cursor:'pointer', padding:0, display:'inline-flex', alignItems:'center', gap:4 }}>
                          <span style={{ fontWeight: 800, fontSize: 14, color: endColor }}>{endActual}</span>
                          <span style={{ color: 'var(--text-muted)' }}>/</span>
                          <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{endTarget}</span>
                        </button>
                        <ProgressBar actual={endActual} target={endTarget} color={endColor} />
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
                          {pctVal(endActual,endTarget) !== null ? `${pctVal(endActual,endTarget)}%` : '—'}
                        </div>
                      </td>

                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 11, maxWidth: 200, wordBreak: 'break-word' }}>{g.notes || ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, marginTop: 12, justifyContent: 'flex-end' }}>
            {legend.map(l => (
              <div key={l.label} style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.color }} />
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{l.label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 2 — Sales Performance
// ════════════════════════════════════════════════════════════════════════════
function SalesTab({ filterType }) {
  const [campaigns, setCampaigns] = useState([]);
  const [sdrs,      setSdrs]      = useState([]);
  const [selSDR,    setSelSDR]    = useState('all');
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [drill,     setDrill]     = useState(null);

  const range = useMemo(() => getRange(filterType), [filterType]);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    const qs = new URLSearchParams({ start: range.start, end: range.end });
    if (selSDR !== 'all') qs.set('account_id', selSDR);

    Promise.all([
      fetch(`/api/smt/sales/campaigns?${qs}`, { headers: authHeaders() }).then(r => r.json()),
      fetch('/api/smt/sales/sdrs',             { headers: authHeaders() }).then(r => r.json()),
    ]).then(([cd, sd]) => {
      setCampaigns(cd.campaigns || []);
      setSdrs(sd.sdrs || []);
      setLoading(false);
    }).catch(e => { setError(e.message); setLoading(false); });
  }, [range, selSDR]);

  useEffect(() => { load(); }, [load]);

  // Totals banner
  const totals = useMemo(() => campaigns.reduce((acc, c) => ({
    cr_sent:    acc.cr_sent    + (Number(c.connections_requested)        || 0),
    cr_accepted:acc.cr_accepted+ (Number(c.connection_requests_accepted) || 0),
    replies:    acc.replies    + (Number(c.connection_replies)           || 0),
    emails:     acc.emails     + (Number(c.emails_sent)                  || 0),
    inmails:    acc.inmails    + (Number(c.inmails_sent)                 || 0),
    calls:      acc.calls      + (Number(c.calls)                        || 0),
    campaigns:  acc.campaigns  + 1,
  }), { cr_sent:0, cr_accepted:0, replies:0, emails:0, inmails:0, calls:0, campaigns:0 }), [campaigns]);

  // Per-SDR aggregation
  const bySDR = useMemo(() => {
    const m = {};
    campaigns.forEach(c => {
      const k = c.account_id;
      if (!m[k]) m[k] = { name: c.account_name, cr_sent:0, cr_accepted:0, replies:0, emails:0, inmails:0, calls:0, campaigns:0, acc_rates:[], res_rates:[] };
      m[k].cr_sent     += Number(c.connections_requested)        || 0;
      m[k].cr_accepted += Number(c.connection_requests_accepted) || 0;
      m[k].replies     += Number(c.connection_replies)           || 0;
      m[k].emails      += Number(c.emails_sent)                  || 0;
      m[k].inmails     += Number(c.inmails_sent)                 || 0;
      m[k].calls       += Number(c.calls)                        || 0;
      m[k].campaigns++;
      if (Number(c.acceptance_rate)) m[k].acc_rates.push(Number(c.acceptance_rate));
      if (Number(c.response_rate))   m[k].res_rates.push(Number(c.response_rate));
    });
    return Object.values(m).sort((a,b) => b.cr_sent - a.cr_sent);
  }, [campaigns]);

  const fmtPct = (arr) => arr.length ? `${(arr.reduce((s,v)=>s+v,0)/arr.length).toFixed(1)}%` : '—';
  const pctBadge = (actual, target, isPercent) => {
    const val = isPercent ? actual : (target ? (actual/target)*100 : null);
    if (val === null) return 'var(--text-muted)';
    return val >= 15 ? OK : val >= 7 ? WARN : BAD;
  };

  const CAMP_COLS = [
    { key: 'account_name',                label: 'SDR' },
    { key: 'campaign_name',               label: 'Campaign',     maxWidth: 200 },
    { key: 'connections_requested',       label: 'CR Sent',   align: 'center' },
    { key: 'connection_requests_accepted',label: 'CR Accepted', align: 'center' },
    { key: 'connection_replies',          label: 'Replies',    align: 'center' },
    { key: 'emails_sent',                 label: 'Emails',     align: 'center' },
    { key: 'inmails_sent',                label: 'InMails',    align: 'center' },
    { key: 'calls',                       label: 'Calls',      align: 'center' },
    { key: 'acceptance_rate',             label: 'Accept %',   align: 'center',
      render: (v,r) => {
        const pct = Number(v)||0;
        return <span style={{ fontWeight:700, color: pctBadge(pct,null,true) }}>{pct ? `${pct.toFixed(1)}%` : '—'}</span>;
      }
    },
    { key: 'response_rate',               label: 'Reply %',    align: 'center',
      render: (v,r) => {
        const pct = Number(v)||0;
        return <span style={{ fontWeight:700, color: pctBadge(pct,null,true) }}>{pct ? `${pct.toFixed(1)}%` : '—'}</span>;
      }
    },
    { key: 'created_at', label: 'Date', align: 'center',
      render: v => v ? new Date(v).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : '—'
    },
  ];

  return (
    <div>
      {drill && <DrillModal {...drill} onClose={() => setDrill(null)} />}

      {/* SDR filter */}
      <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={selSDR} onChange={e => setSelSDR(e.target.value)} style={{
          padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
          background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
          color: 'var(--text-primary)', cursor: 'pointer', minWidth: 160,
        }}>
          <option value="all">All SDRs</option>
          {sdrs.map(s => <option key={s.account_id} value={s.account_id}>{s.account_name}</option>)}
        </select>
        <button onClick={load} style={{ padding: '5px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>↻</button>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)' }}>
          {range.start} → {range.end} · {totals.campaigns} campaign{totals.campaigns !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Loading…</div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: 20, color: BAD, fontSize: 12 }}>Error: {error}</div>
      ) : (
        <>
          {/* Totals banner */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {[
              { label: 'CR Sent',     value: totals.cr_sent,     color: SALES_COLOR },
              { label: 'CR Accepted', value: totals.cr_accepted,  color: OK },
              { label: 'Replies',     value: totals.replies,      color: MID_COLOR },
              { label: 'Emails',      value: totals.emails,       color: END_COLOR },
              { label: 'InMails',     value: totals.inmails,      color: WARN },
              { label: 'Calls',       value: totals.calls,        color: '#ec4899' },
              { label: 'Accept %',    value: totals.cr_sent ? `${((totals.cr_accepted/totals.cr_sent)*100).toFixed(1)}%` : '—', color: pctBadge(totals.cr_accepted,totals.cr_sent) },
              { label: 'Campaigns',   value: totals.campaigns,    color: 'var(--text-muted)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ flex: 1, minWidth: 72, textAlign: 'center', padding: '9px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}20` }}>
                <div style={{ fontSize: 17, fontWeight: 800, color }}>{value}</div>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* SDR cards */}
          {bySDR.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              {bySDR.map(s => {
                const acceptPct = s.cr_sent ? (s.cr_accepted/s.cr_sent)*100 : 0;
                const ac = pctBadge(acceptPct, null, true);
                return (
                  <div key={s.name} style={{ flex: '1 1 180px', minWidth: 180, maxWidth: 240, padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: `1px solid ${SALES_COLOR}20` }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-primary)', marginBottom: 8 }}>{s.name}</div>
                    {[
                      ['CR Sent',     s.cr_sent,     SALES_COLOR],
                      ['CR Accepted', s.cr_accepted,  OK],
                      ['Replies',     s.replies,      MID_COLOR],
                      ['Emails',      s.emails,       END_COLOR],
                    ].map(([label, val, color]) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color }}>{val}</span>
                      </div>
                    ))}
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Accept %</span>
                        <span style={{ fontSize: 10, fontWeight: 800, color: ac }}>{acceptPct.toFixed(1)}%</span>
                      </div>
                      <ProgressBar actual={acceptPct} target={100} color={ac} height={3} />
                    </div>
                    <div style={{ marginTop: 4, fontSize: 9, color: 'var(--text-muted)' }}>{s.campaigns} campaign{s.campaigns!==1?'s':''}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Campaign table */}
          {campaigns.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                All Campaigns
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                    {CAMP_COLS.map(c => (
                      <th key={c.key} style={{ padding: '7px 10px', textAlign: c.align||'left', fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((camp, i) => (
                    <tr key={camp.campaign_id || i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i%2===0?'transparent':'rgba(255,255,255,0.01)' }}>
                      {CAMP_COLS.map(col => (
                        <td key={col.key} style={{ padding: '8px 10px', textAlign: col.align||'left', color: 'var(--text-secondary)', maxWidth: col.maxWidth||'none', wordBreak: 'break-word' }}>
                          {col.render ? col.render(camp[col.key], camp) : (camp[col.key] ?? '—')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, marginTop: 12, justifyContent: 'flex-end', alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Accept % →</span>
            {[{ color: BAD, label: '< 7%' }, { color: WARN, label: '7–14%' }, { color: OK, label: '≥ 15%' }].map(l => (
              <div key={l.label} style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.color }} />
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{l.label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Root — Performance Tracker card
// ════════════════════════════════════════════════════════════════════════════
const TABS = [
  { id: 'recruiter', label: '🎯 Recruiter Performance', color: REC_COLOR,   gradient: REC_GRAD   },
  { id: 'sales',     label: '💼 Sales Performance',     color: SALES_COLOR, gradient: null       },
];

export default function PerformanceTracker() {
  const [activeTab,   setActiveTab]   = useState('recruiter');
  const [filterType,  setFilterType]  = useState('Weekly');
  const active = TABS.find(t => t.id === activeTab);

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      {/* Header row: title + tab bar + filter pills in one line */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          📊 Performance Tracker
        </span>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 20, padding: '3px' }}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                padding: '5px 14px', borderRadius: 18, cursor: 'pointer', fontSize: 10,
                fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
                border: 'none',
                background: isActive ? (tab.gradient || tab.color) : 'transparent',
                color: isActive ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.15s',
              }}>{tab.label}</button>
            );
          })}
        </div>

        <div style={{ flex: 1 }} />

        {/* Shared filter pills */}
        <div style={{ display: 'flex', gap: 4 }}>
          {['Today','Weekly','Monthly'].map(t => {
            const isActive = filterType === t;
            return (
              <button key={t} onClick={() => setFilterType(t)} style={{
                padding: '5px 13px', borderRadius: 20, cursor: 'pointer', fontSize: 10,
                fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em',
                border: isActive ? 'none' : '1px solid rgba(255,255,255,0.1)',
                background: isActive ? (active.gradient || active.color) : 'transparent',
                color: isActive ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.15s',
              }}>{t}</button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'recruiter' && <RecruiterTab filterType={filterType} />}
      {activeTab === 'sales'     && <SalesTab     filterType={filterType} />}
    </div>
  );
}
