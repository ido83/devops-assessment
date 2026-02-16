import React, { useMemo, useCallback } from 'react';
import { getFilteredCategories, computeStats, exportJSON, exportMarkdown, exportHTML } from '../utils/exporters';
import { api } from '../utils/api';

const ReviewStep = ({ assessment }) => {
  const cats = useMemo(() => getFilteredCategories(assessment.template, assessment.custom_templates), [assessment.template, assessment.custom_templates]);
  const resp = assessment.responses || {};
  const stats = useMemo(() => computeStats(cats, resp), [cats, resp]);
  const barPcts = useMemo(() => {
    const t = stats.total || 1;
    return { pass: (stats.pass/t)*100, partial: (stats.partial/t)*100, fail: (stats.fail/t)*100, na: (stats.na/t)*100 };
  }, [stats]);
  const getCatBD = useCallback((cat) => {
    let p=0,f=0,pa=0; cat.items.forEach(i => { const s=resp[i.id]?.status; if(s==='pass')p++;else if(s==='fail')f++;else if(s==='partial')pa++; });
    return {p,f,pa,t:cat.items.length};
  }, [resp]);

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
        <div className="score-bar">
          <div className="score-bar-segment pass" style={{width:`${barPcts.pass}%`}} />
          <div className="score-bar-segment partial" style={{width:`${barPcts.partial}%`}} />
          <div className="score-bar-segment fail" style={{width:`${barPcts.fail}%`}} />
          <div className="score-bar-segment na" style={{width:`${barPcts.na}%`}} />
        </div>
        <div className="score-legend">
          <div className="score-legend-item"><div className="score-legend-dot" style={{background:'var(--accent-secondary)'}} /> Pass ({stats.pass})</div>
          <div className="score-legend-item"><div className="score-legend-dot" style={{background:'var(--severity-medium)'}} /> Partial ({stats.partial})</div>
          <div className="score-legend-item"><div className="score-legend-dot" style={{background:'var(--severity-critical)'}} /> Fail ({stats.fail})</div>
          <div className="score-legend-item"><div className="score-legend-dot" style={{background:'var(--text-muted)',opacity:.5}} /> N/A ({stats.na})</div>
        </div>
      </div>
      <div className="breakdown-grid">
        {cats.map(cat => { const b=getCatBD(cat); return (
          <div key={cat.id} className="breakdown-card"><h4>{cat.icon} {cat.title}</h4>
            <div className="breakdown-mini-bar"><div className="score-bar-segment pass" style={{width:`${(b.p/b.t)*100}%`}} /><div className="score-bar-segment partial" style={{width:`${(b.pa/b.t)*100}%`}} /><div className="score-bar-segment fail" style={{width:`${(b.f/b.t)*100}%`}} /></div>
            <div className="breakdown-stats"><span style={{color:'var(--accent-secondary)'}}>✓ {b.p}</span><span style={{color:'var(--severity-medium)'}}>◐ {b.pa}</span><span style={{color:'var(--severity-critical)'}}>✗ {b.f}</span></div>
          </div>); })}
      </div>
      <div className="section-header"><h2>Export</h2></div>
      <div className="export-options">
        <div className="export-option" onClick={() => exportHTML(assessment)}><div className="export-icon">🌐</div><h4>HTML</h4><p>Styled printable report</p></div>
        <div className="export-option" onClick={() => exportMarkdown(assessment)}><div className="export-icon">📝</div><h4>Markdown</h4><p>Docs, wikis, Git</p></div>
        <div className="export-option" onClick={() => exportJSON(assessment)}><div className="export-icon">📦</div><h4>JSON</h4><p>Structured data</p></div>
        {assessment.id && <div className="export-option" onClick={() => window.open(api.exportExcelUrl(assessment.id), '_blank')}><div className="export-icon">📊</div><h4>Excel</h4><p>Spreadsheet format</p></div>}
      </div>
    </div>
  );
};
export default ReviewStep;
