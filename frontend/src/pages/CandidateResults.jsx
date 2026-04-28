import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useData } from '../context/DataContext';
import { useSearchParams } from 'react-router-dom';
import './AdminEvaluation.css';
import { API_BASE } from '../config/api';
import PageLoader from '../components/PageLoader';

const toSafeArray = (value) => (Array.isArray(value) ? value : []);

const renderSectionContent = (content) => {
  const normalized = String(content || '')
    .replace(/([^\n])\s*(\d+[).]\s+)/g, '$1\n$2')
    .replace(/\r\n/g, '\n');

  const lines = normalized.split('\n');
  const elements = [];
  let listItems = [];

  const flushList = () => {
      if (listItems.length === 0) return;
      elements.push(
          <ul key={`list-${elements.length}`} className="sidebar-bullets">
              {listItems.map((item, idx) => (
                  <li key={`item-${idx}`}>{item}</li>
              ))}
          </ul>
      );
      listItems = [];
  };

  lines.forEach((raw, index) => {
      const line = String(raw || '').trim();
      if (!line) {
          flushList();
          return;
      }

      const isSubHeading = line.endsWith(':') && line.length <= 90 && !/^\d+[).]\s+/.test(line);
      const bulletMatch = line.match(/^(?:[-*•]|\d+[).])\s+(.+)$/);

      if (isSubHeading) {
          flushList();
          elements.push(
              <h4 key={`sub-${index}`} className="sidebar-subheading">
                  {line}
              </h4>
          );
          return;
      }

      if (bulletMatch) {
          listItems.push(bulletMatch[1].trim());
          return;
      }

      flushList();
      elements.push(
          <p key={`para-${index}`} className="sidebar-prose">
              {line}
          </p>
      );
  });

  flushList();
  return elements;
};

const renderFormattedChatMessage = (content) => {
    if (!content) return null;
    const normalized = String(content)
        .replace(/\s*(\d+[).]\s+)/g, '\n$1')
        .replace(/\r\n/g, '\n')
        .replace(/\n\n+/g, '\n')
        .trim();
        
    return normalized.split('\n').map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <br key={idx} />;
        const listMatch = trimmed.match(/^(\d+[).])\s+(.+)$/);
        if (listMatch) {
            return (
                <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px', paddingLeft: '4px' }}>
                    <span style={{ fontWeight: '800', color: 'var(--accent-primary)', minWidth: '22px' }}>{listMatch[1]}</span>
                    <span>{listMatch[2]}</span>
                </div>
            );
        }
        return <p key={idx} style={{ marginBottom: '8px' }}>{trimmed}</p>;
    });
};

const renderCaseQuestions = (parsedSections) => {
  if (!parsedSections) return null;
  let questionsContent = null;
  const structuredSections = parsedSections._sections || [];
  const questionsSection = structuredSections.find(s => 
      /question|task|objective|ask|deliverable/i.test(s.heading)
  );
  
  if (questionsSection) {
      questionsContent = questionsSection.content;
  } else {
      const qKey = Object.keys(parsedSections).find(k => 
          !k.startsWith('_') && /question|task|objective|ask|deliverable/i.test(k)
      );
      if (qKey) {
          questionsContent = parsedSections[qKey];
      } else if (Array.isArray(parsedSections._problemQuestions)) {
          questionsContent = parsedSections._problemQuestions.map((q, idx) => `${idx + 1}. ${q}`).join('\n');
      }
  }

  if (!questionsContent) return null;

  return (
      <article className="section-document-card" style={{ marginBottom: '24px' }}>
          <header className="section-card-header">
              <div className="section-card-icon-box" style={{ background: 'rgba(31, 111, 235, 0.1)', color: 'var(--accent-primary)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                  </svg>
              </div>
              <h3 className="section-card-title" style={{ fontSize: '0.8rem', letterSpacing: '0.05em' }}>PRIMARY CASE QUESTIONS</h3>
          </header>
          <div className="section-card-content" style={{ padding: '16px 20px' }}>
              {renderSectionContent(questionsContent)}
          </div>
      </article>
  );
};

const CandidateResults = () => {
  const { userEmail } = useData();
  const [searchParams] = useSearchParams();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedResponse, setSelectedResponse] = useState(null);
  const [selectedCaseDetail, setSelectedCaseDetail] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingCaseDetail, setLoadingCaseDetail] = useState(false);
  const [activeQuestionFilter, setActiveQuestionFilter] = useState('all');

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_BASE}/candidate/results`, { params: { email: userEmail } });
        setResults(res.data?.results || []);
      } catch (error) {
        console.error('Candidate results fetch error:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    if (userEmail) fetchResults();
  }, [userEmail]);

  useEffect(() => {
    const openId = searchParams.get('open');
    if (openId && results.length > 0) {
      const match = results.find(r => String(r.id) === openId);
      if (match) handleResponseClick(match);
    }
  }, [searchParams, results]);

  const handleResponseClick = async (resp) => {
    setSelectedCaseDetail(null);
    setSelectedResponse(resp);
    setSidebarOpen(true);

    if (!resp.chat_history || (Array.isArray(resp.chat_history) && resp.chat_history.length === 0)) {
      setLoadingDetail(true);
      try {
        const res = await axios.get(`${API_BASE}/candidate/results/${resp.id}`, { params: { email: userEmail } });
        if (res.data?.success && res.data?.detail) {
          setSelectedResponse(res.data.detail);
          setResults(prev => prev.map(r => r.id === resp.id ? { ...r, ...res.data.detail } : r));
        }
      } catch (err) {
        console.error('Failed to fetch detail:', err);
      } finally {
        setLoadingDetail(false);
      }
    }
  };

  const fetchCaseDetail = async (caseId) => {
    if (!caseId) return;
    setLoadingCaseDetail(true);
    try {
      // Use the candidate-facing case detail endpoint if available, otherwise fallback
      const res = await axios.get(`${API_BASE}/case-studies/${caseId}`);
      setSelectedCaseDetail(res.data?.case || null);
      setSelectedResponse(null);
      setSidebarOpen(true);
    } catch (error) {
      console.error('Case detail fetch error:', error);
    } finally {
      setLoadingCaseDetail(false);
    }
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
    setSelectedResponse(null);
    setSelectedCaseDetail(null);
    setActiveQuestionFilter('all');
  };

  if (loading) {
    return (
      <div className="admin-eval-page">
        <PageLoader
          message="Loading Results..."
          subMessage="Collecting your case outcomes, scores, and conversation history."
        />
      </div>
    );
  }

  return (
    <div className={`admin-eval-page dashboard-fixed ${sidebarOpen ? 'sidebar-active' : ''}`}>
      <div className="admin-eval-layout full-width" style={{ paddingTop: '0' }}>
        
        <section className="dashboard-main-grid single-column" style={{ display: 'grid', gridTemplateColumns: '1fr', width: '100%', gap: '20px' }}>
          <div className="dashboard-panel transparent">
            <div className="dashboard-panel-head">
              <div className="dashboard-panel-title">MY ATTEMPTED CASE STUDIES</div>
              <div className="dashboard-panel-desc">View every attempt with your answers, full conversation, and score.</div>
            </div>
            <div className="activity-feed flex-grow">
              {results.length === 0 ? (
                <div className="admin-hint" style={{ textAlign: 'center' }}>No submissions yet.</div>
              ) : (
                <div className="detailed-response-list">
                  {results.map((row) => {
                    const status = String(row.result_status || row.status || 'pending').toLowerCase();
                    const score = row.total_score ?? row.assessment_scores?.[0]?.total_score ?? '--';
                    const dateObj = new Date(row.created_at);
                    const chatCount = row.chat_count ?? toSafeArray(row.chat_history).length;

                    return (
                      <div key={row.id} className="activity-item clickable detailed" onClick={() => handleResponseClick(row)}>
                        <div className="activity-leading">
                          <div className="case-icon-box" style={{ width: '36px', height: '36px', flexShrink: 0, borderRadius: '8px', background: 'var(--surface-sunken)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                          </div>
                          <div className="activity-content" style={{ marginLeft: '12px' }}>
                            <div className="activity-text"><b>{row.case_studies?.title || 'Unknown Case Study'}</b></div>
                            <div className="activity-meta-tags">
                              <span className="meta-tag-small">{chatCount} Messages</span>
                              <span className="meta-tag-small">Attempted {dateObj.toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="activity-trailing">
                          <div className="activity-time-info">
                             <div className="activity-time">{dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                             <div className="activity-date-label">Submission Time</div>
                          </div>
                          <div className="activity-status-box">
                             <div className={`admin-status ${status}`} style={{ fontSize: '0.6rem' }}>{status.toUpperCase()}</div>
                             <div className="results-score-badge large">{Math.round(score)}</div>
                          </div>
                          <button 
                            className="admin-btn secondary" 
                            onClick={(e) => { e.stopPropagation(); fetchCaseDetail(row.case_study_id); }}
                            style={{ padding: '6px 12px', fontSize: '0.7rem', marginTop: '4px', border: 'none', background: 'var(--bg-subtle)', color: 'var(--accent-primary)', fontWeight: '700' }}
                          >
                            VIEW CASE
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <div className={`detail-sidebar ${sidebarOpen ? 'open' : ''}`}>
        {selectedCaseDetail && (
          <>
            <div className="sidebar-header">
              <div className="sidebar-header-left">
                <h3 className="sidebar-header-main-title">
                  {selectedCaseDetail.title} — CASE DATA
                </h3>
                <div className="sidebar-badges-row">
                  <span className="sidebar-badge blue">{selectedCaseDetail.industry || 'Management Consulting'}</span>
                  <span className="sidebar-badge purple">CHAT ONLY</span>
                </div>
              </div>
              <button className="close-sidebar-btn" onClick={closeSidebar}>×</button>
            </div>
            <div className="sidebar-body">
              <div className="sidebar-case-content" style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
                {(() => {
                  const sections = selectedCaseDetail.parsed_sections?._sections || [];
                  return sections.map((s, idx) => (
                    <article key={idx} className="section-document-card">
                      <header className="section-card-header">
                        <div className="section-card-icon-box" style={{ color: 'var(--accent-primary)' }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                          </svg>
                        </div>
                        <h3 className="section-card-title">{idx + 1}. {s.heading}</h3>
                      </header>
                      <div className="section-card-content">
                        {renderSectionContent(s.content)}
                      </div>
                    </article>
                  ));
                })()}
              </div>
            </div>
          </>
        )}

        {selectedResponse && (
          <>
            <div className="sidebar-header">
              <div className="sidebar-header-left">
                <h3 className="sidebar-header-main-title">ATTEMPT DETAIL</h3>
                <div className="sidebar-candidate-card">
                  <div className="sidebar-avatar-box">
                    <div className="sidebar-avatar-wrapper">
                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(userEmail)}`} alt="Avatar" className="sidebar-avatar-img" />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="sidebar-name">{(selectedResponse.case_studies?.title || 'Case Study').toUpperCase()}</div>
                      <div className="sidebar-meta">{new Date(selectedResponse.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="sidebar-score-box">
                    <div className="sidebar-score-label">Final Score</div>
                    <div className="sidebar-score-value">{typeof selectedResponse.total_score === 'number' ? Math.round(selectedResponse.total_score) : '--'}</div>
                  </div>
                </div>
              </div>
              <button className="close-sidebar-btn" onClick={closeSidebar}>×</button>
            </div>

            <div className="sidebar-body">
              <div className="sidebar-section-title">QUESTION-WISE CONVERSATION</div>
              {selectedResponse.case_studies?.parsed_sections && renderCaseQuestions(selectedResponse.case_studies.parsed_sections)}
              
              <div className="sidebar-chat-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {loadingDetail ? (
                  <div className="admin-hint" style={{ padding: '20px', textAlign: 'center' }}>
                    Loading conversation...
                  </div>
                ) : (() => {
                  const history = toSafeArray(selectedResponse.chat_history);
                  if (history.length === 0) return <div className="admin-hint">No chat history found.</div>;
                  
                  // Extract unique questions from history for the filter
                  const questionsInHistory = [];
                  const seenQIds = new Set();
                  history.forEach(msg => {
                    if (msg.questionId && msg.questionId !== 'global' && !seenQIds.has(msg.questionId)) {
                      seenQIds.add(msg.questionId);
                      questionsInHistory.push(msg.questionId);
                    }
                  });

                  const filteredHistory = activeQuestionFilter === 'all' 
                    ? history 
                    : history.filter(msg => msg.questionId === activeQuestionFilter);

                  const exchanges = [];
                  let current = null;
                  filteredHistory.forEach(msg => {
                    const role = String(msg.role || '').toLowerCase();
                    if (role === 'assistant') {
                      if (current) exchanges.push(current);
                      current = { question: msg, answers: [] };
                    } else if (role === 'user') {
                      if (!current) current = { question: null, answers: [msg] };
                      else current.answers.push(msg);
                    }
                  });
                  if (current) exchanges.push(current);

                  return (
                    <>
                      {questionsInHistory.length > 0 && (
                        <div className="sidebar-filter-tabs" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '8px' }}>
                          <button 
                            className={`filter-tab ${activeQuestionFilter === 'all' ? 'active' : ''}`}
                            onClick={() => setActiveQuestionFilter('all')}
                            style={{ 
                              padding: '6px 12px', 
                              borderRadius: '20px', 
                              fontSize: '0.75rem', 
                              border: '1px solid var(--border-color)',
                              background: activeQuestionFilter === 'all' ? 'var(--accent-primary)' : 'transparent',
                              color: activeQuestionFilter === 'all' ? '#fff' : 'var(--text-secondary)',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            ALL CONVERSATION
                          </button>
                          {questionsInHistory.map((qId, idx) => (
                            <button 
                              key={qId}
                              className={`filter-tab ${activeQuestionFilter === qId ? 'active' : ''}`}
                              onClick={() => setActiveQuestionFilter(qId)}
                              style={{ 
                                padding: '6px 12px', 
                                borderRadius: '20px', 
                                fontSize: '0.75rem', 
                                border: '1px solid var(--border-color)',
                                background: activeQuestionFilter === qId ? 'var(--accent-primary)' : 'transparent',
                                color: activeQuestionFilter === qId ? '#fff' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              QUESTION {qId.replace('q-', '')}
                            </button>
                          ))}
                        </div>
                      )}

                      {exchanges.map((ex, idx) => {
                        // Skip introductory message only in "all" view
                        if (activeQuestionFilter === 'all' && idx === 0 && ex.question && /welcome|here are your problem questions/i.test(ex.question.content)) {
                          return null;
                        }
                        
                        return (
                          <div key={idx} className="sidebar-exchange-block">
                            {ex.question && (
                              <div className="sidebar-chat-bubble assistant">
                                <div className="bubble-content">{renderFormattedChatMessage(ex.question.content)}</div>
                              </div>
                            )}
                            {ex.answers.map((ans, aIdx) => (
                              <div key={aIdx} className="sidebar-chat-bubble user">
                                <div className="bubble-content">{renderFormattedChatMessage(ans.content)}</div>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </>
                  );
                })()}
              </div>
            </div>
          </>
        )}
      </div>
      
      {sidebarOpen && <div className="sidebar-backdrop" onClick={closeSidebar}></div>}
    </div>
  );
};

export default CandidateResults;
