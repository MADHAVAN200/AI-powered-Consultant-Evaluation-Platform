import React, { useState, useEffect, useRef } from 'react';
import { detailedDecisions } from '../data/DashboardData';

const IntelligenceSidebar = ({ item, type, onClose }) => {
  const [chatMessages, setChatMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (type === 'recommendation' || type === 'agent') {
      setChatMessages([
        { role: 'ai', text: `Hello! I'm here to explain the reasoning behind this ${type === 'recommendation' ? 'decision' : 'insight'}. How can I help you understand this better?` }
      ]);
    }
  }, [type]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  if (!item) return null;

  // Find detailed reasoning if it's a recommendation
  const detailed = type === 'recommendation' ? detailedDecisions.find(d => d.id === item.id) : null;

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const userMsg = { role: 'user', text: inputText };
    setChatMessages(prev => [...prev, userMsg, { role: 'ai', text: "Adviser is thinking..." }]);
    const currentInput = inputText;
    setInputText('');

    // Call Backend Groq RAG Chat
    try {
      const response = await fetch('http://localhost:5000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: currentInput, decisionContext: item })
      });
      const data = await response.json();
      if (data.success) {
        setChatMessages(prev => {
            const newMsgs = [...prev];
            newMsgs[newMsgs.length - 1] = { role: 'ai', text: data.response };
            return newMsgs;
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error("AI Communication Error:", error);
      setChatMessages(prev => {
        const newMsgs = [...prev];
        newMsgs[newMsgs.length - 1] = { role: 'ai', text: "Our RAG systems are temporarily busy. Please retry in 5 seconds." };
        return newMsgs;
      });
    }
  };

  return (
    <>
      <div className="sidebar-overlay" onClick={onClose} />
      <div className="decision-sidebar" style={{ width: '480px' }}>
        <div className="sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontWeight: '900', fontSize: '0.8rem', letterSpacing: '0.1em', color: 'var(--accent-primary)' }}>
              {type.toUpperCase()} REPORT
            </div>
          </div>
          <button className="close-btn" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>&times;</button>
        </div>

        <div className="sidebar-body">
          
          {/* Main Summary */}
          <div style={{ marginBottom: '8px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '12px', lineHeight: '1.3' }}>
              {item.title || item.decision || item.event || item.name}
            </h2>
            <div style={{ display: 'flex', gap: '10px' }}>
              {item.severity && <span className={`badge badge-${item.severity.toLowerCase()}`}>{item.severity} SEVERITY</span>}
              {item.risk && <span className={`badge badge-${item.risk.toLowerCase()}`}>{item.risk} RISK</span>}
              {item.confidence && <span className="badge badge-low" style={{ background: 'rgba(24, 144, 255, 0.1)', color: '#1890ff' }}>{Math.round(item.confidence * 100)}% CONFIDENCE</span>}
            </div>
          </div>

          {/* Reasoning / Why Section */}
          <div className="panel" style={{ border: '1px solid var(--border-default)' }}>
            <header className="panel-header" style={{ fontSize: '0.75rem', fontWeight: '800' }}>AI REASONING REPORT</header>
            <div className="panel-content" style={{ padding: '16px', fontSize: '0.85rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
              {item.why || detailed?.why || "This entry was flagged by the Strategic Intelligence Engine due to anomalous patterns detected in your enterprise data stream combined with global macro-market shifts."}
            </div>
          </div>

          {/* KPI Impact / Metrics Section */}
          <div className="panel" style={{ border: '1px solid var(--border-default)' }}>
            <header className="panel-header" style={{ fontSize: '0.75rem', fontWeight: '800' }}>AFFECTED KPI METRICS</header>
            <div className="panel-content" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {(item.kpis || (detailed ? ["Profit", "Margin"] : ["Enterprise Value"])).map((kpi, idx) => (
                  <div key={idx} style={{ padding: '6px 12px', borderRadius: '6px', background: 'var(--bg-default)', border: '1px solid var(--border-default)', fontSize: '0.75rem', fontWeight: '600' }}>
                    {kpi}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '16px', fontSize: '0.75rem', color: '#52c41a', fontWeight: '700' }}>
                Projected Impact: {item.impact || detailed?.impact || "Optimized Performance"}
              </div>
            </div>
          </div>

          {/* Conversational AI Section (Only for Agents and Recs) */}
          {(type === 'agent' || type === 'recommendation') && (
            <div className="chat-container">
              <div className="chat-header">
                <span style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase' }}>AI Consultant Conversational Analysis</span>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {chatMessages.map((msg, i) => (
                  <div key={i} style={{ 
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    fontSize: '0.8rem',
                    lineHeight: '1.4',
                    background: msg.role === 'user' ? 'var(--accent-primary)' : 'var(--bg-card)',
                    color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                    border: msg.role === 'user' ? 'none' : '1px solid var(--border-default)'
                  }}>
                    {msg.text}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={handleSendMessage} style={{ padding: '12px', borderTop: '1px solid var(--border-default)', display: 'flex', gap: '8px', background: 'var(--bg-card)' }}>
                <input 
                  type="text" 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Ask AI about this logic..." 
                  style={{ flex: 1, background: 'var(--bg-default)', border: '1px solid var(--border-default)', borderRadius: '6px', padding: '8px 12px', fontSize: '0.8rem', color: 'var(--text-primary)' }}
                />
                <button type="submit" style={{ background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '6px', padding: '0 16px', fontWeight: '700', fontSize: '1rem' }}>
                  SEND
                </button>
              </form>
            </div>
          )}

        </div>
      </div>
    </>
  );
};

export default IntelligenceSidebar;
