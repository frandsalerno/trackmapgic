const express = require('express');
const multer = require('multer');
const auth = require('../middleware/auth');
const { parseSVG } = require('../utils/svgParser');
const { searchCircuits } = require('../utils/circuits');

const router = express.Router();

// Store file in memory (no disk write needed)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter(req, file, cb) {
    if (file.mimetype === 'image/svg+xml' || file.originalname.toLowerCase().endsWith('.svg')) {
      cb(null, true);
    } else {
      cb(new Error('Only SVG files are supported'));
    }
  },
});

// POST /api/convert/svg
// Parse an uploaded SVG and return all path elements with their sampled points
router.post('/svg', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const result = await parseSVG(req.file.buffer);

    // Return paths with points (don't send the raw SVG content — frontend uses the d attributes)
    res.json({
      svgWidth: result.svgWidth,
      svgHeight: result.svgHeight,
      globalBounds: result.globalBounds,
      paths: result.paths.map((p) => ({
        id: p.id,
        label: p.label,
        d: p.d,
        transform: p.transform,
        style: p.style,
        pointsNorm: p.pointsNorm, // normalized 0-1 (for georef)
        bounds: p.bounds,
        pointCount: p.points.length,
      })),
    });
  } catch (err) {
    console.error('SVG parse error:', err);
    res.status(500).json({ error: err.message || 'Failed to parse SVG' });
  }
});

// GET /api/convert/circuits?q=misano
router.get('/circuits', auth, (req, res) => {
  const results = searchCircuits(req.query.q || '');
  res.json(results);
});

module.exports = router;
