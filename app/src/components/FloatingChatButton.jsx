import { useState } from 'react';

const AGENT_COLORS = {
  laura:    '#06E5EC',
  darren:   '#F59E0B',
  zara:     '#f43f5e',
  camilla:  '#eab308',
  overview: '#8B5CF6',
};

const AGENT_AVATARS = {
  laura:    '/app/avatars/laura.png',
  darren:   '/app/avatars/darren.png',
  zara:     '/app/avatars/zara.png',
  camilla:  '/app/avatars/camilla.png',
  overview: '/app/avatars/overview.png',
};

const AGENT_LABELS = {
  laura:    'Laura',
  darren:   'Darren',
  zara:     'Zara',
  camilla:  'Camilla',
  overview: 'Overview',
};

export default function FloatingChatButton({ onClick, unread = 0, activeAgent = 'laura', isOpen = false }) {
  const [imgFailed, setImgFailed] = useState(false);

  const agent  = AGENT_LABELS[activeAgent]  ? activeAgent : 'laura';
  const color  = AGENT_COLORS[agent]  || '#06E5EC';
  const avatar = AGENT_AVATARS[agent] || AGENT_AVATARS.laura;
  const label  = AGENT_LABELS[agent]  || 'Laura';

  return (
    <button
      onClick={onClick}
      title={`Chat with ${label}`}
      style={{
        position: 'fixed', bottom: 20, right: 20, zIndex: 8000,
        width: 68, height: 68, borderRadius: '50%',
        background: `radial-gradient(circle at 35% 35%, ${color}33, #0B0B1E 70%)`,
        border: `2.5px solid ${color}80`,
        boxShadow: isOpen
          ? `0 0 0 5px ${color}25, 0 8px 34px ${color}60`
          : `0 6px 24px ${color}45`,
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 0, overflow: 'hidden',
        transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'scale(1.08)';
        e.currentTarget.style.boxShadow = `0 0 0 5px ${color}30, 0 10px 38px ${color}70`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = isOpen
          ? `0 0 0 5px ${color}25, 0 8px 34px ${color}60`
          : `0 6px 24px ${color}45`;
      }}
    >
      {/* Agent avatar */}
      {!imgFailed ? (
        <img
          src={avatar}
          alt={label}
          onError={() => setImgFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', display: 'block' }}
        />
      ) : (
        /* Fallback: colored initial */
        <span style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1 }}>
          {label[0]}
        </span>
      )}

      {/* Unread badge */}
      {unread > 0 && (
        <span style={{
          position: 'absolute', top: 0, right: 0,
          width: 22, height: 22, borderRadius: '50%',
          background: '#EF4444', border: '2px solid #0B0B1E',
          fontSize: 11, fontWeight: 800, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          lineHeight: 1,
        }}>
          {unread > 9 ? '9+' : unread}
        </span>
      )}

      {/* Pulse ring when open */}
      {isOpen && (
        <span style={{
          position: 'absolute', inset: -5,
          borderRadius: '50%',
          border: `2px solid ${color}50`,
          animation: 'pulse-ring 1.5s ease-out infinite',
          pointerEvents: 'none',
        }} />
      )}
    </button>
  );
}
