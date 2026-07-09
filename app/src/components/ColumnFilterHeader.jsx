import { useState, useEffect, useRef } from 'react';

function SortChevron({ dir }) {
  if (dir === 'asc')  return <span style={{ fontSize: 9, marginLeft: 3, opacity: 0.9 }}>↑</span>;
  if (dir === 'desc') return <span style={{ fontSize: 9, marginLeft: 3, opacity: 0.9 }}>↓</span>;
  return <span style={{ fontSize: 9, marginLeft: 3, opacity: 0.25 }}>⇅</span>;
}

/**
 * Renders a <th> with clickable sort + filter dropdown.
 *
 * Props:
 *   col              — { key: string, label: string, filterable: boolean }
 *   sortConfig       — { key: string|null, dir: 'asc'|'desc'|null }
 *   columnFilters    — { [colKey]: Set<string> }
 *   onSort(key)
 *   onToggleFilter(colKey, value)
 *   onClearColumn(colKey)
 *   getUniqueValues(colKey) → string[]
 *   align            — 'left' | 'center'
 */
export default function ColumnFilterHeader({
  col,
  sortConfig,
  columnFilters,
  onSort,
  onToggleFilter,
  onClearColumn,
  getUniqueValues,
  align = 'left',
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const activeSet   = columnFilters[col.key];
  const activeCount = activeSet ? activeSet.size : 0;
  const isSorted    = sortConfig.key === col.key;
  const uniqueVals  = col.filterable ? getUniqueValues(col.key) : [];

  useEffect(() => {
    if (!open) return;
    function onOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <th
      ref={containerRef}
      style={{
        textAlign: align,
        padding: '8px',
        color: 'var(--text-muted)',
        whiteSpace: 'nowrap',
        position: 'relative',
        userSelect: 'none',
      }}
    >
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        justifyContent: align === 'center' ? 'center' : 'flex-start',
      }}>
        <span
          onClick={() => onSort(col.key)}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}
          title={`Sort by ${col.label}`}
        >
          {col.label}
          <SortChevron dir={isSorted ? sortConfig.dir : null} />
        </span>

        {col.filterable && uniqueVals.length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
            style={{
              background: activeCount > 0 ? 'rgba(6,229,236,0.2)' : 'transparent',
              border: `1px solid ${activeCount > 0 ? 'rgba(6,229,236,0.45)' : 'rgba(255,255,255,0.18)'}`,
              borderRadius: 3,
              cursor: 'pointer',
              padding: '1px 5px',
              fontSize: 9,
              color: activeCount > 0 ? '#06E5EC' : 'var(--text-muted)',
              lineHeight: 1.4,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              transition: 'all 0.15s',
            }}
            title={activeCount > 0 ? `${activeCount} filter${activeCount > 1 ? 's' : ''} active` : 'Filter'}
          >
            ▼{activeCount > 0 && (
              <span style={{ fontWeight: 800, fontSize: 10 }}>{activeCount}</span>
            )}
          </button>
        )}
      </div>

      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          zIndex: 1000,
          background: '#151b2b',
          border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: 7,
          padding: '4px 0',
          minWidth: 170,
          maxHeight: 228,
          overflowY: 'auto',
          boxShadow: '0 6px 24px rgba(0,0,0,0.55)',
        }}>
          {activeCount > 0 && (
            <button
              onClick={() => { onClearColumn(col.key); setOpen(false); }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '5px 12px',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                color: '#EF4444',
                fontSize: 11,
                cursor: 'pointer',
                marginBottom: 3,
              }}
            >
              ✕ Clear filter
            </button>
          )}

          {uniqueVals.map((val) => {
            const checked = !!(activeSet && activeSet.has(val));
            return (
              <label
                key={val}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '5px 12px',
                  cursor: 'pointer',
                  background: checked ? 'rgba(6,229,236,0.09)' : 'transparent',
                  transition: 'background 0.1s',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleFilter(col.key, val)}
                  style={{ cursor: 'pointer', accentColor: '#06E5EC', flexShrink: 0 }}
                />
                <span style={{
                  fontSize: 11,
                  color: checked ? '#fff' : 'var(--text-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: 135,
                }}>
                  {val}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </th>
  );
}
