import React, { useState } from 'react';
import { detailedDecisions } from '../data/DashboardData';
import DecisionSidebar from '../components/DecisionSidebar';

const DecisionCard = ({ decision, onClick }) => {
  return (
    <div className="decision-card" onClick={onClick}>
      <div className="decision-header">
        <div className="decision-title">{decision.title}</div>
        <div className="decision-meta">
          <span style={{ color: '#52c41a', fontWeight: '700' }}>{decision.impact}</span>
          <span className={`badge badge-${decision.risk.toLowerCase()}`}>RISK: {decision.risk}</span>
          <span style={{ opacity: 0.6 }}>Confidence: {Math.round(decision.confidence * 100)}%</span>
        </div>
      </div>
      <div style={{ padding: '12px', fontSize: '0.75rem', opacity: 0.6 }}>
        Click to analyze reasoning and simulations...
      </div>
    </div>
  );
};

const DecisionsInsights = () => {
  const [filter, setFilter] = useState('All');
  const [selectedDecision, setSelectedDecision] = useState(null);

  const filteredDecisions = filter === 'All' 
    ? detailedDecisions 
    : detailedDecisions.filter(d => d.risk === filter);

  return (
    <div style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div style={{ padding: '0 0 20px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '600', opacity: 0.6 }}>Filter Risk:</span>
          {['All', 'Low', 'Med', 'High'].map(r => (
            <button 
              key={r}
              style={{
                padding: '4px 12px',
                borderRadius: '20px',
                border: '1px solid var(--border-default)',
                background: filter === r ? 'var(--accent-primary)' : 'var(--bg-card)',
                color: filter === r ? 'white' : 'var(--text-primary)',
                fontSize: '0.7rem',
                cursor: 'pointer'
              }}
              onClick={() => setFilter(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div className="decisions-grid">
          {filteredDecisions.map(d => (
            <DecisionCard 
              key={d.id} 
              decision={d} 
              onClick={() => setSelectedDecision(d)} 
            />
          ))}
        </div>
      </div>

      {selectedDecision && (
        <DecisionSidebar 
          decision={selectedDecision} 
          onClose={() => setSelectedDecision(null)} 
        />
      )}
    </div>
  );
};

export default DecisionsInsights;
