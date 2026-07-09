/**
 * Laura Message Tracker Plugin  v2.2 (production)
 *
 * Captures every inbound message and outbound agent response at the OpenClaw
 * gateway layer. The agent has ZERO responsibility for this tracking.
 *
 * Hooks:
 *   message_received  → user prompt + session metadata
 *   agent_end         → agent response + token usage (current turn only)
 *   message_sending   → outbound delivery (agent replies to channels)
 *
 * Limitation: `message` tool sends (proactive sends to other spaces) bypass
 * the hook system entirely. Those are tracked via agent_end (the agent's
 * processing is captured, but the delivery target isn't tagged).
 */

const API_URL = 'http://127.0.0.1:3100';
const pendingInbound = new Map<string, string>();

/* ── Helpers ────────────────────────────────────────────────────────────────── */

function extractText(content: any): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((b: any) => b?.type === 'text')
      .map((b: any) => b?.text || '')
      .join('\n')
      .trim();
  }
  return '';
}

function buildSessionKey(meta: any): string {
  const to = meta?.to || meta?.originatingTo || '';
  if (to) return to;
  const provider = meta?.provider || 'unknown';
  const surface = meta?.surface || 'direct';
  return `${provider}:${surface}`;
}

/**
 * Normalize any session key to a canonical format so inbound and outbound match.
 *
 * Inbound:  "googlechat:spaces/79ZuMSAAAAE"  (from metadata.to)
 * Outbound: "agent:main:googlechat:direct:spaces/79zumsaaaae"  (from ctx.sessionKey)
 * Cron:     "agent:main:cron:b576eaa8-..."
 *
 * For chat sessions: extract "spaces/..." and prepend "googlechat:" → consistent key.
 * For cron/system: keep as-is (no space ID to normalize).
 */
function normalizeSessionKey(raw: string): string {
  if (!raw) return 'unknown';

  // Extract space ID and normalize to lowercase for consistency
  const spaceMatch = raw.match(/spaces\/([a-z0-9_-]+)/i);
  if (spaceMatch) {
    return `googlechat:spaces/${spaceMatch[1].toLowerCase()}`;
  }

  // Non-chat sessions (cron, system) — keep as-is
  return raw;
}

async function postMessage(payload: Record<string, unknown>): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json() as { id?: string };
      return data?.id ?? null;
    }
  } catch (err: any) {
    console.error('[laura-tracker] POST error:', err?.message);
  }
  return null;
}

/* ── Plugin ─────────────────────────────────────────────────────────────────── */

export default function register(api: any) {

  // ── Hook 1: message_received ─────────────────────────────────────────────
  // Event: { from, content, timestamp, metadata: { to, provider, surface,
  //   senderId, senderName, senderUsername, ... } }
  api.on('message_received', (event: any) => {
    (async () => {
      try {
        const meta = event?.metadata || {};
        const rawKey = buildSessionKey(meta);
        const sessionKey = normalizeSessionKey(rawKey);
        const userName = meta.senderName || meta.senderUsername || event?.from || 'unknown';
        const channel = meta.provider || meta.originatingChannel || 'unknown';
        const content = event?.content || '';

        const id = await postMessage({
          direction: 'inbound',
          session_key: sessionKey,
          user_name: userName,
          channel,
          content,
          timestamp: event?.timestamp || new Date().toISOString(),
        });

        if (id) {
          pendingInbound.set(sessionKey, id);
        }
      } catch (err: any) {
        console.error('[laura-tracker] message_received error:', err?.message);
      }
    })();
  });

  // ── Hook 2: agent_end ────────────────────────────────────────────────────
  // Event: { messages: [{role, content, model?, usage?}, ...], success, error, durationMs }
  // Usage keys (camelCase): { input, output, cacheRead, cacheWrite, totalTokens, cost }
  api.on('agent_end', (event: any, ctx: any) => {
    (async () => {
      try {
        const msgs = event?.messages || [];

        const lastAssistant = [...msgs].reverse().find((m: any) => m?.role === 'assistant');
        const content = lastAssistant ? extractText(lastAssistant.content) : '';

        let model = '';
        for (const m of [...msgs].reverse()) {
          if (m?.model) { model = m.model; break; }
        }

        // Token usage: only count CURRENT TURN (after last user message)
        let inputTokens = 0, outputTokens = 0, cacheReadTokens = 0, cacheWriteTokens = 0;
        let lastUserIdx = -1;
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i]?.role === 'user') { lastUserIdx = i; break; }
        }
        const startIdx = lastUserIdx >= 0 ? lastUserIdx : 0;
        for (let i = startIdx; i < msgs.length; i++) {
          const u = msgs[i]?.usage;
          if (u) {
            inputTokens      += Number(u.input || u.input_tokens || 0);
            outputTokens     += Number(u.output || u.output_tokens || 0);
            cacheReadTokens  += Number(u.cacheRead || u.cache_read_input_tokens || 0);
            cacheWriteTokens += Number(u.cacheWrite || u.cache_creation_input_tokens || 0);
          }
        }

        // Session key resolution — normalize to match inbound format
        let sessionKey = normalizeSessionKey(ctx?.sessionKey || ctx?.session?.key || '');
        let inboundId: string | null = null;

        if (!sessionKey || sessionKey === 'unknown') {
          // Fallback: grab most recent pending inbound
          if (pendingInbound.size > 0) {
            const entries = [...pendingInbound.entries()];
            const [key, id] = entries[entries.length - 1];
            sessionKey = key;
            inboundId = id;
            pendingInbound.delete(key);
          }
        } else {
          inboundId = pendingInbound.get(sessionKey) || null;
          if (inboundId) pendingInbound.delete(sessionKey);
        }

        await postMessage({
          direction: 'outbound',
          session_key: sessionKey || 'unknown',
          inbound_message_id: inboundId,
          content,
          model,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cache_read_tokens: cacheReadTokens,
          cache_write_tokens: cacheWriteTokens,
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        console.error('[laura-tracker] agent_end error:', err?.message);
      }
    })();
  });

  // ── Hook 3: message_sending — agent reply delivery ───────────────────────
  // Event: { to, content, metadata: { channel, accountId, mediaUrls } }
  // "to" = session target (e.g., "heartbeat", space ID)
  // Fires for agent loop replies delivered to channels. Does NOT fire for
  // `message` tool sends (those go through a separate delivery path).
  api.on('message_sending', (event: any) => {
    (async () => {
      try {
        const text = event?.content || '';
        if (!text) return;

        const meta = event?.metadata || {};
        const to = event?.to || '';
        const channel = meta.channel || 'unknown';

        await postMessage({
          direction: 'delivery',
          session_key: to || 'agent-reply',
          user_name: 'Laura',
          channel,
          content: text,
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        console.error('[laura-tracker] message_sending error:', err?.message);
      }
    })();
  });

  console.log('[laura-tracker] Message tracker plugin v2.3 loaded ✓');
}
