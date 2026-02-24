import { assessmentCategories, frameworkTemplates, severityConfig } from '../data/assessmentData';

const filterFns = {
  all: () => true,
  devsecops: (item) => item.tags.includes('devsecops'),
  devops: (item) => item.tags.includes('devops'),
  'critical-high': (item) => item.severity === 'critical' || item.severity === 'high',
  critical: (item) => item.severity === 'critical',
  categories: () => true,
};

export function getFilteredCategories(templateId, customTemplates) {
  const builtin = frameworkTemplates.find(f => f.id === templateId);
  if (builtin) {
    return assessmentCategories.map(cat => ({
      ...cat, items: cat.items.filter(builtin.filter)
    })).filter(cat => cat.items.length > 0);
  }

  const custom = (Array.isArray(customTemplates) ? customTemplates : []).find(t => t.id === templateId);
  if (custom) {
    const selIds = custom.selectedCategories || [];
    const filterFn = filterFns[custom.filterType] || filterFns.all;
    const builtinCats = assessmentCategories
      .filter(c => selIds.includes(c.id))
      .map(c => ({ ...c, items: c.items.filter(filterFn) }));
    const customCats = (custom.customCategories || []).map(c => ({
      ...c, items: (c.items || []).map(item => ({ ...item, tags: item.tags || ['custom'] })),
    }));
    return [...builtinCats, ...customCats].filter(c => c.items.length > 0);
  }

  return assessmentCategories.map(c => ({ ...c })).filter(c => c.items.length > 0);
}

export function computeStats(categories, responses) {
  let total = 0, pass = 0, fail = 0, partial = 0, na = 0, unassessed = 0;
  let totalW = 0, passedW = 0;
  categories.forEach(cat => cat.items.forEach(item => {
    total++;
    const w = severityConfig[item.severity]?.weight || 1;
    totalW += w;
    const s = responses[item.id]?.status;
    if (!s || s === '') { unassessed++; }
    else if (s === 'pass') { pass++; passedW += w; }
    else if (s === 'fail') { fail++; }
    else if (s === 'partial') { partial++; passedW += w * 0.5; }
    else if (s === 'na') { na++; totalW -= w; }
  }));
  return { total, pass, fail, partial, na, unassessed, score: totalW > 0 ? Math.round((passedW / totalW) * 100) : 0 };
}

export function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

export function exportJSON(assessment, selectedSections) {
  const sec = selectedSections || ['config','assessment','cicd','gitflow','deploy','versioning','artifacts','pricing','gantt','workplan'];
  const data = {
    metadata: { org_name: assessment.org_name, assessor_name: assessment.assessor_name, date: assessment.assessment_date, environment: assessment.environment, scope: assessment.scope, template: assessment.template },
    ...(sec.includes('assessment') ? { responses: assessment.responses || {} } : {}),
    ...(sec.includes('pricing') ? { pricing: assessment.pricing || {} } : {}),
    ...(sec.includes('gantt') ? { gantt: assessment.gantt || {} } : {}),
    ...(sec.includes('workplan') ? { workplan: assessment.workplan || {} } : {}),
    ...(sec.includes('cicd') ? { cicd_diagrams: assessment.cicd_diagrams || {} } : {}),
    ...(sec.includes('gitflow') ? { gitflow_diagrams: assessment.gitflow_diagrams || {} } : {}),
    ...(sec.includes('deploy') ? { deployment_strategies: assessment.deployment_strategies || {} } : {}),
    ...(sec.includes('artifacts') ? { artifact_repos: assessment.artifact_repos || {} } : {}),
    ...(sec.includes('versioning') ? { versioning_diagrams: assessment.versioning_diagrams || {} } : {}),
    custom_templates: assessment.custom_templates || [],
    score: assessment.score, exportedAt: new Date().toISOString(),
  };
  downloadFile(JSON.stringify(data, null, 2), `assessment-${assessment.org_name || 'report'}.json`, 'application/json');
}

export function exportMarkdown(assessment, selectedSections) {
  const sec = selectedSections || ['config','assessment','cicd','gitflow','deploy','versioning','artifacts','pricing','gantt','workplan'];
  const cats = getFilteredCategories(assessment.template, assessment.custom_templates);
  const resp = assessment.responses || {};
  const stats = computeStats(cats, resp);
  const pr = assessment.pricing || {};
  const cur = pr.currency || 'ILS';
  let md = '';
  if (sec.includes('config')) {
    md += `# DevOps/DevSecOps Security Assessment\n\n| Field | Value |\n|---|---|\n| Organization | ${assessment.org_name||'N/A'} |\n| Assessor | ${assessment.assessor_name||'N/A'} |\n| Date | ${assessment.assessment_date||'N/A'} |\n| Environment | ${assessment.environment||'N/A'} |\n| Score | **${stats.score}%** |\n\n`;
    if (assessment.scope) md += `## Scope\n${assessment.scope}\n\n`;
    md += `## Summary\nPass: ${stats.pass} | Fail: ${stats.fail} | Partial: ${stats.partial} | N/A: ${stats.na} | Unassessed: ${stats.unassessed}\n\n---\n\n`;
  }
  if (sec.includes('assessment')) {
    cats.forEach(cat => {
      md += `## ${cat.icon} ${cat.title}\n\n| Status | Severity | Control | Notes |\n|---|---|---|---|\n`;
      cat.items.forEach(item => {
        const r = resp[item.id] || {};
        const sMap = { pass: '✅', fail: '❌', partial: '⚠️', na: '➖' };
        md += `| ${sMap[r.status]||'⬜'} ${(r.status||'unassessed').toUpperCase()} | ${item.severity.toUpperCase()} | ${item.text} | ${(r.notes||'—').replace(/\n/g,' ')} |\n`;
      });
      md += '\n';
    });
  }
  if (sec.includes('pricing') && pr.engineers) {
    md += `---\n## Pricing Estimation (${cur})\n\n| Metric | Value |\n|---|---|\n| Engineers | ${pr.engineers} |\n| Duration | ${pr.duration} months |\n| Total | **${(pr.totalCost||0).toLocaleString()} ${cur}** |\n\n`;
  }
  md += `\n---\n*Generated by SecAssess v18*\n`;
  downloadFile(md, `assessment-${assessment.org_name||'report'}.md`, 'text/markdown');
}
export function exportHTML(assessment, selectedSections) {
  const sec = selectedSections || ['config','assessment','cicd','gitflow','deploy','versioning','artifacts','pricing','gantt','workplan'];
  const cats = getFilteredCategories(assessment.template, assessment.custom_templates);
  const resp = assessment.responses || {};
  const stats = computeStats(cats, resp);
  const pr = assessment.pricing || {};
  const configSection = sec.includes('config') ? `<div class="m"><div class="mi"><div class="ml">Organization</div><div class="mv">${assessment.org_name||'N/A'}</div></div><div class="mi"><div class="ml">Assessor</div><div class="mv">${assessment.assessor_name||'N/A'}</div></div><div class="mi"><div class="ml">Date</div><div class="mv">${assessment.assessment_date||'N/A'}</div></div></div><h2>Summary</h2><div class="sg"><div class="sc"><div class="sv" style="color:#6c5ce7">${stats.score}%</div><div class="sl">Score</div></div><div class="sc"><div class="sv" style="color:#00cec9">${stats.pass}</div><div class="sl">Passed</div></div><div class="sc"><div class="sv" style="color:#ff3b5c">${stats.fail}</div><div class="sl">Failed</div></div><div class="sc"><div class="sv">${stats.total}</div><div class="sl">Total</div></div></div>` : '';
  const assessmentSection = sec.includes('assessment') ? cats.map(cat=>`<h2>${cat.icon} ${cat.title}</h2><table><thead><tr><th>Status</th><th>Severity</th><th>Control</th><th>Notes</th></tr></thead><tbody>${cat.items.map(item=>{const r=resp[item.id]||{};const s=r.status||'unassessed';const sc={pass:'bp',fail:'bf',partial:'bw',na:'bn'}[s]||'bn';const sevc={critical:'bc',high:'bh',medium:'bm',low:'bl'}[item.severity]||'bn';return`<tr><td><span class="b ${sc}">${s}</span></td><td><span class="b ${sevc}">${item.severity}</span></td><td>${item.text}</td><td style="color:#8b88a2">${r.notes||'—'}</td></tr>`;}).join('')}</tbody></table>`).join('') : '';
  const pricingSection = sec.includes('pricing') && pr.engineers ? `<h2>💰 Pricing</h2><div class="m"><div class="mi"><div class="ml">Engineers</div><div class="mv">${pr.engineers}</div></div><div class="mi"><div class="ml">Duration</div><div class="mv">${pr.duration} months</div></div><div class="mi"><div class="ml">Rate</div><div class="mv">${pr.currency||'ILS'} ${pr.hourlyRate}/hr</div></div></div>` : '';
  const cicdSection = sec.includes('cicd') && (assessment.cicd_diagrams?.workflows||[]).length ? `<h2>🔄 CI/CD Workflows</h2><table><thead><tr><th>Workflow</th><th>Pipeline</th><th>Stages</th></tr></thead><tbody>${(assessment.cicd_diagrams.workflows||[]).flatMap(w=>(w.pipelines||[]).map(p=>`<tr><td>${w.name}</td><td>${p.name}</td><td>${(p.nodes||[]).length}</td></tr>`)).join('')}</tbody></table>` : '';
  const gitSection = sec.includes('gitflow') && (assessment.gitflow_diagrams?.flows||[]).length ? `<h2>🌿 Git Flow</h2><table><thead><tr><th>Flow</th><th>Nodes</th><th>Description</th></tr></thead><tbody>${(assessment.gitflow_diagrams.flows||[]).map(f=>`<tr><td>${f.name}</td><td>${(f.nodes||[]).length}</td><td>${f.description||'—'}</td></tr>`).join('')}</tbody></table>` : '';
  const deploySection = sec.includes('deploy') && (assessment.deployment_strategies?.strategies||[]).length ? `<h2>🚀 Deployment Strategies</h2><table><thead><tr><th>Strategy</th><th>Category</th><th>Stages</th></tr></thead><tbody>${(assessment.deployment_strategies.strategies||[]).map(s=>`<tr><td>${s.name}</td><td>${s.cat||'—'}</td><td>${(s.nodes||[]).length}</td></tr>`).join('')}</tbody></table>` : '';
  const verSection = sec.includes('versioning') && (assessment.versioning_diagrams?.flows||[]).length ? `<h2>🏷️ Versioning</h2><table><thead><tr><th>Scheme</th><th>Nodes</th></tr></thead><tbody>${(assessment.versioning_diagrams.flows||[]).map(f=>`<tr><td>${f.name}</td><td>${(f.nodes||[]).length}</td></tr>`).join('')}</tbody></table>` : '';
  const artifactSection = sec.includes('artifacts') && (assessment.artifact_repos?.registries||[]).length ? `<h2>📦 Artifact Registries</h2><table><thead><tr><th>Registry</th><th>Type</th><th>Repo</th></tr></thead><tbody>${(assessment.artifact_repos.registries||[]).flatMap(r=>(r.repos||[]).map(rp=>`<tr><td>${r.name}</td><td>${r.registryType||'—'}</td><td>${rp.name}</td></tr>`)).join('')}</tbody></table>` : '';
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Assessment — ${assessment.org_name||'Report'}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;background:#0a0a14;color:#e0dff0;line-height:1.6;padding:40px}.c{max-width:900px;margin:0 auto}h1{font-size:28px;margin-bottom:8px}h2{font-size:20px;margin:28px 0 12px;color:#a29bfe;border-bottom:1px solid rgba(108,92,231,.2);padding-bottom:8px}.m{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:20px 0 30px}.mi{background:#12122a;padding:14px;border-radius:8px;border:1px solid rgba(108,92,231,.15)}.ml{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#6b6890}.mv{font-size:15px;margin-top:4px}.sg{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:16px 0 28px}.sc{background:#12122a;padding:18px;border-radius:8px;text-align:center;border:1px solid rgba(108,92,231,.15)}.sv{font-size:32px;font-weight:700}.sl{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#6b6890;margin-top:4px}table{width:100%;border-collapse:collapse;margin:12px 0 24px}th{background:#16163a;padding:10px 12px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:#8b88a2;border-bottom:2px solid rgba(108,92,231,.2)}td{padding:10px 12px;border-bottom:1px solid rgba(108,92,231,.08);font-size:13px;vertical-align:top}.b{display:inline-block;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:600;text-transform:uppercase}.bp{background:rgba(0,206,201,.15);color:#00cec9}.bf{background:rgba(255,59,92,.15);color:#ff3b5c}.bw{background:rgba(255,209,102,.15);color:#ffd166}.bn{background:rgba(90,87,117,.15);color:#5a5775}.bc{background:rgba(255,59,92,.12);color:#ff3b5c}.bh{background:rgba(255,140,66,.12);color:#ff8c42}.bm{background:rgba(255,209,102,.12);color:#ffd166}.bl{background:rgba(102,217,194,.12);color:#66d9c2}.ft{margin-top:40px;text-align:center;color:#5a5775;font-size:12px;border-top:1px solid rgba(108,92,231,.1);padding-top:16px}</style></head><body><div class="c"><h1>🛡️ Security Assessment</h1>${configSection}${assessmentSection}${cicdSection}${gitSection}${deploySection}${verSection}${artifactSection}${pricingSection}<div class="ft">SecAssess v18 — ${new Date().toLocaleDateString()}</div></div></body></html>`;
  downloadFile(html, `assessment-${assessment.org_name||'report'}.html`, 'text/html');
}
