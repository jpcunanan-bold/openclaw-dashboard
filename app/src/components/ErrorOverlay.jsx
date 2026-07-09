export default function ErrorOverlay({ message, onRetry }) {
  return (
    <div id="error-overlay" style={{ display: 'flex' }}>
      <div className="error-icon">⚠️</div>
      <div className="error-title">Connection Error</div>
      <div className="error-msg">{message || 'Unable to load dashboard data.'}</div>
      <button className="retry-btn" onClick={onRetry}>↺ Retry</button>
    </div>
  );
}
