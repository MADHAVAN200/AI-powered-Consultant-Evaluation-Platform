import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dataHealthMetrics } from '../data/DashboardData';
import DataPushSidebar from '../components/DataPushSidebar';
import DataDetailSidebar from '../components/DataDetailSidebar';
import { useData } from '../context/DataContext';

const DataIntegrations = () => {
  const { globalSignals, historicalMetrics, userEmail, deleteSnapshot } = useData();
  const [isPushSidebarOpen, setIsPushSidebarOpen] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState(null);

  const handleCardClick = (snapshot) => {
    setSelectedSnapshot(snapshot);
  };

  const handleDelete = (e, id) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this intelligence snapshot?')) {
        deleteSnapshot(id);
    }
  };

  return (
    <div className="integrations-container" style={{ position: 'relative', overflowY: 'auto' }}>
      
      {/* LEFT: Primary Content Area (Live Intelligence Feeds) */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>

        {/* Controls Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '800', letterSpacing: '0.05em' }}>INTELLIGENCE STREAM CONTROL</h2>
            <p style={{ fontSize: '0.75rem', opacity: 0.6 }}>Connected Session: {userEmail}</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button style={{ padding: '8px 16px', border: '1px solid var(--border-default)', borderRadius: '8px', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '0.7rem', fontWeight: '600', cursor: 'pointer' }}>
              SCHEMA CONFIG
            </button>
            <button style={{ padding: '8px 16px', border: 'none', borderRadius: '8px', background: 'var(--accent-primary)', color: 'white', fontSize: '0.7rem', fontWeight: '600', cursor: 'pointer' }}>
              RE-SYNC CLOUD
            </button>
          </div>
        </div>

        {/* COMPARATIVE FEEDS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>

          {/* Local Feed */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '10px', letterSpacing: '0.05em' }}>
                <span style={{ color: 'var(--accent-primary)' }}>[LOCAL_FEED]</span> ENTERPRISE SNAPSHOTS
              </h3>
              <span className="badge badge-low" style={{ padding: '4px 10px' }}>{historicalMetrics.length} SNAPSHOTS SYNCED</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {historicalMetrics.map((metric, idx) => (
                <div 
                  key={metric.id || idx} 
                  className="source-card clickable" 
                  onClick={() => handleCardClick(metric)}
                  style={{ padding: '20px', borderLeft: `5px solid var(--accent-primary)`, position: 'relative', cursor: 'pointer' }}
                >
                  {/* Delete Icon */}
                  <div 
                    onClick={(e) => handleDelete(e, metric.id)}
                    style={{ position: 'absolute', top: '16px', right: '16px', color: '#ff4d4f', fontSize: '1rem', opacity: 0.6, cursor: 'pointer', transition: 'opacity 0.2s', zIndex: 10 }}
                    onMouseEnter={(e) => e.target.style.opacity = '1'}
                    onMouseLeave={(e) => e.target.style.opacity = '0.6'}
                    title="Delete Snapshot"
                  >
                    🗑️
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', paddingRight: '24px' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: '900', color: 'var(--accent-primary)', letterSpacing: '0.1em' }}>[ERP_SNAPSHOT]</span>
                    <span style={{ fontSize: '0.65rem', opacity: 0.6 }}>{new Date(metric.created_at).toLocaleString()}</span>
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '800', marginBottom: '12px' }}>{metric.scenario_name?.toUpperCase() || 'MANUAL UPLOAD'}</div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                    <div>
                        <div style={{ fontSize: '0.6rem', opacity: 0.5, fontWeight: '800' }}>REVENUE</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: '800' }}>₹{(metric.revenue / 10000000).toFixed(1)} Cr</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.6rem', opacity: 0.5, fontWeight: '800' }}>MARGIN</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: '800', color: '#52c41a' }}>{metric.margin}%</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ flex: 1, padding: '8px', fontSize: '0.6rem', backgroundColor: 'var(--bg-subtle)', borderRadius: '4px', opacity: 0.7, fontWeight: '800', textAlign: 'center' }}>
                      CLICK FOR DATASET ➔
                    </div>
                  </div>
                </div>
              ))}
              {historicalMetrics.length === 0 && (
                <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', border: '1px dashed var(--border-default)', borderRadius: '12px', opacity: 0.5 }}>
                  No enterprise snapshots detected in Supabase. Upload a CSV to begin streaming.
                </div>
              )}
            </div>
          </div>

          {/* Global Feed */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '10px', letterSpacing: '0.05em' }}>
                <span style={{ color: '#ff4d4f' }}>[GLOBAL_FEED]</span> MACRO INTELLIGENCE
              </h3>
              <span className="badge badge-critical" style={{ padding: '4px 10px', backgroundColor: '#ff4d4f', color: 'white' }}>LIVE SIGNALS</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {globalSignals.map(signal => (
                <div key={signal.id} className="source-card" style={{ padding: '20px', borderLeft: `5px solid #ff4d4f` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: '900', color: '#ff4d4f', letterSpacing: '0.1em' }}>[{signal.type?.toUpperCase()}]</span>
                    <span className="badge badge-high" style={{ fontSize: '0.55rem' }}>ACTIVE</span>
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '800', marginBottom: '8px' }}>{signal.event}</div>
                  <p style={{ fontSize: '0.75rem', opacity: 0.8, lineHeight: '1.4', margin: 0 }}>{signal.impact}</p>
                </div>
              ))}
              {globalSignals.length === 0 && (
                 <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', border: '1px dashed var(--border-default)', borderRadius: '12px', opacity: 0.5 }}>
                    Searching market intelligence streams... No active alerts detected.
                 </div>
              )}
            </div>
          </div>

        </div>
      </section>

      {/* RIGHT SIDEBAR */}
      <aside style={{ display: 'flex', flexDirection: 'column', gap: '24px', minWidth: '340px' }}>
        <div className="upload-zone" onClick={() => setIsPushSidebarOpen(true)} style={{ background: 'var(--bg-card)', padding: '24px', border: '1px solid var(--border-default)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: '900', marginBottom: '12px', color: 'var(--accent-primary)', letterSpacing: '0.1em' }}>[CORE_INTEGRATIONS]</div>
          <div style={{ fontWeight: '800', fontSize: '1rem', marginBottom: '8px' }}>INGEST NEW DATASET</div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>Sync your enterprise software or upload a high-density CSV (50+ rows recommended).</p>
          <div style={{ marginTop: '20px', padding: '12px', borderRadius: '8px', background: 'var(--accent-primary)', color: 'white', fontSize: '0.75rem', fontWeight: '900', textAlign: 'center' }}>
            START INGESTION ➔
          </div>
        </div>

        <div className="panel" style={{ flex: 1 }}>
          <header className="panel-header">
            <span>Data Health Matrix</span>
            <span style={{ fontSize: '0.65rem', backgroundColor: '#52c41a', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>TRUSTED</span>
          </header>
          <div className="panel-content">
            {dataHealthMetrics.map(metric => (
              <div key={metric.id} className="list-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '700' }}>{metric.name}</div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: '800' }}>{metric.value}</div>
                  <div style={{ fontSize: '0.55rem', color: metric.status === 'Good' ? '#52c41a' : '#fa8c1f', fontWeight: '900' }}>{metric.status.toUpperCase()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {isPushSidebarOpen && (
        <DataPushSidebar onClose={() => setIsPushSidebarOpen(false)} />
      )}

      {selectedSnapshot && (
        <DataDetailSidebar 
          data={selectedSnapshot} 
          onClose={() => setSelectedSnapshot(null)} 
        />
      )}

    </div>
  );
};

export default DataIntegrations;
