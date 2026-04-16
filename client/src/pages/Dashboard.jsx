import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import './Dashboard.css';

export default function Dashboard() {
  const [maps, setMaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/maps')
      .then((res) => setMaps(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id) {
    if (!confirm('Delete this map?')) return;
    await api.delete(`/maps/${id}`);
    setMaps((prev) => prev.filter((m) => m._id !== id));
  }

  function handleExport(id, format) {
    window.open(`/api/maps/${id}/export?format=${format}`, '_blank');
  }

  return (
    <main className="dashboard">
      <div className="dashboard-header">
        <h1>My Maps</h1>
        <Link to="/maps/new"><button className="btn-primary">+ New map</button></Link>
      </div>

      {loading && <p className="muted">Loading…</p>}

      {!loading && maps.length === 0 && (
        <div className="empty-state">
          <p>No maps yet.</p>
          <Link to="/maps/new"><button className="btn-primary">Create your first map</button></Link>
        </div>
      )}

      <div className="maps-grid">
        {maps.map((map) => (
          <div key={map._id} className="map-card">
            <div className="map-card-body">
              <h3>{map.name}</h3>
              {map.description && <p className="map-desc">{map.description}</p>}
              <p className="map-date">{new Date(map.updatedAt).toLocaleDateString()}</p>
            </div>
            <div className="map-card-actions">
              <button className="btn-secondary" onClick={() => navigate(`/maps/${map._id}`)}>Edit</button>
              <button className="btn-secondary" onClick={() => handleExport(map._id, 'geojson')}>GeoJSON</button>
              <button className="btn-secondary" onClick={() => handleExport(map._id, 'gpx')}>GPX</button>
              <button className="btn-danger" onClick={() => handleDelete(map._id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
