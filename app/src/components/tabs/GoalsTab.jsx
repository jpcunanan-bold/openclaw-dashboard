import { useState, useEffect } from 'react';
import { authHeaders } from '../LoginGate';

const STATUS_COLORS = {
  active:   { bg: 'rgba(6,229,236,0.12)',  border: 'rgba(6,229,236,0.3)',  text: '#06E5EC',  label: '● Active'   },
  planning: { bg: 'rgba(176,194,245,0.1)', border: 'rgba(176,194,245,0.3)', text: '#B0C2F5', label: '◎ Planning' },
  paused:   { bg: 'rgba(255,165,0,0.1)',   border: 'rgba(255,165,0,0.3)',   text: '#FFA500',  label: '⏸ Paused'   },
  complete: { bg: 'rgba(123,255,158,0.1)', border: 'rgba(123,255,158,0.3)', text: '#7BFF9E',  label: '✓ Complete'  },
};

const PRIORITY_DOT = { critical: '#FF6B6B', high: '#FFA500', medium: '#B0C2F5' };

const COMPANY_ORDER = ['Bold Business', 'Mercury Z', 'Personal'];
const COMPANY_COLORS = {
  'Bold Business': { accent: '#06E5EC', bg: 'rgba(6,229,236,0.05)' },
  'Mercury Z':     { accent: '#B0C2F5', bg: 'rgba(176,194,245,0.05)' },
  'Personal':      { accent: '#FFD700', bg: 'rgba(255,215,0,0.05)' },
};

function ProgressBar({ pct, color }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 4, height: 6, overflow: 'hidden', marginTop: 8 }}>
      <div style={{
        width: `${Math.min(pct, 100)}%`, height: '100%',
        background: `linear-gradient(90deg, ${color}aa, ${color})`,
        borderRadius: 4, transition: 'width 0.6s ease'
      }} />
    </div>
  );
}

function MilestoneList({ milestones }) {
  return (
    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {milestones.map((m, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12 }}>
          <span style={{ flexShrink: 0, color: m.done ? '#7BFF9E' : 'rgba(255,255,255,0.25)', marginTop: 1 }}>
            {m.done ? '✓' : '○'}
          </span>
          <span style={{ color: m.done ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.7)',
                         textDecoration: m.done ? 'line-through' : 'none', lineHeight: 1.4 }}>
            {m.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function GoalCard({ goal, tasks, onFilter, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const sc = STATUS_COLORS[goal.status] || STATUS_COLORS.active;
  const cc = COMPANY_COLORS[goal.company] || COMPANY_COLORS['Bold Business'];

  // Count tasks that match goal keywords
  const matchedTasks = tasks.filter(t => {
    const haystack = `${t.task || ''} ${t.notes || ''} ${t.domain || ''} ${t.nextAction || ''}`.toLowerCase();
    return goal.taskKeywords?.some(kw => haystack.includes(kw.toLowerCase()));
  });
  const activeTasks   = matchedTasks.filter(t => ['IN PROGRESS','PENDING','BLOCKED'].includes(t.status));
  const blockedTasks  = matchedTasks.filter(t => t.status === 'BLOCKED');
  const doneTasks     = matchedTasks.filter(t => t.status === 'DONE' || t.status === 'COMPLETE');

  return (
    <div style={{
      background: '#1a1d2e', border: `1px solid rgba(255,255,255,0.08)`,
      borderRadius: 14, overflow: 'hidden',
      borderTop: `3px solid ${cc.accent}`,
    }}>
      {/* Header */}
      <div style={{ padding: '20px 22px 16px', cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1 }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>{goal.icon}</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: 0, fontFamily: "'Spline Sans',sans-serif" }}>
                  {goal.title}
                </h3>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 100,
                  background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text
                }}>{sc.label}</span>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: PRIORITY_DOT[goal.priority], flexShrink: 0 }} title={`${goal.priority} priority`} />
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.4 }}>{goal.subtitle}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
            <button onClick={e => { e.stopPropagation(); onEdit && onEdit(goal); }} title="Edit goal"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: 'rgba(255,255,255,0.5)', fontSize: 11, padding: '3px 9px', cursor: 'pointer' }}>
              ✏️ Edit
            </button>
            <button onClick={e => { e.stopPropagation(); onDelete && onDelete(goal.id); }} title="Delete goal"
              style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.2)', borderRadius: 6, color: '#FF6B6B', fontSize: 11, padding: '3px 9px', cursor: 'pointer' }}>
              🗑
            </button>
            <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 14, marginLeft: 4 }}>{expanded ? '▲' : '▼'}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <div style={{ flex: 1 }}>
            <ProgressBar pct={goal.progress} color={cc.accent} />
          </div>
          <span style={{ fontSize: 12, color: cc.accent, fontWeight: 700, flexShrink: 0 }}>{goal.progress}%</span>
        </div>

        {/* Task counts */}
        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
            <span style={{ color: '#06E5EC', fontWeight: 700 }}>{activeTasks.length}</span> active tasks
          </div>
          {blockedTasks.length > 0 && (
            <div style={{ fontSize: 11, color: '#FF6B6B', fontWeight: 600 }}>
              ⚠ {blockedTasks.length} blocked
            </div>
          )}
          {doneTasks.length > 0 && (
            <div style={{ fontSize: 11, color: '#7BFF9E' }}>
              ✓ {doneTasks.length} done
            </div>
          )}
          {goal.targetDate && goal.targetDate !== 'ongoing' && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginLeft: 'auto' }}>
              🎯 {goal.targetDate}
            </div>
          )}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '16px 22px 20px' }}>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, marginBottom: 16 }}>{goal.description}</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Initiatives */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>
                Key Initiatives
              </div>
              {goal.initiatives?.map((init, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 12, color: 'rgba(255,255,255,0.65)', alignItems: 'flex-start' }}>
                  <span style={{ color: cc.accent, flexShrink: 0 }}>▸</span>
                  <span style={{ lineHeight: 1.45 }}>{init}</span>
                </div>
              ))}
            </div>

            {/* Milestones */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>
                Milestones
              </div>
              <MilestoneList milestones={goal.milestones || []} />
            </div>
          </div>

          {/* Key people */}
          {goal.keyPeople?.length > 0 && (
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>Key People:</span>
              {goal.keyPeople.map((p, i) => (
                <span key={i} style={{ fontSize: 11, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 100, padding: '2px 10px', color: 'rgba(255,255,255,0.6)' }}>{p}</span>
              ))}
            </div>
          )}

          {/* View tasks button */}
          {activeTasks.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); onFilter && onFilter(goal); }}
              style={{
                marginTop: 16, padding: '8px 16px', fontSize: 12, fontWeight: 600,
                background: `linear-gradient(135deg, ${cc.accent}22, ${cc.accent}11)`,
                border: `1px solid ${cc.accent}55`, borderRadius: 8, color: cc.accent,
                cursor: 'pointer', letterSpacing: 0.5
              }}
            >
              View {activeTasks.length} Active Tasks →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Goal Edit/Create Modal ─────────────────────────────────────────────── */
const EMPTY_GOAL = {
  company: 'Bold Business', category: 'Growth', priority: 'high', icon: '🎯',
  title: '', subtitle: '', description: '', status: 'planning', progress: 0,
  targetDate: '', initiatives: [], keyPeople: [], taskKeywords: [], milestones: [],
};

function GoalModal({ goal, onClose, onSave }) {
  const isNew = !goal?.id;
  const [form, setForm] = useState(isNew ? EMPTY_GOAL : { ...goal });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setList = (k, v) => setForm(f => ({ ...f, [k]: v.split('\n').filter(Boolean) }));

  const save = async () => {
    if (!form.title.trim()) { setErr('Title is required'); return; }
    setSaving(true);
    try {
      const method = isNew ? 'POST' : 'PUT';
      const url = isNew ? '/api/goals' : `/api/goals/${goal.id}`;
      const r = await fetch(url, { method, headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const d = await r.json();
      if (d.ok) { onSave(d.goal, isNew); onClose(); }
      else setErr(d.error || 'Save failed');
    } catch (e) { setErr(e.message); }
    setSaving(false);
  };

  const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 };
  const modalStyle = { background: '#1a1d2e', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, padding: '28px 32px', width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', position: 'relative' };
  const labelStyle = { fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 6, display: 'block' };
  const inputStyle = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '9px 12px', color: '#fff', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' };
  const fieldGap = { marginBottom: 16 };

  return (
    <div style={overlayStyle} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modalStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{isNew ? '+ New Goal' : 'Edit Goal'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
          <div style={fieldGap}>
            <label style={labelStyle}>Icon (emoji)</label>
            <input style={{ ...inputStyle, width: 60 }} value={form.icon} onChange={e => set('icon', e.target.value)} maxLength={4} />
          </div>
          <div style={fieldGap}>
            <label style={labelStyle}>Priority</label>
            <select style={inputStyle} value={form.priority} onChange={e => set('priority', e.target.value)}>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
            </select>
          </div>
        </div>

        <div style={fieldGap}>
          <label style={labelStyle}>Title *</label>
          <input style={inputStyle} value={form.title} onChange={e => set('title', e.target.value)} placeholder="Goal title..." />
        </div>

        <div style={fieldGap}>
          <label style={labelStyle}>Subtitle</label>
          <input style={inputStyle} value={form.subtitle} onChange={e => set('subtitle', e.target.value)} placeholder="Short tagline..." />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' }}>
          <div style={fieldGap}>
            <label style={labelStyle}>Company</label>
            <select style={inputStyle} value={form.company} onChange={e => set('company', e.target.value)}>
              <option>Bold Business</option>
              <option>Mercury Z</option>
              <option>Personal</option>
            </select>
          </div>
          <div style={fieldGap}>
            <label style={labelStyle}>Status</label>
            <select style={inputStyle} value={form.status} onChange={e => set('status', e.target.value)}>
              <option value="active">Active</option>
              <option value="planning">Planning</option>
              <option value="paused">Paused</option>
              <option value="complete">Complete</option>
            </select>
          </div>
          <div style={fieldGap}>
            <label style={labelStyle}>Progress %</label>
            <input style={inputStyle} type="number" min={0} max={100} value={form.progress} onChange={e => set('progress', Number(e.target.value))} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <div style={fieldGap}>
            <label style={labelStyle}>Category</label>
            <input style={inputStyle} value={form.category} onChange={e => set('category', e.target.value)} placeholder="e.g. Revenue, Operations..." />
          </div>
          <div style={fieldGap}>
            <label style={labelStyle}>Target Date</label>
            <input style={inputStyle} value={form.targetDate} onChange={e => set('targetDate', e.target.value)} placeholder="Q2 2026 or YYYY-MM-DD" />
          </div>
        </div>

        <div style={fieldGap}>
          <label style={labelStyle}>Description</label>
          <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} value={form.description} onChange={e => set('description', e.target.value)} placeholder="What does success look like?" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <div style={fieldGap}>
            <label style={labelStyle}>Key Initiatives (one per line)</label>
            <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} value={form.initiatives.join('\n')} onChange={e => setList('initiatives', e.target.value)} placeholder="Initiative 1&#10;Initiative 2..." />
          </div>
          <div style={fieldGap}>
            <label style={labelStyle}>Key People (one per line)</label>
            <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} value={form.keyPeople.join('\n')} onChange={e => setList('keyPeople', e.target.value)} placeholder="Abhinanda Deb&#10;Ron..." />
          </div>
        </div>

        <div style={fieldGap}>
          <label style={labelStyle}>Task Keywords (one per line) — links tasks to this goal</label>
          <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={form.taskKeywords.join('\n')} onChange={e => setList('taskKeywords', e.target.value)} placeholder="keyword1&#10;keyword2..." />
        </div>

        {err && <div style={{ color: '#FF6B6B', fontSize: 13, marginBottom: 12 }}>⚠ {err}</div>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ padding: '9px 24px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#06E5EC,#003BDF)', color: '#fff', fontWeight: 700, cursor: saving ? 'wait' : 'pointer', fontSize: 13 }}>
            {saving ? 'Saving…' : (isNew ? 'Create Goal' : 'Save Changes')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GoalsTab({ tasks = [], setActiveTab, setMasterFilter }) {
  const [goals, setGoals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterCompany, setFilterCompany] = useState('All');
  const [modalGoal, setModalGoal] = useState(null);   // null = closed, {} = new, goal obj = edit
  const [showModal, setShowModal] = useState(false);

  const loadGoals = () => {
    fetch('/api/goals', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { setGoals(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  };

  useEffect(() => { loadGoals(); }, []);

  const handleGoalFilter = (goal) => {
    if (setMasterFilter) setMasterFilter({ goalKeywords: goal.taskKeywords, goalTitle: goal.title });
    if (setActiveTab) setActiveTab('master');
  };

  const handleSave = (savedGoal, isNew) => {
    setGoals(prev => {
      const list = [...(prev?.goals || [])];
      if (isNew) { list.push(savedGoal); }
      else { const i = list.findIndex(g => g.id === savedGoal.id); if (i >= 0) list[i] = savedGoal; }
      return { ...prev, goals: list };
    });
  };

  const handleDelete = async (goalId) => {
    if (!window.confirm('Delete this goal? This cannot be undone.')) return;
    const r = await fetch(`/api/goals/${goalId}`, { method: 'DELETE', headers: authHeaders() });
    const d = await r.json();
    if (d.ok) setGoals(prev => ({ ...prev, goals: (prev?.goals || []).filter(g => g.id !== goalId) }));
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'rgba(255,255,255,0.4)' }}>
      Loading goals...
    </div>
  );
  if (error) return (
    <div style={{ padding: 32, color: '#FF6B6B' }}>Error loading goals: {error}</div>
  );

  const allGoals = goals?.goals || [];
  const filtered = filterCompany === 'All' ? allGoals : allGoals.filter(g => g.company === filterCompany);
  const grouped = COMPANY_ORDER.reduce((acc, co) => {
    const list = filtered.filter(g => g.company === co);
    if (list.length) acc[co] = list;
    return acc;
  }, {});

  // Summary stats
  const totalActive   = allGoals.filter(g => g.status === 'active').length;
  const avgProgress   = allGoals.length ? Math.round(allGoals.reduce((s, g) => s + g.progress, 0) / allGoals.length) : 0;
  const totalBlocked  = allGoals.reduce((s, g) => {
    const m = tasks.filter(t => g.taskKeywords?.some(kw => `${t.task||''} ${t.notes||''}`.toLowerCase().includes(kw.toLowerCase())));
    return s + m.filter(t => t.status === 'BLOCKED').length;
  }, 0);

  return (
    <div style={{ padding: '24px 32px', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div style={{ width: 4, height: 24, background: 'linear-gradient(180deg,#06E5EC,#003BDF)', borderRadius: 2 }} />
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: 0, fontFamily: "'Spline Sans',sans-serif" }}>
                Goals & Strategy
              </h2>
            </div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
              Bold Business · Mercury Z · Personal — everything connects back to here
            </p>
          </div>
          <button
            onClick={() => { setModalGoal({}); setShowModal(true); }}
            style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#06E5EC,#003BDF)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            + New Goal
          </button>

          {/* Summary pills */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ background: 'rgba(6,229,236,0.1)', border: '1px solid rgba(6,229,236,0.25)', borderRadius: 10, padding: '8px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#06E5EC' }}>{totalActive}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1 }}>Active Goals</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#7BFF9E' }}>{avgProgress}%</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1 }}>Avg Progress</div>
            </div>
            {totalBlocked > 0 && (
              <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.25)', borderRadius: 10, padding: '8px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#FF6B6B' }}>{totalBlocked}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1 }}>Blocked Tasks</div>
              </div>
            )}
          </div>
        </div>

        {/* Company filter */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          {['All', ...COMPANY_ORDER].map(co => {
            const cc = COMPANY_COLORS[co] || {};
            const isActive = filterCompany === co;
            return (
              <button key={co} onClick={() => setFilterCompany(co)} style={{
                padding: '5px 14px', fontSize: 12, fontWeight: 600, borderRadius: 100,
                border: isActive ? `1px solid ${cc.accent || '#06E5EC'}` : '1px solid rgba(255,255,255,0.1)',
                background: isActive ? `${cc.accent || '#06E5EC'}22` : 'transparent',
                color: isActive ? (cc.accent || '#06E5EC') : 'rgba(255,255,255,0.45)',
                cursor: 'pointer', transition: 'all 0.15s'
              }}>{co}</button>
            );
          })}
        </div>
      </div>

      {/* Goal groups */}
      {COMPANY_ORDER.filter(co => grouped[co]).map(co => {
        const cc = COMPANY_COLORS[co];
        return (
          <div key={co} style={{ marginBottom: 36 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 3, height: 18, background: cc.accent, borderRadius: 2 }} />
              <h3 style={{ fontSize: 13, fontWeight: 700, color: cc.accent, margin: 0, textTransform: 'uppercase', letterSpacing: 1.2 }}>{co}</h3>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>{grouped[co].length} goal{grouped[co].length !== 1 ? 's' : ''}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))', gap: 16 }}>
              {grouped[co].map(goal => (
                <GoalCard key={goal.id} goal={goal} tasks={tasks} onFilter={handleGoalFilter}
                  onEdit={g => { setModalGoal(g); setShowModal(true); }}
                  onDelete={handleDelete} />
              ))}
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: 48 }}>No goals found. Click "+ New Goal" to create one.</div>
      )}

      {showModal && (
        <GoalModal
          goal={modalGoal?.id ? modalGoal : null}
          onClose={() => { setShowModal(false); setModalGoal(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
