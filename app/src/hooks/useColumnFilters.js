import { useState, useMemo, useCallback } from 'react';

/**
 * Sort + per-column multi-select filter state for any flat row array.
 *
 * Usage:
 *   const { filteredRows, sortConfig, columnFilters, setSortBy,
 *           toggleFilterValue, clearFilters, clearColumnFilter,
 *           getUniqueValues, activeFilterCount } = useColumnFilters(rows);
 *
 * - sortConfig: { key: string|null, dir: 'asc'|'desc'|null }
 * - columnFilters: { [colKey]: Set<string> }
 * - Filters AND across columns; within a column any checked value passes.
 */
export function useColumnFilters(rows) {
  const [sortConfig, setSortConfig] = useState({ key: null, dir: null });
  const [columnFilters, setColumnFilters] = useState({});

  const setSortBy = useCallback((key) => {
    setSortConfig((prev) => {
      if (prev.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return { key: null, dir: null };
    });
  }, []);

  const toggleFilterValue = useCallback((colKey, value) => {
    setColumnFilters((prev) => {
      const current = prev[colKey] ? new Set(prev[colKey]) : new Set();
      if (current.has(value)) {
        current.delete(value);
      } else {
        current.add(value);
      }
      return { ...prev, [colKey]: current };
    });
  }, []);

  const clearFilters = useCallback(() => {
    setColumnFilters({});
    setSortConfig({ key: null, dir: null });
  }, []);

  const clearColumnFilter = useCallback((colKey) => {
    setColumnFilters((prev) => {
      const next = { ...prev };
      delete next[colKey];
      return next;
    });
  }, []);

  const getUniqueValues = useCallback(
    (colKey) => {
      const vals = new Set();
      for (const row of rows) {
        const v = String(row[colKey] ?? '').trim();
        if (v) vals.add(v);
      }
      return Array.from(vals).sort((a, b) => a.localeCompare(b));
    },
    [rows],
  );

  const activeFilterCount = useMemo(
    () => Object.values(columnFilters).filter((s) => s && s.size > 0).length,
    [columnFilters],
  );

  const filteredRows = useMemo(() => {
    let result = rows;

    for (const [colKey, valueSet] of Object.entries(columnFilters)) {
      if (!valueSet || valueSet.size === 0) continue;
      result = result.filter((row) => {
        const v = String(row[colKey] ?? '').trim();
        return valueSet.has(v);
      });
    }

    if (sortConfig.key) {
      const key = sortConfig.key;
      result = [...result].sort((a, b) => {
        const av = String(a[key] ?? '').toLowerCase();
        const bv = String(b[key] ?? '').toLowerCase();
        const cmp = av.localeCompare(bv);
        return sortConfig.dir === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [rows, sortConfig, columnFilters]);

  return {
    filteredRows,
    sortConfig,
    columnFilters,
    setSortBy,
    toggleFilterValue,
    clearFilters,
    clearColumnFilter,
    getUniqueValues,
    activeFilterCount,
  };
}
