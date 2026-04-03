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

  const handleSend = () => {
    if (!input.trim()) return;

    const userMsg = { role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    // Simulate AI Response
    setTimeout(() => {
      const aiResponse = generateAIResponse(input, decision);
      setMessages(prev => [...prev, { role: 'ai', text: aiResponse }]);
    }, 1000);
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
        <div className="sidebar-header">
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '4px' }}>{decision.title}</h2>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ color: '#52c41a', fontWeight: '700', fontSize: '0.85rem' }}>{decision.impact}</span>
              <span className={`badge badge-${decision.risk.toLowerCase()}`}>RISK: {decision.risk}</span>
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
            <h3 style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '12px' }}>Detailed Analysis</h3>
            <div style={{ padding: '16px', backgroundColor: 'var(--bg-subtle)', borderRadius: '12px', border: '1px solid var(--border-default)', fontSize: '0.875rem', lineHeight: '1.5' }}>
              <p style={{ fontWeight: '700', marginBottom: '8px', color: 'var(--accent-primary)' }}>AI Reasoning:</p>
              <p>{decision.why}</p>
            </div>
          </section>

          <section>
            <h3 style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '12px' }}>Simulation Outcomes</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Object.entries(decision.simulation).map(([key, val]) => (
                <div key={key} className="sim-outcome" style={{ padding: '12px', border: '1px solid var(--border-default)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', opacity: 0.7 }}>{key}</span>
                  <span style={{ fontWeight: '700', color: key === 'worst' ? '#ff4d4f' : key === 'best' ? '#52c41a' : 'inherit' }}>{val}</span>
                </div>
              ))}
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
