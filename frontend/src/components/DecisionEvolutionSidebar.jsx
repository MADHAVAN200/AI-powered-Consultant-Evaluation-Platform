import React from 'react';

const DecisionEvolutionSidebar = ({ decision, onClose }) => {
  if (!decision) return null;

  const getOutcomeColor = (outcome) => {
    switch (outcome) {
      case 'Success': case 'Positive': case 'Improved': case 'Successful': return '#52c41a';
      case 'Mixed': case 'Neutral': case 'Stable': return '#fa8c1f';
      case 'Negative': case 'Failed': return '#ff4d4f';
      default: return 'var(--text-secondary)';
    }
  };

  const outcomeColor = getOutcomeColor(decision.outcome);

  return (
    <>
      <div className="sidebar-overlay" onClick={onClose} />
      <div className="decision-sidebar" style={{ width: '480px' }}>
        <div className="sidebar-header" style={{ borderBottomColor: outcomeColor }}>
          <div>
            <div style={{ fontSize: '0.65rem', fontWeight: '800', color: outcomeColor, textTransform: 'uppercase', marginBottom: '4px' }}>
              Historical Audit Trace
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800' }}>{decision.action || decision.name}</h2>
          </div>
          <button className="close-btn" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>&times;</button>
        </div>

        <div className="sidebar-body">
          
          {/* Status Banner */}
          <div style={{ 
            padding: '20px', 
            borderRadius: '12px', 
            background: `${outcomeColor}10`, 
            border: `1px solid ${outcomeColor}30`,
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: '700', color: outcomeColor, opacity: 0.8 }}>OUTCOME STATUS</div>
                <div style={{ fontSize: '1.1rem', fontWeight: '800', color: outcomeColor }}>{decision.outcome.toUpperCase()}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: '700', color: outcomeColor, opacity: 0.8 }}>REWARD IMPACT</div>
                <div style={{ fontSize: '1.1rem', fontWeight: '800', color: outcomeColor }}>{decision.impact}</div>
              </div>
            </div>
          </div>

          {/* Execution Trace (New) */}
          <section style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '12px' }}>
              Execution Traceability
            </h3>
            <div className="panel" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', padding: '0' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: '900', letterSpacing: '0.05em' }}>ALIGNMENT STATUS</span>
                <span className={`badge ${decision.alignment === 'Full' ? 'badge-low' : decision.alignment === 'Partial' ? 'badge-medium' : 'badge-critical'}`} style={{ fontSize: '0.65rem', fontWeight: '800' }}>
                  {decision.alignment.toUpperCase()}
                </span>
              </div>
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '0.65rem', fontWeight: '700', color: 'var(--accent-primary)', marginBottom: '4px' }}>AGENT RECOMMENDATION</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>{decision.recommendedAction}</div>
                </div>
                <div style={{ height: '1px', background: 'var(--border-default)', width: '30px' }}></div>
                <div>
                  <div style={{ fontSize: '0.65rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '4px' }}>ORGANIZATIONAL ACTION</div>
                  <div style={{ fontSize: '0.875rem', fontWeight: '500', fontStyle: 'italic' }}>{decision.actualAction}</div>
                </div>
              </div>
            </div>
          </section>

          {/* Post-Mortem Analysis */}
          <section>
            <h3 style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '12px' }}>
              Post-Mortem Analysis
            </h3>
            <div style={{ padding: '16px', fontSize: '0.875rem', lineHeight: '1.6', background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: '12px' }}>
              {decision.why}
            </div>
          </section>

          {/* Diagnostic Indicators */}
          <section>
            <h3 style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '12px' }}>
              Diagnostic Indicators
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {decision.factors.map((factor, idx) => (
                <div key={idx} style={{ 
                  padding: '12px', 
                  borderRadius: '8px', 
                  background: 'var(--bg-subtle)', 
                  border: '1px solid var(--border-default)',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  textAlign: 'center'
                }}>
                  {factor}
                </div>
              ))}
            </div>
          </section>

          {/* Evolutionary Learning */}
          <section style={{ border: '1px solid var(--accent-primary)', background: 'rgba(88, 166, 255, 0.05)', borderRadius: '12px', overflow: 'hidden' }}>
            <header className="panel-header" style={{ background: 'var(--accent-primary)', color: 'white', fontSize: '0.75rem', fontWeight: '800', padding: '12px 16px', borderBottom: 'none' }}>
              AGENT STRATEGY UPDATE
            </header>
            <div style={{ padding: '16px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{ fontSize: '0.85rem', lineHeight: '1.5', color: 'var(--text-primary)' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: '900', color: 'var(--accent-primary)', marginRight: '8px' }}>[MODEL_LEARNING]</span>
                  {decision.learnings}
                </div>
              </div>
              <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                <span className="badge badge-low" style={{ background: 'rgba(82, 196, 26, 0.1)', color: '#52c41a' }}>STABILITY GAIN</span>
                <span className="badge badge-low" style={{ background: 'rgba(24, 144, 255, 0.1)', color: '#1890ff' }}>TRACE CONFIRMED</span>
              </div>
            </div>
          </section>

          {/* Timeline Metadata */}
          <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--border-default)', fontSize: '0.7rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
            Historical Action archived on {decision.date} • Reference ID: EVOL-{decision.id}
          </div>

        </div>
      </div>
    </>
  );
};

export default DecisionEvolutionSidebar;
