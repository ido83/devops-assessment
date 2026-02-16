import React, { useState, useMemo, useCallback } from 'react';
import { assessmentCategories, frameworkTemplates } from '../data/assessmentData';

const AssessmentStep = ({ config, responses, setResponses }) => {
  const [expanded, setExpanded] = useState(() =>
    assessmentCategories.reduce((a, c) => ({ ...a, [c.id]: true }), {})
  );
  const [sevFilter, setSevFilter] = useState('all');
  const tmpl = frameworkTemplates.find(t => t.id === config.template) || frameworkTemplates[0];

  const cats = useMemo(() =>
    assessmentCategories.map(c => ({
      ...c,
      items: c.items
        .filter(tmpl.filter)
        .filter(i => sevFilter === 'all' || i.severity === sevFilter)
    })).filter(c => c.items.length > 0)
  , [tmpl, sevFilter]);

  const upd = useCallback((id, field, value) => {
    setResponses(prev => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [field]: value }
    }));
  }, [setResponses]);

  const stats = (cat) => {
    const t = cat.items.length;
    return { t, d: cat.items.filter(i => responses[i.id]?.status).length };
  };

  const markAll = useCallback((cat, s) => {
    setResponses(prev => {
      const next = { ...prev };
      cat.items.forEach(i => { next[i.id] = { ...(next[i.id] || {}), status: s }; });
      return next;
    });
  }, [setResponses]);

  const toggleExpand = useCallback((catId) => {
    setExpanded(p => ({ ...p, [catId]: !p[catId] }));
  }, []);

  return (
    <div className="animate-in">
      <div className="section-header">
        <h2>Security Assessment</h2>
        <p>Evaluate each control. Set status and add notes.</p>
      </div>
      <div className="filter-bar">
        <label>Severity:</label>
        {['all','critical','high','medium','low'].map(s => (
          <button key={s} className={`filter-chip ${sevFilter===s?'active':''}`} onClick={() => setSevFilter(s)}>
            {s==='all'?'All':s.charAt(0).toUpperCase()+s.slice(1)}
          </button>
        ))}
      </div>
      {cats.map(cat => {
        const { t, d } = stats(cat);
        return (
          <div key={cat.id} className="category-section">
            <div className="category-header" onClick={() => toggleExpand(cat.id)}>
              <div className="category-icon">{cat.icon}</div>
              <div className="category-info"><h3>{cat.title}</h3><p>{cat.description}</p></div>
              <div className="category-stats">
                <span className="category-progress">{d}/{t}</span>
                <button className="btn btn-ghost" style={{fontSize:11}} onClick={e => { e.stopPropagation(); markAll(cat,'pass'); }}>✓ All</button>
              </div>
              <span className={`expand-icon ${expanded[cat.id]?'expanded':''}`}>▼</span>
            </div>
            {expanded[cat.id] && <div className="category-items">
              {cat.items.map(item => (
                <ChecklistItem
                  key={item.id}
                  item={item}
                  response={responses[item.id] || {}}
                  onUpdate={upd}
                />
              ))}
            </div>}
          </div>
        );
      })}
    </div>
  );
};

/* Separate component to isolate event handling per item */
const ChecklistItem = React.memo(({ item, response, onUpdate }) => {
  const handleCheckbox = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onUpdate(item.id, 'status', response.status === 'pass' ? '' : 'pass');
  };

  const handleStatusChange = (e) => {
    e.stopPropagation();
    onUpdate(item.id, 'status', e.target.value);
  };

  const handleNotesChange = (e) => {
    onUpdate(item.id, 'notes', e.target.value);
  };

  return (
    <div className="checklist-item">
      <button
        type="button"
        className={`custom-checkbox ${response.status === 'pass' ? 'checked' : ''}`}
        onClick={handleCheckbox}
        aria-label={`Mark ${item.text} as pass`}
      />
      <div className="item-content">
        <div className="item-text">{item.text}</div>
        <div className="item-meta">
          <span className={`severity-badge ${item.severity}`}>{item.severity}</span>
          {item.tags.map(tg => <span key={tg} className="tag-badge">{tg}</span>)}
        </div>
        <div className="item-notes">
          <textarea
            placeholder="Add notes..."
            value={response.notes || ''}
            onChange={handleNotesChange}
            rows={2}
          />
        </div>
      </div>
      <select
        className={`status-select ${response.status || ''}`}
        value={response.status || ''}
        onChange={handleStatusChange}
      >
        <option value="">Not Assessed</option>
        <option value="pass">✓ Pass</option>
        <option value="fail">✗ Fail</option>
        <option value="partial">◐ Partial</option>
        <option value="na">— N/A</option>
      </select>
    </div>
  );
});

export default AssessmentStep;
