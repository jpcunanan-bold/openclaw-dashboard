import { useState } from 'react';
import AgentsRow          from '../AgentsRow';
import CostBanner         from '../CostBanner';
import AgentsSection      from '../AgentsSection';
import TodoPanel          from '../TodoPanel';
import ClientComms        from '../ClientComms';
import DailyRoutinesPanel from '../DailyRoutinesPanel';
import PerformanceTracker from '../PerformanceTracker';
import { useContactMetrics } from '../../hooks/useContacts';
import { agentColor } from '../../utils/agentConfig';

const LAURA_COLOR  = '#06E5EC';
const DARREN_COLOR = '#34d399';

function MetricChip({ label, value, color, highlight }) {
  const isNull = value == null;
  return (
    <div style={{
      flex: '0 0 auto', minWidth: 90, padding: '10px 14px',
      borderRadius: 10, textAlign: 'center',
      background: highlight ? `${color}12` : 'rgba(255,255,255,0.03)',
      border: highlight ? `1px solid ${color}40` : '1px solid rgba(255,255,255,0.06)',
      opacity: isNull ? 0.45 : 1,
    }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: highlight ? color : 'var(--text-primary)', lineHeight: 1.1 }}>
        {isNull ? '—' : value}
      </div>
      <div style={{ fontSize: 9, fontWeight: 700, color: highlight ? color : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}

function OutreachCard({ agentKey, agentName, color, metrics }) {
  const m = metrics?.byAgent?.[agentKey] || {};
  const chips = agentKey === 'laura'
    ? [
        { label: 'Total Leads',  value: m.contacts          },
        { label: 'Emails Sent',  value: m.emails_sent,  highlight: true },
        { label: 'LinkedIn',     value: m.linkedin,     highlight: true },
        { label: 'Replies',      value: m.replies,      highlight: true },
        { label: 'Calls Sch.',   value: m.calls_scheduled   },
      ]
    : [
        { label: 'Companies',    value: m.companies         },
        { label: 'Contacts',     value: m.contacts          },
        { label: 'Emails Sent',  value: m.emails_sent,  highlight: true },
        { label: 'LinkedIn',     value: m.linkedin,     highlight: true },
        { label: 'Replies',      value: m.replies,      highlight: true },
      ];

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
          background: `${color}20`, border: `2px solid ${color}55`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 800, color,
        }}>
          {agentName[0]}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{agentName}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Outreach Scorecard</div>
        </div>
        <span style={{
          marginLeft: 'auto', fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
          background: `${color}15`, border: `1px solid ${color}30`, color,
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          Active
        </span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {chips.map(c => <MetricChip key={c.label} {...c} color={color} />)}
      </div>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
      textTransform: 'uppercase', letterSpacing: '0.1em',
      padding: '6px 0 10px', marginTop: 8,
      borderBottom: '1px solid var(--border)', marginBottom: 16,
    }}>
      {children}
    </div>
  );
}

export default function DashboardTab({ onViewAgentDashboard }) {
  const [selectedAgent, setSelectedAgent] = useState(null);
  const { data: metrics } = useContactMetrics(null, null);

  return (
    <div style={{ padding: '20px 24px 80px', maxWidth: 1400, margin: '0 auto' }}>

      {/* 1. Agent avatar bubbles */}
      <AgentsRow selectedAgent={selectedAgent} onSelect={setSelectedAgent} />

      {/* 2. Cost banner */}
      <CostBanner selectedAgent={selectedAgent} />

      {/* 3. AI Agents (fleet list + detail drill-down) */}
      <SectionLabel>🤖 AI Agents</SectionLabel>
      <AgentsSection />

      {/* 4. Outreach scorecards */}
      <SectionLabel>📊 Outreach Scorecard</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(400px,1fr))', gap: 16, marginBottom: 16 }}>
        <OutreachCard agentKey="laura"  agentName="Laura"  color={LAURA_COLOR}  metrics={metrics} />
        <OutreachCard agentKey="darren" agentName="Darren" color={DARREN_COLOR} metrics={metrics} />
      </div>

      {/* 5. Operations grid */}
      <SectionLabel>⚡ Operations</SectionLabel>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))',
        gap: 16, alignItems: 'start', marginBottom: 16,
      }}>
        <TodoPanel />
        <ClientComms />
        <DailyRoutinesPanel />
      </div>

      {/* 6. Performance Tracker */}
      <SectionLabel>📈 Performance Tracker</SectionLabel>
      <PerformanceTracker />

      {/* 7. Quick-nav to agent workspaces */}
      {onViewAgentDashboard && (
        <>
          <SectionLabel>🗂 Agent Workspaces</SectionLabel>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { label: '🎯 Laura CET Pipeline', tab: 'laura_cet',        color: LAURA_COLOR },
              { label: '📋 Laura Estimators',   tab: 'laura_estimators', color: LAURA_COLOR },
              { label: '📡 Darren DWDM',        tab: 'darren_dwdm',      color: DARREN_COLOR },
              { label: '🏆 Darren BEAD',        tab: 'darren_bead',      color: DARREN_COLOR },
              { label: '💰 ROI & Cost',         tab: 'laura_roi',        color: 'var(--purple-light)' },
              { label: '📊 Analytics',          tab: 'laura_tasks',      color: 'var(--orange)' },
            ].map(({ label, tab, color }) => (
              <button
                key={tab}
                onClick={() => onViewAgentDashboard(tab)}
                style={{
                  padding: '8px 16px', borderRadius: 20, cursor: 'pointer',
                  background: 'transparent', border: `1px solid ${color}40`,
                  color, fontSize: 11, fontWeight: 700, transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = `${color}15`; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
