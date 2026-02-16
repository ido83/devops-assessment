import React, { useState, useCallback, useEffect, useRef } from 'react';
import './styles/App.css';
import Dashboard from './components/Dashboard';
import ConfigStep from './components/ConfigStep';
import AssessmentStep from './components/AssessmentStep';
import ReviewStep from './components/ReviewStep';
import PricingStep from './components/PricingStep';
import GanttChart from './components/GanttChart';
import WorkPlan from './components/WorkPlan';
import { api } from './utils/api';
import { computeStats, getFilteredCategories } from './utils/exporters';

const TABS = [
  { id: 'config', label: 'Configure', icon: '⚙️' },
  { id: 'assess', label: 'Assess', icon: '🔍' },
  { id: 'pricing', label: 'Pricing', icon: '💰' },
  { id: 'gantt', label: 'Gantt', icon: '📅' },
  { id: 'workplan', label: 'Work Plan', icon: '📋' },
  { id: 'review', label: 'Review & Export', icon: '📊' },
];

const emptyAssessment = () => ({
  id: null,
  org_name: '', assessor_name: '', assessment_date: new Date().toISOString().split('T')[0],
  environment: 'production', scope: '', template: 'full',
  responses: {}, pricing: {}, gantt: {}, workplan: {},
  custom_templates: [], score: 0, status: 'draft',
});

/* ─── Toast system ─── */
function Toast({ toasts, removeToast }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`} onClick={() => removeToast(t.id)}>
          <span className="toast-icon">{t.type === 'success' ? '✓' : t.type === 'error' ? '✗' : 'ℹ'}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

function App() {
  const [view, setView] = useState('dashboard');
  const [tab, setTab] = useState(0);
  const [assessment, setAssessment] = useState(emptyAssessment());
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);

  const toast = useCallback((message, type = 'info') => {
    const id = ++toastId.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);
  const removeToast = useCallback((id) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  const setField = useCallback((field, value) => {
    setAssessment(prev => ({ ...prev, [field]: value }));
  }, []);

  const setConfig = useCallback((updater) => {
    setAssessment(prev => {
      const updated = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      return updated;
    });
  }, []);

  useEffect(() => {
    try {
      const cats = getFilteredCategories(assessment.template, assessment.custom_templates);
      const stats = computeStats(cats, assessment.responses);
      if (stats.score !== assessment.score) {
        setAssessment(prev => ({ ...prev, score: stats.score }));
      }
    } catch (e) {}
  }, [assessment.responses, assessment.template, assessment.score, assessment.custom_templates]);

  const validate = () => {
    if (!assessment.org_name.trim()) { toast('Organization name is required', 'error'); return false; }
    if (!assessment.assessor_name.trim()) { toast('Assessor name is required', 'error'); return false; }
    if (!assessment.assessment_date) { toast('Assessment date is required', 'error'); return false; }
    return true;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const data = { ...assessment };
      if (assessment.id) {
        await api.update(assessment.id, data);
      } else {
        const res = await api.create(data);
        setAssessment(prev => ({ ...prev, id: res.id }));
      }
      setLastSaved(new Date());
      toast('Assessment saved', 'success');
    } catch (e) {
      // If update returns 404, the record was deleted or doesn't exist - create instead
      if (e.message && e.message.includes('Not found') && assessment.id) {
        try {
          const copy = { ...assessment, id: null };
          const res = await api.create(copy);
          setAssessment(prev => ({ ...prev, id: res.id }));
          setLastSaved(new Date());
          toast('Assessment saved as new record', 'success');
        } catch (e2) {
          toast('Save failed: ' + e2.message, 'error');
        }
      } else {
        toast('Save failed: ' + e.message, 'error');
      }
    }
    setSaving(false);
  };

  const openAssessment = async (id) => {
    try {
      const data = await api.get(id);
      if (!data.custom_templates) data.custom_templates = [];
      setAssessment(data);
      setTab(0);
      setView('editor');
      toast('Assessment loaded', 'success');
    } catch (e) {
      toast('Failed to load: ' + e.message, 'error');
    }
  };

  const newAssessment = () => {
    setAssessment(emptyAssessment());
    setTab(0);
    setView('editor');
    setLastSaved(null);
  };

  if (view === 'dashboard') {
    return (
      <div className="app-container">
        <Toast toasts={toasts} removeToast={removeToast} />
        <header className="app-header">
          <div className="logo-area">
            <div className="logo-mark">SA</div>
            <div className="logo-text"><h1>SecAssess</h1><span>DevOps & DevSecOps Platform</span></div>
          </div>
        </header>
        <main className="main-content">
          <Dashboard onOpen={openAssessment} onNew={newAssessment} toast={toast} />
        </main>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Toast toasts={toasts} removeToast={removeToast} />
      <header className="app-header">
        <div className="logo-area">
          <div className="logo-mark" style={{ cursor: 'pointer' }} onClick={() => setView('dashboard')}>SA</div>
          <div className="logo-text">
            <h1 style={{ cursor: 'pointer' }} onClick={() => setView('dashboard')}>SecAssess</h1>
            <span>{assessment.org_name || 'New Assessment'} — {assessment.environment}</span>
          </div>
        </div>
        <div className="header-actions">
          {lastSaved && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono',monospace" }}>
            Saved {lastSaved.toLocaleTimeString()}
          </span>}
          <button className="btn btn-secondary" onClick={() => setView('dashboard')}>← Dashboard</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving...' : '💾 Save'}
          </button>
        </div>
      </header>
      <main className="main-content">
        <nav className="steps-nav">
          {TABS.map((t, i) => (
            <button key={t.id} className={`step-tab ${i === tab ? 'active' : ''}`} onClick={() => setTab(i)}>
              <span className="step-number">{t.icon}</span>{t.label}
            </button>
          ))}
        </nav>
        {tab === 0 && <ConfigStep config={assessment} setConfig={setConfig} toast={toast} />}
        {tab === 1 && <AssessmentStep config={assessment} responses={assessment.responses} setResponses={updater => {
          if (typeof updater === 'function') {
            setAssessment(prev => ({ ...prev, responses: updater(prev.responses) }));
          } else { setField('responses', updater); }
        }} />}
        {tab === 2 && <PricingStep pricing={assessment.pricing} setPricing={v => setField('pricing', v)} toast={toast} />}
        {tab === 3 && <GanttChart gantt={assessment.gantt} setGantt={v => setField('gantt', v)} toast={toast} />}
        {tab === 4 && <WorkPlan workplan={assessment.workplan} setWorkplan={v => setField('workplan', v)} toast={toast} />}
        {tab === 5 && <ReviewStep assessment={assessment} />}
        <div className="btn-group">
          {tab > 0 && <button className="btn btn-secondary" onClick={() => setTab(t => t - 1)}>← Back</button>}
          {tab < TABS.length - 1 && <button className="btn btn-primary" onClick={() => setTab(t => t + 1)}>Continue →</button>}
          <button className="btn btn-export" onClick={save} disabled={saving}>{saving ? 'Saving...' : '💾 Save Assessment'}</button>
        </div>
      </main>
    </div>
  );
}

export default App;
