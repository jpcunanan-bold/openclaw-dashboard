import { useState, useMemo } from 'react';
import { AGENT_CONFIG, agentColor, agentLabel, agentRole, agentInitials } from '../utils/agentConfig';
import { useAllAgentActivities } from '../hooks/useAgentActivities';
import { useCostSummary } from '../hooks/useCostSummary';

const agentIds = Object.keys(AGENT_CONFIG);
const RANGE_OPTIONS = [
  { label: 'Today', days: 1 },
  { label: '7d',    days: 7 },
  { label: '30d',   days: 30 },
  { label: 'All',   days: 90 },
];

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const fmt = (n) => {
  if (!n) return '$0.00';
  return `$${Number(n).toFixed(2)}`;
};

function AgentCard({ id, costData, activities, totalCost, totalTokens, selectedAgent }) {
  const [open, setOpen] = useState(false);
  const color  = agentColor(id);
  const label  = agentLabel(id);
  const role   = agentRole(id);
  const cfg    = AGENT_CONFIG[id] || {};
  const initial = agentInitials(id);

  const today     = costData?.today     || 0;
  const mtd       = costData?.mtd       || 0;
  const inception = costData?.inception || 0;
  const lastAct   = activities?.[0];
  const tokStr    = totalTokens >= 1_000_000 ? `${(totalTokens/1_000_000).toFixed(1)}M tok` :
                    totalTokens >= 1000 ? `${Math.round(totalTokens/1000)}k tok` : `${totalTokens} tok`;

  if (selectedAgent && selectedAgent !== id) return null;

  return (
    <div style={{
      border: `1px solid ${open ? color + '40' : 'var(--border)'}`,
      borderRadius: 10,
      background: open ? `${color}06` : 'rgba(255,255,255,0.02)',
      marginBottom: 10,
      transition: 'all 0.2s',
      overflow: 'hidden',
    }}>
      {/* ── Agent header ── */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
        }}
      >
        {/* Avatar */}
        <div style={{
          width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
          background: `${color}20`, border: `2px solid ${color}55`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, fontWeight: 800, color,
        }}>
          {initial}
        </div>

        {/* Name + role */}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
            {label}
            <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>
              {role}
            </span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
            {lastAct ? `Last active: ${timeAgo(lastAct.timestamp)}` : 'No recent activity'}
            {totalTokens > 0 && (
              <span style={{
                marginLeft: 8, padding: '1px 6px', borderRadius: 10,
                background: `${color}15`, border: `1px solid ${color}30`, color,
                fontWeight: 700,
              }}>
                {tokStr}
              </span>
            )}
          </div>
        </div>

        {/* Cost pills */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {[
            { l: 'Today', v: fmt(today) },
            { l: 'MTD',   v: fmt(mtd) },
            { l: 'All',   v: fmt(inception) },
          ].map(({ l, v }) => (
            <div key={l} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color }}>{v}</div>
              <div style={{ fontSize: 8, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l}</div>
            </div>
          ))}
        </div>

        <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 6 }}>{open ? '▲' : '▼'}</span>
      </button>

      {/* ── Activity feed ── */}
      {open && (
        <div style={{ borderTop: `1px solid ${color}20`, padding: '10px 14px 14px' }}>
          {activities?.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activities.slice(0, 8).map((a, i) => (
                <div key={a.id || i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%', background: color,
                    marginTop: 4, flexShrink: 0, opacity: 0.8,
                  }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{a.title || '—'}</span>
                    {a.cost_usd > 0 && (
                      <span style={{
                        marginLeft: 6, fontSize: 9, fontWeight: 700,
                        padding: '1px 5px', borderRadius: 8,
                        background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)',
                      }}>{fmt(a.cost_usd)}</span>
                    )}
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, marginTop: 1 }}>
                    {timeAgo(a.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
              No recent activities
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AgentFleetPanel({ selectedAgent }) {
  const [rangeIdx, setRangeIdx] = useState(1); // default 7d
  const days = RANGE_OPTIONS[rangeIdx].days;

  const { map, loading } = useAllAgentActivities(agentIds, days);
  const { data: costData } = useCostSummary();

  const visibleIds = selectedAgent ? [selectedAgent] : agentIds;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          🤖 AI Agents
        </span>
        {selectedAgent && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
            background: `${agentColor(selectedAgent)}20`, border: `1px solid ${agentColor(selectedAgent)}40`,
            color: agentColor(selectedAgent),
          }}>
            Filtered: {agentLabel(selectedAgent)}
          </span>
        )}
        <div style={{ flex: 1 }} />
        {/* Range pills */}
        <div style={{ display: 'flex', gap: 4 }}>
          {RANGE_OPTIONS.map((r, i) => (
            <button key={r.label} onClick={() => setRangeIdx(i)} style={{
              fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
              background: i === rangeIdx ? 'rgba(124,58,237,0.2)' : 'transparent',
              border: i === rangeIdx ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(255,255,255,0.1)',
              color: i === rangeIdx ? 'var(--purple-light)' : 'var(--text-muted)',
              cursor: 'pointer', transition: 'all 0.15s',
            }}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Agent cards */}
      {loading && !Object.keys(map).length ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: 20 }}>
          Loading agents…
        </div>
      ) : (
        visibleIds.map(id => (
          <AgentCard
            key={id}
            id={id}
            costData={costData?.byAgent?.[id]}
            activities={map[id]?.activities || []}
            totalCost={map[id]?.totalCost || 0}
            totalTokens={map[id]?.totalTokens || 0}
            selectedAgent={selectedAgent}
          />
        ))
      )}
    </div>
  );
}
