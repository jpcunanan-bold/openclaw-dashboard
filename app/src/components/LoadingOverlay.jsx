export default function LoadingOverlay() {
  return (
    <div id="loading-overlay">
      <div className="spinner" />
      <div className="loading-text">Loading Laura Dashboard...</div>
      <div className="loading-sub">Fetching live data from Google Sheets</div>
    </div>
  );
}
