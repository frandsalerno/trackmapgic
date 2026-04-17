import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FeatureGroup, MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-draw';
import api, { downloadFile } from '../api/client';
import './MapEditor.css';

// Fixes Leaflet default icon paths broken by Vite's asset handling
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function DrawControl({ featureGroupRef, onFeaturesChange }) {
  const map = useMap();

  useEffect(() => {
    const fg = featureGroupRef.current;
    if (!fg) return;

    const drawControl = new L.Control.Draw({
      edit: { featureGroup: fg },
      draw: {
        polygon: true,
        polyline: true,
        rectangle: false,
        circle: false,
        circlemarker: false,
        marker: true,
      },
    });

    map.addControl(drawControl);

    function onCreated(e) {
      fg.addLayer(e.layer);
      onFeaturesChange(fg.toGeoJSON());
    }
    function onEdited() { onFeaturesChange(fg.toGeoJSON()); }
    function onDeleted() { onFeaturesChange(fg.toGeoJSON()); }

    map.on(L.Draw.Event.CREATED, onCreated);
    map.on(L.Draw.Event.EDITED, onEdited);
    map.on(L.Draw.Event.DELETED, onDeleted);

    return () => {
      map.removeControl(drawControl);
      map.off(L.Draw.Event.CREATED, onCreated);
      map.off(L.Draw.Event.EDITED, onEdited);
      map.off(L.Draw.Event.DELETED, onDeleted);
    };
  }, [map, featureGroupRef, onFeaturesChange]);

  return null;
}

function FeatureGroupLayer({ featureGroupRef, geoJSON }) {
  const map = useMap();
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current || !geoJSON || !geoJSON.features?.length) return;
    loaded.current = true;

    const fg = featureGroupRef.current;
    if (!fg) return;

    const layer = L.geoJSON(geoJSON);
    layer.eachLayer((l) => fg.addLayer(l));

    const bounds = fg.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] });
  }, [geoJSON, map, featureGroupRef]);

  return null;
}

export default function MapEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;

  const featureGroupRef = useRef(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [geoJSON, setGeoJSON] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedId, setSavedId] = useState(id || null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!id) return;
    api.get(`/maps/${id}`).then((res) => {
      const map = res.data;
      setName(map.name);
      setDescription(map.description || '');
      setGeoJSON(map.geoJSON);
    });
  }, [id]);

  async function handleSave() {
    if (!name.trim()) { setError('Map name is required'); return; }
    setError('');
    setSaving(true);

    const body = { name, description, geoJSON: geoJSON || { type: 'FeatureCollection', features: [] } };

    try {
      if (savedId) {
        await api.put(`/maps/${savedId}`, body);
      } else {
        const res = await api.post('/maps', body);
        setSavedId(res.data._id);
        navigate(`/maps/${res.data._id}`, { replace: true });
      }
      setStatus('Saved!');
      setTimeout(() => setStatus(''), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function handleExport(format) {
    if (!savedId) { setError('Save the map first before exporting.'); return; }
    const ext = format === 'gpx' ? 'gpx' : 'geojson';
    const filename = `${(name || 'track').replace(/\s+/g, '_')}.${ext}`;
    downloadFile(`/maps/${savedId}/export?format=${format}`, filename);
  }

  return (
    <div className="editor-layout">
      <aside className="editor-sidebar">
        <button className="btn-secondary back-btn" onClick={() => navigate('/dashboard')}>← Dashboard</button>

        <div className="sidebar-section">
          <h2>{isNew ? 'New map' : 'Edit map'}</h2>

          <div className="form-group">
            <label>Map name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="My track" />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional description…"
            />
          </div>

          {error && <p className="error-msg">{error}</p>}
          {status && <p className="success-msg">{status}</p>}

          <button className="btn-primary save-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save map'}
          </button>
        </div>

        <div className="sidebar-section">
          <h3>Export</h3>
          <div className="export-btns">
            <button className="btn-secondary" onClick={() => handleExport('geojson')}>Download GeoJSON</button>
            <button className="btn-secondary" onClick={() => handleExport('gpx')}>Download GPX</button>
          </div>
        </div>

        <div className="sidebar-section">
          <h3>Drawing tools</h3>
          <ul className="tips">
            <li>Use the toolbar on the map to draw polylines, polygons, or markers.</li>
            <li>Click a drawn shape to edit or delete it.</li>
            <li>Save often — changes are not auto-saved.</li>
          </ul>
        </div>
      </aside>

      <div className="editor-map">
        <MapContainer
          center={[45.0, 10.0]}
          zoom={5}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FeatureGroup ref={featureGroupRef}>
            <DrawControl featureGroupRef={featureGroupRef} onFeaturesChange={setGeoJSON} />
            {geoJSON && <FeatureGroupLayer featureGroupRef={featureGroupRef} geoJSON={geoJSON} />}
          </FeatureGroup>
        </MapContainer>
      </div>
    </div>
  );
}
