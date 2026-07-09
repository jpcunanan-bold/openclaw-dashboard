import { useState, useEffect, useCallback, useRef } from 'react';
import { authHeaders } from '../components/LoginGate';

export function useCostToday(refreshMs = 300_000) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await fetch('/api/cost/today', { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      console.warn('Cost today fetch error:', e.message);
      if (!isRefresh) setData(null);
    } finally {
      if (!isRefresh) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => load(true), refreshMs);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load, refreshMs]);

  return { data, loading, refresh: () => load(false) };
}
