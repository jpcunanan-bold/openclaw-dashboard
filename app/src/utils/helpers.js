// ── Utility helpers mirroring the original dashboard.html JS functions ──────

export function parseLocalDate(str) {
  if (!str || str === 'TBD' || str === '') return null;
  const s = String(str).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function formatTimestamp(ts) {
  if (!ts) return 'Unknown';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return String(ts);
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' — ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) +
    ' EST'
  );
}

export function formatShortDate(dateStr) {
  if (!dateStr) return '';
  const d = parseLocalDate(dateStr);
  if (!d) return String(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function sanitizeKey(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

export function getInitials(name) {
  return (name || '')
    .split(/[\s\/\+\-]/)
    .filter((w) => w.length > 0)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

export function fmtNumber(n) {
  const num = Number(n || 0);
  if (isNaN(num)) return '0';
  return Math.round(num).toLocaleString('en-US');
}

export function fmtUsd(n) {
  const num = Number(n || 0);
  if (isNaN(num)) return '0.00';
  return (Math.round(num * 100) / 100).toFixed(2);
}

export function getPriorityClass(priority) {
  const p = (priority || '').toLowerCase();
  if (p.includes('critical')) return 'critical';
  if (p.includes('high')) return 'high';
  if (p.includes('medium') || p === 'med') return 'medium';
  return 'low';
}

export function getStatusClass(statusRaw) {
  const s = (statusRaw || '').toLowerCase().trim();
  if (s.includes('in progress')) return 'in-progress';
  if (s.includes('pending decision') || s.includes('blocked')) return 'pending-decision';
  if (s.includes('pending')) return 'pending';
  if (s.includes('done') || s.includes('complet') || s.includes('signed')) return 'done';
  if (s.includes('on hold')) return 'on-hold';
  if (s.includes('reject')) return 'rejected';
  if (s.includes('fyi')) return 'fyi';
  if (s.includes('scheduled') || s.includes('schedule')) return 'scheduled';
  if (s.includes('routed')) return 'routed';
  if (s.includes('deferred')) return 'deferred';
  return 'pending';
}

export function getStatusIcon(statusRaw) {
  const s = (statusRaw || '').toLowerCase().trim();
  if (s.includes('in progress')) return '●';
  if (s.includes('pending decision') || s.includes('blocked')) return '◆';
  if (s.includes('done') || s.includes('complet') || s.includes('signed')) return '✓';
  if (s.includes('on hold')) return '◻';
  if (s.includes('reject')) return '✗';
  if (s.includes('fyi')) return 'ℹ';
  if (s.includes('scheduled')) return '📅';
  if (s.includes('routed')) return '✓';
  if (s.includes('deferred')) return '⏸';
  return '○';
}

export function getDecisionBadgeClass(val) {
  const v = (val || '').toLowerCase().trim();
  if (v.includes('done') || v.includes('complet')) return 'done';
  if (v.includes('accept')) return 'accept';
  if (v.includes('revise') || v.includes('revis')) return 'revise';
  if (v.includes('reject')) return 'reject';
  if (v.includes('defer')) return 'deferred';
  return 'open';
}

export function getDomainClass(domain) {
  const d = (domain || '').toLowerCase();
  if (d.includes('mercury')) return 'mercury';
  if (d.includes('personal')) return 'personal';
  if (d.includes('pr') || d.includes('kopko')) return 'pr';
  return 'bold';
}

export function getDueDateInfo(dateStr) {
  if (!dateStr || !String(dateStr).trim() || String(dateStr).toLowerCase() === 'tbd') {
    return { cls: 'tbd', label: dateStr || 'TBD', warning: false };
  }
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const due = parseLocalDate(dateStr);
  if (!due) return { cls: 'tbd', label: String(dateStr), warning: false };
  const diff = (due - now) / 86400000;
  const cls = diff < 0 ? 'overdue' : diff <= 3 ? 'soon' : '';
  const label = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return { cls, label, warning: diff < 0 };
}

export function getAgeDotClass(dueDateStr) {
  if (!dueDateStr || dueDateStr === 'TBD' || dueDateStr === '') return null;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const due = parseLocalDate(dueDateStr);
  if (!due) return null;
  const diffDays = Math.round((now - due) / 86400000);
  if (diffDays < 0) return null;
  if (diffDays <= 7) return 'fresh';
  if (diffDays <= 14) return 'aging';
  if (diffDays <= 30) return 'old';
  return 'stale';
}

export function buildFilterClasses(t) {
  const cls = [];
  const s = (t.statusRaw || t.status || '').toLowerCase();
  const p = (t.priorityRaw || t.priority || '').toLowerCase();

  if (s.includes('done') || s.includes('reject') || s.includes('routed')) cls.push('f-completed');
  else if (s.includes('in progress')) cls.push('f-active', 'f-in-progress');
  else if (s.includes('on hold') || s.includes('blocked')) cls.push('f-active');
  else cls.push('f-active', 'f-pending');

  if (p.includes('critical')) cls.push('f-critical');
  if (p.includes('high')) cls.push('f-high');

  if (!s.includes('done') && !s.includes('reject') && !s.includes('routed')) {
    if (t.dueDate && t.dueDate !== 'TBD' && t.dueDate !== '') {
      const now = new Date(); now.setHours(0, 0, 0, 0);
      const due = parseLocalDate(t.dueDate);
      if (due && due < now) cls.push('f-overdue');
    }
  }
  return cls.join(' ');
}

export function computeGroupStats(tasks) {
  let total = tasks.length, done = 0, active = 0, overdue = 0;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  tasks.forEach((t) => {
    const s = (t.statusRaw || t.status || '').toLowerCase();
    if (s.includes('done') || s.includes('reject') || s.includes('routed')) {
      done++;
    } else {
      active++;
      if (t.dueDate && t.dueDate !== 'TBD' && t.dueDate !== '') {
        const due = parseLocalDate(t.dueDate);
        if (due && due < now) overdue++;
      }
    }
  });
  return { total, done, active, overdue };
}
