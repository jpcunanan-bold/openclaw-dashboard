import { useState } from 'react';
import { PriorityDot, DueDate, DecisionBadge } from '../TaskAtoms';

function DecisionDetailPanel({ r }) {
  const fields = [
    { label: 'Decision ID', value: r.id || '—' }, { label: 'Priority', value: r.priorityRaw || r.priority || '—' },
    { label: 'Due Date', value: r.dueDate || 'TBD' }, { label: 'Ed Status', value: r.edStatus || '—' },
    { label: 'Ed Decision', value: r.edDecision || '—' }, { label: 'Ed Next Step', value: r.edNextStep || '—' },
  ];
  return (
    <div className="detail-panel">
      <div className="detail-grid">
        {fields.map((f) => (
          <div key={f.label} className="detail-field">
            <div className="detail-label">{f.label}</div>
            <div className="detail-value">{f.value}</div>
          </div>
        ))}
        {r.context && <><div className="detail-divider" /><div className="detail-field detail-full"><div className="detail-label">Full Context</div><div className="detail-value notes-full">{r.context}</div></div></>}
        {r.recommendation && <div className="detail-field detail-full"><div className="detail-label">Laura Recommendation</div><div className="detail-value notes-full">{r.recommendation}</div></div>}
        {r.edNotes && <div className="detail-field detail-full"><div className="detail-label">Ed Notes</div><div className="detail-value notes-full">{r.edNotes}</div></div>}
      </div>
    </div>
  );
}

function DecisionRow({ r }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <tr className="task-row" onClick={() => setExpanded((v) => !v)}>
        <td><PriorityDot priority={r.priorityRaw || r.priority} /></td>
        <td className="task-id">{r.id || '—'}</td>
        <td style={{ fontWeight: 600 }}>{r.decision || '—'}</td>
        <td className="notes-col">{r.context || '—'}</td>
        <td className="notes-col">{r.recommendation || '—'}</td>
        <td><DueDate dateStr={r.dueDate} /></td>
        <td><DecisionBadge value={r.edStatus || 'Open'} /></td>
      </tr>
      {expanded && (
        <tr className="detail-row visible">
          <td colSpan={7}><DecisionDetailPanel r={r} /></td>
        </tr>
      )}
    </>
  );
}

export default function DecisionsTab({ decisions }) {
  return (
    <div className="tab-content active">
      <div className="tasks-section">
        <div className="section-title">Open Decisions Awaiting Ed</div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
          Columns A–F are Laura's context. Ed's action space: Status, Decision, Next Step, Notes.
        </p>
        {(!decisions || decisions.length === 0) ? (
          <div className="tasks-table-wrap"><div className="empty-state">No open decisions.</div></div>
        ) : (
          <div className="tasks-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Priority</th><th>ID</th><th>Decision Needed</th><th>Context</th>
                  <th>Recommendation</th><th>Due Date</th><th>Ed Status</th>
                </tr>
              </thead>
              <tbody>
                {decisions.map((r, i) => <DecisionRow key={i} r={r} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
