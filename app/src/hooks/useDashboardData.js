import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchAndProcessData } from '../utils/dataProcessor';
import { AUTO_REFRESH_INTERVAL } from '../config';

export function useDashboardData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);

  const loadData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);

    try {
      const processedData = await fetchAndProcessData();
      setData(processedData);
    } catch (e) {
      console.error('Fetch error:', e);
      setError(e.message || 'Failed to fetch dashboard data');
    } finally {
      if (!isRefresh) setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh timer
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      loadData(true);
    }, AUTO_REFRESH_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loadData]);

  return { data, loading, error, refresh: () => loadData(false) };
}
