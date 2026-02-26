/**
 * ReviewStep — Score summary + multi-format export.
 * PDF/Excel: captures diagram images from assessment data, POSTs to backend for embedding.
 * SQL/XML/ZIP: server GET endpoints.  HTML/MD/JSON: client-side.
 */
import React, { useState, useMemo, useCallback } from 'react';
import { getFilteredCategories, computeStats, exportJSON, exportMarkdown, exportHTML } from '../utils/exporters';
import { captureAllDiagrams } from '../utils/diagramCapture';
import { api } from '../utils/api';

const EXPORT_SECTIONS = [
  { id:'config', label:'Configuration', icon:'⚙️' },
  { id:'assessment', label:'Assessment Results', icon:'🔍' },
  { id:'cicd', label:'CI/CD Diagrams', icon:'🔄' },
  { id:'gitflow', label:'Git Flow', icon:'🌿' },
  { id:'deploy', label:'Deployment Strategies', icon:'🚀' },
  { id:'promotion', label:'Promotion Workflows', icon:'🎯' },
  { id:'artifacts', label:'Artifact Registries', icon:'📦' },
  { id:'versioning', label:'Versioning', icon:'🏷️' },
  { id:'pricing', label:'Pricing', icon:'💰' },
  { id:'gantt', label:'Gantt Chart', icon:'📅' },
  { id:'workplan', label:'Work Plan', icon:'📋' },
];
const EXPORT_FORMATS = [
  { id:'html', icon:'🌐', label:'HTML', desc:'Styled printable report', server:false },
  { id:'markdown', icon:'📝', label:'Markdown', desc:'Docs, wikis, Git', server:false },
  { id:'json', icon:'📦', label:'JSON', desc:'Full structured data', server:false },
  { id:'excel', icon:'📊', label:'Excel', desc:'All tabs + diagrams', server:true },
  { id:'pdf', icon:'📕', label:'PDF', desc:'PDF with diagrams', server:true },
  { id:'xml', icon:'📄', label:'XML', desc:'Structured XML export', server:true },
  { id:'sql', icon:'🗃️', label:'SQL', desc:'SQL INSERT statements', server:true },
  { id:'zip', icon:'🗜️', label:'ZIP Bundle', desc:'ZIP with PDF+XLSX+Images+HTML+JSON+SQL+XML', server:true },
];

const ReviewStep = ({ assessment, toast }) => {
  const cats = useMemo(() => getFilteredCategories(assessment.template, assessment.custom_templates), [assessment.template, assessment.custom_templates]);
  const resp = assessment.responses || {};
  const stats = useMemo(() => computeStats(cats, resp), [cats, resp]);
  const barPcts = useMemo(() => { const t=stats.total||1; return { pass:(stats.pass/t)*100, partial:(stats.partial/t)*100, fail:(stats.fail/t)*100, na:(stats.na/t)*100 }; }, [stats]);
  const getCatBD = useCallback((cat) => { let p=0,f=0,pa=0; cat.items.forEach(i => { const s=resp[i.id]?.status; if(s==='pass')p++;else if(s==='fail')f++;else if(s==='partial')pa++; }); return {p,f,pa,t:cat.items.length}; }, [resp]);

  const [selectedSections, setSelectedSections] = useState(EXPORT_SECTIONS.map(s => s.id));
  const [exporting, setExporting] = useState(null); // currently exporting format or null
  const toggleSection = (id) => setSelectedSections(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);

  /** Export with diagram image capture for PDF/Excel/ZIP */
  const doExport = async (format) => {
    if (selectedSections.length === 0) { toast?.('Select at least one section', 'error'); return; }
    const data = { ...assessment, _exportSections: selectedSections };
    const needSave = !assessment.id;

    switch (format) {
      case 'html': exportHTML(data, selectedSections); break;
      case 'markdown': exportMarkdown(data, selectedSections); break;
      case 'json': exportJSON(data, selectedSections); break;
      case 'excel':
      case 'pdf':
      case 'zip': {
        if (needSave) { toast?.('Save assessment first', 'error'); return; }
        setExporting(format);
        try {
          toast?.('Capturing diagrams...', 'info');
          const images = await captureAllDiagrams(assessment);
          if (format === 'pdf') {
            await api.exportPdf(assessment.id, images, assessment.org_name, selectedSections);
          } else if (format === 'excel') {
            await api.exportExcel(assessment.id, images, assessment.org_name, selectedSections);
          } else {
            await api.exportZip(assessment.id, images, assessment.org_name, selectedSections);
          }
          toast?.(`${format.toUpperCase()} downloaded`, 'success');
        } catch (e) { toast?.('Export failed: ' + e.message, 'error'); }
        setExporting(null);
        break;
      }
      case 'sql':
        if (needSave) { toast?.('Save assessment first', 'error'); return; }
        window.open(api.exportSqlUrl(assessment.id), '_blank'); break;
      case 'xml':
        if (needSave) { toast?.('Save assessment first', 'error'); return; }
        window.open(api.exportXmlUrl(assessment.id), '_blank'); break;
      default: toast?.('Format not supported', 'info');
    }
  };

  return (
    <div className="animate-in">
      <div className="section-header"><h2>Review & Export</h2></div>
      <div className="review-summary">
        <div className="summary-card score animate-in stagger-1"><div className="summary-value">{stats.score}%</div><div className="summary-label">Score</div></div>
        <div className="summary-card pass animate-in stagger-2"><div className="summary-value">{stats.pass}</div><div className="summary-label">Passed</div></div>
        <div className="summary-card fail animate-in stagger-3"><div className="summary-value">{stats.fail}</div><div className="summary-label">Failed</div></div>
        <div className="summary-card items animate-in stagger-4"><div className="summary-value">{stats.total}</div><div className="summary-label">Total</div></div>
      </div>
      <div className="score-bar-container"><h4>Distribution</h4>
        <div className="score-bar"><div className="score-bar-segment pass" style={{width:`${barPcts.pass}%`}}/><div className="score-bar-segment partial" style={{width:`${barPcts.partial}%`}}/><div className="score-bar-segment fail" style={{width:`${barPcts.fail}%`}}/><div className="score-bar-segment na" style={{width:`${barPcts.na}%`}}/></div>
        <div className="score-legend"><div className="score-legend-item"><div className="score-legend-dot" style={{background:'var(--accent-secondary)'}}/> Pass ({stats.pass})</div><div className="score-legend-item"><div className="score-legend-dot" style={{background:'var(--severity-medium)'}}/> Partial ({stats.partial})</div><div className="score-legend-item"><div className="score-legend-dot" style={{background:'var(--severity-critical)'}}/> Fail ({stats.fail})</div><div className="score-legend-item"><div className="score-legend-dot" style={{background:'var(--text-muted)',opacity:.5}}/> N/A ({stats.na})</div></div>
      </div>
      <div className="breakdown-grid">
        {cats.map(cat => { const b=getCatBD(cat); return (
          <div key={cat.id} className="breakdown-card"><h4>{cat.icon} {cat.title}</h4>
            <div className="breakdown-mini-bar"><div className="score-bar-segment pass" style={{width:`${(b.p/b.t)*100}%`}}/><div className="score-bar-segment partial" style={{width:`${(b.pa/b.t)*100}%`}}/><div className="score-bar-segment fail" style={{width:`${(b.f/b.t)*100}%`}}/></div>
            <div className="breakdown-stats"><span style={{color:'var(--accent-secondary)'}}>✓ {b.p}</span><span style={{color:'var(--severity-medium)'}}>◐ {b.pa}</span><span style={{color:'var(--severity-critical)'}}>✗ {b.f}</span></div>
          </div>);})}
      </div>
      <div className="section-header" style={{marginTop:32}}><h2>Export</h2></div>
      <div className="export-section-picker">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <label style={{fontSize:12,fontFamily:"'JetBrains Mono',monospace",color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.5px'}}>Include Sections ({selectedSections.length}/{EXPORT_SECTIONS.length})</label>
          <div style={{display:'flex',gap:6}}>
            <button className="btn btn-ghost btn-xs" onClick={()=>setSelectedSections(EXPORT_SECTIONS.map(s=>s.id))}>Select All</button>
            <button className="btn btn-ghost btn-xs" onClick={()=>setSelectedSections([])}>Clear</button>
          </div>
        </div>
        <div className="export-section-grid">
          {EXPORT_SECTIONS.map(s => (
            <button key={s.id} className={`export-section-chip ${selectedSections.includes(s.id)?'selected':''}`} onClick={()=>toggleSection(s.id)}>
              <span>{s.icon}</span><span>{s.label}</span>{selectedSections.includes(s.id)&&<span className="export-check">✓</span>}
            </button>))}
        </div>
      </div>
      <div className="export-options">
        {EXPORT_FORMATS.map(f => (
          <div key={f.id} className={`export-option ${selectedSections.length===0?'disabled':''} ${f.server&&!assessment.id?'disabled':''} ${exporting===f.id?'exporting':''}`} onClick={()=>!exporting&&doExport(f.id)}>
            <div className="export-icon">{exporting===f.id?'⏳':f.icon}</div><h4>{f.label}</h4><p>{exporting===f.id?'Generating...':f.desc}</p>
            {f.server&&!assessment.id&&<small style={{color:'var(--severity-medium)',fontSize:9}}>Save first</small>}
          </div>))}
      </div>
    </div>);
};
export default ReviewStep;
