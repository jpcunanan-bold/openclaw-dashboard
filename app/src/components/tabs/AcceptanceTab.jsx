import { useState } from 'react';
import { PriorityDot, DomainTag, DecisionBadge } from '../TaskAtoms';

function AcceptanceRow({ r }) {
  const [expanded, setExpanded] = useState(false);
  const isPending = !r.edDecision || r.edDecision.trim() === '' || r.edDecision === '—';
  return (
    <>
      <tr
        className={`task-row${expanded ? ' expanded' : ''}`}
        onClick={() => setExpanded((v) => !v)}
        style={isPending ? { background: 'rgba(6,229,236,0.04)' } : {}}
      >
        <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text-secondary)' }}>{r.date || '—'}</td>
        <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.source || '—'}</td>
        <td style={{ fontWeight: 600, fontSize: 13 }}>{r.task || '—'}</td>
        <td><DomainTag domain={r.domain} /></td>
        <td><PriorityDot priority={r.priorityRaw || r.priority} /></td>
        <td><DecisionBadge value={isPending ? 'PENDING' : r.edDecision} /></td>
      </tr>
      {expanded && (
        <tr className="detail-row visible">
          <td colSpan={6}>
            <div className="detail-panel">
              <div className="detail-grid">
                {r.lauraStep && <div className="detail-field detail-full"><div className="detail-label">Laura Suggestion</div><div className="detail-value">{r.lauraStep}</div></div>}
                {r.edDecision && r.edDecision !== '—' && <div className="detail-field detail-full"><div className="detail-label">Ed Decision</div><div className="detail-value">{r.edDecision}</div></div>}
                {r.edNextStep && <div className="detail-field detail-full"><div className="detail-label">Ed Notes / Next Step</div><div className="detail-value notes-full">{r.edNextStep}</div></div>}
                <div className="detail-field"><div className="detail-label">Proposed Due</div><div className="detail-value">{r.proposedDue || '—'}</div></div>
                <div className="detail-field"><div className="detail-label">Assignee</div><div className="detail-value">{r.lauraAssignee || '—'}</div></div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function AcceptanceTab({ acceptance }) {
  const [showAll, setShowAll] = useState(false);

  const pending = (acceptance || []).filter(r => !r.edDecision || r.edDecision.trim() === '' || r.edDecision === '—');
  const resolved = (acceptance || []).filter(r => r.edDecision && r.edDecision.trim() !== '' && r.edDecision !== '—');
  const recentResolved = resolved.slice(-8).reverse();

  return (
    <div className="tab-content active">
      {/* Pending section */}
      <div className="tasks-section">
        <div className="section-title" style={{ color: '#06E5EC' }}>
          ⚡ Awaiting Ed Decision ({pending.length})
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          Laura detected these tasks — ready for your ACCEPT / REVISE / REJECT.
        </p>
        {pending.length === 0 ? (
          <div className="tasks-table-wrap"><div className="empty-state">All caught up — no pending items.</div></div>
        ) : (
          <div className="tasks-table-wrap">
            <table>
              <thead>
                <tr><th>Date</th><th>Source</th><th>Task</th><th>Domain</th><th>Priority</th><th>Status</th></tr>
              </thead>
              <tbody>{pending.map((r, i) => <AcceptanceRow key={i} r={r} />)}</tbody>
            </table>
          </div>
        )}
      </div>

      {/* Resolved section */}
      <div className="tasks-section">
        <div className="section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Recently Resolved ({resolved.length} total)</span>
          <button onClick={() => setShowAll(v => !v)} style={{ fontSize: 12, background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 10px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            {showAll ? 'Show Less' : 'Show All'}
          </button>
        </div>
        <div className="tasks-table-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr><th>Date</th><th>Source</th><th>Task</th><th>Domain</th><th>Priority</th><th>Decision</th></tr>
            </thead>
            <tbody>
              {(showAll ? [...resolved].reverse() : recentResolved).map((r, i) => <AcceptanceRow key={i} r={r} />)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
