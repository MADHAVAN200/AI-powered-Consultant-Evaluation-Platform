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
  { path: '/admin/dashboard', id: 'dashboard', label: 'DASHBOARD' },
  { path: '/admin/cases', id: 'cases', label: 'CASE STUDIES' },
  { path: '/admin/results', id: 'results', label: 'RESULTS & ANALYTICS' }
];

const candidateNavItems = [
  { path: '/candidate/dashboard', id: 'candidate-dashboard', label: 'CANDIDATE DASHBOARD' },
  { path: '/candidate/cases', id: 'candidate-cases', label: 'CASE STUDIES' },
  { path: '/candidate/results', id: 'candidate-results', label: 'MY RESULTS' }
];

const Sidebar = ({ navItems }) => {
  const { userEmail, logoutUser } = useData();
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">AI-POWERED CONSULTANT</div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-user-section">
        <div className="sidebar-user-info">
          <div className="sidebar-avatar">{userEmail ? userEmail[0].toUpperCase() : 'U'}</div>
          <div className="sidebar-user-details">
            <div className="sidebar-label">CONNECTED</div>
            <div className="sidebar-email">{userEmail}</div>
          </div>
        </div>
        <button onClick={logoutUser} className="sidebar-logout">LOGOUT</button>
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
      : [{ path: '/', id: 'assessment', label: 'CONSULTANT EVALUATION' }];
  const currentPage = navItems.find(item => item.path === location.pathname) || navItems[0];
  const pageTitle = currentPage.label;

  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <h2 className="header-title">{pageTitle}</h2>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button className="theme-toggle" onClick={toggleTheme}>{theme === 'light' ? 'DARK' : 'LIGHT'}</button>
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
  const isAdminCasesRoute = currentPath === '/admin/cases';

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
        {!isAssessmentRoute && !isAdminCasesRoute && <TopBar theme={theme} toggleTheme={toggleTheme} />}
        <div className={`content-area ${isAssessmentRoute ? 'assessment-route-content' : ''} ${isAdminCasesRoute ? 'admin-cases-route-content' : ''}`}>
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
