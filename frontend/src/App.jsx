import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import OverviewDashboard from './pages/OverviewDashboard';
import DecisionsInsights from './pages/DecisionsInsights';
import ScenarioSimulator from './pages/ScenarioSimulator';
import DataIntegrations from './pages/DataIntegrations';
import SystemIntelligence from './pages/SystemIntelligence';
import LoginOverlay from './components/LoginOverlay';
import { useData, DataProvider } from './context/DataContext';

const navItems = [
  { path: '/', id: 'overview', label: 'OVERVIEW' },
  { path: '/decisions', id: 'decisions', label: 'DECISIONS & INSIGHTS' },
  { path: '/simulator', id: 'simulator', label: 'SCENARIO SIMULATOR' },
  { path: '/data', id: 'data', label: 'DATA & INTEGRATIONS' },
  { path: '/intelligence', id: 'intelligence', label: 'SYSTEM INTELLIGENCE' },
];

const Sidebar = () => {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">STRATEGIC ADVISOR</div>
      <nav>
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
    </aside>
  );
};

const TopBar = ({ theme, toggleTheme }) => {
  const { userEmail, logoutUser } = useData();
  const location = useLocation();
  const currentPage = navItems.find(item => item.path === location.pathname) || navItems[0];
  const pageTitle = currentPage.label;

  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <h2 className="header-title">{pageTitle}</h2>
        <input type="text" className="search-input" placeholder="SEARCH INTELLIGENCE..." />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ borderRight: '1px solid var(--border-default)', paddingRight: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.6rem', opacity: 0.5, fontWeight: '800' }}>CONNECTED</div>
                <div style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--accent-primary)' }}>{userEmail}</div>
            </div>
            <button onClick={logoutUser} style={{ background: 'none', border: '1px solid var(--border-default)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.6rem', padding: '4px 8px' }}>LOGOUT</button>
        </div>
        <button className="theme-toggle" onClick={toggleTheme}>{theme === 'light' ? 'DARK' : 'LIGHT'}</button>
        <div className="avatar">{userEmail ? userEmail[0].toUpperCase() : 'U'}</div>
      </div>
    </header>
  );
};

function AppContent() {
  const { userEmail } = useData();
  const [theme, setTheme] = useState('light');

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
  }, []);

  if (!userEmail) return <LoginOverlay theme={theme} toggleTheme={toggleTheme} />;

  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        <TopBar theme={theme} toggleTheme={toggleTheme} />
        <div className="content-area">
          <Routes>
            <Route path="/" element={<OverviewDashboard />} />
            <Route path="/decisions" element={<DecisionsInsights />} />
            <Route path="/simulator" element={<ScenarioSimulator />} />
            <Route path="/data" element={<DataIntegrations />} />
            <Route path="/intelligence" element={<SystemIntelligence />} />
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
