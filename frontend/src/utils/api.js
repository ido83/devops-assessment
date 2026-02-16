const API_BASE = process.env.REACT_APP_API_URL || '/api';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res;
}

export const api = {
  list: () => request('/assessments').then(r => r.json()),
  get: (id) => request(`/assessments/${id}`).then(r => r.json()),
  create: (data) => request('/assessments', { method: 'POST', body: JSON.stringify(data) }).then(r => r.json()),
  update: (id, data) => request(`/assessments/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then(r => r.json()),
  delete: (id) => request(`/assessments/${id}`, { method: 'DELETE' }).then(r => r.json()),

  importJSON: (data) => request('/import/json', { method: 'POST', body: JSON.stringify({ data }) }).then(r => r.json()),
  importFile: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/import/json`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error('Import failed');
    return res.json();
  },

  exportExcelUrl: (id) => `${API_BASE}/export/excel/${id}`,
};
