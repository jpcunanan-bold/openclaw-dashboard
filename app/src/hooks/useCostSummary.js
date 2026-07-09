import { useState, useEffect, useCallback, useRef } from 'react';
import { authHeaders } from '../components/LoginGate';
import { AGENT_CONFIG } from '../utils/agentConfig';

const agentIds = Object.keys(AGENT_CONFIG);

function isoDate(d) { return d.toISOString().slice(0, 10); }

function computePeriods(snapshots, todayOverride) {
  const now    = new Date();
  const today  = isoDate(now);
  const mtd    = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const t3mDay = isoDate(new Date(now - 90 * 86_400_000));

  const sum = (filter) =>
    snapshots.filter(filter).reduce((s, r) => s + Number(r.total_cost_usd || 0), 0);

  const snapshotToday = sum(r => r.snapshot_date?.startsWith(today));

  return {
    today:     todayOverride ?? snapshotToday,
    mtd:       sum(r => r.snapshot_date >= mtd),
    t3m:       sum(r => r.snapshot_date >= t3mDay),
    inception: sum(() => true),
    snapshots,
  };
}

export function useCostSummary(refreshMs = 300_000) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const timer = useRef(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const hdrs = authHeaders();

      // 1. Snapshot fetch — one per agent (90-day window)
      const snapshots = await Promise.all(
        agentIds.map(id =>
          fetch(`/api/bb/cost-snapshots?agent_id=${encodeURIComponent(id)}&days=90`, { headers: hdrs })
            .then(r => r.ok ? r.json() : { snapshots: [] })
            .catch(() => ({ snapshots: [] }))
        )
      );

      // 2. Live today cost for laura (most accurate)
      const todayRes = await fetch('/api/cost/today', { headers: hdrs }).catch(() => null);
      const todayData = todayRes?.ok ? await todayRes.json() : null;

      // 3. Build per-agent map
      const byAgent = {};
      let fleet = { today: 0, mtd: 0, t3m: 0, inception: 0 };

      agentIds.forEach((id, i) => {
        const snap = snapshots[i]?.snapshots || [];
        const liveTodayCost = (id === 'laura-abhi-agent') ? (todayData?.actualCostUsd ?? null) : null;
        const periods = computePeriods(snap, liveTodayCost);

        // Build 14-day daily series for sparklines
        const daily14 = [];
        for (let d = 13; d >= 0; d--) {
          const dt = isoDate(new Date(Date.now() - d * 86_400_000));
          const row = snap.find(s => s.snapshot_date?.startsWith(dt));
          daily14.push({ date: dt, cost: row ? Number(row.total_cost_usd) : 0 });
        }

        byAgent[id] = { ...periods, daily14, todayDetail: id === 'laura-abhi-agent' ? todayData : null };

        fleet.today     += periods.today;
        fleet.mtd       += periods.mtd;
        fleet.t3m       += periods.t3m;
        fleet.inception += periods.inception;
      });

      // 4. Fleet 14-day daily series (sum across agents per day)
      const fleet14 = [];
      for (let d = 13; d >= 0; d--) {
        const dt = isoDate(new Date(Date.now() - d * 86_400_000));
        const cost = agentIds.reduce((s, id) => {
          const row = (snapshots[agentIds.indexOf(id)]?.snapshots || []).find(r => r.snapshot_date?.startsWith(dt));
          return s + (row ? Number(row.total_cost_usd) : 0);
        }, 0);
        fleet14.push({ date: dt, cost });
      }

      setData({ byAgent, fleet: { ...fleet, daily14: fleet14 }, loadedAt: new Date().toISOString() });
    } catch (e) {
      console.warn('useCostSummary error:', e.message);
    } finally {
      if (!isRefresh) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    timer.current = setInterval(() => load(true), refreshMs);
    return () => clearInterval(timer.current);
  }, [load, refreshMs]);

  return { data, loading, refresh: () => load(false) };
}
