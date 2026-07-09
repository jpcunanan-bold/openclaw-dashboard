import { useState, useEffect, useCallback } from 'react';

async function fetchApi(path) {
  const token = localStorage.getItem('cc_auth_token') || localStorage.getItem('authToken') || '';
  const res = await fetch(`/api${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export function useMessages(days = 7) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchApi(`/messages?days=${days}&limit=500`);
      setData(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, refresh: load };
}
