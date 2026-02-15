import React, { useState } from 'react';
import './styles/App.css';
import ConfigStep from './components/ConfigStep';
import AssessmentStep from './components/AssessmentStep';
import ReviewStep from './components/ReviewStep';

const STEPS = [
  { id: 'config', label: 'Configure', icon: '⚙️' },
  { id: 'assess', label: 'Assess', icon: '🔍' },
  { id: 'review', label: 'Review & Export', icon: '📊' },
];

function App() {
  const [currentStep, setCurrentStep] = useState(0);
  const [config, setConfig] = useState({
    orgName: '',
    assessorName: '',
    date: new Date().toISOString().split('T')[0],
    environment: 'production',
    scope: '',
    template: 'full',
  });
  const [responses, setResponses] = useState({});

  const canProceed = () => {
    if (currentStep === 0) return config.orgName.trim() !== '';
    return true;
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo-area">
          <div className="logo-mark">SA</div>
          <div className="logo-text">
            <h1>SecAssess</h1>
            <span>DevOps & DevSecOps Assessment</span>
          </div>
        </div>
        <div className="header-actions">
          {config.orgName && (
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12,
              color: 'var(--text-muted)',
              padding: '8px 14px',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)'
            }}>
              {config.orgName} — {config.environment}
            </span>
          )}
        </div>
      </header>

      <main className="main-content">
        <nav className="steps-nav">
          {STEPS.map((step, idx) => (
            <button
              key={step.id}
              className={`step-tab ${idx === currentStep ? 'active' : ''} ${idx < currentStep ? 'completed' : ''}`}
              onClick={() => setCurrentStep(idx)}
            >
              <span className="step-number">{idx < currentStep ? '✓' : idx + 1}</span>
              {step.label}
            </button>
          ))}
        </nav>

        {currentStep === 0 && (
          <ConfigStep config={config} setConfig={setConfig} />
        )}
        {currentStep === 1 && (
          <AssessmentStep config={config} responses={responses} setResponses={setResponses} />
        )}
        {currentStep === 2 && (
          <ReviewStep config={config} responses={responses} />
        )}

        <div className="btn-group">
          {currentStep > 0 && (
            <button className="btn btn-secondary" onClick={() => setCurrentStep(prev => prev - 1)}>
              ← Back
            </button>
          )}
          {currentStep < STEPS.length - 1 && (
            <button
              className="btn btn-primary"
              onClick={() => canProceed() && setCurrentStep(prev => prev + 1)}
              style={{ opacity: canProceed() ? 1 : 0.5 }}
            >
              Continue →
            </button>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
