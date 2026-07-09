import { useState, useEffect } from 'react';

export function useCampaignCounts() {
  const [counts, setCounts] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('cc_auth_token') || localStorage.getItem('authToken') || '';
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch('/api/contacts/campaign-counts', { headers }).then(r => r.ok ? r.json() : {}),
      fetch('/api/darren/counts', { headers }).then(r => r.ok ? r.json() : {}),
    ]).then(([lauraData, darrenData]) => {
      setCounts({
        // Laura campaigns — keyed by campaign name
        laura: lauraData.laura || {},
        // Darren campaigns from /api/darren/counts
        darren: darrenData.counts || {},
      });
    }).catch(() => setCounts(null));
  }, []);

  return counts;
}
