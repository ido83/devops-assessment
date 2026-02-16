import React, { useState, useMemo, useCallback, useRef } from 'react';
import { assessmentCategories, frameworkTemplates } from '../data/assessmentData';

const filterFns = {
  all: () => true,
  devsecops: (item) => item.tags.includes('devsecops'),
  devops: (item) => item.tags.includes('devops'),
  'critical-high': (item) => item.severity === 'critical' || item.severity === 'high',
  critical: (item) => item.severity === 'critical',
  categories: () => true,
};

const AssessmentStep = ({ config, responses, setResponses }) => {
  const containerRef = useRef(null);
  const [expandedState, setExpandedState] = useState(null); // null = all expanded by default
  const [sevFilter, setSevFilter] = useState('all');

  // Build categories: builtin filter OR custom template with selected+custom categories
  const cats = useMemo(() => {
    const builtinTmpl = frameworkTemplates.find(t => t.id === config.template);
    const customTmpls = config.custom_templates || [];
    const customTmpl = customTmpls.find(t => t.id === config.template);

    let result = [];
    if (builtinTmpl) {
      result = assessmentCategories.map(c => ({
        ...c, items: c.items.filter(builtinTmpl.filter)
      }));
    } else if (customTmpl) {
      // Selected built-in categories
      const selIds = customTmpl.selectedCategories || [];
      const filterFn = filterFns[customTmpl.filterType] || filterFns.all;
      result = assessmentCategories
        .filter(c => selIds.includes(c.id))
        .map(c => ({ ...c, items: c.items.filter(filterFn) }));
      // Custom categories
      const customCats = (customTmpl.customCategories || []).map(c => ({
        ...c,
        items: (c.items || []).map(item => ({
          ...item,
          tags: item.tags || ['custom'],
        })),
      }));
      result = [...result, ...customCats];
    } else {
      result = assessmentCategories.map(c => ({ ...c }));
    }
    // Severity filter
    result = result.map(c => ({
      ...c, items: c.items.filter(i => sevFilter === 'all' || i.severity === sevFilter)
    })).filter(c => c.items.length > 0);
    return result;
  }, [config.template, config.custom_templates, sevFilter]);

  const expanded = useMemo(() => {
    if (expandedState !== null) return expandedState;
    return cats.reduce((a, c) => ({ ...a, [c.id]: false }), {});
  }, [expandedState, cats]);

  const allExpanded = useMemo(() => cats.length > 0 && cats.every(c => expanded[c.id]), [cats, expanded]);

  const upd = useCallback((id, field, value) => {
    setResponses(prev => ({
      ...prev, [id]: { ...(prev[id] || {}), [field]: value }
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
    setExpandedState(prev => {
      const current = prev || cats.reduce((a, c) => ({ ...a, [c.id]: false }), {});
      return { ...current, [catId]: !current[catId] };
    });
  }, [cats]);

  const toggleAll = useCallback(() => {
    const newVal = !allExpanded;
    setExpandedState(cats.reduce((a, c) => ({ ...a, [c.id]: newVal }), {}));
  }, [allExpanded, cats]);

  const scrollTo = (dir) => {
    if (dir === 'top') window.scrollTo({ top: 0, behavior: 'smooth' });
    else window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  return (
    <div className="animate-in" ref={containerRef}>
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
                <ChecklistItem key={item.id} item={item} response={responses[item.id] || {}} onUpdate={upd} />
              ))}
            </div>}
          </div>
        );
      })}

      {/* Floating toolbar — always visible */}
      <div className="fab-toolbar">
        <button className="fab-btn" onClick={() => scrollTo('top')} title="Scroll to top">
          <span className="fab-icon">↑</span><span className="fab-label">Top</span>
        </button>
        <div className="fab-divider" />
        <button className="fab-btn" onClick={toggleAll} title={allExpanded ? 'Collapse all' : 'Expand all'}>
          <span className="fab-icon">{allExpanded ? '⊟' : '⊞'}</span><span className="fab-label">{allExpanded ? 'Collapse' : 'Expand'}</span>
        </button>
        <div className="fab-divider" />
        <button className="fab-btn" onClick={() => scrollTo('bottom')} title="Scroll to bottom">
          <span className="fab-icon">↓</span><span className="fab-label">Bottom</span>
        </button>
      </div>
    </div>
  );
};

const ChecklistItem = React.memo(({ item, response, onUpdate }) => {
  return (
    <div className="checklist-item">
      <button type="button"
        className={`custom-checkbox ${response.status === 'pass' ? 'checked' : ''}`}
        onClick={e => { e.preventDefault(); e.stopPropagation(); onUpdate(item.id, 'status', response.status === 'pass' ? '' : 'pass'); }}
        aria-label={`Mark ${item.text} as pass`} />
      <div className="item-content">
        <div className="item-text">{item.text}</div>
        <div className="item-meta">
          <span className={`severity-badge ${item.severity}`}>{item.severity}</span>
          {(item.tags || []).map(tg => <span key={tg} className="tag-badge">{tg}</span>)}
        </div>
        <div className="item-notes">
          <textarea placeholder="Add notes..." value={response.notes || ''} onChange={e => onUpdate(item.id, 'notes', e.target.value)} rows={2} />
        </div>
      </div>
      <select className={`status-select ${response.status || ''}`} value={response.status || ''} onChange={e => { e.stopPropagation(); onUpdate(item.id, 'status', e.target.value); }}>
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
