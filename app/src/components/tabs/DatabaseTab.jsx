import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { fmtNumber, fmtUsd } from '../../utils/helpers';
import { useMessages } from '../../hooks/useMessages';
import { useTasks } from '../../hooks/useTasks';

/* ── Shared helpers ───────────────────────────────────────────────────────── */
function fmtTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-US', {
    timeZone: 'America/New_York', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

async function apiFetch(path) {
  const token = localStorage.getItem('cc_auth_token') || localStorage.getItem('authToken') || '';
  const res = await fetch(`/api${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function RequesterBadge({ name }) {
  const colors = { Ed: '#e8a838', Ron: '#4f8cff', Jewel: '#38c97a', System: '#888', Cron: '#888' };
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 10,
      fontSize: 11, fontWeight: 600, color: '#fff',
      background: colors[name] || '#888',
    }}>{name || 'System'}</span>
  );
}

/* ── Category definitions ─────────────────────────────────────────────────── */
const CATEGORIES = {
  user: {
    key: 'user', icon: '⭐', label: "Ed's Tasks", color: '#e8a838',
    title: "Ed's Tasks — Work completed for Ed",
    match: a => {
      const cat = (a.category || '').toLowerCase();
      const req = (a.requestedBy || '').toLowerCase();
      return cat.includes('user') || req === 'ed';
    },
  },
  routine: {
    key: 'routine', icon: '🔄', label: 'Routine / Background', color: '#888',
    title: 'Routine — Automated scans, syncs, heartbeats',
    match: a => {
      const cat = (a.category || '').toLowerCase();
      const type = (a.type || '').toLowerCase();
      return cat.includes('routine') || cat.includes('system') || cat.includes('background') ||
             cat.includes('cron') || type === 'cron' || type === 'system';
    },
  },
  developer: {
    key: 'developer', icon: '🛠️', label: 'Dev (Ron & Jewel)', color: '#4f8cff',
    title: 'Developer — Tasks from Ron and Jewel',
    match: a => {
      const cat = (a.category || '').toLowerCase();
      const req = (a.requestedBy || '').toLowerCase();
      return cat.includes('developer') || req === 'ron' || req === 'jewel';
    },
  },
};

/* ── Cost period card ─────────────────────────────────────────────────────── */
function CostCard({ label, cost, isActive, onClick, displayOnly }) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1, minWidth: 120, padding: '12px 16px', borderRadius: 10,
        cursor: displayOnly ? 'default' : 'pointer',
        background: displayOnly ? 'var(--bg-card)' : isActive ? 'rgba(232,168,56,0.12)' : 'var(--bg-card)',
        border: displayOnly ? '1px dashed var(--border)' : isActive ? '2px solid rgba(232,168,56,0.5)' : '1px solid var(--border)',
        opacity: displayOnly ? 0.7 : 1,
        transition: 'all 0.15s ease',
      }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
        {displayOnly && <span style={{ marginLeft: 5, fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic', textTransform: 'none', letterSpacing: 0 }}>(display only)</span>}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: displayOnly ? 'var(--text-muted)' : cost != null ? 'var(--orange)' : 'var(--text-muted)' }}>
        {cost != null ? `$${fmtUsd(cost)}` : '—'}
      </div>
    </div>
  );
}

/* ── Activity row (expandable) ────────────────────────────────────────────── */
function ActivityRow({ activity, isExpanded, onToggle }) {
  const a = activity;
  const actions = typeof a.actions === 'string' ? (() => { try { return JSON.parse(a.actions); } catch { return []; } })() : (a.actions || []);
  const shortModel = (a.model || '').replace('claude-', '').replace(/-\d{8}$/, '');
  return (
    <>
      <tr style={{ cursor: 'pointer' }} className={`task-row${isExpanded ? ' expanded' : ''}`} onClick={onToggle}>
        <td style={{ width: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 11 }}>
          {isExpanded ? '▾' : '▸'}
        </td>
        <td><RequesterBadge name={a.requestedBy} /></td>
        <td style={{ fontWeight: 600 }}>
          <div style={{ maxWidth: 500 }}>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title || '—'}</div>
          </div>
        </td>
        <td style={{ fontSize: 11 }}>{shortModel || '—'}</td>
        <td style={{ fontWeight: 600, color: 'var(--orange)' }}>{a.costUsd ? `$${fmtUsd(Number(a.costUsd))}` : '—'}</td>
        <td>{a.timeSavedMin ? `${a.timeSavedMin} min` : '—'}</td>
        <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{fmtTime(a.timestamp)}</td>
      </tr>
      {isExpanded && (
        <tr className="detail-row visible">
          <td colSpan={7}>
            <div className="detail-panel" style={{ padding: '14px 18px' }}>
              {a.request && (
                <div style={{ marginBottom: 12 }}>
                  <div className="detail-label" style={{ marginBottom: 4 }}>📩 What was requested</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5, padding: '8px 12px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    {a.request}
                  </div>
                </div>
              )}
              {actions.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div className="detail-label" style={{ marginBottom: 6 }}>🔧 Steps completed</div>
                  {actions.map((action, i) => (
                    <div key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, padding: '4px 0 4px 16px', borderLeft: '2px solid var(--border)', marginBottom: 2 }}>
                      <span style={{ color: 'var(--text-muted)', marginRight: 6, fontSize: 11 }}>{i + 1}.</span>{action}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <span>Model: <strong>{shortModel}</strong></span>
                {a.taskId && <span>Task: <strong>{a.taskId}</strong></span>}
                <span>Source: <strong>{
                  (a.source || 'api') === 'plugin-enriched' ? '✓ Auto-tracked'
                  : (a.source === 'agent-reported') ? 'Manual log'
                  : 'Manual log'
                }</strong></span>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ── Category activity list ───────────────────────────────────────────────── */
function CategoryList({ activities, expandedId, setExpandedId }) {
  if (!activities || activities.length === 0) {
    return <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>No activities in this category</div>;
  }
  return (
    <div className="tasks-table-wrap">
      <table><thead><tr>
        <th style={{ width: 24 }}></th>
        <th>Who</th>
        <th>What was done</th>
        <th>Model</th>
        <th title="Agent-estimated cost — not from Anthropic API">Est. Cost *</th>
        <th>Time Saved</th>
        <th>When</th>
      </tr></thead><tbody>
        {activities.map(a => (
          <ActivityRow key={a.id} activity={a}
            isExpanded={expandedId === a.id}
            onToggle={() => setExpandedId(expandedId === a.id ? null : a.id)} />
        ))}
      </tbody></table>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   ConversationsPane (kept from v1)
   ════════════════════════════════════════════════════════════════════════════ */
function ConversationsPane({ days }) {
  const { data, loading, error } = useMessages(days);
  const messages = data?.messages || [];
  const summary  = data?.summary  || {};

  const sessions = useMemo(() => {
    const map = {};
    for (const m of messages) {
      const sk = m.session_key || 'unknown';
      if (!map[sk]) map[sk] = { key: sk, messages: [], inbound: 0, outbound: 0, users: new Set(), models: new Set(), totalTokens: 0, totalCost: 0 };
      map[sk].messages.push(m);
      if (m.direction === 'inbound') { map[sk].inbound++; if (m.user_name) map[sk].users.add(m.user_name); }
      if (m.direction === 'outbound') { map[sk].outbound++; if (m.model) map[sk].models.add(m.model); map[sk].totalTokens += (Number(m.input_tokens)||0)+(Number(m.output_tokens)||0)+(Number(m.cache_read_tokens)||0); map[sk].totalCost += Number(m.cost_usd)||0; }
    }
    return Object.values(map).sort((a,b) => {
      const at = a.messages[0]?.timestamp || ''; const bt = b.messages[0]?.timestamp || '';
      return bt.localeCompare(at);
    });
  }, [messages]);

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>⏳ Loading…</div>;
  if (error) return <div style={{ textAlign: 'center', padding: 60, color: '#e74c3c' }}>🔴 {error}</div>;

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        {[{ label: 'Sessions', value: fmtNumber(summary.sessions || sessions.length) },
          { label: 'Messages', value: fmtNumber(summary.total || messages.length) },
          { label: 'Total Cost', value: `$${fmtUsd(summary.totalCost || 0)}` },
          { label: 'Tokens', value: fmtNumber(summary.totalTokens || 0) }
        ].map((s, i) => (
          <div key={i} className="card" style={{ flex: 1, minWidth: 100, padding: '12px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{s.value}</div>
          </div>
        ))}
      </div>
      {sessions.map(s => (
        <SessionCard key={s.key} session={s} />
      ))}
    </div>
  );
}

function SessionCard({ session: s }) {
  const [expanded, setExpanded] = useState(false);
  const known = { '79zumsaaaae': 'Ron DM', 'ir_hmsaaaae': 'Ed DM', 'aaqacuwn39y': 'Laura Tech Team' };
  let label = s.key;
  for (const [id, name] of Object.entries(known)) { if (s.key.toLowerCase().includes(id)) { label = name; break; } }
  if (s.key.includes(':cron:')) label = 'Cron: ' + s.key.split(':cron:')[1]?.substring(0,8);
  if (s.key === 'agent:main:main') label = 'System';

  const users = [...s.users].join(', ') || '—';
  const models = [...s.models].map(m => m.replace('claude-','')).join(', ') || '—';
  const outbound = s.messages.filter(m => m.direction === 'outbound');
  const totalCost = outbound.reduce((sum, m) => sum + (Number(m.cost_usd) || 0), 0);
  const totalTok = outbound.reduce((sum, m) => sum + (Number(m.input_tokens)||0) + (Number(m.output_tokens)||0) + (Number(m.cache_read_tokens)||0), 0);

  return (
    <div className="card" style={{ marginBottom: 12, padding: 0 }}>
      <div style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        onClick={() => setExpanded(!expanded)}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{expanded ? '▾' : '▸'} {label}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {s.inbound} in · {s.outbound} out · {users} · {models}
          </div>
        </div>
        {totalCost > 0 && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 700, color: 'var(--orange)' }}>${fmtUsd(totalCost)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtNumber(totalTok)} tokens</div>
          </div>
        )}
      </div>
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '8px 16px', maxHeight: 400, overflow: 'auto' }}>
          {s.messages.map((m, i) => {
            const isIn = m.direction === 'inbound';
            return (
              <div key={m.id || i} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, fontSize: 13 }}>
                <div style={{ width: 50, flexShrink: 0, fontWeight: 600, color: isIn ? '#4f8cff' : 'var(--orange)' }}>
                  {isIn ? '→ IN' : '← OUT'}
                </div>
                <div style={{ flex: 1, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {(m.content || '').substring(0, 200)}
                </div>
                <div style={{ flexShrink: 0, fontSize: 11, color: 'var(--text-muted)' }}>{fmtTime(m.timestamp)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   TasksPane (kept from v1)
   ════════════════════════════════════════════════════════════════════════════ */
function TasksPane() {
  const { data, loading, error, createTask, updateTask, refresh } = useTasks();
  const tasks = data?.tasks || [];
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', assigned_to: '' });

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>⏳ Loading…</div>;
  if (error) return <div style={{ textAlign: 'center', padding: 60, color: '#e74c3c' }}>🔴 {error}</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{tasks.length} tasks tracked</div>
        <button className="btn" onClick={() => setShowForm(!showForm)}>+ New Task</button>
      </div>
      {tasks.length === 0 && !showForm && (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>No tasks yet</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            Tasks are separate from activities — use them to track specific projects or deliverables.
          </div>
          <button className="btn" onClick={() => setShowForm(true)}>+ Create First Task</button>
        </div>
      )}
      {showForm && (
        <div className="card" style={{ marginBottom: 16, padding: 16 }}>
          <input placeholder="Task title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
            style={{ width: '100%', marginBottom: 8, padding: 8, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }} />
          <textarea placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
            style={{ width: '100%', marginBottom: 8, padding: 8, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', minHeight: 60 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={async () => { await createTask(form); setShowForm(false); setForm({ title: '', description: '', priority: 'medium', assigned_to: '' }); }}>Create</button>
            <button className="btn" style={{ background: 'var(--bg-card)' }} onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}
      <div className="tasks-table-wrap">
        <table><thead><tr>
          <th>Title</th><th>Status</th><th>Priority</th><th>Assigned</th><th>Cost</th><th>Created</th>
        </tr></thead><tbody>
          {tasks.map(t => (
            <tr key={t.id}>
              <td style={{ fontWeight: 600 }}>{t.title}<br/><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.description}</span></td>
              <td><select value={t.status} onChange={e => updateTask(t.id, { status: e.target.value })}
                style={{ padding: 4, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 12 }}>
                {['open','in_progress','blocked','done','cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
              </select></td>
              <td style={{ fontSize: 12 }}>{t.priority}</td>
              <td style={{ fontSize: 12 }}>{t.assigned_to || '—'}</td>
              <td style={{ color: 'var(--orange)', fontWeight: 600 }}>{t.total_cost_usd > 0 ? `$${fmtUsd(t.total_cost_usd)}` : '—'}</td>
              <td style={{ fontSize: 11 }}>{fmtTime(t.created_at)}</td>
            </tr>
          ))}
        </tbody></table>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   MAIN DatabaseTab
   ════════════════════════════════════════════════════════════════════════════ */
const TOP_TABS = [
  { key: 'activities',     label: '📊 Activities' },
  { key: 'conversations',  label: '💬 Conversations' },
  { key: 'tasks',          label: '📋 Tasks' },
];

export default function DatabaseTab() {
  const [topTab, setTopTab]           = useState('activities');
  const [days, setDays]               = useState(1);
  const [activeCategory, setActiveCategory] = useState('user');
  const [expandedId, setExpandedId]   = useState(null);

  // ── Fetch activities ──
  const [activities, setActivities] = useState([]);
  const [summary, setSummary]       = useState({});
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);

  const loadActivities = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const d = await apiFetch(`/pg/activities?days=${days}&limit=500`);
      setActivities(d.activities || []);
      setSummary(d.summary || {});
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [days]);

  useEffect(() => { loadActivities(); }, [loadActivities]);

  // ── Fetch cost periods (always) ──
  const [costPeriods, setCostPeriods] = useState({ today: null, yesterday: null, week: null, month: null });

  useEffect(() => {
    (async () => {
      try {
        // Fetch 30 days so all cost cards (Today/7d/30d) have full data
        const [todayResp, hist] = await Promise.all([
          apiFetch('/cost/today'),
          apiFetch('/cost/history?days=30'),
        ]);
        const todayCost = todayResp?.actualCostUsd ?? null;
        const todayDate = new Date().toISOString().substring(0, 10);

        const series = (hist?.series || []).filter(s => s.date !== todayDate); // exclude today from history (counted separately)

        // Yesterday
        const yDate = new Date(); yDate.setDate(yDate.getDate() - 1);
        const yStr  = yDate.toISOString().substring(0, 10);
        const yesterdayEntry  = series.find(s => s.date === yStr);
        const yesterdayCost   = yesterdayEntry?.costTotal ?? null;

        // 7-day: sum last 7 days of history + today
        const last7   = series.filter(s => s.date >= new Date(Date.now() - 6 * 86400000).toISOString().substring(0, 10));
        const weekCost = (todayCost || 0) + last7.reduce((s, d) => s + (d.costTotal || 0), 0);

        // 30-day: sum all 30 days of history + today
        const monthCost = (todayCost || 0) + series.reduce((s, d) => s + (d.costTotal || 0), 0);

        setCostPeriods({ today: todayCost, yesterday: yesterdayCost, week: weekCost, month: monthCost });
      } catch (e) {
        console.error('Cost fetch error:', e);
      }
    })();
  }, []);

  // ── Categorize activities ──
  const categorized = useMemo(() => {
    const result = { user: [], developer: [], routine: [] };
    const stats  = { user: { count: 0, timeSaved: 0, cost: 0 }, developer: { count: 0, timeSaved: 0, cost: 0 }, routine: { count: 0, timeSaved: 0, cost: 0 } };
    const sorted = [...activities].sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
    for (const a of sorted) {
      let matched = false;
      for (const [key, cat] of Object.entries(CATEGORIES)) {
        if (cat.match(a)) {
          result[key].push(a);
          stats[key].count++;
          stats[key].timeSaved += a.timeSavedMin || 0;
          stats[key].cost += Number(a.costUsd) || 0;
          matched = true;
          break;
        }
      }
      if (!matched) { result.routine.push(a); stats.routine.count++; stats.routine.cost += Number(a.costUsd) || 0; }
    }
    return { lists: result, stats };
  }, [activities]);

  const daysLabel = days === 1 ? 'Today' : `Last ${days} days`;

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div className="tab-content active">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="section-title">🗄️ Activity Database</div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
            Anthropic API (ground truth) · PostgreSQL · Real-time
          </p>
        </div>
      </div>

      {/* Top tab nav */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border)', marginBottom: 20 }}>
        {TOP_TABS.map(tab => {
          const isActive = topTab === tab.key;
          return (
            <button key={tab.key} onClick={() => setTopTab(tab.key)}
              style={{
                padding: '10px 22px', border: 'none',
                borderBottom: isActive ? '3px solid #4f8cff' : '3px solid transparent',
                background: isActive ? 'var(--bg-hover)' : 'transparent',
                color: isActive ? '#4f8cff' : 'var(--text-secondary)',
                fontWeight: isActive ? 700 : 500, fontSize: 14, cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ══ ACTIVITIES PANE ═══════════════════════════════════════════════ */}
      {topTab === 'activities' && (
        <div>
          {/* ── Cost period cards ── */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <CostCard label="Today" cost={costPeriods.today} isActive={days === 1} onClick={() => { setDays(1); setExpandedId(null); }} />
            <CostCard label="Yesterday" cost={costPeriods.yesterday} isActive={false} onClick={() => {}} displayOnly />
            <CostCard label="Last 7 Days" cost={costPeriods.week} isActive={days === 7} onClick={() => { setDays(7); setExpandedId(null); }} />
            <CostCard label="Last 30 Days" cost={costPeriods.month} isActive={days === 30} onClick={() => { setDays(30); setExpandedId(null); }} />
          </div>
          <div style={{
            fontSize: 12, color: '#c8922a', marginBottom: 16, marginTop: -8,
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(232,168,56,0.08)', border: '1px solid rgba(232,168,56,0.25)',
            borderRadius: 7, padding: '6px 12px',
          }}>
            <span style={{ fontSize: 14 }}>⚠️</span>
            <span><strong>Top cards</strong> = Anthropic API ground truth. <strong>Per-task costs (Est. Cost *)</strong> = agent estimates — they will not match.</span>
          </div>

          {/* ── Loading / Error ── */}
          {loading && (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
              <div style={{ color: 'var(--text-secondary)' }}>Loading…</div>
            </div>
          )}
          {error && (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔴</div>
              <div style={{ fontWeight: 600 }}>{error}</div>
              <button onClick={loadActivities} className="btn" style={{ marginTop: 16 }}>↻ Retry</button>
            </div>
          )}

          {!loading && !error && (
            <>
              {/* ── Summary bar ── */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                <div className="card" style={{ flex: 1, minWidth: 120, padding: '12px 16px', background: 'rgba(232,168,56,0.08)', border: '1px solid rgba(232,168,56,0.3)' }}>
                  <div style={{ fontSize: 11, color: '#e8a838', fontWeight: 700, textTransform: 'uppercase' }}>⭐ Ed's Tasks</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#e8a838' }}>{categorized.stats.user.count}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--orange)', marginTop: 2 }}>${fmtUsd(categorized.stats.user.cost)}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1, fontStyle: 'italic' }}>~estimate</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{categorized.stats.user.timeSaved > 0 ? `${categorized.stats.user.timeSaved} min saved` : daysLabel}</div>
                </div>
                <div className="card" style={{ flex: 1, minWidth: 120, padding: '12px 16px' }}>
                  <div style={{ fontSize: 11, color: '#888', fontWeight: 700, textTransform: 'uppercase' }}>🔄 Routine</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{categorized.stats.routine.count}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--orange)', marginTop: 2 }}>${fmtUsd(categorized.stats.routine.cost)}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1, fontStyle: 'italic' }}>~estimate</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Background tasks</div>
                </div>
                <div className="card" style={{ flex: 1, minWidth: 120, padding: '12px 16px' }}>
                  <div style={{ fontSize: 11, color: '#4f8cff', fontWeight: 700, textTransform: 'uppercase' }}>🛠️ Dev (Ron & Jewel)</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#4f8cff' }}>{categorized.stats.developer.count}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--orange)', marginTop: 2 }}>${fmtUsd(categorized.stats.developer.cost)}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1, fontStyle: 'italic' }}>~estimate</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Developer tasks</div>
                </div>
                <div className="card" style={{ flex: 1, minWidth: 120, padding: '12px 16px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>📊 Total</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{activities.length}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--orange)', marginTop: 2 }}>${fmtUsd(categorized.stats.user.cost + categorized.stats.routine.cost + categorized.stats.developer.cost)}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1, fontStyle: 'italic' }}>~estimate</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{daysLabel}</div>
                </div>
              </div>

              {/* ── Category sub-tabs ── */}
              <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border)' }}>
                {Object.entries(CATEGORIES).map(([key, cat]) => {
                  const isActive = activeCategory === key;
                  const s = categorized.stats[key];
                  return (
                    <button key={key}
                      onClick={() => { setActiveCategory(key); setExpandedId(null); }}
                      style={{
                        padding: '10px 20px', border: 'none',
                        borderBottom: isActive ? `3px solid ${cat.color}` : '3px solid transparent',
                        background: isActive ? 'var(--bg-hover)' : 'transparent',
                        color: isActive ? cat.color : 'var(--text-secondary)',
                        fontWeight: isActive ? 700 : 500, fontSize: 14, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                      <span>{cat.icon}</span> {cat.label}
                      <span style={{
                        fontSize: 11, padding: '1px 7px', borderRadius: 10,
                        background: isActive ? cat.color : 'var(--bg-card)',
                        color: isActive ? '#fff' : 'var(--text-muted)', fontWeight: 600,
                      }}>{s.count}</span>
                    </button>
                  );
                })}
              </div>

              {/* ── Category header + list ── */}
              <div className="card" style={{ marginTop: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0, marginBottom: 24 }}>
                <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>{CATEGORIES[activeCategory].icon}</span>
                  <div style={{ fontSize: 15, fontWeight: 700, color: CATEGORIES[activeCategory].color }}>
                    {CATEGORIES[activeCategory].title}
                  </div>
                  <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)' }}>
                    {categorized.stats[activeCategory].count} tasks
                    {categorized.stats[activeCategory].timeSaved > 0 && ` · ${categorized.stats[activeCategory].timeSaved} min saved`}
                  </div>
                </div>
                <CategoryList
                  activities={categorized.lists[activeCategory]}
                  expandedId={expandedId}
                  setExpandedId={setExpandedId}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* ══ CONVERSATIONS PANE ═══════════════════════════════════════════ */}
      {topTab === 'conversations' && <ConversationsPane days={days < 7 ? 7 : days} />}

      {/* ══ TASKS PANE ═══════════════════════════════════════════════════ */}
      {topTab === 'tasks' && <TasksPane />}
    </div>
  );
}
