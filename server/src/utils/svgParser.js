// SVG → point arrays
// Handles transforms, all path commands (M L H V C S Q T A Z and lowercase)

// ─── Transform helpers ────────────────────────────────────────────────────────

function parseTransform(str) {
  if (!str) return null;
  const matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

  const translate = str.match(/translate\(\s*([-\d.e+]+)(?:[,\s]+([-\d.e+]+))?\s*\)/);
  if (translate) {
    matrix.e = parseFloat(translate[1]);
    matrix.f = parseFloat(translate[2] || '0');
    return matrix;
  }

  const scale = str.match(/scale\(\s*([-\d.e+]+)(?:[,\s]+([-\d.e+]+))?\s*\)/);
  if (scale) {
    matrix.a = parseFloat(scale[1]);
    matrix.d = parseFloat(scale[2] || scale[1]);
    return matrix;
  }

  const rotate = str.match(/rotate\(\s*([-\d.e+]+)(?:[,\s]+([-\d.e+]+)[,\s]+([-\d.e+]+))?\s*\)/);
  if (rotate) {
    const angle = (parseFloat(rotate[1]) * Math.PI) / 180;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const cx = parseFloat(rotate[2] || '0'), cy = parseFloat(rotate[3] || '0');
    return { a: cos, b: sin, c: -sin, d: cos, e: cx - cos * cx + sin * cy, f: cy - sin * cx - cos * cy };
  }

  const mat = str.match(/matrix\(\s*([-\d.e+]+)[,\s]+([-\d.e+]+)[,\s]+([-\d.e+]+)[,\s]+([-\d.e+]+)[,\s]+([-\d.e+]+)[,\s]+([-\d.e+]+)\s*\)/);
  if (mat) {
    return { a: +mat[1], b: +mat[2], c: +mat[3], d: +mat[4], e: +mat[5], f: +mat[6] };
  }

  return null;
}

function applyTransform(pt, m) {
  if (!m) return pt;
  return [m.a * pt[0] + m.c * pt[1] + m.e, m.b * pt[0] + m.d * pt[1] + m.f];
}

function composeTransforms(parent, child) {
  if (!parent) return child;
  if (!child) return parent;
  return {
    a: parent.a * child.a + parent.c * child.b,
    b: parent.b * child.a + parent.d * child.b,
    c: parent.a * child.c + parent.c * child.d,
    d: parent.b * child.c + parent.d * child.d,
    e: parent.a * child.e + parent.c * child.f + parent.e,
    f: parent.b * child.e + parent.d * child.f + parent.f,
  };
}

// ─── Path command parser ──────────────────────────────────────────────────────

function tokenize(d) {
  return d.match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) || [];
}

function sampleCubic(p0, p1, p2, p3, n = 16) {
  const pts = [];
  for (let k = 1; k <= n; k++) {
    const t = k / n, mt = 1 - t;
    pts.push([
      mt ** 3 * p0[0] + 3 * mt ** 2 * t * p1[0] + 3 * mt * t ** 2 * p2[0] + t ** 3 * p3[0],
      mt ** 3 * p0[1] + 3 * mt ** 2 * t * p1[1] + 3 * mt * t ** 2 * p2[1] + t ** 3 * p3[1],
    ]);
  }
  return pts;
}

function sampleQuad(p0, p1, p2, n = 12) {
  const pts = [];
  for (let k = 1; k <= n; k++) {
    const t = k / n, mt = 1 - t;
    pts.push([
      mt ** 2 * p0[0] + 2 * mt * t * p1[0] + t ** 2 * p2[0],
      mt ** 2 * p0[1] + 2 * mt * t * p1[1] + t ** 2 * p2[1],
    ]);
  }
  return pts;
}

// Approximate arc as a series of cubic bezier segments
function arcToBeziers(cx0, cy0, rx, ry, xRotDeg, largeArc, sweep, ex, ey) {
  // Degenerate: treat as line
  if (rx === 0 || ry === 0) return [[ex, ey]];

  const xRot = (xRotDeg * Math.PI) / 180;
  const cosR = Math.cos(xRot), sinR = Math.sin(xRot);

  // Endpoint to center parameterization
  const dx = (cx0 - ex) / 2, dy = (cy0 - ey) / 2;
  const x1p = cosR * dx + sinR * dy, y1p = -sinR * dx + cosR * dy;

  let rxSq = rx * rx, rySq = ry * ry;
  const x1pSq = x1p * x1p, y1pSq = y1p * y1p;

  let radiiCheck = x1pSq / rxSq + y1pSq / rySq;
  if (radiiCheck > 1) {
    const s = Math.sqrt(radiiCheck);
    rx *= s; ry *= s; rxSq = rx * rx; rySq = ry * ry;
  }

  const num = rxSq * rySq - rxSq * y1pSq - rySq * x1pSq;
  const den = rxSq * y1pSq + rySq * x1pSq;
  const sq = Math.sqrt(Math.max(0, num / den));
  const sign = largeArc === sweep ? -1 : 1;

  const cxp = sign * sq * (rx * y1p) / ry;
  const cyp = sign * sq * (-ry * x1p) / rx;

  // Back to original coords
  const cx = cosR * cxp - sinR * cyp + (cx0 + ex) / 2;
  const cy = sinR * cxp + cosR * cyp + (cy0 + ey) / 2;

  const atan2 = (y, x) => Math.atan2(y, x);
  const theta1 = atan2((y1p - cyp) / ry, (x1p - cxp) / rx);
  let dTheta = atan2((-y1p - cyp) / ry, (-x1p - cxp) / rx) - theta1;

  if (!sweep && dTheta > 0) dTheta -= 2 * Math.PI;
  if (sweep && dTheta < 0) dTheta += 2 * Math.PI;

  // Sample the arc
  const steps = Math.max(4, Math.ceil((Math.abs(dTheta) / Math.PI) * 16));
  const pts = [];
  for (let k = 1; k <= steps; k++) {
    const t = theta1 + (k / steps) * dTheta;
    const x = cosR * rx * Math.cos(t) - sinR * ry * Math.sin(t) + cx;
    const y = sinR * rx * Math.cos(t) + cosR * ry * Math.sin(t) + cy;
    pts.push([x, y]);
  }
  return pts;
}

function parsePath(d, transform) {
  if (!d) return [];
  const tokens = tokenize(d);
  const points = [];
  let i = 0;
  let cx = 0, cy = 0, startX = 0, startY = 0;
  let lastCtrlX = 0, lastCtrlY = 0;
  let cmd = '';

  function num() { return i < tokens.length ? parseFloat(tokens[i++]) : 0; }
  function addPt(x, y) { points.push(applyTransform([x, y], transform)); }

  while (i < tokens.length) {
    if (/[MmLlHhVvCcSsQqTtAaZz]/.test(tokens[i])) cmd = tokens[i++];

    const upper = cmd.toUpperCase();
    const rel = cmd !== upper;

    if (upper === 'Z') {
      addPt(startX, startY);
      cx = startX; cy = startY;
      cmd = '';
      continue;
    }

    if (upper === 'M') {
      let x = num(), y = num();
      if (rel) { x += cx; y += cy; }
      cx = x; cy = y; startX = x; startY = y;
      lastCtrlX = cx; lastCtrlY = cy;
      addPt(cx, cy);
      cmd = rel ? 'l' : 'L';
      continue;
    }

    if (upper === 'L') {
      let x = num(), y = num();
      if (rel) { x += cx; y += cy; }
      cx = x; cy = y;
      lastCtrlX = cx; lastCtrlY = cy;
      addPt(cx, cy);
      continue;
    }

    if (upper === 'H') {
      let x = num();
      if (rel) x += cx;
      cx = x; lastCtrlX = cx; lastCtrlY = cy;
      addPt(cx, cy);
      continue;
    }

    if (upper === 'V') {
      let y = num();
      if (rel) y += cy;
      cy = y; lastCtrlX = cx; lastCtrlY = cy;
      addPt(cx, cy);
      continue;
    }

    if (upper === 'C') {
      let x1 = num(), y1 = num(), x2 = num(), y2 = num(), x = num(), y = num();
      if (rel) { x1 += cx; y1 += cy; x2 += cx; y2 += cy; x += cx; y += cy; }
      for (const p of sampleCubic([cx, cy], [x1, y1], [x2, y2], [x, y])) addPt(p[0], p[1]);
      lastCtrlX = x2; lastCtrlY = y2; cx = x; cy = y;
      continue;
    }

    if (upper === 'S') {
      let x2 = num(), y2 = num(), x = num(), y = num();
      if (rel) { x2 += cx; y2 += cy; x += cx; y += cy; }
      const x1 = 2 * cx - lastCtrlX, y1 = 2 * cy - lastCtrlY;
      for (const p of sampleCubic([cx, cy], [x1, y1], [x2, y2], [x, y])) addPt(p[0], p[1]);
      lastCtrlX = x2; lastCtrlY = y2; cx = x; cy = y;
      continue;
    }

    if (upper === 'Q') {
      let x1 = num(), y1 = num(), x = num(), y = num();
      if (rel) { x1 += cx; y1 += cy; x += cx; y += cy; }
      for (const p of sampleQuad([cx, cy], [x1, y1], [x, y])) addPt(p[0], p[1]);
      lastCtrlX = x1; lastCtrlY = y1; cx = x; cy = y;
      continue;
    }

    if (upper === 'T') {
      let x = num(), y = num();
      if (rel) { x += cx; y += cy; }
      const x1 = 2 * cx - lastCtrlX, y1 = 2 * cy - lastCtrlY;
      for (const p of sampleQuad([cx, cy], [x1, y1], [x, y])) addPt(p[0], p[1]);
      lastCtrlX = x1; lastCtrlY = y1; cx = x; cy = y;
      continue;
    }

    if (upper === 'A') {
      const rx = num(), ry = num(), xRot = num(), largeArc = num(), sweep = num();
      let x = num(), y = num();
      if (rel) { x += cx; y += cy; }
      for (const p of arcToBeziers(cx, cy, rx, ry, xRot, largeArc, sweep, x, y)) addPt(p[0], p[1]);
      lastCtrlX = x; lastCtrlY = y; cx = x; cy = y;
      continue;
    }

    i++; // unknown, skip
  }

  return points;
}

// ─── Style parser ─────────────────────────────────────────────────────────────

function parseStyle(str) {
  const out = {};
  if (!str) return out;
  for (const decl of str.split(';')) {
    const [k, v] = decl.split(':');
    if (k && v) out[k.trim()] = v.trim();
  }
  return out;
}

function getBounds(points) {
  if (!points.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

// ─── Main SVG walk ────────────────────────────────────────────────────────────

function walkNode(node, parentTransform, paths) {
  if (!node) return;

  const nodeTransform = parseTransform(node.attributes && node.attributes.transform);
  const transform = composeTransforms(parentTransform, nodeTransform);

  if (node.name === 'path' && node.attributes && node.attributes.d) {
    const attrs = node.attributes;
    const style = parseStyle(attrs.style || '');

    const stroke = style.stroke || attrs.stroke || 'none';
    const fill = style.fill !== undefined ? style.fill : (attrs.fill || 'none');
    const strokeWidth = parseFloat(style['stroke-width'] || attrs['stroke-width'] || '1');
    const opacity = parseFloat(style.opacity || attrs.opacity || '1');

    const points = parsePath(attrs.d, transform);
    const bounds = getBounds(points);

    if (points.length > 1) {
      paths.push({
        id: attrs.id || `path_${paths.length}`,
        label: attrs.id || `Path ${paths.length + 1}`,
        d: attrs.d,
        transform: transform ? `matrix(${transform.a},${transform.b},${transform.c},${transform.d},${transform.e},${transform.f})` : '',
        style: { stroke, fill, strokeWidth, opacity },
        points,
        bounds,
      });
    }
  }

  if (node.children) {
    for (const child of node.children) {
      walkNode(child, transform, paths);
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

async function parseSVG(svgBuffer) {
  const svgson = require('svgson');
  const content = svgBuffer.toString('utf8');
  const svg = await svgson.parse(content);

  const attrs = svg.attributes || {};
  const svgWidth = parseFloat(attrs.width) || 800;
  const svgHeight = parseFloat(attrs.height) || 600;

  const paths = [];
  walkNode(svg, null, paths);

  // Compute global bounds across all paths
  let gMinX = Infinity, gMinY = Infinity, gMaxX = -Infinity, gMaxY = -Infinity;
  for (const p of paths) {
    if (!p.bounds) continue;
    if (p.bounds.minX < gMinX) gMinX = p.bounds.minX;
    if (p.bounds.minY < gMinY) gMinY = p.bounds.minY;
    if (p.bounds.maxX > gMaxX) gMaxX = p.bounds.maxX;
    if (p.bounds.maxY > gMaxY) gMaxY = p.bounds.maxY;
  }

  const gWidth = gMaxX - gMinX || 1;
  const gHeight = gMaxY - gMinY || 1;

  // Add normalized points (0–1 relative to global bounds, for georeferencing)
  for (const p of paths) {
    p.pointsNorm = p.points.map(([x, y]) => [
      (x - gMinX) / gWidth,
      (y - gMinY) / gHeight,
    ]);
  }

  return {
    svgWidth,
    svgHeight,
    globalBounds: { minX: gMinX, minY: gMinY, maxX: gMaxX, maxY: gMaxY, width: gWidth, height: gHeight },
    paths,
  };
}

module.exports = { parseSVG };
