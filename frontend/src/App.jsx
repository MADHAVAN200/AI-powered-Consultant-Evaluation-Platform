import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import AdminDashboard from './pages/AdminDashboard';
import AdminEvaluation from './pages/AdminEvaluation';
import AdminResults from './pages/AdminResults';
import CandidateDashboard from './pages/CandidateDashboard';
import CandidateCaseStudies from './pages/CandidateCaseStudies';
import CandidateResults from './pages/CandidateResults';
import CandidateAssessment from './pages/CandidateAssessment';
import LoginOverlay from './components/LoginOverlay';
import { useData, DataProvider } from './context/DataContext';

const getSystemTheme = () => (
  window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
);

const getInitialTheme = () => {
  const stored = localStorage.getItem('theme');
  if (stored === 'light' || stored === 'dark') return stored;

  const attrTheme = document.documentElement.getAttribute('data-theme');
  if (attrTheme === 'light' || attrTheme === 'dark') return attrTheme;

  return getSystemTheme();
};

const adminNavItems = [
  { path: '/admin/dashboard', id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { path: '/admin/cases', id: 'cases', label: 'Case Studies', icon: 'cases' },
  { path: '/admin/results', id: 'results', label: 'Results & Analytics', icon: 'results' }
];

const candidateNavItems = [
  { path: '/candidate/dashboard', id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { path: '/candidate/cases', id: 'cases', label: 'Case Studies', icon: 'cases' },
  { path: '/candidate/results', id: 'results', label: 'My Results', icon: 'results' }
];

const NavIcon = ({ type, color }) => {
  const icons = {
    dashboard: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>,
    cases: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>,
    results: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>,
    vm: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>,
    console: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>,
    labs: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 19a3.5 3.5 0 0 0 0-7h-1.5a7 7 0 1 0-11.76 5.33"></path></svg>,
    bank: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
  };
  return <span className={`nav-icon-wrapper ${type}`} style={{ color: color }}>{icons[type] || icons.dashboard}</span>;
};

const Sidebar = ({ navItems }) => {
  const { userEmail, logoutUser, userRole } = useData();
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">AI Consultant</div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <NavIcon type={item.icon} />
            <span className="nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-user-section">
        <div className="sidebar-user-card">
          <div className="sidebar-user-info">
            <div className="sidebar-avatar-wrapper">
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userEmail}`} alt="Avatar" className="sidebar-avatar-img" />
            </div>
            <div className="sidebar-user-details">
              <div className="sidebar-user-name">{userEmail ? userEmail.split('@')[0] : 'User'}</div>
              <div className="sidebar-user-role">{userRole?.toUpperCase() || 'ADMIN'}</div>
            </div>
            <button onClick={logoutUser} className="sidebar-logout-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};

const TopBar = ({ theme, toggleTheme }) => {
  const { userRole } = useData();
  const location = useLocation();
  const navItems = userRole === 'admin'
    ? adminNavItems
    : userRole === 'candidate'
      ? candidateNavItems
      : [{ path: '/', id: 'assessment', label: 'Consultant Evaluation', icon: 'cases' }];
  const currentPage = navItems.find(item => item.path === location.pathname) || navItems[0];
  const pageTitle = currentPage.label;

  return (
    <header className="topbar">
      <div className="topbar-pill">
        <div className="topbar-left">
          <h2 className="header-title">{pageTitle}</h2>
        </div>
        <div className="topbar-right">
          <button className="topbar-icon-btn">
             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
          </button>
          <button className="topbar-icon-btn theme-toggle-btn" onClick={toggleTheme}>
            {theme === 'light' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

function AppContent() {
  const { userEmail, userRole } = useData();
  const location = useLocation();
  const [theme, setTheme] = useState(getInitialTheme);
  const homePath = userRole === 'admin' ? '/admin/dashboard' : '/candidate/dashboard';

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (localStorage.getItem('theme')) return undefined;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e) => setTheme(e.matches ? 'dark' : 'light');

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    }

    if (typeof media.addListener === 'function') {
      media.addListener(onChange);
      return () => media.removeListener(onChange);
    }

    return undefined;
  }, []);

  // Public assessment routes (via invite links) don't require login
  const currentPath = location.pathname;
  const isPublicAssessment = currentPath.startsWith('/assess/invite/');
  const isCandidateAssessment = currentPath.startsWith('/candidate/assessment/');
  const isAssessmentRoute = isPublicAssessment || isCandidateAssessment;

  if (!userEmail && !isPublicAssessment) {
      return <LoginOverlay theme={theme} toggleTheme={toggleTheme} />;
  }

  // Determine if sidebar should be shown (Admin only)
  const showSidebar = (userRole === 'admin' || userRole === 'candidate') && !isAssessmentRoute;
  const navItems = userRole === 'admin' ? adminNavItems : userRole === 'candidate' ? candidateNavItems : [];

  return (
    <div className="app-container">
      {showSidebar && <Sidebar navItems={navItems} />}
      <main className={`main-content ${showSidebar ? '' : 'main-content-full'}`}>
        {!isAssessmentRoute && <TopBar theme={theme} toggleTheme={toggleTheme} />}
        <div className={`content-area ${isAssessmentRoute ? 'assessment-route-content' : ''}`}>
          <Routes>
            <Route path="/" element={<Navigate to={homePath} replace />} />

            <Route path="/admin/dashboard" element={userRole === 'admin' ? <AdminDashboard /> : <Navigate to={homePath} replace />} />
            <Route path="/admin/cases" element={userRole === 'admin' ? <AdminEvaluation /> : <Navigate to={homePath} replace />} />
            <Route path="/admin/results" element={userRole === 'admin' ? <AdminResults /> : <Navigate to={homePath} replace />} />

            <Route path="/candidate/dashboard" element={userRole === 'candidate' ? <CandidateDashboard /> : <Navigate to={homePath} replace />} />
            <Route path="/candidate/cases" element={userRole === 'candidate' ? <CandidateCaseStudies /> : <Navigate to={homePath} replace />} />
            <Route path="/candidate/results" element={userRole === 'candidate' ? <CandidateResults /> : <Navigate to={homePath} replace />} />
            <Route path="/candidate/assessment/:caseStudyId" element={<CandidateAssessment isDirectCase={true} />} />

            <Route path="/assess/invite/:inviteId" element={<CandidateAssessment />} />
            <Route path="*" element={<Navigate to={homePath} replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <DataProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </DataProvider>
  );
}

export default App;
