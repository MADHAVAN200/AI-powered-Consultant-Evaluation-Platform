import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import OverviewDashboard from './pages/OverviewDashboard';
import DecisionsInsights from './pages/DecisionsInsights';
import ScenarioSimulator from './pages/ScenarioSimulator';
import DataIntegrations from './pages/DataIntegrations';
import SystemIntelligence from './pages/SystemIntelligence';
import LoginOverlay from './components/LoginOverlay';
import { useData } from './context/DataContext';

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
            style={{ textDecoration: 'none', display: 'flex', cursor: 'pointer', textAlign: 'left', fontSize: '0.75rem', fontWeight: '800', letterSpacing: '0.05em' }}
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
  
  // Find current page label based on path
  const currentPage = navItems.find(item => item.path === location.pathname) || navItems[0];
  const pageTitle = currentPage.label;

  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <h2 className="header-title" style={{ fontSize: '0.9rem', fontWeight: '900', letterSpacing: '0.05em' }}>{pageTitle}</h2>
        <input 
          type="text"
          className="search-input"
          placeholder="SEARCH INTELLIGENCE..."
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderRight: '1px solid var(--border-default)', paddingRight: '16px', marginRight: '4px' }}>
            <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: '900', opacity: 0.5, letterSpacing: '0.1em' }}>LOGGED_IN_AS</div>
                <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--accent-primary)' }}>{userEmail}</div>
            </div>
            <button 
                onClick={logoutUser}
                style={{ background: 'none', border: '1px solid var(--border-default)', borderRadius: '4px', color: 'var(--text-secondary)', fontSize: '0.6rem', padding: '4px 8px', cursor: 'pointer', fontWeight: '800' }}
            >
                LOGOUT
            </button>
        </div>
        <button className="theme-toggle" onClick={toggleTheme} style={{ fontSize: '0.7rem', fontWeight: '800', padding: '6px 12px' }}>
          {theme === 'light' ? 'DARK MODE' : 'LIGHT MODE'}
        </button>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '0.75rem' }}>
          {userEmail ? userEmail[0].toUpperCase() : 'MD'}
        </div>
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

import { DataProvider } from './context/DataContext';

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
