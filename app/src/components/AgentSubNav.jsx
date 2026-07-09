// Secondary sub-tab nav within an agent section
export default function AgentSubNav({ agent, activeTab, setActiveTab, kpis = {} }) {
  const lauraTabs = [
    { id: 'dashboard',      label: '🏠 Dashboard',    count: null },
    { id: 'pipeline',       label: '📈 Pipeline',     count: kpis.totalLeads },
    { id: 'cet',            label: '🎯 CET',          count: kpis.cetRows },
    { id: 'estimators',     label: '📐 Estimators',   count: kpis.estimatorRows },
    { id: 'scpm',           label: '💼 SC/PM',        count: kpis.scpmRows },
    { id: 'bim',            label: '🏗️ BIM',          count: kpis.bimRows },
    { id: 'roi',            label: '💰 ROI',          count: null },
    { id: 'abhi_tasks',     label: '📋 Tasks',        count: null },
    { id: 'master_board',   label: '🗂️ Master Board', count: null },
    { id: 'costs',          label: '💸 Costs',        count: null },
  ];

  const darrenTabs = [
    { id: 'dashboard',      label: '🏠 Dashboard',    count: null },
    { id: 'darren_tasks',   label: '📋 Tasks',        count: null },
    { id: 'darren_board',   label: '🗂️ Master Board', count: null },
    { id: 'darren_costs',   label: '💸 Costs',        count: null },
  ];

  const tabs = agent === 'laura' ? lauraTabs : darrenTabs;
  const accentColor = agent === 'laura' ? '#3B82F6' : '#8B5CF6';

  return (
    <nav style={{
      display: 'flex',
      gap: 2,
      padding: '6px 24px 0',
      background: 'rgba(255,255,255,0.015)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      overflowX: 'auto',
    }}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            title={tab.label}
            style={{
              padding: '7px 14px',
              borderRadius: '6px 6px 0 0',
              border: 'none',
              borderBottom: isActive ? `2px solid ${accentColor}` : '2px solid transparent',
              background: isActive ? `${accentColor}14` : 'transparent',
              color: isActive ? accentColor : 'rgba(255,255,255,0.45)',
              fontWeight: isActive ? 600 : 400,
              fontSize: 12,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            {tab.label}
            {tab.count != null && (
              <span style={{
                background: isActive ? `${accentColor}30` : 'rgba(255,255,255,0.08)',
                color: isActive ? accentColor : 'rgba(255,255,255,0.4)',
                borderRadius: 10,
                padding: '1px 6px',
                fontSize: 10,
                fontWeight: 700,
              }}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
