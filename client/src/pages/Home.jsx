import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Home.css';

export default function Home() {
  const { user } = useAuth();

  return (
    <main className="home">
      <section className="hero">
        <h1>Draw and share your tracks</h1>
        <p>Trackmapgic lets you create, save, and export GPS track maps in GeoJSON and GPX formats.</p>
        <div className="hero-actions">
          {user ? (
            <Link to="/maps/new"><button className="btn-primary hero-btn">New map</button></Link>
          ) : (
            <>
              <Link to="/register"><button className="btn-primary hero-btn">Get started free</button></Link>
              <Link to="/login"><button className="btn-secondary hero-btn">Login</button></Link>
            </>
          )}
        </div>
      </section>

      <section className="features">
        {[
          { icon: '🗺️', title: 'Interactive drawing', desc: 'Draw polylines and shapes directly on the map.' },
          { icon: '💾', title: 'Save & manage', desc: 'Your maps are stored in your account and accessible anywhere.' },
          { icon: '📤', title: 'Export anywhere', desc: 'Download your tracks as GeoJSON or GPX for use in any GPS device or app.' },
        ].map((f) => (
          <div key={f.title} className="feature-card">
            <span className="feature-icon">{f.icon}</span>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
