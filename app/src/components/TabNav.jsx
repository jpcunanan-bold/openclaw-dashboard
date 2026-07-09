// TODO: replace null counts with useCampaignCounts() hook once implemented
// Hook should fetch from /api/contacts/campaign-counts and return the counts shape below

const LAURA_COLOR  = '#06E5EC';
const DARREN_COLOR = '#F59E0B';
const OVERVIEW_COLOR = '#06E5EC';

const LAURA_SUBS = [
  { id: 'dashboard',  label: 'Dashboard',  countKey: null },
  { id: 'pipeline',   label: 'Pipeline',   countKey: 'total' },
  { id: 'cet',        label: 'CET',        countKey: 'CET Designers' },
  { id: 'estimators', label: 'Estimators', countKey: 'Estimators' },
  { id: 'scpm',       label: 'SC/PM',      countKey: 'Sales Coordinators - PMs' },
  { id: 'bim',        label: 'BIM',        countKey: 'BIM Modelers' },
  { id: 'roi',        label: 'ROI',                  countKey: null },
  { id: 'activities', label: '⚡ Activities & Costs', countKey: null },
  { id: 'tasks',      label: 'Tasks',                countKey: null },
  { id: 'costs',      label: 'Costs',                countKey: null },
];

const DARREN_SUBS = [
  { id: 'dashboard',   label: 'Dashboard',           countKey: null },
  { id: 'dwdm',          label: 'DWDM Companies',    countKey: 'DWDM' },
  { id: 'dwdm_outreach', label: 'DWDM Outreach Plan', countKey: null },
  { id: 'dwdm_tasks',    label: 'DWDM Task Plan',    countKey: null },
  { id: 'bead',        label: 'BEAD',                countKey: 'BEAD' },
  { id: 'dc',          label: 'DC Contacts',         countKey: 'DC Contacts' },
  { id: 'dc_projects', label: 'DC All Projects',     countKey: 'DC Projects' },
  { id: 'dc_jobs',     label: 'DC Job Demand',       countKey: 'DC Job Demand' },
  { id: 'dc_fiber',    label: 'DC Fiber Roles',      countKey: 'DC Fiber Roles' },
  { id: 'roi',         label: 'ROI',                 countKey: null },
  { id: 'activities',  label: '⚡ Activities & Costs', countKey: null },
  { id: 'tasks',       label: 'Tasks',               countKey: null },
  { id: 'costs',       label: 'Costs',               countKey: null },
  { id: 'analytics',   label: '📊 Analytics',         countKey: null },
];

const OVERVIEW_SUBS = [
  { id: 'contacts',    label: 'Contacts' },
  // { id: 'prospecting', label: 'Prospecting' },  // archived — hidden from nav
  { id: 'blacklist',   label: 'Blacklist', admin: true },
];

export default function TabNav({
  topTab, setTopTab,
  lauraSub, setLauraSub,
  darrenSub, setDarrenSub,
  overviewSub, setOverviewSub,
  counts,
}) {
  // counts shape:
  // { laura: { 'CET Designers': 328, Estimators: 333, 'BIM Modelers': 62, 'Sales Coordinators  PMs': 74, total: 797 },
  //   darren: { DWDM: 551, BEAD: 791, total: 1342 } }

  const topTabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'laura',    label: 'Laura',    icon: '👤', color: LAURA_COLOR },
    { id: 'darren',   label: 'Darren',   icon: '👤', color: DARREN_COLOR },
  ];

  function getTopTabStyle(tab) {
    const isActive = topTab === tab.id;
    const color = tab.color || OVERVIEW_COLOR;
    if (isActive) {
      return {
        background: `rgba(${tab.id === 'darren' ? '245,158,11' : '6,229,236'},0.15)`,
        color,
        border: `1px solid ${color}50`,
        padding: '10px 20px',
        borderRadius: 20,
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        transition: 'all 0.15s ease',
      };
    }
    return {
      background: 'rgba(255,255,255,0.06)',
      color: 'rgba(255,255,255,0.45)',
      border: '1px solid transparent',
      padding: '10px 20px',
      borderRadius: 20,
      fontSize: 14,
      fontWeight: 500,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      transition: 'all 0.15s ease',
    };
  }

  function AgentDot({ color }) {
    return (
      <span
        style={{
          display: 'inline-block',
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: color,
          boxShadow: `0 0 6px ${color}`,
          marginLeft: 2,
        }}
      />
    );
  }

  function getCount(countKey, agentCounts) {
    if (!countKey || !agentCounts) return null;
    const val = agentCounts[countKey];
    return val != null ? val : null;
  }

  function renderSubTabs(tabs, activeSub, setActiveSub, agentColor, agentCounts) {
    return tabs.map((tab) => {
      const isActive = activeSub === tab.id;
      const count = getCount(tab.countKey, agentCounts);
      const isAdmin = !!tab.admin;
      return (
        <span key={tab.id} style={{ display: 'flex', alignItems: 'center' }}>
          {isAdmin && (
            <span style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)', margin: '0 6px', alignSelf: 'center' }} />
          )}
          <button
            onClick={() => setActiveSub(tab.id)}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: isActive ? `2px solid ${agentColor}` : '2px solid transparent',
              color: isActive ? '#fff' : isAdmin ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.5)',
              padding: '8px 14px',
              fontSize: isAdmin ? 11 : 12,
              fontWeight: isActive ? 600 : 400,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
            {count != null && (
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>
                {count}
              </span>
            )}
          </button>
        </span>
      );
    });
  }

  const showSubRow = topTab !== 'overview' || true; // always render container, control visibility

  return (
    <nav style={{ background: 'var(--nav-bg, #0d1117)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px' }}>
        {topTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTopTab(tab.id)}
            style={getTopTabStyle(tab)}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {topTab === tab.id && tab.color && <AgentDot color={tab.color} />}
          </button>
        ))}
      </div>

      {/* Sub-row — Laura */}
      {topTab === 'laura' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 0,
            padding: '0 20px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {renderSubTabs(LAURA_SUBS, lauraSub, setLauraSub, LAURA_COLOR, counts?.laura)}
        </div>
      )}

      {/* Sub-row — Darren */}
      {topTab === 'darren' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 0,
            padding: '0 20px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {renderSubTabs(DARREN_SUBS, darrenSub, setDarrenSub, DARREN_COLOR, counts?.darren)}
        </div>
      )}

      {/* Sub-row — Overview */}
      {topTab === 'overview' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 0,
            padding: '0 20px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {renderSubTabs(OVERVIEW_SUBS, overviewSub, setOverviewSub, OVERVIEW_COLOR, null)}
        </div>
      )}
    </nav>
  );
}
