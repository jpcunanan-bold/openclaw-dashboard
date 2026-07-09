// ─────────────────────────────────────────────────────────────────────────────
// COMMAND CENTER — Config
//
// The React application now fetches data directly from Google Sheets using 
// Google's public CSV export API (gviz/tq). 
// 
// No Apps Script configuration or secrets are required anymore!
// ─────────────────────────────────────────────────────────────────────────────

// Auto-refresh interval in milliseconds (default: 5 minutes)
export const AUTO_REFRESH_INTERVAL = 300_000;

// Anthropic API usage is now fetched server-side via /api/anthropic/usage
// No secrets in client code.
