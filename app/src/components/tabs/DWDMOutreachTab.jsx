import { useState, useEffect } from 'react';

const DARREN_COLOR = '#F59E0B';

const CHANNEL_BADGE = {
  'Email':        { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa', icon: '✉️' },
  'LinkedIn':     { bg: 'rgba(10,102,194,0.15)', color: '#93bbf5', icon: '💼' },
  'LinkedIn DM':  { bg: 'rgba(10,102,194,0.15)', color: '#93bbf5', icon: '💬' },
};

function ChannelBadge({ channel }) {
  const s = CHANNEL_BADGE[channel] || { bg: 'rgba(255,255,255,0.08)', color: '#ccc', icon: '📨' };
  return (
    <span style={{
      background: s.bg, color: s.color, border: `1px solid ${s.color}33`,
      borderRadius: 6, padding: '3px 9px', fontSize: 11, fontWeight: 700,
    }}>{s.icon} {channel}</span>
  );
}

function TokenChip({ token }) {
  return (
    <span style={{
      background: 'rgba(245,158,11,0.1)', color: DARREN_COLOR,
      border: '1px solid rgba(245,158,11,0.25)', borderRadius: 4,
      padding: '2px 7px', fontSize: 11, fontWeight: 600, fontFamily: 'monospace',
    }}>{token.trim()}</span>
  );
}

function TouchCard({ touch, idx, isOpen, onToggle }) {
  const tokens = (touch.tokens || '').split(',').filter(Boolean);
  return (
    <div style={{
      background: isOpen ? 'rgba(245,158,11,0.05)' : 'rgba(255,255,255,0.02)',
      border: `1px solid ${isOpen ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.08)'}`,
      borderRadius: 12, overflow: 'hidden', transition: 'border 0.15s',
    }}>
      {/* Header row */}
      <div
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        {/* Touch number */}
        <div style={{
          minWidth: 34, height: 34, borderRadius: '50%', display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15,
          background: `rgba(245,158,11,0.15)`, color: DARREN_COLOR, border: `1px solid rgba(245,158,11,0.3)`,
        }}>T{touch.touch}</div>

        {/* Day */}
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', minWidth: 48 }}>{touch.day}</div>

        {/* Channel */}
        <ChannelBadge channel={touch.channel} />

        {/* Persona */}
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', flex: '0 0 auto' }}>
          👤 {touch.persona}
        </div>

        {/* Subject */}
        <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {touch.subject}
        </div>

        {/* Expand chevron */}
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</div>
      </div>

      {/* Expanded body */}
      {isOpen && (
        <div style={{ padding: '0 18px 18px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {/* Subject / Hook */}
          <div style={{ marginTop: 14, marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>Subject / Hook</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: DARREN_COLOR }}>{touch.subject}</div>
          </div>

          {/* Message copy */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>Message Copy</div>
            <pre style={{
              margin: 0, fontFamily: 'inherit', fontSize: 13, lineHeight: 1.65,
              color: 'rgba(255,255,255,0.82)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              background: 'rgba(0,0,0,0.18)', borderRadius: 8, padding: '12px 14px',
              border: '1px solid rgba(255,255,255,0.06)',
            }}>{touch.message}</pre>
          </div>

          {/* Tokens row */}
          {tokens.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Personalization Tokens</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {tokens.map(t => <TokenChip key={t} token={t} />)}
              </div>
            </div>
          )}

          {/* Notes */}
          {touch.notes && (
            <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 7, fontSize: 12, color: 'rgba(255,255,255,0.5)', borderLeft: `3px solid rgba(245,158,11,0.4)` }}>
              📝 {touch.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DWDMOutreachTab() {
  const [touches, setTouches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openIdx, setOpenIdx] = useState(0); // open first card by default

  useEffect(() => {
    const token = localStorage.getItem('cc_auth_token') || localStorage.getItem('authToken') || '';
    fetch('/api/darren/dwdm-outreach', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setTouches(d.touches || []); setLoading(false); setError(null); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  const totalTouches = touches.length;
  const channels = [...new Set(touches.map(t => t.channel))];

  return (
    <div style={{ padding: '24px 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: DARREN_COLOR }}>📡 DWDM Outreach Plan</h2>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>Email + LinkedIn sequence — 30 days</div>
        </div>
        {!loading && (
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '6px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: DARREN_COLOR }}>{totalTouches}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1 }}>Touches</div>
            </div>
            {channels.map(ch => (
              <div key={ch} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '6px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'rgba(255,255,255,0.7)' }}>
                  {touches.filter(t => t.channel === ch).length}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 0.8 }}>{ch}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div style={{ color: '#EF4444', padding: '32px', textAlign: 'center', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, marginBottom: 20 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Touch cards */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', padding: 40 }}>Loading outreach plan…</div>
      ) : touches.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', padding: 40 }}>No outreach plan data found in sheet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {touches.map((t, i) => (
            <TouchCard
              key={i} touch={t} idx={i}
              isOpen={openIdx === i}
              onToggle={() => setOpenIdx(openIdx === i ? null : i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
