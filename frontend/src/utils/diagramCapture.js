/**
 * diagramCapture.js — v21
 *
 * Captures diagram images for PDF/Excel export by cloning live SVG elements
 * from the DOM. Preserves the exact visual appearance — emoji icons, shapes,
 * colors — since the browser has already rendered them correctly.
 *
 * v21 improvements:
 *  - Scale raised to 3× for crisp icon rendering at print resolution
 *  - Comprehensive CSS variable resolution (all app tokens)
 *  - Dark background injection before serialization
 *  - section + tabKey metadata on every image for precise Excel cell anchoring
 *
 * tabKey → Excel worksheet name mapping:
 *   cicd       → 'CI-CD'
 *   gitflow    → 'GitFlow'
 *   deploy     → 'Deploy'
 *   versioning → 'Versioning'
 */

/* ── Section metadata ─────────────────────────────────────────────────── */
const SECTION_TAB = {
  cicd:       'CI-CD',
  gitflow:    'GitFlow',
  deploy:     'Deploy',
  promotion:  'Promotion',
  versioning: 'Versioning',
};

const SECTION_PREFIX = {
  cicd:       'CI/CD:',
  gitflow:    'Git Flow:',
  deploy:     'Deploy:',
  promotion:  'Promo:',
  versioning: 'Version:',
};

/* All CSS custom-property → hex resolutions for the app's dark theme */
const CSS_VAR_MAP = {
  'var(--text-primary)':    '#e8e6f0',
  'var(--text-secondary)':  '#8b88a2',
  'var(--text-muted)':      '#5a5775',
  'var(--text-accent)':     '#a29bfe',
  'var(--border-subtle)':   '#2a2a4a',
  'var(--border-default)':  '#1e1e3a',
  'var(--accent-primary)':  '#6c5ce7',
  'var(--accent-secondary)':'#a29bfe',
  'var(--bg-base)':         '#07070d',
  'var(--bg-card)':         '#10102a',
  'var(--bg-elevated)':     '#16163a',
  'var(--severity-critical)':'#ff3b5c',
  'var(--severity-high)':   '#ff8c42',
  'var(--severity-medium)': '#ffd166',
  'var(--severity-low)':    '#00cec9',
};

/**
 * Clone a live <svg> element, inject a dark background rect, and
 * resolve all CSS custom properties to concrete hex values.
 * Returns a serialized SVG string safe for canvas rendering.
 */
function cloneAndResolveSVG(svgEl) {
  const clone = svgEl.cloneNode(true);
  clone.setAttribute('xmlns',       'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  /* Prepend a solid dark background so the PNG has no transparency */
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width',  '100%');
  bg.setAttribute('height', '100%');
  bg.setAttribute('fill',   '#07070d');
  clone.insertBefore(bg, clone.firstChild);

  /* Serialize and resolve every CSS variable to a concrete value */
  let svgStr = new XMLSerializer().serializeToString(clone);
  for (const [cssVar, hex] of Object.entries(CSS_VAR_MAP)) {
    /* Escape parens for use in RegExp */
    const escaped = cssVar.replace(/[()]/g, '\\$&');
    svgStr = svgStr.replace(new RegExp(escaped, 'g'), hex);
  }

  return svgStr;
}

/**
 * Rasterize an SVG string to a PNG at 3× scale for crisp icon rendering.
 * useCORS / allowTaint equivalents: we use the data-URI route which is
 * fully same-origin, so no CORS issues arise.
 *
 * Returns raw base64 PNG string (no "data:..." prefix).
 */
function svgStringToPng(svgStr, w, h) {
  return new Promise((resolve) => {
    const SCALE  = 3;
    const cw = w * SCALE;
    const ch = h * SCALE;
    const r  = 14 * SCALE;           // 14 px corner radius at 1× → 42 px at 3×

    const canvas = document.createElement('canvas');
    canvas.width  = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');

    /* Rounded-rectangle clip — applied once, affects all subsequent draws */
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(cw - r, 0);
    ctx.quadraticCurveTo(cw, 0,  cw, r);
    ctx.lineTo(cw, ch - r);
    ctx.quadraticCurveTo(cw, ch, cw - r, ch);
    ctx.lineTo(r, ch);
    ctx.quadraticCurveTo(0, ch,  0, ch - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0,   r, 0);
    ctx.closePath();
    ctx.clip();

    /* Dark background inside the rounded clip */
    ctx.fillStyle = '#07070d';
    ctx.fillRect(0, 0, cw, ch);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.drawImage(img, 0, 0, cw, ch);
      resolve(canvas.toDataURL('image/png').split(',')[1]);
    };
    img.onerror = () => resolve(null);

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr)));
  });
}

/**
 * Capture all diagram SVGs currently mounted in the DOM.
 *
 * All four diagram tabs (CI/CD, Git Flow, Deploy, Versioning) remain
 * mounted in React even when the user navigates to the Review tab, so
 * their <svg class="pipeline-svg" data-section="..."> elements are
 * available for capture without any tab-switching.
 *
 * Returns: Promise<Array<{
 *   name:    string,   // e.g. "CI/CD: My Pipeline"
 *   data:    string,   // raw base64 PNG (3× scale)
 *   width:   number,   // original SVG width  (px)
 *   height:  number,   // original SVG height (px)
 *   section: string,   // 'cicd' | 'gitflow' | 'deploy' | 'versioning'
 *   tabKey:  string,   // Excel worksheet name
 * }>>
 */
export async function captureAllDiagrams() {
  const svgElements = document.querySelectorAll('svg.pipeline-svg[data-section]');
  const images = [];

  for (const svgEl of svgElements) {
    try {
      const section = svgEl.getAttribute('data-section')      || 'cicd';
      const rawName = svgEl.getAttribute('data-diagram-name') || `diagram-${images.length + 1}`;
      const prefix  = SECTION_PREFIX[section] || '';
      const name    = prefix ? `${prefix} ${rawName}` : rawName;
      const tabKey  = SECTION_TAB[section]    || 'Diagrams';

      const w = parseInt(svgEl.getAttribute('width'),  10) || 600;
      const h = parseInt(svgEl.getAttribute('height'), 10) || 300;

      const svgStr = cloneAndResolveSVG(svgEl);
      const data   = await svgStringToPng(svgStr, w, h);

      if (data) {
        images.push({ name, data, width: w, height: h, section, tabKey });
      }
    } catch (err) {
      console.warn('[diagramCapture] failed for SVG:', err);
    }
  }

  return images;
}
