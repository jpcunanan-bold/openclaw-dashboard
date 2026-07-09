import { useState } from 'react';

const ROUTINES = [
  {
    id: 'blacklist-audit',
    title: 'Blacklist Audit',
    icon: '🛡️',
    color: '#EF4444',
    status: 'active',
    schedule: 'Every session · Start of day',
    watching: ['DO NOT REACH OUT list', 'Company blacklist', 'OfficeScapes / Elements aliases'],
    channel: 'Google Chat',
    description: 'Before any outreach, Laura checks all recipients against the master blacklist. Blocked contacts are automatically excluded from campaigns. Any new blacklist entries trigger an immediate alert.',
  },
  {
    id: 'inbox-sweep',
    title: 'Warm Lead Monitor',
    icon: '📬',
    color: '#06E5EC',
    status: 'active',
    schedule: 'Every heartbeat · ~5 min',
    watching: ['Michael Monette (TOS)', 'Gmail thread 19dbb56532bae50c', 'Reply signals'],
    channel: 'Google Chat → Abhinanda',
    description: 'Watches the Gmail thread with Michael Monette at Total Office Solutions. If a new reply arrives (beyond msg ID 19dbb5ca4513865a), Abhinanda is notified immediately. Laura does NOT reply — Abhinanda handles directly.',
  },
  {
    id: 'lead-gen',
    title: 'Daily Lead Gen (CET)',
    icon: '🔍',
    color: '#10B981',
    status: 'active',
    schedule: 'On request · Daily target: 5',
    watching: ['CET Designers hiring signals', 'Apollo + LinkedIn', 'Laura\'s Lead Generation Sheet'],
    channel: 'Google Sheets',
    description: 'Finds 5 companies per day actively hiring CET Designers. For each, identifies C-suite, VPs, directors, and hiring managers. Adds all contacts to the CET Designers tab in Laura\'s Lead Generation spreadsheet.',
  },
  {
    id: 'followup',
    title: 'Outreach Sequencer',
    icon: '📤',
    color: '#F59E0B',
    status: 'active',
    schedule: 'On request · Draft-first',
    watching: ['Touch 1–4 pipeline', 'Multilead campaign queue', 'Approval gate (TOOLS.md)'],
    channel: 'Gmail + Multilead → Approval',
    description: 'Drafts outreach emails and LinkedIn messages for each touch in the pipeline. Every send requires explicit approval from Abhinanda, Lenore, or Alex before execution. Never sends without logged approval.',
  },
  {
    id: 'send-gate',
    title: 'Send Gate Enforcement',
    icon: '🔒',
    color: '#A78BFA',
    status: 'active',
    schedule: 'Every send attempt · Non-negotiable',
    watching: ['send_approvals.md', 'Draft files', 'Operator approval log'],
    channel: 'Internal log',
    description: 'Every outreach batch must pass: (1) blacklist check, (2) draft file exists, (3) PENDING entry in logs/send_approvals.md, (4) explicit "approved" from Abhinanda/Lenore/Alex. No exceptions regardless of volume.',
  },
];

function RoutineModal({ routine, onClose }) {
  if (!routine) return null;
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-card)', borderRadius: 16, maxWidth: 500, width: '100%',
        border: `1px solid var(--border)`, borderTop: `3px solid ${routine.color}`, padding: 24,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>{routine.icon}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{routine.title}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>ID: {routine.id}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18 }}>✕</button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Schedule</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{routine.schedule}</div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Watching</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {routine.watching.map(w => (
              <span key={w} style={{
                fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 20,
                background: `${routine.color}15`, border: `1px solid ${routine.color}35`, color: routine.color,
              }}>
                {w}
              </span>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Alert Channel</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>→ {routine.channel}</div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>How it works</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{routine.description}</div>
        </div>
      </div>
    </div>
  );
}

export default function DailyRoutinesPanel() {
  const [selected, setSelected] = useState(null);
  const activeCount = ROUTINES.filter(r => r.status === 'active').length;

  return (
    <>
      <div className="card" style={{ height: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            ⏰ Daily Routines
          </span>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
            background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#34D399',
          }}>
            {activeCount} active
          </span>
        </div>

        {/* Routine rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {ROUTINES.map(r => (
            <button
              key={r.id}
              onClick={() => setSelected(r)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 10px',
                borderRadius: 8, cursor: 'pointer', textAlign: 'left', width: '100%',
                background: 'rgba(255,255,255,0.02)', border: 'none',
                borderLeft: `3px solid ${r.color}`,
                transition: 'background 0.15s',
              }}
            >
              <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{r.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{r.title}</span>
                  <span style={{
                    fontSize: 8, fontWeight: 700, padding: '1px 6px', borderRadius: 20,
                    background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#34D399',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>
                    {r.status}
                  </span>
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{r.schedule}</div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>
                  Watching: {r.watching.slice(0, 2).join(', ')}{r.watching.length > 2 ? '…' : ''}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>
                  Alerts → {r.channel}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <RoutineModal routine={selected} onClose={() => setSelected(null)} />
    </>
  );
}
