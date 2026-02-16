import React, { useState, useEffect, useRef } from 'react';
import { api } from '../utils/api';

const Dashboard = ({ onOpen, onNew, toast }) => {
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const fileRef = useRef();

  const load = async () => {
    setLoading(true);
    try { setAssessments(await api.list()); } catch (e) { toast && toast('Failed to load assessments: ' + e.message, 'error'); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete assessment "${name || id}"?`)) return;
    try {
      await api.delete(id);
      toast && toast('Assessment deleted', 'success');
      load();
    } catch (e) { toast && toast('Delete failed: ' + e.message, 'error'); }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      if (file.name.endsWith('.json')) {
        await api.importFile(file);
      } else {
        const text = await file.text();
        await api.importJSON(JSON.parse(text));
      }
      toast && toast('Import successful', 'success');
      load();
    } catch (err) {
      toast && toast('Import failed: ' + err.message, 'error');
    }
    e.target.value = '';
  };

  const handleDuplicate = async (a) => {
    try {
      const full = await api.get(a.id);
      delete full.id;
      full.org_name = (full.org_name || '') + ' (copy)';
      full.status = 'draft';
      await api.create(full);
      toast && toast('Assessment duplicated', 'success');
      load();
    } catch (e) { toast && toast('Duplicate failed: ' + e.message, 'error'); }
  };

  const filtered = assessments.filter(a =>
    !search || (a.org_name + a.assessor_name + a.environment + a.status).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-in">
      <div className="dashboard-header">
        <div>
          <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 32, fontWeight: 400, marginBottom: 4 }}>Assessments</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{assessments.length} total assessment{assessments.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ padding: '10px 16px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontFamily: "'DM Sans', sans-serif", fontSize: 14, outline: 'none', width: 220 }} />
          <button className="btn btn-secondary" onClick={() => fileRef.current?.click()}>↑ Import</button>
          <input ref={fileRef} type="file" accept=".json,.md" style={{ display: 'none' }} onChange={handleImport} />
          <button className="btn btn-primary" onClick={onNew}>+ New Assessment</button>
        </div>
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 48, marginBottom: 16 }}>🛡️</div>
          <h3>No Assessments Yet</h3>
          <p>Create a new assessment or import an existing one to get started.</p>
          <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={onNew}>+ New Assessment</button>
            <button className="btn btn-secondary" onClick={() => fileRef.current?.click()}>↑ Import JSON</button>
          </div>
        </div>
      ) : (
        <div className="assessment-table">
          <table>
            <thead><tr>
              <th>Organization</th><th>Assessor</th><th>Date</th><th>Env</th><th>Score</th><th>Status</th><th>Updated</th><th style={{width:120}}>Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{a.org_name || '—'}</td>
                  <td>{a.assessor_name || '—'}</td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{a.assessment_date || '—'}</td>
                  <td><span className="env-badge">{a.environment}</span></td>
                  <td><span className={`score-pill ${a.score >= 80 ? 'good' : a.score >= 50 ? 'warn' : 'bad'}`}>{a.score}%</span></td>
                  <td><span className={`status-pill ${a.status}`}>{a.status}</span></td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-muted)' }}>
                    {a.updated_at ? new Date(a.updated_at).toLocaleDateString() : '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn-icon" title="Open" onClick={() => onOpen(a.id)}>📂</button>
                      <button className="btn-icon" title="Duplicate" onClick={() => handleDuplicate(a)}>📋</button>
                      <button className="btn-icon danger" title="Delete" onClick={() => handleDelete(a.id, a.org_name)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
export default Dashboard;
