import React, { useState, useCallback, useEffect, useRef } from 'react';
import './styles/App.css';

const APP_VERSION = process.env.REACT_APP_VERSION || '?';
const GIT_SHA = process.env.REACT_APP_GIT_SHA || 'dev';
const GIT_BRANCH = process.env.REACT_APP_GIT_BRANCH || 'main';
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
import PromotionDiagram from './components/PromotionDiagram';
import { api } from './utils/api';
import { computeStats, getFilteredCategories } from './utils/exporters';

const TABS = [
  { id:'config', label:'Configure', icon:'⚙️' },
  { id:'assess', label:'Assess', icon:'🔍' },
  { id:'cicd', label:'CI/CD', icon:'🔄' },
  { id:'gitflow', label:'Git Flow', icon:'🌿' },
  { id:'deploy', label:'Deploy Strategy', icon:'🚀' },
  { id:'promotion', label:'Promotion', icon:'🎯' },
  { id:'versioning', label:'Versioning', icon:'🏷️' },
  { id:'artifacts', label:'Artifacts', icon:'📦' },
  { id:'pricing', label:'Pricing', icon:'💰' },
  { id:'gantt', label:'Gantt', icon:'📅' },
  { id:'workplan', label:'Work Plan', icon:'📋' },
  { id:'review', label:'Review & Export', icon:'📊' },
];

const DATA_FIELDS = ['responses','pricing','gantt','workplan','cicd_diagrams','gitflow_diagrams','artifact_repos','deployment_strategies','versioning_diagrams','promotion_workflows','custom_templates'];

const emptyAssessment = () => ({
  id: null,
  org_name: '', assessor_name: '', assessment_date: new Date().toISOString().split('T')[0],
  environment: 'production', scope: '', template: 'full',
  responses: {}, pricing: {}, gantt: {}, workplan: {}, cicd_diagrams: {},
  gitflow_diagrams: {}, artifact_repos: {}, deployment_strategies: {}, versioning_diagrams: {},
  promotion_workflows: {}, custom_templates: [], score: 0, status: 'draft',
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
  const [dashKey, setDashKey] = useState(0);
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
    const fieldMap = { assess:'responses', pricing:'pricing', gantt:'gantt', workplan:'workplan', cicd:'cicd_diagrams', gitflow:'gitflow_diagrams', deploy:'deployment_strategies', promotion:'promotion_workflows', versioning:'versioning_diagrams', artifacts:'artifact_repos', config:null, review:null };
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
    try { await api.truncateAll(); setDashKey(k => k + 1); toast('Database truncated', 'success'); } catch (e) { toast('Failed: ' + e.message, 'error'); }
  };

  const newAssessment = () => { setAssessment(emptyAssessment()); setTab(0); setView('editor'); setLastSaved(null); };

  if (view === 'dashboard') {
    return (
      <div className="app-container">
        <Toast toasts={toasts} removeToast={removeToast} />
        <header className="app-header">
          <div className="logo-area"><div className="logo-mark"><svg width="104" height="55" viewBox="-20.21 56.72 333.89 177.33" xmlns="http://www.w3.org/2000/svg"><path fill="#a29bfe" d="m93.09 176.17 20.91 1.54v17.86s-39.07 38.48-96-7.08h19.4l2.15-17.55s22.14 22.47 53.54 5.23z"/><path fill="#6c63ff" d="m22.28 93.66s-42.49 39.56-7.7 90.21l19.42 1.85 1.85-18.78s-17.85-29.25 5.21-52.34l-20.68-1.6z"/><path fill="#c4b5fd" d="m26.9 90.89s53-34.17 93.29 7.08l-17.86-1.23-1.85 20s-20.32-24.62-54.18-5.53l-20.63-.92z"/><path fill="#54caff" d="m105.1 121.68 1.23-20.63 18.78 1.85 56.65 63.11h-19.39l-1.85 17.55z"/><path fill="#00b4d8" d="m98.33 172.79 71.73-79.13 19.09 1.85-1.23 19.4-70.5 78.5.3-20.32z"/><path fill="#55efc4" d="m172.83 90.81 19.86 1.62-1.38 18.94s29.32-18.71 50.8 1.15l21 .92 1.89-18.44s-32.82-37-92.17-4.19z"/><path fill="#00b894" d="m245.11 115.52 21 1.23 1.62-18.55s45.95 51.19-3.7 95.21l-20.31-1.41 1.85-21s27.48-30.77-.46-55.48z"/><path fill="#00cec9" d="m186.69 170.94-21.21-1.85-1.19 18.71s37.64 43.41 94.44 8.77l-19.4-1.57 1.85-20.09s-24.71 19.81-54.49-3.97z"/><path fill="#55efc4" d="m213.53 138.6v7a3.77 3.77 0 0 0 -.09.83 3.86 3.86 0 0 0 .09.84v11.28h-5.24v-20z"/><path fill="#55efc4" d="m218.14 138.6a8.32 8.32 0 0 0 -4.61 2.17 8 8 0 0 0 -3.07 5.67 8.53 8.53 0 0 0 3.07 6 6.79 6.79 0 0 0 4.09 1.85c4.87.12 7.27-4.07 7.27-7.84s-2.98-8.07-6.75-7.85zm-1.59 11.31a3.19 3.19 0 0 1 -3-2.63 3.86 3.86 0 0 1 -.09-.84 3.77 3.77 0 0 1 .09-.83 3.19 3.19 0 0 1 3-2.63 3.48 3.48 0 0 1 0 6.93zm18.76-5.34c-.76-.24-3.57-.68-3.57-1.74 0-.6.86-.67 1.28-.65 1.2 0 3 1.43 4 1.16.89-.23 1.67-2.53 2-3.31a12.77 12.77 0 0 0 -8.34-1.52 5 5 0 0 0 -3.77 6.6c1.27 3.29 5.17 2 7.14 4 .81.84-.86 1.22-1.41 1.2a11.85 11.85 0 0 1 -4.74-1.8c-.49.7-2 2.37-1.82 3.24s2.17 1.52 3 1.78c2.78.9 7.07 1.24 9.16-1.29 2.61-3.04.33-6.61-2.93-7.67zm-40.69-11.51a11 11 0 1 0 11 11 11 11 0 0 0 -11-11zm0 16.61a5.64 5.64 0 1 1 5.65-5.64 5.64 5.64 0 0 1 -5.66 5.64z"/><path fill="#a29bfe" d="m90.44 138.35h-6.27l6.63 17.34h2.86v-7.39zm6.45.03h6.27l-6.64 17.34h-2.86v-7.39zm-36.89-2.47a15.09 15.09 0 0 0 -7.1-2.62c-3.38-.32-7 .09-10.13.09v22.29h.15c.6.07 1.2.13 1.81.17a39.73 39.73 0 0 0 7.22-.06c4.59-.51 7.54-2 9.35-3.94a10.11 10.11 0 0 0 2.55-6.54v-.53-.28c-.04-3.17-.95-6.36-3.85-8.58zm-5.1 13.62c-1.89 1.06-4.19.8-6.27.8v-11.61c2.21 0 4.7-.29 6.64 1.07 3.22 2.27 3.1 7.78-.4 9.74zm26.52 1.74c-.51-.43-1.16-1.16-1.85-1.28-1.1-.15-2.47 1.33-3.69 1.45-1.9.19-3.27-1.12-4-2.7h11.56c0-3.2-.27-6.57-3-8.77-5.07-4.14-13.39-1.08-14.32 5.45-1 6.88 4.41 11.32 11 10.46a8.64 8.64 0 0 0 4.42-2c.45-.4 1.11-.95.78-1.6a3.72 3.72 0 0 0 -.9-1.01zm-3.69-5.67h-5.9a3 3 0 0 1 5.9 0z"/></svg></div><div className="logo-text"><h1>SecAssess</h1><span style={{color:'#54caff',opacity:1}}>DevOps & DevSecOps Platform</span><span className="logo-version">v{APP_VERSION} · {GIT_BRANCH} · {GIT_SHA}</span></div></div>
          <div className="header-actions">
            <button className="btn btn-ghost btn-xs" style={{color:'var(--severity-critical)'}} onClick={truncateDB} title="Delete all assessments from database">🗑️ Truncate DB</button>
          </div>
        </header>
        <main className="main-content"><Dashboard key={dashKey} onOpen={openAssessment} onNew={newAssessment} toast={toast} /></main>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Toast toasts={toasts} removeToast={removeToast} />
      <header className="app-header">
        <div className="logo-area">
          <div className="logo-mark" style={{cursor:'pointer'}} onClick={()=>setView('dashboard')}><svg width="104" height="55" viewBox="-20.21 56.72 333.89 177.33" xmlns="http://www.w3.org/2000/svg"><path fill="#a29bfe" d="m93.09 176.17 20.91 1.54v17.86s-39.07 38.48-96-7.08h19.4l2.15-17.55s22.14 22.47 53.54 5.23z"/><path fill="#6c63ff" d="m22.28 93.66s-42.49 39.56-7.7 90.21l19.42 1.85 1.85-18.78s-17.85-29.25 5.21-52.34l-20.68-1.6z"/><path fill="#c4b5fd" d="m26.9 90.89s53-34.17 93.29 7.08l-17.86-1.23-1.85 20s-20.32-24.62-54.18-5.53l-20.63-.92z"/><path fill="#54caff" d="m105.1 121.68 1.23-20.63 18.78 1.85 56.65 63.11h-19.39l-1.85 17.55z"/><path fill="#00b4d8" d="m98.33 172.79 71.73-79.13 19.09 1.85-1.23 19.4-70.5 78.5.3-20.32z"/><path fill="#55efc4" d="m172.83 90.81 19.86 1.62-1.38 18.94s29.32-18.71 50.8 1.15l21 .92 1.89-18.44s-32.82-37-92.17-4.19z"/><path fill="#00b894" d="m245.11 115.52 21 1.23 1.62-18.55s45.95 51.19-3.7 95.21l-20.31-1.41 1.85-21s27.48-30.77-.46-55.48z"/><path fill="#00cec9" d="m186.69 170.94-21.21-1.85-1.19 18.71s37.64 43.41 94.44 8.77l-19.4-1.57 1.85-20.09s-24.71 19.81-54.49-3.97z"/><path fill="#55efc4" d="m213.53 138.6v7a3.77 3.77 0 0 0 -.09.83 3.86 3.86 0 0 0 .09.84v11.28h-5.24v-20z"/><path fill="#55efc4" d="m218.14 138.6a8.32 8.32 0 0 0 -4.61 2.17 8 8 0 0 0 -3.07 5.67 8.53 8.53 0 0 0 3.07 6 6.79 6.79 0 0 0 4.09 1.85c4.87.12 7.27-4.07 7.27-7.84s-2.98-8.07-6.75-7.85zm-1.59 11.31a3.19 3.19 0 0 1 -3-2.63 3.86 3.86 0 0 1 -.09-.84 3.77 3.77 0 0 1 .09-.83 3.19 3.19 0 0 1 3-2.63 3.48 3.48 0 0 1 0 6.93zm18.76-5.34c-.76-.24-3.57-.68-3.57-1.74 0-.6.86-.67 1.28-.65 1.2 0 3 1.43 4 1.16.89-.23 1.67-2.53 2-3.31a12.77 12.77 0 0 0 -8.34-1.52 5 5 0 0 0 -3.77 6.6c1.27 3.29 5.17 2 7.14 4 .81.84-.86 1.22-1.41 1.2a11.85 11.85 0 0 1 -4.74-1.8c-.49.7-2 2.37-1.82 3.24s2.17 1.52 3 1.78c2.78.9 7.07 1.24 9.16-1.29 2.61-3.04.33-6.61-2.93-7.67zm-40.69-11.51a11 11 0 1 0 11 11 11 11 0 0 0 -11-11zm0 16.61a5.64 5.64 0 1 1 5.65-5.64 5.64 5.64 0 0 1 -5.66 5.64z"/><path fill="#a29bfe" d="m90.44 138.35h-6.27l6.63 17.34h2.86v-7.39zm6.45.03h6.27l-6.64 17.34h-2.86v-7.39zm-36.89-2.47a15.09 15.09 0 0 0 -7.1-2.62c-3.38-.32-7 .09-10.13.09v22.29h.15c.6.07 1.2.13 1.81.17a39.73 39.73 0 0 0 7.22-.06c4.59-.51 7.54-2 9.35-3.94a10.11 10.11 0 0 0 2.55-6.54v-.53-.28c-.04-3.17-.95-6.36-3.85-8.58zm-5.1 13.62c-1.89 1.06-4.19.8-6.27.8v-11.61c2.21 0 4.7-.29 6.64 1.07 3.22 2.27 3.1 7.78-.4 9.74zm26.52 1.74c-.51-.43-1.16-1.16-1.85-1.28-1.1-.15-2.47 1.33-3.69 1.45-1.9.19-3.27-1.12-4-2.7h11.56c0-3.2-.27-6.57-3-8.77-5.07-4.14-13.39-1.08-14.32 5.45-1 6.88 4.41 11.32 11 10.46a8.64 8.64 0 0 0 4.42-2c.45-.4 1.11-.95.78-1.6a3.72 3.72 0 0 0 -.9-1.01zm-3.69-5.67h-5.9a3 3 0 0 1 5.9 0z"/></svg></div>
          <div className="logo-text"><h1 style={{cursor:'pointer'}} onClick={()=>setView('dashboard')}>SecAssess</h1><span>{assessment.org_name||'New Assessment'} — {assessment.environment}</span><span className="logo-version">v{APP_VERSION} · {GIT_BRANCH} · {GIT_SHA}</span></div>
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
        <div style={{display:tab===2?'block':'none'}}><CiCdDiagram diagrams={assessment.cicd_diagrams} setDiagrams={v=>setField('cicd_diagrams',v)} toast={toast} /></div>
        <div style={{display:tab===3?'block':'none'}}><GitFlowDiagram data={assessment.gitflow_diagrams} setData={v=>setField('gitflow_diagrams',v)} toast={toast} /></div>
        <div style={{display:tab===4?'block':'none'}}><DeploymentStrategies data={assessment.deployment_strategies} setData={v=>setField('deployment_strategies',v)} toast={toast} /></div>
        <div style={{display:tab===5?'block':'none'}}><PromotionDiagram data={assessment.promotion_workflows} setData={v=>setField('promotion_workflows',v)} toast={toast} /></div>
        <div style={{display:tab===6?'block':'none'}}><VersioningDiagram data={assessment.versioning_diagrams} setData={v=>setField('versioning_diagrams',v)} toast={toast} /></div>
        {tab===7 && <ArtifactRegistry data={assessment.artifact_repos} setData={v=>setField('artifact_repos',v)} toast={toast} />}
        {tab===8 && <PricingStep pricing={assessment.pricing} setPricing={v=>setField('pricing',v)} toast={toast} />}
        {tab===9 && <GanttChart gantt={assessment.gantt} setGantt={v=>setField('gantt',v)} toast={toast} />}
        {tab===10 && <WorkPlan workplan={assessment.workplan} setWorkplan={v=>setField('workplan',v)} toast={toast} />}
        {tab===11 && <ReviewStep assessment={assessment} toast={toast} />}
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
