import { LeadData } from '@/types';

export function exportLeadsToCsv(leads: LeadData[], filenamePrefix = 'leads'): void {
  if (!leads || leads.length === 0) return;

  const headers = [
    'Name',
    'Contact Method',
    'Email',
    'Contact Source / URL',
    'Platform',
    'Confidence',
    'Status',
    'Query Strategy',
    'Summary'
  ];

  const escapeCsv = (val?: string | null): string => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = leads.map(l => {
    const isEmail = l.contactMethod === 'email' || Boolean(l.email && l.email.includes('@'));
    const contactMethod = isEmail ? 'email' : 'source-only';
    const emailValue = isEmail && l.email ? l.email : 'N/A (Source Only)';
    const contactSource = l.contactSource || l.profileUrl || '';

    return [
      escapeCsv(l.name),
      escapeCsv(contactMethod),
      escapeCsv(emailValue),
      escapeCsv(contactSource),
      escapeCsv(l.source || 'Web'),
      escapeCsv(l.confidence || 'verified'),
      escapeCsv(l.status || 'draft'),
      escapeCsv(l.queryType || 'N/A'),
      escapeCsv(l.summary || '')
    ].join(',');
  });

  const csvString = [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${filenamePrefix}-${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
