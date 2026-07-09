import { useState, useEffect } from 'react';
import { AGENT_CONFIG, agentColor, agentLabel, agentRole, agentInitials } from '../utils/agentConfig';
import { authHeaders } from './LoginGate';

const agents = Object.entries(AGENT_CONFIG);

function AvatarBubble({ id, cfg, selected, onClick, avatarUrl }) {
  const [imgErr, setImgErr] = useState(false);
  const color = cfg.color;
  const isSelected = selected === id;

  return (
    <button
      onClick={() => onClick(isSelected ? null : id)}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        padding: '6px 4px', flexShrink: 0,
      }}
    >
      {/* Circle */}
      <div style={{
        width: 52, height: 52, borderRadius: '50%',
        background: `${color}18`,
        border: `2px solid ${isSelected ? color : color + '55'}`,
        boxShadow: isSelected ? `0 0 0 3px ${color}40` : 'none',
        transition: 'all 0.2s',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {avatarUrl && !imgErr ? (
          <img
            src={avatarUrl}
            alt={cfg.label}
            onError={() => setImgErr(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <span style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1 }}>
            {agentInitials(id)}
          </span>
        )}
        {/* Online dot — show as active for known agents */}
        <span style={{
          position: 'absolute', bottom: 2, right: 2,
          width: 10, height: 10, borderRadius: '50%',
          background: '#10B981',
          border: '2px solid #0B0B1E',
        }} />
      </div>

      {/* Name */}
      <span style={{
        fontSize: 11, fontWeight: 700, color: isSelected ? color : 'var(--text-primary)',
        whiteSpace: 'nowrap', transition: 'color 0.2s',
      }}>
        {cfg.label}
      </span>

      {/* Role badge */}
      <span style={{
        fontSize: 9, fontWeight: 700, padding: '2px 7px',
        borderRadius: 20, whiteSpace: 'nowrap',
        background: `${color}18`,
        border: `1px solid ${color}40`,
        color,
        letterSpacing: '0.03em',
        textTransform: 'uppercase',
      }}>
        {cfg.role}
      </span>
    </button>
  );
}

export default function AgentsRow({ selectedAgent, onSelect }) {
  const [avatars, setAvatars] = useState({});

  useEffect(() => {
    fetch('/api/agents/avatars', { headers: authHeaders() })
      .then(r => r.ok ? r.json() : { agents: {} })
      .then(d => {
        const map = {};
        for (const [id, info] of Object.entries(d.agents || {})) {
          if (info.avatarUrl) map[id] = info.avatarUrl;
        }
        setAvatars(map);
      })
      .catch(() => {});
  }, []);

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 4,
      overflowX: 'auto', padding: '12px 0 8px',
      scrollbarWidth: 'none',
    }}>
      {/* "All" bubble */}
      <button
        onClick={() => onSelect(null)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          padding: '6px 4px', flexShrink: 0,
        }}
      >
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: selectedAgent === null ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.04)',
          border: `2px solid ${selectedAgent === null ? 'var(--purple)' : 'rgba(255,255,255,0.1)'}`,
          boxShadow: selectedAgent === null ? '0 0 0 3px rgba(124,58,237,0.25)' : 'none',
          transition: 'all 0.2s',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22,
        }}>🛠</div>
        <span style={{ fontSize: 11, fontWeight: 700, color: selectedAgent === null ? 'var(--purple-light)' : 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          Fleet
        </span>
        <span style={{
          fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
          background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.3)',
          color: 'var(--purple-light)', textTransform: 'uppercase', letterSpacing: '0.03em',
        }}>
          All agents
        </span>
      </button>

      {agents.map(([id, cfg]) => (
        <AvatarBubble
          key={id}
          id={id}
          cfg={cfg}
          selected={selectedAgent}
          onClick={onSelect}
          avatarUrl={avatars[id]}
        />
      ))}
    </div>
  );
}
