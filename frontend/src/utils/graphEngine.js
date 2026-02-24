/* ═══════════ SHARED GRAPH ENGINE ═══════════
   Used by CI/CD Diagrams, Git Flow, and Artifact Tree components.
   Provides: layout, rendering helpers, export/import, ID generation.
*/
export function mkId() { return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

/* Topological layout — longest-path column assignment + parallel grouping */
export function layoutGraph(nodes, edges) {
  if (!nodes.length) return { columns: [], positions: {} };
  const incoming = {}; const outgoing = {};
  nodes.forEach(n => { incoming[n.id] = []; outgoing[n.id] = []; });
  edges.forEach(e => {
    if (outgoing[e.from]) outgoing[e.from].push(e.to);
    if (incoming[e.to]) incoming[e.to].push(e.from);
  });
  const col = {}; const visited = {};
  function dfs(id) {
    if (visited[id]) return col[id]; visited[id] = true;
    const preds = incoming[id] || [];
    col[id] = preds.length === 0 ? 0 : Math.max(...preds.map(p => dfs(p))) + 1;
    return col[id];
  }
  nodes.forEach(n => dfs(n.id));
  const colMap = {};
  nodes.forEach(n => { const c = col[n.id] || 0; if (!colMap[c]) colMap[c] = []; colMap[c].push(n); });
  const maxCol = Math.max(...Object.keys(colMap).map(Number), 0);
  const columns = []; for (let i = 0; i <= maxCol; i++) columns.push(colMap[i] || []);
  const nodeSpaceX = 150; const nodeSpaceY = 110; const padL = 40; const padT = 60;
  const positions = {};
  const maxR = columns.reduce((m, c) => Math.max(m, c.length), 0);
  columns.forEach((colNodes, ci) => {
    const totalH = colNodes.length * nodeSpaceY;
    const startY = padT + (maxR * nodeSpaceY - totalH) / 2;
    colNodes.forEach((n, ri) => { positions[n.id] = { x: padL + ci * nodeSpaceX, y: startY + ri * nodeSpaceY, col: ci, row: ri }; });
  });
  return { columns, positions };
}

/* Export pipeline/flow as JSON file */
export function exportAsJSON(data, filename) {
  const blob = new Blob([JSON.stringify({ ...data, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = filename.replace(/[^a-zA-Z0-9_-]/g, '_') + '.json';
  a.click(); URL.revokeObjectURL(a.href);
}

/* Export SVG element to file */
export function exportSVGElement(svgEl, filename, w, h) {
  if (!svgEl) return;
  const clone = svgEl.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('width', '100%'); rect.setAttribute('height', '100%'); rect.setAttribute('fill', '#07070d');
  clone.insertBefore(rect, clone.firstChild);
  const svgStr = new XMLSerializer().serializeToString(clone)
    .replace(/var\(--text-primary\)/g, '#e8e6f0').replace(/var\(--text-muted\)/g, '#5a5775')
    .replace(/var\(--text-secondary\)/g, '#8b88a2').replace(/var\(--text-accent\)/g, '#a29bfe');
  const blob = new Blob([svgStr], { type: 'image/svg+xml' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = filename.replace(/[^a-zA-Z0-9_-]/g, '_') + '.svg';
  a.click(); URL.revokeObjectURL(a.href);
}

/* Export SVG as PNG */
export function exportSVGAsPNG(svgEl, filename, w, h) {
  if (!svgEl) return;
  const clone = svgEl.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('width', '100%'); rect.setAttribute('height', '100%'); rect.setAttribute('fill', '#07070d');
  clone.insertBefore(rect, clone.firstChild);
  const svgStr = new XMLSerializer().serializeToString(clone)
    .replace(/var\(--text-primary\)/g, '#e8e6f0').replace(/var\(--text-muted\)/g, '#5a5775')
    .replace(/var\(--text-secondary\)/g, '#8b88a2');
  const scale = 2;
  const canvas = document.createElement('canvas'); canvas.width = w * scale; canvas.height = h * scale;
  const ctx = canvas.getContext('2d'); const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = filename.replace(/[^a-zA-Z0-9_-]/g, '_') + '.png';
      a.click(); URL.revokeObjectURL(a.href);
    }, 'image/png');
  };
  img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr)));
}

/* Import JSON file and remap IDs */
export function importGraphJSON(file, callback, toast) {
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      callback(data);
    } catch (err) { toast && toast('Import failed: ' + err.message, 'error'); }
  };
  reader.readAsText(file);
}

/* Remap all node IDs in a pipeline to avoid collisions */
export function remapPipeline(p) {
  const idMap = {};
  const newNodes = (p.nodes || []).map(n => { const nid = mkId(); idMap[n.id] = nid; return { ...n, id: nid }; });
  const newEdges = (p.edges || []).map(e => ({ from: idMap[e.from] || e.from, to: idMap[e.to] || e.to }))
    .filter(e => newNodes.some(n => n.id === e.from) && newNodes.some(n => n.id === e.to));
  return { ...p, id: mkId(), nodes: newNodes, edges: newEdges };
}

/**
 * Capture all diagram SVGs currently rendered in the DOM as PNG base64 strings.
 * Looks for SVGs inside .pipeline-svg-wrap containers (used by all diagram tabs).
 * Returns: Promise<[{name: string, data: string}]> where data is base64 PNG (no prefix).
 */
export async function captureAllDiagramSVGs() {
  const wraps = document.querySelectorAll('.pipeline-svg-wrap svg.pipeline-svg');
  if (!wraps.length) return [];
  const results = [];
  for (const svgEl of wraps) {
    try {
      /* Find a label for this diagram from nearest card header */
      const card = svgEl.closest('.pipeline-card');
      const titleEl = card?.querySelector('.pipeline-title-input, .pipeline-header h4');
      const name = titleEl?.value || titleEl?.textContent || `diagram-${results.length + 1}`;

      const clone = svgEl.cloneNode(true);
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      /* Add dark background rect */
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('width', '100%'); rect.setAttribute('height', '100%'); rect.setAttribute('fill', '#0d0d1a');
      clone.insertBefore(rect, clone.firstChild);
      /* Resolve CSS vars to concrete colors */
      let svgStr = new XMLSerializer().serializeToString(clone)
        .replace(/var\(--text-primary\)/g, '#e8e6f0')
        .replace(/var\(--text-muted\)/g, '#5a5775')
        .replace(/var\(--text-secondary\)/g, '#8b88a2')
        .replace(/var\(--text-accent\)/g, '#a29bfe')
        .replace(/var\(--border-subtle\)/g, '#2a2a4a');
      const w = parseInt(svgEl.getAttribute('width')) || 600;
      const h = parseInt(svgEl.getAttribute('height')) || 300;
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = w * scale; canvas.height = h * scale;
      const ctx = canvas.getContext('2d');
      const dataUrl = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr)));
      });
      /* Strip "data:image/png;base64," prefix — backend expects raw base64 */
      results.push({ name, data: dataUrl.split(',')[1], width: w, height: h });
    } catch (e) { console.warn('Failed to capture SVG:', e); }
  }
  return results;
}
