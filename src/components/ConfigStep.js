import React from 'react';
import { frameworkTemplates } from '../data/assessmentData';

const ConfigStep = ({ config, setConfig }) => {
  const updateConfig = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="animate-in">
      <div className="section-header">
        <h2>Assessment Configuration</h2>
        <p>Define the scope and metadata for your DevOps/DevSecOps security assessment document.</p>
      </div>

      <div className="config-grid">
        <div className="config-field">
          <label>Organization Name</label>
          <input
            type="text"
            placeholder="e.g. Acme Corporation"
            value={config.orgName}
            onChange={(e) => updateConfig('orgName', e.target.value)}
          />
        </div>
        <div className="config-field">
          <label>Assessor Name</label>
          <input
            type="text"
            placeholder="e.g. Jane Smith"
            value={config.assessorName}
            onChange={(e) => updateConfig('assessorName', e.target.value)}
          />
        </div>
        <div className="config-field">
          <label>Assessment Date</label>
          <input
            type="date"
            value={config.date}
            onChange={(e) => updateConfig('date', e.target.value)}
          />
        </div>
        <div className="config-field">
          <label>Environment</label>
          <select
            value={config.environment}
            onChange={(e) => updateConfig('environment', e.target.value)}
          >
            <option value="production">Production</option>
            <option value="staging">Staging</option>
            <option value="development">Development</option>
            <option value="all">All Environments</option>
          </select>
        </div>
        <div className="config-field full-width">
          <label>Scope Description</label>
          <textarea
            placeholder="Describe the systems, services, and infrastructure in scope for this assessment..."
            value={config.scope}
            onChange={(e) => updateConfig('scope', e.target.value)}
          />
        </div>
      </div>

      <div className="section-header" style={{ marginTop: 16 }}>
        <h2>Assessment Template</h2>
        <p>Choose a template to pre-filter assessment items based on your focus area.</p>
      </div>

      <div className="template-grid">
        {frameworkTemplates.map((template, idx) => (
          <div
            key={template.id}
            className={`template-card animate-in stagger-${idx + 1} ${config.template === template.id ? 'selected' : ''}`}
            onClick={() => updateConfig('template', template.id)}
          >
            <h4>{template.name}</h4>
            <p>{template.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConfigStep;
