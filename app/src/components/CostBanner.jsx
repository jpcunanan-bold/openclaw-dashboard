import { useState } from 'react';
import { AGENT_CONFIG, agentColor, agentLabel } from '../utils/agentConfig';
import { useCostSummary } from '../hooks/useCostSummary';

const fmt = (n) => {
  if (n == null || isNaN(n)) return '$—';
  if (n >= 1000) return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  return `$${Number(n).toFixed(2)}`;
};
const fmtK = (n) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n/1000).toFixed(0)}k` : String(Math.round(n || 0));

const agentIds = Object.keys(AGENT_CONFIG);

function StatTile({ label, value, color }) {
  return (
    <div style={{
      flex: 1, minWidth: 110, textAlign: 'center',
      background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '12px 8px',
    }}>
      <div style={{ fontSize: 19, fontWeight: 800, color: color || 'var(--text-primary)', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 5 }}>{label}</div>
    </div>
  );
}

function Sparkline({ data, color }) {
  if (!data?.length) return null;
  const max = Math.max(...data.map(d => d.cost), 0.001);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 36 }}>
      {data.map((d, i) => (
        <div key={i} title={`${d.date}: ${fmt(d.cost)}`} style={{
          flex: 1, borderRadius: '2px 2px 0 0',
          height: `${Math.max(4, (d.cost / max) * 100)}%`,
          background: d.cost > 0 ? color : 'rgba(255,255,255,0.06)',
          opacity: d.cost > 0 ? 0.8 : 1,
          transition: 'height 0.3s',
          cursor: 'default',
        }} />
      ))}
    </div>
  );
}

function PeriodTile({ label, value, accent }) {
  return (
    <div style={{
      flex: 1, textAlign: 'center', padding: '16px 12px',
      borderRight: '1px solid var(--border)',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent || 'var(--text-primary)', letterSpacing: '-0.5px' }}>{value}</div>
    </div>
  );
}

export default function CostBanner({ selectedAgent }) {
  const { data, loading } = useCostSummary();
  const [activeTab, setActiveTab] = useState(null);  // null = fleet
  const [expanded, setExpanded]   = useState(true);

  // The "active tab" tracks independently of selectedAgent (user can click agent pills)
  const tab = activeTab ?? selectedAgent;
  const isFleet = !tab;

  const agentData = tab ? data?.byAgent?.[tab] : null;
  const fleet     = data?.fleet;

  const today     = isFleet ? fleet?.today     : agentData?.today;
  const mtd       = isFleet ? fleet?.mtd       : agentData?.mtd;
  const t3m       = isFleet ? fleet?.t3m       : agentData?.t3m;
  const inception = isFleet ? fleet?.inception : agentData?.inception;

  // Derived stats
  const totalActivities = agentIds.reduce((s, id) => s + (data?.byAgent?.[id]?.snapshots?.reduce((ss, r) => ss + (r.task_count || 0), 0) || 0), 0);
  const totalTokens     = agentIds.reduce((s, id) => s + (data?.byAgent?.[id]?.snapshots?.reduce((ss, r) => ss + (Number(r.total_tokens) || 0), 0) || 0), 0);
  const costPerAct      = totalActivities ? ((fleet?.inception || 0) / totalActivities) : 0;
  const costPerMTok     = totalTokens ? ((fleet?.inception || 0) / (totalTokens / 1_000_000)) : 0;

  // Agent-specific stats
  const agSnaps = agentData?.snapshots || [];
  const agTotalActs = agSnaps.reduce((s, r) => s + (r.task_count || 0), 0);
  const agTotalToks = agSnaps.reduce((s, r) => s + (Number(r.total_tokens) || 0), 0);
  const agCostPerAct = agTotalActs ? ((agentData?.inception || 0) / agTotalActs) : 0;
  const agCostPerMTok = agTotalToks ? ((agentData?.inception || 0) / (agTotalToks / 1_000_000)) : 0;
  const agAvgDaily = agSnaps.length ? (agentData?.inception || 0) / agSnaps.length : 0;
  const agPeakDay  = agSnaps.length ? Math.max(...agSnaps.map(r => Number(r.total_cost_usd) || 0)) : 0;

  const shimmer = 'rgba(255,255,255,0.06)';

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      {/* ── Header row ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>💰 AI Fleet Cost</span>

        {/* Lifetime badge */}
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
          background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)',
          color: 'var(--purple-light)',
        }}>
          {loading ? 'Loading…' : `Lifetime: ${fmt(fleet?.inception)}`}
        </span>

        <div style={{ flex: 1 }} />

        <button onClick={() => setExpanded(e => !e)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          {expanded ? '▲' : '▼'} {expanded ? 'Hide' : 'Show'} breakdown
        </button>

        <a href="#roi" style={{
          fontSize: 11, fontWeight: 700, color: 'var(--purple-light)',
          textDecoration: 'none', padding: '3px 10px', borderRadius: 20,
          border: '1px solid rgba(124,58,237,0.25)',
        }}>
          Full report →
        </a>
      </div>

      {/* ── Agent tab bar ── */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {/* Fleet pill */}
        <button onClick={() => setActiveTab(null)} style={{
          fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 20,
          background: isFleet ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.04)',
          border: isFleet ? '1px solid rgba(124,58,237,0.5)' : '1px solid rgba(255,255,255,0.1)',
          color: isFleet ? 'var(--purple-light)' : 'var(--text-muted)',
          cursor: 'pointer', transition: 'all 0.15s',
        }}>
          🛠 Fleet
        </button>

        {agentIds.map(id => {
          const color = agentColor(id);
          const active = tab === id;
          return (
            <button key={id} onClick={() => setActiveTab(active ? null : id)} style={{
              fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 20,
              background: active ? `${color}25` : 'rgba(255,255,255,0.04)',
              border: active ? `1px solid ${color}60` : '1px solid rgba(255,255,255,0.1)',
              color: active ? color : 'var(--text-muted)',
              cursor: 'pointer', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
              {agentLabel(id)}
            </button>
          );
        })}
      </div>

      {/* ── 4 Period tiles ── */}
      <div style={{
        display: 'flex', borderRadius: 10, overflow: 'hidden',
        border: '1px solid var(--border)', marginBottom: expanded ? 20 : 0,
      }}>
        <PeriodTile label="Today"          value={loading ? '…' : fmt(today)}     accent="#06E5EC" />
        <PeriodTile label="MTD"            value={loading ? '…' : fmt(mtd)}       accent="var(--purple-light)" />
        <PeriodTile label="Trailing 3mo"   value={loading ? '…' : fmt(t3m)}       accent="var(--orange)" />
        <div style={{ flex: 1, textAlign: 'center', padding: '16px 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Since inception</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--green-light)', letterSpacing: '-0.5px' }}>{loading ? '…' : fmt(inception)}</div>
        </div>
      </div>

      {/* ── Expandable breakdown ── */}
      {expanded && (
        isFleet ? (
          /* Fleet breakdown */
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
              Fleet Breakdown
            </div>

            {/* Stat tiles */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              <StatTile label="Total Activities" value={loading ? '…' : fmtK(totalActivities)} color="var(--purple-light)" />
              <StatTile label="Total Tokens"     value={loading ? '…' : fmtK(totalTokens)}     color="#06E5EC" />
              <StatTile label="Cost / Activity"  value={loading ? '…' : fmt(costPerAct)}        color="var(--orange)" />
              <StatTile label="Cost / 1M Tokens" value={loading ? '…' : fmt(costPerMTok)}       color="var(--green-light)" />
            </div>

            {/* 14-day sparklines grid — 2 columns */}
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>14-Day Cost Trend</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
              {agentIds.map(id => {
                const color = agentColor(id);
                const daily = data?.byAgent?.[id]?.daily14 || [];
                return (
                  <div key={id} style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${color}25`, background: `${color}08` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color }}>{agentLabel(id)}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{fmt(data?.byAgent?.[id]?.inception)}</span>
                    </div>
                    <Sparkline data={daily} color={color} />
                  </div>
                );
              })}
            </div>

            {/* Comparison table */}
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Per-Agent Comparison</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr>
                  {['Agent', 'Today', 'MTD', 'Inception', 'Cost/Act'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agentIds.map((id, i) => {
                  const color = agentColor(id);
                  const ag = data?.byAgent?.[id];
                  const snps = ag?.snapshots || [];
                  const acts = snps.reduce((s, r) => s + (r.task_count || 0), 0);
                  const cpa  = acts ? (ag?.inception || 0) / acts : 0;
                  const maxI = Math.max(...agentIds.map(k => data?.byAgent?.[k]?.inception || 0), 0.001);
                  const pct  = ((ag?.inception || 0) / maxI * 100).toFixed(0);
                  return (
                    <tr key={id} style={{ background: i % 2 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                      <td style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
                        <span style={{ fontWeight: 700, color }}>{agentLabel(id)}</span>
                      </td>
                      <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>{fmt(ag?.today)}</td>
                      <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>{fmt(ag?.mtd)}</td>
                      <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>{fmt(ag?.inception)}</td>
                      <td style={{ padding: '6px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{cpa > 0 ? fmt(cpa) : '—'}</span>
                          <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, minWidth: 40 }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, opacity: 0.7 }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Single agent breakdown */
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: agentColor(tab), textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
              {agentLabel(tab)} Breakdown
            </div>

            {/* 4 stat tiles */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <StatTile label="Activities"    value={loading ? '…' : fmtK(agTotalActs)} color={agentColor(tab)} />
              <StatTile label="Tokens Used"   value={loading ? '…' : fmtK(agTotalToks)} color="#06E5EC" />
              <StatTile label="Cost/Activity" value={loading ? '…' : (agCostPerAct > 0 ? fmt(agCostPerAct) : '—')} color="var(--orange)" />
              <StatTile label="Cost/1M Tok"   value={loading ? '…' : (agCostPerMTok > 0 ? fmt(agCostPerMTok) : '—')} color="var(--green-light)" />
            </div>

            {/* 3 daily tiles */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              <StatTile label="Avg Daily Cost" value={loading ? '…' : fmt(agAvgDaily)}   color="var(--text-secondary)" />
              <StatTile label="Peak Day Cost"  value={loading ? '…' : fmt(agPeakDay)}    color="var(--red)" />
              <StatTile label="Days Tracked"   value={loading ? '…' : String(agSnaps.length)} color="var(--text-secondary)" />
            </div>

            {/* 30-day sparkline */}
            <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 8, border: `1px solid ${agentColor(tab)}25`, background: `${agentColor(tab)}08` }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}>14-Day Cost Trend</div>
              <Sparkline data={agentData?.daily14} color={agentColor(tab)} />
            </div>

            {/* 7-day cost rows */}
            <div>
              {(agentData?.daily14 || []).slice(-7).reverse().map((d, i) => {
                const maxC = Math.max(...(agentData?.daily14 || []).map(x => x.cost), 0.001);
                const pct  = (d.cost / maxC * 100).toFixed(0);
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', minWidth: 60 }}>{d.date?.slice(5)}</span>
                    <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: agentColor(tab), borderRadius: 2, opacity: 0.7 }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', minWidth: 50, textAlign: 'right' }}>{fmt(d.cost)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}
    </div>
  );
}
