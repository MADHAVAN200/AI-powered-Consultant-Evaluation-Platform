import React, { useState, useEffect, useCallback } from 'react';
import { useData } from '../context/DataContext';
import DecisionSidebar from '../components/DecisionSidebar';

const RiskPerspectiveBadge = ({ perspective }) => {
  const colors = {
    'Low Risk': { bg: 'rgba(24, 144, 255, 0.15)', text: '#1890ff', border: '#1890ff' },
    'Medium Risk': { bg: 'rgba(82, 196, 26, 0.15)', text: '#52c41a', border: '#52c41a' },
    'High Risk': { bg: 'rgba(245, 34, 45, 0.15)', text: '#f5222d', border: '#f5222d' }
  };
  const style = colors[perspective] || { bg: 'var(--bg-card)', text: 'var(--text-primary)', border: 'var(--border-default)' };
  
  return (
    <span style={{ 
      padding: '4px 10px', 
      borderRadius: '6px', 
      fontSize: '0.65rem', 
      fontWeight: '900', 
      backgroundColor: style.bg, 
      color: style.text,
      border: `1px solid ${style.border}`,
      letterSpacing: '0.05em',
      textTransform: 'uppercase'
    }}>
      {perspective}
    </span>
  );
};

const DecisionCard = ({ decision, onClick }) => {
  const accentColor = 
    decision.perspective === 'High Risk' ? '#f5222d' : 
    decision.perspective === 'Low Risk' ? '#1890ff' : '#52c41a';

  return (
    <div className="decision-card clickable" onClick={onClick} style={{ borderLeft: `6px solid ${accentColor}`, padding: '24px' }}>
      <div className="decision-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '16px' }}>
            <RiskPerspectiveBadge perspective={decision.perspective} />
            <span style={{ fontSize: '0.6rem', fontWeight: '800', opacity: 0.5 }}>{new Date(decision.created_at).toLocaleString()}</span>
        </div>
        <div className="decision-title" style={{ fontSize: '1.1rem', fontWeight: '900', color: 'var(--text-primary)', marginBottom: '12px' }}>{decision.title}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', background: 'var(--bg-subtle)', padding: '10px', borderRadius: '8px' }}>
          <span style={{ color: '#52c41a', fontWeight: '900', fontSize: '0.8rem' }}>{decision.impact}</span>
          <span style={{ fontSize: '0.65rem', opacity: 0.6, fontWeight: '800' }}>{Math.round(decision.confidence * 100)}% CONF</span>
        </div>
      </div>
      <div style={{ marginTop: '16px', fontSize: '0.8rem', opacity: 0.8, color: 'var(--text-secondary)', lineHeight: '1.6' }}>
        {decision.why?.replace(/\[(AUDIT|STRATEGY|GUARD)\]/gi, '').trim().substring(0, 180)}...
      </div>
    </div>
  );
};

const DecisionsInsights = () => {
  const { userEmail } = useData();
  const [allDecisions, setAllDecisions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [perspectiveFilter, setPerspectiveFilter] = useState('All');
  const [selectedDecision, setSelectedDecision] = useState(null);

  const fetchAllDecisions = useCallback(async () => {
    if (!userEmail) return;
    setIsLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/all-decisions?email=${userEmail}`);
      const data = await response.json();
      if (data.success) {
        setAllDecisions(data.decisions || []);
      }
    } catch (error) {
      console.error("Failed to fetch historical decisions:", error);
    } finally {
      setIsLoading(false);
    }
  }, [userEmail]);

  useEffect(() => {
    fetchAllDecisions();
  }, [fetchAllDecisions]);

  const filteredDecisions = allDecisions.filter(d => {
    return perspectiveFilter === 'All' || d.perspective === perspectiveFilter;
  });

  // Inline skeletons handled in the main render

  return (
    <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', paddingBottom: '12px' }}>
      {/* Header & Controls */}
      <div style={{ padding: '0 0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '20px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: '900', opacity: 0.5, letterSpacing: '0.1em' }}>RISK PERSPECTIVE:</span>
                {['All', 'Low Risk', 'Medium Risk', 'High Risk'].map(p => (
                    <button 
                        key={p}
                        style={{
                            padding: '6px 14px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-default)',
                            background: perspectiveFilter === p ? 'var(--text-primary)' : 'var(--bg-card)',
                            color: perspectiveFilter === p ? 'var(--bg-default)' : 'var(--text-primary)',
                            fontSize: '0.7rem',
                            fontWeight: '900',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onClick={() => setPerspectiveFilter(p)}
                    >
                        {p.toUpperCase()}
                    </button>
                ))}
            </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
             onClick={fetchAllDecisions}
             style={{ padding: '6px 12px', border: 'none', background: 'var(--accent-primary)', color: 'white', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '400', cursor: 'pointer' }}
          >
             Refresh
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
        <div className="decisions-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '24px' }}>
          {isLoading ? (
            [1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="decision-card" style={{ padding: '24px', opacity: 0.6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div className="skeleton" style={{ width: '80px', height: '24px' }}></div>
                  <div className="skeleton" style={{ width: '120px', height: '14px' }}></div>
                </div>
                <div className="skeleton-title skeleton" style={{ width: '90%' }}></div>
                <div className="skeleton-rect skeleton" style={{ height: '40px', margin: '16px 0', borderRadius: '8px' }}></div>
                <div className="skeleton-text skeleton"></div>
                <div className="skeleton-text skeleton" style={{ width: '60%' }}></div>
              </div>
            ))
          ) : (
            filteredDecisions.map(d => (
              <DecisionCard 
                key={d.id} 
                decision={d} 
                onClick={() => setSelectedDecision(d)} 
              />
            ))
          )}
          {filteredDecisions.length === 0 && (
              <div style={{ gridColumn: '1 / -1', padding: '60px', textAlign: 'center', border: '1px dashed var(--border-default)', borderRadius: '20px', opacity: 0.4 }}>
                  <div style={{ fontSize: '2rem', marginBottom: '16px' }}>🛡️</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '900', letterSpacing: '0.1em' }}>NO STRATEGIES MATCHING THE SELECTED RISK CALIBRATION.</div>
              </div>
          )}
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
