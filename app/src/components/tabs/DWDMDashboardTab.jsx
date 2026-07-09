import { useState, useEffect } from 'react';
const DARREN_COLOR = '#F59E0B';

const KPI_ICONS = {
  'Unique Companies':            '🏢',
  'Total Contacts':              '👥',
  'Verified Emails (✅ Accepted)':'✅',
  'Touch 1 Sent':                '1️⃣',
  'Touch 2 Sent':                '2️⃣',
  'Touch 3 Sent':                '3️⃣',
  'Touch 4 Sent':                '4️⃣',
  'Touch 5 Sent':                '5️⃣',
  'Calls Scheduled':             '📞',
  'No Touch Yet':                '⏳',
  'Hold / No further outreach':  '🚫',
};

export default function DWDMDashboardTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('cc_auth_token') || localStorage.getItem('authToken') || '';
    fetch('/api/darren/dwdm-dashboard', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); setError(null); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  const kpis = data?.kpis || {};
  const notes = kpis['Notes'] || '';
  const displayKpis = Object.entries(kpis).filter(([k]) => k !== 'Notes');

  return (
    <div style={{ padding: '24px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: DARREN_COLOR }}>📡 DWDM Dashboard</h2>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
            {data?.lastUpdated ? `Last updated: ${data.lastUpdated} UTC` : 'Loading…'}
          </div>
        </div>
      </div>

      {error && (
        <div style={{ color: '#EF4444', padding: '32px', textAlign: 'center', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, marginBottom: 20 }}>
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', padding: 40 }}>Loading KPIs…</div>
      ) : (
        <>
          {/* KPI Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12, marginBottom: 24 }}>
            {displayKpis.map(([k, v]) => (
              <div key={k} style={{
                background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)',
                borderRadius: 12, padding: '14px 16px',
              }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: DARREN_COLOR }}>{v}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
                  {KPI_ICONS[k] || '📊'} {k}
                </div>
              </div>
            ))}
          </div>

          {/* Progress bars for touches */}
          {kpis['Total Contacts'] && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>Touch Penetration</div>
              {['Touch 1 Sent','Touch 2 Sent','Touch 3 Sent','Touch 4 Sent','Touch 5 Sent'].map((k, i) => {
                const sent = parseInt(kpis[k] || 0);
                const total = parseInt(kpis['Total Contacts'] || 1);
                const pct = Math.min(100, Math.round(sent / total * 100));
                const colors = ['#10b981','#0ea5e9','#8b5cf6','#06e5ec','#f59e0b'];
                return (
                  <div key={k} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>
                      <span>T{i+1} — {k.replace(' Sent','')}</span>
                      <span style={{ color: colors[i], fontWeight: 700 }}>{sent} ({pct}%)</span>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 4, height: 6 }}>
                      <div style={{ width: `${pct}%`, background: colors[i], borderRadius: 4, height: '100%', transition: 'width 0.5s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Notes */}
          {notes && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 18px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>📝 Notes</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{notes}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
