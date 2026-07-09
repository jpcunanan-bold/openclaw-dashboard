import { useState, useEffect, useRef, useCallback } from 'react';
import { authHeaders } from './LoginGate';

/* ─── Lightweight markdown → safe HTML (no external lib) ─────────────────── */
function renderMarkdown(text) {
  if (!text) return '';
  let html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Code blocks
    .replace(/```[\w]*\n?([\s\S]*?)```/g, '<pre style="background:rgba(0,0,0,0.4);border-radius:6px;padding:10px 12px;overflow-x:auto;font-size:12px;margin:6px 0;border:1px solid rgba(255,255,255,0.1)"><code>$1</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.1);padding:1px 5px;border-radius:3px;font-size:12px">$1</code>')
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Headers
    .replace(/^### (.*?)$/gm, '<div style="font-weight:700;font-size:13px;margin:8px 0 4px;color:#06E5EC">$1</div>')
    .replace(/^## (.*?)$/gm,  '<div style="font-weight:700;font-size:14px;margin:10px 0 4px;color:#06E5EC">$1</div>')
    .replace(/^# (.*?)$/gm,   '<div style="font-weight:700;font-size:15px;margin:10px 0 4px;color:#06E5EC">$1</div>')
    // Bullet lists
    .replace(/^[\-\*] (.*?)$/gm, '<div style="display:flex;gap:6px;margin:2px 0"><span style="color:#06E5EC;flex-shrink:0">•</span><span>$1</span></div>')
    // Numbered lists
    .replace(/^\d+\. (.*?)$/gm, '<div style="display:flex;gap:6px;margin:2px 0"><span style="color:#06E5EC;flex-shrink:0;min-width:16px">→</span><span>$1</span></div>')
    // Horizontal rules
    .replace(/^---+$/gm, '<div style="border-top:1px solid rgba(255,255,255,0.1);margin:8px 0"></div>')
    // Line breaks
    .replace(/\n\n/g, '<div style="height:8px"></div>')
    .replace(/\n/g, '<br/>');
  return html;
}

/* ─── Page-aware suggestion pills ────────────────────────────────────────── */
const SUGGESTIONS = {
  default:        ['What is the status?', 'What should I do next?', 'Any blockers?'],
  DWDM_TASKS:     ['How many touches sent?', 'Who replied?', 'What is Touch 2 status?', 'Next best action?'],
  BEAD:           ['Top BEAD prospects?', 'Which states to prioritize?', 'BEAD hiring signals?'],
  'BEAD Winner':  ['Enrichment status?', 'Emails verified?', 'Who to contact first?'],
  'DC Contacts':  ['Highest priority contacts?', 'Outreach status?', 'GC entry points?'],
  'DC Projects':  ['Top urgency projects?', 'Fiber role demand?', 'Best outreach hook?'],
  'DC Job Demand':['Highest open roles?', 'Critical urgency GCs?', 'Salary benchmarks?'],
  DWDM:           ['Companies with no touch?', 'Tier 1 companies?', 'SMTP verified count?'],
  CET:            ['Companies hiring CET?', 'Reply rate?', 'Who responded?'],
  Estimators:     ['Active sequences?', 'Who to follow up?', 'Estimator opportunities?'],
  laura_dashboard:['Lead gen summary?', 'Pipeline health?', 'Top actions today?'],
  darren_dashboard:['DWDM campaign status?', 'BEAD pipeline?', 'DC outreach progress?'],
  overview:       ['Combined pipeline stats?', 'Cost breakdown?', 'Top wins this week?'],
  analytics:      ['Cost trend this week?', 'Most active agent?', 'Token efficiency?'],
  costs:          ['Highest cost session?', 'Cost vs output?', 'Budget status?'],
  tasks:          ['Pending tasks?', 'Overdue items?', 'What to prioritize?'],
};

function getSuggestions(taskRef) {
  if (!taskRef) return SUGGESTIONS.default;
  return SUGGESTIONS[taskRef] || SUGGESTIONS.default;
}

/* ─── Session ID ─────────────────────────────────────────────────────────── */
function getSessionId() {
  let sid = sessionStorage.getItem('laura_chat_session');
  if (!sid) { sid = crypto.randomUUID(); sessionStorage.setItem('laura_chat_session', sid); }
  return sid;
}

function fmtTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

/* ─── Typing indicator bubble ─────────────────────────────────────────────── */
function TypingBubble({ agentColor = '#06E5EC' }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const hint = elapsed < 5  ? 'Thinking…'
             : elapsed < 15 ? 'Searching memory…'
             : elapsed < 30 ? 'Using tools…'
             : elapsed < 60 ? 'Working on it…'
             : `Still working… (${elapsed}s)`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
      <div style={{
        background: '#001654',
        border: `1px solid ${agentColor}30`,
        borderRadius: '12px 12px 12px 2px',
        padding: '10px 16px',
        display: 'flex',
        gap: 5,
        alignItems: 'center',
      }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: agentColor,
            opacity: 0.8,
            animation: `typingPulse 1.2s ${i * 0.2}s ease-in-out infinite`,
          }} />
        ))}
      </div>
      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', paddingLeft: 4 }}>{hint}</span>
      <style>{`
        @keyframes typingPulse {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

/* ─── Message bubble ──────────────────────────────────────────────────────── */
function MessageBubble({ m, agentColor, agentAvatar, agentLabel }) {
  const isUser = m.sender === 'ed';
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7, flexDirection: isUser ? 'row-reverse' : 'row' }}>
      {/* Agent avatar next to message */}
      {!isUser && (
        <AgentAvatar
          src={agentAvatar}
          alt={agentLabel}
          color={agentColor}
          size={28}
          style={{
            border: `1.5px solid ${agentColor}50`,
            marginBottom: 18,
          }}
        />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
        <div style={{
          background: isUser ? agentColor : '#001654',
          color: isUser ? '#0a0e1a' : '#e8eaf0',
          borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
          padding: '9px 13px',
          fontSize: 13,
          maxWidth: '86%',
          lineHeight: 1.5,
          border: isUser ? 'none' : `1px solid ${agentColor}20`,
          wordBreak: 'break-word',
        }}>
          {isUser
            ? m.message
            : <div dangerouslySetInnerHTML={{ __html: renderMarkdown(m.message) }} />
          }
        </div>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', marginTop: 3 }}>
          {fmtTime(m.timestamp)}
        </span>
      </div>
    </div>
  );
}

/* ─── Main component ──────────────────────────────────────────────────────── */
// Agent ID mapping
const AGENT_IDS = {
  laura:   'laura-abhi-agent',
  darren:  'darren-abhi-agent',
  zara:    'zara-mercuryz-agent',
  camilla: 'camilla-boldbusiness-agent',
  overview: null,
};

// Local same-origin avatars — always try these first (no CORS / network issues)
const LOCAL_AVATARS = {
  'laura-abhi-agent':           '/app/avatars/laura.png',
  'darren-abhi-agent':          '/app/avatars/darren.png',
  'zara-mercuryz-agent':        '/app/avatars/zara.png',
  'camilla-boldbusiness-agent': '/app/avatars/camilla.png',
  overview:                     '/app/avatars/overview.png',
};

// Fallback SVG avatars (used if local PNG also fails)
const FALLBACK_AVATARS = {
  'laura-abhi-agent':           '/app/avatars/laura.svg',
  'darren-abhi-agent':          '/app/avatars/darren.svg',
  'zara-mercuryz-agent':        '/app/avatars/zara.png',
  'camilla-boldbusiness-agent': '/app/avatars/camilla.png',
  overview:                     '/app/avatars/overview.png',
};

/* ─── Avatar image with initials fallback ─────────────────────────────────── */
function AgentAvatar({ src, alt, color, size = 38, style = {} }) {
  const [failed, setFailed] = useState(false);
  const initial = alt ? alt[0].toUpperCase() : '?';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', overflow: 'hidden',
      flexShrink: 0, background: failed ? `${color}22` : '#0a0e1a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      ...style,
    }}>
      {!failed ? (
        <img
          src={src}
          alt={alt}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          onError={() => setFailed(true)}
        />
      ) : (
        <span style={{ color, fontSize: size * 0.42, fontWeight: 800, letterSpacing: -0.5 }}>
          {initial}
        </span>
      )}
    </div>
  );
}

export default function AgentChat({ taskRef, taskContext, isOpen, onToggle, defaultAgent = 'laura' }) {
  const [messages,     setMessages]     = useState([]);
  const [input,        setInput]        = useState('');
  const [sending,      setSending]      = useState(false);
  const [isTyping,     setIsTyping]     = useState(false);
  const [chatError,    setChatError]    = useState(null);
  const [activeTaskRef,setActiveTaskRef]= useState(taskRef);
  const [unreadCount,  setUnreadCount]  = useState(0);
  const [chatAgent,    setChatAgent]    = useState(defaultAgent);
  const [avatarMap,    setAvatarMap]    = useState({}); // agent_id → avatarUrl

  useEffect(() => { setChatAgent(defaultAgent); }, [defaultAgent]);

  // Fetch avatar URLs from agent_registry on mount
  useEffect(() => {
    fetch('/api/agents/avatars')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.ok && data.agents) {
          const m = {};
          for (const [id, info] of Object.entries(data.agents)) {
            m[id] = info.avatarUrl;
          }
          setAvatarMap(m);
        }
      })
      .catch(() => {}); // silent — fallback SVGs take over
  }, []);

  const sessionId        = useRef(getSessionId());
  const bottomRef        = useRef(null);
  const threadSinceRef   = useRef('1970-01-01T00:00:00Z');
  const globalSinceRef   = useRef('1970-01-01T00:00:00Z');
  const threadErrRef     = useRef(0);
  const globalErrRef     = useRef(0);
  const lastMsgCountRef  = useRef(0);

  const AGENT_CHAT_COLORS  = { laura: '#06E5EC', darren: '#F59E0B', zara: '#A855F7', camilla: '#F43F5E', overview: '#8B5CF6' };
  const AGENT_CHAT_LABELS  = { laura: 'Laura', darren: 'Darren', zara: 'Zara', camilla: 'Camilla', overview: 'Overview' };
  const isOverview  = defaultAgent === 'overview' && !['laura','darren','zara','camilla'].includes(chatAgent);
  const resolvedAgent = isOverview ? 'overview' : (AGENT_IDS[chatAgent] ? chatAgent : 'laura');
  const agentColor  = AGENT_CHAT_COLORS[resolvedAgent] || '#06E5EC';

  // Resolve avatar: local same-origin PNG first → DB URL → SVG fallback
  const resolveAvatar = (agent) => {
    const agentId = AGENT_IDS[agent];
    if (agentId && LOCAL_AVATARS[agentId]) return LOCAL_AVATARS[agentId];
    if (agent === 'overview') return LOCAL_AVATARS.overview;
    if (agentId && avatarMap[agentId]) return avatarMap[agentId];
    return FALLBACK_AVATARS[agentId] || FALLBACK_AVATARS[agent] || '/app/avatars/overview.png';
  };
  const agentAvatar = resolveAvatar(resolvedAgent);

  const agentLabel  = AGENT_CHAT_LABELS[resolvedAgent] || resolvedAgent;
  const agentTitle  = chatAgent === 'darren'
    ? 'Darren Stuart · DWDM & BEAD'
    : isOverview
      ? 'Bold Business · Combined Pipeline'
      : 'Laura Petersen · Sales SDR';

  // Reset thread when taskRef changes
  useEffect(() => {
    setActiveTaskRef(taskRef);
    setMessages([]);
    const since24h = new Date(Date.now() - 86400000).toISOString();
    threadSinceRef.current = since24h;
    lastMsgCountRef.current = 0;
  }, [taskRef]);

  const mergeMessages = useCallback((prev, incoming) => {
    try {
      const map = new Map(prev.filter(m => m?.id != null).map(m => [String(m.id), m]));
      for (const m of incoming) {
        if (!m?.id) continue;
        const optKey = [...map.keys()].find(k =>
          k.startsWith('opt-') && map.get(k)?.message === m.message && map.get(k)?.sender === m.sender
        );
        if (optKey) map.delete(optKey);
        map.set(String(m.id), m);
      }
      return [...map.values()].sort((a, b) =>
        new Date(a.timestamp || 0) - new Date(b.timestamp || 0)
      );
    } catch { return [...prev, ...incoming]; }
  }, []);

  // Thread poll
  useEffect(() => {
    if (!isOpen || !activeTaskRef) return;
    threadErrRef.current = 0;
    const controller = new AbortController();

    const poll = async () => {
      try {
        const r = await fetch(
          `/api/chat/messages?taskRef=${encodeURIComponent(activeTaskRef)}&since=${encodeURIComponent(threadSinceRef.current)}`,
          { headers: authHeaders(), signal: controller.signal }
        );
        if (!r.ok) { threadErrRef.current++; if (threadErrRef.current >= 3) setChatError('Connection lost. Retrying…'); return; }
        threadErrRef.current = 0;
        setChatError(null);
        const data = await r.json();
        if (data.messages?.length > 0) {
          setMessages(prev => {
            const merged = mergeMessages(prev, data.messages);
            // If new agent message appeared, stop typing indicator
            const agentMsgs = merged.filter(m => m.sender !== 'ed');
            if (agentMsgs.length > lastMsgCountRef.current) {
              setIsTyping(false);
              lastMsgCountRef.current = agentMsgs.length;
            }
            return merged;
          });
          threadSinceRef.current = data.messages[data.messages.length - 1].timestamp;
        }
      } catch (e) {
        if (e.name === 'AbortError') return;
        threadErrRef.current++;
        if (threadErrRef.current >= 3) setChatError('Connection lost. Retrying…');
      }
    };

    poll();
    const iv = setInterval(poll, 3000);
    return () => { clearInterval(iv); controller.abort(); setChatError(null); setIsTyping(false); };
  }, [isOpen, activeTaskRef, mergeMessages]);

  // Global unread poll when closed
  useEffect(() => {
    if (isOpen) { setUnreadCount(0); return; }
    globalErrRef.current = 0;
    const poll = async () => {
      if (globalErrRef.current >= 5) return;
      try {
        const r = await fetch(`/api/chat/messages?since=${encodeURIComponent(globalSinceRef.current)}`, { headers: authHeaders() });
        if (!r.ok) { globalErrRef.current++; return; }
        globalErrRef.current = 0;
        const data = await r.json();
        if (data.messages?.length > 0) {
          const agentMsgs = data.messages.filter(m => m.sender !== 'ed');
          if (agentMsgs.length > 0) setUnreadCount(n => n + agentMsgs.length);
          globalSinceRef.current = data.messages[data.messages.length - 1].timestamp;
        }
      } catch { globalErrRef.current++; }
    };
    const iv = setInterval(poll, 8000);
    return () => clearInterval(iv);
  }, [isOpen]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const sendMessage = async (text) => {
    const msg = (text || input).trim();
    if (!msg || sending || !activeTaskRef) return;
    setSending(true);
    setInput('');
    setChatError(null);

    const optimistic = {
      id: `opt-${Date.now()}`,
      sender: 'ed',
      taskRef: activeTaskRef,
      message: msg,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);
    setIsTyping(true);

    try {
      const r = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          sessionId: sessionId.current,
          taskRef: activeTaskRef,
          message: msg,
          taskContext: taskContext || undefined,
          agentName: chatAgent,
        }),
      });
      if (!r.ok) {
        setIsTyping(false);
        setChatError(`Message failed (${r.status}). Please try again.`);
        setInput(msg);
      }
    } catch (e) {
      setIsTyping(false);
      setChatError('Could not reach the server. Check your connection.');
      setInput(msg);
    } finally {
      setSending(false);
    }
  };

  const suggestions = getSuggestions(activeTaskRef);

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, fontFamily: 'inherit' }}>
      {/* Pulsing ring keyframes */}
      <style>{`
        @keyframes fabPulse {
          0%   { transform: scale(1);    opacity: 0.7; }
          50%  { transform: scale(1.18); opacity: 0.2; }
          100% { transform: scale(1.34); opacity: 0; }
        }
        @keyframes fabPulse2 {
          0%   { transform: scale(1);    opacity: 0.5; }
          50%  { transform: scale(1.28); opacity: 0.12; }
          100% { transform: scale(1.45); opacity: 0; }
        }
        .fab-btn:hover .fab-avatar-ring {
          box-shadow: 0 0 28px ${agentColor}90, 0 6px 24px rgba(0,0,0,0.6) !important;
          transform: scale(1.05);
        }
      `}</style>

      {!isOpen ? (
        <div style={{ position: 'relative', display: 'inline-block' }}>
          {/* Outer pulsing ring 1 */}
          <div style={{
            position: 'absolute', inset: -4,
            borderRadius: '50%',
            border: `2px solid ${agentColor}`,
            animation: 'fabPulse 2.2s ease-out infinite',
            pointerEvents: 'none',
          }} />
          {/* Outer pulsing ring 2 — offset timing */}
          <div style={{
            position: 'absolute', inset: -4,
            borderRadius: '50%',
            border: `2px solid ${agentColor}`,
            animation: 'fabPulse2 2.2s ease-out 1.1s infinite',
            pointerEvents: 'none',
          }} />

          <button
            className="fab-btn"
            onClick={onToggle}
            title={`Chat with ${agentLabel}`}
            style={{
              background: 'none', border: 'none', padding: 0,
              cursor: 'pointer', position: 'relative',
              display: 'flex', alignItems: 'flex-end', gap: 0,
            }}
          >
            {/* Avatar circle */}
            <AgentAvatar
              src={agentAvatar}
              alt={agentLabel}
              color={agentColor}
              size={62}
              style={{
                border: `2.5px solid ${agentColor}`,
                boxShadow: `0 0 20px ${agentColor}70, 0 4px 16px rgba(0,0,0,0.55)`,
                transition: 'box-shadow 0.25s, transform 0.25s',
              }}
            />
            {/* Chat badge */}
            <div style={{
              position: 'absolute', bottom: 0, right: 0,
              width: 22, height: 22, borderRadius: '50%',
              background: agentColor,
              border: '2px solid #0a0e1a',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, lineHeight: 1,
              boxShadow: `0 0 8px ${agentColor}80`,
            }}>💬</div>
          </button>
          {/* Unread badge */}
          {unreadCount > 0 && (
            <div style={{
              position: 'absolute', top: -4, right: -4,
              background: '#ef4444', color: '#fff', borderRadius: '50%',
              width: 20, height: 20, fontSize: 11, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid #0a0e1a', pointerEvents: 'none',
              zIndex: 1,
            }}>{unreadCount > 9 ? '9+' : unreadCount}</div>
          )}
          {/* Name tooltip on hover */}
          <div style={{
            position: 'absolute', bottom: 68, right: 0,
            background: 'rgba(10,14,26,0.92)', border: `1px solid ${agentColor}40`,
            borderRadius: 8, padding: '5px 10px',
            fontSize: 11, fontWeight: 600, color: agentColor,
            whiteSpace: 'nowrap', pointerEvents: 'none',
            opacity: 0,
            animation: 'none',
          }}
          className="chat-name-tooltip">
            Chat with {agentLabel}
          </div>
        </div>
      ) : (
        <div style={{
          width: 400, height: 560,
          display: 'flex', flexDirection: 'column',
          borderRadius: 14, overflow: 'hidden',
          boxShadow: `0 8px 40px rgba(0,0,0,0.6), 0 0 30px ${agentColor}20`,
          background: '#0a0e1a',
          border: `1px solid ${agentColor}35`,
          transition: 'border-color 0.3s',
        }}>
          {/* Header */}
          <div style={{
            background: `linear-gradient(135deg, ${agentColor === '#F59E0B' ? '#92400e, #78350f' : '#003BDF, #001654'})`,
            padding: '13px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Avatar in header */}
              <AgentAvatar
                src={agentAvatar}
                alt={agentLabel}
                color={agentColor}
                size={38}
                style={{
                  border: `2px solid ${agentColor}60`,
                  boxShadow: `0 0 10px ${agentColor}40`,
                }}
              />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#fff', fontWeight: 700, fontSize: 14, lineHeight: 1 }}>
                    {agentLabel}
                  </span>
                  {/* Online dot */}
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 5px #22c55e' }} />
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.8, padding: '2px 6px', borderRadius: 4, background: `${agentColor}20`, border: `1px solid ${agentColor}40`, color: agentColor }}>
                    ⚡ FULL AGENT
                  </span>
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{agentTitle}</div>
              </div>
            </div>
            <button onClick={onToggle} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 0 }}>×</button>
          </div>

          {/* Task context */}
          {activeTaskRef && (
            <div style={{
              background: `${agentColor}12`, borderBottom: `1px solid ${agentColor}25`,
              padding: '5px 14px', fontSize: 11, color: agentColor,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span>📋</span>
              <span>Context: <strong>{activeTaskRef}</strong></span>
            </div>
          )}

          {/* Error banner */}
          {chatError && (
            <div style={{
              fontSize: 12, color: '#fff', padding: '8px 14px',
              background: 'rgba(239,68,68,0.15)',
              borderBottom: '1px solid rgba(239,68,68,0.3)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              ⚠️ {chatError}
              <button onClick={() => setChatError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 14 }}>×</button>
            </div>
          )}

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 6px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {!activeTaskRef ? (
              <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 60, padding: '0 24px', lineHeight: 1.7 }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>💡</div>
                <div>Open any task or campaign page</div>
                <div>and the chat will focus on that context.</div>
              </div>
            ) : messages.length === 0 && !isTyping ? (
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, textAlign: 'center', marginTop: 40 }}>
                Ask {chatAgent === 'darren' ? 'Darren' : 'Laura'} about <strong style={{ color: 'rgba(255,255,255,0.5)' }}>{activeTaskRef}</strong>
              </div>
            ) : null}

            {messages.map(m => <MessageBubble key={m.id} m={m} agentColor={agentColor} agentAvatar={agentAvatar} agentLabel={agentLabel} />)}
            {isTyping && <TypingBubble agentColor={agentColor} />}
            <div ref={bottomRef} />
          </div>

          {/* Smart suggestion pills */}
          {activeTaskRef && (
            <div style={{
              padding: '6px 12px 4px',
              display: 'flex', gap: 5, flexWrap: 'wrap',
              borderTop: '1px solid rgba(255,255,255,0.06)',
            }}>
              {suggestions.map(s => (
                <button key={s} onClick={() => sendMessage(s)} disabled={sending} style={{
                  background: `${agentColor}12`,
                  border: `1px solid ${agentColor}30`,
                  color: agentColor,
                  borderRadius: 12, padding: '3px 9px',
                  fontSize: 11, cursor: sending ? 'not-allowed' : 'pointer',
                  fontWeight: 500, opacity: sending ? 0.5 : 1,
                  transition: 'background 0.15s',
                }}>{s}</button>
              ))}
            </div>
          )}

          {/* Agent toggle */}
          <div style={{ display: 'flex', gap: 4, padding: '5px 12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {[['laura','Laura','#06E5EC'],['darren','Darren','#F59E0B']].map(([a,label,color]) => (
              <button key={a} onClick={() => setChatAgent(a)} style={{
                padding: '3px 10px', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                background: chatAgent === a ? `${color}18` : 'transparent',
                border: chatAgent === a ? `1px solid ${color}50` : '1px solid rgba(255,255,255,0.08)',
                color: chatAgent === a ? color : 'rgba(255,255,255,0.35)',
                transition: 'all 0.15s',
              }}>{label}</button>
            ))}
          </div>

          {/* Input */}
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.08)',
            padding: '10px 12px',
            display: 'flex', gap: 8,
            background: '#0d1120',
          }}>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }}}
              placeholder={activeTaskRef ? `Ask ${chatAgent === 'darren' ? 'Darren' : 'Laura'}…` : 'Open a task to start chatting…'}
              disabled={sending || !activeTaskRef}
              style={{
                flex: 1, background: 'rgba(255,255,255,0.07)',
                border: `1px solid ${input ? agentColor + '50' : 'rgba(255,255,255,0.12)'}`,
                borderRadius: 8, padding: '8px 12px',
                color: '#fff', fontSize: 13, outline: 'none',
                opacity: activeTaskRef ? 1 : 0.5,
                transition: 'border-color 0.2s',
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={sending || !input.trim() || !activeTaskRef}
              style={{
                background: input.trim() && !sending && activeTaskRef ? agentColor : 'rgba(255,255,255,0.08)',
                color: input.trim() && !sending && activeTaskRef ? '#0a0e1a' : 'rgba(255,255,255,0.3)',
                border: 'none', borderRadius: 8, padding: '8px 14px',
                fontSize: 13, fontWeight: 700,
                cursor: input.trim() && !sending && activeTaskRef ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
              }}
            >
              {sending ? '…' : '↑'}
            </button>
          </div>

          <div style={{ padding: '3px 14px 7px', fontSize: 10, color: 'rgba(255,255,255,0.2)', textAlign: 'center', background: '#0d1120' }}>
            Responses also appear in Google Chat · Powered by Claude
          </div>
        </div>
      )}
    </div>
  );
}
