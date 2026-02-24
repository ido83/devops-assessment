/**
 * SecAssess v21 — Backend API Server
 * Express REST API + PostgreSQL (JSONB). Real PDF/ZIP exports.
 */
const express = require('express');
const cors = require('cors');
const crypto = require('node:crypto');
const { Pool } = require('pg');
const multer = require('multer');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const archiver = require('archiver');

const fs = require('fs');
function readSecret(name) {
  try { return fs.readFileSync(`/run/secrets/${name}`, 'utf8').trim(); } catch { return undefined; }
}

const app = express();
const PORT = process.env.PORT || 4000;
app.use(cors());
app.use(express.json({ limit: '50mb' }));

let dbReady = false;
app.get('/health', (_req, res) => res.json({ ok: true, db: dbReady }));
app.get('/api/health', (_req, res) => res.json({ ok: true, db: dbReady }));

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres', port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'secassess', user: process.env.DB_USER || 'secassess',
  password: readSecret('db_pass') ?? process.env.DB_PASS, max: 20, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000,
});
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
function genId() { return crypto.randomUUID(); }

const JSONB_FIELDS = ['responses','pricing','gantt','workplan','custom_templates','cicd_diagrams','gitflow_diagrams','artifact_repos','deployment_strategies','versioning_diagrams','promotion_workflows'];
const MAX_TEXT = 10000;
function san(val, maxLen = MAX_TEXT) { if (val == null) return ''; return String(val).replace(/\0/g, '').trim().slice(0, maxLen); }
function jsonSafe(val, fb = '{}') { if (!val) return fb; try { return JSON.stringify(val); } catch { return fb; } }
function parseRow(row) { if (!row) return null; JSONB_FIELDS.forEach(k => { if (typeof row[k] === 'string') { try { row[k] = JSON.parse(row[k]); } catch { row[k] = k === 'custom_templates' ? [] : {}; } } }); return row; }

/* ── CRUD ── */
app.get('/api/assessments', async (_req, res) => {
  try { const { rows } = await pool.query('SELECT id, org_name, assessor_name, assessment_date, environment, template, score, status, created_at, updated_at FROM assessments ORDER BY updated_at DESC'); res.json(rows); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/assessments/:id', async (req, res) => {
  try { const { rows } = await pool.query('SELECT * FROM assessments WHERE id = $1', [san(req.params.id,100)]); if (!rows.length) return res.status(404).json({ error: 'Not found' }); res.json(parseRow(rows[0])); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/assessments', async (req, res) => {
  try { const id = genId(); const b = req.body;
    await pool.query(`INSERT INTO assessments (id, org_name, assessor_name, assessment_date, environment, scope, template, responses, pricing, gantt, workplan, custom_templates, cicd_diagrams, gitflow_diagrams, artifact_repos, deployment_strategies, versioning_diagrams, promotion_workflows, score, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
      [id, san(b.org_name,500), san(b.assessor_name,500), san(b.assessment_date,50), san(b.environment,100), san(b.scope), san(b.template,100), jsonSafe(b.responses), jsonSafe(b.pricing), jsonSafe(b.gantt), jsonSafe(b.workplan), jsonSafe(b.custom_templates,'[]'), jsonSafe(b.cicd_diagrams), jsonSafe(b.gitflow_diagrams), jsonSafe(b.artifact_repos), jsonSafe(b.deployment_strategies), jsonSafe(b.versioning_diagrams), jsonSafe(b.promotion_workflows), parseInt(b.score)||0, san(b.status,50)||'draft']);
    res.json({ id }); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/assessments/:id', async (req, res) => {
  try { const b = req.body;
    const { rowCount } = await pool.query(`UPDATE assessments SET org_name=$1, assessor_name=$2, assessment_date=$3, environment=$4, scope=$5, template=$6, responses=$7, pricing=$8, gantt=$9, workplan=$10, custom_templates=$11, cicd_diagrams=$12, gitflow_diagrams=$13, artifact_repos=$14, deployment_strategies=$15, versioning_diagrams=$16, promotion_workflows=$17, score=$18, status=$19, updated_at=NOW() WHERE id=$20`,
      [san(b.org_name,500), san(b.assessor_name,500), san(b.assessment_date,50), san(b.environment,100), san(b.scope), san(b.template,100), jsonSafe(b.responses), jsonSafe(b.pricing), jsonSafe(b.gantt), jsonSafe(b.workplan), jsonSafe(b.custom_templates,'[]'), jsonSafe(b.cicd_diagrams), jsonSafe(b.gitflow_diagrams), jsonSafe(b.artifact_repos), jsonSafe(b.deployment_strategies), jsonSafe(b.versioning_diagrams), jsonSafe(b.promotion_workflows), parseInt(b.score)||0, san(b.status,50)||'draft', san(req.params.id,100)]);
    if (!rowCount) return res.status(404).json({ error: 'Not found' }); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/assessments/truncate-all', async (_req, res) => { try { await pool.query('DELETE FROM assessments'); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
app.delete('/api/assessments/:id', async (req, res) => { try { const { rowCount } = await pool.query('DELETE FROM assessments WHERE id = $1', [san(req.params.id,100)]); if (!rowCount) return res.status(404).json({ error: 'Not found' }); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: e.message }); } });

/* ── Import ── */
app.post('/api/import/json', upload.single('file'), async (req, res) => {
  try { let data; if (req.file) data = JSON.parse(req.file.buffer.toString('utf8')); else if (req.body.data) data = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body.data; else return res.status(400).json({ error: 'No data' });
    const items = Array.isArray(data) ? data : [data]; const ids = [];
    for (const item of items) { const id = genId(); const m = item.metadata || item;
      await pool.query(`INSERT INTO assessments (id, org_name, assessor_name, assessment_date, environment, scope, template, responses, pricing, gantt, workplan, custom_templates, cicd_diagrams, gitflow_diagrams, artifact_repos, deployment_strategies, versioning_diagrams, promotion_workflows, score, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
        [id, san(m.org_name||m.organization,500), san(m.assessor_name||m.assessor,500), san(m.assessment_date||m.date,50), san(m.environment,100), san(m.scope), san(m.template,100), jsonSafe(item.responses||m.responses), jsonSafe(item.pricing||m.pricing), jsonSafe(item.gantt||m.gantt), jsonSafe(item.workplan||m.workplan), jsonSafe(item.custom_templates||m.custom_templates,'[]'), jsonSafe(item.cicd_diagrams||m.cicd_diagrams), jsonSafe(item.gitflow_diagrams||m.gitflow_diagrams), jsonSafe(item.artifact_repos||m.artifact_repos), jsonSafe(item.deployment_strategies||m.deployment_strategies), jsonSafe(item.versioning_diagrams||m.versioning_diagrams), jsonSafe(item.promotion_workflows||m.promotion_workflows), parseInt(item.score||m.score)||0, 'imported']);
      ids.push(id); } res.json({ imported: ids.length, ids }); }
  catch (e) { res.status(400).json({ error: 'Invalid: ' + e.message }); }
});

/* ═══ Shared report data builder ═══ */
function buildReportData(row) {
  const resp = row.responses || {};
  const pr = row.pricing || {};
  const respEntries = Object.entries(resp);
  const countFlows = (obj, key) => { if (!obj) return 0; const a = obj[key]; return Array.isArray(a) ? a.length : 0; };
  const sections = [
    { title:'Configuration', items:[['Organization',row.org_name],['Assessor',row.assessor_name],['Date',row.assessment_date],['Environment',row.environment],['Score',row.score+'%'],['Status',row.status]] },
    { title:'Assessment Responses', table:{ headers:['Control ID','Status','Notes'], rows: respEntries.map(([id,r])=>[id,r.status||'—',r.notes||'—']) } },
    { title:'CI/CD Workflows', count: countFlows(row.cicd_diagrams,'workflows'), flows: (row.cicd_diagrams?.workflows||[]).flatMap(w=>(w.pipelines||[]).map(p=>({name:p.name,nodes:(p.nodes||[]).length,desc:p.description||''}))) },
    { title:'Git Flow', count: countFlows(row.gitflow_diagrams,'flows'), flows: (row.gitflow_diagrams?.flows||[]).map(f=>({name:f.name,nodes:(f.nodes||[]).length,desc:f.description||''})) },
    { title:'Deployment Strategies', count: countFlows(row.deployment_strategies,'strategies'), flows: (row.deployment_strategies?.strategies||[]).map(s=>({name:s.name,cat:s.cat||'',nodes:(s.nodes||[]).length,desc:s.description||''})) },
    { title:'Promotion Workflows', count: countFlows(row.promotion_workflows,'workflows'), flows: (row.promotion_workflows?.workflows||[]).map(w=>({name:w.name,cat:w.cat||'',nodes:(w.nodes||[]).length,desc:w.description||''})) },
    { title:'Versioning', count: countFlows(row.versioning_diagrams,'flows'), flows: (row.versioning_diagrams?.flows||[]).map(f=>({name:f.name,nodes:(f.nodes||[]).length,desc:f.description||''})) },
    { title:'Artifact Registries', count: countFlows(row.artifact_repos,'registries'), flows: (row.artifact_repos?.registries||[]).map(r=>({name:r.name,type:r.registryType,repos:(r.repos||[]).length})) },
  ];
  if (pr.engineers) {
    const rate = (pr.hourlyRate||0) * 160;
    const base = rate * (pr.engineers||0) * (pr.duration||0);
    const cont = base * ((pr.contingency||0)/100);
    const total = base + cont;
    sections.push({ title:'Pricing', items:[['Engineers',pr.engineers],['Duration',pr.duration+' months'],['Hourly Rate',(pr.currency||'ILS')+' '+pr.hourlyRate],['Estimation Mode',pr.estimationMode||'price'],['Total Cost',(pr.currency||'ILS')+' '+total.toLocaleString()]], phases: pr.phases });
  }
  /* Gantt + Work Plan always included so PDF/Excel get the tabs */
  sections.push({ title:'Gantt Chart', ganttTasks: (row.gantt?.tasks || []) });
  const wp = row.workplan || {};
  sections.push({ title:'Work Plan', workplanData: { milestones: wp.milestones||[], teamRoles: wp.teamRoles||[], riskItems: wp.riskItems||[] } });
  return { meta: { org: row.org_name, assessor: row.assessor_name, date: row.assessment_date, env: row.environment, score: row.score, status: row.status }, sections, respEntries, pricing: pr };
}

/* ═══════════════════════════════════════════════════════════════════
 * PDF GENERATOR — returns a Buffer (used by PDF endpoint + ZIP)
 * ═══════════════════════════════════════════════════════════════════ */
function generatePdfBuffer(row, images, exportSections) {
  return new Promise((resolve, reject) => {
    const rpt = buildReportData(row);
    const secIncludes = (id) => !exportSections || exportSections.includes(id);

    const F = { title:44, heading:28, subhead:16, body:13, table:11, caption:11, small:9 };
    const stripEmoji = (s) => String(s||'').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}]/gu,'').trim();
    const cl = (s) => stripEmoji(String(s||'—'));
    const MARGIN = 52;
    const PW = 595 - MARGIN * 2;
    const PH = 842 - MARGIN * 2;
    const C = { accent:'#4a3fbf', light:'#a29bfe', muted:'#6b6890', text:'#1e1a3a', pass:'#00b894', fail:'#e63757', partial:'#f59e0b', na:'#9ca3af', rowAlt:'#f4f2ff', hdrBg:'#ece9ff' };

    const doc = new PDFDocument({ size:'A4', margins:{ top:MARGIN, bottom:MARGIN, left:MARGIN, right:MARGIN }, info:{ Title:`SecAssess Report — ${rpt.meta.org}`, Author:rpt.meta.assessor } });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const startSection = (title, subtitle) => {
      doc.addPage();
      doc.rect(MARGIN, MARGIN, 6, 60).fill(C.accent);
      doc.fontSize(F.heading).fillColor(C.accent).text(cl(title), MARGIN+16, MARGIN+8, { width:PW-16 });
      if (subtitle) doc.fontSize(F.body).fillColor(C.muted).text(cl(subtitle), MARGIN+16, MARGIN+42, { width:PW-16 });
      doc.moveTo(MARGIN, MARGIN+68).lineTo(MARGIN+PW, MARGIN+68).strokeColor('#c8c4ee').lineWidth(0.6).stroke();
      doc.y = MARGIN + 80;
    };

    const guardOverflow = (needed = 20) => {
      if (doc.y + needed > MARGIN + PH) { doc.addPage(); doc.y = MARGIN; }
    };

    const embedSectionImages = (sectionKey) => {
      const matched = images.filter(img => img.section === sectionKey);
      if (!matched.length) return;
      doc.moveDown(0.6);
      doc.fontSize(F.subhead).fillColor(C.accent).text('Workflow Diagrams', MARGIN, doc.y);
      doc.moveDown(0.4);
      for (const img of matched) {
        try {
          const iw = img.width||600; const ih = img.height||300;
          const scale = Math.min(PW/iw, Math.round(PH*0.58)/ih, 1);
          const dw = Math.round(iw*scale); const dh = Math.round(ih*scale);
          if (doc.y + 24+dh+14 > MARGIN+PH) { doc.addPage(); doc.y = MARGIN; }
          const caption = cl(img.name).replace(/^(CI\/CD|Git Flow|Deploy|Version):\s*/i,'');
          doc.fontSize(F.caption).fillColor(C.muted).text(caption, MARGIN, doc.y, { width:PW });
          doc.moveDown(0.25);
          doc.image(Buffer.from(img.data,'base64'), MARGIN+Math.round((PW-dw)/2), doc.y, { width:dw, height:dh });
          doc.y += dh + 14;
        } catch { doc.fontSize(F.small).fillColor(C.muted).text(`[Image unavailable: ${cl(img.name)}]`, MARGIN, doc.y); doc.moveDown(0.5); }
      }
    };

    /* ── COVER PAGE ── */
    doc.rect(0,0,595,180).fill('#0d0b1e');
    doc.fontSize(F.title).fillColor('#ffffff').text('SecAssess', MARGIN, 60, { align:'center', width:PW });
    doc.fontSize(F.subhead).fillColor(C.light).text('Security Assessment Report', MARGIN, 120, { align:'center', width:PW });
    doc.fontSize(F.body).fillColor(C.text).text(cl(rpt.meta.org), MARGIN, 210, { align:'center', width:PW });
    doc.fontSize(F.body).fillColor(C.muted).text(`Assessor: ${cl(rpt.meta.assessor)}`, MARGIN, 232, { align:'center', width:PW });
    doc.fontSize(F.table).fillColor(C.muted).text(new Date().toLocaleDateString('en-GB',{ year:'numeric',month:'long',day:'numeric' }), MARGIN, 252, { align:'center', width:PW });
    const bx = MARGIN+Math.round((PW-220)/2); const by = 290;
    doc.roundedRect(bx,by,220,100,12).fillAndStroke('#f4f2ff',C.accent);
    doc.fontSize(54).fillColor(C.accent).text(`${rpt.meta.score}%`, bx, by+8, { align:'center', width:220 });
    doc.fontSize(F.table).fillColor(C.muted).text('Overall Security Score', bx, by+68, { align:'center', width:220 });
    const statY=420; const statW=Math.round(PW/3);
    [['Pass',rpt.respEntries.filter(([,r])=>r.status==='pass').length,C.pass],['Partial',rpt.respEntries.filter(([,r])=>r.status==='partial').length,C.partial],['Fail',rpt.respEntries.filter(([,r])=>r.status==='fail').length,C.fail]].forEach(([label,count,color],i)=>{
      const sx=MARGIN+i*statW;
      doc.roundedRect(sx+4,statY,statW-8,64,8).fill(color+'18');
      doc.fontSize(28).fillColor(color).text(String(count),sx+4,statY+6,{align:'center',width:statW-8});
      doc.fontSize(F.small).fillColor(C.muted).text(label,sx+4,statY+40,{align:'center',width:statW-8});
    });
    doc.fontSize(F.small).fillColor(C.muted).text('Generated by SecAssess v21', MARGIN, PH+MARGIN-20, { align:'center', width:PW });

    /* ── TABLE OF CONTENTS ── */
    doc.addPage();
    doc.rect(MARGIN,MARGIN,6,36).fill(C.accent);
    doc.fontSize(F.heading).fillColor(C.accent).text('Contents', MARGIN+16, MARGIN+8, { width:PW-16 });
    doc.y = MARGIN+56;
    const secIdMap = { 'Configuration':'config','Assessment Responses':'assessment','CI/CD Workflows':'cicd','Git Flow':'gitflow','Deployment Strategies':'deploy','Promotion Workflows':'promotion','Versioning':'versioning','Artifact Registries':'artifacts','Pricing':'pricing','Gantt Chart':'gantt','Work Plan':'workplan' };
    const diagramSectionKey = { 'CI/CD Workflows':'cicd','Git Flow':'gitflow','Deployment Strategies':'deploy','Promotion Workflows':'promotion','Versioning':'versioning' };
    let tocIndex = 1;
    for (const sec of rpt.sections) {
      const secId = secIdMap[sec.title];
      if (secId && !secIncludes(secId)) continue;
      guardOverflow(22);
      doc.fontSize(F.body).fillColor(C.text).text(`${tocIndex++}.  ${cl(sec.title)}`, MARGIN+10, doc.y, { width:PW-10 });
      doc.moveDown(0.5);
    }

    /* ── SECTIONS ── */
    for (const sec of rpt.sections) {
      const secId = secIdMap[sec.title];
      if (secId && !secIncludes(secId)) continue;
      startSection(sec.title);

      /* Key-value pairs */
      if (sec.items) {
        for (const [k,v] of sec.items) {
          guardOverflow(26);
          doc.fontSize(F.body).fillColor(C.accent).text(cl(k)+':', MARGIN, doc.y, { continued:true, width:160 });
          doc.fillColor(C.text).text('  '+cl(v), { width:PW-160 });
          doc.moveDown(0.55);
        }
      }

      /* Assessment table */
      if (sec.table) {
        const cW=[130,85,PW-225];
        guardOverflow(30);
        const hY=doc.y+4;
        doc.rect(MARGIN,hY,PW,26).fill(C.hdrBg);
        doc.fontSize(F.table).fillColor(C.accent)
           .text('Control ID',MARGIN+8,hY+7,{width:cW[0],lineBreak:false})
           .text('Status',MARGIN+8+cW[0],hY+7,{width:cW[1],lineBreak:false})
           .text('Notes',MARGIN+8+cW[0]+cW[1],hY+7,{width:cW[2],lineBreak:false});
        doc.y = hY+28;
        sec.table.rows.slice(0,300).forEach((r,idx)=>{
          guardOverflow(20);
          const ry=doc.y;
          if(idx%2===0) doc.rect(MARGIN,ry,PW,19).fill(C.rowAlt);
          const sc={pass:C.pass,fail:C.fail,partial:C.partial,na:C.na}[r[1]]||C.muted;
          doc.fontSize(F.table).fillColor(C.muted).text(String(r[0]).slice(0,24),MARGIN+8,ry+5,{width:cW[0],lineBreak:false});
          doc.fillColor(sc).text(String(r[1]||'—').toUpperCase(),MARGIN+8+cW[0],ry+5,{width:cW[1],lineBreak:false});
          doc.fillColor(C.text).text(String(r[2]||'—').slice(0,90),MARGIN+8+cW[0]+cW[1],ry+5,{width:cW[2],lineBreak:false});
          doc.y = ry+20;
        });
        if (sec.table.rows.length>300) { guardOverflow(20); doc.fontSize(F.small).fillColor(C.muted).text(`… and ${sec.table.rows.length-300} more controls not shown`); }
      }

      /* Flow lists */
      if (sec.flows?.length) {
        for (const f of sec.flows) {
          guardOverflow(24);
          const parts=[f.cat&&`[${cl(f.cat)}]`,f.nodes!=null&&`${f.nodes} stages`,f.repos!=null&&`${f.repos} repos`,f.desc&&cl(f.desc).slice(0,70)].filter(Boolean).join('  ·  ');
          doc.fontSize(F.body).fillColor(C.text).text(`•  ${cl(f.name)}`,MARGIN+12,doc.y,{continued:!!parts,width:PW-12});
          if(parts) doc.fillColor(C.muted).text(`    ${parts}`,{width:PW-12});
          doc.moveDown(0.45);
        }
      }

      if (!sec.items && !sec.table && !sec.flows?.length && !sec.ganttTasks && !sec.workplanData && sec.count===0) {
        doc.fontSize(F.body).fillColor(C.muted).text('(none configured)');
      }

      /* Pricing phases */
      if (sec.phases?.length) {
        doc.moveDown(0.4);
        doc.fontSize(F.subhead).fillColor(C.accent).text('Project Phases');
        doc.moveDown(0.3);
        for (const p of sec.phases) {
          guardOverflow(22);
          doc.fontSize(F.body).fillColor(C.text).text(`•  ${cl(p.name)}:  ${p.percentage}%  —  ${p.months} months`,{indent:14});
          doc.moveDown(0.35);
        }
      }

      /* ── Gantt Chart ── */
      if (sec.ganttTasks !== undefined) {
        const tasks = sec.ganttTasks;
        if (!tasks.length) {
          doc.fontSize(F.body).fillColor(C.muted).text('(no tasks configured)');
        } else {
          const cW=[PW-200,75,55,60,0]; cW[4]=PW-cW.slice(0,4).reduce((a,b)=>a+b,0);
          guardOverflow(30);
          const hY=doc.y+4;
          doc.rect(MARGIN,hY,PW,26).fill(C.hdrBg);
          doc.fontSize(F.table).fillColor(C.accent)
             .text('Task',MARGIN+8,hY+7,{width:cW[0],lineBreak:false})
             .text('Category',MARGIN+8+cW[0],hY+7,{width:cW[1],lineBreak:false})
             .text('Start',MARGIN+8+cW[0]+cW[1],hY+7,{width:cW[2],lineBreak:false})
             .text('Duration',MARGIN+8+cW[0]+cW[1]+cW[2],hY+7,{width:cW[3],lineBreak:false})
             .text('Deps',MARGIN+8+cW[0]+cW[1]+cW[2]+cW[3],hY+7,{width:cW[4],lineBreak:false});
          doc.y = hY+28;
          tasks.forEach((t,idx)=>{
            guardOverflow(20);
            const ry=doc.y;
            if(idx%2===0) doc.rect(MARGIN,ry,PW,19).fill(C.rowAlt);
            doc.fontSize(F.table).fillColor(C.text).text(String(t.name||'—').slice(0,45),MARGIN+8,ry+5,{width:cW[0],lineBreak:false});
            doc.fillColor(C.muted)
               .text(String(t.category||'—'),MARGIN+8+cW[0],ry+5,{width:cW[1],lineBreak:false})
               .text(t.start!=null?'Wk '+(t.start+1):'—',MARGIN+8+cW[0]+cW[1],ry+5,{width:cW[2],lineBreak:false})
               .text((t.duration||'—')+' wk',MARGIN+8+cW[0]+cW[1]+cW[2],ry+5,{width:cW[3],lineBreak:false})
               .text((t.deps||[]).join(',')||'—',MARGIN+8+cW[0]+cW[1]+cW[2]+cW[3],ry+5,{width:cW[4],lineBreak:false});
            doc.y = ry+20;
          });
        }
      }

      /* ── Work Plan ── */
      if (sec.workplanData) {
        const { milestones=[], teamRoles=[], riskItems=[] } = sec.workplanData;

        if (milestones.length) {
          doc.moveDown(0.5);
          doc.fontSize(F.subhead).fillColor(C.accent).text('Milestones'); doc.moveDown(0.3);
          const mCW=[PW-245,70,90,0]; mCW[3]=PW-mCW.slice(0,3).reduce((a,b)=>a+b,0);
          guardOverflow(28);
          const mhY=doc.y+4;
          doc.rect(MARGIN,mhY,PW,24).fill(C.hdrBg);
          doc.fontSize(F.table).fillColor(C.accent)
             .text('Milestone',MARGIN+8,mhY+6,{width:mCW[0],lineBreak:false})
             .text('Target',MARGIN+8+mCW[0],mhY+6,{width:mCW[1],lineBreak:false})
             .text('Owner',MARGIN+8+mCW[0]+mCW[1],mhY+6,{width:mCW[2],lineBreak:false})
             .text('Status',MARGIN+8+mCW[0]+mCW[1]+mCW[2],mhY+6,{width:mCW[3],lineBreak:false});
          doc.y = mhY+26;
          milestones.forEach((m,idx)=>{
            guardOverflow(20); const ry=doc.y;
            if(idx%2===0) doc.rect(MARGIN,ry,PW,19).fill(C.rowAlt);
            doc.fontSize(F.table).fillColor(C.text).text(String(m.name||'—').slice(0,40),MARGIN+8,ry+5,{width:mCW[0],lineBreak:false});
            doc.fillColor(C.muted)
               .text(String(m.target||'—').slice(0,14),MARGIN+8+mCW[0],ry+5,{width:mCW[1],lineBreak:false})
               .text(String(m.owner||'—').slice(0,20),MARGIN+8+mCW[0]+mCW[1],ry+5,{width:mCW[2],lineBreak:false})
               .text(String(m.status||'—'),MARGIN+8+mCW[0]+mCW[1]+mCW[2],ry+5,{width:mCW[3],lineBreak:false});
            doc.y = ry+20;
          });
        }

        if (teamRoles.length) {
          doc.moveDown(0.6);
          doc.fontSize(F.subhead).fillColor(C.accent).text('Team Roles'); doc.moveDown(0.3);
          teamRoles.forEach((r,idx)=>{
            guardOverflow(22); const ry=doc.y;
            if(idx%2===0) doc.rect(MARGIN,ry,PW,19).fill(C.rowAlt);
            doc.fontSize(F.table).fillColor(C.text).text(`${cl(r.role)} (x${r.count||1})`,MARGIN+8,ry+5,{continued:true,width:160});
            doc.fillColor(C.muted).text('  '+String(r.responsibilities||'').slice(0,80),{width:PW-168});
            doc.y = ry+20;
          });
        }

        if (riskItems.length) {
          doc.moveDown(0.6);
          doc.fontSize(F.subhead).fillColor(C.accent).text('Risk Register'); doc.moveDown(0.3);
          const rCW=[PW-175,55,0]; rCW[2]=PW-rCW[0]-rCW[1];
          guardOverflow(28);
          const rhY=doc.y+4;
          doc.rect(MARGIN,rhY,PW,24).fill(C.hdrBg);
          doc.fontSize(F.table).fillColor(C.accent)
             .text('Risk',MARGIN+8,rhY+6,{width:rCW[0],lineBreak:false})
             .text('Impact',MARGIN+8+rCW[0],rhY+6,{width:rCW[1],lineBreak:false})
             .text('Mitigation',MARGIN+8+rCW[0]+rCW[1],rhY+6,{width:rCW[2],lineBreak:false});
          doc.y = rhY+26;
          riskItems.forEach((r,idx)=>{
            guardOverflow(20); const ry=doc.y;
            if(idx%2===0) doc.rect(MARGIN,ry,PW,19).fill(C.rowAlt);
            const impColor={high:C.fail,medium:C.partial,low:C.pass}[r.impact]||C.muted;
            doc.fontSize(F.table).fillColor(C.text).text(String(r.risk||'—').slice(0,55),MARGIN+8,ry+5,{width:rCW[0],lineBreak:false});
            doc.fillColor(impColor).text(String(r.impact||'—'),MARGIN+8+rCW[0],ry+5,{width:rCW[1],lineBreak:false});
            doc.fillColor(C.muted).text(String(r.mitigation||'—').slice(0,55),MARGIN+8+rCW[0]+rCW[1],ry+5,{width:rCW[2],lineBreak:false});
            doc.y = ry+20;
          });
        }

        if (!milestones.length && !teamRoles.length && !riskItems.length) {
          doc.fontSize(F.body).fillColor(C.muted).text('(none configured)');
        }
      }

      /* Workflow diagram images */
      const imgKey = diagramSectionKey[sec.title];
      if (imgKey) embedSectionImages(imgKey);
    }

    /* ── END PAGE ── */
    doc.addPage();
    doc.rect(0,0,595,842).fill('#0d0b1e');
    doc.fontSize(F.heading).fillColor('#ffffff').text('End of Report', MARGIN, 340, { align:'center', width:PW });
    doc.fontSize(F.body).fillColor(C.light).text(cl(rpt.meta.org), MARGIN, 382, { align:'center', width:PW });
    doc.fontSize(F.small).fillColor('#5a5775').text(`SecAssess v21  ·  ${new Date().toLocaleDateString()}`, MARGIN, 412, { align:'center', width:PW });
    doc.end();
  });
}

/* ═══ Export: PDF endpoint ═══ */
app.post('/api/export/pdf/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM assessments WHERE id = $1', [san(req.params.id,100)]);
    if (!rows.length) return res.status(404).json({ error:'Not found' });
    const row = parseRow(rows[0]);
    const buf = await generatePdfBuffer(row, req.body.images||[], req.body.exportSections||null);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${san(row.org_name||'report',50)}.pdf"`);
    res.end(buf);
  } catch (e) { if (!res.headersSent) res.status(500).json({ error: e.message }); }
});

/* ═══ Export: SQL ═══ */
app.get('/api/export/sql/:id', async (req, res) => {
  try { const { rows } = await pool.query('SELECT * FROM assessments WHERE id = $1', [san(req.params.id,100)]); if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const row = rows[0]; const cols = Object.keys(row).filter(k=>k!=='id');
    const vals = cols.map(c => { const v=row[c]; if(v===null)return 'NULL'; if(typeof v==='object')return `'${JSON.stringify(v).replace(/'/g,"''")}'`; return `'${String(v).replace(/'/g,"''")}'`; });
    const sql = `-- SecAssess v21 SQL Export\n-- Generated: ${new Date().toISOString()}\n-- Organization: ${row.org_name}\nINSERT INTO assessments (id, ${cols.join(', ')})\nVALUES ('${genId()}', ${vals.join(', ')});\n`;
    res.setHeader('Content-Type', 'application/sql'); res.setHeader('Content-Disposition', `attachment; filename="${san(row.org_name||'assessment',50)}.sql"`); res.send(sql);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ═══ Export: XML ═══ */
app.get('/api/export/xml/:id', async (req, res) => {
  try { const { rows } = await pool.query('SELECT * FROM assessments WHERE id = $1', [san(req.params.id,100)]); if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const row = parseRow(rows[0]); const esc=(s)=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<assessment version="16">\n  <org_name>${esc(row.org_name)}</org_name>\n  <assessor>${esc(row.assessor_name)}</assessor>\n  <date>${esc(row.assessment_date)}</date>\n  <environment>${esc(row.environment)}</environment>\n  <score>${row.score}</score>\n  <status>${esc(row.status)}</status>\n`;
    JSONB_FIELDS.forEach(f => { xml += `  <${f}><![CDATA[${JSON.stringify(row[f]||{})}]]></${f}>\n`; });
    xml += `</assessment>\n`;
    res.setHeader('Content-Type','application/xml'); res.setHeader('Content-Disposition',`attachment; filename="${san(row.org_name||'assessment',50)}.xml"`); res.send(xml);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ═══════════════════════════════════════════════════════════════════
 * EXCEL GENERATOR — returns a Buffer (used by Excel endpoint + ZIP)
 * ═══════════════════════════════════════════════════════════════════ */
async function generateExcelBuffer(dbRow, images, exportSections) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SecAssess v21'; wb.created = new Date(); wb.modified = new Date();
  const secIncludes = (sec) => !exportSections || exportSections.includes(sec);

  const COL_W_UNITS=12, COL_PX=90, ROW_PT=15, ROW_PX=ROW_PT*(4/3);
  const IMG_COLS=10, MAX_IMG_W=IMG_COLS*COL_PX, MAX_IMG_H=360, SHEET_W_PX=IMG_COLS*COL_PX;
  const PURPLE={argb:'FF4A3FBF'};
  const headerFill={type:'pattern',pattern:'solid',fgColor:{argb:'FFECE9FF'}};
  const altFill   ={type:'pattern',pattern:'solid',fgColor:{argb:'FFF9F8FF'}};
  const titleFill ={type:'pattern',pattern:'solid',fgColor:{argb:'FF0D0B1E'}};

  function styleHeaderRow(ws, numCols) {
    const hRow = ws.getRow(1); hRow.height = 22;
    hRow.eachCell({ includeEmpty:true }, (cell,cn) => {
      if (cn>numCols) return;
      cell.fill=headerFill; cell.font={bold:true,color:PURPLE,size:11};
      cell.alignment={vertical:'middle'}; cell.border={bottom:{style:'thin',color:PURPLE}};
    });
  }

  function addSectionBanner(ws, title, curRow) {
    const bRow = ws.getRow(curRow); bRow.height = 24;
    const cell = bRow.getCell(1);
    cell.value=title; cell.font={bold:true,size:13,color:PURPLE};
    cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFEDE9FF'}};
    cell.alignment={vertical:'middle'};
    ws.mergeCells(curRow,1,curRow,IMG_COLS);
    return curRow+1;
  }

  function anchorImage(ws, imgBuf, origW, origH, startRow) {
    const scale=Math.min(MAX_IMG_W/origW, MAX_IMG_H/origH, 1);
    const dw=Math.round(origW*scale); const dh=Math.round(origH*scale);
    const rowsNeeded=Math.ceil(dh/ROW_PX);
    for (let r=startRow; r<startRow+rowsNeeded; r++) ws.getRow(r).height=dh/rowsNeeded*(3/4);
    const freeSpace=SHEET_W_PX-dw;
    const colOffset=Math.max(0,freeSpace/2)/COL_PX;
    const imgId=wb.addImage({buffer:imgBuf,extension:'png'});
    ws.addImage(imgId,{ tl:{col:colOffset,row:startRow-1}, br:{col:colOffset+dw/COL_PX,row:startRow-1+rowsNeeded}, editAs:'oneCell' });
    return startRow+rowsNeeded+2;
  }

  function embedImages(ws, sheetImages, startRow) {
    let cur=startRow;
    for (const img of sheetImages) {
      try {
        const buf=Buffer.from(img.data,'base64');
        const lRow=ws.getRow(cur); lRow.height=18;
        const lCell=lRow.getCell(1); lCell.value=img.name||'Diagram'; lCell.font={bold:true,size:11,color:PURPLE};
        ws.mergeCells(cur,1,cur,IMG_COLS); cur++;
        cur=anchorImage(ws,buf,img.width||600,img.height||300,cur);
      } catch { ws.getRow(cur).getCell(1).value=`[Image unavailable: ${img.name}]`; cur+=2; }
    }
    return cur;
  }

  function setImageColWidths(ws) { for (let c=1;c<=IMG_COLS;c++) ws.getColumn(c).width=COL_W_UNITS; }

  /* SHEET 1: Summary */
  const ss = wb.addWorksheet('Summary');
  ss.columns=[{header:'Field',key:'f',width:28},{header:'Value',key:'v',width:55}];
  [['Organization',dbRow.org_name],['Assessor',dbRow.assessor_name],['Date',dbRow.assessment_date],['Environment',dbRow.environment],['Score',dbRow.score+'%'],['Status',dbRow.status]].forEach(([f,v])=>ss.addRow({f,v}));
  styleHeaderRow(ss,2);

  /* SHEET 2: Assessment */
  if (secIncludes('assessment')) {
    const as=wb.addWorksheet('Assessment');
    as.columns=[{header:'Control ID',key:'id',width:18},{header:'Status',key:'status',width:14},{header:'Notes',key:'notes',width:60}];
    styleHeaderRow(as,3);
    Object.entries(dbRow.responses||{}).forEach(([id,r],idx)=>{
      const dataRow=as.addRow({id,status:r.status||'',notes:r.notes||''});
      if(idx%2===0) dataRow.eachCell({includeEmpty:true},cell=>{cell.fill=altFill;});
      const statusCell=dataRow.getCell('status');
      statusCell.font={bold:true,color:{argb:{pass:'FF00B894',fail:'FFE63757',partial:'FFF59E0B',na:'FF9CA3AF'}[r.status]||'FF8B88A2'}};
    });
  }

  /* SHEET 3: Pricing */
  const pr=dbRow.pricing||{};
  if (pr.engineers && secIncludes('pricing')) {
    const ps=wb.addWorksheet('Pricing');
    ps.columns=[{header:'Field',key:'f',width:32},{header:'Value',key:'v',width:28}];
    styleHeaderRow(ps,2);
    const rate=(pr.hourlyRate||0)*160; const base=rate*pr.engineers*pr.duration;
    const total=base+base*((pr.contingency||0)/100);
    [['Engineers',pr.engineers],['Duration',pr.duration+' months'],['Hourly Rate',pr.hourlyRate],['Currency',pr.currency||'ILS'],['Estimation Mode',pr.estimationMode||'price'],['Total Cost',total.toLocaleString()]].forEach(([f,v])=>ps.addRow({f,v}));
    if (pr.phases) { ps.addRow({}); ps.addRow({f:'Phase',v:'Allocation'}); pr.phases.forEach(p=>ps.addRow({f:p.name,v:p.percentage+'%'})); }
  }

  /* SHEET 4: CI-CD */
  const cicd=dbRow.cicd_diagrams||{};
  if (cicd.workflows?.length && secIncludes('cicd')) {
    const ws=wb.addWorksheet('CI-CD'); setImageColWidths(ws);
    ws.columns=[{header:'Workflow',key:'wf',width:COL_W_UNITS*2},{header:'Pipeline',key:'pl',width:COL_W_UNITS*2.5},{header:'Stages',key:'s',width:COL_W_UNITS},{header:'Desc',key:'d',width:COL_W_UNITS*4}];
    styleHeaderRow(ws,4);
    cicd.workflows.forEach(wf=>(wf.pipelines||[]).forEach(p=>ws.addRow({wf:wf.name,pl:p.name,s:(p.nodes||[]).length,d:p.description||''})));
    const cicdImgs=images.filter(img=>img.section==='cicd');
    if (cicdImgs.length) {
      const dataRows=cicd.workflows.reduce((t,wf)=>t+(wf.pipelines||[]).length,0);
      let cur=dataRows+3; cur=addSectionBanner(ws,'CI/CD Workflow Diagrams',cur)+1; embedImages(ws,cicdImgs,cur);
    }
  }

  /* SHEET 5: GitFlow */
  const gf=dbRow.gitflow_diagrams||{};
  if (gf.flows?.length && secIncludes('gitflow')) {
    const gs=wb.addWorksheet('GitFlow'); setImageColWidths(gs);
    gs.columns=[{header:'Flow',key:'n',width:COL_W_UNITS*3},{header:'Nodes',key:'c',width:COL_W_UNITS},{header:'Desc',key:'d',width:COL_W_UNITS*6}];
    styleHeaderRow(gs,3);
    gf.flows.forEach(f=>gs.addRow({n:f.name,c:(f.nodes||[]).length,d:f.description||''}));
    const gitImgs=images.filter(img=>img.section==='gitflow');
    if (gitImgs.length) { let cur=gf.flows.length+3; cur=addSectionBanner(gs,'Git Flow Diagrams',cur)+1; embedImages(gs,gitImgs,cur); }
  }

  /* SHEET 6: Deploy */
  const ds=dbRow.deployment_strategies||{};
  if (ds.strategies?.length && secIncludes('deploy')) {
    const dss=wb.addWorksheet('Deploy'); setImageColWidths(dss);
    dss.columns=[{header:'Strategy',key:'n',width:COL_W_UNITS*3},{header:'Category',key:'c',width:COL_W_UNITS*1.5},{header:'Stages',key:'s',width:COL_W_UNITS},{header:'Desc',key:'d',width:COL_W_UNITS*4}];
    styleHeaderRow(dss,4);
    ds.strategies.forEach(s=>dss.addRow({n:s.name,c:s.cat||'',s:(s.nodes||[]).length,d:s.description||''}));
    const depImgs=images.filter(img=>img.section==='deploy');
    if (depImgs.length) { let cur=ds.strategies.length+3; cur=addSectionBanner(dss,'Deployment Strategy Diagrams',cur)+1; embedImages(dss,depImgs,cur); }
  }

  /* SHEET 7: Promotion */
  const pw_data=dbRow.promotion_workflows||{};
  if (pw_data.workflows?.length && secIncludes('promotion')) {
    const pws=wb.addWorksheet('Promotion'); setImageColWidths(pws);
    pws.columns=[{header:'Workflow',key:'n',width:COL_W_UNITS*3},{header:'Category',key:'c',width:COL_W_UNITS*1.5},{header:'Stages',key:'s',width:COL_W_UNITS},{header:'Desc',key:'d',width:COL_W_UNITS*4}];
    styleHeaderRow(pws,4);
    pw_data.workflows.forEach(w=>pws.addRow({n:w.name,c:w.cat||'',s:(w.nodes||[]).length,d:w.description||''}));
    const promoImgs=images.filter(img=>img.section==='promotion');
    if (promoImgs.length) { let cur=pw_data.workflows.length+3; cur=addSectionBanner(pws,'Promotion Workflow Diagrams',cur)+1; embedImages(pws,promoImgs,cur); }
  }

  /* SHEET 8: Versioning */
  const vd=dbRow.versioning_diagrams||{};
  if (vd.flows?.length && secIncludes('versioning')) {
    const vs=wb.addWorksheet('Versioning'); setImageColWidths(vs);
    vs.columns=[{header:'Scheme',key:'n',width:COL_W_UNITS*3},{header:'Nodes',key:'c',width:COL_W_UNITS},{header:'Desc',key:'d',width:COL_W_UNITS*6}];
    styleHeaderRow(vs,3);
    vd.flows.forEach(f=>vs.addRow({n:f.name,c:(f.nodes||[]).length,d:f.description||''}));
    const verImgs=images.filter(img=>img.section==='versioning');
    if (verImgs.length) { let cur=vd.flows.length+3; cur=addSectionBanner(vs,'Versioning Diagrams',cur)+1; embedImages(vs,verImgs,cur); }
  }

  /* SHEET 8: Artifacts */
  const ar=dbRow.artifact_repos||{};
  if (ar.registries?.length && secIncludes('artifacts')) {
    const ars=wb.addWorksheet('Artifacts');
    ars.columns=[{header:'Registry',key:'r',width:26},{header:'Type',key:'t',width:16},{header:'Repo',key:'n',width:26},{header:'Class',key:'c',width:14},{header:'Pkg',key:'p',width:14}];
    styleHeaderRow(ars,5);
    ar.registries.forEach(r=>(r.repos||[]).forEach(rp=>ars.addRow({r:r.name,t:r.registryType,n:rp.name,c:rp.repoClass,p:rp.pkgType})));
  }

  /* SHEET 9: Gantt */
  const ganttTasks=dbRow.gantt?.tasks||[];
  if (ganttTasks.length && secIncludes('gantt')) {
    const gs=wb.addWorksheet('Gantt');
    gs.columns=[{header:'Task',key:'n',width:38},{header:'Category',key:'c',width:16},{header:'Start Week',key:'s',width:14},{header:'Duration (wks)',key:'d',width:16},{header:'Dependencies',key:'p',width:20}];
    styleHeaderRow(gs,5);
    ganttTasks.forEach((t,idx)=>{
      const dr=gs.addRow({n:t.name,c:t.category,s:t.start!=null?t.start+1:'',d:t.duration,p:(t.deps||[]).join(', ')});
      if(idx%2===0) dr.eachCell({includeEmpty:true},cell=>{cell.fill=altFill;});
    });
  }

  /* SHEET 10: WorkPlan */
  const wpData=dbRow.workplan||{};
  const milestones=wpData.milestones||[], teamRoles=wpData.teamRoles||[], riskItems=wpData.riskItems||[];
  if (secIncludes('workplan') && (milestones.length||teamRoles.length||riskItems.length)) {
    const wps=wb.addWorksheet('WorkPlan');
    wps.getColumn(1).width=36; wps.getColumn(2).width=18; wps.getColumn(3).width=22; wps.getColumn(4).width=14; wps.getColumn(5).width=40;
    let cur=1;

    if (milestones.length) {
      cur=addSectionBanner(wps,'Milestones',cur);
      ['Milestone','Target','Owner','Status','Deliverables'].forEach((h,i)=>{
        const cell=wps.getRow(cur).getCell(i+1); cell.value=h; cell.font={bold:true,color:PURPLE,size:11}; cell.fill=headerFill; cell.alignment={vertical:'middle'};
      });
      wps.getRow(cur).height=20; cur++;
      milestones.forEach((m,idx)=>{
        const r2=wps.getRow(cur); r2.values=['',m.name,m.target,m.owner,m.status,m.deliverables];
        // values array is 1-based in ExcelJS when set directly
        r2.getCell(1).value=m.name; r2.getCell(2).value=m.target; r2.getCell(3).value=m.owner; r2.getCell(4).value=m.status; r2.getCell(5).value=m.deliverables;
        if(idx%2===0) r2.eachCell({includeEmpty:true},c2=>{c2.fill=altFill;}); cur++;
      });
      cur++;
    }

    if (teamRoles.length) {
      cur=addSectionBanner(wps,'Team Roles',cur);
      ['Role','Count','Responsibilities'].forEach((h,i)=>{
        const cell=wps.getRow(cur).getCell(i+1); cell.value=h; cell.font={bold:true,color:PURPLE,size:11}; cell.fill=headerFill; cell.alignment={vertical:'middle'};
      });
      wps.getRow(cur).height=20; cur++;
      teamRoles.forEach((r,idx)=>{
        const r2=wps.getRow(cur); r2.getCell(1).value=r.role; r2.getCell(2).value=r.count; r2.getCell(3).value=r.responsibilities;
        if(idx%2===0) r2.eachCell({includeEmpty:true},c2=>{c2.fill=altFill;}); cur++;
      });
      cur++;
    }

    if (riskItems.length) {
      cur=addSectionBanner(wps,'Risk Register',cur);
      ['Risk','Impact','Mitigation'].forEach((h,i)=>{
        const cell=wps.getRow(cur).getCell(i+1); cell.value=h; cell.font={bold:true,color:PURPLE,size:11}; cell.fill=headerFill; cell.alignment={vertical:'middle'};
      });
      wps.getRow(cur).height=20; cur++;
      riskItems.forEach((r,idx)=>{
        const r2=wps.getRow(cur); r2.getCell(1).value=r.risk; r2.getCell(2).value=r.impact; r2.getCell(3).value=r.mitigation;
        if(idx%2===0) r2.eachCell({includeEmpty:true},c2=>{c2.fill=altFill;}); cur++;
      });
    }
  }

  /* SHEET 11: All_Diagrams */
  if (images.length>0) {
    const imgSheet=wb.addWorksheet('All_Diagrams'); setImageColWidths(imgSheet);
    const tCell=imgSheet.getRow(1).getCell(1);
    tCell.value='All Workflow Diagrams'; tCell.font={bold:true,size:16,color:PURPLE}; tCell.fill=titleFill; tCell.alignment={vertical:'middle'};
    imgSheet.getRow(1).height=28; imgSheet.mergeCells(1,1,1,IMG_COLS);
    const diagSecs=['cicd','gitflow','deploy','versioning'];
    const secLabels={cicd:'CI/CD Workflows',gitflow:'Git Flow',deploy:'Deployment Strategies',versioning:'Versioning'};
    let cur=3;
    for (const sec of diagSecs) {
      const secImgs=images.filter(img=>img.section===sec);
      if (!secImgs.length) continue;
      cur=addSectionBanner(imgSheet,secLabels[sec],cur)+1;
      cur=embedImages(imgSheet,secImgs,cur);
      cur+=1;
    }
  }

  return wb.xlsx.writeBuffer();
}

/* ═══ Export: Excel endpoint ═══ */
app.post('/api/export/excel/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM assessments WHERE id = $1', [san(req.params.id,100)]);
    if (!rows.length) return res.status(404).json({ error:'Not found' });
    const row=parseRow(rows[0]);
    const buf=await generateExcelBuffer(row, req.body.images||[], req.body.exportSections||null);
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',`attachment; filename="${san(row.org_name||'assessment',50)}.xlsx"`);
    res.end(buf);
  } catch (e) { if (!res.headersSent) res.status(500).json({ error: e.message }); }
});

/* ═══ Export: ZIP — PDF + XLSX + images/ + HTML + JSON + SQL + XML ═══ */
app.post('/api/export/zip/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM assessments WHERE id = $1', [san(req.params.id,100)]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const row=parseRow(rows[0]); const name=san(row.org_name||'assessment',50);
    const images=req.body.images||[]; const exportSections=req.body.exportSections||null;
    res.setHeader('Content-Type','application/zip');
    res.setHeader('Content-Disposition',`attachment; filename="${name}.zip"`);
    const archive=archiver('zip',{zlib:{level:9}});
    archive.pipe(res);

    /* Generate PDF and Excel buffers in parallel */
    const [pdfBuf,xlsxBuf]=await Promise.all([
      generatePdfBuffer(row,images,exportSections),
      generateExcelBuffer(row,images,exportSections),
    ]);
    archive.append(pdfBuf,  {name:`${name}.pdf`});
    archive.append(xlsxBuf, {name:`${name}.xlsx`});

    /* JSON */
    archive.append(JSON.stringify(row,null,2),{name:`${name}.json`});

    /* SQL */
    const cols=Object.keys(rows[0]).filter(k=>k!=='id');
    const vals=cols.map(c=>{const v=rows[0][c];if(v===null)return 'NULL';if(typeof v==='object')return `'${JSON.stringify(v).replace(/'/g,"''")}' `;return `'${String(v).replace(/'/g,"''")}' `;});
    archive.append(`-- SecAssess v21\nINSERT INTO assessments (id, ${cols.join(', ')})\nVALUES ('${genId()}', ${vals.join(', ')});\n`,{name:`${name}.sql`});

    /* XML */
    const esc=(s)=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    let xml=`<?xml version="1.0" encoding="UTF-8"?>\n<assessment version="21">\n  <org_name>${esc(row.org_name)}</org_name>\n  <assessor>${esc(row.assessor_name)}</assessor>\n  <date>${esc(row.assessment_date)}</date>\n  <environment>${esc(row.environment)}</environment>\n  <score>${row.score}</score>\n  <status>${esc(row.status)}</status>\n`;
    JSONB_FIELDS.forEach(f=>{xml+=`  <${f}><![CDATA[${JSON.stringify(row[f]||{})}]]></${f}>\n`;});
    xml+=`</assessment>\n`;
    archive.append(xml,{name:`${name}.xml`});

    /* HTML Report with Gantt + WorkPlan sections */
    const resp2=row.responses||{}, pr2=row.pricing||{};
    const respRows=Object.entries(resp2).map(([id,r])=>`<tr><td>${esc(id)}</td><td class="b b${r.status||'u'}">${r.status||'—'}</td><td>${esc(r.notes||'—')}</td></tr>`).join('');
    const cicdRows=(row.cicd_diagrams?.workflows||[]).flatMap(w=>(w.pipelines||[]).map(p=>`<tr><td>${esc(w.name)}</td><td>${esc(p.name)}</td><td>${(p.nodes||[]).length}</td></tr>`)).join('');
    const gitRows=(row.gitflow_diagrams?.flows||[]).map(f=>`<tr><td>${esc(f.name)}</td><td>${(f.nodes||[]).length}</td><td>${esc(f.description||'—')}</td></tr>`).join('');
    const deployRows=(row.deployment_strategies?.strategies||[]).map(s=>`<tr><td>${esc(s.name)}</td><td>${esc(s.cat||'—')}</td><td>${(s.nodes||[]).length}</td></tr>`).join('');
    const verRows=(row.versioning_diagrams?.flows||[]).map(f=>`<tr><td>${esc(f.name)}</td><td>${(f.nodes||[]).length}</td></tr>`).join('');
    const artifactRows=(row.artifact_repos?.registries||[]).flatMap(r=>(r.repos||[]).map(rp=>`<tr><td>${esc(r.name)}</td><td>${esc(r.registryType||'—')}</td><td>${esc(rp.name)}</td></tr>`)).join('');
    const ganttRows=(row.gantt?.tasks||[]).map(t=>`<tr><td>${esc(t.name)}</td><td>${esc(t.category||'—')}</td><td>${t.start!=null?t.start+1:'—'}</td><td>${t.duration||'—'} wk</td></tr>`).join('');
    const msRows=(row.workplan?.milestones||[]).map(m=>`<tr><td>${esc(m.name)}</td><td>${esc(m.target||'—')}</td><td>${esc(m.owner||'—')}</td><td>${esc(m.status||'—')}</td></tr>`).join('');
    const imgBlocks=images.map(img=>`<div class="img-block"><div class="img-title">${esc(img.name)}</div><img src="data:image/png;base64,${img.data}" style="max-width:100%;height:auto;display:block;border-radius:8px;border:1px solid rgba(108,92,231,.2)"/></div>`).join('');
    const pricingHtml=pr2.engineers?`<h2>Pricing</h2><div class="meta"><div class="mi"><div class="ml">Engineers</div><div class="mv">${pr2.engineers}</div></div><div class="mi"><div class="ml">Duration</div><div class="mv">${pr2.duration} months</div></div><div class="mi"><div class="ml">Total</div><div class="mv">${pr2.currency||'ILS'} ${((pr2.hourlyRate||0)*160*(pr2.engineers||0)*(pr2.duration||0)*(1+((pr2.contingency||0)/100))).toLocaleString()}</div></div></div>`:'';
    const allSectionMap={
      config:`<h2>Configuration</h2><div class="meta"><div class="mi"><div class="ml">Organization</div><div class="mv">${esc(row.org_name)}</div></div><div class="mi"><div class="ml">Assessor</div><div class="mv">${esc(row.assessor_name)}</div></div><div class="mi"><div class="ml">Date</div><div class="mv">${esc(row.assessment_date)}</div></div><div class="mi"><div class="ml">Environment</div><div class="mv">${esc(row.environment)}</div></div><div class="mi"><div class="ml">Score</div><div class="mv">${row.score}%</div></div></div>`,
      assessment:respRows?`<h2>Assessment Results</h2><table><thead><tr><th>Control ID</th><th>Status</th><th>Notes</th></tr></thead><tbody>${respRows}</tbody></table>`:'',
      cicd:cicdRows?`<h2>CI/CD Workflows</h2><table><thead><tr><th>Workflow</th><th>Pipeline</th><th>Stages</th></tr></thead><tbody>${cicdRows}</tbody></table>`:'',
      gitflow:gitRows?`<h2>Git Flow</h2><table><thead><tr><th>Flow</th><th>Nodes</th><th>Description</th></tr></thead><tbody>${gitRows}</tbody></table>`:'',
      deploy:deployRows?`<h2>Deployment Strategies</h2><table><thead><tr><th>Strategy</th><th>Category</th><th>Stages</th></tr></thead><tbody>${deployRows}</tbody></table>`:'',
      versioning:verRows?`<h2>Versioning</h2><table><thead><tr><th>Scheme</th><th>Nodes</th></tr></thead><tbody>${verRows}</tbody></table>`:'',
      artifacts:artifactRows?`<h2>Artifact Registries</h2><table><thead><tr><th>Registry</th><th>Type</th><th>Repo</th></tr></thead><tbody>${artifactRows}</tbody></table>`:'',
      pricing:pricingHtml,
      gantt:ganttRows?`<h2>Gantt Chart</h2><table><thead><tr><th>Task</th><th>Category</th><th>Start Week</th><th>Duration</th></tr></thead><tbody>${ganttRows}</tbody></table>`:'',
      workplan:msRows?`<h2>Work Plan</h2><table><thead><tr><th>Milestone</th><th>Target</th><th>Owner</th><th>Status</th></tr></thead><tbody>${msRows}</tbody></table>`:'',
    };
    const sectionsToInclude=exportSections||Object.keys(allSectionMap);
    const sectionsHtml=sectionsToInclude.map(s=>allSectionMap[s]||'').join('');
    const html=`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>SecAssess Report — ${esc(row.org_name)}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;background:#0a0a14;color:#e0dff0;line-height:1.6;padding:40px}.c{max-width:960px;margin:0 auto}h1{font-size:28px;margin-bottom:8px;color:#a29bfe}h2{font-size:18px;margin:28px 0 12px;color:#a29bfe;border-bottom:1px solid rgba(108,92,231,.2);padding-bottom:8px}.meta{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin:16px 0 24px}.mi{background:#12122a;padding:14px;border-radius:8px;border:1px solid rgba(108,92,231,.15)}.ml{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#6b6890}.mv{font-size:15px;margin-top:4px}table{width:100%;border-collapse:collapse;margin:12px 0 24px}th{background:#16163a;padding:10px 12px;text-align:left;font-size:12px;text-transform:uppercase;color:#8b88a2;border-bottom:2px solid rgba(108,92,231,.2)}td{padding:10px 12px;border-bottom:1px solid rgba(108,92,231,.08);font-size:13px;vertical-align:top}.b{display:inline-block;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:600;text-transform:uppercase}.bpass{background:rgba(0,206,201,.15);color:#00cec9}.bfail{background:rgba(255,59,92,.15);color:#ff3b5c}.bpartial{background:rgba(255,209,102,.15);color:#ffd166}.bna,.bu{background:rgba(90,87,117,.15);color:#5a5775}.img-block{margin:16px 0}.img-title{font-size:11px;color:#6b6890;margin-bottom:6px;font-family:monospace}.ft{margin-top:40px;text-align:center;color:#5a5775;font-size:12px;border-top:1px solid rgba(108,92,231,.1);padding-top:16px}</style></head><body><div class="c"><h1>SecAssess Report</h1><p style="color:#6b6890;font-size:13px">Generated: ${new Date().toLocaleDateString()}</p>${sectionsHtml}${imgBlocks?`<h2>Workflow Diagrams</h2>${imgBlocks}`:''}<div class="ft">SecAssess v21 — ${esc(row.org_name)}</div></div></body></html>`;
    archive.append(html,{name:`${name}-report.html`});

    /* Individual images → images/ folder */
    for (const img of images) {
      try {
        const buf=Buffer.from(img.data,'base64');
        const safeName=(img.name||'diagram').replace(/[^a-zA-Z0-9_\- ]/g,'_').trim();
        archive.append(buf,{name:`images/${safeName}.png`});
      } catch {}
    }

    await archive.finalize();
  } catch (e) { if (!res.headersSent) res.status(500).json({ error: e.message }); }
});

/* ── Init DB ── */
async function initDB() {
  for (let i=1;i<=15;i++){try{console.log(`DB connect (${i}/15)...`);await pool.query('SELECT 1');console.log('Connected');break;}catch(e){if(i===15)throw e;console.log('Waiting...');await new Promise(r=>setTimeout(r,2000));}}
  await pool.query(`CREATE TABLE IF NOT EXISTS assessments (id TEXT PRIMARY KEY, org_name TEXT NOT NULL DEFAULT '', assessor_name TEXT DEFAULT '', assessment_date TEXT DEFAULT '', environment TEXT DEFAULT 'production', scope TEXT DEFAULT '', template TEXT DEFAULT 'full', responses JSONB DEFAULT '{}', pricing JSONB DEFAULT '{}', gantt JSONB DEFAULT '{}', workplan JSONB DEFAULT '{}', custom_templates JSONB DEFAULT '[]', cicd_diagrams JSONB DEFAULT '{}', gitflow_diagrams JSONB DEFAULT '{}', artifact_repos JSONB DEFAULT '{}', deployment_strategies JSONB DEFAULT '{}', versioning_diagrams JSONB DEFAULT '{}', promotion_workflows JSONB DEFAULT '{}', score INTEGER DEFAULT 0, status TEXT DEFAULT 'draft', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`);
  for (const m of ["ALTER TABLE assessments ADD COLUMN IF NOT EXISTS cicd_diagrams JSONB DEFAULT '{}'","ALTER TABLE assessments ADD COLUMN IF NOT EXISTS gitflow_diagrams JSONB DEFAULT '{}'","ALTER TABLE assessments ADD COLUMN IF NOT EXISTS artifact_repos JSONB DEFAULT '{}'","ALTER TABLE assessments ADD COLUMN IF NOT EXISTS deployment_strategies JSONB DEFAULT '{}'","ALTER TABLE assessments ADD COLUMN IF NOT EXISTS versioning_diagrams JSONB DEFAULT '{}'","ALTER TABLE assessments ADD COLUMN IF NOT EXISTS promotion_workflows JSONB DEFAULT '{}'"]) { try{await pool.query(m);}catch{} }
  console.log('DB ready'); dbReady = true;
}
async function start(){await initDB();app.listen(PORT,'0.0.0.0',()=>console.log(`SecAssess v21 API on port ${PORT}`));}
start().catch(e=>{console.error('FAIL:',e);process.exit(1);});
