export const AGENT_CONFIG = {
  'lola-boldbusiness-agent':    { color: '#a78bfa', label: 'Lola',    role: 'Client Success',    owner: 'Ed Kopko' },
  'laura-abhi-agent':           { color: '#06E5EC', label: 'Laura',   role: 'Sales Outreach',    owner: 'Abhinanda' },
  'darren-abhi-agent':          { color: '#34d399', label: 'Darren',  role: 'DWDM Outreach',     owner: 'Abhinanda' },
  'ava-marketing-agent':        { color: '#f97316', label: 'Ava',     role: 'Marketing',         owner: 'Bold Business' },
  'zara-mercuryz-agent':        { color: '#f43f5e', label: 'Zara',    role: 'Sales Dev',         owner: 'Mercury Z' },
  'camilla-boldbusiness-agent': { color: '#eab308', label: 'Camilla', role: 'Operations',        owner: 'Bold Business' },
  'brio-ed-agent':              { color: '#3B82F6', label: 'Brio',    role: 'Strategy',          owner: 'Ed Kopko' },
};

export const agentColor  = (id) => AGENT_CONFIG[id]?.color  || '#4f8cff';
export const agentLabel  = (id, fallback) => AGENT_CONFIG[id]?.label  || fallback || id?.split('-')[0] || '?';
export const agentRole   = (id) => AGENT_CONFIG[id]?.role   || 'AI Agent';
export const agentOwner  = (id) => AGENT_CONFIG[id]?.owner  || '';
export const agentInitials = (id) => (agentLabel(id) || '?')[0].toUpperCase();
