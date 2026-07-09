import { useState, useEffect, useMemo, useCallback, useRef } from 'react';

const TOUCH_COLORS = ['#10B981', '#0EA5E9', '#8B5CF6', '#06E5EC', '#F59E0B'];

function touchSent(v) { return !!(v && /sent|✓|yes/i.test(v)); }
function hasResponse(v) { return !!(v && v !== 'No Response' && v !== 'Pending' && v !== 'No' && v.trim() !== ''); }
function hasCall(v) { return !!(v && v.trim() !== '' && !/^(no|pending)$/i.test(v.trim())); }

const DENSITY_HEIGHTS  = { compact: 28, normal: 38, relaxed: 50 };
const DENSITY_PADDINGS = { compact: '4px 8px', normal: '7px 10px', relaxed: '10px 14px' };

// ── Per-column width constraints (px) ──────────────────────────────────────────
const COL_WIDTH_HINTS = {
  // Fixed narrow — icon/badge only
  touch1: { fixed: 44 }, touch2: { fixed: 44 }, touch3: { fixed: 44 },
  touch4: { fixed: 44 }, touch5: { fixed: 44 },
  linkedin_url: { fixed: 50 }, call_scheduled: { fixed: 70 },
  lead_rank: { fixed: 54 }, employees: { fixed: 80 }, open_roles: { fixed: 68 },
  days_open: { fixed: 78 }, open_positions: { fixed: 90 },
  // Short — state / tier / priority
  state: { min: 60,  max: 90  }, tier: { min: 68,  max: 100 },
  priority: { min: 90, max: 130 }, urgency: { min: 80, max: 120 },
  urgency_score: { min: 72, max: 100 }, dc_phase: { min: 80, max: 110 },
  shortage: { min: 90, max: 130 }, mercury_z: { min: 80, max: 110 },
  city: { min: 80, max: 120 }, phone: { min: 100, max: 130 },
  // Medium — names, roles, locations
  contact_name: { min: 120, max: 180 }, assigned_to: { min: 90, max: 140 },
  location: { min: 110, max: 160 }, role: { min: 120, max: 180 },
  general_contractor: { min: 120, max: 180 }, status: { min: 90, max: 150 },
  technology: { min: 100, max: 160 }, tier_cat: { min: 100, max: 160 },
  rate_range: { min: 100, max: 150 }, salary: { min: 110, max: 160 },
  // Company / title — main content columns
  company: { min: 150, max: 240 }, title: { min: 140, max: 220 },
  project_name: { min: 140, max: 220 }, investment: { min: 110, max: 160 },
  // Email — fixed reasonable
  email: { fixed: 190 },
  // Enrichment / SMTP
  smtp_status: { min: 90, max: 160 }, mz_approach: { min: 100, max: 170 },
  mz_hiring_status: { min: 120, max: 200 },
  response_status: { min: 80, max: 130 }, response_date: { min: 90, max: 120 },
  // Long text — truncate with tooltip
  entry_point: { min: 160, max: 240 }, outreach_hook: { min: 160, max: 240 },
  notes: { min: 150, max: 230 }, fiber_roles: { min: 130, max: 200 },
  key_subs: { min: 130, max: 200 }, certifications: { min: 130, max: 200 },
  skills: { min: 150, max: 240 }, company_desc: { min: 180, max: 260 },
};

// Average char width in px at 11px font (monospace-ish estimate)
const CHAR_W = 6.5;

/**
 * Compute smart column width from actual data sample.
 * Falls back to COL_WIDTH_HINTS, then a sensible default.
 */
function computeColWidth(col, rows) {
  // Fixed override always wins
  if (col.width) return col.width;                   // user-saved layout
  const hint = COL_WIDTH_HINTS[col.key];
  if (hint?.fixed) return hint.fixed;

  // Touch / linkedin always fixed
  if (col.isTouchCol)  return 44;
  if (col.isLinkedin)  return 50;
  if (col.isResponse)  return 70;
  if (col.key === 'call_scheduled') return 70;

  // Sample up to first 80 rows — take 90th-percentile char length
  const SAMPLE = rows.slice(0, 80);
  const lengths = SAMPLE
    .map(r => String(r[col.key] || '').length)
    .filter(l => l > 0)
    .sort((a, b) => a - b);

  // Header label length as floor
  const labelLen = col.label.length;
  let p90 = lengths.length
    ? lengths[Math.floor(lengths.length * 0.90)]
    : labelLen;
  p90 = Math.max(p90, labelLen);

  const raw = Math.round(p90 * CHAR_W) + 24; // +24px for padding

  const min = hint?.min ?? 80;
  const max = hint?.max ?? 260;
  return Math.min(Math.max(raw, min), max);
}

export default function ProTable({
  tableId,
  columns = [],
  rows = [],
  onRowClick,
  loading = false,
  error = null,
  accentColor = '#F59E0B',
  sessionToken = '',
}) {
  const [columnConfig, setColumnConfig] = useState([]);
  const [density, setDensity]           = useState('normal');
  const [globalSearch, setGlobalSearch] = useState('');
  const [showColMenu, setShowColMenu]   = useState(false);
  const [draggedColKey, setDraggedColKey] = useState(null);
  const [resizingColKey, setResizingColKey] = useState(null);
  const [sortKey, setSortKey]           = useState(null);
  const [sortDir, setSortDir]           = useState('asc');
  const [columnFilters, setColumnFilters] = useState({});
  const [filterMenuOpen, setFilterMenuOpen] = useState(null);
  const resizeStartX   = useRef(0);
  const resizeColWidth = useRef(0);

  // ── Init column widths from data ──────────────────────────────────────────
  useEffect(() => {
    if (!columns.length) return;
    setColumnConfig(
      columns.map(c => ({ ...c, width: computeColWidth(c, rows) }))
    );
  }, [columns, rows]);

  // ── Load saved layout ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionToken || !tableId || !columnConfig.length) return;
    fetch(`/api/layouts/${tableId}`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.ok && data.layout) {
          applyLayoutToColumns(data.layout);
          setDensity(data.layout.density || 'normal');
        }
      })
      .catch(() => {});
  }, [tableId, sessionToken]);

  const applyLayoutToColumns = (layout) => {
    if (!layout.columns) return;
    const order = {};
    layout.columns.forEach((c, i) => {
      order[c.key] = { width: c.width, hidden: c.hidden, pinned: c.pinned, order: i };
    });
    setColumnConfig(prev =>
      prev
        .map(c => ({
          ...c,
          width:  order[c.key]?.width  ?? c.width,
          hidden: order[c.key]?.hidden ?? c.hidden,
          pinned: order[c.key]?.pinned ?? c.pinned,
        }))
        .sort((a, b) => (order[a.key]?.order ?? 999) - (order[b.key]?.order ?? 999))
    );
  };

  const saveLayout = useCallback(() => {
    if (!sessionToken || !tableId) return;
    const layout = {
      columns: columnConfig.map(c => ({ key: c.key, width: c.width, hidden: c.hidden, pinned: c.pinned })),
      density,
    };
    fetch(`/api/layouts/${tableId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ layout }),
    }).catch(() => {});
  }, [columnConfig, density, tableId, sessionToken]);

  const resetLayout = () => {
    setColumnConfig(columns.map(c => ({ ...c, width: computeColWidth(c, rows), hidden: false, pinned: undefined })));
    setDensity('normal');
    setColumnFilters({});
    setSortKey(null);
    setGlobalSearch('');
  };

  const toggleColVisibility = (key) =>
    setColumnConfig(c => c.map(col => col.key === key ? { ...col, hidden: !col.hidden } : col));

  const toggleColPin = (key, side) =>
    setColumnConfig(c => c.map(col => col.key === key ? { ...col, pinned: col.pinned === side ? undefined : side } : col));

  const handleDragStart = (key) => setDraggedColKey(key);
  const handleDragOver  = (e) => e.preventDefault();
  const handleDrop      = (targetKey) => {
    if (!draggedColKey || draggedColKey === targetKey) return;
    const from = columnConfig.findIndex(c => c.key === draggedColKey);
    const to   = columnConfig.findIndex(c => c.key === targetKey);
    if (from === -1 || to === -1) return;
    const next = [...columnConfig];
    next.splice(to, 0, next.splice(from, 1)[0]);
    setColumnConfig(next);
    setDraggedColKey(null);
  };

  const handleResizeStart = (e, key) => {
    e.preventDefault();
    setResizingColKey(key);
    resizeStartX.current   = e.clientX;
    resizeColWidth.current = columnConfig.find(c => c.key === key)?.width ?? 140;
  };

  useEffect(() => {
    if (!resizingColKey) return;
    const mm = (e) => {
      const w = Math.max(44, resizeColWidth.current + (e.clientX - resizeStartX.current));
      setColumnConfig(c => c.map(col => col.key === resizingColKey ? { ...col, width: w } : col));
    };
    const mu = () => setResizingColKey(null);
    document.addEventListener('mousemove', mm);
    document.addEventListener('mouseup', mu);
    return () => { document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); };
  }, [resizingColKey]);

  const visibleCols      = columnConfig.filter(c => !c.hidden);
  const pinnedLeftCols   = visibleCols.filter(c => c.pinned === 'left');
  const pinnedRightCols  = visibleCols.filter(c => c.pinned === 'right');
  const unpinnedCols     = visibleCols.filter(c => !c.pinned);
  const orderedCols      = [...pinnedLeftCols, ...unpinnedCols, ...pinnedRightCols];

  // ── Total table width = sum of col widths (no stretching) ─────────────────
  const totalWidth = useMemo(
    () => visibleCols.reduce((s, c) => s + (c.width || 100), 0),
    [visibleCols]
  );

  const sorted = useMemo(() => {
    let data = [...rows];
    if (globalSearch.trim()) {
      const q = globalSearch.toLowerCase();
      data = data.filter(row => visibleCols.some(col => String(row[col.key] || '').toLowerCase().includes(q)));
    }
    Object.entries(columnFilters).forEach(([key, vals]) => {
      if (!vals.size) return;
      data = data.filter(row => vals.has(String(row[key] || '')));
    });
    if (sortKey) {
      data.sort((a, b) => {
        const cmp = String(a[sortKey] || '').localeCompare(String(b[sortKey] || ''));
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return data;
  }, [rows, globalSearch, columnFilters, sortKey, sortDir, visibleCols]);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const getUniqueValues = (key) =>
    [...new Set(rows.map(r => r[key]).filter(v => v != null && v !== ''))].sort();

  // ── Cell renderer ─────────────────────────────────────────────────────────
  const renderCell = (row, col) => {
    const val = row[col.key];

    if (col.isTouchCol) {
      const sent = touchSent(val);
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 22, height: 16, background: sent ? TOUCH_COLORS[col.touchIdx] : 'rgba(255,255,255,0.06)',
          borderRadius: 3, fontSize: sent ? 10 : 11, fontWeight: 700,
          color: sent ? '#fff' : 'rgba(255,255,255,0.25)',
        }} title={val || ''}>
          {sent ? '✓' : '·'}
        </span>
      );
    }

    if (col.isResponse) {
      const has = hasResponse(val);
      return <span style={{ color: has ? accentColor : 'rgba(255,255,255,0.2)', fontWeight: 700, fontSize: 13 }}>{has ? '✓' : '—'}</span>;
    }

    if (col.key === 'call_scheduled') {
      const has = hasCall(val);
      return <span style={{ color: has ? '#22C55E' : 'rgba(255,255,255,0.2)', fontWeight: 700, fontSize: 13 }}>{has ? '📞' : '—'}</span>;
    }

    if (col.isLinkedin) {
      return val
        ? <a href={val} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: '#0EA5E9', fontSize: 13, textDecoration: 'none' }} title={val}>↗</a>
        : <span style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>;
    }

    if (col.key === 'email') {
      return val
        ? <a href={`mailto:${val}`} onClick={e => e.stopPropagation()} style={{ color: '#0EA5E9', fontSize: 10, wordBreak: 'break-all' }} title={val}>{val}</a>
        : <span style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>;
    }

    if (col.key === 'smtp_status') {
      if (!val) return <span style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>;
      const color = val.includes('ACCEPTED') ? '#22C55E' : val.includes('REJECTED') ? '#EF4444' : val.includes('BLOCKED') ? '#F97316' : '#F59E0B';
      const label = val.replace('✅ ', '').replace('⚠️ ', '').replace('❌ ', '').replace('SMTP_', '').replace('INCONCLUSIVE', 'INCON.').substring(0, 12);
      return (
        <span title={val} style={{
          background: `${color}20`, color, border: `1px solid ${color}50`,
          borderRadius: 3, padding: '1px 5px', fontSize: 9, fontWeight: 700, letterSpacing: 0.3,
          whiteSpace: 'nowrap',
        }}>{label}</span>
      );
    }

    if (col.key === 'priority' || col.key === 'tier') {
      if (!val || val === '—') return <span style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>;
      const color = /highest/i.test(val) ? '#EF4444' : /high/i.test(val) ? '#F97316'
                  : /strategic/i.test(val) ? '#8B5CF6' : /tier.1/i.test(val) ? '#F59E0B'
                  : /tier.2/i.test(val) ? '#10B981' : /medium/i.test(val) ? '#0EA5E9' : '#6B7280';
      const label = val.replace(/🔴|🟡|🟢|🟠/g,'').trim().replace('STRATEGIC','STRAT.').replace('HIGHEST','HIGHEST').substring(0, 14);
      return (
        <span title={val} style={{
          background: `${color}18`, color, borderRadius: 3, padding: '1px 5px',
          fontSize: 9, fontWeight: 700, letterSpacing: 0.3, whiteSpace: 'nowrap',
        }}>{label}</span>
      );
    }

    // Default: truncate with tooltip for long text
    const str = String(val ?? '');
    if (!str) return <span style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>;
    return (
      <span
        title={str.length > 35 ? str : undefined}
        style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
      >
        {str}
      </span>
    );
  };

  // ── Header cell ───────────────────────────────────────────────────────────
  const renderHeaderCell = (col) => (
    <th
      key={col.key}
      draggable
      onDragStart={() => handleDragStart(col.key)}
      onDragOver={handleDragOver}
      onDrop={() => handleDrop(col.key)}
      style={{
        width: col.width,
        minWidth: col.width,
        maxWidth: col.width,
        padding: '8px 10px',
        textAlign: col.isTouchCol || col.isLinkedin || col.isResponse ? 'center' : 'left',
        fontSize: 10,
        fontWeight: 700,
        cursor: 'grab',
        userSelect: 'none',
        borderBottom: '2px solid rgba(255,255,255,0.1)',
        position: 'relative',
        whiteSpace: 'nowrap',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        color: 'var(--text-muted)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <span
          onClick={() => handleSort(col.key)}
          style={{ cursor: 'pointer', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}
          title={col.label}
        >
          {col.label}
          {sortKey === col.key && (
            <span style={{ marginLeft: 3, fontSize: 8, color: accentColor }}>
              {sortDir === 'asc' ? '▲' : '▼'}
            </span>
          )}
        </span>
        {col.filterable && (
          <button
            onClick={(e) => { e.stopPropagation(); setFilterMenuOpen(filterMenuOpen === col.key ? null : col.key); }}
            title="Filter"
            style={{
              background: columnFilters[col.key]?.size > 0 ? `${accentColor}40` : 'transparent',
              border: 'none', cursor: 'pointer', padding: '1px 3px', fontSize: 9,
              color: columnFilters[col.key]?.size > 0 ? accentColor : 'rgba(255,255,255,0.3)',
              borderRadius: 2, lineHeight: 1,
            }}
          >▾</button>
        )}
      </div>

      {filterMenuOpen === col.key && (
        <div style={{
          position: 'absolute', top: '100%', left: 0,
          background: '#1a1a2e', border: `1px solid ${accentColor}60`,
          borderRadius: 6, padding: '8px', zIndex: 9999,
          minWidth: 160, maxHeight: 220, overflowY: 'auto', marginTop: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        }}
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={() => { setColumnFilters(f => { const n={...f}; delete n[col.key]; return n; }); setFilterMenuOpen(null); }}
            style={{ display:'block', width:'100%', textAlign:'left', fontSize:10, padding:'4px 6px',
              marginBottom:4, background:'rgba(255,255,255,0.08)', border:'none', borderRadius:3, cursor:'pointer', color:'#fff' }}
          >Clear</button>
          {getUniqueValues(col.key).slice(0, 60).map(val => (
            <label key={String(val)} style={{ display:'block', fontSize:10, padding:'3px 4px', cursor:'pointer', color:'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={columnFilters[col.key]?.has(String(val)) || false}
                onChange={(e) => {
                  setColumnFilters(f => {
                    const n = { ...f, [col.key]: new Set(f[col.key] || []) };
                    e.target.checked ? n[col.key].add(String(val)) : n[col.key].delete(String(val));
                    if (!n[col.key].size) delete n[col.key];
                    return n;
                  });
                }}
                style={{ marginRight: 5 }}
              />
              <span title={String(val)}>{String(val).substring(0, 28)}</span>
            </label>
          ))}
        </div>
      )}

      {/* Resize handle */}
      <div
        onMouseDown={(e) => handleResizeStart(e, col.key)}
        style={{
          position: 'absolute', right: 0, top: 0, width: 5, height: '100%',
          cursor: 'col-resize', zIndex: 2, background: 'transparent',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = `${accentColor}60`)}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      />
    </th>
  );

  return (
    <div style={{ position: 'relative' }}>
      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search…"
          value={globalSearch}
          onChange={(e) => setGlobalSearch(e.target.value)}
          style={{
            flex: 1, padding: '7px 12px', border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)',
            borderRadius: 6, fontSize: 12, minWidth: 160,
          }}
        />

        <select
          value={density}
          onChange={(e) => setDensity(e.target.value)}
          style={{
            padding: '6px 8px', border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)',
            borderRadius: 6, fontSize: 11, cursor: 'pointer',
          }}
        >
          <option value="compact">Compact</option>
          <option value="normal">Normal</option>
          <option value="relaxed">Relaxed</option>
        </select>

        <button onClick={resetLayout} style={{
          padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
          color: 'var(--text-muted)', fontSize: 11,
        }}>↻ Reset</button>

        <button onClick={saveLayout} style={{
          padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
          background: `${accentColor}20`, border: `1px solid ${accentColor}60`,
          color: accentColor, fontSize: 11, fontWeight: 600,
        }}>💾 Save</button>

        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowColMenu(!showColMenu)} style={{
            padding: '6px 10px', borderRadius: 6, cursor: 'pointer',
            background: showColMenu ? `${accentColor}30` : 'transparent',
            border: `1px solid ${showColMenu ? accentColor : 'rgba(255,255,255,0.15)'}`,
            color: 'var(--text-primary)', fontSize: 11,
          }}>⚙ Cols</button>

          {showColMenu && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, background: '#1a1a2e',
              border: `1px solid ${accentColor}60`, borderRadius: 8, padding: '10px',
              zIndex: 1000, minWidth: 200, maxHeight: 420, overflowY: 'auto', marginTop: 4,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, marginBottom: 8, color: 'var(--text-muted)' }}>SHOW / HIDE COLUMNS</div>
              {columnConfig.map(col => (
                <label key={col.key} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, padding:'3px 0', cursor:'pointer', color:'var(--text-secondary)' }}>
                  <input type="checkbox" checked={!col.hidden} onChange={() => toggleColVisibility(col.key)} />
                  {col.label}
                </label>
              ))}
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, margin: '10px 0 8px', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>PIN COLUMNS</div>
              {visibleCols.map(col => (
                <div key={col.key} style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, padding:'3px 0' }}>
                  <span style={{ flex:1, color:'var(--text-secondary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{col.label}</span>
                  <button onClick={() => toggleColPin(col.key, 'left')} style={{ padding:'1px 6px', fontSize:9, borderRadius:3, cursor:'pointer', background: col.pinned==='left' ? `${accentColor}50`:'transparent', border:`1px solid ${col.pinned==='left'?accentColor:'rgba(255,255,255,0.15)'}`, color:col.pinned==='left'?accentColor:'var(--text-muted)' }}>L</button>
                  <button onClick={() => toggleColPin(col.key, 'right')} style={{ padding:'1px 6px', fontSize:9, borderRadius:3, cursor:'pointer', background: col.pinned==='right' ? `${accentColor}50`:'transparent', border:`1px solid ${col.pinned==='right'?accentColor:'rgba(255,255,255,0.15)'}`, color:col.pinned==='right'?accentColor:'var(--text-muted)' }}>R</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
          {sorted.length.toLocaleString()} / {rows.length.toLocaleString()} rows
        </span>

        {Object.keys(columnFilters).length > 0 && (
          <button onClick={() => setColumnFilters({})} style={{
            padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 10,
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444',
          }}>✕ Clear {Object.keys(columnFilters).length} filter{Object.keys(columnFilters).length > 1 ? 's' : ''}</button>
        )}
      </div>

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 6, marginBottom: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', fontSize: 12 }}>
          ⚠️ {error}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>
          Loading…
        </div>
      )}

      {/* ── Table ── */}
      {!loading && (
        <div style={{ overflowX: 'auto', overflowY: 'visible' }}>
          <table style={{
            width: totalWidth,          // ← exact fit, no stretching
            minWidth: totalWidth,
            borderCollapse: 'collapse',
            fontSize: 11,
            tableLayout: 'fixed',       // ← honour column widths strictly
          }}>
            <colgroup>
              {orderedCols.map(col => <col key={col.key} style={{ width: col.width }} />)}
            </colgroup>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                {orderedCols.map(col => renderHeaderCell(col))}
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={orderedCols.length} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    {rows.length === 0 ? 'No data loaded' : 'No rows match current filters'}
                  </td>
                </tr>
              ) : (
                sorted.map((row, idx) => (
                  <tr
                    key={row.id || idx}
                    onClick={() => onRowClick?.(row)}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      height: DENSITY_HEIGHTS[density],
                      cursor: onRowClick ? 'pointer' : 'default',
                      transition: 'background 100ms',
                    }}
                    onMouseEnter={e => { if (onRowClick) e.currentTarget.style.background = `${accentColor}0C`; }}
                    onMouseLeave={e => { if (onRowClick) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {orderedCols.map(col => (
                      <td
                        key={col.key}
                        style={{
                          padding: DENSITY_PADDINGS[density],
                          textAlign: col.isTouchCol || col.isResponse || col.isLinkedin || col.key === 'call_scheduled' ? 'center' : 'left',
                          color: col.key === 'company' || col.key === 'contact_name'
                            ? 'var(--text-primary)'
                            : 'var(--text-secondary)',
                          fontWeight: col.key === 'company' ? 600 : 400,
                          overflow: 'hidden',
                          maxWidth: col.width,
                          verticalAlign: 'middle',
                        }}
                      >
                        {renderCell(row, col)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
