import { useState, useEffect, useCallback } from 'react';

async function fetchPg(path) {
  const token = localStorage.getItem('cc_auth_token') || localStorage.getItem('authToken') || '';
  const res = await fetch(`/api${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export function usePgData(days = 7) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [health, activities, summary] = await Promise.all([
        fetchPg('/pg/health'),
        fetchPg(`/pg/activities?days=${days}&limit=500`),
        fetchPg('/pg/summary'),
      ]);
      setData({ health, activities, summary });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, refresh: load };
}
