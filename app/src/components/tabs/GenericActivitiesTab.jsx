/**
 * GenericActivitiesTab — reusable activities feed for any agent.
 * Uses /api/agent-activities?agent_id=<agentId>
 */
import { useState, useEffect, useCallback } from 'react';
import { authHeaders } from '../LoginGate';

function fmt$(n) {
  const v = Number(n) || 0;
  return v < 0.001 ? '$0.00' : `$${v.toFixed(v >= 10 ? 2 : 4)}`;
}
function fmtTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
    timeZone: 'America/New_York',
  });
}
function fmtTokens(n) {
  const v = Number(n) || 0;
  if (!v) return '—';
  return v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v);
}

const CAT_META = {
  'lead-gen':     { icon: '🎯', color: '#A855F7' },
  'outreach':     { icon: '📤', color: '#3B82F6' },
  'enrichment':   { icon: '🔍', color: '#A855F7' },
  'data-hygiene': { icon: '🧹', color: '#F59E0B' },
  'research':     { icon: '📊', color: '#22C55E' },
  'follow-up':    { icon: '🔁', color: '#0EA5E9' },
  'handoff':      { icon: '🤝', color: '#28c76f' },
  'admin':        { icon: '⚙️', color: 'rgba(255,255,255,0.35)' },
  'email':        { icon: '📧', color: '#6366F1' },
  'inbound':      { icon: '📥', color: '#EC4899' },
  'other':        { icon: '📌', color: '#94a3b8' },
};

const NOISE = /^(HEARTBEAT_OK|HEARTBEAT\b|Delta:|Cron job|Scheduled cron|Heartbeat\s*\/\s*System)/i;

export default function GenericActivitiesTab({ agentId, agentName, accentColor = '#06E5EC' }) {
  const [acts, setActs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [days, setDays]       = useState(14);
  const [cat, setCat]         = useState('all');
  const [search, setSearch]   = useState('');
  const [byCategory, setByCategory] = useState({});

  const load = useCallback(() => {
    if (!agentId) return;
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ agent_id: agentId, days, limit: 200 });
    if (cat !== 'all') qs.set('category', cat);
    fetch(`/api/agent-activities?${qs}`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : r.json().then(e => { throw new Error(e.error); }))
      .then(d => {
        const filtered = (d.activities || []).filter(a => !NOISE.test(a.title || ''));
        setActs(filtered);
        setByCategory(d.byCategory || {});
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [agentId, days, cat]);

  useEffect(() => { load(); }, [load]);

  const displayed = acts.filter(a => {
    if (!search) return true;
    return (a.title + a.category + a.requested_by + (a.request || '')).toLowerCase().includes(search.toLowerCase());
  });

  // Summary stats
  const totalCost    = acts.reduce((s, a) => s + (Number(a.costUsd) || 0), 0);
  const totalTimeSaved = acts.reduce((s, a) => s + (Number(a.timeSavedMin) || 0), 0);
  const topCats      = Object.entries(byCategory).sort((a, b) => b[1].count - a[1].count).slice(0, 4);

  const DAYS_OPTIONS = [
    { v: 7, l: '7d' }, { v: 14, l: '14d' }, { v: 30, l: '30d' }, { v: 60, l: '60d' },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: accentColor }}>{agentName} — Activity Feed</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            Source: bb_agents · agent_activities · {agentId}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
          {DAYS_OPTIONS.map(o => (
            <button key={o.v} onClick={() => setDays(o.v)} style={{
              fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, cursor: 'pointer',
              background: days === o.v ? `${accentColor}20` : 'transparent',
              border: days === o.v ? `1px solid ${accentColor}50` : '1px solid rgba(255,255,255,0.1)',
              color: days === o.v ? accentColor : 'var(--text-muted)',
            }}>{o.l}</button>
          ))}
          <button onClick={load} style={{
            fontSize: 10, padding: '3px 9px', borderRadius: 20, cursor: 'pointer',
            background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)',
          }}>↻</button>
        </div>
      </div>

      {/* Summary tiles */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Activities',  value: acts.length },
          { label: 'AI Cost',     value: fmt$(totalCost) },
          { label: 'Time Saved',  value: `${Math.round(totalTimeSaved / 60)}h` },
        ].map(({ label, value }) => (
          <div key={label} style={{
            flex: 1, minWidth: 80, textAlign: 'center', padding: '10px 8px',
            borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: `1px solid ${accentColor}20`,
          }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: accentColor }}>{value}</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{label}</div>
          </div>
        ))}
        {topCats.map(([cat, v]) => {
          const m = CAT_META[cat] || CAT_META.other;
          return (
            <div key={cat} style={{
              flex: 1, minWidth: 80, textAlign: 'center', padding: '10px 8px',
              borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: `1px solid ${m.color}20`,
            }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: m.color }}>{v.count}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{m.icon} {cat}</div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search activities…"
          style={{
            flex: 1, minWidth: 160, padding: '5px 10px', borderRadius: 8,
            background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
            color: 'var(--text-primary)', fontSize: 11,
          }}
        />
        {['all', ...Object.keys(CAT_META)].map(c => (
          <button key={c} onClick={() => setCat(c)} style={{
            fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 20, cursor: 'pointer',
            background: cat === c ? `${accentColor}20` : 'transparent',
            border: cat === c ? `1px solid ${accentColor}50` : '1px solid rgba(255,255,255,0.08)',
            color: cat === c ? accentColor : 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            {c === 'all' ? 'All' : (CAT_META[c]?.icon + ' ' + c)}
          </button>
        ))}
        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>
          {displayed.length} of {acts.length}
        </span>
      </div>

      {/* Feed */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Loading…</div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: 20, color: '#EF4444', fontSize: 12 }}>Error: {error}</div>
      ) : displayed.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 12 }}>
          No activities found for the selected filters
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {displayed.map((a, i) => {
            const m = CAT_META[a.category] || CAT_META.other;
            return (
              <div key={a.id || i} style={{
                padding: '9px 12px', borderRadius: 8,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderLeft: `3px solid ${m.color}60`,
                display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
                <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{m.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2, wordBreak: 'break-word' }}>
                    {a.title || '—'}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{fmtTime(a.timestamp || a.created_at)}</span>
                    {a.category && (
                      <span style={{ fontSize: 9, fontWeight: 700, color: m.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{a.category}</span>
                    )}
                    {a.requested_by && (
                      <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>by {a.requested_by}</span>
                    )}
                    {Number(a.costUsd) > 0 && (
                      <span style={{ fontSize: 9, color: '#F59E0B' }}>{fmt$(a.costUsd)}</span>
                    )}
                    {Number(a.timeSavedMin) > 0 && (
                      <span style={{ fontSize: 9, color: '#10B981' }}>~{a.timeSavedMin}min saved</span>
                    )}
                    {Number(a.totalTokens) > 0 && (
                      <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{fmtTokens(a.totalTokens)} tokens</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
