import React, { useState, useEffect, useRef } from 'react';

const DecisionSidebar = ({ decision, onClose }) => {
  const [messages, setMessages] = useState([
    { role: 'ai', text: `Hello! I'm your AI Consultant. I've analyzed the decision to "${decision.title}". How can I help you evaluate this further?` }
  ]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = { role: 'user', text: input };
    setMessages(prev => [...prev, userMsg, { role: 'ai', text: "Adviser is thinking..." }]);
    const currentInput = input;
    setInput('');

    // Call Backend Groq RAG Chat
    try {
      const response = await fetch('http://localhost:5000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: currentInput, decisionContext: decision })
      });
      const data = await response.json();
      if (data.success) {
        setMessages(prev => {
            const newMsgs = [...prev];
            newMsgs[newMsgs.length - 1] = { role: 'ai', text: data.response };
            return newMsgs;
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error("AI Communication Error:", error);
      setMessages(prev => {
        const newMsgs = [...prev];
        newMsgs[newMsgs.length - 1] = { role: 'ai', text: "Our RAG systems are temporarily busy. Please retry in 5 seconds." };
        return newMsgs;
      });
    }
  };

  const generateAIResponse = (query, data) => {
    const q = query.toLowerCase();
    if (q.includes('risk')) {
      return `The ${data.risk} risk profile is primarily due to market volatility. Specifically, our simulations show a ${data.simulation.worst} outcome in the worst-case scenario, which we should hedge against.`;
    }
    if (q.includes('why') || q.includes('reason')) {
      return `The primary driver for this is: ${data.why}. Additionally, our causal analysis shows ${data.dependency}.`;
    }
    if (q.includes('simulation') || q.includes('outcome')) {
      return `Based on our multi-agent simulation: The expected impact is ${data.simulation.exp}. In a best-case scenario, we could see ${data.simulation.best}.`;
    }
    return "That's an interesting point. Based on current enterprise data trends, this decision aligns with our Q3 strategic goals for margin optimization. Do you want to see the specific KPI impact breakdown?";
  };

  return (
    <>
      <div className="sidebar-overlay" onClick={onClose}></div>
      <div className="decision-sidebar">
        <div className="sidebar-header" style={{ borderBottom: '1px solid var(--border-default)', paddingBottom: '24px' }}>
          <div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ 
                padding: '4px 10px', 
                borderRadius: '6px', 
                fontSize: '0.6rem', 
                fontWeight: '900', 
                backgroundColor: 'rgba(255,255,255,0.05)', 
                color: 'var(--accent-primary)',
                border: '1px solid var(--accent-primary)',
                letterSpacing: '0.1em'
              }}>
                {decision.perspective?.toUpperCase()}
              </span>
              <span style={{ fontSize: '0.65rem', fontWeight: '800', opacity: 0.5 }}>[{decision.impact}]</span>
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '900', lineHeight: '1.2' }}>{decision.title}</h2>
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
            <h3 style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '12px' }}>Detailed Analysis</h3>
            <div style={{ padding: '16px', backgroundColor: 'var(--bg-subtle)', borderRadius: '12px', border: '1px solid var(--border-default)', fontSize: '0.875rem', lineHeight: '1.5' }}>
              <p style={{ fontWeight: '700', marginBottom: '8px', color: 'var(--accent-primary)' }}>AI Reasoning:</p>
              <p>{decision.why?.replace(/\[(AUDIT|STRATEGY|GUARD)\]/gi, '').trim()}</p>
            </div>
          </section>

          <section>
            <h3 style={{ fontSize: '0.75rem', fontWeight: '900', color: 'var(--accent-primary)', textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '0.1em' }}>
              AI DATA-DRIVEN STRATEGIC PROJECTIONS
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {decision?.simulation ? Object.entries(decision.simulation).map(([key, val]) => {
                const labels = {
                  exp: { 
                    title: 'EXPECTED STRATEGIC BASELINE', 
                    sub: 'The statistically most probable trajectory based on current enterprise velocity and historical performance regression. Assumes stable execution without major pivots.', 
                    color: '#1890ff', 
                    icon: '⚙️' 
                  },
                  best: { 
                    title: 'AI-OPTIMIZED BEST CASE', 
                    sub: 'A high-alpha trajectory modeling optimized efficiency, successful strategic hedging, and upper-quartile favorable market conditions.', 
                    color: '#52c41a', 
                    icon: '📈' 
                  },
                  worst: { 
                    title: 'CRITICAL RISK MITIGATION', 
                    sub: 'A high-fidelity stress-test modeling severe outcome variables such as policy shocks, talent attrition, or competitive price wars for proactive defense.', 
                    color: '#ff4d4f', 
                    icon: '🛡️' 
                  }
                };
                const config = labels[key.toLowerCase()] || { title: key.toUpperCase(), sub: 'Projected Outcome', color: 'var(--text-secondary)', icon: '●' };
                
                return (
                  <div key={key} className="sim-outcome-card" style={{ 
                    padding: '16px', 
                    background: 'rgba(255, 255, 255, 0.02)', 
                    border: '1px solid var(--border-default)', 
                    borderLeft: `4px solid ${config.color}`,
                    borderRadius: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    transition: 'transform 0.2s ease'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.2rem' }}>{config.icon}</span>
                        <span style={{ fontSize: '0.7rem', fontWeight: '900', color: config.color, letterSpacing: '0.05em' }}>{config.title}</span>
                      </div>
                    </div>
                    <div style={{ fontWeight: '800', fontSize: '1.1rem', color: 'var(--text-primary)' }}>{val}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', opacity: 0.8, lineHeight: '1.4' }}>{config.sub}</div>
                  </div>
                );
              }) : (
                <div style={{ padding: '32px', textAlign: 'center', border: '1px dashed var(--border-default)', borderRadius: '16px', opacity: 0.5 }}>
                   <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>📊</div>
                   <div style={{ fontSize: '0.75rem', fontWeight: '800' }}>INITIALIZING PREDICTIVE ENGINE...</div>
                </div>
              )}
            </div>
          </section>

          <section>
            <h3 style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '12px' }}>Conversational Intelligence</h3>
            <div className="chat-container">
              <div className="chat-header" style={{ fontSize: '0.7rem', fontWeight: '900', letterSpacing: '0.05em' }}>
                <span>STRATEGIC ADVISOR [ONLINE]</span>
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
                  placeholder="Ask a follow-up question..."
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

export default DecisionSidebar;
