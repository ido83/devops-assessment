import React, { useState } from 'react';
import { frameworkTemplates as builtinTemplates, assessmentCategories } from '../data/assessmentData';

const TEMPLATE_COLORS = [
  '#6c5ce7','#00cec9','#fd79a8','#ffd166','#ff8c42','#a29bfe',
  '#e17055','#00b894','#0984e3','#e84393','#fdcb6e','#55efc4',
  '#74b9ff','#fab1a0','#636e72','#dfe6e9',
];

const SEVERITY_OPTIONS = ['critical','high','medium','low'];

const ConfigStep = ({ config, setConfig, toast }) => {
  const customTemplates = config.custom_templates || [];
  const [showEditor, setShowEditor] = useState(false);
  const [editIdx, setEditIdx] = useState(null);
  const [editForm, setEditForm] = useState({ id:'', name:'', description:'', color:'#6c5ce7', filterType:'all', selectedCategories:[], customCategories:[] });
  const [errors, setErrors] = useState({});
  const [fieldTouched, setFieldTouched] = useState({});
  const touch = (field) => setFieldTouched(p => ({...p, [field]: true}));
  const getMandatoryError = (field, value) => {
    if (!fieldTouched[field]) return null;
    if (!value?.trim()) return 'This field is required';
    return null;
  };
  const [newItemForm, setNewItemForm] = useState({ catIdx: null, text: '', severity: 'medium', tags: 'devsecops' });

  const allTemplates = [
    ...builtinTemplates.map(t => ({ ...t, builtin: true, color: '#6c5ce7' })),
    ...customTemplates.map(t => ({ ...t, builtin: false })),
  ];

  const u = (f, v) => setConfig(prev => ({ ...prev, [f]: v }));

  const openNewTemplate = () => {
    setEditIdx(null);
    setEditForm({
      id: '', name: '', description: '',
      color: TEMPLATE_COLORS[customTemplates.length % TEMPLATE_COLORS.length],
      filterType: 'categories',
      selectedCategories: assessmentCategories.map(c => c.id),
      customCategories: [],
    });
    setErrors({});
    setNewItemForm({ catIdx: null, text: '', severity: 'medium', tags: 'devsecops' });
    setShowEditor(true);
  };

  const openEditTemplate = (idx) => {
    const t = customTemplates[idx];
    setEditIdx(idx);
    setEditForm({
      ...t,
      filterType: t.filterType || 'categories',
      selectedCategories: t.selectedCategories || assessmentCategories.map(c => c.id),
      customCategories: t.customCategories || [],
    });
    setErrors({});
    setNewItemForm({ catIdx: null, text: '', severity: 'medium', tags: 'devsecops' });
    setShowEditor(true);
  };

  const toggleCategory = (catId) => {
    setEditForm(p => {
      const sel = p.selectedCategories || [];
      return { ...p, selectedCategories: sel.includes(catId) ? sel.filter(c => c !== catId) : [...sel, catId] };
    });
  };

  // Custom category management
  const addCustomCategory = () => {
    setEditForm(p => ({
      ...p,
      customCategories: [...(p.customCategories || []), {
        id: 'custom-' + Date.now(),
        title: 'New Category',
        icon: '📌',
        description: 'Custom assessment category',
        items: [],
      }],
    }));
  };

  const updateCustomCategory = (idx, field, value) => {
    setEditForm(p => {
      const cats = [...(p.customCategories || [])];
      cats[idx] = { ...cats[idx], [field]: value };
      return { ...p, customCategories: cats };
    });
  };

  const removeCustomCategory = (idx) => {
    setEditForm(p => ({
      ...p,
      customCategories: (p.customCategories || []).filter((_, i) => i !== idx),
    }));
  };

  const addItemToCustomCategory = (catIdx) => {
    if (!newItemForm.text.trim()) { setErrors(p => ({...p, newItem: 'Item text is required'})); return; }
    setEditForm(p => {
      const cats = [...(p.customCategories || [])];
      const cat = { ...cats[catIdx] };
      const itemId = cat.id + '-' + (cat.items.length + 1);
      cat.items = [...cat.items, { id: itemId, text: newItemForm.text.trim(), severity: newItemForm.severity, tags: newItemForm.tags.split(',').map(t => t.trim()).filter(Boolean) }];
      cats[catIdx] = cat;
      return { ...p, customCategories: cats };
    });
    setNewItemForm({ catIdx, text: '', severity: 'medium', tags: 'devsecops' });
    setErrors(p => { const { newItem, ...rest } = p; return rest; });
  };

  const removeItemFromCategory = (catIdx, itemIdx) => {
    setEditForm(p => {
      const cats = [...(p.customCategories || [])];
      const cat = { ...cats[catIdx] };
      cat.items = cat.items.filter((_, i) => i !== itemIdx);
      cats[catIdx] = cat;
      return { ...p, customCategories: cats };
    });
  };

  const validateTemplate = () => {
    const errs = {};
    const name = editForm.name.trim();
    const id = editForm.id.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    if (!name) errs.name = 'Name is required';
    if (name.length > 60) errs.name = 'Max 60 characters';
    const allIds = [...builtinTemplates.map(t => t.id), ...customTemplates.filter((_, i) => i !== editIdx).map(t => t.id)];
    const allNames = [...builtinTemplates.map(t => t.name.toLowerCase()), ...customTemplates.filter((_, i) => i !== editIdx).map(t => t.name.toLowerCase())];
    if (allIds.includes(id)) errs.name = 'A template with this ID already exists';
    if (allNames.includes(name.toLowerCase())) errs.name = 'A template with this name already exists';
    if (!editForm.description.trim()) errs.description = 'Description is required';
    if (editForm.filterType === 'categories' && (editForm.selectedCategories || []).length === 0 && (editForm.customCategories || []).length === 0) {
      errs.categories = 'Select at least one category or add a custom one';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const saveTemplate = () => {
    if (!validateTemplate()) return;
    const name = editForm.name.trim();
    const id = editForm.id.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const tpl = {
      id, name, description: editForm.description.trim(), color: editForm.color,
      filterType: editForm.filterType,
      selectedCategories: editForm.selectedCategories || [],
      customCategories: editForm.customCategories || [],
    };
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

  const catCount = (t) => {
    if (t.builtin) return null;
    const sel = (t.selectedCategories || []).length;
    const cust = (t.customCategories || []).length;
    return sel + cust;
  };

  return (
    <div className="animate-in">
      <div className="section-header"><h2>Assessment Configuration</h2><p>Define the scope and metadata for your assessment.</p></div>
      <div className="config-grid">
        <div className="config-field">
          <label>Organization Name <span style={{color:'var(--severity-critical)'}}>*</span></label>
          <input type="text" placeholder="My Organization" value={config.org_name}
            onChange={e => u('org_name', e.target.value)}
            onBlur={() => touch('org_name')}
            style={{borderColor: getMandatoryError('org_name', config.org_name) ? 'var(--severity-critical)' : undefined}}
          />
          {getMandatoryError('org_name', config.org_name) && <span className="field-error">⚠ {getMandatoryError('org_name', config.org_name)}</span>}
        </div>
        <div className="config-field">
          <label>Assessor <span style={{color:'var(--severity-critical)'}}>*</span></label>
          <input type="text" placeholder="Your Name" value={config.assessor_name}
            onChange={e => u('assessor_name', e.target.value)}
            onBlur={() => touch('assessor_name')}
            style={{borderColor: getMandatoryError('assessor_name', config.assessor_name) ? 'var(--severity-critical)' : undefined}}
          />
          {getMandatoryError('assessor_name', config.assessor_name) && <span className="field-error">⚠ {getMandatoryError('assessor_name', config.assessor_name)}</span>}
        </div>
        <div className="config-field">
          <label>Date <span style={{color:'var(--severity-critical)'}}>*</span></label>
          <input type="date" value={config.assessment_date}
            onChange={e => u('assessment_date', e.target.value)}
            onBlur={() => touch('assessment_date')}
            style={{borderColor: (fieldTouched.assessment_date && !config.assessment_date) ? 'var(--severity-critical)' : undefined}}
          />
          {fieldTouched.assessment_date && !config.assessment_date && <span className="field-error">⚠ This field is required</span>}
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
            <div style={{display:'flex',gap:8,marginTop:6,alignItems:'center'}}>
              {t.builtin && <span style={{fontSize:10,color:'var(--text-muted)',fontFamily:"'JetBrains Mono',monospace"}}>BUILT-IN</span>}
              {!t.builtin && catCount(t) !== null && <span style={{fontSize:10,color:'var(--text-accent)',fontFamily:"'JetBrains Mono',monospace"}}>{catCount(t)} categories</span>}
            </div>
          </div>
        ))}
      </div>

      {/* ── Template Editor Modal ── */}
      {showEditor && (
        <div className="modal-overlay" onClick={() => setShowEditor(false)}>
          <div className="modal modal-xl" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editIdx !== null ? 'Edit Template' : 'New Template'}</h3>
              <button className="btn-icon" onClick={() => setShowEditor(false)}>✕</button>
            </div>
            <div className="modal-body">
              {/* Basic info */}
              <div className="config-grid" style={{gap:12}}>
                <div className="config-field">
                  <label>Name <span style={{color:'var(--severity-critical)'}}>*</span></label>
                  <input type="text" placeholder="My Custom Template" value={editForm.name}
                    onChange={e => setEditForm(p => ({...p, name: e.target.value}))} />
                  {errors.name && <span className="field-error">{errors.name}</span>}
                </div>
                <div className="config-field">
                  <label>Color</label>
                  <div className="color-picker-grid">
                    {TEMPLATE_COLORS.map(c => (
                      <button key={c} type="button" className={`color-swatch ${editForm.color === c ? 'selected' : ''}`}
                        style={{background: c}} onClick={() => setEditForm(p => ({...p, color: c}))} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="config-field">
                <label>Description <span style={{color:'var(--severity-critical)'}}>*</span></label>
                <textarea placeholder="What this template focuses on..." value={editForm.description}
                  onChange={e => setEditForm(p => ({...p, description: e.target.value}))} rows={2} />
                {errors.description && <span className="field-error">{errors.description}</span>}
              </div>

              {/* Built-in categories selection */}
              <div className="config-field">
                <label>Include Built-in Categories</label>
                {errors.categories && <span className="field-error">{errors.categories}</span>}
                <div className="cat-select-grid">
                  {assessmentCategories.map(cat => {
                    const selected = (editForm.selectedCategories || []).includes(cat.id);
                    return (
                      <button key={cat.id} type="button"
                        className={`cat-select-chip ${selected ? 'selected' : ''}`}
                        onClick={() => toggleCategory(cat.id)}>
                        <span className="cat-select-icon">{cat.icon}</span>
                        <span className="cat-select-name">{cat.title}</span>
                        <span className="cat-select-count">{cat.items.length} items</span>
                        <span className="cat-select-check">{selected ? '✓' : ''}</span>
                      </button>
                    );
                  })}
                </div>
                <div style={{display:'flex',gap:8,marginTop:6}}>
                  <button type="button" className="btn btn-ghost" style={{fontSize:12}} onClick={() => setEditForm(p => ({...p, selectedCategories: assessmentCategories.map(c => c.id)}))}>Select All</button>
                  <button type="button" className="btn btn-ghost" style={{fontSize:12}} onClick={() => setEditForm(p => ({...p, selectedCategories: []}))}>Clear All</button>
                </div>
              </div>

              {/* Custom categories */}
              <div className="config-field">
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <label>Custom Categories</label>
                  <button type="button" className="btn btn-ghost" style={{fontSize:12}} onClick={addCustomCategory}>+ Add Category</button>
                </div>
                {(editForm.customCategories || []).length === 0 && (
                  <p style={{fontSize:13,color:'var(--text-muted)',padding:'12px 0'}}>No custom categories. Add one to create your own controls.</p>
                )}
                {(editForm.customCategories || []).map((cat, catIdx) => (
                  <div key={cat.id} className="custom-cat-card">
                    <div className="custom-cat-header">
                      <input type="text" value={cat.icon} style={{width:40,textAlign:'center',fontSize:18,background:'var(--bg-input)',border:'1px solid var(--border-subtle)',borderRadius:6,padding:4}}
                        onChange={e => updateCustomCategory(catIdx, 'icon', e.target.value)} />
                      <input type="text" value={cat.title} placeholder="Category name" className="inline-input" style={{flex:1,fontWeight:600,fontSize:14}}
                        onChange={e => updateCustomCategory(catIdx, 'title', e.target.value)} />
                      <button className="btn-icon danger" style={{width:28,height:28}} onClick={() => removeCustomCategory(catIdx)} title="Remove category">✕</button>
                    </div>
                    <input type="text" value={cat.description} placeholder="Category description..." className="inline-input" style={{fontSize:12,color:'var(--text-secondary)',marginBottom:8}}
                      onChange={e => updateCustomCategory(catIdx, 'description', e.target.value)} />

                    {/* Items list */}
                    {cat.items.length > 0 && (
                      <div className="custom-cat-items">
                        {cat.items.map((item, itemIdx) => (
                          <div key={item.id} className="custom-cat-item">
                            <span className={`severity-dot sev-${item.severity}`} />
                            <span style={{flex:1,fontSize:12}}>{item.text}</span>
                            <span style={{fontSize:10,color:'var(--text-muted)',fontFamily:"'JetBrains Mono',monospace"}}>{item.severity}</span>
                            <button className="btn-icon danger" style={{width:22,height:22,fontSize:10}} onClick={() => removeItemFromCategory(catIdx, itemIdx)}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add item */}
                    <div className="custom-cat-add-item">
                      <input type="text" placeholder="New control item text..." value={newItemForm.catIdx === catIdx ? newItemForm.text : ''}
                        className="inline-input" style={{flex:1}}
                        onFocus={() => setNewItemForm(p => ({...p, catIdx}))}
                        onChange={e => setNewItemForm(p => ({...p, catIdx, text: e.target.value}))} />
                      <select value={newItemForm.catIdx === catIdx ? newItemForm.severity : 'medium'}
                        style={{padding:'4px 8px',background:'var(--bg-input)',border:'1px solid var(--border-subtle)',borderRadius:4,color:'var(--text-primary)',fontSize:11,fontFamily:"'JetBrains Mono',monospace"}}
                        onChange={e => setNewItemForm(p => ({...p, severity: e.target.value}))}>
                        {SEVERITY_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <button type="button" className="btn btn-ghost" style={{fontSize:11,padding:'4px 10px'}} onClick={() => addItemToCustomCategory(catIdx)}>+ Add</button>
                    </div>
                    {errors.newItem && newItemForm.catIdx === catIdx && <span className="field-error">{errors.newItem}</span>}
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-footer">
              {editIdx !== null && (
                <button className="btn btn-ghost" style={{color:'var(--severity-critical)',marginRight:'auto'}} onClick={() => deleteTemplate(editIdx)}>Delete</button>
              )}
              <button className="btn btn-secondary" onClick={() => setShowEditor(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveTemplate}>{editIdx !== null ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default ConfigStep;
