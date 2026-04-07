import React, { useState, useEffect } from 'react';
import { simulationVariables, simulationKPIs } from '../data/DashboardData';
import SimulationSidebar from '../components/SimulationSidebar';
import { useData } from '../context/DataContext';

const ScenarioSimulator = () => {
  const { enterpriseData, hasData } = useData();
  const [values, setValues] = useState({});
  const [deltas, setDeltas] = useState({});
  const [selectedOutcome, setSelectedOutcome] = useState(null);

  useEffect(() => {
    // Initialize default values
    const initialValues = {};
    simulationVariables.forEach(v => {
      initialValues[v.id] = v.default;
    });
    setValues(initialValues);

    // Initialize random deltas for visual effect
    const initialDeltas = {};
    simulationKPIs.forEach(k => {
      initialDeltas[k.id] = 0;
    });
    setDeltas(initialDeltas);
  }, []);

  const handleSliderChange = (id, newVal) => {
    setValues(prev => ({ ...prev, [id]: Number(newVal) }));
    
    // Simulate real-time calculation impact
    const newDeltas = { ...deltas };
    simulationKPIs.forEach(k => {
      // Very simple mock logic: sum of changes * some random coefficient
      const impact = (Number(newVal) / 10) * (Math.random() - 0.3);
      newDeltas[k.id] = Math.min(Math.max(impact, -15), 15).toFixed(1);
    });
    setDeltas(newDeltas);
  };

  const formatIndianNumber = (num, isCurrency = true) => {
    if (!num && num !== 0) return 'N/A';
    const formatter = new Intl.NumberFormat('en-IN', {
      style: isCurrency ? 'currency' : 'decimal',
      currency: 'INR',
      maximumFractionDigits: 1
    });

    if (num >= 10000000) {
      return `${isCurrency ? '₹' : ''}${(num / 10000000).toFixed(2)} Cr`;
    } else if (num >= 100000) {
      return `${isCurrency ? '₹' : ''}${(num / 100000).toFixed(2)} L`;
    }
    return formatter.format(num);
  };

  const categories = [...new Set(simulationVariables.map(v => v.category))];

  const outcomes = [
    { 
      id: 'A',
      title: 'Optimistic', 
      impact: `Profit ↑ ${formatIndianNumber(enterpriseData.Profit * 1.1)}`, 
      color: '#52c41a', 
      description: 'High market absorption allows price hike without significant churn. Efficiency gains from production shifts offset wage increases.' 
    },
    { 
      id: 'B',
      title: 'Expected', 
      impact: `Profit ↑ ${formatIndianNumber(enterpriseData.Profit * 1.05)}`, 
      color: 'var(--accent-primary)', 
      description: 'Moderate demand elasticity results in 2% volume drop. Supply chain consolidation savings provide secondary support.' 
    },
    { 
      id: 'C',
      title: 'Pessimistic', 
      impact: `Profit ↓ ${formatIndianNumber(enterpriseData.Profit * 0.95)}`, 
      color: '#ff4d4f', 
      description: 'Competitor counter-action triggers price war. Inflation shock impacts raw material costs more severely than predicted.' 
    }
  ];
  if (!hasData) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: '24px', opacity: 0.5 }}>
        <div style={{ fontSize: '4rem' }}>⏳</div>
        <div style={{ fontSize: '0.8rem', fontWeight: '900', letterSpacing: '0.3em' }}>AWAITING MARKET ANALYSIS...</div>
        <p style={{ fontSize: '0.75rem', maxWidth: '400px', textAlign: 'center' }}>Connect your dataset to activate the predictive multi-outcome engine and simulate strategic variables.</p>
      </div>
    );
  }

  return (
    <div className="simulator-container" style={{ position: 'relative' }}>
      
      {/* LEFT: Controls */}
      <aside className="control-panel">
        {categories.map(cat => (
          <div key={cat} className="sim-group">
            <div className="sim-group-title" style={{ fontSize: '0.7rem', fontWeight: '900', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>
              [{cat}]
            </div>
            {simulationVariables.filter(v => v.category === cat).map(v => (
              <div key={v.id} className="variable-row">
                <div className="variable-label">
                  <span>{v.name}</span>
                  <span style={{ fontWeight: '700', color: 'var(--accent-primary)' }}>{values[v.id] ?? v.default}{v.unit}</span>
                </div>
                <input 
                  type="range" 
                  className="sim-slider"
                  min={v.min}
                  max={v.max}
                  value={values[v.id] ?? v.default}
                  onChange={(e) => handleSliderChange(v.id, e.target.value)}
                />
              </div>
            ))}
          </div>
        ))}
      </aside>

      {/* RIGHT: Results */}
      <main className="results-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: '800' }}>Impact Yield (20 KPIs)</h2>
          <button 
            style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: 'var(--accent-primary)', color: 'white', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' }}
            onClick={() => {
              const reset = {};
              simulationVariables.forEach(v => reset[v.id] = v.default);
              setValues(reset);
              const resetDeltas = {};
              simulationKPIs.forEach(k => resetDeltas[k.id] = 0);
              setDeltas(resetDeltas);
            }}
          >
            Reset Scenario
          </button>
        </div>

        <div className="kpi-yield-grid">
          {simulationKPIs.map(kpi => (
            <div key={kpi.id} className="yield-card">
              <div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>{kpi.category}</div>
                <div style={{ fontSize: '0.85rem', fontWeight: '700' }}>{kpi.name}</div>
              </div>
              <div style={{ marginTop: '12px' }}>
                <div style={{ fontSize: '1rem', fontWeight: '600' }}>{kpi.base}</div>
                <div className={`delta-badge ${deltas[kpi.id] > 0 ? 'delta-pos' : deltas[kpi.id] < 0 ? 'delta-neg' : 'delta-neu'}`} style={{ fontSize: '0.65rem', fontWeight: '900' }}>
                  {deltas[kpi.id] > 0 ? '(+)' : deltas[kpi.id] < 0 ? '(-)' : '(S)'} {Math.abs(deltas[kpi.id] || 0)}%
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Multi-Outcome Engine */}
        <section className="outcome-engine">
          <h3 style={{ fontSize: '0.75rem', fontWeight: '900', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '0.1em' }}>
            <span style={{ color: 'var(--accent-primary)' }}>[PREDICTIVE_ENGINE]</span> SCENARIO OUTCOME FORECASTS
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            {outcomes.map(outcome => (
              <div 
                key={outcome.id} 
                className="outcome-click-card"
                style={{ 
                  padding: '12px', 
                  borderRadius: '12px', 
                  border: '1px solid var(--border-default)', 
                  borderLeft: `4px solid ${outcome.color}`,
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  background: 'var(--bg-card)'
                }}
                onClick={() => setSelectedOutcome(outcome)}
              >
                <div style={{ fontSize: '0.7rem', fontWeight: '800', color: outcome.color, marginBottom: '6px' }}>OUTCOME {outcome.id}: {outcome.title.toUpperCase()}</div>
                <div style={{ fontWeight: '800', marginBottom: '6px', fontSize: '1.05rem' }}>{outcome.impact}</div>
                <p style={{ fontSize: '0.75rem', opacity: 0.8, lineHeight: '1.4' }}>{outcome.description}</p>
                <div style={{ marginTop: '12px', fontSize: '0.65rem', fontWeight: '700', opacity: 0.5 }}>CLICK TO ANALYZE ➔</div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {selectedOutcome && (
        <SimulationSidebar 
          outcome={selectedOutcome}
          currentValues={values}
          onClose={() => setSelectedOutcome(null)}
        />
      )}
    </div>
  );
};

export default ScenarioSimulator;
