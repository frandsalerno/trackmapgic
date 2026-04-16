const express = require('express');
const auth = require('../middleware/auth');
const TrackMap = require('../models/TrackMap');
const { geojsonToGpx } = require('../utils/gpxExport');

const router = express.Router();

// All routes require authentication
router.use(auth);

// GET /api/maps
router.get('/', async (req, res) => {
  try {
    const maps = await TrackMap.find({ userId: req.userId })
      .select('-geoJSON')
      .sort({ updatedAt: -1 });
    res.json(maps);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/maps/:id
router.get('/:id', async (req, res) => {
  try {
    const map = await TrackMap.findOne({ _id: req.params.id, userId: req.userId });
    if (!map) return res.status(404).json({ error: 'Map not found' });
    res.json(map);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/maps
router.post('/', async (req, res) => {
  try {
    const { name, description, geoJSON } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const map = await TrackMap.create({
      userId: req.userId,
      name,
      description,
      geoJSON: geoJSON || { type: 'FeatureCollection', features: [] },
    });
    res.status(201).json(map);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/maps/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, description, geoJSON } = req.body;
    const map = await TrackMap.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { name, description, geoJSON },
      { new: true, runValidators: true }
    );
    if (!map) return res.status(404).json({ error: 'Map not found' });
    res.json(map);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/maps/:id
router.delete('/:id', async (req, res) => {
  try {
    const map = await TrackMap.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!map) return res.status(404).json({ error: 'Map not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/maps/:id/export?format=geojson|gpx
router.get('/:id/export', async (req, res) => {
  try {
    const map = await TrackMap.findOne({ _id: req.params.id, userId: req.userId });
    if (!map) return res.status(404).json({ error: 'Map not found' });

    const format = req.query.format || 'geojson';
    const filename = map.name.replace(/\s+/g, '_');

    if (format === 'gpx') {
      const gpx = geojsonToGpx(map.geoJSON, map.name);
      res.setHeader('Content-Type', 'application/gpx+xml');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.gpx"`);
      return res.send(gpx);
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.geojson"`);
    res.json(map.geoJSON);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
