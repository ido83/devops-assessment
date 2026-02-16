import React, { useState, useRef, useCallback } from 'react';
import { assessmentCategories } from '../data/assessmentData';

const defaultTasks = [
  { id: 1, name: 'Security Assessment & Gap Analysis', start: 0, duration: 2, category: 'planning', subCategory: '', deps: [] },
  { id: 2, name: 'CI/CD Pipeline Hardening', start: 2, duration: 3, category: 'cicd', subCategory: '', deps: [1] },
  { id: 3, name: 'Secrets Management Implementation', start: 2, duration: 2, category: 'cicd', subCategory: '', deps: [1] },
  { id: 4, name: 'Container Image Security', start: 3, duration: 3, category: 'container', subCategory: '', deps: [1] },
  { id: 5, name: 'Kubernetes RBAC & Policies', start: 4, duration: 3, category: 'k8s', subCategory: '', deps: [2] },
  { id: 6, name: 'Network Policies & Service Mesh', start: 5, duration: 2, category: 'k8s', subCategory: '', deps: [5] },
  { id: 7, name: 'IaC Security Scanning', start: 3, duration: 2, category: 'iac', subCategory: '', deps: [1] },
  { id: 8, name: 'IAM & Zero Trust Setup', start: 4, duration: 3, category: 'iam', subCategory: '', deps: [1] },
  { id: 9, name: 'SIEM & Monitoring', start: 6, duration: 3, category: 'monitoring', subCategory: '', deps: [5] },
  { id: 10, name: 'Compliance & SBOM', start: 7, duration: 2, category: 'compliance', subCategory: '', deps: [2, 4] },
  { id: 11, name: 'Supply Chain Security', start: 5, duration: 2, category: 'supply', subCategory: '', deps: [2, 3] },
  { id: 12, name: 'Documentation & Handoff', start: 9, duration: 2, category: 'planning', subCategory: '', deps: [9, 10] },
];

const defaultCategories = {
  planning: { label: 'Planning', color: '#6c5ce7' },
  cicd: { label: 'CI/CD', color: '#00cec9' },
  container: { label: 'Container', color: '#fd79a8' },
  k8s: { label: 'Kubernetes', color: '#ffd166' },
  iac: { label: 'IaC', color: '#ff8c42' },
  iam: { label: 'IAM', color: '#a29bfe' },
  monitoring: { label: 'Monitoring', color: '#66d9c2' },
  compliance: { label: 'Compliance', color: '#dfe6e9' },
  supply: { label: 'Supply Chain', color: '#ff7675' },
};

const COLORS = ['#6c5ce7','#00cec9','#fd79a8','#ffd166','#ff8c42','#a29bfe','#66d9c2','#ff7675','#e17055','#00b894','#0984e3','#74b9ff'];

const GanttChart = ({ gantt, setGantt, toast }) => {
  const [tasks, setTasks] = useState(gantt?.tasks || defaultTasks);
  const [categories, setCategories] = useState(gantt?.categories || defaultCategories);
  const [totalWeeks, setTotalWeeks] = useState(gantt?.totalWeeks || 12);
  const [editId, setEditId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', category: 'planning', newCategory: '', newCategoryColor: '#00b894', subCategory: '', start: 0, duration: 2, mode: 'existing' });
  const [addErrors, setAddErrors] = useState({});
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);
  const [dragIdx, setDragIdx] = useState(null);

  const persist = useCallback((newTasks, newWeeks, newCats) => {
    const t = newTasks || tasks;
    const w = newWeeks || totalWeeks;
    const c = newCats || categories;
    setTasks(t); setTotalWeeks(w); setCategories(c);
    setGantt({ tasks: t, totalWeeks: w, categories: c });
  }, [tasks, totalWeeks, categories, setGantt]);

  const updTask = (id, field, value) => {
    persist(tasks.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  // ── Drag & Drop ──
  const onDragStart = (idx) => { dragItem.current = idx; setDragIdx(idx); };
  const onDragEnter = (idx) => { dragOverItem.current = idx; };
  const onDragEnd = () => {
    if (dragItem.current === null || dragOverItem.current === null || dragItem.current === dragOverItem.current) {
      setDragIdx(null); return;
    }
    const copy = [...tasks];
    const [moved] = copy.splice(dragItem.current, 1);
    copy.splice(dragOverItem.current, 0, moved);
    dragItem.current = null; dragOverItem.current = null; setDragIdx(null);
    persist(copy);
    toast && toast('Task reordered', 'success');
  };

  // ── Add Task Modal ──
  const openAddModal = () => {
    setAddForm({ name: '', category: Object.keys(categories)[0] || 'planning', newCategory: '', newCategoryColor: COLORS[Object.keys(categories).length % COLORS.length], subCategory: '', start: 0, duration: 2, mode: 'existing' });
    setAddErrors({});
    setShowAddModal(true);
  };

  const validateAdd = () => {
    const errs = {};
    if (!addForm.name.trim()) errs.name = 'Task name is required';
    if (addForm.mode === 'new') {
      if (!addForm.newCategory.trim()) errs.newCategory = 'Category name is required';
      const key = addForm.newCategory.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
      if (categories[key]) errs.newCategory = 'Category already exists — select it from existing';
    }
    if (addForm.duration < 1) errs.duration = 'Must be at least 1 week';
    if (addForm.start < 0) errs.start = 'Cannot be negative';
    setAddErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submitAdd = () => {
    if (!validateAdd()) return;
    const id = Math.max(0, ...tasks.map(t => t.id)) + 1;
    let catKey = addForm.category;
    let newCats = categories;
    if (addForm.mode === 'new') {
      catKey = addForm.newCategory.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
      newCats = { ...categories, [catKey]: { label: addForm.newCategory.trim(), color: addForm.newCategoryColor } };
    }
    const task = { id, name: addForm.name.trim(), start: Number(addForm.start), duration: Number(addForm.duration), category: catKey, subCategory: addForm.subCategory, deps: [] };
    persist([...tasks, task], undefined, newCats);
    setShowAddModal(false);
    toast && toast(`Task "${task.name}" added to ${newCats[catKey]?.label || catKey}`, 'success');
  };

  const removeTask = (id) => {
    if (!window.confirm('Delete this task?')) return;
    persist(tasks.filter(t => t.id !== id));
    setEditId(null);
    toast && toast('Task deleted', 'success');
  };

  const maxEnd = Math.max(...tasks.map(t => t.start + t.duration), totalWeeks);
  const weeks = Array.from({ length: maxEnd }, (_, i) => i);

  // Group tasks by category for display
  const groupedTasks = [];
  const catOrder = {};
  tasks.forEach((task, idx) => {
    if (!catOrder[task.category]) catOrder[task.category] = [];
    catOrder[task.category].push({ task, idx });
  });

  return (
    <div className="animate-in">
      <div className="section-header">
        <h2>Remediation Gantt Chart</h2>
        <p>Plan and visualize the implementation timeline. Drag rows to reorder.</p>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <label className="gantt-meta-label">Timeline (weeks):</label>
        <input type="number" min="4" max="52" value={totalWeeks}
          onChange={e => persist(undefined, Math.max(4, Number(e.target.value)))}
          className="gantt-meta-input" />
        <button className="btn btn-primary" onClick={openAddModal} style={{ marginLeft: 'auto' }}>+ Add Task</button>
      </div>

      <div className="gantt-container">
        <div className="gantt-header">
          <div className="gantt-label-col" style={{ fontWeight: 600 }}>
            <span style={{width: 28}}></span>Task
          </div>
          <div className="gantt-timeline">
            {weeks.map(w => <div key={w} className="gantt-week-header">W{w + 1}</div>)}
          </div>
        </div>

        {tasks.map((task, idx) => (
          <div key={task.id}
            className={`gantt-row ${dragIdx === idx ? 'dragging' : ''}`}
            draggable
            onDragStart={() => onDragStart(idx)}
            onDragEnter={() => onDragEnter(idx)}
            onDragEnd={onDragEnd}
            onDragOver={e => e.preventDefault()}>
            <div className="gantt-label-col" onClick={() => setEditId(editId === task.id ? null : task.id)}>
              <span className="drag-handle" title="Drag to reorder">⠿</span>
              <div className="gantt-task-dot" style={{ background: categories[task.category]?.color || '#6c5ce7' }} />
              <span className="gantt-task-name">
                {task.name}
                {task.subCategory && <span style={{fontSize:10,color:'var(--text-muted)',marginLeft:6}}>({task.subCategory})</span>}
              </span>
            </div>
            <div className="gantt-timeline">
              {weeks.map(w => {
                const active = w >= task.start && w < task.start + task.duration;
                return (
                  <div key={w} className={`gantt-cell ${active ? 'active' : ''}`}
                    style={active ? { background: categories[task.category]?.color || '#6c5ce7', opacity: 0.7 } : {}} />
                );
              })}
            </div>
          </div>
        ))}

        {editId && (() => {
          const t = tasks.find(t => t.id === editId);
          if (!t) return null;
          return (
            <div className="gantt-editor">
              <div className="gantt-editor-fields">
                <div className="config-field"><label>Task Name</label>
                  <input type="text" value={t.name} onChange={e => updTask(t.id, 'name', e.target.value)} /></div>
                <div className="config-field"><label>Start (week)</label>
                  <input type="number" min="0" value={t.start} onChange={e => updTask(t.id, 'start', Math.max(0, Number(e.target.value)))} /></div>
                <div className="config-field"><label>Duration (weeks)</label>
                  <input type="number" min="1" value={t.duration} onChange={e => updTask(t.id, 'duration', Math.max(1, Number(e.target.value)))} /></div>
                <div className="config-field"><label>Category</label>
                  <select value={t.category} onChange={e => updTask(t.id, 'category', e.target.value)}>
                    {Object.entries(categories).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select></div>
                <div className="config-field"><label>Sub-category</label>
                  <input type="text" value={t.subCategory || ''} placeholder="Optional sub-category" onChange={e => updTask(t.id, 'subCategory', e.target.value)} /></div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button className="btn btn-ghost" onClick={() => setEditId(null)}>Done</button>
                <button className="btn btn-ghost" style={{ color: 'var(--severity-critical)' }} onClick={() => removeTask(t.id)}>Delete Task</button>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 16 }}>
        {Object.entries(categories).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: v.color }} />
            {v.label}
          </div>
        ))}
      </div>

      {/* Add Task Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Gantt Task</h3>
              <button className="btn-icon" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="config-field">
                <label>Task Name <span style={{color:'var(--severity-critical)'}}>*</span></label>
                <input type="text" placeholder="e.g. Implement WAF Rules" value={addForm.name}
                  onChange={e => setAddForm(p => ({...p, name: e.target.value}))} />
                {addErrors.name && <span className="field-error">{addErrors.name}</span>}
              </div>

              {/* Category mode toggle */}
              <div className="config-field">
                <label>Category</label>
                <div className="toggle-group">
                  <button type="button" className={`toggle-btn ${addForm.mode === 'existing' ? 'active' : ''}`}
                    onClick={() => setAddForm(p => ({...p, mode: 'existing'}))}>Existing Category</button>
                  <button type="button" className={`toggle-btn ${addForm.mode === 'new' ? 'active' : ''}`}
                    onClick={() => setAddForm(p => ({...p, mode: 'new'}))}>New Category</button>
                </div>
              </div>

              {addForm.mode === 'existing' ? (
                <>
                  <div className="config-field">
                    <label>Select Category</label>
                    <select value={addForm.category} onChange={e => setAddForm(p => ({...p, category: e.target.value}))}>
                      {Object.entries(categories).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="config-field">
                    <label>Sub-Category (optional)</label>
                    <input type="text" placeholder="e.g. from assessment: Pipeline Hardening" value={addForm.subCategory}
                      onChange={e => setAddForm(p => ({...p, subCategory: e.target.value}))} />
                  </div>
                  {/* Quick picks from assessment categories */}
                  <div className="config-field">
                    <label style={{fontSize:11}}>Quick Pick from Assessment Controls</label>
                    <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:4}}>
                      {assessmentCategories.map(ac => (
                        <button key={ac.id} type="button" className="filter-chip"
                          onClick={() => setAddForm(p => ({...p, subCategory: ac.title, name: p.name || ac.title + ' Remediation'}))}>
                          {ac.icon} {ac.title}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="config-field">
                    <label>New Category Name <span style={{color:'var(--severity-critical)'}}>*</span></label>
                    <input type="text" placeholder="e.g. API Security" value={addForm.newCategory}
                      onChange={e => setAddForm(p => ({...p, newCategory: e.target.value}))} />
                    {addErrors.newCategory && <span className="field-error">{addErrors.newCategory}</span>}
                  </div>
                  <div className="config-field">
                    <label>Category Color</label>
                    <div className="color-picker-grid">
                      {COLORS.map(c => (
                        <button key={c} type="button"
                          className={`color-swatch ${addForm.newCategoryColor === c ? 'selected' : ''}`}
                          style={{background: c}}
                          onClick={() => setAddForm(p => ({...p, newCategoryColor: c}))} />
                      ))}
                    </div>
                  </div>
                  <div className="config-field">
                    <label>Sub-Category (optional)</label>
                    <input type="text" placeholder="Optional refinement" value={addForm.subCategory}
                      onChange={e => setAddForm(p => ({...p, subCategory: e.target.value}))} />
                  </div>
                </>
              )}

              <div className="config-grid" style={{gap:12,marginTop:8}}>
                <div className="config-field">
                  <label>Start (week)</label>
                  <input type="number" min="0" value={addForm.start}
                    onChange={e => setAddForm(p => ({...p, start: Number(e.target.value)}))} />
                  {addErrors.start && <span className="field-error">{addErrors.start}</span>}
                </div>
                <div className="config-field">
                  <label>Duration (weeks)</label>
                  <input type="number" min="1" value={addForm.duration}
                    onChange={e => setAddForm(p => ({...p, duration: Number(e.target.value)}))} />
                  {addErrors.duration && <span className="field-error">{addErrors.duration}</span>}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={submitAdd}>Add Task</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GanttChart;
