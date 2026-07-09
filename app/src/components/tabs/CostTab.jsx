import { useState, useEffect, useCallback } from 'react';

const AGENTS = [
  { key: 'laura',   label: 'Laura',   color: '#06E5EC' },
  { key: 'darren',  label: 'Darren',  color: '#F59E0B' },
  { key: 'zara',    label: 'Zara',    color: '#A855F7' },
  { key: 'camilla', label: 'Camilla', color: '#F43F5E' },
];

const PRESETS = [
  { id: 'today',     label: 'Today vs Yesterday' },
  { id: 'week',      label: 'This Week vs Last Week' },
  { id: 'all',       label: 'All Time' },
  { id: '7d',        label: 'Last 7d' },
  { id: '30d',       label: 'Last 30d' },
  { id: 'custom',    label: 'Custom Range' },
];

function fmt(d) { return d.toISOString().slice(0, 10); }
function fmtUSD(n) {
  const v = Number(n) || 0;
  return v === 0 ? '$0.00' : `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getPresetRange(id) {
  const today = new Date();
  const todayStr = fmt(today);
  if (id === 'today') {
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    return { from: fmt(yesterday), to: todayStr, compareFrom: fmt(yesterday), compareTo: fmt(yesterday), compareLabel: 'Yesterday', currentLabel: 'Today' };
  }
  if (id === 'week') {
    const startOfWeek = new Date(today); startOfWeek.setDate(today.getDate() - today.getDay());
    const startOfLastWeek = new Date(startOfWeek); startOfLastWeek.setDate(startOfWeek.getDate() - 7);
    const endOfLastWeek = new Date(startOfWeek); endOfLastWeek.setDate(startOfWeek.getDate() - 1);
    return { from: fmt(startOfWeek), to: todayStr, compareFrom: fmt(startOfLastWeek), compareTo: fmt(endOfLastWeek), compareLabel: 'Last Week', currentLabel: 'This Week' };
  }
  if (id === '7d')  { const d = new Date(); d.setDate(today.getDate() - 7);  return { from: fmt(d), to: todayStr }; }
  if (id === '30d') { const d = new Date(); d.setDate(today.getDate() - 30); return { from: fmt(d), to: todayStr }; }
  return { from: null, to: null };
}

function apiFetch(path) {
  const token = localStorage.getItem('cc_auth_token') || localStorage.getItem('authToken') || '';
  return fetch(`/api${path}`, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });
}

// ── Cost KPI card ─────────────────────────────────────────────────────────────
function CostKpiCard({ label, amount, sub, color, icon }) {
  return (
    <div style={{
      flex: '1 1 180px', minWidth: 160,
      padding: '18px 20px', borderRadius: 12,
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${color}30`,
      borderTop: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1, letterSpacing: '-0.5px' }}>{amount}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.55)', marginTop: 6 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function DeltaBadge({ current, compare, unit = '' }) {
  if (current == null || compare == null) return null;
  const delta = current - compare;
  const pct = compare > 0 ? Math.round((delta / compare) * 100) : null;
  if (delta === 0) return <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>= same</span>;
  const up = delta > 0;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: up ? '#22C55E' : '#EF4444' }}>
      {up ? '▲' : '▼'} {unit}{Math.abs(delta)}{pct != null ? ` (${pct > 0 ? '+' : ''}${pct}%)` : ''}
    </span>
  );
}

function CompareCard({ label, current, compare, currentLabel = 'Current', compareLabel = 'Prior', color, unit = '' }) {
  return (
    <div style={{ flex: 1, minWidth: 200, padding: '16px 20px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}30`, borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 12, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>{label}</div>
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color }}>{unit}{current ?? '—'}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{currentLabel}</div>
        </div>
        <div style={{ opacity: 0.6 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>{unit}{compare ?? '—'}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{compareLabel}</div>
        </div>
      </div>
      <DeltaBadge current={current} compare={compare} unit={unit} />
    </div>
  );
}

function BucketBar({ label, count, pct, color }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
        <span style={{ color: 'rgba(255,255,255,0.6)' }}>{label}</span>
        <span style={{ color, fontWeight: 700 }}>{count} <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>({pct}%)</span></span>
      </div>
      <div style={{ height: 6, borderRadius: 4, background: 'rgba(255,255,255,0.06)' }}>
        <div style={{ height: '100%', borderRadius: 4, width: `${pct}%`, background: color, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  );
}

function AgentCostCard({ agentName, color, breakdown }) {
  const buckets = breakdown?.buckets || {};
  return (
    <div style={{ flex: 1, minWidth: 280, padding: '18px 20px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: `2px solid ${color}40`, borderTop: `4px solid ${color}` }}>
      <div style={{ fontSize: 13, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>{agentName}</div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Activity by Bucket</div>
      {Object.keys(buckets).length === 0 ? (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', padding: '12px 0' }}>No data for this period</div>
      ) : (
        Object.entries(buckets).map(([key, b]) => (
          <BucketBar key={key} label={b.label} count={b.count} pct={b.pct} color={color} />
        ))
      )}
      {breakdown && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10, marginTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
            <span>Total contacts</span>
            <span style={{ color, fontWeight: 700 }}>{breakdown.total_contacts}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
            <span>Total touches</span>
            <span style={{ color, fontWeight: 700 }}>{breakdown.total_touches}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CostTab({ agentName }) {
  const [preset, setPreset]           = useState('today');
  const [customFrom, setCustomFrom]   = useState('');
  const [customTo, setCustomTo]       = useState('');
  const [breakdown, setBreakdown]     = useState(null);
  const [compareData, setCompareData] = useState(null);
  const [loading, setLoading]         = useState(true);
  const [fetchError, setFetchError]   = useState(null);

  // Cost snapshot state (from agent_cost_snapshots via Anthropic API)
  const [lauraCost,   setLauraCost]   = useState(null);
  const [darrenCost,  setDarrenCost]  = useState(null);
  const [zaraCost,    setZaraCost]    = useState(null);
  const [camillaCost, setCamillaCost] = useState(null);
  const [costsLoading, setCostsLoading] = useState(true);

  const presetRange  = preset !== 'custom' ? getPresetRange(preset) : null;
  const isCompareMode = preset === 'today' || preset === 'week';
  const currentLabel  = presetRange?.currentLabel || 'Current';
  const compareLabel  = presetRange?.compareLabel || 'Prior';

  function handlePresetChange(id) {
    setPreset(id);
    if (id !== 'custom') { setCustomFrom(''); setCustomTo(''); }
  }

  // ── Fetch real costs from agent_cost_snapshots ────────────────────────────
  const fetchCosts = useCallback(async () => {
    setCostsLoading(true);
    try {
      // Get the date range for the current preset
      let from, to;
      if (preset === 'custom') {
        from = customFrom || null;
        to   = customTo   || null;
      } else if (preset === 'all') {
        from = null; to = null; // use days=90
      } else {
        const range = getPresetRange(preset);
        from = range.from;
        to   = range.to;
      }

      const buildQs = (agentId) => {
        const p = new URLSearchParams({ agent_id: agentId });
        if (from && to) {
          p.set('date_from', from);
          p.set('date_to', to);
        } else {
          p.set('days', preset === 'all' ? '90' : '30');
        }
        return p.toString();
      };

      const [lauraData, darrenData, zaraData, camillaData] = await Promise.all([
        apiFetch(`/bb/cost-snapshots?${buildQs('laura-abhi-agent')}`),
        apiFetch(`/bb/cost-snapshots?${buildQs('darren-abhi-agent')}`),
        apiFetch(`/bb/cost-snapshots?${buildQs('zara-abhi-agent')}`),
        apiFetch(`/bb/cost-snapshots?${buildQs('camilla-abhi-agent')}`),
      ]);
      setLauraCost(lauraData?.totalCost ?? 0);
      setDarrenCost(darrenData?.totalCost ?? 0);
      setZaraCost(zaraData?.totalCost ?? 0);
      setCamillaCost(camillaData?.totalCost ?? 0);
    } catch (e) {
      console.error('fetchCosts error:', e);
      setLauraCost(0);
      setDarrenCost(0);
      setZaraCost(0);
      setCamillaCost(0);
    } finally {
      setCostsLoading(false);
    }
  }, [preset, customFrom, customTo]);

  // ── Fetch activity breakdown ───────────────────────────────────────────────
  const fetchBreakdown = useCallback(async () => {
    setLoading(true); setFetchError(null);
    try {
      const { from, to } = preset === 'custom'
        ? { from: customFrom || null, to: customTo || null }
        : getPresetRange(preset);
      const params = new URLSearchParams();
      if (from) params.set('date_from', from);
      if (to)   params.set('date_to',   to);
      const qs   = params.toString();
      const data = await apiFetch(`/contacts/cost-breakdown${qs ? `?${qs}` : ''}`);
      setBreakdown(data);

      if (isCompareMode && presetRange?.compareFrom) {
        const cParams = new URLSearchParams();
        cParams.set('date_from', presetRange.compareFrom);
        cParams.set('date_to',   presetRange.compareTo);
        const cData = await apiFetch(`/contacts/cost-breakdown?${cParams.toString()}`);
        setCompareData(cData);
      } else {
        setCompareData(null);
      }
    } catch (e) {
      setFetchError(e.message);
    } finally {
      setLoading(false);
    }
  }, [preset, customFrom, customTo, isCompareMode]);

  useEffect(() => {
    fetchBreakdown();
    fetchCosts();
  }, [fetchBreakdown, fetchCosts]);

  const lauraBreakdown  = breakdown?.byAgent?.laura  || null;
  const darrenBreakdown = breakdown?.byAgent?.darren || null;
  const lauraCompare    = compareData?.byAgent?.laura  || null;
  const darrenCompare   = compareData?.byAgent?.darren || null;

  const combinedCost = (lauraCost || 0) + (darrenCost || 0) + (zaraCost || 0) + (camillaCost || 0);
  const presetLabel  = PRESETS.find(p => p.id === preset)?.label || preset;

  const comparisonRows = [
    ['Lead Generation',  lauraBreakdown?.buckets?.lead_generation?.count,  darrenBreakdown?.buckets?.lead_generation?.count],
    ['Outreach',         lauraBreakdown?.buckets?.outreach?.count,          darrenBreakdown?.buckets?.outreach?.count],
    ['Follow-up',        lauraBreakdown?.buckets?.follow_up?.count,         darrenBreakdown?.buckets?.follow_up?.count],
    ['Calls Scheduled',  lauraBreakdown?.buckets?.calls?.count,             darrenBreakdown?.buckets?.calls?.count],
    ['Replies Received', lauraBreakdown?.buckets?.replies?.count,           darrenBreakdown?.buckets?.replies?.count],
    ['Total Contacts',   lauraBreakdown?.total_contacts,                    darrenBreakdown?.total_contacts],
  ];

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Cost &amp; ROI Analysis</h2>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
          Actual AI costs from Anthropic API · Activity breakdown per agent
        </p>
      </div>

      {/* Date range filter */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24, alignItems: 'center' }}>
        {PRESETS.map(p => (
          <button key={p.id} onClick={() => handlePresetChange(p.id)} style={{
            padding: '7px 16px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
            border: `1px solid ${preset === p.id ? '#8B5CF6' : 'rgba(255,255,255,0.15)'}`,
            background: preset === p.id ? 'rgba(139,92,246,0.18)' : 'rgba(255,255,255,0.04)',
            color: preset === p.id ? '#8B5CF6' : 'rgba(255,255,255,0.55)',
            fontWeight: preset === p.id ? 700 : 400,
          }}>{p.label}</button>
        ))}
        {preset === 'custom' && (
          <>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '7px 10px', color: '#e8eaff', fontSize: 12 }} />
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>to</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '7px 10px', color: '#e8eaff', fontSize: 12 }} />
          </>
        )}
        <button onClick={() => { fetchBreakdown(); fetchCosts(); }} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, border: '1px solid rgba(139,92,246,0.4)', background: 'rgba(139,92,246,0.12)', color: '#8B5CF6', cursor: 'pointer' }}>↻ Refresh</button>
      </div>

      {/* ── Total Cost KPI Row ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12 }}>
          Total AI Costs · {presetLabel} · Source: Anthropic API
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <CostKpiCard
            icon="🤖"
            label="Laura — Total Cost"
            amount={costsLoading ? '…' : fmtUSD(lauraCost)}
            sub="laura-abhi-agent"
            color="#06E5EC"
          />
          <CostKpiCard
            icon="📡"
            label="Darren — Total Cost"
            amount={costsLoading ? '…' : fmtUSD(darrenCost)}
            sub="darren-abhi-agent"
            color="#F59E0B"
          />
          <CostKpiCard
            icon="✨"
            label="Zara — Total Cost"
            amount={costsLoading ? '…' : fmtUSD(zaraCost)}
            sub="zara-abhi-agent"
            color="#A855F7"
          />
          <CostKpiCard
            icon="🎯"
            label="Camilla — Total Cost"
            amount={costsLoading ? '…' : fmtUSD(camillaCost)}
            sub="camilla-abhi-agent"
            color="#F43F5E"
          />
          <CostKpiCard
            icon="💰"
            label="Combined Total"
            amount={costsLoading ? '…' : fmtUSD(combinedCost)}
            sub="All Agents"
            color="#8B5CF6"
          />
        </div>
      </div>

      {/* ── Cost Comparison (compare modes) ──────────────────────────────── */}
      {!loading && isCompareMode && compareData && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 12 }}>
            {currentLabel} vs {compareLabel} — Activity Volumes
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <CompareCard
              label="Laura — Contacts"
              current={lauraBreakdown?.total_contacts}
              compare={lauraCompare?.total_contacts}
              currentLabel={currentLabel} compareLabel={compareLabel}
              color="#06E5EC"
            />
            <CompareCard
              label="Laura — Touches"
              current={lauraBreakdown?.total_touches}
              compare={lauraCompare?.total_touches}
              currentLabel={currentLabel} compareLabel={compareLabel}
              color="#06E5EC"
            />
            <CompareCard
              label="Darren — Contacts"
              current={darrenBreakdown?.total_contacts}
              compare={darrenCompare?.total_contacts}
              currentLabel={currentLabel} compareLabel={compareLabel}
              color="#F59E0B"
            />
            <CompareCard
              label="Darren — Touches"
              current={darrenBreakdown?.total_touches}
              compare={darrenCompare?.total_touches}
              currentLabel={currentLabel} compareLabel={compareLabel}
              color="#F59E0B"
            />
          </div>
        </div>
      )}

      {loading && <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.4)' }}>Loading breakdown...</div>}
      {!loading && fetchError && (
        <div style={{ padding: '14px 18px', borderRadius: 10, background: 'rgba(234,84,85,0.1)', border: '1px solid rgba(234,84,85,0.3)', color: '#ea5455', fontSize: 13, marginBottom: 16 }}>
          ⚠️ Failed to load breakdown: {fetchError}
        </div>
      )}

      {!loading && (
        <>
          {/* Side-by-side agent activity cards */}
          <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12 }}>
            Activity Breakdown by Agent
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
            {AGENTS.filter(a => !agentName || a.key === agentName).map(({ key, label, color }) => (
              <AgentCostCard key={key} agentName={label} color={color}
                breakdown={key === 'laura' ? lauraBreakdown : key === 'darren' ? darrenBreakdown : null} />
            ))}
          </div>

          {/* Comparison table */}
          {(lauraBreakdown || darrenBreakdown) && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 14 }}>Laura vs Darren — Side-by-Side</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      {['Metric', 'Laura', 'Darren', 'Delta'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Metric' ? 'left' : 'right', color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Cost rows */}
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '8px 12px', color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>AI Cost (Anthropic)</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#06E5EC', fontWeight: 700 }}>{costsLoading ? '…' : fmtUSD(lauraCost)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#F59E0B', fontWeight: 700 }}>{costsLoading ? '…' : fmtUSD(darrenCost)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#8B5CF6', fontWeight: 700 }}>{costsLoading ? '…' : fmtUSD(combinedCost)}</td>
                    </tr>
                    {/* Activity rows */}
                    {comparisonRows.map(([label, l, d]) => {
                      const lv = l ?? 0;
                      const dv = d ?? 0;
                      const delta = lv - dv;
                      return (
                        <tr key={label} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '8px 12px', color: 'rgba(255,255,255,0.6)' }}>{label}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', color: '#06E5EC', fontWeight: 700 }}>{l ?? '—'}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', color: '#F59E0B', fontWeight: 700 }}>{d ?? '—'}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: delta > 0 ? '#22C55E' : delta < 0 ? '#EF4444' : 'rgba(255,255,255,0.3)' }}>
                            {l == null && d == null ? '—' : delta > 0 ? `Laura +${delta}` : delta < 0 ? `Darren +${Math.abs(delta)}` : '='}
                          </td>
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
