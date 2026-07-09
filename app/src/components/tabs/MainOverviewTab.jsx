import { useState, useEffect, useCallback } from 'react';
import { useCostToday } from '../../hooks/useCostToday';
import { authHeaders } from '../LoginGate';
import TodayTasksFeed from './TodayTasksFeed';

// ── Metric pill ───────────────────────────────────────────────────────────────
function Metric({ label, value, sub, color = '#06E5EC', large }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: large ? '14px 20px' : '10px 16px',
      background: `${color}08`,
      border: `1px solid ${color}25`,
      borderTop: `3px solid ${color}`,
      borderRadius: 10,
      minWidth: 90,
      flex: '1 1 90px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: large ? 28 : 22, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: `${color}88`, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ value, max, color }) {
  const pct = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;
  return (
    <div style={{ flex: '1 1 120px', minWidth: 100, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 11 }}>
        <span style={{ color: 'rgba(255,255,255,0.5)' }}>Monthly Call Goal</span>
        <span style={{ color, fontWeight: 700 }}>{value} / {max} calls</span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.07)' }}>
        <div style={{ height: '100%', borderRadius: 4, background: `linear-gradient(90deg,${color}cc,${color}66)`, width: `${pct}%`, transition: 'width 0.5s ease' }} />
      </div>
      <div style={{ fontSize: 10, color: `${color}88`, marginTop: 3, textAlign: 'right' }}>{pct}% of goal</div>
    </div>
  );
}

// ── Agent row card ────────────────────────────────────────────────────────────
function AgentRow({ name, avatar, tagline, accentColor, metrics, progressBar, onNavigate, loading, error }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.025)',
      border: `1px solid ${accentColor}25`,
      borderLeft: `4px solid ${accentColor}`,
      borderRadius: 14,
      padding: '20px 24px',
      marginBottom: 16,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: `linear-gradient(135deg, ${accentColor}40, ${accentColor}15)`,
            border: `2px solid ${accentColor}50`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, flexShrink: 0,
          }}>
            {avatar}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: accentColor }}>{name}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{tagline}</div>
          </div>
        </div>
        <button
          onClick={onNavigate}
          style={{
            padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            border: `1px solid ${accentColor}50`,
            background: `${accentColor}12`,
            color: accentColor, cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          View Dashboard →
        </button>
      </div>

      {loading && (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', padding: '12px 0' }}>⏳ Loading…</div>
      )}
      {!loading && error && (
        <div style={{ fontSize: 12, color: '#ea5455', padding: '8px 0' }}>⚠️ {error}</div>
      )}
      {!loading && !error && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'stretch' }}>
          {metrics.map((m, i) => (
            <Metric key={i} {...m} />
          ))}
          {progressBar && <ProgressBar {...progressBar} color={accentColor} />}
        </div>
      )}
    </div>
  );
}

// ── Main Overview ─────────────────────────────────────────────────────────────
export default function MainOverviewTab({ data, onNavigate }) {
  const { kpis = {} } = data || {};
  const { data: lauraCostData } = useCostToday(300_000);
  const [darrenData, setDarrenData] = useState(null);
  const [darrenLoading, setDarrenLoading] = useState(true);
  const [darrenError, setDarrenError] = useState(null);

  const loadDarren = useCallback(async () => {
    setDarrenLoading(true); setDarrenError(null);
    try {
      const r = await fetch('/api/darren/dashboard', { headers: authHeaders() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setDarrenData(await r.json());
    } catch (e) { setDarrenError(e.message); }
    finally { setDarrenLoading(false); }
  }, []);

  useEffect(() => { loadDarren(); }, [loadDarren]);

  // ── Laura metrics ──────────────────────────────────────────────────────────
  const lCalls      = kpis.callsScheduled || 0;
  const lCallTarget = kpis.callsTarget    || 8;
  const lReplies    = kpis.replies        || 0;
  const lReplyRate  = kpis.replyRate      || 0;
  const lTouches    = kpis.totalTouches   || 0;
  const lLeads      = kpis.totalLeads     || 0;
  const lauraCost   = lauraCostData?.actualCostUsd || 0;

  const lauraMetrics = [
    { label: 'Total Leads',   value: lLeads,                       color: '#3B82F6' },
    { label: 'Touches Sent',  value: lTouches,                     color: '#0EA5E9' },
    { label: 'Replies',       value: lReplies, sub: `${lReplyRate}% rate`, color: '#06E5EC' },
    { label: 'Calls Set',     value: lCalls,   sub: `of ${lCallTarget} goal`, color: '#22C55E', large: true },
    { label: 'Cost Today',    value: `$${lauraCost.toFixed(2)}`,   color: '#F59E0B' },
  ];

  // ── Darren metrics ─────────────────────────────────────────────────────────
  const dc = darrenData?.campaign || {};
  const dt = darrenData?.tasks    || {};

  const darrenMetrics = [
    { label: 'Companies',     value: (dc.totalCompanies || 0).toLocaleString(),  color: '#8B5CF6' },
    { label: 'Contacts',      value: (dc.totalContacts  || 0).toLocaleString(),  color: '#A855F7' },
    { label: 'Verified',      value: (dc.smtpVerified   || 0).toLocaleString(),  color: '#28c76f' },
    { label: 'T1 Sent',       value: (dc.t1Sent         || 0).toLocaleString(),  color: '#06E5EC' },
    { label: 'Replies',       value: dc.replies || 0, sub: `${dc.replyRate || 0}% rate`, color: '#22C55E', large: true },
    { label: 'AI Cost',       value: dt.costTotal ? `$${Number(dt.costTotal).toFixed(2)}` : '—', color: '#F59E0B' },
  ];

  return (
    <div className="tab-content active" style={{ padding: '28px 28px 40px' }}>
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
          📊 Agent Overview
        </h2>
        <p style={{ margin: '5px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
          Key metrics for each agent — click <em>View Dashboard</em> to drill in.
        </p>
      </div>

      {/* ── Today's Task Feed ─────────────────────────────────────────────── */}
      <TodayTasksFeed />

      {/* ── Laura row ─────────────────────────────────────────────────────── */}
      <AgentRow
        name="Laura Petersen"
        avatar="👤"
        tagline="Bold Business · Lead Gen + Sales Outreach · AEC & Commercial Furniture"
        accentColor="#3B82F6"
        metrics={lauraMetrics}
        progressBar={null}
        onNavigate={() => onNavigate('laura')}
        loading={false}
        error={null}
      />

      {/* ── Darren row ────────────────────────────────────────────────────── */}
      <AgentRow
        name="Darren Stuart"
        avatar="📡"
        tagline="Mercury Z · DWDM Campaign Outreach · Fiber & Telecom vertical"
        accentColor="#8B5CF6"
        metrics={darrenMetrics}
        onNavigate={() => onNavigate('darren')}
        loading={darrenLoading}
        error={darrenError}
      />

      {/* Refresh hint */}
      <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.2)', textAlign: 'right' }}>
        Data refreshes every 5 min · Click agent dashboard for full details
      </div>
    </div>
  );
}
