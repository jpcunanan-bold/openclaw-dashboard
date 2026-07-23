import { useState } from 'react';
import { useDashboardData } from './hooks/useDashboardData';
import { useCampaignCounts } from './hooks/useCampaignCounts';
import LoginGate from './components/LoginGate';
import Header from './components/Header';
import TopNav from './components/TopNav';
import LoadingOverlay from './components/LoadingOverlay';
import ErrorOverlay from './components/ErrorOverlay';
import DashboardTab from './components/tabs/DashboardTab';
import CommandCenterOverview from './components/tabs/CommandCenterOverview';
import ContactsTab from './components/tabs/ContactsTab';
import BlacklistTab from './components/tabs/BlacklistTab';
import ProspectingTab from './components/tabs/ProspectingTab';
import PipelineTab from './components/tabs/PipelineTab';
import CETTab from './components/tabs/CETTab';
import EstimatorsTab from './components/tabs/EstimatorsTab';
import SCPMTab from './components/tabs/SCPMTab';
import BIMTab from './components/tabs/BIMTab';
import CampATab from './components/tabs/CampATab';
import CampBTab from './components/tabs/CampBTab';
import CampCTab from './components/tabs/CampCTab';
import DWDMTab from './components/tabs/DWDMTab';
import BEADTab from './components/tabs/BEADTab';
import BEADWinnerTab from './components/tabs/BEADWinnerTab';
import DCContactsTab from './components/tabs/DCContactsTab';
import DCProjectsTab from './components/tabs/DCProjectsTab';
import DCJobDemandTab from './components/tabs/DCJobDemandTab';
import DCFiberRolesTab from './components/tabs/DCFiberRolesTab';
import DWDMOutreachTab from './components/tabs/DWDMOutreachTab';
import DWDMTaskPlanTab from './components/tabs/DWDMTaskPlanTab';
import DWDMDashboardTab from './components/tabs/DWDMDashboardTab';
import DCExecutiveSummaryTab from './components/tabs/DCExecutiveSummaryTab';
import AnalyticsTab from './components/tabs/AnalyticsTab';
import RoiTab from './components/tabs/RoiTab';
import AgentTasksTab from './components/tabs/AgentTasksTab';
import CostTab from './components/tabs/CostTab';
import DarrenActivitiesTab from './components/tabs/DarrenActivitiesTab';
import LauraActivitiesTab from './components/tabs/LauraActivitiesTab';
import ZaraActivitiesTab    from './components/tabs/ZaraActivitiesTab';
import ZaraCandidatesTab   from './components/tabs/ZaraCandidatesTab';
import CamillaActivitiesTab    from './components/tabs/CamillaActivitiesTab';
import CamillaCandidatesTab   from './components/tabs/CamillaCandidatesTab';
import GenericActivitiesTab   from './components/tabs/GenericActivitiesTab';
import AgentChat from './components/AgentChat';
import FloatingChatButton from './components/FloatingChatButton';
import ErrorBoundary from './components/ErrorBoundary';

// TAB_CONTEXT keys map to the active sub-tab id for chat context lookup.
// For tabs shared by multiple agents (roi, tasks, costs, dashboard) we qualify
// them with the agent prefix when needed — see getActiveContext() below.
const TAB_CONTEXT = {
  // Overview-level
  overview: { ref: 'OVERVIEW', label: 'Sales Dashboard Overview' },
  contacts: { ref: 'CONTACTS', label: 'Contacts' },
  blacklist: { ref: 'BLACKLIST', label: 'Blacklist' },
  prospecting: { ref: 'PROSPECTING', label: 'Prospecting' },
  // Laura sub-tabs
  laura_dashboard: { ref: 'LAURA_DASHBOARD', label: "Laura's Dashboard" },
  laura_pipeline: { ref: 'PIPELINE', label: 'Outreach Pipeline (Laura)' },
  laura_cet: { ref: 'CET', label: 'CET Designers (Laura)' },
  laura_estimators: { ref: 'ESTIMATORS', label: 'Estimators (Laura)' },
  laura_scpm: { ref: 'SCPM', label: 'Sales Coordinators / PMs (Laura)' },
  laura_bim: { ref: 'BIM', label: 'BIM Modelers (Laura)' },
  laura_camp_a: { ref: 'CAMP_A', label: 'Camp A — Amplify Your Team' },
  laura_camp_b: { ref: 'CAMP_B', label: 'Camp B — AI-Amplified Talent' },
  laura_camp_c: { ref: 'CAMP_C', label: 'Camp C — AI Talent Staffing' },
  laura_roi: { ref: 'ROI', label: 'ROI & Cost Analysis (Laura)' },
  laura_tasks: { ref: 'LAURA_TASKS', label: "Laura's Tasks" },
  laura_costs: { ref: 'LAURA_COSTS', label: 'Cost Analysis (Laura)' },
  // Darren sub-tabs
  darren_dashboard: { ref: 'DARREN_DASHBOARD', label: "Darren's Dashboard" },
  darren_dwdm: { ref: 'DWDM', label: 'DWDM Companies (552)' },
  darren_dwdm_outreach: { ref: 'DWDM_OUTREACH', label: 'DWDM Outreach Plan' },
  darren_dwdm_tasks: { ref: 'DWDM_TASKS', label: 'DWDM Task Plan' },
  darren_bead: { ref: 'BEAD', label: 'BEAD Campaign (791)' },
  darren_bead_winner: { ref: 'BEAD_WINNER', label: 'BEAD Winners (980)' },
  darren_dwdm_kpi: { ref: 'DWDM_KPI', label: 'DWDM KPI Dashboard' },
  darren_dc_exec: { ref: 'DC_EXEC', label: 'DC Executive Summary' },
  darren_dc: { ref: 'DC_CONTACTS', label: 'DC Contacts (164)' },
  darren_dc_projects: { ref: 'DC_PROJECTS', label: 'DC All Projects (87)' },
  darren_dc_jobs: { ref: 'DC_JOBS', label: 'DC Job Demand (74)' },
  darren_dc_fiber: { ref: 'DC_FIBER', label: 'DC Fiber Roles (46)' },
  darren_roi: { ref: 'ROI_DARREN', label: 'ROI & Cost Analysis (Darren)' },
  darren_tasks: { ref: 'DARREN_TASKS', label: "Darren's Tasks" },
  darren_costs: { ref: 'DARREN_COSTS', label: 'Cost Analysis (Darren)' },
  darren_analytics: { ref: 'DARREN_ANALYTICS', label: 'Analytics & Cost Tracking (Darren)' },
  darren_activities: { ref: 'DARREN_ACTIVITIES', label: 'Activities & Costs (Darren)' },
  // Zara sub-tabs
  zara_dashboard:   { ref: 'ZARA_DASHBOARD',   label: "Zara's Dashboard" },
  zara_roi:         { ref: 'ROI_ZARA',         label: 'ROI & Cost Analysis (Zara)' },
  zara_activities:  { ref: 'ZARA_ACTIVITIES',  label: 'Activities & Costs (Zara)' },
  zara_tasks:       { ref: 'ZARA_TASKS',       label: "Zara's Tasks" },
  zara_costs:       { ref: 'ZARA_COSTS',       label: 'Cost Analysis (Zara)' },
  zara_candidates:  { ref: 'ZARA_CANDIDATES',  label: 'MZ Candidates (Zara)' },
  // Camilla sub-tabs
  camilla_dashboard:  { ref: 'CAMILLA_DASHBOARD',  label: "Camilla's Dashboard" },
  camilla_roi:        { ref: 'ROI_CAMILLA',        label: 'ROI & Cost Analysis (Camilla)' },
  camilla_activities:  { ref: 'CAMILLA_ACTIVITIES',  label: 'Activities & Costs (Camilla)' },
  camilla_tasks:       { ref: 'CAMILLA_TASKS',       label: "Camilla's Tasks" },
  camilla_costs:       { ref: 'CAMILLA_COSTS',       label: 'Cost Analysis (Camilla)' },
  camilla_candidates:  { ref: 'CAMILLA_CANDIDATES',  label: 'BB Candidates (Camilla)' },
};

function getActiveContext(topTab, lauraSub, darrenSub, zaraSub, camillaSub, overviewSub) {
  if (topTab === 'overview') {
    if (overviewSub === 'contacts') return TAB_CONTEXT.contacts;
    if (overviewSub === 'blacklist') return TAB_CONTEXT.blacklist;
    if (overviewSub === 'prospecting') return TAB_CONTEXT.prospecting;
    return TAB_CONTEXT.overview;
  }
  if (topTab === 'laura')   return TAB_CONTEXT[`laura_${lauraSub}`]     || TAB_CONTEXT.laura_dashboard;
  if (topTab === 'darren')  return TAB_CONTEXT[`darren_${darrenSub}`]   || TAB_CONTEXT.darren_dashboard;
  if (topTab === 'zara')    return TAB_CONTEXT[`zara_${zaraSub}`]       || TAB_CONTEXT.zara_dashboard;
  if (topTab === 'camilla') return TAB_CONTEXT[`camilla_${camillaSub}`] || TAB_CONTEXT.camilla_dashboard;
  if (topTab === 'lola')   return TAB_CONTEXT.overview;
  if (topTab === 'ava')    return TAB_CONTEXT.overview;
  if (topTab === 'brio')   return TAB_CONTEXT.overview;
  return TAB_CONTEXT.overview;
}

const STANDARD_INTEL_LABELS = { dashboard: 'Dashboard', roi: 'ROI', activities: 'Activities & Costs', tasks: 'Tasks', costs: 'Costs', analytics: 'Analytics' };

function getBreadcrumb(topTab, lauraSub, darrenSub, zaraSub, camillaSub, overviewSub, lolaSub, avaSub, brioSub) {
  if (topTab === 'overview') {
    if (!overviewSub) return 'Overview';
    const labels = { contacts: 'Contacts', blacklist: 'Blacklist' };
    return `Overview · ${labels[overviewSub] || overviewSub}`;
  }
  if (topTab === 'laura') {
    const labels = {
      ...STANDARD_INTEL_LABELS,
      pipeline: 'Pipeline', cet: 'CET Designers', estimators: 'Estimators',
      scpm: 'SC/PM', bim: 'BIM Modelers', camp_a: 'Camp A', camp_b: 'Camp B', camp_c: 'Camp C',
    };
    return `Laura · ${labels[lauraSub] || lauraSub}`;
  }
  if (topTab === 'darren') {
    const labels = {
      ...STANDARD_INTEL_LABELS,
      dwdm: 'DWDM Companies', dwdm_outreach: 'Outreach Plan', dwdm_tasks: 'Task Plan',
      bead: 'BEAD Companies', dc: 'DC Contacts', dc_projects: 'DC All Projects',
      dc_jobs: 'DC Job Demand', dc_fiber: 'DC Fiber Roles',
    };
    return `Darren · ${labels[darrenSub] || darrenSub}`;
  }
  if (topTab === 'zara') {
    return `Zara · ${STANDARD_INTEL_LABELS[zaraSub] || zaraSub}`;
  }
  if (topTab === 'camilla') return `Camilla · ${STANDARD_INTEL_LABELS[camillaSub] || camillaSub}`;
  if (topTab === 'lola')   return `Lola · ${STANDARD_INTEL_LABELS[lolaSub]   || lolaSub   || 'Dashboard'}`;
  if (topTab === 'ava')    return `Ava · ${STANDARD_INTEL_LABELS[avaSub]     || avaSub     || 'Dashboard'}`;
  if (topTab === 'brio')   return `Brio · ${STANDARD_INTEL_LABELS[brioSub]   || brioSub   || 'Dashboard'}`;
  return 'Overview';
}

// ── Authenticated app shell — only mounts after login ────────────────────────
function AuthenticatedApp() {
  const { data, loading, error, refresh } = useDashboardData();

  const [topTab, setTopTab]       = useState('overview');
  const [lauraSub, setLauraSub]   = useState('pipeline');
  const [darrenSub, setDarrenSub] = useState('dwdm');
  const [recruitingSub, setRecruitingSub] = useState('zara');
  const [zaraSub, setZaraSub]     = useState('candidates');
  const [camillaSub, setCamillaSub] = useState('candidates');
  const [lolaSub,    setLolaSub]   = useState('dashboard');
  const [avaSub,     setAvaSub]    = useState('dashboard');
  const [brioSub,    setBrioSub]   = useState('dashboard');
  const [overviewSub, setOverviewSub] = useState(null);
  const [chatOpen, setChatOpen]   = useState(false);

  const counts = useCampaignCounts();

  if (loading) return <LoadingOverlay />;
  if (error) return <ErrorOverlay message={error} onRetry={refresh} />;
  if (!data) return <LoadingOverlay />;

  // Recruiting tab routes to whichever agent is selected (zara or camilla)
  const effectiveTopTab = topTab === 'recruiting' ? recruitingSub : topTab;
  const ctx = getActiveContext(effectiveTopTab, lauraSub, darrenSub, zaraSub, camillaSub, overviewSub);
  const chatDashboardScope = ['recruiting', 'zara', 'camilla'].includes(topTab)
    ? 'Recruiting Dashboard'
    : topTab === 'overview'
      ? 'Command Center Dashboard'
      : 'Sales Dashboard';
  const chatAgentForTab =
    topTab === 'recruiting' ? recruitingSub :
    topTab === 'darren'  ? 'darren'  :
    topTab === 'zara'    ? 'zara'    :
    topTab === 'camilla' ? 'camilla' :
    topTab === 'lola'    ? 'lola'    :
    topTab === 'ava'     ? 'ava'     :
    topTab === 'brio'    ? 'brio'    :
    topTab === 'overview'? 'overview': 'laura';
  const breadcrumb = topTab === 'recruiting'
    ? `Recruiting · ${recruitingSub === 'zara' ? 'Zara (Healthcare)' : 'Camilla (Finance)'}`
    : getBreadcrumb(topTab, lauraSub, darrenSub, zaraSub, camillaSub, overviewSub, lolaSub, avaSub, brioSub);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column' }}>
      {/* Sticky Header */}
      <Header onRefresh={refresh} />

      {/* Horizontal tab nav — hidden on overview (Command Center has its own toggle) */}
      {topTab !== 'overview' && (
        <TopNav
          topTab={topTab}                   setTopTab={setTopTab}
          lauraSub={lauraSub}               setLauraSub={setLauraSub}
          darrenSub={darrenSub}             setDarrenSub={setDarrenSub}
          recruitingSub={recruitingSub}     setRecruitingSub={setRecruitingSub}
          zaraSub={zaraSub}                 setZaraSub={setZaraSub}
          camillaSub={camillaSub}           setCamillaSub={setCamillaSub}
          lolaSub={lolaSub}        setLolaSub={setLolaSub}
          avaSub={avaSub}          setAvaSub={setAvaSub}
          brioSub={brioSub}        setBrioSub={setBrioSub}
          overviewSub={overviewSub} setOverviewSub={setOverviewSub}
          counts={counts}
        />
      )}

      {/* Main area — full width, no marginLeft */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >

        {/* Main content */}
        <main
          className="dashboard"
          style={{
            flex: 1,
            padding: '0',
            width: '100%',
          }}
        >
          {/* Overview top-tab — Command Center redesign */}
          {topTab === 'overview' && !overviewSub && (
            <CommandCenterOverview />
          )}
          {topTab === 'overview' && overviewSub === 'contacts' && <ContactsTab />}
          {topTab === 'overview' && overviewSub === 'blacklist' && <BlacklistTab />}
          {/* prospecting archived — hidden from nav, route kept for direct access */}
          {topTab === 'overview' && overviewSub === 'prospecting' && <ProspectingTab />}

          {/* Laura sub-tabs */}
          {topTab === 'laura' && lauraSub === 'dashboard' && <DashboardTab data={data} agentFilter="laura" />}
          {topTab === 'laura' && lauraSub === 'pipeline' && <PipelineTab />}
          {topTab === 'laura' && lauraSub === 'cet' && <CETTab />}
          {topTab === 'laura' && lauraSub === 'estimators' && <EstimatorsTab />}
          {topTab === 'laura' && lauraSub === 'scpm' && <SCPMTab />}
          {topTab === 'laura' && lauraSub === 'bim' && <BIMTab />}
          {topTab === 'laura' && lauraSub === 'camp_a' && <CampATab />}
          {topTab === 'laura' && lauraSub === 'camp_b' && <CampBTab />}
          {topTab === 'laura' && lauraSub === 'camp_c' && <CampCTab />}
          {topTab === 'laura' && lauraSub === 'roi' && <RoiTab agentName="laura" />}
          {topTab === 'laura' && lauraSub === 'activities' && <LauraActivitiesTab />}
          {topTab === 'laura' && lauraSub === 'tasks' && <AgentTasksTab agentName="laura" />}
          {topTab === 'laura' && lauraSub === 'costs' && <CostTab agentName="laura" />}
          {topTab === 'laura' && lauraSub === 'analytics' && <AnalyticsTab agentFilter="laura" />}

          {/* Darren sub-tabs */}
          {topTab === 'darren' && darrenSub === 'dashboard' && <DashboardTab data={data} agentFilter="darren" />}
          {topTab === 'darren' && darrenSub === 'dwdm' && <DWDMTab />}
          {topTab === 'darren' && darrenSub === 'dwdm_outreach' && <DWDMOutreachTab />}
          {topTab === 'darren' && darrenSub === 'dwdm_tasks' && <DWDMTaskPlanTab />}
          {topTab === 'darren' && darrenSub === 'bead' && <BEADTab />}
          {topTab === 'darren' && darrenSub === 'bead_winner' && <BEADWinnerTab />}
          {topTab === 'darren' && darrenSub === 'dwdm_kpi' && <DWDMDashboardTab />}
          {topTab === 'darren' && darrenSub === 'dc_exec' && <DCExecutiveSummaryTab />}
          {topTab === 'darren' && darrenSub === 'dc' && <DCContactsTab />}
          {topTab === 'darren' && darrenSub === 'dc_projects' && <DCProjectsTab />}
          {topTab === 'darren' && darrenSub === 'dc_jobs' && <DCJobDemandTab />}
          {topTab === 'darren' && darrenSub === 'dc_fiber' && <DCFiberRolesTab />}
          {topTab === 'darren' && darrenSub === 'roi' && <RoiTab agentName="darren" />}
          {topTab === 'darren' && darrenSub === 'tasks' && <AgentTasksTab agentName="darren" />}
          {topTab === 'darren' && darrenSub === 'costs' && <CostTab agentName="darren" />}
          {topTab === 'darren' && darrenSub === 'activities' && <DarrenActivitiesTab />}
          {topTab === 'darren' && darrenSub === 'analytics' && <AnalyticsTab agentFilter="darren" />}

          {/* ── Recruiting tab — Zara (Healthcare) + Camilla (Finance) ── */}
          {topTab === 'recruiting' && recruitingSub === 'zara'    && zaraSub === 'roi'          && <RoiTab agentName="zara" />}
          {topTab === 'recruiting' && recruitingSub === 'zara'    && zaraSub === 'activities'   && <ZaraActivitiesTab />}
          {topTab === 'recruiting' && recruitingSub === 'zara'    && zaraSub === 'candidates'   && <ZaraCandidatesTab />}
          {topTab === 'recruiting' && recruitingSub === 'zara'    && zaraSub === 'tasks'        && <AgentTasksTab agentName="zara" />}
          {topTab === 'recruiting' && recruitingSub === 'zara'    && zaraSub === 'costs'        && <CostTab agentName="zara" />}
          {topTab === 'recruiting' && recruitingSub === 'camilla' && camillaSub === 'roi'       && <RoiTab agentName="camilla" />}
          {topTab === 'recruiting' && recruitingSub === 'camilla' && camillaSub === 'activities'&& <CamillaActivitiesTab />}
          {topTab === 'recruiting' && recruitingSub === 'camilla' && camillaSub === 'candidates'&& <CamillaCandidatesTab />}
          {topTab === 'recruiting' && recruitingSub === 'camilla' && camillaSub === 'tasks'     && <AgentTasksTab agentName="camilla" />}
          {topTab === 'recruiting' && recruitingSub === 'camilla' && camillaSub === 'costs'     && <CostTab agentName="camilla" />}

          {/* Zara direct tab (kept for backward compat) */}
          {topTab === 'zara' && zaraSub === 'roi'        && <RoiTab agentName="zara" />}
          {topTab === 'zara' && zaraSub === 'activities'   && <ZaraActivitiesTab />}
          {topTab === 'zara' && zaraSub === 'candidates'   && <ZaraCandidatesTab />}
          {topTab === 'zara' && zaraSub === 'tasks'      && <AgentTasksTab agentName="zara" />}
          {topTab === 'zara' && zaraSub === 'costs'      && <CostTab agentName="zara" />}

          {/* Camilla direct tab (kept for backward compat) */}
          {topTab === 'camilla' && camillaSub === 'roi'        && <RoiTab agentName="camilla" />}
          {topTab === 'camilla' && camillaSub === 'activities'   && <CamillaActivitiesTab />}
          {topTab === 'camilla' && camillaSub === 'candidates'   && <CamillaCandidatesTab />}

          {/* ── Lola ── */}
          {topTab === 'lola' && lolaSub === 'dashboard'   && <DashboardTab data={data} agentFilter="lola" />}
          {topTab === 'lola' && lolaSub === 'activities'  && <GenericActivitiesTab agentId="lola-boldbusiness-agent" agentName="Lola" accentColor="#a78bfa" />}
          {topTab === 'lola' && lolaSub === 'tasks'       && <AgentTasksTab agentName="lola" />}
          {topTab === 'lola' && lolaSub === 'costs'       && <CostTab agentName="lola" />}

          {/* ── Ava ── */}
          {topTab === 'ava' && avaSub === 'dashboard'     && <DashboardTab data={data} agentFilter="ava" />}
          {topTab === 'ava' && avaSub === 'activities'    && <GenericActivitiesTab agentId="ava-marketing-agent" agentName="Ava" accentColor="#f97316" />}
          {topTab === 'ava' && avaSub === 'tasks'         && <AgentTasksTab agentName="ava" />}
          {topTab === 'ava' && avaSub === 'costs'         && <CostTab agentName="ava" />}

          {/* ── Brio ── */}
          {topTab === 'brio' && brioSub === 'dashboard'   && <DashboardTab data={data} agentFilter="brio" />}
          {topTab === 'brio' && brioSub === 'activities'  && <GenericActivitiesTab agentId="brio-ed-agent" agentName="Brio" accentColor="#3B82F6" />}
          {topTab === 'brio' && brioSub === 'tasks'       && <AgentTasksTab agentName="brio" />}
          {topTab === 'brio' && brioSub === 'costs'       && <CostTab agentName="brio" />}
          {topTab === 'camilla' && camillaSub === 'tasks'      && <AgentTasksTab agentName="camilla" />}
          {topTab === 'camilla' && camillaSub === 'costs'      && <CostTab agentName="camilla" />}
        </main>

        {/* Footer */}
        <footer className="footer">
          <div className="footer-main">
            Bold Business © 2026 &nbsp;|&nbsp; Sales Dashboard &nbsp;|&nbsp; Powered by{' '}
            <a href="#">OpenClaw</a>
          </div>
          <div className="footer-main" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {data.sourceInfo?.spreadsheetName || 'Laura — Outreach Tracker'} ·{' '}
            ID: {(data.sourceInfo?.spreadsheetId || '').slice(0, 8)}…
          </div>
          <div className="footer-email-domains" style={{
            marginTop: 8,
            paddingTop: 8,
            borderTop: '1px solid var(--border, #2a2a3a)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Email Domains:</span>
            {['mzintl.com', 'mzglobal.net'].map(domain => (
              <span key={domain} style={{
                fontSize: 11,
                background: 'var(--card-bg, #1a1a2e)',
                border: '1px solid var(--border, #2a2a3a)',
                borderRadius: 4,
                padding: '2px 8px',
                color: 'var(--text-muted)',
                fontFamily: 'monospace',
              }}>{domain}</span>
            ))}
          </div>
          <div className="footer-confidential">Confidential — For authorized personnel only</div>
        </footer>
      </div>

      {/* Floating chat button — visible on all tabs */}
      <FloatingChatButton
        onClick={() => setChatOpen(o => !o)}
        isOpen={chatOpen}
        activeAgent={chatAgentForTab}
      />

      {/* AgentChat — always mounted so state is preserved */}
      <AgentChat
        taskRef={ctx.ref}
        taskContext={`Viewing ${ctx.label} in the ${chatDashboardScope}.`}
        isOpen={chatOpen}
        onToggle={() => setChatOpen(o => !o)}
        defaultAgent={chatAgentForTab}
      />
    </div>
  );
}

// ── Root — LoginGate wraps everything so data only fetches post-auth ──────────
export default function App() {
  return (
    <ErrorBoundary>
      <LoginGate>
        <AuthenticatedApp />
      </LoginGate>
    </ErrorBoundary>
  );
}
