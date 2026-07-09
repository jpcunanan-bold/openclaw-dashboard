import { useState, useEffect, useCallback, useRef } from 'react';
import { authHeaders } from '../components/LoginGate';

export function useActivities(refreshMs = 30_000) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      // Filter to today only — pass today=1 so the server filters by Eastern Time date
      const res = await fetch('/api/activities?today=1', { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      console.warn('Activities fetch error:', e.message);
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
