import { useState, useEffect } from 'react';
import { authHeaders } from './LoginGate';

// Warm leads pulled from MEMORY.md — contacts with scheduled calls or active monitoring
const WARM_LEADS = [
  { name: 'Michael Monette',    company: 'Total Office Solutions', status: 'monitoring',  note: 'Abhinanda monitoring — reply pending', urgency: 'high' },
  { name: 'Chris Good',         company: 'One Workplace',          status: 'scheduled',   note: 'Call scheduled',                       urgency: 'warm' },
  { name: 'Carla Williams',     company: 'Elements',               status: 'scheduled',   note: 'Call scheduled',                       urgency: 'warm' },
  { name: 'Heather Parauka',    company: 'Workscape Designs',      status: 'scheduled',   note: 'Call scheduled',                       urgency: 'warm' },
  { name: 'John Baran',         company: 'Workscape Designs',      status: 'scheduled',   note: 'Call scheduled',                       urgency: 'warm' },
  { name: 'Director of Design', company: 'Benhar Office Interiors',status: 'scheduled',   note: 'Call scheduled 4/9',                   urgency: 'warm' },
];

const URGENCY_STYLE = {
  high:      { color: '#EF4444', label: 'High'      },
  warm:      { color: '#F59E0B', label: 'Warm'      },
  scheduled: { color: '#06E5EC', label: 'Scheduled' },
  replied:   { color: '#10B981', label: 'Replied'   },
  monitoring:{ color: '#A78BFA', label: 'Monitor'   },
};

function UrgencyBadge({ urgency }) {
  const s = URGENCY_STYLE[urgency] || URGENCY_STYLE.warm;
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
      background: `${s.color}18`, border: `1px solid ${s.color}40`, color: s.color,
      textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>
      {s.label}
    </span>
  );
}

export default function ClientComms() {
  const [recentReplies, setRecentReplies]   = useState([]);
  const [loadingReplies, setLoadingReplies] = useState(true);

  // Pull recent reply/response activities from activity feed for live context
  useEffect(() => {
    fetch('/api/agent-activities?agent_id=laura-abhi-agent&days=14&limit=20', { headers: authHeaders() })
      .then(r => r.ok ? r.json() : { activities: [] })
      .then(d => {
        const replies = (d.activities || []).filter(a =>
          /reply|replied|response|responded|warm|monette|interested/i.test(a.title || '')
        ).slice(0, 4);
        setRecentReplies(replies);
        setLoadingReplies(false);
      })
      .catch(() => setLoadingReplies(false));
  }, []);

  const needsFollowUp = WARM_LEADS.filter(l => l.urgency === 'high' || l.status === 'monitoring').length;

  return (
    <div className="card" style={{ height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          📬 Client Comms
        </span>
        <span style={{
          fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
          background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#34D399',
        }}>
          Live Gmail
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          {WARM_LEADS.length} tracked
        </span>
      </div>

      {/* Warm leads list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14, maxHeight: 220, overflowY: 'auto' }}>
        {WARM_LEADS.map((lead, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
            borderRadius: 8, background: 'rgba(255,255,255,0.02)',
            border: lead.urgency === 'high' ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(255,255,255,0.05)',
          }}>
            {/* Avatar initials */}
            <div style={{
              width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
              background: lead.urgency === 'high' ? 'rgba(239,68,68,0.15)' : 'rgba(6,229,236,0.1)',
              border: `1px solid ${lead.urgency === 'high' ? 'rgba(239,68,68,0.3)' : 'rgba(6,229,236,0.2)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 800, color: lead.urgency === 'high' ? '#EF4444' : '#06E5EC',
            }}>
              {lead.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {lead.name}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {lead.company} · {lead.note}
              </div>
            </div>

            <UrgencyBadge urgency={lead.urgency} />
          </div>
        ))}
      </div>

      {/* Recent reply activity */}
      {!loadingReplies && recentReplies.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Recent Reply Activity
          </div>
          {recentReplies.map((a, i) => (
            <div key={i} style={{
              display: 'flex', gap: 8, padding: '5px 0',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', marginTop: 5, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', flex: 1 }}>{a.title}</span>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {needsFollowUp > 0 ? (
          <span style={{ fontSize: 10, color: '#F59E0B', fontWeight: 600 }}>
            ⚠️ {needsFollowUp} contact{needsFollowUp > 1 ? 's' : ''} need attention
          </span>
        ) : (
          <span style={{ fontSize: 10, color: '#10B981', fontWeight: 600 }}>
            All warm leads being monitored ✓
          </span>
        )}
        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>Monitored by Laura</span>
      </div>
    </div>
  );
}
