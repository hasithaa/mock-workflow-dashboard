import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import ConfigBar from './ConfigBar';
import { getPendingCount, USER_CONTEXT_CHANGED_EVENT } from '../api/managementApi';
import { PORTAL_STORAGE_KEY } from '../utils/portalView';

function usePendingCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const load = () => getPendingCount().then(d => setCount(d.count ?? 0)).catch(() => {});
    load();
    const onUserContextChanged = () => load();
    window.addEventListener(USER_CONTEXT_CHANGED_EVENT, onUserContextChanged);
    const id = setInterval(load, 15000);
    return () => {
      clearInterval(id);
      window.removeEventListener(USER_CONTEXT_CHANGED_EVENT, onUserContextChanged);
    };
  }, []);
  return count;
}

const navCls = ({ isActive }) => `nav-item${isActive ? ' active' : ''}`;
function derivePortalFromPath(pathname) {
  if (pathname.startsWith('/tasks')) {
    return 'user';
  }
  if (pathname.startsWith('/review-failures')) {
    return 'admin';
  }
  return null;
}

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const pendingCount = usePendingCount();
  const [portal, setPortal] = useState(() => localStorage.getItem(PORTAL_STORAGE_KEY) || 'admin');

  useEffect(() => {
    const derivedPortal = derivePortalFromPath(location.pathname);
    if (derivedPortal && derivedPortal !== portal) {
      setPortal(derivedPortal);
      localStorage.setItem(PORTAL_STORAGE_KEY, derivedPortal);
    }
  }, [location.pathname, portal]);

  const switchPortal = (nextPortal) => {
    if (nextPortal === portal) {
      return;
    }
    setPortal(nextPortal);
    localStorage.setItem(PORTAL_STORAGE_KEY, nextPortal);
    if (nextPortal === 'admin') {
      navigate('/definitions');
      return;
    }
    navigate('/tasks/pending');
  };

  return (
    <div className="app">
      <ConfigBar />
      <div className="app-body">
        <nav className="sidebar">
          <div className="portal-tabs">
            <button
              className={`portal-tab-btn${portal === 'admin' ? ' active' : ''}`}
              onClick={() => switchPortal('admin')}
            >
              Admin Console
            </button>
            <button
              className={`portal-tab-btn${portal === 'user' ? ' active' : ''}`}
              onClick={() => switchPortal('user')}
            >
              User Portal
            </button>
          </div>

          {portal === 'admin' && (
            <>
              <div className="sidebar-section-label">Instance Management</div>
              <NavLink to="/definitions" className={navCls}>
                <span className="nav-icon">⬡</span> Definitions
              </NavLink>
              <NavLink to="/search" className={navCls}>
                <span className="nav-icon">🔍</span> Search
              </NavLink>
              <NavLink to="/workflows/recent" className={navCls}>
                <span className="nav-icon">⏱</span> Recent
              </NavLink>
              <NavLink to="/workflows/active" className={navCls}>
                <span className="nav-icon">▶</span> Active
              </NavLink>

              <div className="sidebar-section-label">Error Handling</div>
              <NavLink to="/review-failures" className={navCls}>
                <span className="nav-icon">⚠</span> Review Failures
              </NavLink>
            </>
          )}

          {portal === 'user' && (
            <>
              <div className="sidebar-section-label">Workflow Initiation</div>
              <NavLink to="/definitions" className={navCls}>
                <span className="nav-icon">⬡</span> Start Workflow
              </NavLink>

              <div className="sidebar-section-label">Task Visibility</div>
              <NavLink to="/tasks/pending" className={navCls}>
                <span className="nav-icon">⏳</span> Pending
                {pendingCount > 0 && <span className="nav-badge">{pendingCount}</span>}
              </NavLink>
              <NavLink to="/tasks/completed" className={navCls}>
                <span className="nav-icon">✓</span> Completed
              </NavLink>
              <NavLink to="/tasks" end className={navCls}>
                <span className="nav-icon">📋</span> All Tasks
              </NavLink>
              <NavLink to="/tasks/search" className={navCls}>
                <span className="nav-icon">🔍</span> Search Tasks
              </NavLink>
            </>
          )}
        </nav>
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
