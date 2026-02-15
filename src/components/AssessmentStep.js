import React, { useState, useMemo } from 'react';
import { assessmentCategories, frameworkTemplates } from '../data/assessmentData';

const AssessmentStep = ({ config, responses, setResponses }) => {
  const [expandedCategories, setExpandedCategories] = useState(
    assessmentCategories.reduce((acc, cat) => ({ ...acc, [cat.id]: true }), {})
  );
  const [severityFilter, setSeverityFilter] = useState('all');

  const activeTemplate = frameworkTemplates.find(t => t.id === config.template) || frameworkTemplates[0];

  const filteredCategories = useMemo(() => {
    return assessmentCategories.map(cat => ({
      ...cat,
      items: cat.items
        .filter(activeTemplate.filter)
        .filter(item => severityFilter === 'all' || item.severity === severityFilter)
    })).filter(cat => cat.items.length > 0);
  }, [activeTemplate, severityFilter]);

  const toggleCategory = (catId) => {
    setExpandedCategories(prev => ({ ...prev, [catId]: !prev[catId] }));
  };

  const updateResponse = (itemId, field, value) => {
    setResponses(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value }
    }));
  };

  const getCategoryStats = (cat) => {
    const total = cat.items.length;
    const assessed = cat.items.filter(item => responses[item.id]?.status && responses[item.id].status !== '').length;
    return { total, assessed };
  };

  const toggleAllInCategory = (cat, status) => {
    const newResponses = { ...responses };
    cat.items.forEach(item => {
      newResponses[item.id] = { ...newResponses[item.id], status };
    });
    setResponses(newResponses);
  };

  return (
    <div className="animate-in">
      <div className="section-header">
        <h2>Security Assessment Checklist</h2>
        <p>Evaluate each control against your environment. Set status and add notes for findings.</p>
      </div>

      <div className="filter-bar">
        <label>Severity:</label>
        {['all', 'critical', 'high', 'medium', 'low'].map(sev => (
          <button
            key={sev}
            className={`filter-chip ${severityFilter === sev ? 'active' : ''}`}
            onClick={() => setSeverityFilter(sev)}
          >
            {sev === 'all' ? 'All' : sev.charAt(0).toUpperCase() + sev.slice(1)}
          </button>
        ))}
      </div>

      {filteredCategories.map((cat) => {
        const { total, assessed } = getCategoryStats(cat);
        const isExpanded = expandedCategories[cat.id];

        return (
          <div key={cat.id} className="category-section">
            <div className="category-header" onClick={() => toggleCategory(cat.id)}>
              <div className="category-icon">{cat.icon}</div>
              <div className="category-info">
                <h3>{cat.title}</h3>
                <p>{cat.description}</p>
              </div>
              <div className="category-stats">
                <span className="category-progress">{assessed}/{total}</span>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 11 }}
                  onClick={(e) => { e.stopPropagation(); toggleAllInCategory(cat, 'pass'); }}
                  title="Mark all as Pass"
                >
                  ✓ All
                </button>
              </div>
              <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>▼</span>
            </div>

            {isExpanded && (
              <div className="category-items">
                {cat.items.map((item) => {
                  const resp = responses[item.id] || {};
                  return (
                    <div key={item.id} className="checklist-item">
                      <div
                        className={`custom-checkbox ${resp.status === 'pass' ? 'checked' : ''}`}
                        onClick={() => updateResponse(item.id, 'status', resp.status === 'pass' ? '' : 'pass')}
                      />
                      <div className="item-content">
                        <div className="item-text">{item.text}</div>
                        <div className="item-meta">
                          <span className={`severity-badge ${item.severity}`}>{item.severity}</span>
                          {item.tags.map(tag => (
                            <span key={tag} className="tag-badge">{tag}</span>
                          ))}
                        </div>
                        <div className="item-notes">
                          <textarea
                            placeholder="Add assessment notes, findings, or remediation steps..."
                            value={resp.notes || ''}
                            onChange={(e) => updateResponse(item.id, 'notes', e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>
                      <select
                        className={`status-select ${resp.status || ''}`}
                        value={resp.status || ''}
                        onChange={(e) => updateResponse(item.id, 'status', e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="">Not Assessed</option>
                        <option value="pass">✓ Pass</option>
                        <option value="fail">✗ Fail</option>
                        <option value="partial">◐ Partial</option>
                        <option value="na">— N/A</option>
                      </select>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default AssessmentStep;
