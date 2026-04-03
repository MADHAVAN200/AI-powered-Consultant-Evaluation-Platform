import React, { useState } from 'react';
import { decisionHistory, modelMetrics, strategyInsights } from '../data/DashboardData';
import DecisionEvolutionSidebar from '../components/DecisionEvolutionSidebar';

const SystemIntelligence = () => {
  const [selectedDecision, setSelectedDecision] = useState(null);

  const getOutcomeColor = (outcome) => {
    switch (outcome) {
      case 'Success': case 'Positive': case 'Improved': case 'Successful': return '#52c41a';
      case 'Mixed': case 'Neutral': case 'Stable': return '#fa8c1f';
      case 'Negative': case 'Failed': return '#ff4d4f';
      default: return 'var(--text-secondary)';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: 'calc(100vh - 120px)' }}>
      
      {/* Top Banner: Evolutionary Progress */}
      <section style={{ display: 'flex', gap: '20px' }}>
        <div className="panel" style={{ flex: 1, padding: '20px', background: 'linear-gradient(135deg, var(--accent-primary) 0%, #003a8c 100%)', color: 'white', border: 'none' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '700', opacity: 0.8, textTransform: 'uppercase', marginBottom: '8px' }}>Total Economic Value Generated (Reward)</div>
          <div style={{ fontSize: '2.5rem', fontWeight: '800' }}>₹48.2 Cr</div>
          <div style={{ fontSize: '0.85rem', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '4px' }}>Level 84 Intelligence</span>
            <span>Evolutionary Gain: +12.4% this quarter</span>
          </div>
        </div>
        <div className="panel" style={{ flex: 0.6, padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px' }}>Model Learning Rate</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>0.0012 <span style={{ fontSize: '0.9rem', color: '#52c41a' }}>● Optimized</span></div>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '8px' }}>The model has reached a high-stability convergence state across 1.2M decision parameters.</p>
        </div>
      </section>

      {/* Main Split: History vs Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', flex: 1, overflow: 'hidden' }}>
        
        {/* LEFT: Decision History */}
        <section className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <header className="panel-header">
            <span>Decision Evolution Log</span>
            <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>20 Historical Actions</span>
          </header>
          <div className="panel-content">
            {decisionHistory.map(item => (
              <div 
                key={item.id} 
                className="list-item" 
                onClick={() => setSelectedDecision(item)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s ease' }}
              >
                <div>
                  <div style={{ fontWeight: '700', fontSize: '0.85rem' }}>{item.action || item.name}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Outcome: <span style={{ color: getOutcomeColor(item.outcome), fontWeight: '700' }}>{item.outcome.toUpperCase()}</span></div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: '600', color: getOutcomeColor(item.outcome) }}>{item.impact}</div>
                  <div style={{ fontSize: '0.65rem', opacity: 0.6 }}>{item.date}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* RIGHT: Model Diagnostics */}
        <section className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <header className="panel-header">
            <span>Intelligence Health Matrix</span>
            <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>20 Diagnostics</span>
          </header>
          <div className="panel-content">
             <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
               {modelMetrics.map(metric => (
                 <div key={metric.id} className="kpi-card" style={{ padding: '12px' }}>
                   <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>{metric.name}</div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                     <div style={{ fontSize: '1rem', fontWeight: '800' }}>{metric.value}</div>
                     <div style={{ fontSize: '0.65rem', fontWeight: '700', color: metric.trend.includes('+') || metric.trend === 'Good' || metric.trend === 'Peak' ? '#52c41a' : '#fa8c1f' }}>{metric.trend}</div>
                   </div>
                 </div>
               ))}
             </div>
          </div>
        </section>
      </div>

      {/* Bottom: Strategy Insights */}
      <section style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
        <div className="panel" style={{ padding: '16px' }}>
          <h3 style={{ fontSize: '0.7rem', fontWeight: '900', color: '#52c41a', textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '0.1em' }}>
            OPTIMIZED STRATEGIC PATTERNS
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {strategyInsights.best.map((s, i) => (
              <span key={i} style={{ padding: '4px 12px', backgroundColor: 'rgba(82, 196, 26, 0.1)', color: '#52c41a', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '800', border: '1px solid rgba(82,196,26,0.2)' }}>
                {s}
              </span>
            ))}
          </div>
        </div>
        <div className="panel" style={{ padding: '16px' }}>
          <h3 style={{ fontSize: '0.7rem', fontWeight: '900', color: '#ff4d4f', textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '0.1em' }}>
            RISK-PRONE TARGET PATTERNS
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {strategyInsights.weak.map((s, i) => (
              <span key={i} style={{ padding: '4px 12px', backgroundColor: 'rgba(255, 77, 79, 0.1)', color: '#ff4d4f', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '800', border: '1px solid rgba(255,77,79,0.2)' }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Detailed Evolution Sidebar */}
      {selectedDecision && (
        <DecisionEvolutionSidebar 
          decision={selectedDecision} 
          onClose={() => setSelectedDecision(null)} 
        />
      )}

    </div>
  );
};

export default SystemIntelligence;
