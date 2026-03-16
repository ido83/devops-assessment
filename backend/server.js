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

/* ═══ Assessment categories — mirrors frontend/src/data/assessmentData.js ═══ */
const ASSESSMENT_CATS=[
  {t:'CI/CD Pipeline Security',i:'⛓️',items:[
    {id:'ci-1',tx:'Pipeline-as-code in VCS with branch protection',sv:'critical'},
    {id:'ci-2',tx:'Secrets management via vault — no hardcoded credentials',sv:'critical'},
    {id:'ci-3',tx:'Automated SAST scanning in pipeline (Semgrep, SonarQube)',sv:'critical'},
    {id:'ci-4',tx:'DAST scanning against staging before production deploy',sv:'high'},
    {id:'ci-5',tx:'SCA dependency vulnerability scanning on every build',sv:'high'},
    {id:'ci-6',tx:'Artifact signing and provenance attestation (SLSA Level 3)',sv:'high'},
    {id:'ci-7',tx:'Pipeline execution with least-privilege ephemeral accounts',sv:'high'},
    {id:'ci-8',tx:'Build reproducibility and hermetic build environments',sv:'medium'},
    {id:'ci-9',tx:'Automated rollback on deployment failure with health checks',sv:'medium'},
    {id:'ci-10',tx:'Multi-stage pipeline with gated approvals for production',sv:'high'},
    {id:'ci-11',tx:'Pipeline audit logging and tamper-evident build records',sv:'high'},
    {id:'ci-12',tx:'Ephemeral build agents — no persistent CI runner state',sv:'medium'},
    {id:'ci-13',tx:'Pipeline-level RBAC for build/deploy/release permissions',sv:'high'},
    {id:'ci-14',tx:'Canary/blue-green deployment with automated traffic shifting',sv:'medium'},
  ]},
  {t:'Container & Image Security',i:'🐳',items:[
    {id:'cs-1',tx:'Base images from trusted registries with verified signatures',sv:'critical'},
    {id:'cs-2',tx:'Container image vulnerability scanning in CI (Trivy, Snyk, Grype)',sv:'critical'},
    {id:'cs-3',tx:'Non-root container execution enforced by default',sv:'critical'},
    {id:'cs-4',tx:'Read-only root filesystem where possible',sv:'high'},
    {id:'cs-5',tx:'Minimal/distroless base images to reduce attack surface',sv:'high'},
    {id:'cs-6',tx:'Container resource limits (CPU, memory, PID) enforced',sv:'medium'},
    {id:'cs-7',tx:'Private container registry with access controls and scanning',sv:'high'},
    {id:'cs-8',tx:'Runtime security monitoring and threat detection (Falco)',sv:'high'},
    {id:'cs-9',tx:'Immutable container tags — no "latest" tag in production',sv:'medium'},
    {id:'cs-10',tx:'seccomp and AppArmor/SELinux profiles applied',sv:'high'},
    {id:'cs-11',tx:'Container image SBOMs generated and stored alongside images',sv:'medium'},
    {id:'cs-12',tx:'Multi-stage Docker builds — no build tools in production images',sv:'medium'},
  ]},
  {t:'Kubernetes & Orchestration',i:'☸️',items:[
    {id:'k8-1',tx:'RBAC configured with least-privilege roles and bindings',sv:'critical'},
    {id:'k8-2',tx:'Network Policies enforce pod-to-pod traffic segmentation',sv:'critical'},
    {id:'k8-3',tx:'Pod Security Standards (restricted profile) enforced cluster-wide',sv:'critical'},
    {id:'k8-4',tx:'etcd encryption at rest enabled',sv:'high'},
    {id:'k8-5',tx:'API server audit logging enabled and forwarded to SIEM',sv:'high'},
    {id:'k8-6',tx:'Service mesh for mTLS between services (Istio, Linkerd)',sv:'high'},
    {id:'k8-7',tx:'GitOps deployment model (ArgoCD, Flux) with drift detection',sv:'medium'},
    {id:'k8-8',tx:'Horizontal Pod Autoscaling and cluster autoscaling configured',sv:'medium'},
    {id:'k8-9',tx:'Admission controllers (OPA/Gatekeeper, Kyverno) for policy enforcement',sv:'high'},
    {id:'k8-10',tx:'Regular CIS Kubernetes Benchmark compliance scans',sv:'high'},
    {id:'k8-11',tx:'Namespace isolation with resource quotas and limit ranges',sv:'medium'},
    {id:'k8-12',tx:'Kubernetes secrets encrypted via external KMS',sv:'high'},
    {id:'k8-13',tx:'Pod disruption budgets defined for critical workloads',sv:'medium'},
    {id:'k8-14',tx:'Egress traffic filtering — pods cannot reach arbitrary internet',sv:'high'},
  ]},
  {t:'Infrastructure as Code',i:'🏗️',items:[
    {id:'iac-1',tx:'IaC templates scanned for misconfigurations (Checkov, tfsec)',sv:'critical'},
    {id:'iac-2',tx:'Terraform/Pulumi state encrypted and stored remotely with locking',sv:'high'},
    {id:'iac-3',tx:'Module versioning and registry for reusable infrastructure components',sv:'medium'},
    {id:'iac-4',tx:'Drift detection and automated reconciliation configured',sv:'medium'},
    {id:'iac-5',tx:'Plan/apply separation with mandatory review on infra changes',sv:'high'},
    {id:'iac-6',tx:'No secrets in IaC templates — dynamic secret injection only',sv:'critical'},
    {id:'iac-7',tx:'Tagging strategy enforced for cost allocation and ownership',sv:'low'},
    {id:'iac-8',tx:'Blast radius minimization via modular state separation',sv:'medium'},
    {id:'iac-9',tx:'Policy-as-code guardrails prevent non-compliant resource creation',sv:'high'},
    {id:'iac-10',tx:'Infrastructure cost estimation in PR reviews (Infracost)',sv:'low'},
  ]},
  {t:'Observability & Incident Response',i:'📡',items:[
    {id:'mon-1',tx:'Centralized logging with structured log format (ELK, Loki)',sv:'high'},
    {id:'mon-2',tx:'Distributed tracing across services (Jaeger, Tempo, X-Ray)',sv:'medium'},
    {id:'mon-3',tx:'SLI/SLO definitions with error budget tracking',sv:'medium'},
    {id:'mon-4',tx:'Security event monitoring and SIEM integration (Splunk, Sentinel)',sv:'critical'},
    {id:'mon-5',tx:'Runbooks for common incidents documented and tested',sv:'medium'},
    {id:'mon-6',tx:'On-call rotation with escalation policies defined',sv:'medium'},
    {id:'mon-7',tx:'Anomaly detection for security and performance events',sv:'high'},
    {id:'mon-8',tx:'Log retention policies compliant with regulatory requirements',sv:'high'},
    {id:'mon-9',tx:'Post-incident review (blameless postmortems) process in place',sv:'medium'},
    {id:'mon-10',tx:'Chaos engineering practices for resilience validation',sv:'low'},
    {id:'mon-11',tx:'Real-time alerting for security-critical events',sv:'critical'},
    {id:'mon-12',tx:'Golden signals monitoring (latency, traffic, errors, saturation)',sv:'high'},
  ]},
  {t:'Identity & Access Management',i:'🔐',items:[
    {id:'iam-1',tx:'SSO/SAML/OIDC integration for all DevOps tooling',sv:'high'},
    {id:'iam-2',tx:'MFA enforced for all privileged and production access',sv:'critical'},
    {id:'iam-3',tx:'Just-in-time (JIT) access for production environments',sv:'high'},
    {id:'iam-4',tx:'Service account credentials rotated automatically on schedule',sv:'high'},
    {id:'iam-5',tx:'API key and token lifecycle management with expiration',sv:'high'},
    {id:'iam-6',tx:'Quarterly access reviews for all infrastructure access',sv:'medium'},
    {id:'iam-7',tx:'Break-glass procedure documented for emergency access',sv:'medium'},
    {id:'iam-8',tx:'Zero-trust network access (ZTNA) model implemented',sv:'high'},
    {id:'iam-9',tx:'Workload identity (SPIFFE/SPIRE) for service-to-service auth',sv:'high'},
    {id:'iam-10',tx:'Privileged access management (PAM) with session recording',sv:'high'},
  ]},
  {t:'Compliance & Governance',i:'📋',items:[
    {id:'com-1',tx:'SBOM generation for all releases (CycloneDX, SPDX)',sv:'high'},
    {id:'com-2',tx:'License compliance scanning for open-source dependencies',sv:'medium'},
    {id:'com-3',tx:'Change management process with audit trail',sv:'high'},
    {id:'com-4',tx:'Data classification and handling policies enforced in pipelines',sv:'high'},
    {id:'com-5',tx:'Regulatory framework mapping (SOC2, ISO27001, NIST CSF, PCI-DSS)',sv:'high'},
    {id:'com-6',tx:'Automated compliance-as-code checks in CI/CD',sv:'medium'},
    {id:'com-7',tx:'Vulnerability disclosure and patching SLA defined and tracked',sv:'high'},
    {id:'com-8',tx:'Third-party vendor security assessment process',sv:'medium'},
    {id:'com-9',tx:'Automated evidence collection for audit readiness (Vanta, Drata)',sv:'medium'},
    {id:'com-10',tx:'Data residency and sovereignty controls enforced',sv:'high'},
  ]},
  {t:'Software Supply Chain',i:'🔗',items:[
    {id:'sc-1',tx:'Dependency pinning with lock files committed to VCS',sv:'high'},
    {id:'sc-2',tx:'Private package registry/proxy for dependency caching and control',sv:'medium'},
    {id:'sc-3',tx:'SLSA framework adoption (Level 2+ build integrity)',sv:'high'},
    {id:'sc-4',tx:'Automated dependency update PRs with vulnerability context',sv:'medium'},
    {id:'sc-5',tx:'Typosquatting and malicious package detection controls',sv:'high'},
    {id:'sc-6',tx:'Code signing for all release artifacts',sv:'high'},
    {id:'sc-7',tx:'VCS branch protection with required reviews and status checks',sv:'high'},
    {id:'sc-8',tx:'Pre-commit hooks for secret detection and linting',sv:'medium'},
    {id:'sc-9',tx:'VEX statements for known vulnerabilities',sv:'medium'},
    {id:'sc-10',tx:'OpenSSF Scorecard monitoring for critical dependencies',sv:'medium'},
  ]},
  {t:'Cloud Security Posture',i:'☁️',items:[
    {id:'cld-1',tx:'CSPM tool deployed (Prisma Cloud, Prowler, ScoutSuite)',sv:'critical'},
    {id:'cld-2',tx:'No public S3 buckets/blobs — private storage access by default',sv:'critical'},
    {id:'cld-3',tx:'Cloud IAM policies follow least-privilege — no wildcard permissions',sv:'critical'},
    {id:'cld-4',tx:'VPC flow logs enabled and forwarded to security monitoring',sv:'high'},
    {id:'cld-5',tx:'Encryption at rest enabled for all data stores and volumes',sv:'high'},
    {id:'cld-6',tx:'CloudTrail/Activity Log enabled in all regions and accounts',sv:'high'},
    {id:'cld-7',tx:'Security groups reviewed — no 0.0.0.0/0 ingress on sensitive ports',sv:'critical'},
    {id:'cld-8',tx:'Multi-account strategy with landing zone (Control Tower)',sv:'medium'},
    {id:'cld-9',tx:'Cloud workload protection platform (CWPP) for runtime threats',sv:'high'},
    {id:'cld-10',tx:'Automated remediation of critical misconfigurations',sv:'medium'},
  ]},
  {t:'API & Application Security',i:'🛡️',items:[
    {id:'api-1',tx:'API gateway with auth, rate limiting, and request validation',sv:'critical'},
    {id:'api-2',tx:'OAuth 2.0 / OIDC token-based authentication for all APIs',sv:'high'},
    {id:'api-3',tx:'Input validation and output encoding at API boundaries',sv:'critical'},
    {id:'api-4',tx:'API schema validation (OpenAPI/Swagger) enforced in CI/CD',sv:'medium'},
    {id:'api-5',tx:'WAF deployed in front of public-facing services',sv:'high'},
    {id:'api-6',tx:'DDoS protection enabled (CloudFlare, AWS Shield, Azure DDoS)',sv:'high'},
    {id:'api-7',tx:'API versioning strategy with deprecation lifecycle',sv:'low'},
    {id:'api-8',tx:'Sensitive data masking in API responses and logs (PII, tokens)',sv:'high'},
    {id:'api-9',tx:'CORS policies — no wildcard origins in production',sv:'medium'},
    {id:'api-10',tx:'API security testing automated (OWASP ZAP, Burp Suite, Nuclei)',sv:'high'},
  ]},
  {t:'Data Protection & Encryption',i:'🗄️',items:[
    {id:'dp-1',tx:'Encryption in transit (TLS 1.2+) enforced for all traffic',sv:'critical'},
    {id:'dp-2',tx:'Encryption at rest for databases, object stores, and volumes',sv:'critical'},
    {id:'dp-3',tx:'Centralized key management with automatic rotation (AWS KMS)',sv:'high'},
    {id:'dp-4',tx:'Database backup encryption and integrity verification',sv:'high'},
    {id:'dp-5',tx:'Backup restoration tested on a regular schedule (quarterly)',sv:'medium'},
    {id:'dp-6',tx:'PII/sensitive data discovery and classification scanning',sv:'high'},
    {id:'dp-7',tx:'Data retention and deletion policies implemented and automated',sv:'medium'},
    {id:'dp-8',tx:'Database activity monitoring (DAM) for privileged queries',sv:'high'},
  ]},
];
/* Flat lookup: controlId → { cat, icon, tx, sv } */
const ASSESSMENT_CTRL={};
ASSESSMENT_CATS.forEach(c=>c.items.forEach(it=>{ASSESSMENT_CTRL[it.id]={cat:c.t,icon:c.i,tx:it.tx,sv:it.sv};}));

/* ═══════════════════════════════════════════════════════════════════
 * EXCEL GENERATOR — returns a Buffer (used by Excel endpoint + ZIP)
 * ═══════════════════════════════════════════════════════════════════ */
async function generateExcelBuffer(dbRow, images, exportSections) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SecAssess v21'; wb.created = new Date(); wb.modified = new Date();
  const secIncludes = (sec) => !exportSections || exportSections.includes(sec);

  const COL_W_UNITS=12, COL_PX=84, ROW_PT=15, ROW_PX=ROW_PT*(4/3); // COL_PX: floor(((256×12+18)/256)×7)=84 per OOXML spec
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
  /* Match a captured image to its workflow row by section + raw name */
  function findImg(imgs,section,rawName){const pfx={cicd:'CI/CD:',gitflow:'Git Flow:',deploy:'Deploy:',promotion:'Promo:',versioning:'Version:'}[section]||'';const t=pfx?`${pfx} ${rawName}`:rawName;return imgs.find(i=>i.section===section&&i.name===t)||imgs.find(i=>i.section===section&&i.name.toLowerCase().includes(rawName.toLowerCase()));}

  /* SHEET 1: Summary */
  const ss = wb.addWorksheet('Summary');
  ss.columns=[{header:'Field',key:'f',width:28},{header:'Value',key:'v',width:55}];
  [['Organization',dbRow.org_name],['Assessor',dbRow.assessor_name],['Date',dbRow.assessment_date],['Environment',dbRow.environment],['Score',dbRow.score+'%'],['Status',dbRow.status]].forEach(([f,v])=>ss.addRow({f,v}));
  styleHeaderRow(ss,2);

  /* SHEET 2: Assessment — grouped by category with full control descriptions */
  if (secIncludes('assessment')) {
    const as=wb.addWorksheet('Assessment');
    as.getColumn(1).width=58; as.getColumn(2).width=12; as.getColumn(3).width=14; as.getColumn(4).width=62;
    const resp=dbRow.responses||{};
    const SEV_COLOR={critical:'FFE63757',high:'FFFF8C42',medium:'FFFFD166',low:'FF66D9C2'};
    const STA_COLOR={pass:'FF00B894',fail:'FFE63757',partial:'FFF59E0B',na:'FF9CA3AF'};
    const STA_BG  ={pass:'FFE8FBF5',fail:'FFFDE8EB',partial:'FFFEF9E7',na:'FFF3F4F6'};
    let asCur=1;
    // Title row
    const titleR=as.getRow(asCur++);
    titleR.getCell(1).value=`Assessment Report — ${dbRow.org_name||''}`;
    titleR.getCell(1).font={bold:true,size:14,color:PURPLE};
    titleR.getCell(1).fill=titleFill; as.mergeCells(asCur-1,1,asCur-1,4); titleR.height=26;
    asCur++; // blank gap
    for (const cat of ASSESSMENT_CATS) {
      const catResps=cat.items.filter(it=>resp[it.id]&&resp[it.id].status);
      // banner: always show all categories (skip if no responses at all)
      if (!catResps.length) continue;
      // Category banner
      const bannerR=as.getRow(asCur++);
      bannerR.getCell(1).value=`${cat.i}  ${cat.t}  —  ${catResps.length} / ${cat.items.length} assessed`;
      bannerR.getCell(1).font={bold:true,size:12,color:PURPLE};
      bannerR.getCell(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFEDE9FF'}};
      bannerR.getCell(1).alignment={vertical:'middle'};
      as.mergeCells(asCur-1,1,asCur-1,4); bannerR.height=22;
      // Column header
      const hdrR=as.getRow(asCur++);
      ['Control',`Severity`,'Status','Notes'].forEach((h,i)=>{
        const c=hdrR.getCell(i+1); c.value=h; c.font={bold:true,color:PURPLE,size:10};
        c.fill=headerFill; c.alignment={vertical:'middle'}; c.border={bottom:{style:'thin',color:PURPLE}};
      }); hdrR.height=18;
      // Controls
      cat.items.forEach((it,idx)=>{
        const r=resp[it.id]||{}; const st=r.status||''; const notes=r.notes||'';
        if (!st) return; // skip unassessed
        const row=as.getRow(asCur++);
        row.getCell(1).value=it.tx;
        row.getCell(1).alignment={wrapText:true,vertical:'top'};
        // Severity cell
        const sevCell=row.getCell(2);
        sevCell.value=it.sv; sevCell.font={bold:true,size:10,color:{argb:SEV_COLOR[it.sv]||'FF636E72'}};
        sevCell.alignment={horizontal:'center',vertical:'top'};
        // Status cell
        const staCell=row.getCell(3);
        staCell.value=st; staCell.font={bold:true,size:10,color:{argb:STA_COLOR[st]||'FF8B88A2'}};
        staCell.fill={type:'pattern',pattern:'solid',fgColor:{argb:STA_BG[st]||'FFFFFFFF'}};
        staCell.alignment={horizontal:'center',vertical:'top'};
        // Notes cell
        row.getCell(4).value=notes; row.getCell(4).alignment={wrapText:true,vertical:'top'};
        row.height=notes.length>60?30:18;
        if(idx%2===0){[1,2,4].forEach(c=>{if(!row.getCell(c).fill?.fgColor?.argb?.startsWith('FF'))row.getCell(c).fill=altFill;});}
      });
      asCur++; // blank separator between categories
    }
  }

  /* SHEET 3: Pricing & Resource Estimation */
  const pr=dbRow.pricing||{};
  if (pr.engineers && secIncludes('pricing')) {
    const ps=wb.addWorksheet('Pricing & Resource Estimation');
    ps.getColumn(1).width=34; ps.getColumn(2).width=22; ps.getColumn(3).width=22; ps.getColumn(4).width=22; ps.getColumn(5).width=22;
    const cur=pr.currency||'USD'; const fmt=v=>v.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0});
    const monthly=(pr.hourlyRate||0)*160;
    const base=monthly*(pr.engineers||1)*(pr.duration||1);
    const contAmt=base*((pr.contingency||0)/100);
    const total=base+contAmt;
    let pCur=1;
    // Title
    const ptitle=ps.getRow(pCur++); ptitle.getCell(1).value='Pricing & Resource Estimation';
    ptitle.getCell(1).font={bold:true,size:14,color:PURPLE}; ptitle.getCell(1).fill=titleFill;
    ps.mergeCells(pCur-1,1,pCur-1,5); ptitle.height=26; pCur++;
    // Section 1: Resource Summary
    pCur=addSectionBanner(ps,'Resource Summary',pCur);
    ['Role / Parameter','Value','','',''].forEach((h,i)=>{const c=ps.getRow(pCur).getCell(i+1);c.value=h;c.font={bold:true,color:PURPLE,size:10};c.fill=headerFill;c.alignment={vertical:'middle'};});
    ps.getRow(pCur).height=18; pCur++;
    [['DevOps Engineers',pr.engineers],['Project Duration',`${pr.duration} months`],['Hourly Rate',`${pr.hourlyRate} ${cur}/hr`],['Monthly Rate / Engineer',`${fmt(monthly)} ${cur}`],['Total Person-Months',`${((pr.engineers||1)*(pr.duration||1))} person-months`],['Currency',cur]]
      .forEach(([f,v],idx)=>{const r=ps.getRow(pCur++);r.getCell(1).value=f;r.getCell(2).value=v;if(idx%2===0){[1,2].forEach(c=>r.getCell(c).fill=altFill);}});
    pCur++;
    // Section 2: Cost Breakdown
    pCur=addSectionBanner(ps,'Cost Breakdown',pCur);
    ['Item','Amount ('+cur+')','','',''].forEach((h,i)=>{const c=ps.getRow(pCur).getCell(i+1);c.value=h;c.font={bold:true,color:PURPLE,size:10};c.fill=headerFill;c.alignment={vertical:'middle'};});
    ps.getRow(pCur).height=18; pCur++;
    [['Base Cost (engineers × rate × duration)',base],['Contingency ('+(pr.contingency||0)+'%)',contAmt],['Total Project Cost',total]]
      .forEach(([f,v],idx)=>{const r=ps.getRow(pCur++);r.getCell(1).value=f;r.getCell(2).value=fmt(v);if(idx===2){r.getCell(1).font={bold:true,color:PURPLE};r.getCell(2).font={bold:true,color:PURPLE};}else if(idx%2===0){[1,2].forEach(c=>r.getCell(c).fill=altFill);}});
  }

  /* SHEET 4: Phase Allocation */
  if (pr.engineers && secIncludes('pricing') && pr.phases?.length) {
    const pas=wb.addWorksheet('Phase Allocation');
    pas.getColumn(1).width=36; pas.getColumn(2).width=16; pas.getColumn(3).width=14; pas.getColumn(4).width=22; pas.getColumn(5).width=18;
    const cur=pr.currency||'USD'; const fmt=v=>v.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0});
    const monthly=(pr.hourlyRate||0)*160;
    const base=monthly*(pr.engineers||1)*(pr.duration||1);
    const contAmt=base*((pr.contingency||0)/100);
    const total=base+contAmt;
    let paCur=1;
    const paTitle=pas.getRow(paCur++);
    paTitle.getCell(1).value='Phase Allocation';
    paTitle.getCell(1).font={bold:true,size:14,color:PURPLE};
    paTitle.getCell(1).fill=titleFill;
    pas.mergeCells(paCur-1,1,paCur-1,5);
    paTitle.height=26;
    paCur++;
    ['Phase','Allocation %','Months','Estimated Cost ('+cur+')','% of Job'].forEach((h,i)=>{
      const c=pas.getRow(paCur).getCell(i+1);
      c.value=h; c.font={bold:true,color:PURPLE,size:10}; c.fill=headerFill; c.alignment={vertical:'middle'};
    });
    pas.getRow(paCur).height=18; paCur++;
    let phasePctTotal=0, phaseCostTotal=0, phaseMonthsTotal=0;
    pr.phases.forEach((p,idx)=>{
      const pct=Number(p.percentage)||0;
      const months=Number(p.months)||0;
      const phaseCost=total*(pct/100);
      phasePctTotal+=pct; phaseCostTotal+=phaseCost; phaseMonthsTotal+=months;
      const r=pas.getRow(paCur++);
      r.getCell(1).value=p.name;
      r.getCell(2).value=pct+'%';
      r.getCell(3).value=months || '';
      r.getCell(4).value=fmt(phaseCost);
      r.getCell(5).value=pct+'%';
      if(idx%2===0)[1,2,3,4,5].forEach(c=>r.getCell(c).fill=altFill);
    });
    const totR=pas.getRow(paCur++);
    totR.getCell(1).value='Total';
    totR.getCell(2).value=phasePctTotal+'%';
    totR.getCell(3).value=phaseMonthsTotal || '';
    totR.getCell(4).value=fmt(phaseCostTotal);
    totR.getCell(5).value=phasePctTotal+'%';
    [1,2,3,4,5].forEach(c=>{totR.getCell(c).font={bold:true,color:PURPLE};totR.getCell(c).border={top:{style:'thin',color:PURPLE}};});
  }

  /* SHEET 5: CI-CD */
  const cicd=dbRow.cicd_diagrams||{};
  if (cicd.workflows?.length && secIncludes('cicd')) {
    const ws=wb.addWorksheet('CI-CD'); setImageColWidths(ws);
    ws.columns=[{header:'Workflow',key:'wf',width:COL_W_UNITS*2},{header:'Pipeline',key:'pl',width:COL_W_UNITS*2.5},{header:'Stages',key:'s',width:COL_W_UNITS},{header:'Desc',key:'d',width:COL_W_UNITS*4}];
    styleHeaderRow(ws,4);
    let cur=2;
    for(const wf of cicd.workflows){for(const p of(wf.pipelines||[])){const r=ws.getRow(cur);r.getCell(1).value=wf.name;r.getCell(2).value=p.name;r.getCell(3).value=(p.nodes||[]).length;r.getCell(4).value=p.description||'';cur++;const img=findImg(images,'cicd',p.name);if(img){try{cur=anchorImage(ws,Buffer.from(img.data,'base64'),img.width||600,img.height||300,cur);}catch{}}}}
  }

  /* SHEET 6: GitFlow */
  const gf=dbRow.gitflow_diagrams||{};
  if (gf.flows?.length && secIncludes('gitflow')) {
    const gs=wb.addWorksheet('GitFlow'); setImageColWidths(gs);
    gs.columns=[{header:'Flow',key:'n',width:COL_W_UNITS*3},{header:'Nodes',key:'c',width:COL_W_UNITS},{header:'Desc',key:'d',width:COL_W_UNITS*6}];
    styleHeaderRow(gs,3);
    let cur=2;
    for(const f of gf.flows){const r=gs.getRow(cur);r.getCell(1).value=f.name;r.getCell(2).value=(f.nodes||[]).length;r.getCell(3).value=f.description||'';cur++;const img=findImg(images,'gitflow',f.name);if(img){try{cur=anchorImage(gs,Buffer.from(img.data,'base64'),img.width||600,img.height||300,cur);}catch{}}}
  }

  /* SHEET 7: Deploy */
  const ds=dbRow.deployment_strategies||{};
  if (ds.strategies?.length && secIncludes('deploy')) {
    const dss=wb.addWorksheet('Deploy'); setImageColWidths(dss);
    dss.columns=[{header:'Strategy',key:'n',width:COL_W_UNITS*3},{header:'Category',key:'c',width:COL_W_UNITS*1.5},{header:'Stages',key:'s',width:COL_W_UNITS},{header:'Desc',key:'d',width:COL_W_UNITS*4}];
    styleHeaderRow(dss,4);
    let cur=2;
    for(const s of ds.strategies){const r=dss.getRow(cur);r.getCell(1).value=s.name;r.getCell(2).value=s.cat||'';r.getCell(3).value=(s.nodes||[]).length;r.getCell(4).value=s.description||'';cur++;const img=findImg(images,'deploy',s.name);if(img){try{cur=anchorImage(dss,Buffer.from(img.data,'base64'),img.width||600,img.height||300,cur);}catch{}}}
  }

  /* SHEET 8: Promotion */
  const pw_data=dbRow.promotion_workflows||{};
  if (pw_data.workflows?.length && secIncludes('promotion')) {
    const pws=wb.addWorksheet('Promotion'); setImageColWidths(pws);
    pws.columns=[{header:'Workflow',key:'n',width:COL_W_UNITS*3},{header:'Category',key:'c',width:COL_W_UNITS*1.5},{header:'Stages',key:'s',width:COL_W_UNITS},{header:'Desc',key:'d',width:COL_W_UNITS*4}];
    styleHeaderRow(pws,4);
    let cur=2;
    for(const w of pw_data.workflows){const r=pws.getRow(cur);r.getCell(1).value=w.name;r.getCell(2).value=w.cat||'';r.getCell(3).value=(w.nodes||[]).length;r.getCell(4).value=w.description||'';cur++;const img=findImg(images,'promotion',w.name);if(img){try{cur=anchorImage(pws,Buffer.from(img.data,'base64'),img.width||600,img.height||300,cur);}catch{}}}
  }

  /* SHEET 9: Versioning */
  const vd=dbRow.versioning_diagrams||{};
  if (vd.flows?.length && secIncludes('versioning')) {
    const vs=wb.addWorksheet('Versioning'); setImageColWidths(vs);
    vs.columns=[{header:'Scheme',key:'n',width:COL_W_UNITS*3},{header:'Nodes',key:'c',width:COL_W_UNITS},{header:'Desc',key:'d',width:COL_W_UNITS*6}];
    styleHeaderRow(vs,3);
    let cur=2;
    for(const f of vd.flows){const r=vs.getRow(cur);r.getCell(1).value=f.name;r.getCell(2).value=(f.nodes||[]).length;r.getCell(3).value=f.description||'';cur++;const img=findImg(images,'versioning',f.name);if(img){try{cur=anchorImage(vs,Buffer.from(img.data,'base64'),img.width||600,img.height||300,cur);}catch{}}}
  }

  /* SHEET 10: Artifacts */
  const ar=dbRow.artifact_repos||{};
  if (ar.registries?.length && secIncludes('artifacts')) {
    const ars=wb.addWorksheet('Artifacts');
    ars.columns=[{header:'Registry',key:'r',width:26},{header:'Type',key:'t',width:16},{header:'Repo',key:'n',width:26},{header:'Class',key:'c',width:14},{header:'Pkg',key:'p',width:14}];
    styleHeaderRow(ars,5);
    ar.registries.forEach(r=>(r.repos||[]).forEach(rp=>ars.addRow({r:r.name,t:r.registryType,n:rp.name,c:rp.repoClass,p:rp.pkgType})));
  }

  /* SHEET 9: Gantt — data table + visual week-bar timeline */
  const ganttData=dbRow.gantt||{}; const ganttTasks=ganttData.tasks||[]; const ganttCats=ganttData.categories||{};
  if (ganttTasks.length && secIncludes('gantt')) {
    const gs=wb.addWorksheet('Gantt');
    const totalWks=Math.min(ganttData.totalWeeks||12,26); // cap visual at 26 weeks
    gs.getColumn(1).width=36; gs.getColumn(2).width=16; gs.getColumn(3).width=18; gs.getColumn(4).width=10; gs.getColumn(5).width=10; gs.getColumn(6).width=12; gs.getColumn(7).width=20;
    for(let w=0;w<totalWks;w++) gs.getColumn(8+w).width=3.2;
    // Header row
    const gHdr=gs.getRow(1); gHdr.height=22;
    ['Task','Category','Sub-Category','Start Wk','End Wk','Dur (wks)','Dependencies'].forEach((h,i)=>{
      const c=gHdr.getCell(i+1);c.value=h;c.fill=headerFill;c.font={bold:true,color:PURPLE,size:10};c.alignment={vertical:'middle'};c.border={bottom:{style:'thin',color:PURPLE}};
    });
    for(let w=0;w<totalWks;w++){const c=gHdr.getCell(8+w);c.value=w+1;c.fill=headerFill;c.font={bold:true,color:PURPLE,size:7};c.alignment={horizontal:'center',vertical:'middle'};c.border={bottom:{style:'thin',color:PURPLE}};}
    // Build task name lookup for dependencies display
    const taskById={};ganttTasks.forEach(t=>{taskById[t.id]=t.name;});
    const defaultCatColors={planning:'FF6C5CE7',cicd:'FF00B894',container:'FF0984E3',k8s:'FFFD79A8',iac:'FFE17055',iam:'FFA29BFE',monitoring:'FF00CEC9',compliance:'FFFDCB6E',supply:'FF55EFC4'};
    function catArgb(catKey){const hex=(ganttCats[catKey]?.color||'').replace('#','');return hex?'FF'+hex.toUpperCase():defaultCatColors[catKey]||'FFA29BFE';}
    // Data rows
    ganttTasks.forEach((t,idx)=>{
      const row=gs.getRow(idx+2); row.height=18;
      const depNames=(t.deps||[]).map(d=>taskById[d]||String(d)).join(', ');
      const startWeek=(t.start!=null?t.start+1:'');
      const endWeek=(t.start!=null?(t.start+(t.duration||1)):'');
      row.getCell(1).value=t.name; row.getCell(2).value=ganttCats[t.category]?.label||t.category;
      row.getCell(3).value=t.subCategory||''; row.getCell(4).value=startWeek; row.getCell(5).value=endWeek;
      row.getCell(6).value=t.duration; row.getCell(7).value=depNames;
      if(idx%2===0)[1,2,3,4,5,6,7].forEach(c=>{row.getCell(c).fill=altFill;});
      // Week bars
      const argb=catArgb(t.category); const barFill={type:'pattern',pattern:'solid',fgColor:{argb}};
      const start=t.start||0; const end=Math.min(start+(t.duration||1),totalWks);
      for(let w=0;w<totalWks;w++){
        const cell=row.getCell(8+w);
        if(w>=start&&w<end){cell.fill=barFill;}
        else if(idx%2===0){cell.fill=altFill;}
        cell.border={left:{style:'thin',color:{argb:'FFE0DFFF'}},right:{style:'thin',color:{argb:'FFE0DFFF'}}};
      }
    });
    // Category legend below
    const legendStart=ganttTasks.length+3;
    const lgHdr=gs.getRow(legendStart);lgHdr.getCell(1).value='Category Legend';lgHdr.getCell(1).font={bold:true,color:PURPLE};
    Object.entries(ganttCats).forEach(([k,v],i)=>{
      const r=gs.getRow(legendStart+1+i);
      r.getCell(1).value=v.label||k;
      r.getCell(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:catArgb(k)}};
      r.getCell(1).font={bold:true,color:{argb:'FFFFFFFF'}}; r.height=16;
    });
  }

  /* SHEET 12: WorkPlan */
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

  /* SHEET 13: Assessment & Planning Heatmap */
  if (secIncludes('assessment')) {
    const hm=wb.addWorksheet('Heatmap');
    hm.getColumn(1).width=30; [2,3,4,5,6,7,8,9,10,11].forEach(c=>hm.getColumn(c).width=11);
    const resp2=dbRow.responses||{};
    function heatColor(score){
      if(score===null)return 'FFD0D0E0'; // not assessed — grey
      if(score>=0.9)return 'FF00B894';
      if(score>=0.75)return 'FF55EFC4';
      if(score>=0.6)return 'FFFFD166';
      if(score>=0.4)return 'FFFDCB6E';
      if(score>=0.2)return 'FFFAB1A0';
      return 'FFE63757';
    }
    function heatFont(score){return score!==null&&score>=0.6?'FF1A1A2E':'FFFFFFFF';}
    let hmCur=1;
    // Title
    const hmTitle=hm.getRow(hmCur++);
    hmTitle.getCell(1).value='Assessment & Planning Heatmap';
    hmTitle.getCell(1).font={bold:true,size:14,color:PURPLE}; hmTitle.getCell(1).fill=titleFill;
    hm.mergeCells(hmCur-1,1,hmCur-1,11); hmTitle.height=26; hmCur++;
    // ── Section A: Per-category compliance overview ──
    hmCur=addSectionBanner(hm,'Category Compliance Overview',hmCur);
    const ovHdr=['Category','Total','Assessed','Pass','Fail','Partial','N/A','Skipped','Score %','Grade'];
    ovHdr.forEach((h,i)=>{const c=hm.getRow(hmCur).getCell(i+1);c.value=h;c.font={bold:true,color:PURPLE,size:10};c.fill=headerFill;c.alignment={horizontal:'center',vertical:'middle'};c.border={bottom:{style:'thin',color:PURPLE}};});
    hm.getRow(hmCur).height=18; hmCur++;
    ASSESSMENT_CATS.forEach((cat,ci)=>{
      const items=cat.items; const total=items.length;
      let pass=0,fail=0,partial=0,na=0,skip=0;
      items.forEach(it=>{const r=resp2[it.id]||{};const s=r.status||'';if(s==='pass')pass++;else if(s==='fail')fail++;else if(s==='partial')partial++;else if(s==='na')na++;else skip++;});
      const assessed=pass+fail+partial; const scoreDenom=assessed;
      const score=scoreDenom>0?(pass+partial*0.5)/scoreDenom:null;
      const scorePct=score!==null?Math.round(score*100)+'%':'—';
      const grade=score===null?'—':score>=0.9?'A':score>=0.75?'B':score>=0.6?'C':score>=0.4?'D':'F';
      const row=hm.getRow(hmCur++); row.height=18;
      row.getCell(1).value=`${cat.i} ${cat.t}`;
      [total,assessed,pass,fail,partial,na,skip,scorePct,grade].forEach((v,i)=>{row.getCell(i+2).value=v;row.getCell(i+2).alignment={horizontal:'center'};});
      // Colour the Score % and Grade cells
      const argb=heatColor(score); const fargb=heatFont(score);
      [9,10].forEach(c=>{row.getCell(c).fill={type:'pattern',pattern:'solid',fgColor:{argb}};row.getCell(c).font={bold:true,color:{argb:fargb}};});
      // Fail count in red if > 0
      if(fail>0){row.getCell(5).font={bold:true,color:{argb:'FFE63757'}};}
      if(ci%2===0)[1,2,3,4,6,7,8].forEach(c=>{if(!row.getCell(c).fill?.fgColor?.argb?.startsWith('FFE6'))row.getCell(c).fill=altFill;});
    });
    hmCur+=2;
    // ── Section B: Severity Breakdown heatmap ──
    hmCur=addSectionBanner(hm,'Severity Breakdown by Category',hmCur);
    // Severity cols: Crit Pass/Total | High | Med | Low
    const sevHdrs=['Category','Critical','','High','','Medium','','Low','','Overall %'];
    const sevSubHdrs=['','Pass','Total','Pass','Total','Pass','Total','Pass','Total',''];
    sevHdrs.forEach((h,i)=>{const c=hm.getRow(hmCur).getCell(i+1);c.value=h;c.font={bold:true,color:PURPLE,size:10};c.fill=headerFill;c.alignment={horizontal:'center',vertical:'middle'};});
    hm.getRow(hmCur).height=16; hmCur++;
    sevSubHdrs.forEach((h,i)=>{const c=hm.getRow(hmCur).getCell(i+1);c.value=h;c.font={bold:false,color:PURPLE,size:9};c.fill=headerFill;c.alignment={horizontal:'center',vertical:'middle'};});
    hm.getRow(hmCur).height=14; hmCur++;
    ASSESSMENT_CATS.forEach((cat,ci)=>{
      const row=hm.getRow(hmCur++); row.height=18;
      row.getCell(1).value=`${cat.i} ${cat.t}`; if(ci%2===0)row.getCell(1).fill=altFill;
      const sevs=['critical','high','medium','low']; let totalPass=0,totalActive=0;
      sevs.forEach((sv,si)=>{
        const sItems=cat.items.filter(it=>it.sv===sv);
        let sp=0,stotal=0;
        sItems.forEach(it=>{const r=resp2[it.id]||{};const s=r.status||'';if(s&&s!=='na'){stotal++;if(s==='pass')sp++;else if(s==='partial')sp+=0.5;}});
        totalPass+=sp; totalActive+=stotal;
        const col=2+si*2; const score=stotal>0?sp/stotal:null;
        const argb=heatColor(score); const fargb=heatFont(score);
        row.getCell(col).value=Math.round(sp); row.getCell(col).alignment={horizontal:'center'};
        row.getCell(col+1).value=stotal||'—'; row.getCell(col+1).alignment={horizontal:'center'};
        if(score!==null){row.getCell(col).fill={type:'pattern',pattern:'solid',fgColor:{argb}};row.getCell(col).font={bold:true,color:{argb:fargb}};}
        else if(ci%2===0){row.getCell(col).fill=altFill;row.getCell(col+1).fill=altFill;}
      });
      const overallScore=totalActive>0?totalPass/totalActive:null;
      row.getCell(10).value=overallScore!==null?Math.round(overallScore*100)+'%':'—'; row.getCell(10).alignment={horizontal:'center'};
      if(overallScore!==null){const argb=heatColor(overallScore);row.getCell(10).fill={type:'pattern',pattern:'solid',fgColor:{argb}};row.getCell(10).font={bold:true,color:{argb:heatFont(overallScore)}};}
    });
  }

  /* SHEET 12: All_Diagrams */
  if (images.length>0) {
    const imgSheet=wb.addWorksheet('All_Diagrams'); setImageColWidths(imgSheet);
    const tCell=imgSheet.getRow(1).getCell(1);
    tCell.value='All Workflow Diagrams'; tCell.font={bold:true,size:16,color:PURPLE}; tCell.fill=titleFill; tCell.alignment={vertical:'middle'};
    imgSheet.getRow(1).height=28; imgSheet.mergeCells(1,1,1,IMG_COLS);
    const diagSecs=['cicd','gitflow','deploy','promotion','versioning'];
    const secLabels={cicd:'CI/CD Workflows',gitflow:'Git Flow',deploy:'Deployment Strategies',promotion:'Promotion Workflows',versioning:'Versioning'};
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
