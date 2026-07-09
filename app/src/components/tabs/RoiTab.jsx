import { useState, useEffect, useRef } from 'react';
import { authHeaders } from '../LoginGate';

const TYPE_ICON = { 'user-task': '💬', cron: '⏰', heartbeat: '💓', system: '⚙️', task: '📋' };

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function ActivityFeed({ agentName = 'laura' }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState('all');

  useEffect(() => {
    fetch(`/api/bb/activities?limit=50&agent=${agentName}`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => { setActivities(d?.activities || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? activities : activities.filter(a => a.type === filter);
  const shown = filtered.slice(0, 20);

  const FILTERS = ['all', 'user-task', 'cron', 'system'];

  return (
    <div className="card" style={{ padding: '16px', marginBottom: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="card-title">📡 Recent Activity ({activities.length} logged)</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              background: filter === f ? 'rgba(6,229,236,0.2)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${filter === f ? '#06E5EC' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 4, color: filter === f ? '#06E5EC' : 'var(--text-muted)',
              fontSize: 10, padding: '2px 8px', cursor: 'pointer',
            }}>{f}</button>
          ))}
        </div>
      </div>
      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '12px 0' }}>Loading…</div>
      ) : shown.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '12px 0' }}>No activities yet</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {shown.map((a, i) => (
            <div key={a.id || i} style={{
              display: 'grid', gridTemplateColumns: '20px 1fr auto',
              gap: 8, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
              alignItems: 'center', fontSize: 12,
            }}>
              <span style={{ fontSize: 14 }}>{TYPE_ICON[a.type] || '📌'}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.title || '—'}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                  {a.requested_by || 'System'}
                  {a.model ? ` · ${a.model.split('-').slice(1,4).join('-')}` : ''}
                  {a.cost_usd > 0 ? ` · $${Number(a.cost_usd).toFixed(4)}` : ''}
                </div>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {timeAgo(a.timestamp || a.created_at)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const HUMAN_RATES = {
  lead_generation: { label: 'Lead Generation',  unit: 'contact', rateUsd: 0.50 },
  outreach:        { label: 'Outreach Touches',  unit: 'touch',   rateUsd: 0.30 },
  follow_up:       { label: 'Follow-up Touches', unit: 'touch',   rateUsd: 0.40 },
  calls:           { label: 'Calls Scheduled',   unit: 'call',    rateUsd: 15.00 },
  replies:         { label: 'Replies Handled',   unit: 'reply',   rateUsd: 2.00 },
};

const MODEL_META = {
  'claude-haiku-4-5':  { label: 'Haiku 4.5',  color: '#06B6D4', desc: 'Fast background tasks (cron, heartbeats)' },
  'claude-sonnet-4-6': { label: 'Sonnet 4.6', color: '#3B82F6', desc: 'Primary interactive model' },
  'claude-opus-4-6':   { label: 'Opus 4.6',   color: '#8B5CF6', desc: 'Heavy reasoning & complex tasks' },
  'claude-opus-4-5':   { label: 'Opus 4.5',   color: '#A78BFA', desc: 'Heavy reasoning (previous gen)' },
};

function modelMeta(model = '') {
  const key = Object.keys(MODEL_META).find(k => model.includes(k));
  return MODEL_META[key] || { label: model.split('-').slice(1, 4).join(' ') || model, color: '#64748B', desc: '' };
}

function DailyBar({ date, cost, maxCost, onClick, selected }) {
  const pct = maxCost > 0 ? (cost / maxCost) * 100 : 0;
  const label = new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return (
    <div onClick={onClick} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', minWidth: 0 }}>
      <div style={{ fontSize: 10, color: cost > 0 ? '#06E5EC' : 'var(--text-muted)', fontWeight: 600 }}>
        {cost > 0 ? `$${cost.toFixed(0)}` : '—'}
      </div>
      <div style={{ width: '100%', height: 80, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
        <div style={{
          width: '70%', height: `${Math.max(pct, cost > 0 ? 3 : 0)}%`,
          background: selected ? '#06E5EC' : 'linear-gradient(180deg,#3B82F6,#1d4ed8)',
          borderRadius: '3px 3px 0 0', transition: 'height 0.3s ease, background 0.2s',
        }} />
      </div>
      <div style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.2 }}>{label}</div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, color = '#3B82F6' }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}25`, borderTop: `3px solid ${color}`, borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, opacity: 0.7 }}>{sub}</div>}
    </div>
  );
}

const AGENT_WORK = {
  laura: [
    ['📋', 'Daily lead gen',       'CET Designers + Estimators (5+5/day)'],
    ['✉️', 'Outreach sequences',   'Touch 1–4 via email + LinkedIn'],
    ['🔍', 'Contact enrichment',   'Apollo + web scraping + SMTP verify'],
    ['💬', 'Reply monitoring',     'Flags warm leads, notifies Abhinanda'],
    ['📊', 'Pipeline tracking',    'Updates Google Sheet per lead'],
    ['🔁', 'Heartbeat tasks',      'Cron jobs: hygiene, inbox sweeps, follow-ups'],
  ],
  darren: [
    ['📡', 'DWDM prospecting',     'Network technology decision-makers (551 contacts)'],
    ['🌐', 'BEAD outreach',        'Broadband infrastructure leads by state (791 contacts)'],
    ['✉️', 'Multi-touch sequences','Touch 1–5 via email + LinkedIn per campaign'],
    ['📞', 'Call scheduling',      'Qualifies warm DWDM/BEAD leads for calls'],
    ['🔍', 'Contact enrichment',   'SMTP verify + tier assignment per prospect'],
    ['🔁', 'Heartbeat tasks',      'Cron jobs: campaign hygiene, SMTP sweeps'],
  ],
  zara: [
    ['✨', 'MercuryZ outreach',    'Sales & BD campaigns for Mercury Z'],
    ['📋', 'Lead gen',             'Prospecting and pipeline management'],
    ['✉️', 'Sequences',            'Multi-touch email + LinkedIn campaigns'],
    ['💬', 'Reply monitoring',     'Flags warm leads, notifies team'],
    ['🔁', 'Heartbeat tasks',      'Cron jobs: hygiene, sweeps, follow-ups'],
  ],
  camilla: [
    ['🎯', 'Recruiting outreach',  'Talent acquisition and candidate sourcing'],
    ['📋', 'Pipeline management',  'Track candidates through hiring funnel'],
    ['✉️', 'Outreach sequences',   'Multi-touch campaigns to candidates'],
    ['💬', 'Reply monitoring',     'Flags interested candidates, notifies team'],
    ['🔁', 'Heartbeat tasks',      'Cron jobs: hygiene, sweeps, follow-ups'],
  ],
};

function AgentWorkCard({ agentName = 'laura' }) {
  const AGENT_COLORS = { laura: '#06E5EC', darren: '#F59E0B', zara: '#A855F7', camilla: '#F43F5E' };
  const AGENT_LABELS = { laura: 'Laura', darren: 'Darren', zara: 'Zara', camilla: 'Camilla' };
  const agentColor = AGENT_COLORS[agentName] || '#06E5EC';
  const label = AGENT_LABELS[agentName] || agentName;
  const items = AGENT_WORK[agentName] || AGENT_WORK.laura;
  return (
    <div className="card" style={{ padding: '16px' }}>
      <div className="card-title" style={{ marginBottom: 14, color: agentColor }}>🎯 What {label} Does</div>
      <div style={{ fontSize: 12 }}>
        {items.map(([icon, title, sub]) => (
          <div key={title} style={{ display: 'flex', gap: 10, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.04)', marginBottom: 8, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 15, flexShrink: 0 }}>{icon}</span>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BucketRoiTable({ breakdown }) {
  const agents = ['laura', 'darren'];
  const agentColors = { laura: '#06E5EC', darren: '#F59E0B', zara: '#A855F7', camilla: '#F43F5E' };

  const rows = Object.entries(HUMAN_RATES).map(([key, meta]) => {
    const counts = {};
    const humanCosts = {};
    for (const ag of agents) {
      const count = breakdown?.byAgent?.[ag]?.buckets?.[key]?.count ?? 0;
      counts[ag] = count;
      humanCosts[ag] = count * meta.rateUsd;
    }
    return { key, ...meta, counts, humanCosts };
  });

  const totals = agents.reduce((acc, ag) => {
    acc[ag] = rows.reduce((s, r) => s + r.humanCosts[ag], 0);
    return acc;
  }, {});

  return (
    <div className="card" style={{ padding: '16px 20px', marginBottom: 16 }}>
      <div className="card-title" style={{ marginBottom: 6 }}>ROI by Task Type</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>
        Human-equivalent cost estimates (Lead Gen $0.50/contact · Outreach $0.30/touch · Follow-up $0.40/touch · Calls $15/call · Replies $2/reply). Estimates only.
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.1)' }}>
              <th style={{ textAlign: 'left', padding: '7px 10px', color: 'var(--text-muted)' }}>Task Type</th>
              {agents.map(ag => (
                <th key={ag} style={{ textAlign: 'right', padding: '7px 10px', color: agentColors[ag] }}>
                  {ag.charAt(0).toUpperCase() + ag.slice(1)} Count
                </th>
              ))}
              {agents.map(ag => (
                <th key={ag + '_cost'} style={{ textAlign: 'right', padding: '7px 10px', color: agentColors[ag] }}>
                  {ag.charAt(0).toUpperCase() + ag.slice(1)} Human $
                </th>
              ))}
              <th style={{ textAlign: 'right', padding: '7px 10px', color: 'var(--text-muted)' }}>Who Does More</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const lauraMore = (row.counts.laura ?? 0) >= (row.counts.darren ?? 0);
              return (
                <tr key={row.key} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '7px 10px', color: 'var(--text-secondary)', fontWeight: 500 }}>{row.label}</td>
                  {agents.map(ag => (
                    <td key={ag} style={{ padding: '7px 10px', textAlign: 'right', color: agentColors[ag], fontWeight: 700 }}>
                      {row.counts[ag] ?? '—'}
                    </td>
                  ))}
                  {agents.map(ag => (
                    <td key={ag + '_cost'} style={{ padding: '7px 10px', textAlign: 'right', color: 'rgba(255,255,255,0.5)' }}>
                      ${row.humanCosts[ag].toFixed(2)}
                    </td>
                  ))}
                  <td style={{ padding: '7px 10px', textAlign: 'right', fontSize: 11 }}>
                    {row.counts.laura === 0 && row.counts.darren === 0
                      ? <span style={{ color: 'var(--text-muted)' }}>—</span>
                      : <span style={{ color: lauraMore ? '#06E5EC' : '#F59E0B', fontWeight: 600 }}>
                          {lauraMore ? 'Laura' : 'Darren'}
                        </span>
                    }
                  </td>
                </tr>
              );
            })}
            <tr style={{ borderTop: '2px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)' }}>
              <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--text-primary)' }}>Total Human Equiv.</td>
              {agents.map(ag => <td key={ag} style={{ padding: '8px 10px' }} />)}
              {agents.map(ag => (
                <td key={ag + '_total'} style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: agentColors[ag] }}>
                  ${totals[ag].toFixed(2)}
                </td>
              ))}
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function RoiTab({ agentName = 'laura' }) {
  const [history, setHistory]         = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [breakdown, setBreakdown]     = useState(null);
  const [days, setDays]               = useState(14);

  useEffect(() => {
    const token = localStorage.getItem('cc_auth_token') || localStorage.getItem('authToken') || '';
    fetch('/api/contacts/cost-breakdown', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => setBreakdown(d))
      .catch(() => null);
  }, []);

  useEffect(() => {
    setLoading(true);
    setSelectedDate(null);
    fetch(`/api/cost/history?days=${days}`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then(d => { setHistory(d); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, [days]);

  if (loading) return (
    <div className="tab-content active" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading cost data from Anthropic…</div>
    </div>
  );

  if (error) return (
    <div className="tab-content active" style={{ padding: 32, color: '#fca5a5' }}>
      Error loading usage data: {error}
    </div>
  );

  const series    = history?.series || [];
  const activeDays = series.filter(d => d.costTotal > 0);
  const totalSpend = series.reduce((s, d) => s + (d.costTotal || 0), 0);
  const avgPerDay  = activeDays.length > 0 ? totalSpend / activeDays.length : 0;
  const maxCost    = Math.max(...series.map(d => d.costTotal || 0), 1);
  const todayEntry = series[series.length - 1];
  const todayCost  = todayEntry?.costTotal || 0;

  // Aggregate model totals across all days
  const modelTotals = {};
  for (const day of series) {
    for (const [model, cost] of Object.entries(day.byModel || {})) {
      modelTotals[model] = (modelTotals[model] || 0) + cost;
    }
  }
  const sortedModels = Object.entries(modelTotals).sort((a, b) => b[1] - a[1]);
  const maxModelCost = sortedModels[0]?.[1] || 1;

  const selDay = selectedDate ? series.find(d => d.date === selectedDate) : null;
  const selModels = selDay
    ? Object.entries(selDay.byModel || {}).sort((a, b) => b[1] - a[1])
    : sortedModels;
  const selMaxCost = selModels[0]?.[1] || 1;

  return (
    <div className="tab-content active">

      {/* Date range selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginRight: 4 }}>Range:</span>
        {[7, 14, 30, 60, 90].map(d => (
          <button key={d} onClick={() => setDays(d)} style={{
            padding: '5px 12px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer',
            border: '1px solid',
            borderColor: days === d ? '#F59E0B' : 'rgba(255,255,255,0.12)',
            background:  days === d ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.03)',
            color:       days === d ? '#F59E0B' : 'rgba(255,255,255,0.45)',
          }}>{d}d</button>
        ))}
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        <StatCard icon="💰" label={`${days}-Day Total`}            value={`$${totalSpend.toFixed(2)}`}  color="#F59E0B" />
        <StatCard icon="📅" label="Avg / Active Day"               value={`$${avgPerDay.toFixed(2)}`}   color="#06E5EC" />
        <StatCard icon="🗓️" label="Today's Spend"                  value={`$${todayCost.toFixed(2)}`}   color="#3B82F6" />
        <StatCard icon="🤖" label="Models Active" sub="in range"   value={sortedModels.length}          color="#8B5CF6" />
      </div>

      {/* Daily cost bar chart */}
      <div className="card" style={{ marginBottom: 16, padding: '16px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div className="card-title">📊 Daily API Cost — Last {days} Days</div>
          {selectedDate
            ? <button onClick={() => setSelectedDate(null)} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: 'var(--text-muted)', fontSize: 11, padding: '3px 10px', cursor: 'pointer' }}>Clear</button>
            : <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Click a bar for model breakdown</div>
          }
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 120 }}>
          {series.map(d => (
            <DailyBar
              key={d.date}
              date={d.date}
              cost={d.costTotal || 0}
              maxCost={maxCost}
              selected={selectedDate === d.date}
              onClick={() => setSelectedDate(prev => prev === d.date ? null : d.date)}
            />
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Model cost breakdown */}
        <div className="card" style={{ padding: '16px' }}>
          <div className="card-title" style={{ marginBottom: 14 }}>
            🤖 {selDay ? `Model Split — ${selDay.date}` : 'Model Breakdown (All Days)'}
          </div>
          {selModels.length === 0
            ? <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No data for this period</div>
            : selModels.map(([model, cost]) => {
                const meta = modelMeta(model);
                const pct  = Math.round((cost / selMaxCost) * 100);
                return (
                  <div key={model} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                      <span style={{ color: meta.color, fontWeight: 600 }}>{meta.label}</span>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>${cost.toFixed(2)}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)' }}>
                      <div style={{ height: '100%', borderRadius: 3, background: meta.color, width: `${pct}%`, transition: 'width 0.4s' }} />
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{meta.desc}</div>
                  </div>
                );
              })
          }
        </div>

        {/* What this agent does */}
        <AgentWorkCard agentName={agentName} />

      </div>

      {/* ROI comparison */}
      <div className="card" style={{ padding: '16px 24px', background: 'rgba(6,229,236,0.04)', border: '1px solid rgba(6,229,236,0.2)' }}>
        <div className="card-title" style={{ marginBottom: 14 }}>💡 ROI Snapshot</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, textAlign: 'center', fontSize: 12 }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#06E5EC' }}>${avgPerDay.toFixed(0)}</div>
            <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>Avg AI cost / day</div>
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#10B981' }}>$200–400</div>
            <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>Human SDR / day</div>
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#F59E0B' }}>~60% savings</div>
            <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>Estimated cost reduction</div>
          </div>
        </div>
        <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
          Pricing reflects Bold Business org discount (~⅓ of Anthropic published rates) · Data pulled live from Anthropic Admin API
        </div>
      </div>

      {/* ROI by Task Type */}
      {breakdown && <BucketRoiTable breakdown={breakdown} />}

      {/* Recent activity feed */}
      <ActivityFeed agentName={agentName} />

    </div>
  );
}
