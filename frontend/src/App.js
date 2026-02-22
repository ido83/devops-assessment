import React, { useState, useCallback, useEffect, useRef } from 'react';
import './styles/App.css';

const APP_VERSION = process.env.REACT_APP_VERSION || '?';
const GIT_SHA = process.env.REACT_APP_GIT_SHA || 'dev';
import Dashboard from './components/Dashboard';
import ConfigStep from './components/ConfigStep';
import AssessmentStep from './components/AssessmentStep';
import ReviewStep from './components/ReviewStep';
import PricingStep from './components/PricingStep';
import GanttChart from './components/GanttChart';
import WorkPlan from './components/WorkPlan';
import CiCdDiagram from './components/CiCdDiagram';
import GitFlowDiagram from './components/GitFlowDiagram';
import ArtifactRegistry from './components/ArtifactRegistry';
import DeploymentStrategies from './components/DeploymentStrategies';
import VersioningDiagram from './components/VersioningDiagram';
import { api } from './utils/api';
import { computeStats, getFilteredCategories } from './utils/exporters';

const TABS = [
  { id:'config', label:'Configure', icon:'⚙️' },
  { id:'assess', label:'Assess', icon:'🔍' },
  { id:'cicd', label:'CI/CD', icon:'🔄' },
  { id:'gitflow', label:'Git Flow', icon:'🌿' },
  { id:'deploy', label:'Deploy Strategy', icon:'🚀' },
  { id:'versioning', label:'Versioning', icon:'🏷️' },
  { id:'artifacts', label:'Artifacts', icon:'📦' },
  { id:'pricing', label:'Pricing', icon:'💰' },
  { id:'gantt', label:'Gantt', icon:'📅' },
  { id:'workplan', label:'Work Plan', icon:'📋' },
  { id:'review', label:'Review & Export', icon:'📊' },
];

const DATA_FIELDS = ['responses','pricing','gantt','workplan','cicd_diagrams','gitflow_diagrams','artifact_repos','deployment_strategies','versioning_diagrams','custom_templates'];

const emptyAssessment = () => ({
  id: null,
  org_name: '', assessor_name: '', assessment_date: new Date().toISOString().split('T')[0],
  environment: 'production', scope: '', template: 'full',
  responses: {}, pricing: {}, gantt: {}, workplan: {}, cicd_diagrams: {},
  gitflow_diagrams: {}, artifact_repos: {}, deployment_strategies: {}, versioning_diagrams: {},
  custom_templates: [], score: 0, status: 'draft',
});

function Toast({ toasts, removeToast }) {
  return (<div className="toast-container">{toasts.map(t => (
    <div key={t.id} className={`toast toast-${t.type}`} onClick={() => removeToast(t.id)}>
      <span className="toast-icon">{t.type === 'success' ? '✓' : t.type === 'error' ? '✗' : 'ℹ'}</span><span>{t.message}</span>
    </div>))}</div>);
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
  const setField = useCallback((field, value) => setAssessment(prev => ({ ...prev, [field]: value })), []);
  const setConfig = useCallback((updater) => setAssessment(prev => typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }), []);

  useEffect(() => {
    try {
      const cats = getFilteredCategories(assessment.template, assessment.custom_templates);
      const stats = computeStats(cats, assessment.responses);
      if (stats.score !== assessment.score) setAssessment(prev => ({ ...prev, score: stats.score }));
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
      if (assessment.id) { await api.update(assessment.id, data); }
      else { const res = await api.create(data); setAssessment(prev => ({ ...prev, id: res.id })); }
      setLastSaved(new Date()); toast('Assessment saved', 'success');
    } catch (e) {
      if (e.message?.includes('Not found') && assessment.id) {
        try { const copy = { ...assessment, id: null }; const res = await api.create(copy); setAssessment(prev => ({ ...prev, id: res.id })); setLastSaved(new Date()); toast('Saved as new', 'success'); }
        catch (e2) { toast('Save failed: ' + e2.message, 'error'); }
      } else { toast('Save failed: ' + e.message, 'error'); }
    }
    setSaving(false);
  };

  const truncateCurrentTab = () => {
    const tabId = TABS[tab]?.id;
    const fieldMap = { assess:'responses', pricing:'pricing', gantt:'gantt', workplan:'workplan', cicd:'cicd_diagrams', gitflow:'gitflow_diagrams', deploy:'deployment_strategies', versioning:'versioning_diagrams', artifacts:'artifact_repos', config:null, review:null };
    const field = fieldMap[tabId];
    if (!field) { toast('Nothing to clear on this tab', 'info'); return; }
    if (!window.confirm(`Clear all data on "${TABS[tab].label}" tab?`)) return;
    setField(field, field === 'custom_templates' ? [] : {});
    toast(`${TABS[tab].label} data cleared`, 'success');
  };

  const truncateAll = () => {
    if (!window.confirm('Clear ALL data on ALL tabs? This cannot be undone.')) return;
    const fresh = emptyAssessment();
    fresh.id = assessment.id;
    fresh.org_name = assessment.org_name;
    fresh.assessor_name = assessment.assessor_name;
    fresh.assessment_date = assessment.assessment_date;
    setAssessment(fresh);
    toast('All tabs cleared', 'success');
  };

  const openAssessment = async (id) => {
    try { const data = await api.get(id); if (!data.custom_templates) data.custom_templates = []; setAssessment(data); setTab(0); setView('editor'); toast('Loaded', 'success'); }
    catch (e) { toast('Failed: ' + e.message, 'error'); }
  };

  const truncateDB = async () => {
    if (!window.confirm('DELETE ALL assessments from database? This is permanent!')) return;
    if (!window.confirm('Are you absolutely sure? ALL data will be lost.')) return;
    try { await api.truncateAll(); toast('Database truncated', 'success'); } catch (e) { toast('Failed: ' + e.message, 'error'); }
  };

  const newAssessment = () => { setAssessment(emptyAssessment()); setTab(0); setView('editor'); setLastSaved(null); };

  if (view === 'dashboard') {
    return (
      <div className="app-container">
        <Toast toasts={toasts} removeToast={removeToast} />
        <header className="app-header">
          <div className="logo-area"><div className="logo-mark">SA</div><div className="logo-text"><h1>SecAssess</h1><span>DevOps & DevSecOps Platform</span><span className="logo-version">v{APP_VERSION} · {GIT_SHA}</span></div></div>
          <div className="header-actions">
            <button className="btn btn-ghost btn-xs" style={{color:'var(--severity-critical)'}} onClick={truncateDB} title="Delete all assessments from database">🗑️ Truncate DB</button>
          </div>
        </header>
        <main className="main-content"><Dashboard onOpen={openAssessment} onNew={newAssessment} toast={toast} /></main>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Toast toasts={toasts} removeToast={removeToast} />
      <header className="app-header">
        <div className="logo-area">
          <div className="logo-mark" style={{cursor:'pointer'}} onClick={()=>setView('dashboard')}>SA</div>
          <div className="logo-text"><h1 style={{cursor:'pointer'}} onClick={()=>setView('dashboard')}>SecAssess</h1><span>{assessment.org_name||'New Assessment'} — {assessment.environment}</span></div>
        </div>
        <div className="header-actions">
          {lastSaved && <span style={{fontSize:11,color:'var(--text-muted)',fontFamily:"'JetBrains Mono',monospace"}}>Saved {lastSaved.toLocaleTimeString()}</span>}
          <button className="btn btn-ghost btn-xs" onClick={truncateCurrentTab} title="Clear current tab data">🧹 Clear Tab</button>
          <button className="btn btn-ghost btn-xs" onClick={truncateAll} title="Clear all tabs">🗑️ Clear All</button>
          <button className="btn btn-secondary" onClick={()=>setView('dashboard')}>← Dashboard</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Saving...':'💾 Save'}</button>
        </div>
      </header>
      <main className="main-content">
        <nav className="steps-nav">
          {TABS.map((t,i) => <button key={t.id} className={`step-tab ${i===tab?'active':''}`} onClick={()=>{
              if (i > 0 && tab === 0) {
                if (!assessment.org_name?.trim() || !assessment.assessor_name?.trim() || !assessment.assessment_date) {
                  toast('Please fill in all required fields in Configuration first', 'error'); return;
                }
              }
              setTab(i);
            }}><span className="step-number">{t.icon}</span>{t.label}</button>)}
        </nav>
        {tab===0 && <ConfigStep config={assessment} setConfig={setConfig} toast={toast} />}
        {tab===1 && <AssessmentStep config={assessment} responses={assessment.responses} setResponses={updater => { if (typeof updater==='function') setAssessment(prev=>({...prev,responses:updater(prev.responses)})); else setField('responses',updater); }} />}
        {tab===2 && <CiCdDiagram diagrams={assessment.cicd_diagrams} setDiagrams={v=>setField('cicd_diagrams',v)} toast={toast} />}
        {tab===3 && <GitFlowDiagram data={assessment.gitflow_diagrams} setData={v=>setField('gitflow_diagrams',v)} toast={toast} />}
        {tab===4 && <DeploymentStrategies data={assessment.deployment_strategies} setData={v=>setField('deployment_strategies',v)} toast={toast} />}
        {tab===5 && <VersioningDiagram data={assessment.versioning_diagrams} setData={v=>setField('versioning_diagrams',v)} toast={toast} />}
        {tab===6 && <ArtifactRegistry data={assessment.artifact_repos} setData={v=>setField('artifact_repos',v)} toast={toast} />}
        {tab===7 && <PricingStep pricing={assessment.pricing} setPricing={v=>setField('pricing',v)} toast={toast} />}
        {tab===8 && <GanttChart gantt={assessment.gantt} setGantt={v=>setField('gantt',v)} toast={toast} />}
        {tab===9 && <WorkPlan workplan={assessment.workplan} setWorkplan={v=>setField('workplan',v)} toast={toast} />}
        {tab===10 && <ReviewStep assessment={assessment} toast={toast} />}
        <div className="btn-group">
          {tab>0&&<button className="btn btn-secondary" onClick={()=>setTab(t=>t-1)}>← Back</button>}
          {tab<TABS.length-1&&<button className="btn btn-primary" onClick={()=>{
            if (tab === 0) {
              if (!assessment.org_name?.trim()) { toast('Organization Name is required to continue', 'error'); return; }
              if (!assessment.assessor_name?.trim()) { toast('Assessor Name is required to continue', 'error'); return; }
              if (!assessment.assessment_date) { toast('Assessment Date is required to continue', 'error'); return; }
            }
            setTab(t=>t+1);
          }}>Continue →</button>}
          <button className="btn btn-export" onClick={save} disabled={saving}>{saving?'Saving...':'💾 Save'}</button>
        </div>
      </main>
    </div>
  );
}
export default App;
