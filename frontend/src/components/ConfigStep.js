import React, { useState } from 'react';
import { frameworkTemplates as builtinTemplates } from '../data/assessmentData';

const TEMPLATE_COLORS = [
  '#6c5ce7','#00cec9','#fd79a8','#ffd166','#ff8c42','#a29bfe',
  '#e17055','#00b894','#0984e3','#e84393','#fdcb6e','#55efc4',
  '#74b9ff','#fab1a0','#636e72','#dfe6e9',
];

const ConfigStep = ({ config, setConfig, toast }) => {
  const customTemplates = config.custom_templates || [];
  const [showEditor, setShowEditor] = useState(false);
  const [editIdx, setEditIdx] = useState(null); // null = new, index = editing
  const [editForm, setEditForm] = useState({ id: '', name: '', description: '', color: '#6c5ce7', filterType: 'all' });
  const [errors, setErrors] = useState({});

  const allTemplates = [
    ...builtinTemplates.map(t => ({ ...t, builtin: true, color: '#6c5ce7' })),
    ...customTemplates.map(t => ({ ...t, builtin: false })),
  ];

  const u = (f, v) => setConfig(prev => ({ ...prev, [f]: v }));

  const openNewTemplate = () => {
    setEditIdx(null);
    setEditForm({ id: '', name: '', description: '', color: TEMPLATE_COLORS[customTemplates.length % TEMPLATE_COLORS.length], filterType: 'all' });
    setErrors({});
    setShowEditor(true);
  };

  const openEditTemplate = (idx) => {
    const t = customTemplates[idx];
    setEditIdx(idx);
    setEditForm({ ...t });
    setErrors({});
    setShowEditor(true);
  };

  const validateTemplate = () => {
    const errs = {};
    const name = editForm.name.trim();
    const id = editForm.id.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    if (!name) errs.name = 'Name is required';
    if (name.length > 60) errs.name = 'Max 60 characters';

    // Check uniqueness
    const allIds = [
      ...builtinTemplates.map(t => t.id),
      ...customTemplates.filter((_, i) => i !== editIdx).map(t => t.id),
    ];
    const allNames = [
      ...builtinTemplates.map(t => t.name.toLowerCase()),
      ...customTemplates.filter((_, i) => i !== editIdx).map(t => t.name.toLowerCase()),
    ];
    if (allIds.includes(id)) errs.name = 'A template with this ID already exists';
    if (allNames.includes(name.toLowerCase())) errs.name = 'A template with this name already exists';
    if (!editForm.description.trim()) errs.description = 'Description is required';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const saveTemplate = () => {
    if (!validateTemplate()) return;
    const name = editForm.name.trim();
    const id = editForm.id.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const tpl = { id, name, description: editForm.description.trim(), color: editForm.color, filterType: editForm.filterType };
    let next;
    if (editIdx !== null) {
      next = customTemplates.map((t, i) => i === editIdx ? tpl : t);
      toast && toast('Template updated', 'success');
    } else {
      next = [...customTemplates, tpl];
      toast && toast('Template created', 'success');
    }
    u('custom_templates', next);
    setShowEditor(false);
  };

  const deleteTemplate = (idx) => {
    if (!window.confirm('Delete this template?')) return;
    const tpl = customTemplates[idx];
    const next = customTemplates.filter((_, i) => i !== idx);
    u('custom_templates', next);
    if (config.template === tpl.id) u('template', 'full');
    toast && toast('Template deleted', 'success');
    setShowEditor(false);
  };

  return (
    <div className="animate-in">
      <div className="section-header"><h2>Assessment Configuration</h2><p>Define the scope and metadata for your assessment.</p></div>
      <div className="config-grid">
        <div className="config-field">
          <label>Organization Name <span style={{color:'var(--severity-critical)'}}>*</span></label>
          <input type="text" placeholder="e.g. Acme Corp" value={config.org_name} onChange={e => u('org_name', e.target.value)} />
        </div>
        <div className="config-field">
          <label>Assessor <span style={{color:'var(--severity-critical)'}}>*</span></label>
          <input type="text" placeholder="e.g. Jane Smith" value={config.assessor_name} onChange={e => u('assessor_name', e.target.value)} />
        </div>
        <div className="config-field">
          <label>Date <span style={{color:'var(--severity-critical)'}}>*</span></label>
          <input type="date" value={config.assessment_date} onChange={e => u('assessment_date', e.target.value)} />
        </div>
        <div className="config-field"><label>Environment</label>
          <select value={config.environment} onChange={e => u('environment', e.target.value)}>
            <option value="production">Production</option><option value="staging">Staging</option>
            <option value="development">Development</option><option value="all">All Environments</option>
          </select>
        </div>
        <div className="config-field full-width"><label>Scope</label>
          <textarea placeholder="Describe systems in scope..." value={config.scope} onChange={e => u('scope', e.target.value)} />
        </div>
      </div>

      <div className="section-header" style={{marginTop: 16}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <h2>Templates</h2>
          <button className="btn btn-primary" onClick={openNewTemplate}>+ New Template</button>
        </div>
      </div>

      <div className="template-grid">
        {allTemplates.map((t, i) => (
          <div key={t.id}
            className={`template-card ${config.template === t.id ? 'selected' : ''}`}
            style={{ borderColor: config.template === t.id ? (t.color || 'var(--accent-primary)') : undefined }}
            onClick={() => u('template', t.id)}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:12,height:12,borderRadius:3,background:t.color||'var(--accent-primary)',flexShrink:0}} />
                <h4>{t.name}</h4>
              </div>
              {!t.builtin && (
                <button className="btn-icon" style={{width:24,height:24,fontSize:11,border:'none'}}
                  onClick={e => { e.stopPropagation(); openEditTemplate(i - builtinTemplates.length); }} title="Edit">✎</button>
              )}
            </div>
            <p>{t.description}</p>
            {t.builtin && <span style={{fontSize:10,color:'var(--text-muted)',fontFamily:"'JetBrains Mono',monospace",marginTop:4,display:'inline-block'}}>BUILT-IN</span>}
          </div>
        ))}
      </div>

      {/* Template Editor Modal */}
      {showEditor && (
        <div className="modal-overlay" onClick={() => setShowEditor(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editIdx !== null ? 'Edit Template' : 'New Template'}</h3>
              <button className="btn-icon" onClick={() => setShowEditor(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="config-field">
                <label>Name <span style={{color:'var(--severity-critical)'}}>*</span></label>
                <input type="text" placeholder="My Custom Template" value={editForm.name}
                  onChange={e => setEditForm(p => ({...p, name: e.target.value}))} />
                {errors.name && <span className="field-error">{errors.name}</span>}
              </div>
              <div className="config-field">
                <label>Description <span style={{color:'var(--severity-critical)'}}>*</span></label>
                <textarea placeholder="What this template focuses on..." value={editForm.description}
                  onChange={e => setEditForm(p => ({...p, description: e.target.value}))} rows={2} />
                {errors.description && <span className="field-error">{errors.description}</span>}
              </div>
              <div className="config-field">
                <label>Filter Type</label>
                <select value={editForm.filterType} onChange={e => setEditForm(p => ({...p, filterType: e.target.value}))}>
                  <option value="all">All Controls</option>
                  <option value="devsecops">DevSecOps Tagged Only</option>
                  <option value="devops">DevOps Tagged Only</option>
                  <option value="critical-high">Critical & High Severity</option>
                  <option value="critical">Critical Only</option>
                </select>
              </div>
              <div className="config-field">
                <label>Color</label>
                <div className="color-picker-grid">
                  {TEMPLATE_COLORS.map(c => (
                    <button key={c} type="button"
                      className={`color-swatch ${editForm.color === c ? 'selected' : ''}`}
                      style={{background: c}}
                      onClick={() => setEditForm(p => ({...p, color: c}))} />
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              {editIdx !== null && (
                <button className="btn btn-ghost" style={{color:'var(--severity-critical)',marginRight:'auto'}}
                  onClick={() => deleteTemplate(editIdx)}>Delete</button>
              )}
              <button className="btn btn-secondary" onClick={() => setShowEditor(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveTemplate}>
                {editIdx !== null ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default ConfigStep;
