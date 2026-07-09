import { useState } from 'react';
import { useContacts, toggleBlacklist } from '../../hooks/useContacts';

export default function BlacklistTab() {
  const { contacts, loading, refresh } = useContacts({ blacklisted: true, limit: 500 });
  const [restoring, setRestoring] = useState(null);

  async function handleRestore(contact) {
    setRestoring(contact.id);
    try { await toggleBlacklist(contact.id, false); refresh(); }
    catch (e) { alert(`Restore failed: ${e.message}`); }
    finally { setRestoring(null); }
  }

  return (
    <div className="tab-content active">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>Blacklist</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{loading ? 'Loading…' : `${contacts.length} blacklisted`}</div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'rgba(239,68,68,0.06)', borderBottom: '1px solid rgba(239,68,68,0.2)' }}>
              {['Company','Name','Email','Agent','Campaign','Action'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: h==='Action' ? 'center' : 'left', color: '#EF4444', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contacts.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '8px 14px', color: 'var(--text-primary)', fontWeight: 600 }}>{c.company || '—'}</td>
                <td style={{ padding: '8px 14px', color: 'var(--text-secondary)' }}>{c.contact_name || '—'}</td>
                <td style={{ padding: '8px 14px', color: 'var(--text-muted)', fontSize: 11 }}>{c.email || '—'}</td>
                <td style={{ padding: '8px 14px' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: c.agent === 'darren' ? '#F59E0B' : '#06E5EC', textTransform: 'uppercase' }}>{c.agent}</span>
                </td>
                <td style={{ padding: '8px 14px', color: 'var(--text-muted)', fontSize: 11 }}>{c.campaign || '—'}</td>
                <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                  <button onClick={() => handleRestore(c)} disabled={restoring === c.id}
                    style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#22C55E', fontWeight: 600 }}>
                    {restoring === c.id ? '…' : 'Restore'}
                  </button>
                </td>
              </tr>
            ))}
            {!loading && contacts.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Blacklist is empty.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
