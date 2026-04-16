import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">Trackmapgic</Link>
      <div className="navbar-links">
        {user ? (
          <>
            <Link to="/dashboard">My Maps</Link>
            <span className="navbar-user">{user.name}</span>
            <button onClick={handleLogout} className="btn-secondary">Logout</button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register"><button className="btn-primary">Get started</button></Link>
          </>
        )}
      </div>
    </nav>
  );
}
