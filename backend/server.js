const express = require('express');
const cors = require('cors');
const crypto = require('node:crypto');
const { Pool } = require('pg');
const multer = require('multer');
const ExcelJS = require('exceljs');

const app = express();
const PORT = process.env.PORT || 4000;
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ── Health (responds before DB) ──
let dbReady = false;
app.get('/health', (req, res) => res.json({ ok: true, db: dbReady }));
app.get('/api/health', (req, res) => res.json({ ok: true, db: dbReady }));

// ── PostgreSQL ──
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'secassess',
  user: process.env.DB_USER || 'secassess',
  password: process.env.DB_PASS || 'secassess',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

function genId() { return crypto.randomUUID(); }

function parseRow(row) {
  if (!row) return null;
  ['responses', 'pricing', 'gantt', 'workplan', 'custom_templates'].forEach(k => {
    if (typeof row[k] === 'string') {
      try { row[k] = JSON.parse(row[k]); } catch { row[k] = k === 'custom_templates' ? [] : {}; }
    }
  });
  return row;
}

// ── CRUD ──
app.get('/api/assessments', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, org_name, assessor_name, assessment_date, environment, template, score, status, created_at, updated_at FROM assessments ORDER BY updated_at DESC'
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/assessments/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM assessments WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(parseRow(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/assessments', async (req, res) => {
  try {
    const id = genId();
    const b = req.body;
    await pool.query(
      `INSERT INTO assessments (id, org_name, assessor_name, assessment_date, environment, scope, template, responses, pricing, gantt, workplan, custom_templates, score, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [id, b.org_name || '', b.assessor_name || '', b.assessment_date || '', b.environment || 'production',
       b.scope || '', b.template || 'full', JSON.stringify(b.responses || {}), JSON.stringify(b.pricing || {}),
       JSON.stringify(b.gantt || {}), JSON.stringify(b.workplan || {}), JSON.stringify(b.custom_templates || []),
       b.score || 0, b.status || 'draft']
    );
    res.json({ id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/assessments/:id', async (req, res) => {
  try {
    const b = req.body;
    const { rowCount } = await pool.query(
      `UPDATE assessments SET org_name=$1, assessor_name=$2, assessment_date=$3, environment=$4, scope=$5, template=$6,
       responses=$7, pricing=$8, gantt=$9, workplan=$10, custom_templates=$11, score=$12, status=$13, updated_at=NOW()
       WHERE id=$14`,
      [b.org_name || '', b.assessor_name || '', b.assessment_date || '', b.environment || 'production',
       b.scope || '', b.template || 'full', JSON.stringify(b.responses || {}), JSON.stringify(b.pricing || {}),
       JSON.stringify(b.gantt || {}), JSON.stringify(b.workplan || {}), JSON.stringify(b.custom_templates || []),
       b.score || 0, b.status || 'draft', req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/assessments/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM assessments WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Import ──
app.post('/api/import/json', upload.single('file'), async (req, res) => {
  try {
    let data;
    if (req.file) data = JSON.parse(req.file.buffer.toString('utf8'));
    else if (req.body.data) data = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body.data;
    else return res.status(400).json({ error: 'No data' });
    const items = Array.isArray(data) ? data : [data];
    const ids = [];
    for (const item of items) {
      const id = genId();
      const m = item.metadata || item;
      await pool.query(
        `INSERT INTO assessments (id, org_name, assessor_name, assessment_date, environment, scope, template, responses, pricing, gantt, workplan, custom_templates, score, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [id, m.org_name || m.organization || '', m.assessor_name || m.assessor || '', m.assessment_date || m.date || '',
         m.environment || 'production', m.scope || '', m.template || 'full',
         JSON.stringify(item.responses || m.responses || {}), JSON.stringify(item.pricing || m.pricing || {}),
         JSON.stringify(item.gantt || m.gantt || {}), JSON.stringify(item.workplan || m.workplan || {}),
         JSON.stringify(item.custom_templates || m.custom_templates || []),
         item.score || m.score || 0, 'imported']
      );
      ids.push(id);
    }
    res.json({ imported: ids.length, ids });
  } catch (e) { res.status(400).json({ error: 'Invalid: ' + e.message }); }
});

// ── Export Excel ──
app.get('/api/export/excel/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM assessments WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const row = parseRow(rows[0]);
    const responses = row.responses || {};
    const pricing = row.pricing || {};
    const wb = new ExcelJS.Workbook();
    wb.creator = 'SecAssess';
    const ss = wb.addWorksheet('Summary');
    ss.columns = [{ header: 'Field', key: 'field', width: 25 }, { header: 'Value', key: 'value', width: 50 }];
    ss.addRow({ field: 'Organization', value: row.org_name });
    ss.addRow({ field: 'Assessor', value: row.assessor_name });
    ss.addRow({ field: 'Date', value: row.assessment_date });
    ss.addRow({ field: 'Environment', value: row.environment });
    ss.addRow({ field: 'Score', value: row.score + '%' });
    ss.getRow(1).font = { bold: true };
    const as = wb.addWorksheet('Assessment');
    as.columns = [{ header: 'ID', key: 'id', width: 12 }, { header: 'Status', key: 'status', width: 12 }, { header: 'Notes', key: 'notes', width: 50 }];
    as.getRow(1).font = { bold: true };
    Object.entries(responses).forEach(([id, r]) => as.addRow({ id, status: r.status || '', notes: r.notes || '' }));
    if (pricing?.engineers) {
      const ps = wb.addWorksheet('Pricing');
      ps.columns = [{ header: 'Field', key: 'field', width: 30 }, { header: 'Value', key: 'value', width: 25 }];
      ps.getRow(1).font = { bold: true };
      ps.addRow({ field: 'Engineers', value: pricing.engineers });
      ps.addRow({ field: 'Duration', value: pricing.duration });
      ps.addRow({ field: 'Currency', value: pricing.currency || 'ILS' });
      ps.addRow({ field: 'Total', value: pricing.totalCost });
      if (pricing.phases) { ps.addRow({}); pricing.phases.forEach(p => ps.addRow({ field: p.name, value: p.percentage + '%' })); }
    }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=assessment.xlsx');
    await wb.xlsx.write(res);
    res.end();
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Init DB & Start ──
async function initDB() {
  const maxRetries = 15;
  for (let i = 1; i <= maxRetries; i++) {
    try {
      console.log(`Connecting to PostgreSQL (attempt ${i}/${maxRetries})...`);
      await pool.query('SELECT 1');
      console.log('PostgreSQL connected');
      break;
    } catch (e) {
      if (i === maxRetries) throw new Error('Could not connect to PostgreSQL: ' + e.message);
      console.log(`Waiting for PostgreSQL... (${e.message})`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS assessments (
      id TEXT PRIMARY KEY,
      org_name TEXT NOT NULL DEFAULT '',
      assessor_name TEXT DEFAULT '',
      assessment_date TEXT DEFAULT '',
      environment TEXT DEFAULT 'production',
      scope TEXT DEFAULT '',
      template TEXT DEFAULT 'full',
      responses JSONB DEFAULT '{}',
      pricing JSONB DEFAULT '{}',
      gantt JSONB DEFAULT '{}',
      workplan JSONB DEFAULT '{}',
      custom_templates JSONB DEFAULT '[]',
      score INTEGER DEFAULT 0,
      status TEXT DEFAULT 'draft',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('Table ready');
  dbReady = true;
}

async function start() {
  await initDB();
  app.listen(PORT, '0.0.0.0', () => console.log(`SecAssess API on port ${PORT}`));
}

start().catch(e => { console.error('STARTUP FAILED:', e); process.exit(1); });
