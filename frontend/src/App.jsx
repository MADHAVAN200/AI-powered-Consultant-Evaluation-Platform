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
  const [theme, setTheme] = useState('light');

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
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
            {userRole === 'admin' ? (
                <>
                    <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
                    <Route path="/admin/dashboard" element={<AdminDashboard />} />
                    <Route path="/admin/cases" element={<AdminEvaluation />} />
                    <Route path="/admin/results" element={<AdminResults />} />
                    <Route path="/assess/invite/:inviteId" element={<CandidateAssessment />} />
                </>
            ) : (
                <>
                <Route path="/" element={<Navigate to="/candidate/dashboard" replace />} />
                <Route path="/candidate/dashboard" element={<CandidateDashboard />} />
                <Route path="/candidate/cases" element={<CandidateCaseStudies />} />
                <Route path="/candidate/results" element={<CandidateResults />} />
                <Route path="/candidate/assessment/:caseStudyId" element={<CandidateAssessment isDirectCase={true} />} />
                    <Route path="/assess/invite/:inviteId" element={<CandidateAssessment />} />
                </>
            )}
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
