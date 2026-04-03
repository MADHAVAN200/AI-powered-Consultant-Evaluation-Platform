import React, { useState, useEffect, useRef } from 'react';

const SimulationSidebar = ({ outcome, currentValues, onClose }) => {
  const [messages, setMessages] = useState([
    { role: 'ai', text: `I've analyzed the ${outcome.title} scenario. Given your current adjustments to factors like Price and Headcount, this represents a ${outcome.title === 'Expected' ? 'balanced' : outcome.title === 'Optimistic' ? 'best-case' : 'high-risk'} path. How can I help you understand the underlying drivers?` }
  ]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMsg = { role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    // Simulate AI Response
    setTimeout(() => {
      const aiResponse = generateAIResponse(input, outcome, currentValues);
      setMessages(prev => [...prev, { role: 'ai', text: aiResponse }]);
    }, 1000);
  };

  const generateAIResponse = (query, outcome, values) => {
    const q = query.toLowerCase();
    
    if (q.includes('price')) {
      return `Your current price adjustment is significant. In this ${outcome.title} scenario, we assume market elasticity will ${outcome.title === 'Optimistic' ? 'absorb the hike' : 'react strongly, increasing churn'}.`;
    }
    if (q.includes('headcount') || q.includes('hiring')) {
      return `With your current headcount changes, the operational overhead is shifting. This ${outcome.title} case predicts ${outcome.title === 'Pessimistic' ? 'a strain on existing resources' : 'a boost in R&D throughput'}.`;
    }
    if (q.includes('risk') || q.includes('pessimistic')) {
      return `The primary risk in this setup is the mismatch between aggressive expansion and global inflation trends. If market demand stays low, the fixed costs will compress margins by approx 3.2%.`;
    }
    
    return `That's a valid concern. When looking at the ${outcome.title} outcome, we prioritize ${outcome.title === 'Optimistic' ? 'growth capture' : 'survival and stability'}. Do you want to see how a further 2% shift in supply chain budget would affect this?`;
  };

  return (
    <>
      <div className="sidebar-overlay" onClick={onClose}></div>
      <div className="decision-sidebar">
        <div className="sidebar-header">
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '4px', color: outcome.color }}>{outcome.title}</h2>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontWeight: '700', fontSize: '1.1rem' }}>{outcome.impact}</span>
              <span style={{ opacity: 0.6, fontSize: '0.75rem' }}>Confidence: 82%</span>
            </div>
          </div>
          <button 
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-secondary)' }}
          >
            ✕
          </button>
        </div>

        <div className="sidebar-body">
          <section>
            <h3 style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '12px' }}>Strategic Context</h3>
            <div style={{ padding: '16px', backgroundColor: 'var(--bg-subtle)', borderRadius: '12px', border: '1px solid var(--border-default)', fontSize: '0.875rem', lineHeight: '1.5' }}>
              <p style={{ fontWeight: '700', marginBottom: '8px', color: 'var(--accent-primary)' }}>AI Synthesis:</p>
              <p>{outcome.description}</p>
            </div>
          </section>

          <section>
            <h3 style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '12px' }}>Input Influence</h3>
            <div style={{ padding: '12px', background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', marginBottom: '8px', opacity: 0.8 }}>Top factors driving this specific prediction:</div>
              <ul style={{ paddingLeft: '20px', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li><strong>Elasticity Check</strong>: Current price hike vs competitor baseline.</li>
                <li><strong>Resource Utilization</strong>: Skill coverage vs hiring targets.</li>
                <li><strong>External Shock</strong>: Inflation impact on raw material overhead.</li>
              </ul>
            </div>
          </section>

          <section>
            <h3 style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '12px' }}>Interactive Advisor</h3>
            <div className="chat-container">
              <div className="chat-header" style={{ fontSize: '0.7rem', fontWeight: '900', letterSpacing: '0.05em' }}>
                <span>SIMULATION ANALYST [ACTIVE]</span>
              </div>
              <div className="chat-messages">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`message message-${msg.role}`}>
                    {msg.text}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <div className="chat-input-area">
                <input 
                  type="text" 
                  className="chat-input" 
                  placeholder="Ask about this outcome..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                />
                <button className="chat-send-btn" onClick={handleSend}>↑</button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
};

export default SimulationSidebar;
