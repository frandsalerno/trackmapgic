const mongoose = require('mongoose');

const trackMapSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    geoJSON: {
      type: { type: String, enum: ['FeatureCollection'], default: 'FeatureCollection' },
      features: { type: Array, default: [] },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TrackMap', trackMapSchema);
