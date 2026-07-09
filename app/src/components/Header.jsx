/**
 * Header — Bold Business Command Center chrome
 * Design: Command Center - Design 1
 */
import { useState, useEffect, useContext } from 'react';
import { AuthContext } from './LoginGate';

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  return (
    <span style={{
      fontSize: 11,
      fontFamily: 'monospace',
      color: '#7E8DB5',
      fontVariantNumeric: 'tabular-nums',
    }}>
      {now.toLocaleString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true,
        timeZone: 'America/New_York',
      })} ET
    </span>
  );
}

function PulseDot() {
  return (
    <span style={{ position: 'relative', width: 8, height: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{
        position: 'absolute', width: 8, height: 8, borderRadius: '50%',
        background: 'rgba(6,229,236,0.4)',
        animation: 'cc-hdr-pulse 2s ease-out infinite',
      }} />
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#06E5EC', display: 'block', position: 'relative', zIndex: 1 }} />
    </span>
  );
}

export default function Header({ onRefresh }) {
  const { user, handleSignOut } = useContext(AuthContext);

  return (
    <>
      <style>{`
        @keyframes cc-hdr-pulse {
          0%   { transform: scale(0.7); opacity: 0.8; }
          80%  { transform: scale(1.8); opacity: 0; }
          100% { transform: scale(1.8); opacity: 0; }
        }
      `}</style>

      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        height: 58,
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '0 24px',
        background: 'rgba(2,8,32,0.88)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        flexShrink: 0,
      }}>

        {/* ── Logo ── */}
        <div>
          <div style={{
            font: '800 15px/1.05 Inter,sans-serif',
            letterSpacing: '-0.2px',
            background: 'linear-gradient(90deg,#fff,#06E5EC)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            BOLD BUSINESS
          </div>
          <div style={{
            font: '700 8px/1 Inter,sans-serif',
            letterSpacing: '0.2em',
            color: '#7E8DB5',
            textTransform: 'uppercase',
            marginTop: 2,
          }}>
            Command Center
          </div>
        </div>

        {/* Separator */}
        <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.10)', flexShrink: 0 }} />

        {/* Live data pill */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '5px 12px', borderRadius: 20,
          background: 'rgba(6,229,236,0.08)',
          border: '1px solid rgba(6,229,236,0.22)',
        }}>
          <PulseDot />
          <span style={{ font: '700 11px/1 Inter,sans-serif', color: '#06E5EC' }}>Live data</span>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* ── Right cluster ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Clock />

          {/* Refresh */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              title="Refresh data"
              style={{
                width: 30, height: 26,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 8,
                background: 'rgba(68,70,219,0.15)',
                border: '1px solid rgba(124,124,245,0.3)',
                color: '#B79CFF', fontSize: 14, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(68,70,219,0.28)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(68,70,219,0.15)'; }}
            >
              ↻
            </button>
          )}

          {/* User avatar */}
          {user && (
            <>
              {user.picture ? (
                <img
                  src={user.picture}
                  alt={user.name || user.email}
                  title={user.email}
                  style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid rgba(124,124,245,0.4)' }}
                />
              ) : (
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'rgba(68,70,219,0.2)', border: '2px solid rgba(124,124,245,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  font: '800 11px/1 Inter,sans-serif', color: '#B79CFF',
                }}>
                  {(user.name || user.email || 'U')[0].toUpperCase()}
                </div>
              )}

              <button
                onClick={handleSignOut}
                style={{
                  font: '600 10px/1 Inter,sans-serif',
                  color: '#7E8DB5',
                  padding: '3px 8px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 6, background: 'none', cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)'; e.currentTarget.style.color = '#EF4444'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#7E8DB5'; }}
              >
                Sign out
              </button>
            </>
          )}
        </div>
      </header>


    </>
  );
}
