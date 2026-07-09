import { useState, useEffect } from 'react';
const DARREN_COLOR = '#F59E0B';

function isHeading(text) { return /^[🏗️📊⚡🔴🟡🟢🔵🏆🎯💡]/u.test(text) || /^[A-Z\s&]+$/.test(text.trim()); }

export default function DCExecutiveSummaryTab() {
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('cc_auth_token') || localStorage.getItem('authToken') || '';
    fetch('/api/darren/dc-executive-summary', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setLines(d.lines || []); setLoading(false); setError(null); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  return (
    <div style={{ padding: '24px 0' }}>
      <h2 style={{ margin: '0 0 20px', fontSize: 22, fontWeight: 700, color: DARREN_COLOR }}>🏗️ DC Executive Summary</h2>
      {error && (
        <div style={{ color: '#EF4444', padding: '32px', textAlign: 'center', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, marginBottom: 20 }}>
          ⚠️ {error}
        </div>
      )}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', padding: 40 }}>Loading summary…</div>
      ) : (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '20px 24px', maxWidth: 900 }}>
          {lines.map((l, i) => {
            if (!l.text && !l.value) return null;
            const isH = isHeading(l.text);
            return (
              <div key={i} style={{
                marginBottom: isH ? 14 : 4,
                marginTop: isH && i > 0 ? 18 : 0,
              }}>
                {isH ? (
                  <div style={{ fontSize: 14, fontWeight: 700, color: DARREN_COLOR, borderBottom: '1px solid rgba(245,158,11,0.2)', paddingBottom: 6 }}>{l.text}</div>
                ) : (
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.7, paddingLeft: 12, borderLeft: '2px solid rgba(255,255,255,0.06)' }}>
                    {l.text}{l.value ? <span style={{ color: 'rgba(255,255,255,0.45)' }}> — {l.value}</span> : ''}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
