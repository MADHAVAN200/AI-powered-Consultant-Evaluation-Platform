import React, { useState } from 'react';
import { globalEvents, healthMetrics, aiInsights, topRecommendations } from '../data/DashboardData';
import IntelligenceSidebar from '../components/IntelligenceSidebar';

const OverviewDashboard = () => {
  const [selectedItem, setSelectedItem] = useState(null);
  const [sidebarType, setSidebarType] = useState(null);

  const openSidebar = (item, type) => {
    setSelectedItem(item);
    setSidebarType(type);
  };

  const closeSidebar = () => {
    setSelectedItem(null);
    setSidebarType(null);
  };

  return (
    <div className="dashboard-grid">
      
      {/* COLUMN 1: India Economic Feed (A) */}
      <section className="panel">
        <header className="panel-header">
          <span>India Economic Feed</span>
          <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>20 Events</span>
        </header>
        <div className="panel-content">
          {globalEvents.map(event => (
            <div key={event.id} className="list-item" onClick={() => openSidebar(event, 'event')} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: '600', color: 'var(--text-secondary)' }}>{event.type}</span>
                <span className={`badge badge-${event.severity.toLowerCase()}`}>{event.severity}</span>
              </div>
              <div style={{ fontWeight: '600', fontSize: '0.85rem', marginBottom: '4px' }}>{event.event}</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Impact: {event.impact}</div>
            </div>
          ))}
        </div>
      </section>

      {/* COLUMN 2: Performance & Health (B & C) */}
      <section className="panel" style={{ backgroundColor: 'transparent', border: 'none', boxShadow: 'none' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
          
          {/* Health Score Panel (B) */}
          <div className="panel" style={{ flex: '0 0 auto' }}>
            <header className="panel-header">
              <span>Company Health Score</span>
            </header>
            <div className="panel-content" style={{ display: 'flex', alignItems: 'center', gap: '24px', padding: '24px' }}>
              <div style={{ position: 'relative', width: '100px', height: '100px', borderRadius: '50%', border: '8px solid #52c41a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '2rem', fontWeight: '800' }}>72</span>
                <div style={{ position: 'absolute', bottom: '-10px', backgroundColor: 'var(--bg-default)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.65rem', border: '1px solid var(--border-default)' }}>MODERATE</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '4px' }}>Trend: <span style={{ color: '#ff4d4f' }}>Declining</span></div>
                <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>Primary Strain: Margin compression due to logistics inflation.</div>
              </div>
            </div>
          </div>

          {/* KPI Trends Panel (C) */}
          <div className="panel" style={{ flex: 1 }}>
            <header className="panel-header">
              <span>KPI Metrics</span>
              <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>20 Metrics</span>
            </header>
            <div className="panel-content">
              <div className="kpi-row">
                {healthMetrics.map((kpi, idx) => (
                  <div key={idx} className="kpi-card" onClick={() => openSidebar(kpi, 'kpi')} style={{ cursor: 'pointer' }}>
                    <div className="kpi-name">{kpi.name}</div>
                    <div className="kpi-value">
                      {kpi.value}
                      <span style={{ marginLeft: '4px', fontSize: '0.6rem', fontWeight: '900' }} className={`trend-${kpi.trend}`}>
                        ({kpi.trend.toUpperCase()})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* COLUMN 3: AI Intelligence (D & E) */}
      <section className="panel" style={{ backgroundColor: 'transparent', border: 'none', boxShadow: 'none' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
          
          {/* AI Insights (D) */}
          <div className="panel" style={{ flex: 1 }}>
            <header className="panel-header">
              <span>AI Reasoning Agents</span>
            </header>
            <div className="panel-content">
              {aiInsights.map((insight) => (
                <div key={insight.id} className="list-item" onClick={() => openSidebar(insight, 'agent')} style={{ fontSize: '0.8rem', padding: '10px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.6rem', fontWeight: '900', color: 'var(--accent-primary)', opacity: 0.8 }}>[AGENT]</span>
                  {insight.title}
                </div>
              ))}
            </div>
          </div>

          {/* Top Recommendations (E) */}
          <div className="panel" style={{ flex: 1.2 }}>
            <header className="panel-header" style={{ color: 'var(--accent-primary)' }}>
              <span>Top Recommendations</span>
            </header>
            <div className="panel-content">
              {topRecommendations.map((rec) => (
                <div key={rec.id || rec.decision} className="list-item" onClick={() => openSidebar(rec, 'recommendation')} style={{ borderBottom: '1px solid var(--border-default)', cursor: 'pointer' }}>
                  <div style={{ fontWeight: '700', fontSize: '0.85rem', marginBottom: '4px' }}>{rec.decision}</div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: '#52c41a', fontWeight: '600' }}>{rec.impact}</span>
                    <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>Conf: {rec.confidence}</span>
                    <span className={`badge badge-${rec.risk === 'Low' ? 'low' : rec.risk === 'Med' ? 'medium' : 'high'}`}>{rec.risk} RISK</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Intelligence Sidebar */}
      {selectedItem && (
        <IntelligenceSidebar 
          item={selectedItem} 
          type={sidebarType} 
          onClose={closeSidebar} 
        />
      )}

    </div>
  );
};

export default OverviewDashboard;
