/**
 * TopNav — horizontal tab bar with agent avatars.
 * Top row: agent sections with avatar images
 * Sub row: sub-tabs for the active agent
 */
import { useState } from 'react';

const AGENTS = [
  { id: 'overview', label: 'Overview', color: '#7C3AED', avatar: '/app/avatars/overview.png',  initial: '⚡' },
  { id: 'laura',    label: 'Laura',    color: '#06E5EC', avatar: '/app/avatars/laura.png',     initial: 'L' },
  { id: 'darren',   label: 'Darren',   color: '#34d399', avatar: '/app/avatars/darren.png',    initial: 'D' },
  { id: 'zara',     label: 'Zara',     color: '#f43f5e', avatar: '/app/avatars/zara.png',      initial: 'Z' },
  { id: 'camilla',  label: 'Camilla',  color: '#eab308', avatar: '/app/avatars/camilla.jpg',   initial: 'C' },
  { id: 'lola',     label: 'Lola',     color: '#a78bfa', avatar: '/app/avatars/lola.png',      initial: 'Lo' },
  { id: 'ava',      label: 'Ava',      color: '#f97316', avatar: '/app/avatars/ava.png',       initial: 'A' },
  { id: 'brio',     label: 'Brio',     color: '#3B82F6', avatar: null,                         initial: 'B' },
];

const SUB_TABS = {
  overview: [
    { id: null,          label: 'Dashboard' },
    { id: 'contacts',    label: 'All Contacts' },
    { id: 'blacklist',   label: 'Blacklist' },
  ],
  laura: [
    { id: 'dashboard',  label: 'Dashboard' },
    { id: 'pipeline',   label: 'Pipeline' },
    { id: 'cet',        label: 'CET Designers' },
    { id: 'estimators', label: 'Estimators' },
    { id: 'scpm',       label: 'SC/PM' },
    { id: 'bim',        label: 'BIM' },
    { id: 'camp_a',     label: 'Camp A' },
    { id: 'camp_b',     label: 'Camp B' },
    { id: 'camp_c',     label: 'Camp C' },
    { id: 'roi',        label: 'ROI' },
    { id: 'activities', label: 'Activities' },
    { id: 'tasks',      label: 'Tasks' },
    { id: 'costs',      label: 'Costs' },
  ],
  darren: [
    { id: 'dashboard',      label: 'Dashboard' },
    { id: 'dwdm',           label: 'DWDM' },
    { id: 'dwdm_outreach',  label: 'Outreach Plan' },
    { id: 'dwdm_tasks',     label: 'Task Plan' },
    { id: 'bead',           label: 'BEAD' },
    { id: 'bead_winner',    label: 'BEAD Winners' },
    { id: 'dwdm_kpi',       label: 'KPI Dashboard' },
    { id: 'dc_exec',        label: 'DC Executive' },
    { id: 'dc',             label: 'DC Contacts' },
    { id: 'dc_projects',    label: 'DC Projects' },
    { id: 'dc_jobs',        label: 'DC Jobs' },
    { id: 'dc_fiber',       label: 'DC Fiber' },
    { id: 'roi',            label: 'ROI' },
    { id: 'activities',     label: 'Activities' },
    { id: 'tasks',          label: 'Tasks' },
    { id: 'costs',          label: 'Costs' },
  ],
  zara: [
    { id: 'dashboard',   label: 'Dashboard' },
    { id: 'candidates',  label: '🎯 MZ Candidates' },
    { id: 'activities',  label: 'Activities' },
    { id: 'tasks',       label: 'Tasks' },
    { id: 'costs',       label: 'Costs' },
  ],
  camilla: [
    { id: 'dashboard',   label: 'Dashboard' },
    { id: 'candidates',  label: '🎯 BB Candidates' },
    { id: 'activities',  label: 'Activities' },
    { id: 'tasks',       label: 'Tasks' },
    { id: 'costs',       label: 'Costs' },
  ],
  lola: [
    { id: 'dashboard',   label: 'Dashboard' },
    { id: 'activities',  label: 'Activities' },
    { id: 'tasks',       label: 'Tasks' },
    { id: 'costs',       label: 'Costs' },
  ],
  ava: [
    { id: 'dashboard',   label: 'Dashboard' },
    { id: 'activities',  label: 'Activities' },
    { id: 'tasks',       label: 'Tasks' },
    { id: 'costs',       label: 'Costs' },
  ],
  brio: [
    { id: 'dashboard',   label: 'Dashboard' },
    { id: 'activities',  label: 'Activities' },
    { id: 'tasks',       label: 'Tasks' },
    { id: 'costs',       label: 'Costs' },
  ],
};

/* ── Agent avatar pill ─────────────────────────────────────────────────────── */
function AgentPill({ agent, active, onClick, counts }) {
  const [imgFailed, setImgFailed] = useState(false);
  const { color, avatar, label, initial } = agent;

  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '8px 14px', border: 'none', cursor: 'pointer',
        background: active ? `${color}12` : 'transparent',
        borderBottom: active ? `2px solid ${color}` : '2px solid transparent',
        transition: 'all 0.15s', whiteSpace: 'nowrap', flexShrink: 0,
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = `${color}08`; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      {/* Avatar */}
      <div style={{
        width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
        border: `2px solid ${active ? color : color + '50'}`,
        background: `${color}20`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'border-color 0.15s',
      }}>
        {avatar && !imgFailed ? (
          <img
            src={avatar}
            alt={label}
            onError={() => setImgFailed(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <span style={{ fontSize: 9, fontWeight: 800, color, lineHeight: 1 }}>{initial}</span>
        )}
      </div>

      {/* Label */}
      <span style={{
        fontSize: 12, fontWeight: active ? 700 : 500,
        color: active ? color : 'var(--text-muted)',
        letterSpacing: active ? '0.02em' : 0,
        transition: 'color 0.15s',
      }}>
        {label}
      </span>

      {/* Lead count badge (Laura only) */}
      {agent.id === 'laura' && counts?.total > 0 && (
        <span style={{
          fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 10,
          background: `${color}20`, color,
        }}>
          {counts.total}
        </span>
      )}
    </button>
  );
}

export default function TopNav({
  topTab, setTopTab,
  lauraSub,    setLauraSub,
  darrenSub,   setDarrenSub,
  zaraSub,     setZaraSub,
  camillaSub,  setCamillaSub,
  lolaSub,     setLolaSub,
  avaSub,      setAvaSub,
  brioSub,     setBrioSub,
  overviewSub, setOverviewSub,
  counts,
}) {
  const activeAgent = AGENTS.find(a => a.id === topTab) || AGENTS[0];
  const activeColor = activeAgent.color;

  const activeSub = { overview: overviewSub, laura: lauraSub, darren: darrenSub, zara: zaraSub, camilla: camillaSub, lola: lolaSub, ava: avaSub, brio: brioSub }[topTab];
  const setActiveSub = { overview: setOverviewSub, laura: setLauraSub, darren: setDarrenSub, zara: setZaraSub, camilla: setCamillaSub, lola: setLolaSub, ava: setAvaSub, brio: setBrioSub }[topTab];

  const subs = SUB_TABS[topTab] || [];

  return (
    <div style={{
      background: 'rgba(11,11,30,0.97)',
      borderBottom: '1px solid var(--border)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      position: 'sticky', top: 60, zIndex: 90,
    }}>
      {/* ── Agent row ── */}
      <div style={{
        display: 'flex', gap: 0, overflowX: 'auto',
        padding: '0 16px', scrollbarWidth: 'none',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
        {AGENTS.map(agent => (
          <AgentPill
            key={agent.id}
            agent={agent}
            active={topTab === agent.id}
            onClick={() => setTopTab(agent.id)}
            counts={counts}
          />
        ))}
      </div>

      {/* ── Sub-tab row ── */}
      {subs.length > 1 && (
        <div style={{
          display: 'flex', gap: 0, overflowX: 'auto', padding: '0 28px',
          scrollbarWidth: 'none',
        }}>
          {subs.map(sub => {
            const active = activeSub === sub.id;
            return (
              <button
                key={String(sub.id)}
                onClick={() => setActiveSub(sub.id)}
                style={{
                  padding: '7px 14px', border: 'none', cursor: 'pointer',
                  background: active ? `${activeColor}10` : 'transparent',
                  fontSize: 11, fontWeight: active ? 700 : 400,
                  color: active ? activeColor : 'var(--text-muted)',
                  borderBottom: active ? `2px solid ${activeColor}80` : '2px solid transparent',
                  transition: 'all 0.15s', whiteSpace: 'nowrap',
                }}
              >
                {sub.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
