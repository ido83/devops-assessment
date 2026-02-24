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

const JSONB_FIELDS = ['responses','pricing','gantt','workplan','custom_templates','cicd_diagrams','gitflow_diagrams','artifact_repos','deployment_strategies','versioning_diagrams'];
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
    await pool.query(`INSERT INTO assessments (id, org_name, assessor_name, assessment_date, environment, scope, template, responses, pricing, gantt, workplan, custom_templates, cicd_diagrams, gitflow_diagrams, artifact_repos, deployment_strategies, versioning_diagrams, score, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
      [id, san(b.org_name,500), san(b.assessor_name,500), san(b.assessment_date,50), san(b.environment,100), san(b.scope), san(b.template,100), jsonSafe(b.responses), jsonSafe(b.pricing), jsonSafe(b.gantt), jsonSafe(b.workplan), jsonSafe(b.custom_templates,'[]'), jsonSafe(b.cicd_diagrams), jsonSafe(b.gitflow_diagrams), jsonSafe(b.artifact_repos), jsonSafe(b.deployment_strategies), jsonSafe(b.versioning_diagrams), parseInt(b.score)||0, san(b.status,50)||'draft']);
    res.json({ id }); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/assessments/:id', async (req, res) => {
  try { const b = req.body;
    const { rowCount } = await pool.query(`UPDATE assessments SET org_name=$1, assessor_name=$2, assessment_date=$3, environment=$4, scope=$5, template=$6, responses=$7, pricing=$8, gantt=$9, workplan=$10, custom_templates=$11, cicd_diagrams=$12, gitflow_diagrams=$13, artifact_repos=$14, deployment_strategies=$15, versioning_diagrams=$16, score=$17, status=$18, updated_at=NOW() WHERE id=$19`,
      [san(b.org_name,500), san(b.assessor_name,500), san(b.assessment_date,50), san(b.environment,100), san(b.scope), san(b.template,100), jsonSafe(b.responses), jsonSafe(b.pricing), jsonSafe(b.gantt), jsonSafe(b.workplan), jsonSafe(b.custom_templates,'[]'), jsonSafe(b.cicd_diagrams), jsonSafe(b.gitflow_diagrams), jsonSafe(b.artifact_repos), jsonSafe(b.deployment_strategies), jsonSafe(b.versioning_diagrams), parseInt(b.score)||0, san(b.status,50)||'draft', san(req.params.id,100)]);
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
      await pool.query(`INSERT INTO assessments (id, org_name, assessor_name, assessment_date, environment, scope, template, responses, pricing, gantt, workplan, custom_templates, cicd_diagrams, gitflow_diagrams, artifact_repos, deployment_strategies, versioning_diagrams, score, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
        [id, san(m.org_name||m.organization,500), san(m.assessor_name||m.assessor,500), san(m.assessment_date||m.date,50), san(m.environment,100), san(m.scope), san(m.template,100), jsonSafe(item.responses||m.responses), jsonSafe(item.pricing||m.pricing), jsonSafe(item.gantt||m.gantt), jsonSafe(item.workplan||m.workplan), jsonSafe(item.custom_templates||m.custom_templates,'[]'), jsonSafe(item.cicd_diagrams||m.cicd_diagrams), jsonSafe(item.gitflow_diagrams||m.gitflow_diagrams), jsonSafe(item.artifact_repos||m.artifact_repos), jsonSafe(item.deployment_strategies||m.deployment_strategies), jsonSafe(item.versioning_diagrams||m.versioning_diagrams), parseInt(item.score||m.score)||0, 'imported']);
      ids.push(id); } res.json({ imported: ids.length, ids }); }
  catch (e) { res.status(400).json({ error: 'Invalid: ' + e.message }); }
});

/* ═══ Shared report data builder — same content for all formats ═══ */
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
  return { meta: { org: row.org_name, assessor: row.assessor_name, date: row.assessment_date, env: row.environment, score: row.score, status: row.status }, sections, respEntries, pricing: pr };
}

/* ═══ Export: PDF v21 — per-section pages, +20% fonts, centered images, original icons ═══ */
app.post('/api/export/pdf/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM assessments WHERE id = $1', [san(req.params.id,100)]);
    if (!rows.length) return res.status(404).json({ error:'Not found' });
    const row = parseRow(rows[0]);
    const rpt = buildReportData(row);

    /* images: [{name, data, width, height, section, tabKey}] sent from client at 3× scale */
    const images         = req.body.images         || [];
    const exportSections = req.body.exportSections || null;
    const secIncludes    = (id) => !exportSections || exportSections.includes(id);

    /* ── Typography scale (+20% vs web view) ───────────────────────────
     * Web base ≈ 10pt → PDF base = 12pt
     * All font sizes in this file are the PDF sizes (already +20%).        */
    const F = {
      title:   44,   // cover title
      heading: 28,   // section heading (web ~23pt → PDF 28pt)
      subhead: 16,   // table sub-head
      body:    13,   // body / key-value text  (web ~11pt → PDF 13pt)
      table:   11,   // table body rows        (web ~9pt  → PDF 11pt)
      caption: 11,   // image captions
      small:   9,    // footnotes
    };

    /* ── Strip emoji — PDFKit built-in fonts cannot render Unicode emoji ── */
    const stripEmoji = (s) =>
      String(s || '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}]/gu, '').trim();
    const cl = (s) => stripEmoji(String(s || '—'));

    /* ── Page geometry ── */
    const MARGIN = 52;
    const PW     = 595 - MARGIN * 2;  /* usable width  = 491 */
    const PH     = 842 - MARGIN * 2;  /* usable height = 738 */

    /* ── Brand colours ── */
    const C = {
      accent: '#4a3fbf',
      light:  '#a29bfe',
      muted:  '#6b6890',
      text:   '#1e1a3a',
      pass:   '#00b894',
      fail:   '#e63757',
      partial:'#f59e0b',
      na:     '#9ca3af',
      rowAlt: '#f4f2ff',
      hdrBg:  '#ece9ff',
    };

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      info: { Title: `SecAssess Report — ${rpt.meta.org}`, Author: rpt.meta.assessor },
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${san(row.org_name || 'report', 50)}.pdf"`);
    doc.pipe(res);

    /* ─────────────────────────────────────────────────────────────────
     * Helper: start a new section page
     * Draws a coloured left accent bar + large heading + separator rule.
     * Everything for a section (header, text, images) lives together —
     * implements the "page-break-before: always; page-break-inside: avoid"
     * intent from the spec by grouping content after addPage().
     * ───────────────────────────────────────────────────────────────── */
    const startSection = (title, subtitle) => {
      doc.addPage();

      /* Accent sidebar bar */
      doc.rect(MARGIN, MARGIN, 6, 60).fill(C.accent);

      /* Section heading */
      doc.fontSize(F.heading).fillColor(C.accent)
         .text(cl(title), MARGIN + 16, MARGIN + 8, { width: PW - 16 });

      if (subtitle) {
        doc.fontSize(F.body).fillColor(C.muted)
           .text(cl(subtitle), MARGIN + 16, MARGIN + 42, { width: PW - 16 });
      }

      /* Separator rule */
      doc.moveTo(MARGIN, MARGIN + 68)
         .lineTo(MARGIN + PW, MARGIN + 68)
         .strokeColor('#c8c4ee').lineWidth(0.6).stroke();

      doc.y = MARGIN + 80;
    };

    /* ─────────────────────────────────────────────────────────────────
     * Helper: guard against overflow — start new page if needed
     * ───────────────────────────────────────────────────────────────── */
    const guardOverflow = (neededHeight = 20) => {
      if (doc.y + neededHeight > MARGIN + PH) {
        doc.addPage();
        doc.y = MARGIN;
      }
    };

    /* ─────────────────────────────────────────────────────────────────
     * Helper: embed the images for one diagram section.
     * Images are centered horizontally, aspect ratio preserved.
     * Each image + its caption is treated as an atomic unit
     * (page-break-inside: avoid) — if it won't fit we start a new page.
     * ───────────────────────────────────────────────────────────────── */
    const embedSectionImages = (sectionKey) => {
      const matched = images.filter(img => img.section === sectionKey);
      if (!matched.length) return;

      doc.moveDown(0.6);
      doc.fontSize(F.subhead).fillColor(C.accent).text('Workflow Diagrams', MARGIN, doc.y);
      doc.moveDown(0.4);

      for (const img of matched) {
        try {
          const iw = img.width  || 600;
          const ih = img.height || 300;

          /* Scale to fit page width; cap height at 60% of usable page height */
          const maxW  = PW;
          const maxH  = Math.round(PH * 0.58);
          const scale = Math.min(maxW / iw, maxH / ih, 1);
          const dw    = Math.round(iw * scale);
          const dh    = Math.round(ih * scale);

          /* Atomic unit height: caption (18pt) + gap (6) + image + bottom margin (14) */
          const unitH = 24 + dh + 14;

          /* If this image + caption won't fit, move to a new page */
          if (doc.y + unitH > MARGIN + PH) {
            doc.addPage();
            doc.y = MARGIN;
          }

          /* Caption — strip section prefix for cleaner display */
          const caption = cl(img.name).replace(/^(CI\/CD|Git Flow|Deploy|Version):\s*/i, '');
          doc.fontSize(F.caption).fillColor(C.muted)
             .text(caption, MARGIN, doc.y, { width: PW });
          doc.moveDown(0.25);

          /* Center horizontally: x = left margin + (usable width - image width) / 2 */
          const xImg = MARGIN + Math.round((PW - dw) / 2);
          const buf  = Buffer.from(img.data, 'base64');

          /* Images from client are at 3× scale — embed at display size */
          doc.image(buf, xImg, doc.y, { width: dw, height: dh });
          doc.y += dh + 14;
        } catch (imgErr) {
          doc.fontSize(F.small).fillColor(C.muted)
             .text(`[Image unavailable: ${cl(img.name)}]`, MARGIN, doc.y);
          doc.moveDown(0.5);
        }
      }
    };

    /* ═══════════════════════════════════════════════════════════════
     * COVER PAGE
     * ═══════════════════════════════════════════════════════════════ */
    /* Background accent block at top */
    doc.rect(0, 0, 595, 180).fill('#0d0b1e');

    doc.fontSize(F.title).fillColor('#ffffff')
       .text('SecAssess', MARGIN, 60, { align: 'center', width: PW });
    doc.fontSize(F.subhead).fillColor(C.light)
       .text('Security Assessment Report', MARGIN, 120, { align: 'center', width: PW });

    doc.fontSize(F.body).fillColor(C.text)
       .text(cl(rpt.meta.org), MARGIN, 210, { align: 'center', width: PW });
    doc.fontSize(F.body).fillColor(C.muted)
       .text(`Assessor: ${cl(rpt.meta.assessor)}`, MARGIN, 232, { align: 'center', width: PW });
    doc.fontSize(F.table).fillColor(C.muted)
       .text(new Date().toLocaleDateString('en-GB', { year:'numeric', month:'long', day:'numeric' }),
         MARGIN, 252, { align: 'center', width: PW });

    /* Score box */
    const bx = MARGIN + Math.round((PW - 220) / 2);
    const by = 290;
    doc.roundedRect(bx, by, 220, 100, 12)
       .fillAndStroke('#f4f2ff', C.accent);
    doc.fontSize(54).fillColor(C.accent)
       .text(`${rpt.meta.score}%`, bx, by + 8, { align: 'center', width: 220 });
    doc.fontSize(F.table).fillColor(C.muted)
       .text('Overall Security Score', bx, by + 68, { align: 'center', width: 220 });

    /* Quick-stat row */
    const statY = 420;
    const statW = Math.round(PW / 3);
    [
      ['Pass',    rpt.respEntries.filter(([,r]) => r.status === 'pass').length,    C.pass],
      ['Partial', rpt.respEntries.filter(([,r]) => r.status === 'partial').length, C.partial],
      ['Fail',    rpt.respEntries.filter(([,r]) => r.status === 'fail').length,    C.fail],
    ].forEach(([label, count, color], i) => {
      const sx = MARGIN + i * statW;
      doc.roundedRect(sx + 4, statY, statW - 8, 64, 8).fill(color + '18');
      doc.fontSize(28).fillColor(color).text(String(count), sx + 4, statY + 6, { align:'center', width: statW - 8 });
      doc.fontSize(F.small).fillColor(C.muted).text(label, sx + 4, statY + 40, { align:'center', width: statW - 8 });
    });

    /* Cover footer */
    doc.fontSize(F.small).fillColor(C.muted)
       .text('Generated by SecAssess v21', MARGIN, PH + MARGIN - 20, { align:'center', width: PW });

    /* ═══════════════════════════════════════════════════════════════
     * TABLE OF CONTENTS
     * ═══════════════════════════════════════════════════════════════ */
    doc.addPage();
    doc.rect(MARGIN, MARGIN, 6, 36).fill(C.accent);
    doc.fontSize(F.heading).fillColor(C.accent)
       .text('Contents', MARGIN + 16, MARGIN + 8, { width: PW - 16 });
    doc.y = MARGIN + 56;

    const secIdMap = {
      'Configuration':          'config',
      'Assessment Responses':   'assessment',
      'CI/CD Workflows':        'cicd',
      'Git Flow':               'gitflow',
      'Deployment Strategies':  'deploy',
      'Versioning':             'versioning',
      'Artifact Registries':    'artifacts',
      'Pricing':                'pricing',
    };
    const diagramSectionKey = {
      'CI/CD Workflows':       'cicd',
      'Git Flow':              'gitflow',
      'Deployment Strategies': 'deploy',
      'Versioning':            'versioning',
    };

    let tocIndex = 1;
    for (const sec of rpt.sections) {
      const secId = secIdMap[sec.title];
      if (secId && !secIncludes(secId)) continue;
      guardOverflow(22);
      doc.fontSize(F.body).fillColor(C.text)
         .text(`${tocIndex++}.  ${cl(sec.title)}`, MARGIN + 10, doc.y, { width: PW - 10 });
      doc.moveDown(0.5);
    }

    /* ═══════════════════════════════════════════════════════════════
     * SECTIONS — each on its own page (break-before: page)
     * Content + diagrams grouped together (break-inside: avoid)
     * ═══════════════════════════════════════════════════════════════ */
    for (const sec of rpt.sections) {
      const secId = secIdMap[sec.title];
      if (secId && !secIncludes(secId)) continue;

      startSection(sec.title);

      /* ── Key-value pairs (Configuration, Pricing) ── */
      if (sec.items) {
        for (const [k, v] of sec.items) {
          guardOverflow(26);
          const labelW = 160;
          doc.fontSize(F.body).fillColor(C.accent)
             .text(cl(k) + ':', MARGIN, doc.y, { continued: true, width: labelW });
          doc.fillColor(C.text)
             .text('  ' + cl(v), { width: PW - labelW });
          doc.moveDown(0.55);
        }
      }

      /* ── Assessment responses table ── */
      if (sec.table) {
        const cW = [130, 85, PW - 225];

        /* Table header */
        guardOverflow(30);
        const hY = doc.y + 4;
        doc.rect(MARGIN, hY, PW, 26).fill(C.hdrBg);
        doc.fontSize(F.table).fillColor(C.accent)
           .text('Control ID', MARGIN + 8, hY + 7, { width: cW[0], lineBreak: false })
           .text('Status',     MARGIN + 8 + cW[0], hY + 7, { width: cW[1], lineBreak: false })
           .text('Notes',      MARGIN + 8 + cW[0] + cW[1], hY + 7, { width: cW[2], lineBreak: false });
        doc.y = hY + 28;

        sec.table.rows.slice(0, 300).forEach((r, idx) => {
          guardOverflow(20);
          const ry = doc.y;
          if (idx % 2 === 0) doc.rect(MARGIN, ry, PW, 19).fill(C.rowAlt);
          const sc = { pass: C.pass, fail: C.fail, partial: C.partial, na: C.na }[r[1]] || C.muted;

          doc.fontSize(F.table).fillColor(C.muted)
             .text(String(r[0]).slice(0, 24), MARGIN + 8, ry + 5, { width: cW[0], lineBreak: false });
          doc.fillColor(sc)
             .text(String(r[1] || '—').toUpperCase(), MARGIN + 8 + cW[0], ry + 5, { width: cW[1], lineBreak: false });
          doc.fillColor(C.text)
             .text(String(r[2] || '—').slice(0, 90), MARGIN + 8 + cW[0] + cW[1], ry + 5, { width: cW[2], lineBreak: false });
          doc.y = ry + 20;
        });

        if (sec.table.rows.length > 300) {
          guardOverflow(20);
          doc.fontSize(F.small).fillColor(C.muted)
             .text(`… and ${sec.table.rows.length - 300} more controls not shown`);
        }
      }

      /* ── Flow lists (CI/CD, GitFlow, Deploy, Versioning, Artifacts) ── */
      if (sec.flows?.length) {
        for (const f of sec.flows) {
          guardOverflow(24);
          const parts = [
            f.cat   && `[${cl(f.cat)}]`,
            f.nodes != null && `${f.nodes} stages`,
            f.repos != null && `${f.repos} repos`,
            f.desc  && cl(f.desc).slice(0, 70),
          ].filter(Boolean).join('  ·  ');

          doc.fontSize(F.body).fillColor(C.text)
             .text(`•  ${cl(f.name)}`, MARGIN + 12, doc.y, { continued: !!parts, width: PW - 12 });
          if (parts) doc.fillColor(C.muted).text(`    ${parts}`, { width: PW - 12 });
          doc.moveDown(0.45);
        }
      }

      if (!sec.items && !sec.table && !sec.flows?.length && sec.count === 0) {
        doc.fontSize(F.body).fillColor(C.muted).text('(none configured)');
      }

      /* ── Pricing phases ── */
      if (sec.phases?.length) {
        doc.moveDown(0.4);
        doc.fontSize(F.subhead).fillColor(C.accent).text('Project Phases');
        doc.moveDown(0.3);
        for (const p of sec.phases) {
          guardOverflow(22);
          doc.fontSize(F.body).fillColor(C.text)
             .text(`•  ${cl(p.name)}:  ${p.percentage}%  —  ${p.months} months`, { indent: 14 });
          doc.moveDown(0.35);
        }
      }

      /* ── Workflow diagram images (same page as section — break-inside: avoid) ── */
      const imgKey = diagramSectionKey[sec.title];
      if (imgKey) {
        embedSectionImages(imgKey);
      }
    }

    /* ═══════════════════════════════════════════════════════════════
     * END PAGE
     * ═══════════════════════════════════════════════════════════════ */
    doc.addPage();
    doc.rect(0, 0, 595, 842).fill('#0d0b1e');
    doc.fontSize(F.heading).fillColor('#ffffff')
       .text('End of Report', MARGIN, 340, { align: 'center', width: PW });
    doc.fontSize(F.body).fillColor(C.light)
       .text(cl(rpt.meta.org), MARGIN, 382, { align: 'center', width: PW });
    doc.fontSize(F.small).fillColor('#5a5775')
       .text(`SecAssess v21  ·  ${new Date().toLocaleDateString()}`, MARGIN, 412, { align: 'center', width: PW });

    doc.end();
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

/* ═══ Export: SQL ═══ */
app.get('/api/export/sql/:id', async (req, res) => {
  try { const { rows } = await pool.query('SELECT * FROM assessments WHERE id = $1', [san(req.params.id,100)]); if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const row = rows[0]; const cols = Object.keys(row).filter(k=>k!=='id');
    const vals = cols.map(c => { const v=row[c]; if(v===null)return 'NULL'; if(typeof v==='object')return `'${JSON.stringify(v).replace(/'/g,"''")}'`; return `'${String(v).replace(/'/g,"''")}'`; });
    const sql = `-- SecAssess v21 SQL Export\n-- Generated: ${new Date().toISOString()}\n-- Organization: ${row.org_name}\nINSERT INTO assessments (id, ${cols.join(', ')})\nVALUES ('${genId()}', ${vals.join(', ')});\n`;
    res.setHeader('Content-Type', 'application/sql'); res.setHeader('Content-Disposition', `attachment; filename="${san(row.org_name||'assessment',50)}.sql"`); res.send(sql);
  } catch (e) { res.status(500).json({ error: e.message }); } });

/* ═══ Export: XML ═══ */
app.get('/api/export/xml/:id', async (req, res) => {
  try { const { rows } = await pool.query('SELECT * FROM assessments WHERE id = $1', [san(req.params.id,100)]); if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const row = parseRow(rows[0]); const esc=(s)=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<assessment version="16">\n  <org_name>${esc(row.org_name)}</org_name>\n  <assessor>${esc(row.assessor_name)}</assessor>\n  <date>${esc(row.assessment_date)}</date>\n  <environment>${esc(row.environment)}</environment>\n  <score>${row.score}</score>\n  <status>${esc(row.status)}</status>\n`;
    JSONB_FIELDS.forEach(f => { xml += `  <${f}><![CDATA[${JSON.stringify(row[f]||{})}]]></${f}>\n`; });
    xml += `</assessment>\n`;
    res.setHeader('Content-Type','application/xml'); res.setHeader('Content-Disposition',`attachment; filename="${san(row.org_name||'assessment',50)}.xml"`); res.send(xml);
  } catch (e) { res.status(500).json({ error: e.message }); } });

/* ═══ Export: ZIP — POST with images, HTML report, workflow PNGs ═══ */
app.post('/api/export/zip/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM assessments WHERE id = $1', [san(req.params.id,100)]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const row = parseRow(rows[0]); const name = san(row.org_name||'assessment',50);
    const images = req.body.images || [];
    const exportSections = req.body.exportSections || null;
    res.setHeader('Content-Type','application/zip');
    res.setHeader('Content-Disposition',`attachment; filename="${name}.zip"`);
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);
    // JSON
    archive.append(JSON.stringify(row, null, 2), { name: `${name}.json` });
    // SQL
    const cols = Object.keys(rows[0]).filter(k=>k!=='id');
    const vals = cols.map(c => { const v=rows[0][c]; if(v===null)return 'NULL'; if(typeof v==='object')return `'${JSON.stringify(v).replace(/'/g,"''")}' `; return `'${String(v).replace(/'/g,"''")}' `; });
    archive.append(`-- SecAssess v21\nINSERT INTO assessments (id, ${cols.join(', ')})\nVALUES ('${genId()}', ${vals.join(', ')});\n`, { name: `${name}.sql` });
    // XML
    const esc=(s)=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<assessment version="21">\n  <org_name>${esc(row.org_name)}</org_name>\n  <assessor>${esc(row.assessor_name)}</assessor>\n  <date>${esc(row.assessment_date)}</date>\n  <environment>${esc(row.environment)}</environment>\n  <score>${row.score}</score>\n  <status>${esc(row.status)}</status>\n`;
    JSONB_FIELDS.forEach(f => { xml += `  <${f}><![CDATA[${JSON.stringify(row[f]||{})}]]></${f}>\n`; });
    xml += `</assessment>\n`;
    archive.append(xml, { name: `${name}.xml` });
    // HTML Report with embedded images
    const resp = row.responses || {};
    const pr = row.pricing || {};
    const respRows = Object.entries(resp).map(([id,r])=>`<tr><td>${esc(id)}</td><td class="b b${r.status||'u'}">${r.status||'—'}</td><td>${esc(r.notes||'—')}</td></tr>`).join('');
    const cicdRows = (row.cicd_diagrams?.workflows||[]).flatMap(w=>(w.pipelines||[]).map(p=>`<tr><td>${esc(w.name)}</td><td>${esc(p.name)}</td><td>${(p.nodes||[]).length}</td></tr>`)).join('');
    const gitRows = (row.gitflow_diagrams?.flows||[]).map(f=>`<tr><td>${esc(f.name)}</td><td>${(f.nodes||[]).length}</td><td>${esc(f.description||'—')}</td></tr>`).join('');
    const deployRows = (row.deployment_strategies?.strategies||[]).map(s=>`<tr><td>${esc(s.name)}</td><td>${esc(s.cat||'—')}</td><td>${(s.nodes||[]).length}</td></tr>`).join('');
    const verRows = (row.versioning_diagrams?.flows||[]).map(f=>`<tr><td>${esc(f.name)}</td><td>${(f.nodes||[]).length}</td></tr>`).join('');
    const artifactRows = (row.artifact_repos?.registries||[]).flatMap(r=>(r.repos||[]).map(rp=>`<tr><td>${esc(r.name)}</td><td>${esc(r.registryType||'—')}</td><td>${esc(rp.name)}</td></tr>`)).join('');
    const imgBlocks = images.map(img => `<div class="img-block"><div class="img-title">${esc(img.name)}</div><img src="data:image/png;base64,${img.data}" style="max-width:100%;height:auto;display:block;border-radius:8px;border:1px solid rgba(108,92,231,.2)" /></div>`).join('');
    const pricingHtml = pr.engineers ? `<h2>💰 Pricing</h2><div class="meta"><div class="mi"><div class="ml">Engineers</div><div class="mv">${pr.engineers}</div></div><div class="mi"><div class="ml">Duration</div><div class="mv">${pr.duration} months</div></div><div class="mi"><div class="ml">Hourly Rate</div><div class="mv">${pr.currency||'ILS'} ${pr.hourlyRate}</div></div><div class="mi"><div class="ml">Total</div><div class="mv">${pr.currency||'ILS'} ${((pr.hourlyRate||0)*160*(pr.engineers||0)*(pr.duration||0)*(1+((pr.contingency||0)/100))).toLocaleString()}</div></div></div>` : '';
    const allSectionMap = {
      config: `<h2>⚙️ Configuration</h2><div class="meta"><div class="mi"><div class="ml">Organization</div><div class="mv">${esc(row.org_name)}</div></div><div class="mi"><div class="ml">Assessor</div><div class="mv">${esc(row.assessor_name)}</div></div><div class="mi"><div class="ml">Date</div><div class="mv">${esc(row.assessment_date)}</div></div><div class="mi"><div class="ml">Environment</div><div class="mv">${esc(row.environment)}</div></div><div class="mi"><div class="ml">Score</div><div class="mv">${row.score}%</div></div></div>`,
      assessment: respRows ? `<h2>🔍 Assessment Results</h2><table><thead><tr><th>Control ID</th><th>Status</th><th>Notes</th></tr></thead><tbody>${respRows}</tbody></table>` : '',
      cicd: cicdRows ? `<h2>🔄 CI/CD Workflows</h2><table><thead><tr><th>Workflow</th><th>Pipeline</th><th>Stages</th></tr></thead><tbody>${cicdRows}</tbody></table>` : '',
      gitflow: gitRows ? `<h2>🌿 Git Flow</h2><table><thead><tr><th>Flow</th><th>Nodes</th><th>Description</th></tr></thead><tbody>${gitRows}</tbody></table>` : '',
      deploy: deployRows ? `<h2>🚀 Deployment Strategies</h2><table><thead><tr><th>Strategy</th><th>Category</th><th>Stages</th></tr></thead><tbody>${deployRows}</tbody></table>` : '',
      versioning: verRows ? `<h2>🏷️ Versioning</h2><table><thead><tr><th>Scheme</th><th>Nodes</th></tr></thead><tbody>${verRows}</tbody></table>` : '',
      artifacts: artifactRows ? `<h2>📦 Artifact Registries</h2><table><thead><tr><th>Registry</th><th>Type</th><th>Repo</th></tr></thead><tbody>${artifactRows}</tbody></table>` : '',
      pricing: pricingHtml,
    };
    const sectionsToInclude = exportSections || Object.keys(allSectionMap);
    const sectionsHtml = sectionsToInclude.map(s => allSectionMap[s] || '').join('');
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>SecAssess Report — ${esc(row.org_name)}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;background:#0a0a14;color:#e0dff0;line-height:1.6;padding:40px}.c{max-width:960px;margin:0 auto}h1{font-size:28px;margin-bottom:8px;color:#a29bfe}h2{font-size:18px;margin:28px 0 12px;color:#a29bfe;border-bottom:1px solid rgba(108,92,231,.2);padding-bottom:8px}.meta{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin:16px 0 24px}.mi{background:#12122a;padding:14px;border-radius:8px;border:1px solid rgba(108,92,231,.15)}.ml{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#6b6890}.mv{font-size:15px;margin-top:4px}table{width:100%;border-collapse:collapse;margin:12px 0 24px}th{background:#16163a;padding:10px 12px;text-align:left;font-size:12px;text-transform:uppercase;color:#8b88a2;border-bottom:2px solid rgba(108,92,231,.2)}td{padding:10px 12px;border-bottom:1px solid rgba(108,92,231,.08);font-size:13px;vertical-align:top}.b{display:inline-block;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:600;text-transform:uppercase}.bpass{background:rgba(0,206,201,.15);color:#00cec9}.bfail{background:rgba(255,59,92,.15);color:#ff3b5c}.bpartial{background:rgba(255,209,102,.15);color:#ffd166}.bna,.bu{background:rgba(90,87,117,.15);color:#5a5775}.img-block{margin:16px 0}.img-title{font-size:11px;color:#6b6890;margin-bottom:6px;font-family:monospace}.ft{margin-top:40px;text-align:center;color:#5a5775;font-size:12px;border-top:1px solid rgba(108,92,231,.1);padding-top:16px}</style></head><body><div class="c"><h1>🛡️ SecAssess Report</h1><p style="color:#6b6890;font-size:13px">Generated: ${new Date().toLocaleDateString()}</p>${sectionsHtml}${imgBlocks?`<h2>📊 Workflow Diagrams</h2>${imgBlocks}`:''}<div class="ft">SecAssess v21 — ${esc(row.org_name)}</div></div></body></html>`;
    archive.append(html, { name: `${name}-report.html` });
    // Individual workflow images as PNG files
    for (const img of images) {
      try {
        const buf = Buffer.from(img.data, 'base64');
        const safeName = (img.name || 'diagram').replace(/[^a-zA-Z0-9_\- ]/g, '_').trim();
        archive.append(buf, { name: `diagrams/${safeName}.png` });
      } catch {}
    }
    await archive.finalize();
  } catch (e) { if (!res.headersSent) res.status(500).json({ error: e.message }); }
});

/* ═══ Export: Excel v21 — images precisely anchored in category tabs + consolidated Diagrams tab ═══ */
app.post('/api/export/excel/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM assessments WHERE id = $1', [san(req.params.id,100)]);
    if (!rows.length) return res.status(404).json({ error:'Not found' });
    const row = parseRow(rows[0]);
    const wb  = new ExcelJS.Workbook();
    wb.creator  = 'SecAssess v21';
    wb.created  = new Date();
    wb.modified = new Date();

    /* images: [{name, data, width, height, section, tabKey}]
       Captured at 3× scale — width/height are the ORIGINAL SVG dimensions.
       The actual PNG buffer is 3× those dimensions. */
    const images         = req.body.images         || [];
    const exportSections = req.body.exportSections || null;
    const secIncludes    = (sec) => !exportSections || exportSections.includes(sec);

    /* ── Excel geometry constants ─────────────────────────────────────────
     * ExcelJS column width unit ≈ 7.5px (at 96 dpi screen).
     * Row height is in "points" (1 pt ≈ 1.333px on screen).
     * We work in display pixels throughout and convert at embedding time.
     * ──────────────────────────────────────────────────────────────────── */
    const COL_W_UNITS = 12;         /* column width for image columns        */
    const COL_PX      = COL_W_UNITS * 7.5;   /* ≈ 90 px per column          */
    const ROW_PT      = 15;         /* default row height in points          */
    const ROW_PX      = ROW_PT * (4/3);      /* points → px (at 96dpi)      */
    const IMG_COLS    = 10;         /* number of columns used for images     */
    const MAX_IMG_W   = IMG_COLS * COL_PX;   /* max display width of image  */
    const MAX_IMG_H   = 360;        /* max display height of image           */
    const SHEET_W_PX  = IMG_COLS * COL_PX;

    /* ── Shared styles ── */
    const PURPLE = { argb: 'FF4A3FBF' };
    const LIGHT  = { argb: 'FFA29BFE' };
    const MUTED  = { argb: 'FF6B6890' };
    const WHITE  = { argb: 'FFFFFFFF' };
    const DARK   = { argb: 'FF1E1A3A' };

    const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECE9FF' } };
    const altFill    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F8FF' } };
    const titleFill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D0B1E' } };

    /* ── Helper: style worksheet header row ── */
    function styleHeaderRow(ws, numCols) {
      const hRow = ws.getRow(1);
      hRow.height = 22;
      hRow.eachCell({ includeEmpty: true }, (cell, cn) => {
        if (cn > numCols) return;
        cell.fill = headerFill;
        cell.font = { bold: true, color: PURPLE, size: 11 };
        cell.alignment = { vertical: 'middle' };
        cell.border = { bottom: { style: 'thin', color: PURPLE } };
      });
    }

    /* ── Helper: add a section title banner row to a worksheet ── */
    function addSectionBanner(ws, title, curRow) {
      const row = ws.getRow(curRow);
      row.height = 24;
      const cell = row.getCell(1);
      cell.value = title;
      cell.font  = { bold: true, size: 13, color: PURPLE };
      cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDE9FF' } };
      cell.alignment = { vertical: 'middle' };
      ws.mergeCells(curRow, 1, curRow, IMG_COLS);
      return curRow + 1;
    }

    /* ── Helper: precisely anchor one image in a worksheet ─────────────────
     * Uses ExcelJS tl/br anchor mode for exact cell-level placement.
     * Images from the client are at 3× scale; we embed at display size.
     *
     * @param ws         ExcelJS worksheet
     * @param imgBuf     PNG buffer
     * @param origW      original SVG width  (1× pixels)
     * @param origH      original SVG height (1× pixels)
     * @param startRow   1-based row index where image top-left sits
     * @param centerInSheet  center horizontally across IMG_COLS columns
     * @returns nextRow  first free row after the image block
     * ──────────────────────────────────────────────────────────────────── */
    function anchorImage(ws, imgBuf, origW, origH, startRow, centerInSheet = true) {
      /* Scale image to fit max dimensions while preserving aspect ratio */
      const scale = Math.min(MAX_IMG_W / origW, MAX_IMG_H / origH, 1);
      const dw    = Math.round(origW * scale);   /* display width  (px) */
      const dh    = Math.round(origH * scale);   /* display height (px) */

      /* Number of rows/cols the image spans */
      const rowsNeeded = Math.ceil(dh / ROW_PX);

      /* Set row heights for the image rows */
      for (let r = startRow; r < startRow + rowsNeeded; r++) {
        ws.getRow(r).height = dh / rowsNeeded * (3/4); /* px → pt */
      }

      /* Horizontal centering: offset in fractional columns */
      let colOffset = 0;
      if (centerInSheet) {
        const freeSpace = SHEET_W_PX - dw;
        colOffset = Math.max(0, freeSpace / 2) / COL_PX; /* fractional columns */
      }

      /* Register image buffer and anchor with tl/br */
      const imgId = wb.addImage({ buffer: imgBuf, extension: 'png' });
      ws.addImage(imgId, {
        tl: { col: colOffset,            row: startRow - 1 },
        br: { col: colOffset + dw / COL_PX, row: startRow - 1 + rowsNeeded },
        editAs: 'oneCell',
      });

      return startRow + rowsNeeded + 2; /* +2 blank rows after image */
    }

    /* ── Helper: embed a list of images into a worksheet ─────────────────
     * Each image gets a label row above it, then the image, then 2 gap rows.
     * @returns nextRow after all images
     * ──────────────────────────────────────────────────────────────────── */
    function embedImages(ws, sheetImages, startRow) {
      let cur = startRow;
      for (const img of sheetImages) {
        try {
          const buf = Buffer.from(img.data, 'base64');

          /* Label row */
          const labelRow  = ws.getRow(cur);
          labelRow.height = 18;
          const labelCell = labelRow.getCell(1);
          labelCell.value = img.name || 'Diagram';
          labelCell.font  = { bold: true, size: 11, color: PURPLE };
          ws.mergeCells(cur, 1, cur, IMG_COLS);
          cur++;

          cur = anchorImage(ws, buf, img.width || 600, img.height || 300, cur, true);
        } catch {
          ws.getRow(cur).getCell(1).value = `[Image unavailable: ${img.name}]`;
          cur += 2;
        }
      }
      return cur;
    }

    /* ── Helper: set all image-bearing columns to COL_W_UNITS ── */
    function setImageColWidths(ws) {
      for (let c = 1; c <= IMG_COLS; c++) {
        ws.getColumn(c).width = COL_W_UNITS;
      }
    }

    /* ═══════════════════════════════════════════════════════════════
     * SHEET 1: Summary
     * ═══════════════════════════════════════════════════════════════ */
    const ss = wb.addWorksheet('Summary');
    ss.columns = [
      { header: 'Field', key: 'f', width: 28 },
      { header: 'Value', key: 'v', width: 55 },
    ];
    [
      ['Organization',  row.org_name],
      ['Assessor',      row.assessor_name],
      ['Date',          row.assessment_date],
      ['Environment',   row.environment],
      ['Score',         row.score + '%'],
      ['Status',        row.status],
    ].forEach(([f, v]) => ss.addRow({ f, v }));
    styleHeaderRow(ss, 2);

    /* ═══════════════════════════════════════════════════════════════
     * SHEET 2: Assessment Results
     * ═══════════════════════════════════════════════════════════════ */
    if (secIncludes('assessment')) {
      const as = wb.addWorksheet('Assessment');
      as.columns = [
        { header: 'Control ID', key: 'id',     width: 18 },
        { header: 'Status',     key: 'status',  width: 14 },
        { header: 'Notes',      key: 'notes',   width: 60 },
      ];
      styleHeaderRow(as, 3);
      Object.entries(row.responses || {}).forEach(([id, r], idx) => {
        const dataRow = as.addRow({ id, status: r.status || '', notes: r.notes || '' });
        if (idx % 2 === 0) {
          dataRow.eachCell({ includeEmpty: true }, cell => { cell.fill = altFill; });
        }
        /* Colour-code status cell */
        const statusCell = dataRow.getCell('status');
        const color = { pass:'FF00B894', fail:'FFE63757', partial:'FFF59E0B', na:'FF9CA3AF' }[r.status] || 'FF8B88A2';
        statusCell.font = { bold: true, color: { argb: color } };
      });
    }

    /* ═══════════════════════════════════════════════════════════════
     * SHEET 3: Pricing
     * ═══════════════════════════════════════════════════════════════ */
    const pr = row.pricing || {};
    if (pr.engineers) {
      const ps = wb.addWorksheet('Pricing');
      ps.columns = [
        { header: 'Field', key: 'f', width: 32 },
        { header: 'Value', key: 'v', width: 28 },
      ];
      styleHeaderRow(ps, 2);
      const rate  = (pr.hourlyRate || 0) * 160;
      const base  = rate * pr.engineers * pr.duration;
      const total = base + base * ((pr.contingency || 0) / 100);
      [
        ['Engineers',       pr.engineers],
        ['Duration',        pr.duration + ' months'],
        ['Hourly Rate',     pr.hourlyRate],
        ['Currency',        pr.currency || 'ILS'],
        ['Estimation Mode', pr.estimationMode || 'price'],
        ['Total Cost',      total.toLocaleString()],
      ].forEach(([f, v]) => ps.addRow({ f, v }));
      if (pr.phases) {
        ps.addRow({});
        ps.addRow({ f: 'Phase', v: 'Allocation' });
        pr.phases.forEach(p => ps.addRow({ f: p.name, v: p.percentage + '%' }));
      }
    }

    /* ═══════════════════════════════════════════════════════════════
     * SHEET 4: CI-CD  (data rows + embedded CI/CD diagrams)
     * ═══════════════════════════════════════════════════════════════ */
    const cicd = row.cicd_diagrams || {};
    if (cicd.workflows?.length) {
      const ws = wb.addWorksheet('CI-CD');
      setImageColWidths(ws);
      ws.columns = [
        { header: 'Workflow', key: 'wf', width: COL_W_UNITS * 2 },
        { header: 'Pipeline', key: 'pl', width: COL_W_UNITS * 2.5 },
        { header: 'Stages',   key: 's',  width: COL_W_UNITS },
        { header: 'Desc',     key: 'd',  width: COL_W_UNITS * 4 },
      ];
      styleHeaderRow(ws, 4);
      cicd.workflows.forEach(wf =>
        (wf.pipelines || []).forEach(p =>
          ws.addRow({ wf: wf.name, pl: p.name, s: (p.nodes || []).length, d: p.description || '' })
        )
      );
      /* Embed CI/CD diagram images below the data table */
      const cicdImgs = images.filter(img => img.section === 'cicd');
      if (cicdImgs.length) {
        const dataRows = cicd.workflows.reduce((t, wf) => t + (wf.pipelines || []).length, 0);
        let cur = dataRows + 3;
        cur = addSectionBanner(ws, 'CI/CD Workflow Diagrams', cur) + 1;
        embedImages(ws, cicdImgs, cur);
      }
    }

    /* ═══════════════════════════════════════════════════════════════
     * SHEET 5: GitFlow  (data + diagrams)
     * ═══════════════════════════════════════════════════════════════ */
    const gf = row.gitflow_diagrams || {};
    if (gf.flows?.length) {
      const gs = wb.addWorksheet('GitFlow');
      setImageColWidths(gs);
      gs.columns = [
        { header: 'Flow',  key: 'n', width: COL_W_UNITS * 3 },
        { header: 'Nodes', key: 'c', width: COL_W_UNITS },
        { header: 'Desc',  key: 'd', width: COL_W_UNITS * 6 },
      ];
      styleHeaderRow(gs, 3);
      gf.flows.forEach(f => gs.addRow({ n: f.name, c: (f.nodes || []).length, d: f.description || '' }));
      const gitImgs = images.filter(img => img.section === 'gitflow');
      if (gitImgs.length) {
        let cur = gf.flows.length + 3;
        cur = addSectionBanner(gs, 'Git Flow Diagrams', cur) + 1;
        embedImages(gs, gitImgs, cur);
      }
    }

    /* ═══════════════════════════════════════════════════════════════
     * SHEET 6: Deploy  (data + diagrams)
     * ═══════════════════════════════════════════════════════════════ */
    const ds = row.deployment_strategies || {};
    if (ds.strategies?.length) {
      const dss = wb.addWorksheet('Deploy');
      setImageColWidths(dss);
      dss.columns = [
        { header: 'Strategy', key: 'n', width: COL_W_UNITS * 3 },
        { header: 'Category', key: 'c', width: COL_W_UNITS * 1.5 },
        { header: 'Stages',   key: 's', width: COL_W_UNITS },
        { header: 'Desc',     key: 'd', width: COL_W_UNITS * 4 },
      ];
      styleHeaderRow(dss, 4);
      ds.strategies.forEach(s =>
        dss.addRow({ n: s.name, c: s.cat || '', s: (s.nodes || []).length, d: s.description || '' })
      );
      const depImgs = images.filter(img => img.section === 'deploy');
      if (depImgs.length) {
        let cur = ds.strategies.length + 3;
        cur = addSectionBanner(dss, 'Deployment Strategy Diagrams', cur) + 1;
        embedImages(dss, depImgs, cur);
      }
    }

    /* ═══════════════════════════════════════════════════════════════
     * SHEET 7: Versioning  (data + diagrams)
     * ═══════════════════════════════════════════════════════════════ */
    const vd = row.versioning_diagrams || {};
    if (vd.flows?.length) {
      const vs = wb.addWorksheet('Versioning');
      setImageColWidths(vs);
      vs.columns = [
        { header: 'Scheme', key: 'n', width: COL_W_UNITS * 3 },
        { header: 'Nodes',  key: 'c', width: COL_W_UNITS },
        { header: 'Desc',   key: 'd', width: COL_W_UNITS * 6 },
      ];
      styleHeaderRow(vs, 3);
      vd.flows.forEach(f => vs.addRow({ n: f.name, c: (f.nodes || []).length, d: f.description || '' }));
      const verImgs = images.filter(img => img.section === 'versioning');
      if (verImgs.length) {
        let cur = vd.flows.length + 3;
        cur = addSectionBanner(vs, 'Versioning Diagrams', cur) + 1;
        embedImages(vs, verImgs, cur);
      }
    }

    /* ═══════════════════════════════════════════════════════════════
     * SHEET 8: Artifacts
     * ═══════════════════════════════════════════════════════════════ */
    const ar = row.artifact_repos || {};
    if (ar.registries?.length) {
      const ars = wb.addWorksheet('Artifacts');
      ars.columns = [
        { header: 'Registry', key: 'r', width: 26 },
        { header: 'Type',     key: 't', width: 16 },
        { header: 'Repo',     key: 'n', width: 26 },
        { header: 'Class',    key: 'c', width: 14 },
        { header: 'Pkg',      key: 'p', width: 14 },
      ];
      styleHeaderRow(ars, 5);
      ar.registries.forEach(r =>
        (r.repos || []).forEach(rp =>
          ars.addRow({ r: r.name, t: r.registryType, n: rp.name, c: rp.repoClass, p: rp.pkgType })
        )
      );
    }

    /* ═══════════════════════════════════════════════════════════════
     * SHEET 9: Diagrams — ALL images consolidated in one place
     * ═══════════════════════════════════════════════════════════════ */
    if (images.length > 0) {
      const imgSheet = wb.addWorksheet('Diagrams');
      setImageColWidths(imgSheet);

      /* Title banner */
      const titleCell = imgSheet.getRow(1).getCell(1);
      titleCell.value = 'All Workflow Diagrams';
      titleCell.font  = { bold: true, size: 16, color: PURPLE };
      titleCell.fill  = titleFill;
      titleCell.alignment = { vertical: 'middle' };
      imgSheet.getRow(1).height = 28;
      imgSheet.mergeCells(1, 1, 1, IMG_COLS);

      /* Group by section with banners */
      const sections = ['cicd', 'gitflow', 'deploy', 'versioning'];
      const secLabels = { cicd:'CI/CD Workflows', gitflow:'Git Flow', deploy:'Deployment Strategies', versioning:'Versioning' };
      let cur = 3;

      for (const sec of sections) {
        const secImgs = images.filter(img => img.section === sec);
        if (!secImgs.length) continue;
        cur = addSectionBanner(imgSheet, secLabels[sec], cur) + 1;
        cur = embedImages(imgSheet, secImgs, cur);
        cur += 1; /* extra gap between sections */
      }
    }

    /* ── Emit workbook ── */
    res.setHeader('Content-Type',        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${san(row.org_name || 'assessment', 50)}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});


/* ── Init DB ── */
async function initDB() {
  for (let i=1;i<=15;i++){try{console.log(`DB connect (${i}/15)...`);await pool.query('SELECT 1');console.log('Connected');break;}catch(e){if(i===15)throw e;console.log('Waiting...');await new Promise(r=>setTimeout(r,2000));}}
  await pool.query(`CREATE TABLE IF NOT EXISTS assessments (id TEXT PRIMARY KEY, org_name TEXT NOT NULL DEFAULT '', assessor_name TEXT DEFAULT '', assessment_date TEXT DEFAULT '', environment TEXT DEFAULT 'production', scope TEXT DEFAULT '', template TEXT DEFAULT 'full', responses JSONB DEFAULT '{}', pricing JSONB DEFAULT '{}', gantt JSONB DEFAULT '{}', workplan JSONB DEFAULT '{}', custom_templates JSONB DEFAULT '[]', cicd_diagrams JSONB DEFAULT '{}', gitflow_diagrams JSONB DEFAULT '{}', artifact_repos JSONB DEFAULT '{}', deployment_strategies JSONB DEFAULT '{}', versioning_diagrams JSONB DEFAULT '{}', score INTEGER DEFAULT 0, status TEXT DEFAULT 'draft', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`);
  for (const m of ["ALTER TABLE assessments ADD COLUMN IF NOT EXISTS cicd_diagrams JSONB DEFAULT '{}'","ALTER TABLE assessments ADD COLUMN IF NOT EXISTS gitflow_diagrams JSONB DEFAULT '{}'","ALTER TABLE assessments ADD COLUMN IF NOT EXISTS artifact_repos JSONB DEFAULT '{}'","ALTER TABLE assessments ADD COLUMN IF NOT EXISTS deployment_strategies JSONB DEFAULT '{}'","ALTER TABLE assessments ADD COLUMN IF NOT EXISTS versioning_diagrams JSONB DEFAULT '{}'"]) { try{await pool.query(m);}catch{} }
  console.log('DB ready'); dbReady = true;
}
async function start(){await initDB();app.listen(PORT,'0.0.0.0',()=>console.log(`SecAssess v21 API on port ${PORT}`));}
start().catch(e=>{console.error('FAIL:',e);process.exit(1);});
