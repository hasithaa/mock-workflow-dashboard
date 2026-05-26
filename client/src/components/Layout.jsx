import { NavLink } from 'react-router-dom';
import ConfigBar from './ConfigBar';

export default function Layout({ children }) {
  return (
    <div className="app">
      <ConfigBar />
      <div className="app-body">
        <nav className="sidebar">
          <NavLink to="/definitions" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="nav-icon">⚡</span> Definitions
          </NavLink>
          <NavLink to="/search" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="nav-icon">🔍</span> Search
          </NavLink>
        </nav>
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
