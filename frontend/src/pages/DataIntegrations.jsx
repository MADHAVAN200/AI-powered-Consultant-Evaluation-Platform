import React, { useState } from 'react';
import { dataSources, dataHealthMetrics, globalEvents, localCompanyEvents } from '../data/DashboardData';
import DataPushSidebar from '../components/DataPushSidebar';

const DataIntegrations = () => {
  const [isPushSidebarOpen, setIsPushSidebarOpen] = useState(false);

  return (
    <div className="integrations-container" style={{ position: 'relative', overflowY: 'auto' }}>
      
      {/* LEFT: Primary Content Area (Live Intelligence Feeds) */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>

        {/* Controls Bar - Right Aligned */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button style={{ padding: '8px 16px', border: '1px solid var(--border-default)', borderRadius: '8px', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '0.7rem', fontWeight: '600', cursor: 'pointer', letterSpacing: '0.05em' }}>
              SCHEMA CONFIG
            </button>
            <button style={{ padding: '8px 16px', border: 'none', borderRadius: '8px', background: 'var(--accent-primary)', color: 'white', fontSize: '0.7rem', fontWeight: '600', cursor: 'pointer', letterSpacing: '0.05em' }}>
              GLOBAL SYNC
            </button>
          </div>
        </div>

        {/* COMPARATIVE FEEDS: Tiled Format */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>

          {/* Local Company Data Feed */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '10px', letterSpacing: '0.05em' }}>
                <span style={{ color: 'var(--accent-primary)' }}>[LOCAL_FEED]</span> ENTERPRISE DATA STREAM
              </h3>
              <span className="badge badge-low" style={{ padding: '4px 10px' }}>LIVE STREAM</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
              {localCompanyEvents.map(event => (
                <div key={event.id} className="source-card" style={{ padding: '16px', height: 'auto', borderLeft: `5px solid ${event.outcome === 'Complete' || event.outcome === 'Verified' || event.outcome === 'Matched' ? '#52c41a' : event.outcome === 'In-Progress' ? '#1890ff' : '#fa8c1f'}`, borderTop: 'none', borderRight: 'none', borderBottom: 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{event.type}</span>
                    <span style={{ fontSize: '0.7rem', opacity: 0.85 }}>{event.timestamp}</span>
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '8px' }}>{event.event}</div>
                  <div className={`badge badge-${event.outcome === 'Complete' || event.outcome === 'Verified' || event.outcome === 'Matched' ? 'low' : event.outcome === 'In-Progress' ? 'medium' : 'high'}`} style={{ fontSize: '0.65rem', width: 'fit-content' }}>
                    {event.outcome}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Global News Feed */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '10px', letterSpacing: '0.05em' }}>
                <span style={{ color: 'var(--accent-primary)' }}>[GLOBAL_FEED]</span> MARKET INTELLIGENCE STREAM
              </h3>
              <span className="badge badge-critical" style={{ padding: '4px 10px', backgroundColor: '#ff4d4f', color: 'white' }}>MACRO ALERT</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
              {globalEvents.map(event => (
                <div key={event.id} className="source-card" style={{ padding: '16px', height: 'auto', borderLeft: `5px solid ${event.severity === 'Critical' ? '#ff4d4f' : event.severity === 'High' ? '#fa8c1f' : '#1890ff'}`, borderTop: 'none', borderRight: 'none', borderBottom: 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--accent-primary)', textTransform: 'uppercase' }}>{event.type}</span>
                    <span className={`badge badge-${event.severity.toLowerCase()}`} style={{ fontSize: '0.65rem' }}>{event.severity}</span>
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '8px' }}>{event.event}</div>
                  <div style={{ fontSize: '0.75rem', opacity: 1, lineHeight: '1.4', color: 'var(--text-secondary)' }}>{event.impact}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* RIGHT: System Health & Connection Hub */}
      <aside style={{ display: 'flex', flexDirection: 'column', gap: '24px', minWidth: '340px' }}>

        {/* Connection Trigger Card */}
        <div className="upload-zone" onClick={() => setIsPushSidebarOpen(true)} style={{ borderStyle: 'solid', borderWidth: '1px', borderColor: 'var(--border-default)', background: 'var(--bg-card)', padding: '24px' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: '900', marginBottom: '12px', color: 'var(--accent-primary)', letterSpacing: '0.1em' }}>[INTEGRATION_HUB]</div>
          <div style={{ fontWeight: '800', fontSize: '1rem', marginBottom: '8px' }}>CORE DATA CONNECTIVITY</div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>Synchronize SAP, Salesforce, ORACLE and other enterprise software directly with the Strategic Advisory Engine.</p>
          <div style={{ marginTop: '20px', padding: '10px', borderRadius: '8px', background: 'var(--accent-primary)', color: 'white', fontSize: '0.75rem', fontWeight: '900', textAlign: 'center', letterSpacing: '0.05em' }}>
            ESTABLISH CONNECTION ➔
          </div>
        </div>

        {/* Data Health Status */}
        <div className="panel" style={{ flex: 1 }}>
          <header className="panel-header">
            <span>Data Health Matrix</span>
            <span style={{ fontSize: '0.65rem', backgroundColor: '#52c41a', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>TRUSTED</span>
          </header>
          <div className="panel-content" style={{ padding: '0' }}>
            {dataHealthMetrics.map(metric => (
              <div key={metric.id} className="list-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{metric.name}</div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: '700' }}>{metric.value}</div>
                  <div style={{ fontSize: '0.6rem', color: metric.status === 'Good' ? '#52c41a' : metric.status === 'Normal' ? '#fa8c1f' : '#ff4d4f', fontWeight: '700' }}>{metric.status.toUpperCase()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {isPushSidebarOpen && (
        <DataPushSidebar onClose={() => setIsPushSidebarOpen(false)} />
      )}

    </div>
  );
};

export default DataIntegrations;
