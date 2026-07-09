import { useState, useEffect, useCallback } from 'react';

async function fetchApi(path, opts = {}) {
  const token = localStorage.getItem('cc_auth_token') || localStorage.getItem('authToken') || '';
  const res = await fetch(`/api${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export function useTasks(statusFilter = 'all') {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = statusFilter && statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const result = await fetchApi(`/tracker-tasks${qs}`);
      setData(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function createTask(payload) {
    const token = localStorage.getItem('cc_auth_token') || localStorage.getItem('authToken') || '';
    const res = await fetch('/api/tracker-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    await load();
    return res.json();
  }

  async function updateTask(id, patch) {
    const token = localStorage.getItem('cc_auth_token') || localStorage.getItem('authToken') || '';
    const res = await fetch(`/api/tracker-tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    await load();
    return res.json();
  }

  return { data, loading, error, refresh: load, createTask, updateTask };
}
