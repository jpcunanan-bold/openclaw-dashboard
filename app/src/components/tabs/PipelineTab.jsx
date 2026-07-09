import { useState, useMemo } from 'react';
import { useContacts } from '../../hooks/useContacts';
import { useColumnFilters } from '../../hooks/useColumnFilters';
import ColumnFilterHeader from '../ColumnFilterHeader';
import DetailDrawer from '../DetailDrawer';

const touchSent = (v) => !!(v && /sent|✓|yes/i.test(v));
const hasResponse = (v) => !!(v && v !== 'No Response' && v !== 'Pending' && v !== 'No' && v.trim() !== '');

const TOUCH_COLORS = { touch1: '#10B981', touch2: '#0EA5E9', touch3: '#8B5CF6', touch4: '#06E5EC' };

const TOUCH_COLORS_P = ['#10B981', '#0EA5E9', '#8B5CF6', '#06E5EC'];

const PIPELINE_COLS = [
  { key: 'company',         label: 'Company',   filterable: true },
  { key: 'contact_name',    label: 'Contact',   filterable: true },
  { key: 'email',           label: 'Email',     filterable: false },
  { key: 'location',        label: 'Location',  filterable: true },
  { key: 'touch1',          label: 'T1',        filterable: false, isTouchCol: true, touchIdx: 0 },
  { key: 'touch2',          label: 'T2',        filterable: false, isTouchCol: true, touchIdx: 1 },
  { key: 'touch3',          label: 'T3',        filterable: false, isTouchCol: true, touchIdx: 2 },
  { key: 'touch4',          label: 'T4',        filterable: false, isTouchCol: true, touchIdx: 3 },
  { key: 'response_status', label: 'Response',  filterable: true, isResponse: true },
  { key: 'call_scheduled',  label: 'Call?',     filterable: false, isCall: true },
];

export default function PipelineTab() {
  const [searchTerm, setSearchTerm]     = useState('');
  const [touchFilter, setTouchFilter]   = useState('all');
  const [responseFilter, setResponseFilter] = useState('all');
  const [selectedRow, setSelectedRow]   = useState(null);
  const [drawerOpen, setDrawerOpen]     = useState(false);

  const { contacts, loading, error, refresh } = useContacts({ agent: 'laura', limit: 1000 });

  const filtered = useMemo(() => {
    let result = contacts;

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(l =>
        `${l.company || ''} ${l.contact_name || ''} ${l.email || ''}`.toLowerCase().includes(q)
      );
    }

    if (touchFilter !== 'all') {
      result = result.filter(l => {
        if (touchFilter === 't1') return touchSent(l.touch1) && !touchSent(l.touch2) && !hasResponse(l.response_status);
        if (touchFilter === 't2') return touchSent(l.touch2) && !touchSent(l.touch3) && !hasResponse(l.response_status);
        if (touchFilter === 't3') return touchSent(l.touch3) && !hasResponse(l.response_status);
        if (touchFilter === 't4') return touchSent(l.touch4);
        return true;
      });
    }

    if (responseFilter === 'replied')     result = result.filter(l => hasResponse(l.response_status));
    if (responseFilter === 'not-replied') result = result.filter(l => !hasResponse(l.response_status));

    return result;
  }, [contacts, searchTerm, touchFilter, responseFilter]);

  const {
    filteredRows: colFiltered,
    sortConfig,
    columnFilters,
    setSortBy,
    toggleFilterValue,
    clearFilters: clearColFilters,
    clearColumnFilter,
    getUniqueValues,
    activeFilterCount,
  } = useColumnFilters(filtered);

  return (<>
    <div className="tab-content active">
      <div className="card" style={{ marginBottom: 16, padding: '16px 24px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Outreach Pipeline</h2>
            <span style={{
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
              padding: '2px 8px', borderRadius: 4,
              background: 'rgba(6,229,236,0.12)', color: '#06E5EC',
              border: '1px solid rgba(6,229,236,0.3)',
            }}>laura — all campaigns</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={refresh} style={{
              padding: '3px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
              color: 'var(--text-muted)',
            }}>↺</button>
            {activeFilterCount > 0 && (
              <button onClick={clearColFilters} style={{
                padding: '3px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                color: '#EF4444',
              }}>✕ Col filters</button>
            )}
          </div>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', fontSize: 12 }}>
            Failed to load: {error}
          </div>
        )}

        {/* Filters */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
          <input
            type="text"
            placeholder="Search by company, name, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', borderRadius: 4, fontSize: 12 }}
          />
          <select value={touchFilter} onChange={(e) => setTouchFilter(e.target.value)}
            style={{ padding: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', borderRadius: 4, fontSize: 12 }}>
            <option value="all">All Touches</option>
            <option value="t1">Touch 1 Only</option>
            <option value="t2">Touch 2+</option>
            <option value="t3">Touch 3+</option>
            <option value="t4">Touch 4</option>
          </select>
          <select value={responseFilter} onChange={(e) => setResponseFilter(e.target.value)}
            style={{ padding: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', borderRadius: 4, fontSize: 12 }}>
            <option value="all">All Responses</option>
            <option value="replied">Replied Only</option>
            <option value="not-replied">No Reply</option>
          </select>
          <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', color: 'var(--text-muted)', fontSize: 12 }}>
            {loading ? 'Loading…' : `${colFiltered.length} leads${activeFilterCount > 0 ? ` (${contacts.length} total)` : ''}`}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 13 }}>Loading pipeline…</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.1)' }}>
                  {PIPELINE_COLS.map(col => (
                    <ColumnFilterHeader
                      key={col.key}
                      col={col}
                      sortConfig={sortConfig}
                      columnFilters={columnFilters}
                      onSort={setSortBy}
                      onToggleFilter={toggleFilterValue}
                      onClearColumn={clearColumnFilter}
                      getUniqueValues={getUniqueValues}
                      align={col.isTouchCol || col.isResponse || col.isCall ? 'center' : 'left'}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {colFiltered.length === 0 ? (
                  <tr><td colSpan={PIPELINE_COLS.length} style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)' }}>No leads match filters</td></tr>
                ) : (
                  colFiltered.map((l) => (
                    <tr key={l.id} onClick={() => { setSelectedRow(l); setDrawerOpen(true); }} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', transition: 'background 100ms' }} onMouseEnter={e => e.currentTarget.style.background='rgba(6,229,236,0.05)'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                      {PIPELINE_COLS.map(col => {
                        if (col.isTouchCol) {
                          const sent = !!(l[col.key] && /sent|✓|yes/i.test(l[col.key]));
                          return (
                            <td key={col.key} style={{ padding: '8px', textAlign: 'center' }}>
                              <span style={{ background: sent ? TOUCH_COLORS_P[col.touchIdx] : 'transparent', color: '#fff', padding: '2px 6px', borderRadius: 3, fontSize: 10 }}>
                                {sent ? '✓' : '—'}
                              </span>
                            </td>
                          );
                        }
                        if (col.isResponse) {
                          const has = !!(l[col.key] && l[col.key] !== 'No Response' && l[col.key] !== 'Pending' && l[col.key] !== 'No' && l[col.key].trim() !== '');
                          return (
                            <td key={col.key} style={{ padding: '8px', textAlign: 'center', color: has ? '#06E5EC' : 'var(--text-muted)' }}>
                              {has ? '✓' : '—'}
                            </td>
                          );
                        }
                        if (col.isCall) {
                          const has = !!(l.call_scheduled && l.call_scheduled.trim() && !/^(no|pending)$/i.test(l.call_scheduled.trim()));
                          return (
                            <td key={col.key} style={{ padding: '8px', textAlign: 'center', color: has ? '#10B981' : 'var(--text-muted)' }}>
                              {has ? '✓' : '—'}
                            </td>
                          );
                        }
                        return (
                          <td key={col.key} style={{
                            padding: '8px',
                            color: col.key === 'company' ? 'var(--text-primary)' : 'var(--text-secondary)',
                            fontWeight: col.key === 'company' ? 600 : 400,
                            fontSize: col.key === 'email' ? 10 : 12,
                          }}>
                            {l[col.key] || '—'}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
      <DetailDrawer
        row={selectedRow}
        columns={PIPELINE_COLS}
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setSelectedRow(null); }}
        accentColor='#06E5EC'
      />
    </>);
}
