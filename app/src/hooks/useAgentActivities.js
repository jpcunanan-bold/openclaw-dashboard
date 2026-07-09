import { useState, useEffect, useCallback, useRef } from 'react';
import { authHeaders } from '../components/LoginGate';

const NOISE = /^(HEARTBEAT|Delta:|Cron job|Heartbeat \/ System|HEARTBEAT_OK)/i;

export function useAgentActivities(agentId, days = 30, refreshMs = 300_000) {
  const [activities, setActivities] = useState([]);
  const [meta, setMeta] = useState({ total: 0, totalCost: 0, totalTokens: 0, loading: true });
  const timer = useRef(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!agentId) { setMeta(m => ({ ...m, loading: false })); return; }
    if (!isRefresh) setMeta(m => ({ ...m, loading: true }));
    try {
      const res = await fetch(
        `/api/agent-activities?agent_id=${encodeURIComponent(agentId)}&days=${days}&limit=50`,
        { headers: authHeaders() }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const filtered = (json.activities || []).filter(a => !NOISE.test(a.title || ''));
      setActivities(filtered);
      setMeta({
        total:       filtered.length,
        totalCost:   json.totalCost  || 0,
        totalTokens: json.totalTokens || 0,
        loading:     false,
      });
    } catch (e) {
      console.warn('useAgentActivities error:', e.message);
      if (!isRefresh) setMeta(m => ({ ...m, loading: false }));
    }
  }, [agentId, days]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    timer.current = setInterval(() => load(true), refreshMs);
    return () => clearInterval(timer.current);
  }, [load, refreshMs]);

  return { activities, ...meta, refresh: () => load(false) };
}

// Convenience: fetch activities for ALL agents at once
export function useAllAgentActivities(agentIds, days = 7) {
  const [map, setMap]         = useState({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const results = await Promise.all(
      agentIds.map(id =>
        fetch(`/api/agent-activities?agent_id=${encodeURIComponent(id)}&days=${days}&limit=20`, { headers: authHeaders() })
          .then(r => r.ok ? r.json() : { activities: [], totalCost: 0, totalTokens: 0 })
          .catch(() => ({ activities: [], totalCost: 0, totalTokens: 0 }))
      )
    );
    const next = {};
    agentIds.forEach((id, i) => {
      const acts = (results[i].activities || []).filter(a => !NOISE.test(a.title || ''));
      next[id] = { activities: acts, totalCost: results[i].totalCost || 0, totalTokens: results[i].totalTokens || 0 };
    });
    setMap(next);
    setLoading(false);
  }, [agentIds.join(','), days]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  return { map, loading, refresh: load };
}
