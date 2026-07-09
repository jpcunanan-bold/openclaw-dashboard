import { useState, useEffect, useCallback, createContext, useContext } from 'react';

// ── Auth context — lets Header read user + handleSignOut without prop drilling ─
export const AuthContext = createContext({ user: null, handleSignOut: () => {} });

const TOKEN_KEY = 'laura_auth_token';
const USER_KEY  = 'laura_auth_user';

export function getAuthToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
export function setAuthToken(t) {
  localStorage.setItem(TOKEN_KEY, t);
  // Also write to legacy keys so all hooks find the token
  localStorage.setItem('cc_auth_token', t);
  localStorage.setItem('authToken', t);
}
export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('cc_auth_token');
  localStorage.removeItem('authToken');
  localStorage.removeItem(USER_KEY);
}
export function authHeaders() {
  const t = getAuthToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

// ── Inject Google GSI script once ────────────────────────────────────────────
function loadGoogleScript(clientId) {
  return new Promise((resolve) => {
    if (window.google?.accounts) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = resolve;
    document.head.appendChild(s);
  });
}

// ── Google One Tap button container ──────────────────────────────────────────
function GoogleSignInButton({ clientId, onSuccess, onError }) {
  useEffect(() => {
    let cancelled = false;
    loadGoogleScript(clientId).then(() => {
      if (cancelled || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          try {
            const res = await fetch('/api/auth/google', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ credential: response.credential }),
            });
            const data = await res.json();
            if (data.ok) {
              onSuccess(data.token, data.user);
            } else {
              onError(data.error || 'Authentication failed');
            }
          } catch (e) {
            onError('Connection error');
          }
        },
        auto_select: false,
      });

      window.google.accounts.id.renderButton(
        document.getElementById('google-signin-btn'),
        {
          theme: 'filled_black',
          size: 'large',
          text: 'signin_with',
          shape: 'pill',
          width: 320,
        }
      );
    });
    return () => { cancelled = true; };
  }, [clientId, onSuccess, onError]);

  return <div id="google-signin-btn" style={{ display: 'flex', justifyContent: 'center' }} />;
}

// ── Main LoginGate ────────────────────────────────────────────────────────────
export default function LoginGate({ children }) {
  const [authMode, setAuthMode]         = useState(null);   // null=loading, 'google', 'token', 'open'
  const [googleClientId, setGoogleClientId] = useState('');
  const [authenticated, setAuthenticated]   = useState(false);
  const [user, setUser]                 = useState(null);
  const [checking, setChecking]         = useState(true);
  const [token, setToken]               = useState('');
  const [error, setError]               = useState('');

  // 1. Fetch auth config from API
  useEffect(() => {
    fetch('/api/auth/config')
      .then(r => r.json())
      .then(cfg => {
        if (!cfg.googleEnabled && !cfg.tokenEnabled) {
          setAuthMode('open');
          setAuthenticated(true);
        } else {
          setAuthMode(cfg.googleEnabled ? 'google' : 'token');
          setGoogleClientId(cfg.googleClientId || '');
        }
      })
      .catch(() => setAuthMode('token')) // fallback
      .finally(() => setChecking(false));
  }, []);

  // 2. Check stored token on load
  useEffect(() => {
    if (authMode === 'open' || authMode === null) return;
    const stored = getAuthToken();
    if (!stored) return;
    fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: stored }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setAuthenticated(true);
          if (d.user) setUser(d.user);
        } else {
          clearAuthToken();
        }
      })
      .catch(() => clearAuthToken());
  }, [authMode]);

  // Google Sign-In success
  const handleGoogleSuccess = useCallback((sessionToken, googleUser) => {
    setAuthToken(sessionToken);
    localStorage.setItem(USER_KEY, JSON.stringify(googleUser));
    setUser(googleUser);
    setAuthenticated(true);
  }, []);

  const handleGoogleError = useCallback((msg) => {
    setError(msg || 'Google sign-in failed');
  }, []);

  // Legacy token submit
  const handleTokenLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (data.ok) {
        setAuthToken(token);
        setAuthenticated(true);
      } else {
        setError('Invalid access code');
      }
    } catch { setError('Connection error'); }
  };

  const handleSignOut = () => {
    clearAuthToken();
    setAuthenticated(false);
    setUser(null);
    if (window.google?.accounts?.id) window.google.accounts.id.disableAutoSelect();
    window.location.reload();
  };

  if (checking || authMode === null) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0f1117', color:'#fff', fontFamily:'Inter,system-ui,sans-serif' }}>
        <div style={{ fontSize: 16, color: '#8b8fa3' }}>Loading…</div>
      </div>
    );
  }

  if (authenticated) {
    return (
      // Provide user + signOut to any child that needs it (e.g. Header)
      <AuthContext.Provider value={{ user, handleSignOut }}>
        {children}
        {/* Sign-out button removed from fixed overlay — now lives in Header */}
      </AuthContext.Provider>
    );
  }

  // ── Login screen ─────────────────────────────────────────────────────────────
  return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'center',
      height:'100vh', background:'#0a0c12', color:'#fff',
      fontFamily:'Inter,system-ui,sans-serif',
      backgroundImage:'radial-gradient(ellipse at 60% 40%, rgba(79,140,255,0.08) 0%, transparent 60%)',
    }}>
      <div style={{
        background:'rgba(26,29,39,0.95)', borderRadius:20, padding:'48px 40px',
        maxWidth:420, width:'100%',
        boxShadow:'0 0 0 1px rgba(255,255,255,0.07), 0 24px 64px rgba(0,0,0,0.5)',
        backdropFilter:'blur(12px)',
      }}>
        {/* Logo / header */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ fontSize:13, fontWeight:700, letterSpacing:2.5, textTransform:'uppercase', color:'#06E5EC', marginBottom:12 }}>
            BOLD BUSINESS
          </div>
          <div style={{ fontSize:24, fontWeight:700, marginBottom:8, letterSpacing:-0.5 }}>
            Outreach Dashboard
          </div>
          <div style={{ fontSize:13, color:'#8b8fa3', lineHeight:1.5 }}>
            Sign in with your Bold Business Google account<br />to access Abhi &amp; Laura's outreach tracker.
          </div>
        </div>

        {/* Google Sign-In */}
        {authMode === 'google' && googleClientId && (
          <>
            <GoogleSignInButton
              clientId={googleClientId}
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
            />
            {error && (
              <div style={{ marginTop:16, padding:'10px 14px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, color:'#fca5a5', fontSize:13, textAlign:'center' }}>
                {error}
              </div>
            )}
            <div style={{ marginTop:20, textAlign:'center', fontSize:11, color:'#4a4d5e' }}>
              Only <strong style={{ color:'#6b7280' }}>@boldbusiness.com</strong> accounts are allowed
            </div>
          </>
        )}

        {/* Google enabled but no client ID yet */}
        {authMode === 'google' && !googleClientId && (
          <div style={{ padding:'16px', background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:10, color:'#fcd34d', fontSize:13, textAlign:'center' }}>
            ⚙️ Google OAuth client ID not yet configured.<br/>
            <span style={{ color:'#9ca3af', fontSize:12 }}>Contact your administrator to complete setup.</span>
          </div>
        )}

        {/* Legacy token fallback */}
        {authMode === 'token' && (
          <form onSubmit={handleTokenLogin}>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Access code"
              autoFocus
              style={{
                width:'100%', padding:'12px 16px', fontSize:15, borderRadius:10,
                border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.04)',
                color:'#fff', outline:'none', boxSizing:'border-box', marginBottom:12,
              }}
            />
            {error && <div style={{ color:'#ff6b6b', fontSize:13, marginBottom:12 }}>{error}</div>}
            <button type="submit" style={{
              width:'100%', padding:'12px 0', fontSize:15, fontWeight:600, borderRadius:10,
              border:'none', background:'linear-gradient(135deg,#3B82F6,#1d4ed8)', color:'#fff', cursor:'pointer',
            }}>
              Sign In
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
