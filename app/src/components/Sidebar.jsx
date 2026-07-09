const LAURA_COLOR    = '#06E5EC';
const DARREN_COLOR   = '#F59E0B';
const OVERVIEW_COLOR = '#7C3AED';
const ZARA_COLOR     = '#A855F7';
const CAMILLA_COLOR  = '#F43F5E';

const COLOR_MAP = {
  overview: OVERVIEW_COLOR,
  laura:    LAURA_COLOR,
  darren:   DARREN_COLOR,
  zara:     ZARA_COLOR,
  camilla:  CAMILLA_COLOR,
};

function colorRgb(color) {
  const map = {
    [LAURA_COLOR]:    '6,229,236',
    [DARREN_COLOR]:   '245,158,11',
    [OVERVIEW_COLOR]: '124,58,237',
    [ZARA_COLOR]:     '168,85,247',
    [CAMILLA_COLOR]:  '244,63,94',
  };
  return map[color] || '124,58,237';
}

// Agent sections with group structure
const AGENT_SECTIONS = {
  overview: [
    {
      group: 'PIPELINE',
      items: [
        { id: 'contacts', label: 'All Contacts', countKey: null },
        { id: 'blacklist', label: 'Blacklist', countKey: null },
      ],
    },
  ],
  laura: [
    {
      group: 'OVERVIEW',
      items: [
        { id: 'dashboard', label: 'Dashboard', countKey: null },
        { id: 'pipeline', label: 'Pipeline', countKey: 'total' },
      ],
    },
    {
      group: 'CAMPAIGNS',
      items: [
        { id: 'cet', label: 'CET Designers', countKey: 'CET Designers' },
        { id: 'estimators', label: 'Estimators', countKey: 'Estimators' },
        { id: 'scpm', label: 'SC/PM', countKey: 'Sales Coordinators - PMs' },
        { id: 'bim', label: 'BIM Modelers', countKey: 'BIM Modelers' },
        { id: 'camp_a', label: 'Camp A — Amplify Your Team', countKey: null },
        { id: 'camp_b', label: 'Camp B — AI-Amplified Talent', countKey: null },
        { id: 'camp_c', label: 'Camp C — AI Talent Staffing', countKey: null },
      ],
    },
    {
      group: 'INTELLIGENCE',
      items: [
        { id: 'roi', label: 'ROI', countKey: null },
        { id: 'activities', label: 'Activities & Costs', countKey: null },
        { id: 'tasks', label: 'Tasks', countKey: null },
        { id: 'costs', label: 'Costs', countKey: null },
      ],
    },
  ],
  darren: [
    {
      group: 'OVERVIEW',
      items: [{ id: 'dashboard', label: 'Dashboard', countKey: null }],
    },
    {
      group: 'DWDM',
      items: [
        { id: 'dwdm', label: 'Companies', countKey: 'DWDM' },
        { id: 'dwdm_outreach', label: 'Outreach Plan', countKey: null },
        { id: 'dwdm_tasks', label: 'Task Plan', countKey: null },
      ],
    },
    {
      group: 'BEAD',
      items: [{ id: 'bead', label: 'BEAD Companies', countKey: 'BEAD' }],
    },
    {
      group: 'DATA CENTERS',
      items: [
        { id: 'dc', label: 'DC Contacts', countKey: 'DC Contacts' },
        { id: 'dc_projects', label: 'DC All Projects', countKey: 'DC Projects' },
        { id: 'dc_jobs', label: 'DC Job Demand', countKey: 'DC Job Demand' },
        { id: 'dc_fiber', label: 'DC Fiber Roles', countKey: 'DC Fiber Roles' },
      ],
    },
    {
      group: 'INTELLIGENCE',
      items: [
        { id: 'roi', label: 'ROI', countKey: null },
        { id: 'activities', label: 'Activities & Costs', countKey: null },
        { id: 'tasks', label: 'Tasks', countKey: null },
        { id: 'costs', label: 'Costs', countKey: null },
        { id: 'analytics', label: 'Analytics', countKey: null },
      ],
    },
  ],
  zara: [
    {
      group: 'OVERVIEW',
      items: [
        { id: 'dashboard', label: 'Dashboard', countKey: null },
      ],
    },
    {
      group: 'INTELLIGENCE',
      items: [
        { id: 'roi',        label: 'ROI',               countKey: null },
        { id: 'activities', label: 'Activities & Costs', countKey: null },
        { id: 'tasks',      label: 'Tasks',              countKey: null },
        { id: 'costs',      label: 'Costs',              countKey: null },
      ],
    },
  ],
  camilla: [
    {
      group: 'OVERVIEW',
      items: [
        { id: 'dashboard', label: 'Dashboard', countKey: null },
      ],
    },
    {
      group: 'INTELLIGENCE',
      items: [
        { id: 'roi',        label: 'ROI',               countKey: null },
        { id: 'activities', label: 'Activities & Costs', countKey: null },
        { id: 'tasks',      label: 'Tasks',              countKey: null },
        { id: 'costs',      label: 'Costs',              countKey: null },
      ],
    },
  ],
};

export default function Sidebar({
  topTab,
  setTopTab,
  lauraSub,
  setLauraSub,
  darrenSub,
  setDarrenSub,
  zaraSub,
  setZaraSub,
  camillaSub,
  setCamillaSub,
  overviewSub,
  setOverviewSub,
  counts,
  onChatToggle,
  chatOpen,
  onRefresh,
}) {
  function getAgentColor(agent) {
    return COLOR_MAP[agent] || OVERVIEW_COLOR;
  }

  function getActiveSub(agent) {
    if (agent === 'laura')   return lauraSub;
    if (agent === 'darren')  return darrenSub;
    if (agent === 'zara')    return zaraSub;
    if (agent === 'camilla') return camillaSub;
    return overviewSub;
  }

  function setActiveSub(agent, value) {
    if (agent === 'laura')        setLauraSub(value);
    else if (agent === 'darren')  setDarrenSub(value);
    else if (agent === 'zara')    setZaraSub(value);
    else if (agent === 'camilla') setCamillaSub(value);
    else setOverviewSub(value);
  }

  function getAgentCounts(agent) {
    if (agent === 'laura')  return counts?.laura;
    if (agent === 'darren') return counts?.darren;
    return null;
  }

  function getCount(countKey, agentCounts) {
    if (!countKey || !agentCounts) return null;
    const val = agentCounts[countKey];
    return val != null ? val : null;
  }

  function renderBBLogo() {
    return (
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: 28, height: 28 }}
      >
        <rect x="2" y="2" width="12" height="12" fill="#7C3AED" rx="2" />
        <rect x="18" y="2" width="12" height="12" fill="#06E5EC" rx="2" />
        <rect x="2" y="18" width="12" height="12" fill="#F59E0B" rx="2" />
        <rect x="18" y="18" width="12" height="12" fill="#7C3AED" rx="2" />
      </svg>
    );
  }

  return (
    <aside
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: 240,
        height: '100vh',
        background: '#080817',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 7000,
      }}
    >
      {/* Header: Logo + Title */}
      <div
        style={{
          padding: '24px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {renderBBLogo()}
        <div style={{ fontSize: 13, fontWeight: 700, textAlign: 'center', color: '#fff' }}>
          BOLD BUSINESS
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
          AI Sales Hub
        </div>
      </div>

      {/* Scrollable content */}
      <div
        className="sidebar-scroll"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 0',
        }}
      >
        {/* Agent tabs section */}
        <div style={{ padding: '0 12px 20px 12px' }}>
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 1,
              color: 'rgba(255,255,255,0.4)',
              marginBottom: 12,
              paddingLeft: 8,
            }}
          >
            AGENTS
          </div>

          {/* Agent buttons */}
          {['overview', 'laura', 'darren', 'zara', 'camilla'].map((agent) => {
            const isActive = topTab === agent;
            const color = getAgentColor(agent);
            const labels  = { overview: 'Overview', laura: 'Laura', darren: 'Darren', zara: 'Zara', camilla: 'Camilla' };
            const avatars = {
              overview: '/app/avatars/overview.png',
              laura:    '/app/avatars/laura.png',
              darren:   '/app/avatars/darren.png',
              zara:     '/app/avatars/zara.png',
              camilla:  '/app/avatars/camilla.png',
            };

            return (
              <button
                key={agent}
                onClick={() => setTopTab(agent)}
                style={{
                  width: '100%',
                  height: 40,
                  margin: '6px 0',
                  padding: '0 12px',
                  background: isActive ? `rgba(${colorRgb(color)},0.12)` : 'transparent',
                  border: isActive ? `2px solid ${color}` : '2px solid transparent',
                  borderLeft: isActive ? `3px solid ${color}` : '3px solid transparent',
                  borderRadius: 6,
                  color: isActive ? color : 'rgba(255,255,255,0.6)',
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  transition: 'all 0.2s ease',
                  fontFamily: "'Inter',sans-serif",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.target.style.background = 'rgba(255,255,255,0.04)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.target.style.background = 'transparent';
                }}
              >
                <img
                  src={avatars[agent]}
                  alt={labels[agent]}
                  onError={(e) => { e.target.style.display = 'none'; }}
                  style={{ width: 24, height: 24, borderRadius: 4 }}
                />
                <span>{labels[agent]}</span>
              </button>
            );
          })}
        </div>

        {/* Section items */}
        <div style={{ padding: '0 12px' }}>
          {AGENT_SECTIONS[topTab]?.map((section, idx) => (
            <div key={idx} style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  color: 'rgba(255,255,255,0.4)',
                  marginBottom: 10,
                  paddingLeft: 8,
                }}
              >
                {section.group}
              </div>

              {section.items.map((item) => {
                const isActive = getActiveSub(topTab) === item.id;
                const agentCounts = getAgentCounts(topTab);
                const count = getCount(item.countKey, agentCounts);
                const color = getAgentColor(topTab);

                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSub(topTab, item.id)}
                    style={{
                      width: '100%',
                      height: 36,
                      margin: '4px 0',
                      padding: '0 12px',
                      background: isActive ? `rgba(${colorRgb(color)},0.10)` : 'transparent',
                      border: 'none',
                      borderLeft: isActive ? `3px solid ${color}` : '3px solid transparent',
                      borderRadius: 4,
                      color: isActive ? '#fff' : 'rgba(255,255,255,0.65)',
                      fontSize: 12,
                      fontWeight: isActive ? 500 : 400,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.2s ease',
                      fontFamily: "'Inter',sans-serif",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.target.style.background = 'rgba(255,255,255,0.04)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.target.style.background = 'transparent';
                    }}
                  >
                    <span>{item.label}</span>
                    {count != null && (
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Footer: Chat & Refresh */}
      <div
        style={{
          padding: '16px 12px',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <button
          onClick={onChatToggle}
          style={{
            width: '100%',
            height: 36,
            padding: '0 12px',
            background: chatOpen ? 'rgba(124,58,237,0.20)' : 'rgba(255,255,255,0.06)',
            border: chatOpen ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6,
            color: chatOpen ? '#fff' : 'rgba(255,255,255,0.7)',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.2s ease',
            fontFamily: "'Inter',sans-serif",
          }}
          onMouseEnter={(e) => {
            if (!chatOpen) e.target.style.background = 'rgba(255,255,255,0.10)';
          }}
          onMouseLeave={(e) => {
            if (!chatOpen) e.target.style.background = 'rgba(255,255,255,0.06)';
          }}
        >
          <span>●</span>
          <span>Chat with Agent</span>
        </button>

        <button
          onClick={onRefresh}
          style={{
            width: '100%',
            height: 28,
            padding: '0 12px',
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.5)',
            fontSize: 11,
            fontWeight: 400,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 0.2s ease',
            fontFamily: "'Inter',sans-serif",
          }}
          onMouseEnter={(e) => {
            e.target.style.color = 'rgba(255,255,255,0.7)';
          }}
          onMouseLeave={(e) => {
            e.target.style.color = 'rgba(255,255,255,0.5)';
          }}
        >
          <span>↻</span>
          <span>Refresh</span>
        </button>
      </div>
    </aside>
  );
}
