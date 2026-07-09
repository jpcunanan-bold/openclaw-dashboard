import { useState, useEffect, useCallback } from 'react';
import { AGENT_CONFIG, agentColor, agentLabel, agentRole } from '../utils/agentConfig';
import { authHeaders } from './LoginGate';

const agentIds = Object.keys(AGENT_CONFIG);
const NOISE    = /^(HEARTBEAT|Delta:|Cron job|Heartbeat \/ System|HEARTBEAT_OK)/i;

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n)  { if (!n) return '$0.00'; return `$${Number(n).toFixed(2)}`; }
function fmtK(n) { return n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n/1000).toFixed(0)}k` : String(Math.round(n||0)); }
function timeAgo(ts) {
  if (!ts) return '—';
  const m = Math.floor((Date.now() - new Date(ts)) / 60_000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m/60);
  if (h < 24) return `${h}h ago`;
  return new Date(ts).toLocaleDateString('en-US', { month:'short', day:'numeric' });
}
function isoDate(d) { return d.toISOString().slice(0,10); }

// ── Cost pill ─────────────────────────────────────────────────────────────────
function CostPill({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center', padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', flex: 1 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: color || 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ daily, color }) {
  if (!daily?.length) return null;
  const max = Math.max(...daily.map(d => d.cost), 0.001);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 40 }}>
      {daily.map((d, i) => (
        <div
          key={i}
          title={`${d.date}: ${fmt(d.cost)}`}
          style={{
            flex: 1, borderRadius: '2px 2px 0 0',
            height: `${Math.max(4, (d.cost / max) * 100)}%`,
            background: d.cost > 0 ? color : 'rgba(255,255,255,0.06)',
            opacity: 0.8,
          }}
        />
      ))}
    </div>
  );
}

// ── Hooks ─────────────────────────────────────────────────────────────────────
function useCostData() {
  const [data, setData]       = useState({});
  const [fleet, setFleet]     = useState({ today:0, mtd:0, t3m:0, inception:0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const now    = new Date();
      const today  = isoDate(now);
      const mtdStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
      const t3mStr = isoDate(new Date(now - 90*86_400_000));

      const results = await Promise.all(
        agentIds.map(id =>
          fetch(`/api/bb/cost-snapshots?agent_id=${encodeURIComponent(id)}&days=90`, { headers: authHeaders() })
            .then(r => r.ok ? r.json() : { snapshots: [] })
            .catch(() => ({ snapshots: [] }))
        )
      );

      const todayRes = await fetch('/api/cost/today', { headers: authHeaders() }).catch(() => null);
      const todayDetail = todayRes?.ok ? await todayRes.json() : null;

      const byAgent = {};
      let fToday=0, fMtd=0, fT3m=0, fInc=0;

      agentIds.forEach((id, i) => {
        const snaps = results[i]?.snapshots || [];
        const sum = (filter) => snaps.filter(filter).reduce((s,r) => s + Number(r.total_cost_usd||0), 0);
        const todaySnap = sum(r => r.snapshot_date?.startsWith(today));
        const liveToday = (id === 'laura-abhi-agent' && todayDetail?.actualCostUsd) ? todayDetail.actualCostUsd : todaySnap;

        // 14-day daily series
        const daily14 = [];
        for (let d = 13; d >= 0; d--) {
          const dt = isoDate(new Date(Date.now() - d*86_400_000));
          const row = snaps.find(s => s.snapshot_date?.startsWith(dt));
          daily14.push({ date: dt, cost: row ? Number(row.total_cost_usd) : 0 });
        }

        const agData = {
          today:     liveToday,
          mtd:       sum(r => r.snapshot_date >= mtdStr),
          t3m:       sum(r => r.snapshot_date >= t3mStr),
          inception: sum(() => true),
          daily14,
          totalTokens: snaps.reduce((s,r) => s + (Number(r.total_tokens)||0), 0),
          snapshotCount: snaps.length,
        };
        byAgent[id] = agData;
        fToday += liveToday;
        fMtd   += agData.mtd;
        fT3m   += agData.t3m;
        fInc   += agData.inception;
      });

      setData(byAgent);
      setFleet({ today: fToday, mtd: fMtd, t3m: fT3m, inception: fInc });
    } catch(e) { console.warn('AgentsSection cost error:', e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  return { data, fleet, loading, refresh: load };
}

function useActivities(agentId, days=30) {
  const [acts, setActs]   = useState([]);
  const [meta, setMeta]   = useState({ loading: true, totalCost:0, totalTokens:0 });

  useEffect(() => {
    if (!agentId) { setMeta(m => ({...m, loading:false})); return; }
    setMeta(m => ({...m, loading:true}));
    fetch(`/api/agent-activities?agent_id=${encodeURIComponent(agentId)}&days=${days}&limit=50`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : { activities:[], totalCost:0, totalTokens:0 })
      .then(d => {
        const filtered = (d.activities||[]).filter(a => !NOISE.test(a.title||''));
        setActs(filtered);
        setMeta({ loading:false, totalCost: d.totalCost||0, totalTokens: d.totalTokens||0 });
      })
      .catch(() => setMeta(m => ({...m, loading:false})));
  }, [agentId, days]);

  return { acts, ...meta };
}

// ═══════════════════════════════════════════════════════════════════════
// FLEET LIST COMPONENTS
// ═══════════════════════════════════════════════════════════════════════
function AgentFleetCard({ id, costData, onSelectAgent }) {
  const [expanded, setExpanded] = useState(false);
  const { acts, loading: actsLoading } = useActivities(expanded ? id : null, 7);

  const color   = agentColor(id);
  const label   = agentLabel(id);
  const cfg     = AGENT_CONFIG[id] || {};
  const lastAct = acts[0];

  return (
    <div style={{
      border: `1px solid ${expanded ? color+'50' : 'var(--border)'}`,
      borderRadius: 10, marginBottom: 8,
      background: expanded ? `${color}06` : 'rgba(255,255,255,0.02)',
      transition: 'all 0.2s', overflow: 'hidden',
    }}>
      {/* Card header */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
      >
        {/* Avatar */}
        <div style={{
          width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
          background: `${color}20`, border: `2px solid ${color}60`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, fontWeight: 800, color,
        }}>
          {label[0]}
        </div>

        {/* Name + status */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{label}</span>
            <span style={{
              fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 20, textTransform: 'uppercase',
              background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#34D399',
            }}>Active</span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{cfg.role} · {cfg.owner}</div>
        </div>

        {/* Click-to-name detail button */}
        <button
          onClick={e => { e.stopPropagation(); onSelectAgent(id); }}
          style={{
            background: 'none', border: `1px solid ${color}40`, borderRadius: 8,
            color, fontSize: 10, fontWeight: 700, padding: '3px 10px', cursor: 'pointer',
          }}
        >
          Detail →
        </button>
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Cost pills */}
      <div style={{ display: 'flex', gap: 4, padding: '0 14px 12px', flexWrap: 'wrap' }}>
        <CostPill label="Today"     value={fmt(costData?.today)}     color={color} />
        <CostPill label="MTD"       value={fmt(costData?.mtd)}       color="var(--purple-light)" />
        <CostPill label="3 months"  value={fmt(costData?.t3m)}       color="var(--orange)" />
        <CostPill label="Inception" value={fmt(costData?.inception)} color="var(--green-light)" />
      </div>

      {/* Expanded section */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${color}20`, padding: '12px 14px' }}>
          {/* Stats row */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Tokens: <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>{fmtK(costData?.totalTokens || 0)}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Last active: <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>{timeAgo(acts[0]?.timestamp)}</span>
            </div>
          </div>

          {/* Sparkline */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 5 }}>14-Day Cost Trend</div>
            <Sparkline daily={costData?.daily14} color={color} />
          </div>

          {/* Recent activities */}
          <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Recent Activities
          </div>
          {actsLoading ? (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '6px 0' }}>Loading…</div>
          ) : acts.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '6px 0' }}>No recent activity</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
              {acts.slice(0,6).map((a, i) => (
                <div key={a.id||i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, marginTop: 4, flexShrink: 0, opacity: 0.7 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.title}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                      {a.model && <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{a.model.split('/').pop()}</span>}
                      {a.cost_usd > 0 && <span style={{ fontSize: 9, color: '#10B981' }}>{fmt(a.cost_usd)}</span>}
                      {a.total_tokens > 0 && <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{fmtK(a.total_tokens)} tok</span>}
                    </div>
                  </div>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>{timeAgo(a.timestamp)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// AGENT DETAIL PAGE
// ═══════════════════════════════════════════════════════════════════════
const STATUS_COLORS = {
  completed:   '#10B981',
  in_progress: '#06E5EC',
  open:        '#A78BFA',
  blocked:     '#EF4444',
  pending:     '#F59E0B',
};

function AgentDetailPage({ agentId, costData, onBack }) {
  const color = agentColor(agentId);
  const label = agentLabel(agentId);
  const cfg   = AGENT_CONFIG[agentId] || {};
  const { acts, loading: actsLoading, totalCost, totalTokens } = useActivities(agentId, 30);

  // Task status breakdown
  const [tasks, setTasks] = useState([]);
  useEffect(() => {
    fetch(`/api/abhi/tasks?agent=laura&days=60&limit=100`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : { tasks:[] })
      .then(d => setTasks(d.tasks||[]))
      .catch(() => {});
  }, [agentId]);

  const statusCounts = tasks.reduce((acc, t) => {
    const s = t.status || 'open';
    acc[s] = (acc[s]||0) + 1;
    return acc;
  }, {});

  return (
    <div>
      {/* Back button */}
      <button
        onClick={onBack}
        style={{
          background: 'none', border: '1px solid var(--border)', borderRadius: 8,
          color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600,
          padding: '6px 14px', cursor: 'pointer', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        ← Back to Fleet
      </button>

      {/* Agent header card */}
      <div style={{
        padding: '16px 18px', borderRadius: 12, marginBottom: 12,
        border: `1px solid ${color}40`, background: `${color}08`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
            background: `${color}25`, border: `3px solid ${color}70`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 900, color,
          }}>
            {label[0]}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{label}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {cfg.role} · {cfg.owner}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#34D399',
              }}>● Active</span>
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                background: `${color}15`, border: `1px solid ${color}30`, color,
              }}>agent_id: {agentId}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Cost pills card */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <CostPill label="Today"         value={fmt(costData?.today)}     color={color} />
          <CostPill label="MTD"           value={fmt(costData?.mtd)}       color="var(--purple-light)" />
          <CostPill label="Trailing 3mo"  value={fmt(costData?.t3m)}       color="var(--orange)" />
          <CostPill label="Since Inception" value={fmt(costData?.inception)} color="var(--green-light)" />
        </div>
      </div>

      {/* Activity stats + sparkline — 2 columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        {/* Activity stats */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            Activity Stats
          </div>
          {[
            { label: 'Total Activities', value: acts.length, color },
            { label: 'Total Tokens',     value: fmtK(totalTokens), color: '#06E5EC' },
            { label: 'Total AI Cost',    value: fmt(totalCost),    color: '#10B981' },
            { label: 'Last Active',      value: timeAgo(acts[0]?.timestamp), color: 'var(--text-secondary)' },
          ].map(({ label, value, color: c }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: c }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Sparkline */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            14-Day Cost Trend
          </div>
          <Sparkline daily={costData?.daily14} color={color} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>14 days ago</span>
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>Today</span>
          </div>
        </div>
      </div>

      {/* Task status breakdown */}
      {Object.keys(statusCounts).length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            Task Status Breakdown
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(statusCounts).map(([status, count]) => {
              const sc = STATUS_COLORS[status] || '#64748B';
              return (
                <span key={status} style={{
                  fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20,
                  background: `${sc}18`, border: `1px solid ${sc}40`, color: sc,
                }}>
                  {status.replace('_',' ')} · {count}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Full activity log */}
      <div className="card" style={{ marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Activity Log
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>— last 30 days, newest first</span>
        </div>

        {actsLoading ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 12 }}>Loading…</div>
        ) : acts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 12 }}>No activities found</div>
        ) : (
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr>
                  {['Title', 'Model', 'When', 'Cost', 'Tokens'].map(h => (
                    <th key={h} style={{
                      padding: '5px 8px', textAlign: h === 'Title' ? 'left' : 'center',
                      fontSize: 9, fontWeight: 700, color: 'var(--text-muted)',
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                      borderBottom: '1px solid var(--border)', position: 'sticky', top: 0,
                      background: 'var(--bg-card)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {acts.map((a, i) => (
                  <tr key={a.id||i} style={{ background: i%2 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                    <td style={{ padding: '6px 8px', maxWidth: 280 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-primary)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {a.title || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 10 }}>
                      {(a.model||'').split('/').pop() || '—'}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 10, whiteSpace: 'nowrap' }}>
                      {timeAgo(a.timestamp)}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'center', color: a.cost_usd > 0 ? '#10B981' : 'var(--text-muted)', fontWeight: a.cost_usd > 0 ? 700 : 400 }}>
                      {a.cost_usd > 0 ? fmt(a.cost_usd) : '—'}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 10 }}>
                      {a.total_tokens > 0 ? fmtK(a.total_tokens) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN EXPORT — Fleet list or detail page
// ═══════════════════════════════════════════════════════════════════════
export default function AgentsSection() {
  const [selectedId, setSelectedId] = useState(null);
  const { data: costMap, fleet, loading } = useCostData();

  const totalActs = agentIds.reduce((s, id) => s + (costMap[id]?.snapshotCount||0), 0);

  if (selectedId) {
    return (
      <AgentDetailPage
        agentId={selectedId}
        costData={costMap[selectedId]}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <div>
      {/* Fleet summary banner */}
      <div style={{
        display: 'flex', gap: 0, borderRadius: 10, overflow: 'hidden',
        border: '1px solid var(--border)', marginBottom: 16,
        background: 'rgba(124,58,237,0.06)',
      }}>
        {[
          { label: 'Today',          value: loading ? '…' : fmt(fleet.today),     color: '#06E5EC' },
          { label: 'MTD',            value: loading ? '…' : fmt(fleet.mtd),       color: 'var(--purple-light)' },
          { label: 'Trailing 3mo',   value: loading ? '…' : fmt(fleet.t3m),       color: 'var(--orange)' },
          { label: 'Since Inception',value: loading ? '…' : fmt(fleet.inception), color: 'var(--green-light)' },
        ].map(({ label, value, color }, i) => (
          <div key={label} style={{
            flex: 1, textAlign: 'center', padding: '12px 8px',
            borderRight: i < 3 ? '1px solid var(--border)' : 'none',
          }}>
            <div style={{ fontSize: 16, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{label}</div>
          </div>
        ))}
        <div style={{ borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '12px 16px' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--purple-light)' }}>{agentIds.length}</div>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>Agents</div>
        </div>
      </div>

      {/* Agent cards */}
      {agentIds.map(id => (
        <AgentFleetCard
          key={id}
          id={id}
          costData={costMap[id]}
          onSelectAgent={setSelectedId}
        />
      ))}
    </div>
  );
}
