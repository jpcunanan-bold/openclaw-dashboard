import { useState, useEffect, useCallback } from 'react';
import { authHeaders } from '../LoginGate';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York',
  });
}

function fmtCost(n) {
  const v = Number(n) || 0;
  if (v === 0) return null;
  if (v < 0.01) return '<$0.01';
  return `$${v.toFixed(3)}`;
}

const CATEGORY_META = {
  'lead-gen':     { icon: '🎯', color: '#06E5EC' },
  'outreach':     { icon: '📤', color: '#3B82F6' },
  'enrichment':   { icon: '🔍', color: '#8B5CF6' },
  'data-hygiene': { icon: '🧹', color: '#F59E0B' },
  'research':     { icon: '📊', color: '#22C55E' },
  'follow-up':    { icon: '🔁', color: '#0EA5E9' },
  'handoff':      { icon: '🤝', color: '#28c76f' },
  'admin':        { icon: '⚙️', color: 'rgba(255,255,255,0.4)' },
  'task':         { icon: '📋', color: '#06E5EC' },
  'system':       { icon: '🤖', color: 'rgba(255,255,255,0.25)' },
  'routine':      { icon: '⚡', color: 'rgba(255,255,255,0.3)' },
};

function getCatMeta(cat) {
  const key = (cat || '').toLowerCase();
  return CATEGORY_META[key] || { icon: '📌', color: '#06E5EC' };
}

function statusColor(s) {
  const st = (s || '').toLowerCase();
  if (st === 'completed' || st === 'done') return '#28c76f';
  if (st === 'in_progress' || st === 'in progress') return '#06E5EC';
  if (st === 'failed') return '#ea5455';
  return '#ffc107';
}

// ── Single task row ───────────────────────────────────────────────────────────
function TaskRow({ task }) {
  const [open, setOpen] = useState(false);
  const cat   = getCatMeta(task.category);
  const cost  = fmtCost(task.costUsd);
  const sc    = statusColor(task.status);

  return (
    <div
      onClick={() => setOpen(o => !o)}
      style={{
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        padding: '9px 14px',
        cursor: 'pointer',
        transition: 'background 0.1s',
        background: open ? 'rgba(255,255,255,0.04)' : 'transparent',
      }}
    >
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Category icon */}
        <span style={{ fontSize: 14, flexShrink: 0 }}>{cat.icon}</span>

        {/* Title */}
        <div style={{
          flex: 1, minWidth: 0,
          fontSize: 12, fontWeight: 600, color: '#e8eaff',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {task.title}
        </div>

        {/* Cost */}
        {cost && (
          <span style={{ fontSize: 10, color: '#F59E0B', flexShrink: 0 }}>{cost}</span>
        )}

        {/* Time */}
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
          {fmtTime(task.timestamp)}
        </span>

        {/* Status dot */}
        <div style={{
          width: 7, height: 7, borderRadius: '50%',
          background: sc, flexShrink: 0,
        }} title={task.status} />
      </div>

      {/* Expanded detail */}
      {open && (
        <div style={{
          marginTop: 8, paddingLeft: 22,
          fontSize: 11, color: 'rgba(255,255,255,0.45)',
          lineHeight: 1.5,
        }}>
          {task.requestedBy && task.requestedBy !== 'Unknown' && (
            <div>👤 Requested by: <span style={{ color: 'rgba(255,255,255,0.65)' }}>{task.requestedBy}</span></div>
          )}
          {task.category && (
            <div>🏷️ Category: <span style={{ color: cat.color }}>{task.category}</span></div>
          )}
          {task.rawMessage && (
            <div style={{
              marginTop: 6, padding: '6px 10px',
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 6,
              fontStyle: 'italic',
              color: 'rgba(255,255,255,0.55)',
              maxHeight: 60, overflowY: 'auto',
            }}>
              "{task.rawMessage}"
            </div>
          )}
          {task.actions && task.actions.length > 0 && (
            <div style={{ marginTop: 4 }}>
              {task.actions.slice(0, 3).map((a, i) => (
                <div key={i} style={{ color: 'rgba(255,255,255,0.4)' }}>· {a}</div>
              ))}
              {task.actions.length > 3 && (
                <div style={{ color: 'rgba(255,255,255,0.25)' }}>+{task.actions.length - 3} more…</div>
              )}
            </div>
          )}
          <div style={{ marginTop: 4, color: 'rgba(255,255,255,0.25)' }}>
            Source: {task.source}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Agent column ─────────────────────────────────────────────────────────────
function AgentColumn({ name, avatar, accentColor, tasks, loading, error, filterCat, setFilterCat }) {
  const totalCost = tasks.reduce((s, t) => s + (Number(t.costUsd) || 0), 0);

  // Unique categories for filter chips
  const cats = [...new Set(tasks.map(t => t.category).filter(Boolean))];

  const filtered = filterCat
    ? tasks.filter(t => t.category === filterCat)
    : tasks;

  return (
    <div style={{
      flex: '1 1 0',
      minWidth: 0,
      background: 'rgba(255,255,255,0.02)',
      border: `1px solid ${accentColor}30`,
      borderTop: `3px solid ${accentColor}`,
      borderRadius: 12,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px 10px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'center', gap: 10,
        background: `${accentColor}08`,
      }}>
        <span style={{ fontSize: 18 }}>{avatar}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: accentColor }}>{name}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
            {tasks.length} task{tasks.length !== 1 ? 's' : ''} today
            {totalCost > 0 && <span style={{ color: '#F59E0B', marginLeft: 6 }}>· ${totalCost.toFixed(3)} spent</span>}
          </div>
        </div>
        {/* Live dot */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: '#28c76f',
            boxShadow: '0 0 6px #28c76f',
            animation: 'pulse 2s infinite',
          }} />
          <span style={{ fontSize: 10, color: '#28c76f' }}>Live</span>
        </div>
      </div>

      {/* Category filter chips */}
      {cats.length > 1 && (
        <div style={{
          padding: '6px 12px',
          display: 'flex', gap: 5, flexWrap: 'wrap',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          background: 'rgba(0,0,0,0.15)',
        }}>
          <button
            onClick={() => setFilterCat(null)}
            style={{
              padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600,
              border: '1px solid',
              borderColor: !filterCat ? accentColor : 'rgba(255,255,255,0.12)',
              background: !filterCat ? `${accentColor}18` : 'transparent',
              color: !filterCat ? accentColor : 'rgba(255,255,255,0.4)',
              cursor: 'pointer',
            }}
          >All</button>
          {cats.map(c => {
            const m = getCatMeta(c);
            const active = filterCat === c;
            return (
              <button
                key={c}
                onClick={() => setFilterCat(active ? null : c)}
                style={{
                  padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600,
                  border: '1px solid',
                  borderColor: active ? m.color : 'rgba(255,255,255,0.1)',
                  background: active ? `${m.color}18` : 'transparent',
                  color: active ? m.color : 'rgba(255,255,255,0.35)',
                  cursor: 'pointer',
                }}
              >
                {m.icon} {c}
              </button>
            );
          })}
        </div>
      )}

      {/* Task list */}
      <div style={{ flex: 1, overflowY: 'auto', maxHeight: 420 }}>
        {loading && (
          <div style={{ padding: 24, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
            Loading…
          </div>
        )}
        {!loading && error && (
          <div style={{ padding: 14, fontSize: 12, color: '#ea5455' }}>⚠️ {error}</div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div style={{
            padding: '32px 20px', textAlign: 'center',
            color: 'rgba(255,255,255,0.2)', fontSize: 12,
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
            No tasks logged yet today
          </div>
        )}
        {!loading && !error && filtered.map(t => (
          <TaskRow key={t.id} task={t} />
        ))}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function TodayTasksFeed() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [lauraCat, setLauraCat] = useState(null);
  const [darrenCat, setDarrenCat] = useState(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/today/tasks', { headers: authHeaders() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Auto-refresh every 60s
    const iv = setInterval(load, 60000);
    return () => clearInterval(iv);
  }, [load]);

  const lauraDate = data?.date || new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const displayDate = new Date(lauraDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  return (
    <div style={{ marginBottom: 32 }}>
      {/* Section header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 14, flexWrap: 'wrap', gap: 8,
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
            📅 Today's Task Feed
          </h3>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>
            {displayDate} · every task given to either agent today
          </div>
        </div>
        <button
          onClick={load}
          style={{
            padding: '6px 12px', borderRadius: 8, fontSize: 11,
            border: '1px solid rgba(6,229,236,0.3)',
            background: 'rgba(6,229,236,0.08)', color: '#06E5EC', cursor: 'pointer',
          }}
        >↻ Refresh</button>
      </div>

      {/* Side-by-side columns */}
      <div style={{ display: 'flex', gap: 14 }}>
        <AgentColumn
          name="Laura Petersen"
          avatar="👤"
          accentColor="#3B82F6"
          tasks={data?.laura || []}
          loading={loading}
          error={error}
          filterCat={lauraCat}
          setFilterCat={setLauraCat}
        />
        <AgentColumn
          name="Darren Stuart"
          avatar="📡"
          accentColor="#8B5CF6"
          tasks={data?.darren || []}
          loading={loading}
          error={error}
          filterCat={darrenCat}
          setFilterCat={setDarrenCat}
        />
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
