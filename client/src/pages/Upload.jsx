import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import api from '../api/client';
import './Upload.css';

// ─── Georeferencing math ──────────────────────────────────────────────────────

// Placement method: center + scale (deg/unit) + rotation
function placementTransform(normX, normY, { centerLat, centerLon, scale, rotation }) {
  const rotRad = (rotation * Math.PI) / 180;
  const dx = normX - 0.5;
  const dy = normY - 0.5;
  const rdx = dx * Math.cos(rotRad) - dy * Math.sin(rotRad);
  const rdy = dx * Math.sin(rotRad) + dy * Math.cos(rotRad);
  return [centerLat - rdy * scale, centerLon + rdx * scale];
}

// Two-point method: similarity transform (rotation + scale + translation)
function twoPointTransform(normX, normY, { p1, p2 }) {
  if (!p1.lat || !p1.lon || !p2.lat || !p2.lon || (p1.svgX === p2.svgX && p1.svgY === p2.svgY)) return null;
  const dx = p2.svgX - p1.svgX, dy = p2.svgY - p1.svgY;
  const dLon = parseFloat(p2.lon) - parseFloat(p1.lon);
  const dLat = parseFloat(p2.lat) - parseFloat(p1.lat);
  const denom = dx * dx + dy * dy;
  const a = (dLon * dx + dLat * dy) / denom;
  const b = (dLon * dy - dLat * dx) / denom;
  const dpx = normX - p1.svgX, dpy = normY - p1.svgY;
  return [parseFloat(p1.lat) - b * dpx + a * dpy, parseFloat(p1.lon) + a * dpx + b * dpy];
}

function normPointsToLatLng(pointsNorm, georef) {
  return pointsNorm
    .map(([nx, ny]) => {
      if (georef.method === 'placement' || georef.method === 'circuit') {
        return placementTransform(nx, ny, georef);
      }
      if (georef.method === 'twopoint') {
        return twoPointTransform(nx, ny, georef);
      }
      return null;
    })
    .filter(Boolean);
}

function buildGeoJSON(selectedPaths, georef) {
  const features = selectedPaths.map((p) => {
    const coords = normPointsToLatLng(p.pointsNorm, georef);
    return {
      type: 'Feature',
      properties: { id: p.id, label: p.label },
      geometry: { type: 'LineString', coordinates: coords.map(([lat, lon]) => [lon, lat]) },
    };
  });
  return { type: 'FeatureCollection', features };
}

// ─── Live map updater ─────────────────────────────────────────────────────────

function FlyTo({ center, triggered }) {
  const map = useMap();
  const prev = useRef(null);
  useEffect(() => {
    if (center && triggered !== prev.current) {
      prev.current = triggered;
      map.flyTo(center, 14, { duration: 1 });
    }
  }, [center, triggered, map]);
  return null;
}

// ─── Draggable track overlay ──────────────────────────────────────────────────

function DraggableTrack({ lines, color = '#3b82f6', weight = 3, dragMode, setGeoref }) {
  const map = useMap();
  const dragging = useRef(false);
  const lastLatLng = useRef(null);

  useEffect(() => {
    const container = map.getContainer();

    if (!dragMode) {
      map.dragging.enable();
      container.style.cursor = '';
      return;
    }

    map.dragging.disable();
    container.style.cursor = 'grab';

    function onMouseDown(e) {
      dragging.current = true;
      lastLatLng.current = e.latlng;
      container.style.cursor = 'grabbing';
    }

    function onMouseMove(e) {
      if (!dragging.current || !lastLatLng.current) return;
      const dLat = e.latlng.lat - lastLatLng.current.lat;
      const dLon = e.latlng.lng - lastLatLng.current.lng;
      lastLatLng.current = e.latlng;
      setGeoref((g) => ({
        ...g,
        centerLat: g.centerLat + dLat,
        centerLon: g.centerLon + dLon,
      }));
    }

    function onMouseUp() {
      dragging.current = false;
      lastLatLng.current = null;
      container.style.cursor = 'grab';
    }

    map.on('mousedown', onMouseDown);
    map.on('mousemove', onMouseMove);
    map.on('mouseup', onMouseUp);

    return () => {
      map.off('mousedown', onMouseDown);
      map.off('mousemove', onMouseMove);
      map.off('mouseup', onMouseUp);
      map.dragging.enable();
      container.style.cursor = '';
      dragging.current = false;
    };
  }, [dragMode, map, setGeoref]);

  return lines.map((line, i) => (
    <Polyline key={i} positions={line} color={color} weight={weight} />
  ));
}

// ─── SVG Preview with interactive path selection ──────────────────────────────

function SvgPreview({ paths, selectedIds, toggleId, pickingPoint, onPickPoint }) {
  const svgRef = useRef(null);

  function handlePathClick(e, id) {
    if (pickingPoint !== null) {
      // Get click position relative to SVG viewBox
      const svg = svgRef.current;
      const rect = svg.getBoundingClientRect();
      const vb = svg.viewBox.baseVal;
      const nx = ((e.clientX - rect.left) / rect.width) * vb.width;
      const ny = ((e.clientY - rect.top) / rect.height) * vb.height;
      // Normalize to 0-1
      onPickPoint(nx, ny);
    } else {
      toggleId(id);
    }
  }

  function handleSvgClick(e) {
    if (pickingPoint === null) return;
    if (e.target === svgRef.current) {
      const svg = svgRef.current;
      const rect = svg.getBoundingClientRect();
      const vb = svg.viewBox.baseVal;
      const nx = ((e.clientX - rect.left) / rect.width) * vb.width;
      const ny = ((e.clientY - rect.top) / rect.height) * vb.height;
      onPickPoint(nx / vb.width, ny / vb.height);
    }
  }

  if (!paths || paths.length === 0) return null;

  // Compute viewBox from all path bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of paths) {
    if (!p.bounds) continue;
    if (p.bounds.minX < minX) minX = p.bounds.minX;
    if (p.bounds.minY < minY) minY = p.bounds.minY;
    if (p.bounds.maxX > maxX) maxX = p.bounds.maxX;
    if (p.bounds.maxY > maxY) maxY = p.bounds.maxY;
  }
  const pad = (maxX - minX) * 0.03;
  const vbX = minX - pad, vbY = minY - pad;
  const vbW = maxX - minX + pad * 2, vbH = maxY - minY + pad * 2;

  return (
    <svg
      ref={svgRef}
      viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
      style={{ width: '100%', height: '100%', background: '#111', cursor: pickingPoint !== null ? 'crosshair' : 'default' }}
      onClick={handleSvgClick}
    >
      {paths.map((p) => {
        const selected = selectedIds.has(p.id);
        const s = p.style;
        const stroke = s.stroke === 'none' || !s.stroke ? '#fff' : s.stroke;
        return (
          <path
            key={p.id}
            d={p.d}
            transform={p.transform || ''}
            fill={s.fill === 'none' ? 'none' : (s.fill || 'none')}
            stroke={selected ? stroke : '#333'}
            strokeWidth={s.strokeWidth || 1}
            opacity={selected ? (s.opacity || 1) : 0.25}
            style={{ cursor: 'pointer', transition: 'opacity 0.15s, stroke 0.15s' }}
            onClick={(e) => { e.stopPropagation(); handlePathClick(e, p.id); }}
          />
        );
      })}
    </svg>
  );
}

// ─── Main Upload page ─────────────────────────────────────────────────────────

const INITIAL_GEOREF = {
  method: 'placement',
  centerLat: 45,
  centerLon: 10,
  scale: 0.001,
  rotation: 0,
  circuit: null,
  p1: { svgX: 0.2, svgY: 0.2, lat: '', lon: '' },
  p2: { svgX: 0.8, svgY: 0.8, lat: '', lon: '' },
};

export default function Upload() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState(null); // { svgWidth, svgHeight, paths }
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [georef, setGeoref] = useState(INITIAL_GEOREF);
  const [circuitQuery, setCircuitQuery] = useState('');
  const [circuitResults, setCircuitResults] = useState([]);
  const [pickingPoint, setPickingPoint] = useState(null); // null | 1 | 2
  const [dragMode, setDragMode] = useState(false);
  const [flyTrigger, setFlyTrigger] = useState(0);
  const [mapName, setMapName] = useState('');
  const [mapDesc, setMapDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // ── File handling ─────────────────────────────────────────────────────────

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }

  async function parseSvg() {
    if (!file) return;
    setParsing(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post('/convert/svg', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      const data = res.data;
      setParsedData(data);
      // Auto-select paths that look like track outlines (have a stroke, not tiny)
      const autoSelected = new Set(
        data.paths
          .filter((p) => p.style.stroke !== 'none' && p.style.stroke && p.pointCount > 20)
          .map((p) => p.id)
      );
      setSelectedIds(autoSelected);
      setMapName(file.name.replace(/\.svg$/i, '').replace(/[-_]/g, ' '));
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to parse SVG');
    } finally {
      setParsing(false);
    }
  }

  // ── Path selection ────────────────────────────────────────────────────────

  function toggleId(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() { setSelectedIds(new Set(parsedData.paths.map((p) => p.id))); }
  function deselectAll() { setSelectedIds(new Set()); }
  function selectTrackLike() {
    setSelectedIds(new Set(
      parsedData.paths
        .filter((p) => p.style.stroke !== 'none' && p.style.stroke && p.pointCount > 20)
        .map((p) => p.id)
    ));
  }

  // ── Circuit search ────────────────────────────────────────────────────────

  useEffect(() => {
    if (circuitQuery.length < 2) { setCircuitResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await api.get(`/convert/circuits?q=${encodeURIComponent(circuitQuery)}`);
        setCircuitResults(res.data);
      } catch {}
    }, 250);
    return () => clearTimeout(t);
  }, [circuitQuery]);

  function selectCircuit(c) {
    setGeoref((g) => ({
      ...g,
      method: 'circuit',
      centerLat: c.lat,
      centerLon: c.lon,
      circuit: c,
      scale: c.lengthM / 111111 / Math.SQRT2,
    }));
    setCircuitQuery(c.name);
    setCircuitResults([]);
    setFlyTrigger((t) => t + 1); // fly map to circuit
  }

  // ── Two-point pick ────────────────────────────────────────────────────────

  function handlePickPoint(nx, ny) {
    if (pickingPoint === 1) {
      setGeoref((g) => ({ ...g, p1: { ...g.p1, svgX: nx, svgY: ny } }));
    } else if (pickingPoint === 2) {
      setGeoref((g) => ({ ...g, p2: { ...g.p2, svgX: nx, svgY: ny } }));
    }
    setPickingPoint(null);
  }

  // ── Computed map lines ────────────────────────────────────────────────────

  const selectedPaths = parsedData ? parsedData.paths.filter((p) => selectedIds.has(p.id)) : [];
  const mapLines = selectedPaths.map((p) => normPointsToLatLng(p.pointsNorm, georef)).filter((l) => l.length > 1);
  const mapCenter = georef.method === 'twopoint'
    ? (georef.p1.lat && georef.p1.lon ? [parseFloat(georef.p1.lat), parseFloat(georef.p1.lon)] : [45, 10])
    : [georef.centerLat, georef.centerLon];

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!mapName.trim()) { setError('Map name is required'); return; }
    if (selectedPaths.length === 0) { setError('Select at least one path'); return; }
    setSaving(true);
    setError('');
    try {
      const geoJSON = buildGeoJSON(selectedPaths, georef);
      const res = await api.post('/maps', { name: mapName, description: mapDesc, geoJSON });
      navigate(`/maps/${res.data._id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="upload-page">
      {/* Step indicator */}
      <div className="upload-steps">
        {['Upload', 'Clean up', 'Georeference', 'Save'].map((label, idx) => (
          <div key={label} className={`upload-step ${step === idx + 1 ? 'active' : ''} ${step > idx + 1 ? 'done' : ''}`}>
            <span className="step-num">{step > idx + 1 ? '✓' : idx + 1}</span>
            <span className="step-label">{label}</span>
          </div>
        ))}
      </div>

      <div className="upload-body">

        {/* ── Step 1: Upload ── */}
        {step === 1 && (
          <div className="step-panel center-panel">
            <h2>Upload SVG track file</h2>
            <p className="step-hint">Supports SVG files exported from Inkscape, Illustrator, or similar tools.</p>

            <div
              className={`drop-zone ${dragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('svg-file-input').click()}
            >
              <input
                id="svg-file-input"
                type="file"
                accept=".svg,image/svg+xml"
                style={{ display: 'none' }}
                onChange={(e) => setFile(e.target.files[0])}
              />
              {file ? (
                <div className="file-info">
                  <span className="file-icon">📄</span>
                  <strong>{file.name}</strong>
                  <span className="file-size">{(file.size / 1024).toFixed(1)} KB</span>
                </div>
              ) : (
                <>
                  <span className="drop-icon">⬆️</span>
                  <p>Drag & drop an SVG file here, or click to browse</p>
                </>
              )}
            </div>

            {error && <p className="error-msg">{error}</p>}
            <button className="btn-primary step-btn" disabled={!file || parsing} onClick={parseSvg}>
              {parsing ? 'Parsing…' : 'Parse SVG →'}
            </button>
          </div>
        )}

        {/* ── Step 2: Path selection ── */}
        {step === 2 && parsedData && (
          <div className="step-panel split-panel">
            <aside className="path-list-panel">
              <h2>Select track paths</h2>
              <p className="step-hint">Toggle paths on/off. Click a path in the list or on the preview to toggle it.</p>

              <div className="path-list-actions">
                <button className="btn-secondary" onClick={selectTrackLike}>Auto-select</button>
                <button className="btn-secondary" onClick={selectAll}>All</button>
                <button className="btn-secondary" onClick={deselectAll}>None</button>
              </div>

              <ul className="path-list">
                {parsedData.paths.map((p) => {
                  const selected = selectedIds.has(p.id);
                  const s = p.style;
                  const swatchColor = s.stroke !== 'none' && s.stroke ? s.stroke : s.fill !== 'none' ? s.fill : '#888';
                  return (
                    <li
                      key={p.id}
                      className={`path-item ${selected ? 'selected' : ''}`}
                      onClick={() => toggleId(p.id)}
                    >
                      <span className="path-swatch" style={{ background: swatchColor === 'none' ? '#555' : swatchColor }} />
                      <div className="path-info">
                        <span className="path-id">{p.id}</span>
                        <span className="path-meta">{p.pointCount} pts · stroke {s.stroke || 'none'}</span>
                      </div>
                      <span className={`path-toggle ${selected ? 'on' : 'off'}`}>{selected ? '●' : '○'}</span>
                    </li>
                  );
                })}
              </ul>

              <div className="step-nav">
                <button className="btn-secondary" onClick={() => setStep(1)}>← Back</button>
                <button className="btn-primary" disabled={selectedIds.size === 0} onClick={() => setStep(3)}>
                  Next →
                </button>
              </div>
            </aside>

            <div className="svg-preview-panel">
              <SvgPreview
                paths={parsedData.paths}
                selectedIds={selectedIds}
                toggleId={toggleId}
                pickingPoint={null}
                onPickPoint={() => {}}
              />
            </div>
          </div>
        )}

        {/* ── Step 3: Georeference ── */}
        {step === 3 && parsedData && (
          <div className="step-panel split-panel">
            <aside className="georef-panel">
              <h2>Georeference</h2>
              <p className="step-hint">Tell us where this track is in the real world. Use all the options you can — more info = better result.</p>

              {/* Method tabs */}
              <div className="method-tabs">
                {[['circuit', '🏁 Known circuit'], ['placement', '🗺️ Map placement'], ['twopoint', '📍 Two-point anchor']].map(([m, label]) => (
                  <button
                    key={m}
                    className={`method-tab ${georef.method === m ? 'active' : ''}`}
                    onClick={() => setGeoref((g) => ({ ...g, method: m }))}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* ── Known circuit ── */}
              {georef.method === 'circuit' && (
                <div className="method-body">
                  <p className="step-hint">Search for a known motorsport circuit. We'll estimate its center and scale.</p>
                  <div className="form-group" style={{ position: 'relative' }}>
                    <label>Circuit name</label>
                    <input
                      value={circuitQuery}
                      onChange={(e) => setCircuitQuery(e.target.value)}
                      placeholder="e.g. Misano, Monza, Spa…"
                    />
                    {circuitResults.length > 0 && (
                      <ul className="circuit-dropdown">
                        {circuitResults.map((c) => (
                          <li key={c.name} onClick={() => selectCircuit(c)}>
                            <strong>{c.name}</strong>
                            <span>{c.country} · {(c.lengthM / 1000).toFixed(2)} km</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {georef.circuit && (
                    <div className="circuit-info">
                      <p>Circuit length: <strong>{(georef.circuit.lengthM / 1000).toFixed(2)} km</strong></p>
                      <p>Current center: <strong>{georef.centerLat.toFixed(5)}, {georef.centerLon.toFixed(5)}</strong></p>
                    </div>
                  )}
                  <div className={`drag-callout ${dragMode ? 'active' : ''}`}>
                    <button
                      className={dragMode ? 'drag-btn active' : 'drag-btn'}
                      onClick={() => setDragMode((d) => !d)}
                    >
                      {dragMode ? '✋ Dragging track' : '🖐 Drag track on map'}
                    </button>
                    {dragMode && <p>Click and drag on the map to fine-tune the position.</p>}
                  </div>
                  <SliderGroup georef={georef} setGeoref={setGeoref} />
                </div>
              )}

              {/* ── Map placement ── */}
              {georef.method === 'placement' && (
                <div className="method-body">
                  <div className={`drag-callout ${dragMode ? 'active' : ''}`}>
                    <button
                      className={dragMode ? 'drag-btn active' : 'drag-btn'}
                      onClick={() => setDragMode((d) => !d)}
                    >
                      {dragMode ? '✋ Dragging track' : '🖐 Drag track on map'}
                    </button>
                    {dragMode
                      ? <p>Click and drag directly on the map to reposition the track.</p>
                      : <p>Or type coordinates below, or use the drag button to move the track directly on the map.</p>
                    }
                  </div>
                  <div className="form-group">
                    <label>Center latitude</label>
                    <input
                      type="number"
                      value={georef.centerLat.toFixed(6)}
                      step="0.001"
                      onChange={(e) => setGeoref((g) => ({ ...g, centerLat: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Center longitude</label>
                    <input
                      type="number"
                      value={georef.centerLon.toFixed(6)}
                      step="0.001"
                      onChange={(e) => setGeoref((g) => ({ ...g, centerLon: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <SliderGroup georef={georef} setGeoref={setGeoref} />
                </div>
              )}

              {/* ── Two-point anchor ── */}
              {georef.method === 'twopoint' && (
                <div className="method-body">
                  <p className="step-hint">
                    Click "Pick" to select a point on the SVG preview, then enter its real-world coordinates.
                    Two points are enough to determine scale, rotation, and position.
                  </p>
                  {[1, 2].map((n) => {
                    const pt = n === 1 ? georef.p1 : georef.p2;
                    const setPt = (upd) =>
                      setGeoref((g) => n === 1 ? { ...g, p1: { ...g.p1, ...upd } } : { ...g, p2: { ...g.p2, ...upd } });
                    return (
                      <div key={n} className="anchor-point">
                        <div className="anchor-header">
                          <span>Point {n}</span>
                          <button
                            className={`btn-secondary pick-btn ${pickingPoint === n ? 'picking' : ''}`}
                            onClick={() => setPickingPoint(pickingPoint === n ? null : n)}
                          >
                            {pickingPoint === n ? '⬅ Click SVG' : 'Pick on SVG'}
                          </button>
                        </div>
                        {pt.svgX !== null && (
                          <p className="pt-coords-svg">SVG: ({pt.svgX.toFixed(3)}, {pt.svgY.toFixed(3)})</p>
                        )}
                        <div className="anchor-inputs">
                          <div className="form-group">
                            <label>Latitude</label>
                            <input
                              type="number"
                              step="0.0001"
                              value={pt.lat}
                              placeholder="43.9597"
                              onChange={(e) => setPt({ lat: e.target.value })}
                            />
                          </div>
                          <div className="form-group">
                            <label>Longitude</label>
                            <input
                              type="number"
                              step="0.0001"
                              value={pt.lon}
                              placeholder="12.6826"
                              onChange={(e) => setPt({ lon: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="step-nav">
                <button className="btn-secondary" onClick={() => setStep(2)}>← Back</button>
                <button className="btn-primary" onClick={() => setStep(4)}>Preview & save →</button>
              </div>
            </aside>

            {/* Live SVG preview (with point picking for two-point mode) */}
            <div className="svg-preview-panel small">
              <div style={{ height: '40%', borderBottom: '1px solid var(--border)' }}>
                <SvgPreview
                  paths={parsedData.paths}
                  selectedIds={selectedIds}
                  toggleId={() => {}}
                  pickingPoint={pickingPoint}
                  onPickPoint={handlePickPoint}
                />
              </div>
              <div style={{ height: '60%', position: 'relative' }}>
                <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <FlyTo center={mapCenter} triggered={flyTrigger} />
                  <DraggableTrack
                    lines={mapLines}
                    weight={2}
                    dragMode={dragMode && georef.method !== 'twopoint'}
                    setGeoref={setGeoref}
                  />
                </MapContainer>
                {georef.method !== 'twopoint' && (
                  <div className="map-drag-toggle">
                    <button
                      className={dragMode ? 'drag-btn active' : 'drag-btn'}
                      onClick={() => setDragMode((d) => !d)}
                      title={dragMode ? 'Switch to map pan mode' : 'Switch to track drag mode'}
                    >
                      {dragMode ? '✋ Dragging track' : '🖐 Drag track'}
                    </button>
                    {dragMode && (
                      <span className="drag-hint">Click & drag to move the track</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 4: Save ── */}
        {step === 4 && (
          <div className="step-panel split-panel">
            <aside className="save-panel">
              <h2>Save track</h2>

              <div className="form-group">
                <label>Map name *</label>
                <input value={mapName} onChange={(e) => setMapName(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={mapDesc}
                  onChange={(e) => setMapDesc(e.target.value)}
                  rows={3}
                  placeholder="Optional…"
                />
              </div>

              <div className="save-summary">
                <p><strong>{selectedIds.size}</strong> path{selectedIds.size !== 1 ? 's' : ''} selected</p>
                <p><strong>{mapLines.reduce((s, l) => s + l.length, 0)}</strong> total points</p>
                {georef.circuit && <p>Circuit: <strong>{georef.circuit.name}</strong></p>}
              </div>

              {error && <p className="error-msg">{error}</p>}

              <button className="btn-primary step-btn" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save to my maps'}
              </button>
              <button className="btn-secondary" style={{ marginTop: '0.5rem', width: '100%' }} onClick={() => setStep(3)}>
                ← Back
              </button>
            </aside>

            <div className="map-preview-panel" style={{ position: 'relative' }}>
              <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <FlyTo center={mapCenter} triggered={flyTrigger} />
                <DraggableTrack
                  lines={mapLines}
                  weight={3}
                  dragMode={dragMode}
                  setGeoref={setGeoref}
                />
              </MapContainer>
              <div className="map-drag-toggle">
                <button
                  className={dragMode ? 'drag-btn active' : 'drag-btn'}
                  onClick={() => setDragMode((d) => !d)}
                >
                  {dragMode ? '✋ Dragging track' : '🖐 Drag track'}
                </button>
                {dragMode && <span className="drag-hint">Click & drag to move the track</span>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Shared slider group ──────────────────────────────────────────────────────

function SliderGroup({ georef, setGeoref }) {
  return (
    <div className="slider-group">
      <div className="slider-row">
        <label>Scale <span className="slider-val">{georef.scale.toFixed(4)}°/unit</span></label>
        <input
          type="range"
          min="0.0001"
          max="0.05"
          step="0.0001"
          value={georef.scale}
          onChange={(e) => setGeoref((g) => ({ ...g, scale: parseFloat(e.target.value) }))}
        />
      </div>
      <div className="slider-row">
        <label>Rotation <span className="slider-val">{georef.rotation}°</span></label>
        <input
          type="range"
          min="-180"
          max="180"
          step="1"
          value={georef.rotation}
          onChange={(e) => setGeoref((g) => ({ ...g, rotation: parseInt(e.target.value) }))}
        />
      </div>
    </div>
  );
}
