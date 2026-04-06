import React from 'react';
import { useData } from '../context/DataContext';

const MARKET_EVENTS = [
  { id: 'oil-spike', label: 'Oil Price Hike (+25%)', color: '#ff4d4f', description: 'Logistics inflation & OpEx spike.' },
  { id: 'market-crash', label: 'Market Volatility', color: '#fa8c1f', description: 'Consumer demand contraction.' },
  { id: 'tax-update', label: 'New GST Update', color: '#1890ff', description: 'Compliance & audit required.' },
];

const MarketSimulator = () => {
  const { globalSignals, toggleSignal } = useData();
  const toggleEvent = (event) => {
    toggleSignal({
        id: event.id,
        type: 'MACRO',
        event: event.label,
        severity: 'High',
        impact: event.description
    });
  };

  return (
    <div className="panel" style={{ padding: '20px' }}>
      <header style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '0.75rem', fontWeight: '900', letterSpacing: '0.1em' }}>[GLOBAL_SIMULATOR]</h3>
        <span className="badge badge-low" style={{ fontSize: '0.6rem' }}>ALPHA ENGINE</span>
      </header>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {MARKET_EVENTS.map(event => {
          const isActive = globalSignals.some(s => s.id === event.id);
          return (
            <div 
              key={event.id}
              onClick={() => toggleEvent(event)}
              style={{ 
                padding: '12px', 
                borderRadius: '8px', 
                background: isActive ? 'rgba(24, 144, 255, 0.1)' : 'var(--bg-subtle)',
                border: `1px solid ${isActive ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '800', color: isActive ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                   {event.label}
                </span>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: event.color, opacity: isActive ? 1 : 0.3 }}></div>
              </div>
              <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', margin: 0 }}>
                {event.description}
              </p>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: '16px', padding: '10px', borderRadius: '6px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)', fontSize: '0.6rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
         Note: Triggering macro events will immediately update the Intelligence Layer recommendations.
      </div>
    </div>
  );
};

export default MarketSimulator;
