import { useState, useMemo } from 'react';
import { useContacts, toggleBlacklist } from '../../hooks/useContacts';
import DetailDrawer from '../DetailDrawer';

const TOUCH_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 't1_not_t2', label: 'T1 → need T2' },
  { id: 't2_not_t3', label: 'T2 → need T3' },
  { id: 't3_not_t4', label: 'T3 → need T4' },
  { id: 'needs_t5', label: 'T4 → need T5' },
];

const CAMPAIGNS = ['all', 'DWDM', 'BEAD', 'CET Designers', 'Estimators', 'BIM Modelers', 'Sales Coordinators PMs'];

function TouchBadge({ status, label }) {
  if (!status) return <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>—</span>;
  const sent = /sent|✓|yes/i.test(status);
  return (
    <span style={{
      display: 'inline-block', padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600,
      background: sent ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
      color: sent ? '#22C55E' : 'var(--text-muted)',
      border: `1px solid ${sent ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)'}`,
    }} title={status}>{sent ? label : `${label}?`}</span>
  );
}

// Column defs for ContactsTab detail drawer
const CONTACTS_COLS = [
  { key: 'company', label: 'Company' }, { key: 'contact_name', label: 'Contact' },
  { key: 'title', label: 'Title' }, { key: 'email', label: 'Email' },
  { key: 'linkedin_url', label: 'LinkedIn', isLinkedin: true }, { key: 'role', label: 'Role' },
  { key: 'location', label: 'Location' }, { key: 'campaign', label: 'Campaign' },
  { key: 'touch1', label: 'T1', isTouchCol: true, touchIdx: 0 },
  { key: 'touch2', label: 'T2', isTouchCol: true, touchIdx: 1 },
  { key: 'touch3', label: 'T3', isTouchCol: true, touchIdx: 2 },
  { key: 'touch4', label: 'T4', isTouchCol: true, touchIdx: 3 },
  { key: 'response_status', label: 'Response', isResponse: true },
  { key: 'response_date', label: 'Response Date' },
  { key: 'call_scheduled', label: 'Call Scheduled' },
  { key: 'notes', label: 'Notes' },
];

export default function ContactsTab() {
  const [agentFilter, setAgentFilter] = useState('all');
  const [selectedRow, setSelectedRow] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [campaign, setCampaign]       = useState('all');
  const [companyInput, setCompanyInput] = useState('');
  const [company, setCompany]         = useState('');
  const [touchFilter, setTouchFilter] = useState('all');
  const [showBlacklisted, setShowBlacklisted] = useState(false);

  const filters = useMemo(() => ({
    agent:        agentFilter !== 'all' ? agentFilter : undefined,
    campaign:     campaign !== 'all' ? campaign : undefined,
    company:      company || undefined,
    touch_filter: touchFilter !== 'all' ? touchFilter : undefined,
    blacklisted:  showBlacklisted,
    limit:        500,
  }), [agentFilter, campaign, company, touchFilter, showBlacklisted]);

  const { contacts, total, loading, refresh } = useContacts(filters);

  async function handleBlacklist(contact) {
    try { await toggleBlacklist(contact.id, true); refresh(); }
    catch (e) { alert(`Failed to blacklist: ${e.message}`); }
  }

  const btn = (active, color = '#06E5EC') => ({
    padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
    background: active ? `rgba(${color === '#F59E0B' ? '245,158,11' : '6,229,236'},0.12)` : 'rgba(255,255,255,0.04)',
    border: active ? `1px solid ${color}50` : '1px solid rgba(255,255,255,0.08)',
    color: active ? color : 'var(--text-muted)',
  });

  return (
    <div className="tab-content active">
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>Contacts Database</div>

      <div className="card" style={{ padding: '12px 16px', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>

          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Agent</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[['all','All','#06E5EC'],['laura','Laura','#06E5EC'],['darren','Darren','#F59E0B']].map(([a, label, color]) => (
                <button key={a} onClick={() => setAgentFilter(a)} style={btn(agentFilter === a, color)}>{label}</button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Campaign</div>
            <select value={campaign} onChange={e => setCampaign(e.target.value)}
              style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', fontSize: 12 }}>
              {CAMPAIGNS.map(c => <option key={c} value={c}>{c === 'all' ? 'All Campaigns' : c}</option>)}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Company</div>
            <div style={{ display: 'flex', gap: 4 }}>
              <input type="text" placeholder="Search company…" value={companyInput}
                onChange={e => setCompanyInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && setCompany(companyInput)}
                style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', fontSize: 12, width: 160 }} />
              <button onClick={() => setCompany(companyInput)}
                style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, background: 'rgba(6,229,236,0.1)', border: '1px solid #06E5EC30', color: '#06E5EC', cursor: 'pointer' }}>→</button>
              {company && <button onClick={() => { setCompany(''); setCompanyInput(''); }}
                style={{ padding: '5px 8px', borderRadius: 6, fontSize: 11, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Touch Sequence</div>
            <select value={touchFilter} onChange={e => setTouchFilter(e.target.value)}
              style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', fontSize: 12 }}>
              {TOUCH_FILTERS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)', paddingBottom: 2 }}>
            <input type="checkbox" checked={showBlacklisted} onChange={e => setShowBlacklisted(e.target.checked)} />
            Show blacklisted only
          </label>
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
        {loading ? 'Loading…' : `${contacts.length} of ${total} contacts`}
        {(agentFilter !== 'all' || campaign !== 'all' || company || touchFilter !== 'all') &&
          <span style={{ color: '#06E5EC', marginLeft: 8 }}>• Filtered</span>}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              {[
                { h: 'Agent',    sub: null,       center: false },
                { h: 'Company',  sub: null,       center: false },
                { h: 'Name',     sub: null,       center: false },
                { h: 'Title',    sub: null,       center: false },
                { h: 'Email',    sub: null,       center: false },
                { h: 'T1',       sub: 'Email',    center: true  },
                { h: 'T2',       sub: 'LinkedIn', center: true  },
                { h: 'T3',       sub: 'LinkedIn', center: true  },
                { h: 'T4',       sub: 'Email',    center: true  },
                { h: 'Response', sub: null,       center: false },
                { h: '',         sub: null,       center: true  },
              ].map(({ h, sub, center }) => (
                <th key={h} style={{ padding: '8px 10px', textAlign: center ? 'center' : 'left', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  <div>{h}</div>
                  {sub && <div style={{ fontSize: 9, fontWeight: 400, color: 'rgba(255,255,255,0.25)', marginTop: 1 }}>{sub}</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contacts.map(c => {
              const ac = c.agent === 'darren' ? '#F59E0B' : '#06E5EC';
              return (
                <tr key={c.id} onClick={() => { setSelectedRow(c); setDrawerOpen(true); }} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', opacity: c.blacklisted ? 0.5 : 1, cursor: 'pointer', transition: 'background 100ms' }} onMouseEnter={e => e.currentTarget.style.background='rgba(6,229,236,0.05)'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  <td style={{ padding: '7px 10px' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: ac, textTransform: 'uppercase', padding: '2px 6px', borderRadius: 4, background: `${ac}15` }}>{c.agent}</span>
                  </td>
                  <td style={{ padding: '7px 10px', color: 'var(--text-primary)', fontWeight: 600 }}>{c.company || '—'}</td>
                  <td style={{ padding: '7px 10px', color: 'var(--text-secondary)' }}>
                    {c.linkedin_url
                      ? <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ color: '#3B82F6', textDecoration: 'none' }}>{c.contact_name || '—'}</a>
                      : (c.contact_name || '—')}
                  </td>
                  <td style={{ padding: '7px 10px', color: 'var(--text-muted)', fontSize: 11 }}>{c.title || '—'}</td>
                  <td style={{ padding: '7px 10px', color: 'var(--text-secondary)', fontSize: 11 }}>
                    {c.email ? <a href={`mailto:${c.email}`} style={{ color: 'inherit', textDecoration: 'none' }}>{c.email}</a> : '—'}
                  </td>
                  <td style={{ padding: '7px 10px', textAlign: 'center' }}><TouchBadge status={c.touch1} label="T1" /></td>
                  <td style={{ padding: '7px 10px', textAlign: 'center' }}><TouchBadge status={c.touch2} label="T2" /></td>
                  <td style={{ padding: '7px 10px', textAlign: 'center' }}><TouchBadge status={c.touch3} label="T3" /></td>
                  <td style={{ padding: '7px 10px', textAlign: 'center' }}><TouchBadge status={c.touch4} label="T4" /></td>
                  <td style={{ padding: '7px 10px', color: c.response_status && c.response_status !== 'No Response' ? '#22C55E' : 'var(--text-muted)', fontSize: 11 }}>{c.response_status || '—'}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                    {!c.blacklisted && (
                      <button onClick={() => handleBlacklist(c)} title="Blacklist"
                        style={{ padding: '3px 8px', borderRadius: 5, fontSize: 11, cursor: 'pointer', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444' }}>⊘</button>
                    )}
                  </td>
                </tr>
              );
            })}
            {!loading && contacts.length === 0 && (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No contacts match your filters.</td></tr>
            )}
          </tbody>
        </table>

      <DetailDrawer
        row={selectedRow}
        columns={CONTACTS_COLS}
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setSelectedRow(null); }}
        accentColor='#06E5EC'
      />      </div>
    </div>
  );
}
