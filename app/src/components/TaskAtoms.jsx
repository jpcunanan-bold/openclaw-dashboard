import { getPriorityClass, getStatusClass, getStatusIcon, getDecisionBadgeClass,
         getDomainClass, getDueDateInfo, getAgeDotClass, fmtNumber, fmtUsd } from '../utils/helpers';

// ── Priority Dot + Label ─────────────────────────────────────────────────────
export function PriorityDot({ priority }) {
  const cls = getPriorityClass(priority);
  return (
    <>
      <span className={`priority-dot ${cls}`} />
      <span className={`priority-label ${cls}`}>{priority || 'Low'}</span>
    </>
  );
}

// ── Status Badge ─────────────────────────────────────────────────────────────
export function StatusBadge({ status }) {
  const cls = getStatusClass(status);
  const icon = getStatusIcon(status);
  return <span className={`status-badge ${cls}`}>{icon} {status || 'Pending'}</span>;
}

// ── Decision Badge ───────────────────────────────────────────────────────────
export function DecisionBadge({ value }) {
  const cls = getDecisionBadgeClass(value);
  return <span className={`decision-badge ${cls}`}>{value || '—'}</span>;
}

// ── Domain Tag ───────────────────────────────────────────────────────────────
export function DomainTag({ domain }) {
  const cls = getDomainClass(domain);
  return <span className={`domain-tag ${cls}`}>{domain || 'Bold'}</span>;
}

// ── Due Date ─────────────────────────────────────────────────────────────────
export function DueDate({ dateStr }) {
  const { cls, label, warning } = getDueDateInfo(dateStr);
  return <span className={`due-date ${cls}`}>{label}{warning ? ' ⚠' : ''}</span>;
}

// ── Age Dot ──────────────────────────────────────────────────────────────────
export function AgeDot({ dueDate }) {
  const cls = getAgeDotClass(dueDate);
  if (!cls) return null;
  return <span className={`age-dot ${cls}`} />;
}

// ── Expandable Task Detail Panel ─────────────────────────────────────────────
export function TaskDetailPanel({ task, costEntry }) {
  if (!task) return null;
  const fields = [
    { label: 'Task ID', value: task.id || '—' },
    { label: 'Owner', value: task.owner || '—' },
    { label: 'Status', value: task.statusRaw || task.status || '—' },
    { label: 'Domain', value: task.domain || '—' },
    { label: 'Due Date', value: task.dueDate || 'TBD' },
    { label: 'Priority', value: task.priorityRaw || task.priority || '—' },
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
        {costEntry && (
          <>
            <div className="detail-divider" />
            <div className="detail-field">
              <div className="detail-label">💰 Cost</div>
              <div className="detail-value" style={{ color: 'var(--orange)', fontWeight: 600 }}>${fmtUsd(costEntry.costUsd)}</div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Tokens</div>
              <div className="detail-value">{fmtNumber(costEntry.totalTokens)}</div>
            </div>
            <div className="detail-field">
              <div className="detail-label">Model</div>
              <div className="detail-value" style={{ fontSize: 12 }}>{(costEntry.model || '').replace('anthropic/', '').replace('google/', '')}</div>
            </div>
            {costEntry.timeSavedMin > 0 && (
              <div className="detail-field">
                <div className="detail-label">Time Saved</div>
                <div className="detail-value">{costEntry.timeSavedMin} min</div>
              </div>
            )}
          </>
        )}
        {task.notes && (
          <>
            <div className="detail-divider" />
            <div className="detail-field detail-full">
              <div className="detail-label">Notes</div>
              <div className="detail-value notes-full">{task.notes}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
