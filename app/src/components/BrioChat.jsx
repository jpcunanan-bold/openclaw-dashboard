import { useState, useEffect, useRef } from 'react';
import { authHeaders } from './LoginGate';

function getSessionId() {
  let sid = sessionStorage.getItem('laura_chat_session');
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem('laura_chat_session', sid);
  }
  return sid;
}

function fmtTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export default function LauraChat({ taskRef, taskContext, isOpen, onToggle }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [activeTaskRef, setActiveTaskRef] = useState(taskRef);
  const [unreadCount, setUnreadCount] = useState(0);
  const sessionId = useRef(getSessionId());
  const bottomRef = useRef(null);
  // Refs for poll timestamps — avoids re-registering intervals on every new message
  const threadSinceRef = useRef('1970-01-01T00:00:00Z');
  const globalSinceRef = useRef('1970-01-01T00:00:00Z');
  const threadErrCountRef = useRef(0);
  const globalErrCountRef = useRef(0);

  // When taskRef prop changes, switch thread: clear messages and reset since
  useEffect(() => {
    setActiveTaskRef(taskRef);
    setMessages([]);
    // Start from 24h ago to load recent history without loading all-time history
    const since24h = new Date(Date.now() - 86400000).toISOString();
    threadSinceRef.current = since24h;
  }, [taskRef]);

  // Merge incoming messages — dedup by id, replace optimistic entries
  const mergeMessages = (prev, incoming) => {
    try {
      const map = new Map(prev.filter(m => m && m.id != null).map(m => [String(m.id), m]));
      for (const m of incoming) {
        if (!m || m.id == null) continue;
        // Remove matching optimistic message (same text + sender)
        const optKey = [...map.keys()].find(k =>
          typeof k === 'string' && k.startsWith('opt-') &&
          map.get(k)?.message === m.message && map.get(k)?.sender === m.sender
        );
        if (optKey) map.delete(optKey);
        map.set(String(m.id), m);
      }
      return [...map.values()].sort((a, b) => {
        const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return ta - tb;
      });
    } catch (e) {
      // Fallback: just return prev + incoming, let duplicates show rather than crash
      return [...prev, ...incoming];
    }
  };

  // Per-task thread poll (only when open and a task is selected)
  useEffect(() => {
    if (!isOpen || !activeTaskRef) return;

    threadErrCountRef.current = 0;

    const fetchMessages = async () => {
      if (threadErrCountRef.current >= 5) return; // stop after 5 consecutive errors
      try {
        const r = await fetch(
          `/api/chat/messages?taskRef=${encodeURIComponent(activeTaskRef)}&since=${encodeURIComponent(threadSinceRef.current)}`,
          { headers: authHeaders() }
        );
        if (!r.ok) {
          threadErrCountRef.current++;
          return;
        }
        threadErrCountRef.current = 0;
        const data = await r.json();
        if (data.messages && data.messages.length > 0) {
          setMessages(prev => mergeMessages(prev, data.messages));
          threadSinceRef.current = data.messages[data.messages.length - 1].timestamp;
        }
      } catch (e) {
        threadErrCountRef.current++;
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [isOpen, activeTaskRef]);

  // Global unread badge poll when widget is closed
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      return;
    }

    globalErrCountRef.current = 0;

    const pollGlobal = async () => {
      if (globalErrCountRef.current >= 5) return; // stop after 5 consecutive errors
      try {
        const r = await fetch(
          `/api/chat/messages?since=${encodeURIComponent(globalSinceRef.current)}`,
          { headers: authHeaders() }
        );
        if (!r.ok) { globalErrCountRef.current++; return; }
        globalErrCountRef.current = 0;
        const data = await r.json();
        if (data.messages && data.messages.length > 0) {
          const lauraMsgs = data.messages.filter(m => m.sender === 'laura');
          if (lauraMsgs.length > 0) {
            setUnreadCount(prev => prev + lauraMsgs.length);
          }
          globalSinceRef.current = data.messages[data.messages.length - 1].timestamp;
        }
      } catch (e) {
        globalErrCountRef.current++;
      }
    };

    const interval = setInterval(pollGlobal, 8000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending || !activeTaskRef) return;
    setSending(true);
    setInput('');
    try {
      await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          sessionId: sessionId.current,
          taskRef: activeTaskRef,
          message: text,
          taskContext: taskContext || undefined,
        }),
      });
      const optimistic = {
        id: `opt-${Date.now()}`,
        sender: 'ed',
        taskRef: activeTaskRef,
        message: text,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, optimistic]);
    } catch (e) {
      console.error('[LauraChat] sendMessage failed:', e);
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, fontFamily: 'inherit' }}>
      {!isOpen ? (
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <button
            onClick={onToggle}
            style={{
              background: 'linear-gradient(135deg, #003BDF, #06E5EC)',
              color: '#fff',
              border: 'none',
              borderRadius: 24,
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 0 16px rgba(6,229,236,0.5), 0 4px 12px rgba(0,59,223,0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'box-shadow 0.2s',
            }}
          >
            💬 Chat with Laura
          </button>
          {unreadCount > 0 && (
            <div style={{
              position: 'absolute',
              top: -6,
              right: -6,
              background: '#ef4444',
              color: '#fff',
              borderRadius: '50%',
              width: 20,
              height: 20,
              fontSize: 11,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid #0a0e1a',
              pointerEvents: 'none',
            }}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </div>
          )}
        </div>
      ) : (
        <div style={{
          width: 380,
          height: 520,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 24px rgba(6,229,236,0.2)',
          background: '#0a0e1a',
          border: '1px solid rgba(6,229,236,0.25)',
        }}>
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #003BDF, #001654)',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>💬 Chat with Laura</span>
            <button onClick={onToggle} style={{
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0,
            }}>×</button>
          </div>

          {/* Task context banner */}
          {activeTaskRef && (
            <div style={{
              background: 'rgba(6,229,236,0.12)',
              borderBottom: '1px solid rgba(6,229,236,0.25)',
              padding: '6px 14px',
              fontSize: 12,
              color: '#06E5EC',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span>Talking about: <strong>{activeTaskRef}</strong></span>
            </div>
          )}

          {/* Message thread */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}>
            {!activeTaskRef ? (
              <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 60, padding: '0 20px', lineHeight: 1.6 }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>📋</div>
                <div>Expand any task on the board and click</div>
                <div style={{ color: '#06E5EC', marginTop: 4 }}>"💬 Chat Laura about this task"</div>
                <div style={{ marginTop: 8 }}>to start a conversation about it.</div>
              </div>
            ) : messages.length === 0 ? (
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, textAlign: 'center', marginTop: 40 }}>
                Start a conversation with Laura about <strong style={{ color: 'rgba(255,255,255,0.5)' }}>{activeTaskRef}</strong>
              </div>
            ) : null}
            {messages.map((m) => {
              const isEd = m.sender === 'ed';
              return (
                <div key={m.id} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isEd ? 'flex-end' : 'flex-start',
                }}>
                  <div style={{
                    background: isEd ? '#06E5EC' : '#001654',
                    color: isEd ? '#0a0e1a' : '#fff',
                    borderRadius: isEd ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                    padding: '8px 12px',
                    fontSize: 13,
                    maxWidth: '80%',
                    lineHeight: 1.4,
                    border: isEd ? 'none' : '1px solid rgba(6,229,236,0.2)',
                  }}>
                    {m.message}
                  </div>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>
                    {fmtTime(m.timestamp)}
                  </span>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.08)',
            padding: '10px 12px',
            display: 'flex',
            gap: 8,
            background: '#0d1120',
          }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={activeTaskRef ? 'Message Laura...' : 'Select a task to chat...'}
              disabled={sending || !activeTaskRef}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8,
                padding: '8px 12px',
                color: '#fff',
                fontSize: 13,
                outline: 'none',
                opacity: activeTaskRef ? 1 : 0.5,
              }}
            />
            <button
              onClick={sendMessage}
              disabled={sending || !input.trim() || !activeTaskRef}
              style={{
                background: input.trim() && !sending && activeTaskRef ? '#003BDF' : 'rgba(0,59,223,0.4)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '8px 14px',
                fontSize: 13,
                fontWeight: 600,
                cursor: input.trim() && !sending && activeTaskRef ? 'pointer' : 'not-allowed',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => { if (input.trim() && !sending && activeTaskRef) { e.target.style.background = '#06E5EC'; e.target.style.color = '#0a0e1a'; } }}
              onMouseLeave={(e) => { e.target.style.background = input.trim() && !sending && activeTaskRef ? '#003BDF' : 'rgba(0,59,223,0.4)'; e.target.style.color = '#fff'; }}
            >
              Send
            </button>
          </div>

          {/* Footer note */}
          <div style={{
            padding: '4px 14px 8px',
            fontSize: 10,
            color: 'rgba(255,255,255,0.25)',
            fontStyle: 'italic',
            textAlign: 'center',
            background: '#0d1120',
          }}>
            Laura will also reply in Google Chat
          </div>
        </div>
      )}
    </div>
  );
}
