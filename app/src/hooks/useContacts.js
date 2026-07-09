// app/src/hooks/useContacts.js
import { useState, useEffect, useCallback } from 'react';

async function apiFetch(path) {
  const token = localStorage.getItem('cc_auth_token') || localStorage.getItem('authToken') || '';
  const res = await fetch(`/api${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function buildQuery(filters) {
  const p = new URLSearchParams();
  if (filters.agent && filters.agent !== 'all') p.set('agent', filters.agent);
  if (filters.campaign && filters.campaign !== 'all') p.set('campaign', filters.campaign);
  if (filters.company) p.set('company', filters.company);
  if (filters.touch_filter && filters.touch_filter !== 'all') p.set('touch_filter', filters.touch_filter);
  if (filters.next_action) p.set('next_action', filters.next_action);
  if (filters.blacklisted !== undefined) p.set('blacklisted', String(filters.blacklisted));
  if (filters.date_from) p.set('date_from', filters.date_from);
  if (filters.date_to) p.set('date_to', filters.date_to);
  p.set('limit', String(filters.limit || 500));
  p.set('offset', String(filters.offset || 0));
  return p.toString();
}

export function useContacts(filters = {}) {
  const [contacts, setContacts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = buildQuery(filters);
      const data = await apiFetch(`/contacts?${qs}`);
      setContacts(data.contacts || []);
      setTotal(data.total || 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => { load(); }, [load]);
  return { contacts, total, loading, error, refresh: load };
}

export function useContactMetrics(agent, dateFrom, dateTo) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (agent && agent !== 'all') p.set('agent', agent);
      if (dateFrom) p.set('date_from', dateFrom);
      if (dateTo)   p.set('date_to', dateTo);
      const data = await apiFetch(`/contacts/metrics?${p}`);
      setMetrics(data);
    } catch {
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  }, [agent, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);
  return { metrics, loading, refresh: load };
}

export function useIntelligenceFeed(agent) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = agent && agent !== 'all' ? `?agent=${agent}` : '';
      const data = await apiFetch(`/contacts/intelligence-feed${p}`);
      setItems(data.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [agent]);

  useEffect(() => { load(); }, [load]);
  return { items, loading, refresh: load };
}

export async function toggleBlacklist(contactId, blacklisted) {
  const token = localStorage.getItem('cc_auth_token') || localStorage.getItem('authToken') || '';
  const res = await fetch(`/api/contacts/${contactId}/blacklist`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ blacklisted }),
  });
  if (!res.ok) throw new Error(`Blacklist toggle failed: ${res.status}`);
  return res.json();
}
