export default function DetailDrawer({ row, columns, open, onClose, accentColor = '#F59E0B' }) {
  if (!open || !row) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 999,
        }}
      />

      {/* Drawer Panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: 480,
          height: '100vh',
          background: '#1a1a2e',
          borderLeft: `1px solid ${accentColor}40`,
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-4px 0 12px rgba(0,0,0,0.5)',
          animation: 'slideIn 200ms ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${accentColor}40`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
            {row.contact_name || row.company || 'Details'}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: 20,
              color: 'var(--text-muted)',
              padding: '4px 8px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 24px',
          }}
        >
          {columns.map((col) => {
            const val = row[col.key];
            let displayVal = null;
            let element = null;

            if (col.isLinkedin && val) {
              element = (
                <a href={val} target="_blank" rel="noreferrer" style={{ color: '#0EA5E9', textDecoration: 'none', wordBreak: 'break-all' }}>
                  {val} ↗
                </a>
              );
            } else if (col.key === 'email' && val) {
              element = (
                <a href={`mailto:${val}`} style={{ color: '#0EA5E9', textDecoration: 'none', wordBreak: 'break-all' }}>
                  {val}
                </a>
              );
            } else if (col.isTouchCol) {
              const sent = val && /sent|✓|yes/i.test(val);
              element = (
                <span
                  style={{
                    display: 'inline-block',
                    background: sent ? '#10B981' : '#6B7280',
                    color: '#fff',
                    padding: '4px 12px',
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {sent ? '✓ Sent' : '○ Not Sent'}
                </span>
              );
            } else if (col.isResponse) {
              const has = val && val !== 'No Response' && val !== 'Pending' && val !== 'No' && val.trim() !== '';
              element = (
                <span
                  style={{
                    display: 'inline-block',
                    background: has ? accentColor : '#6B7280',
                    color: '#fff',
                    padding: '4px 12px',
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {has ? '✓ Responded' : '○ No Response'}
                </span>
              );
            } else if (val) {
              displayVal = String(val);
              element = <span style={{ wordWrap: 'break-word', whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>{displayVal}</span>;
            } else {
              element = <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>;
            }

            return (
              <div key={col.key} style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: accentColor, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {col.label}
                </label>
                <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                  {element}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
}
