import { useState, useEffect, useCallback, useRef } from 'react';
import { authHeaders } from '../components/LoginGate';

export function useTaskCosts(refreshIntervalMs = 60_000) {
  const [costs, setCosts] = useState(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await fetch('/api/tasks/costs', { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCosts(data);
    } catch (e) {
      console.warn('Task costs fetch error:', e.message);
      if (!isRefresh) setCosts(null);
    } finally {
      if (!isRefresh) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh every minute for "live" feel
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => load(true), refreshIntervalMs);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load, refreshIntervalMs]);

  return { costs, loading, refresh: () => load(false) };
}
