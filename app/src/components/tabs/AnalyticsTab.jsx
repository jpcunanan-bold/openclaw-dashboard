import { useState, useEffect, useCallback } from 'react';

const LAURA_COLOR  = '#06E5EC';
const DARREN_COLOR = '#F59E0B';
const AGENT_COLORS = { 'laura-abhi-agent': LAURA_COLOR, 'darren-abhi-agent': DARREN_COLOR };
const AGENT_LABELS = { 'laura-abhi-agent': 'Laura', 'darren-abhi-agent': 'Darren' };

function fmt$(n) { return n != null ? `$${Number(n).toFixed(4)}` : '—'; }
function fmtK(n) { return n == null ? '—' : n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n/1_000).toFixed(0)}K` : String(n); }

const PRESETS = [
  { id: 'today',     label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7d',        label: 'Last 7d' },
  { id: '30d',       label: 'Last 30d' },
  { id: 'month',     label: 'This Month' },
  { id: 'custom',    label: 'Custom' },
];

const COST_BUCKETS = [
  { key: 'lead-gen',    label: 'Lead Gen',       color: '#10b981' },
  { key: 'outreach',    label: 'Outreach',        color: '#0ea5e9' },
  { key: 'enrichment',  label: 'Enrichment',      color: '#8b5cf6' },
  { key: 'follow-up',   label: 'Follow-up',       color: '#f59e0b' },
  { key: 'research',    label: 'Research',         color: '#ec4899' },
  { key: 'admin',       label: 'Admin / Other',   color: '#6b7280' },
];

function KpiChip({ label, value, sub, color = '#06E5EC' }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 18px', minWidth: 130 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value ?? '—'}</div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function MiniBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 3 }}>
        <span>{label}</span>
        <span style={{ color, fontWeight: 700 }}>{fmt$(value)}</span>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 4, height: 5 }}>
        <div style={{ width: `${pct}%`, background: color, borderRadius: 4, height: '100%', transition: 'width 0.4s' }} />
      </div>
    </div>
  );
}

export default function AnalyticsTab({ agentFilter }) {
  const [preset, setPreset] = useState('today');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const agent = agentFilter || 'all';

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const p = new URLSearchParams({ agent, preset });
      if (preset === 'custom') { p.set('from', fromDate); p.set('to', toDate); }
      const token = localStorage.getItem('cc_auth_token') || localStorage.getItem('authToken') || '';
      const r = await fetch(`/api/analytics?${p}`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error);
      setData(d);
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  }, [agent, preset, fromDate, toDate]);

  useEffect(() => { load(); }, [load]);

  const s = data?.summary || {};
  const tasks = data?.tasks || [];
  const activities = data?.activities || [];
  const daily = data?.dailySeries || [];

  const anthropicCost = s.anthropicCostToday;
  const displayCost   = anthropicCost ?? s.totalCostUsd ?? 0;

  const modelRows = [
    { model: 'claude-sonnet-4-6',          label: 'Claude Sonnet 4.6',   color: LAURA_COLOR  },
    { model: 'claude-haiku-4-5-20251001',  label: 'Claude Haiku 4.5',    color: '#8b5cf6' },
    { model: 'claude-opus-4-5',            label: 'Claude Opus 4.5',     color: DARREN_COLOR },
  ];

  const maxCatCost = Math.max(0, ...COST_BUCKETS.map(b => s.costByCategory?.[b.key] || 0));

  return (
    <div style={{ padding: '24px 0' }}>
      {/* Header + preset buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: agentFilter === 'darren' ? DARREN_COLOR : LAURA_COLOR }}>
          📊 Analytics & Cost Tracking
        </h2>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
          {PRESETS.map(p => (
            <button key={p.id} onClick={() => setPreset(p.id)} style={{
              padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: preset === p.id ? `rgba(6,229,236,0.12)` : 'transparent',
              border: preset === p.id ? `1px solid ${LAURA_COLOR}` : '1px solid rgba(255,255,255,0.08)',
              color: preset === p.id ? LAURA_COLOR : 'rgba(255,255,255,0.5)',
            }}>{p.label}</button>
          ))}
          {preset === 'custom' && (
            <>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                style={{ background:'rgba(255,255,255,0.05)', color:'var(--text-primary)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:6, padding:'4px 8px', fontSize:12 }} />
              <span style={{ color:'rgba(255,255,255,0.4)' }}>–</span>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                style={{ background:'rgba(255,255,255,0.05)', color:'var(--text-primary)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:6, padding:'4px 8px', fontSize:12 }} />
              <button onClick={load} style={{ padding:'5px 10px', borderRadius:6, fontSize:12, cursor:'pointer', background:'rgba(6,229,236,0.1)', border:`1px solid ${LAURA_COLOR}40`, color:LAURA_COLOR }}>Apply</button>
            </>
          )}
          <button onClick={load} style={{ padding:'5px 8px', borderRadius:6, fontSize:12, cursor:'pointer', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.4)' }}>↺</button>
        </div>
      </div>

      {error && <div style={{ padding:'10px 14px', borderRadius:8, marginBottom:16, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#f87171', fontSize:12 }}>Error: {error}</div>}

      {loading ? (
        <div style={{ textAlign:'center', color:'rgba(255,255,255,0.35)', padding:60 }}>Loading analytics…</div>
      ) : (
        <>
          {/* KPI row */}
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:24 }}>
            <KpiChip label="AI Cost (Real)" value={anthropicCost != null ? `$${anthropicCost.toFixed(4)}` : '—'} sub="Anthropic API" color={LAURA_COLOR} />
            <KpiChip label="Tasks Logged" value={s.totalTasks ?? 0} color="#8b5cf6" />
            <KpiChip label="Activities" value={s.totalActivities ?? 0} color="#ec4899" />
            <KpiChip label="Input Tokens" value={fmtK(s.totalInputTokens)} color="#60a5fa" />
            <KpiChip label="Output Tokens" value={fmtK(s.totalOutputTokens)} color="#34d399" />
            <KpiChip label="Cache Read" value={fmtK(s.totalCacheRead)} sub="(cost efficient)" color="#a3e635" />
            <KpiChip label="Cache Write" value={fmtK(s.totalCacheWrite)} color="#fb923c" />
          </div>

          {/* Cost by agent */}
          {Object.keys(s.costByAgent || {}).length > 0 && (
            <div style={{ display:'flex', gap:12, marginBottom:24, flexWrap:'wrap' }}>
              {Object.entries(s.costByAgent).map(([agId, cost]) => {
                const label = AGENT_LABELS[agId] || agId;
                const color = AGENT_COLORS[agId] || '#ccc';
                return (
                  <div key={agId} style={{ flex:'1 1 200px', background:`rgba(255,255,255,0.03)`, border:`1px solid ${color}30`, borderRadius:12, padding:'16px 20px' }}>
                    <div style={{ fontSize:24, fontWeight:800, color }}>${Number(cost).toFixed(4)}</div>
                    <div style={{ fontSize:12, color:'rgba(255,255,255,0.45)', marginTop:4 }}>💸 {label} — DB Snapshot Cost</div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:24 }}>
            {/* Cost by category */}
            <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:'16px 20px' }}>
              <div style={{ fontSize:13, fontWeight:700, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:1, marginBottom:14 }}>Cost by Task Type</div>
              {COST_BUCKETS.map(b => (
                <MiniBar key={b.key} label={b.label} value={s.costByCategory?.[b.key] || 0} max={maxCatCost || 1} color={b.color} />
              ))}
            </div>

            {/* Daily series */}
            <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:'16px 20px' }}>
              <div style={{ fontSize:13, fontWeight:700, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:1, marginBottom:14 }}>Daily Cost (DB Snapshots)</div>
              {daily.length === 0 ? (
                <div style={{ color:'rgba(255,255,255,0.25)', fontSize:12 }}>No snapshot data for this range.</div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {daily.map(d => {
                    const laura = d['laura-abhi-agent'] || 0;
                    const darren = d['darren-abhi-agent'] || 0;
                    const total = laura + darren;
                    const maxDay = Math.max(...daily.map(x => (x['laura-abhi-agent']||0) + (x['darren-abhi-agent']||0)));
                    return (
                      <div key={d.date}>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'rgba(255,255,255,0.5)', marginBottom:2 }}>
                          <span>{d.date}</span>
                          <span style={{ color:LAURA_COLOR, fontWeight:700 }}>${total.toFixed(2)}</span>
                        </div>
                        <div style={{ display:'flex', borderRadius:4, overflow:'hidden', height:6, background:'rgba(255,255,255,0.05)' }}>
                          <div style={{ width:`${maxDay>0?(laura/maxDay*100):0}%`, background:LAURA_COLOR }} />
                          <div style={{ width:`${maxDay>0?(darren/maxDay*100):0}%`, background:DARREN_COLOR }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Activities table */}
          {activities.length > 0 && (
            <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:12, padding:'16px 20px', marginBottom:24 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:1, marginBottom:14 }}>
                Recent Activities ({activities.length})
              </div>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                  <thead>
                    <tr style={{ borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
                      {['Time','Agent','Category','Title','Cost','Tokens (in/out)','Time Saved'].map(h => (
                        <th key={h} style={{ padding:'7px 10px', textAlign:'left', color:'rgba(255,255,255,0.4)', fontWeight:600, whiteSpace:'nowrap', fontSize:10, textTransform:'uppercase', letterSpacing:0.8 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activities.slice(0,50).map(a => {
                      const agColor = AGENT_COLORS[a.agent_id] || '#ccc';
                      const agLabel = AGENT_LABELS[a.agent_id] || a.agent_id;
                      return (
                        <tr key={a.id} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding:'7px 10px', color:'rgba(255,255,255,0.4)', whiteSpace:'nowrap', fontSize:10 }}>
                            {a.timestamp ? new Date(a.timestamp).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : '—'}
                          </td>
                          <td style={{ padding:'7px 10px' }}>
                            <span style={{ color:agColor, fontWeight:700, fontSize:10 }}>{agLabel}</span>
                          </td>
                          <td style={{ padding:'7px 10px', color:'rgba(255,255,255,0.5)' }}>{a.category || '—'}</td>
                          <td style={{ padding:'7px 10px', color:'rgba(255,255,255,0.8)', maxWidth:280, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.title}</td>
                          <td style={{ padding:'7px 10px', color:LAURA_COLOR, fontWeight:600, whiteSpace:'nowrap' }}>{a.cost_usd > 0 ? `$${Number(a.cost_usd).toFixed(4)}` : '—'}</td>
                          <td style={{ padding:'7px 10px', color:'rgba(255,255,255,0.4)', whiteSpace:'nowrap' }}>
                            {a.input_tokens > 0 || a.output_tokens > 0 ? `${fmtK(a.input_tokens)} / ${fmtK(a.output_tokens)}` : '—'}
                          </td>
                          <td style={{ padding:'7px 10px', color:'rgba(255,255,255,0.4)', whiteSpace:'nowrap' }}>
                            {a.time_saved_min > 0 ? `${a.time_saved_min}m` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tasks table */}
          {tasks.length > 0 && (
            <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:12, padding:'16px 20px' }}>
              <div style={{ fontSize:13, fontWeight:700, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:1, marginBottom:14 }}>
                Tasks with Cost ({tasks.length})
              </div>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                  <thead>
                    <tr style={{ borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
                      {['Time','Agent','Title','Model','Cost','Input','Output','Cache R','Cache W','Status'].map(h => (
                        <th key={h} style={{ padding:'7px 10px', textAlign:'left', color:'rgba(255,255,255,0.4)', fontWeight:600, whiteSpace:'nowrap', fontSize:10, textTransform:'uppercase', letterSpacing:0.8 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map(t => {
                      const agColor = AGENT_COLORS[t.agent_id] || '#ccc';
                      return (
                        <tr key={t.id} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding:'7px 10px', color:'rgba(255,255,255,0.4)', whiteSpace:'nowrap', fontSize:10 }}>
                            {t.created_at ? new Date(t.created_at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : '—'}
                          </td>
                          <td style={{ padding:'7px 10px' }}><span style={{ color:agColor, fontWeight:700, fontSize:10 }}>{AGENT_LABELS[t.agent_id]||t.agent_id}</span></td>
                          <td style={{ padding:'7px 10px', color:'rgba(255,255,255,0.8)', maxWidth:240, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.title}</td>
                          <td style={{ padding:'7px 10px', color:'rgba(255,255,255,0.4)', fontSize:10 }}>{t.model?.replace('claude-','')}</td>
                          <td style={{ padding:'7px 10px', color:LAURA_COLOR, fontWeight:700 }}>{t.costUsd > 0 ? `$${Number(t.costUsd).toFixed(4)}` : '—'}</td>
                          <td style={{ padding:'7px 10px', color:'rgba(255,255,255,0.4)' }}>{fmtK(t.input_tokens)}</td>
                          <td style={{ padding:'7px 10px', color:'rgba(255,255,255,0.4)' }}>{fmtK(t.output_tokens)}</td>
                          <td style={{ padding:'7px 10px', color:'rgba(255,255,255,0.4)' }}>{fmtK(t.cache_read_tokens)}</td>
                          <td style={{ padding:'7px 10px', color:'rgba(255,255,255,0.4)' }}>{fmtK(t.cache_write_tokens)}</td>
                          <td style={{ padding:'7px 10px', color: t.status === 'completed' ? '#34d399' : t.status === 'failed' ? '#f87171' : 'rgba(255,255,255,0.4)', fontSize:10 }}>{t.status}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
