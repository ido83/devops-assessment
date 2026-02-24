/**
 * API client — All backend REST calls.
 * PDF and Excel exports use POST to send diagram images for embedding.
 * Other server exports use GET (open in new tab).
 */
const API_BASE = process.env.REACT_APP_API_URL || '/api';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers }, ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res;
}

/** POST export: sends images, receives binary, triggers download */
async function postExport(path, body, filename) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Export failed');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

export const api = {
  list: () => request('/assessments').then(r => r.json()),
  get: (id) => request(`/assessments/${id}`).then(r => r.json()),
  create: (data) => request('/assessments', { method: 'POST', body: JSON.stringify(data) }).then(r => r.json()),
  update: (id, data) => request(`/assessments/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then(r => r.json()),
  delete: (id) => request(`/assessments/${id}`, { method: 'DELETE' }).then(r => r.json()),
  importJSON: (data) => request('/import/json', { method: 'POST', body: JSON.stringify({ data }) }).then(r => r.json()),
  importFile: async (file) => {
    const fd = new FormData(); fd.append('file', file);
    const res = await fetch(`${API_BASE}/import/json`, { method: 'POST', body: fd });
    if (!res.ok) throw new Error('Import failed'); return res.json();
  },
  truncateAll: () => request('/assessments/truncate-all', { method: 'DELETE' }).then(r => r.json()),
  /** POST exports — send diagram images, receive binary */
  exportPdf: (id, images, orgName, exportSections) => postExport(`/export/pdf/${id}`, { images, exportSections }, (orgName||'report') + '.pdf'),
  exportExcel: (id, images, orgName, exportSections) => postExport(`/export/excel/${id}`, { images, exportSections }, (orgName||'assessment') + '.xlsx'),
  exportZip: (id, images, orgName, exportSections) => postExport(`/export/zip/${id}`, { images, exportSections }, (orgName||'assessment') + '.zip'),
  /** GET exports (no images) */
  exportSqlUrl: (id) => `${API_BASE}/export/sql/${id}`,
  exportXmlUrl: (id) => `${API_BASE}/export/xml/${id}`,
};
