import { useState, useMemo } from 'react';
import { useContacts } from '../../hooks/useContacts';
import ProTable from '../ProTable';
import DetailDrawer from '../DetailDrawer';

const TOUCH_COLORS = ['#10B981', '#0EA5E9', '#8B5CF6', '#06E5EC', '#F59E0B'];

function touchSent(v) { return !!(v && /sent|✓|yes/i.test(v)); }
function hasResponse(v) { return !!(v && v !== 'No Response' && v !== 'Pending' && v !== 'No' && v.trim() !== ''); }
function hasCall(v) { return !!(v && v.trim() !== '' && !/^(no|pending)$/i.test(v.trim())); }

const COLUMN_DEFS = {
  DWDM: [
    { key: 'company',      label: 'Company',   filterable: true },
    { key: 'contact_name', label: 'Contact',   filterable: true },
    { key: 'title',        label: 'Title',     filterable: true },
    { key: 'email',        label: 'Email',     filterable: false },
    { key: 'linkedin_url', label: 'LinkedIn',  filterable: false, isLinkedin: true },
    { key: 'tier',         label: 'Tier',      filterable: true },
    { key: 'touch1',       label: 'T1',        filterable: true, isTouchCol: true, touchIdx: 0 },
    { key: 'touch2',       label: 'T2',        filterable: true, isTouchCol: true, touchIdx: 1 },
    { key: 'touch3',       label: 'T3',        filterable: true, isTouchCol: true, touchIdx: 2 },
    { key: 'touch4',       label: 'T4',        filterable: true, isTouchCol: true, touchIdx: 3 },
    { key: 'touch5',       label: 'T5',        filterable: true, isTouchCol: true, touchIdx: 4 },
    { key: 'smtp_status',  label: 'SMTP',      filterable: true },
    { key: 'assigned_to',  label: 'Assigned',  filterable: true },
  ],
  BEAD: [
    { key: 'company',          label: 'Company',        filterable: true },
    { key: 'contact_name',     label: 'Contact',        filterable: true },
    { key: 'title',            label: 'Title',          filterable: true },
    { key: 'email',            label: 'Email',          filterable: false },
    { key: 'linkedin_url',     label: 'LinkedIn',       filterable: false, isLinkedin: true },
    { key: 'technology',       label: 'Technology',     filterable: true },
    { key: 'state',            label: 'State',          filterable: true },
    { key: 'tier_cat',         label: 'Tier Category',  filterable: true },
    { key: 'mz_approach',      label: 'MZ Approach',    filterable: true },
    { key: 'mz_hiring_status', label: 'Hiring Status',  filterable: true },
    { key: 'assigned_to',      label: 'Assigned',       filterable: true },
    { key: 'smtp_status',      label: 'SMTP',           filterable: true },
  ],
  'BEAD Winner': [
    { key: 'company',         label: 'Company',          filterable: true },
    { key: 'contact_name',    label: 'Contact',          filterable: true },
    { key: 'title',           label: 'Title',            filterable: true },
    { key: 'email',           label: 'Email',            filterable: false },
    { key: 'linkedin_url',    label: 'LinkedIn',         filterable: false, isLinkedin: true },
    { key: 'industry',        label: 'Industry',         filterable: true },
    { key: 'employees',       label: '# Employees',      filterable: true },
    { key: 'location',        label: 'Location',         filterable: true },
    { key: 'phone',           label: 'Phone',            filterable: false },
    { key: 'company_desc',    label: 'Description',      filterable: false },
  ],
  'Data Centers': [
    { key: 'company',      label: 'GC / Operator', filterable: true },
    { key: 'contact_name', label: 'Contact',       filterable: true },
    { key: 'title',        label: 'Title',         filterable: true },
    { key: 'email',        label: 'Email',         filterable: false },
    { key: 'linkedin_url', label: 'LinkedIn',      filterable: false, isLinkedin: true },
    { key: 'role',         label: 'Owner / Project', filterable: true },
    { key: 'tier',         label: 'Priority',      filterable: true },
    { key: 'notes',        label: 'Mercury Z Entry Point', filterable: false },
  ],
  'DC Contacts': [
    { key: 'company',        label: 'Owner / Operator', filterable: true },
    { key: 'project_name',   label: 'Project',          filterable: true },
    { key: 'contact_name',   label: 'Contact',          filterable: true },
    { key: 'title',          label: 'Title',            filterable: true },
    { key: 'email',          label: 'Email',            filterable: false },
    { key: 'linkedin_url',   label: 'LinkedIn',         filterable: false, isLinkedin: true },
    { key: 'priority',       label: 'Priority',         filterable: true },
    { key: 'general_contractor', label: 'GC',           filterable: true },
    { key: 'entry_point',    label: 'MZ Entry Point',   filterable: false },
  ],
  'DC Job Demand': [
    { key: 'company',        label: 'GC / Company',     filterable: true },
    { key: 'title',          label: 'Role Type',        filterable: true },
    { key: 'open_positions', label: 'Open Positions',   filterable: false },
    { key: 'salary',         label: 'Salary / Rate',    filterable: false },
    { key: 'location',       label: 'Location Focus',   filterable: true },
    { key: 'days_open',      label: 'Days Open',        filterable: false },
    { key: 'urgency',        label: 'Urgency',          filterable: true },
  ],
  'DC Fiber Roles': [
    { key: 'company',        label: 'Role Category',    filterable: true },
    { key: 'title',          label: 'Also Known As',    filterable: true },
    { key: 'skills',         label: 'Key Skills',       filterable: false },
    { key: 'certifications', label: 'Certifications',   filterable: false },
    { key: 'open_jobs',      label: 'Est. Open Jobs',   filterable: false },
    { key: 'rate_range',     label: 'Hourly Rate',      filterable: false },
    { key: 'dc_phase',       label: 'DC Phase',         filterable: true },
    { key: 'shortage',       label: 'Shortage Level',   filterable: true },
    { key: 'mercury_z',      label: 'MZ Has This?',     filterable: true },
  ],
  'DC Projects': [
    { key: 'lead_rank',       label: 'Rank',             filterable: false },
    { key: 'company',         label: 'Owner / Operator', filterable: true },
    { key: 'project_name',    label: 'Project Name',     filterable: true },
    { key: 'city',            label: 'City',             filterable: true },
    { key: 'state',           label: 'State',            filterable: true },
    { key: 'investment',      label: 'Scale / Invest',   filterable: false },
    { key: 'status',          label: 'Status',           filterable: true },
    { key: 'general_contractor', label: 'GC',            filterable: true },
    { key: 'fiber_roles',     label: 'Fiber Roles',      filterable: false },
    { key: 'open_roles',      label: '# Roles',          filterable: false },
    { key: 'urgency_score',   label: 'Urgency',          filterable: true },
    { key: 'entry_point',     label: 'MZ Entry Point',   filterable: false },
    { key: 'outreach_hook',   label: 'Outreach Hook',    filterable: false },
  ],
  default: [
    { key: 'company',         label: 'Company',         filterable: true },
    { key: 'contact_name',    label: 'Contact',         filterable: true },
    { key: 'title',           label: 'Title',           filterable: true },
    { key: 'email',           label: 'Email',           filterable: false },
    { key: 'linkedin_url',    label: 'LinkedIn',        filterable: false, isLinkedin: true },
    { key: 'role',            label: 'Role Hiring For', filterable: true },
    { key: 'location',        label: 'Location',        filterable: true },
    { key: 'touch1',          label: 'T1',              filterable: true, isTouchCol: true, touchIdx: 0 },
    { key: 'touch2',          label: 'T2',              filterable: true, isTouchCol: true, touchIdx: 1 },
    { key: 'touch3',          label: 'T3',              filterable: true, isTouchCol: true, touchIdx: 2 },
    { key: 'touch4',          label: 'T4',              filterable: true, isTouchCol: true, touchIdx: 3 },
    { key: 'response_status', label: 'Response',        filterable: true, isResponse: true },
    { key: 'response_date',   label: 'Resp. Date',      filterable: false },
    { key: 'notes',           label: 'Notes',           filterable: false },
  ],
};



export default function CampaignContactsTab({ title, campaign, agent, accentColor = '#06E5EC' }) {
  const [selectedRow, setSelectedRow] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { contacts, loading, error, refresh } = useContacts({ campaign, agent, limit: 500 });
  const cols = COLUMN_DEFS[campaign] || COLUMN_DEFS.default;
  
  // Get session token from localStorage (set by auth flow)
  const sessionToken = typeof window !== 'undefined' ? localStorage.getItem('session_token') || '' : '';
  
  const tableId = campaign ? `campaign-${campaign.toLowerCase().replace(/\s+/g, '-')}` : 'campaign-table';

  const handleRowClick = (row) => {
    setSelectedRow(row);
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setSelectedRow(null);
  };

  return (
    <div className="tab-content active">
      <div className="card" style={{ padding: '16px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{title}</h2>
            <span style={{
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
              padding: '2px 8px', borderRadius: 4,
              background: `${accentColor}18`, color: accentColor, border: `1px solid ${accentColor}40`,
            }}>{agent}</span>
          </div>
          <button onClick={refresh} style={{
            padding: '3px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
            color: 'var(--text-muted)',
          }}>↺ Refresh</button>
        </div>

        <ProTable
          tableId={tableId}
          columns={cols}
          rows={contacts}
          onRowClick={handleRowClick}
          loading={loading}
          error={error}
          accentColor={accentColor}
          sessionToken={sessionToken}
        />

        <DetailDrawer
          row={selectedRow}
          columns={cols}
          open={drawerOpen}
          onClose={handleCloseDrawer}
          accentColor={accentColor}
        />
      </div>
    </div>
  );
}
