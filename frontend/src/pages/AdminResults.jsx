import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './AdminEvaluation.css';
import { API_BASE } from '../config/api';
import PageLoader from '../components/PageLoader';
import { useBreadcrumb } from '../context/BreadcrumbContext';
import MetricChart from '../components/MetricLineChart';

const splitSectionContent = (content = '') => {
  const text = String(content || '').trim();
  if (!text) return { summary: '', entries: [] };
  const normalized = text.replace(/\s*[●•]\s*/g, '\n- ').replace(/\r\n/g, '\n');
  const lines = normalized.split('\n').map(l => l.trim()).filter(Boolean);
  const isInlineHeading = (l) => /:\s*$/.test(l) && l.length < 80;
  const isBullet = (l) => /^(\d+[.)]|[-*•● ])\s+/.test(l);
  const cleanBullet = (l) => l.replace(/^([-*•● ]|\d+[.)])\s*/, '').trim();
  const entries = [];
  const summaryLines = [];
  let reachedBody = false;
  lines.forEach(line => {
    if (isInlineHeading(line)) {
      reachedBody = true;
      entries.push({ type: 'heading', text: line });
    } else if (isBullet(line)) {
      reachedBody = true;
      entries.push({ type: 'bullet', text: cleanBullet(line) });
    } else if (!reachedBody) summaryLines.push(line);
    else entries.push({ type: 'text', text: line });
  });
  return { summary: summaryLines.join(' '), entries };
};

const renderSectionContent = (content) => {
  // Normalize content: ensure numbered lists (1) 2) or 1. 2.) start on new lines
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
    
    // Normalize content: trim and ensure numbered lists (1) 2) or 1. 2.) start on new lines
    // We remove the [^\n] check to be more aggressive, then clean up double newlines.
    const normalized = String(content)
        .replace(/\s*(\d+[).]\s+)/g, '\n$1')
        .replace(/\r\n/g, '\n')
        .replace(/\n\n+/g, '\n')
        .trim();
        
    return normalized.split('\n').map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <br key={idx} />;
        
        // Check if it's a list item
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
  
  // 1. Try to find Questions section in _sections array
  let questionsContent = null;
  const structuredSections = parsedSections._sections || [];
  const questionsSection = structuredSections.find(s => 
      /question|task|objective|ask|deliverable/i.test(s.heading)
  );
  
  if (questionsSection) {
      questionsContent = questionsSection.content;
  } else {
      // 2. Try to find in flat keys
      const qKey = Object.keys(parsedSections).find(k => 
          !k.startsWith('_') && /question|task|objective|ask|deliverable/i.test(k)
      );
      if (qKey) {
          questionsContent = parsedSections[qKey];
      } 
      // 3. Fallback to _problemQuestions array
      else if (Array.isArray(parsedSections._problemQuestions)) {
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

const parseSectionCards = (content = '') => {
  const lines = String(content || '').replace(/\r\n/g, '\n').split('\n').map((line) => line.trim());
  const blocks = [];
  const summaryLines = [];
  let currentBlock = null;

  const flushBlock = () => {
      if (!currentBlock) return;
      if (currentBlock.heading && currentBlock.items.length > 0) {
          blocks.push(currentBlock);
      }
      currentBlock = null;
  };

  for (const line of lines) {
      if (!line) {
          flushBlock();
          continue;
      }

      const isSubHeading = line.endsWith(':') && line.length <= 90 && !/^\d+[).]\s+/.test(line);
      const bulletMatch = line.match(/^(?:[-*•]|\d+[).])\s+(.+)$/);

      if (isSubHeading) {
          flushBlock();
          currentBlock = {
              heading: line.replace(/:\s*$/, '').trim(),
              items: []
          };
          continue;
      }

      const cleaned = bulletMatch ? bulletMatch[1].trim() : line;
      if (currentBlock) {
          currentBlock.items.push(cleaned);
      } else {
          summaryLines.push(cleaned);
      }
  }

  flushBlock();

  return {
      summary: summaryLines.join(' ').trim(),
      blocks
  };
};

const toSafeArray = (value) => (Array.isArray(value) ? value : []);

const AdminResults = () => {
  const navigate = useNavigate();
  const { setBreadcrumbs } = useBreadcrumb();
  const [results, setResults] = useState([]);
  const [caseStudies, setCaseStudies] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('cases'); // 'cases' | 'responses'
  const [selectedCase, setSelectedCase] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedResponse, setSelectedResponse] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeQuestionFilter, setActiveQuestionFilter] = useState('all');
  
  useEffect(() => {
    if (view === 'cases') {
      setBreadcrumbs([]);
      return;
    }

    const crumbs = [
      { label: 'Results', active: false, onClick: goBack }
    ];

    if (selectedCase) {
      crumbs.push({ label: selectedCase.title, active: true, pill: true });
    }

    setBreadcrumbs(crumbs);
    return () => setBreadcrumbs([]);
  }, [view, selectedCase, setBreadcrumbs]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resResults, resAnalytics, resCases] = await Promise.all([
        axios.get(`${API_BASE}/admin/results`),
        axios.get(`${API_BASE}/admin/analytics`),
        axios.get(`${API_BASE}/case-studies`)
      ]);
      setResults(resResults.data?.results || []);
      setAnalytics(resAnalytics.data?.analytics || null);
      setCaseStudies(resCases.data?.cases || []);
    } catch (error) {
      console.error('Results fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCaseClick = (cs) => {
    setSelectedCase(cs);
    setView('responses');
  };

  const handleResponseClick = async (resp) => {
    setSelectedCaseDetail(null); // Close case detail if open
    setSelectedResponse(resp);
    setSidebarOpen(true);
    
    // Fetch full detail if chat_history is missing
    if (!resp.chat_history || (Array.isArray(resp.chat_history) && resp.chat_history.length === 0)) {
      setLoadingDetail(true);
      try {
        const res = await axios.get(`${API_BASE}/admin/results/${resp.id}`);
        if (res.data?.success && res.data?.detail) {
          setSelectedResponse(res.data.detail);
          // Also update the local results list so we don't fetch again
          setResults(prev => prev.map(r => r.id === resp.id ? { ...r, ...res.data.detail } : r));
        }
      } catch (err) {
        console.error('Failed to fetch result detail:', err);
      } finally {
        setLoadingDetail(false);
      }
    }
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
    setSelectedResponse(null);
    setSelectedCaseDetail(null);
    setActiveQuestionFilter('all');
  };

  const goBack = () => {
    setView('cases');
    setSelectedCase(null);
  };

  const [selectedCaseDetail, setSelectedCaseDetail] = useState(null);
  const [loadingCaseDetail, setLoadingCaseDetail] = useState(false);

  const fetchCaseDetail = async (caseId) => {
    if (!caseId) return;
    setLoadingCaseDetail(true);
    try {
      const res = await axios.get(`${API_BASE}/admin/case-studies/${caseId}/detail`);
      setSelectedCaseDetail(res.data?.detail?.caseStudy || null);
      setSelectedResponse(null); // Close response if open
      setSidebarOpen(true);
    } catch (error) {
      console.error('Case detail fetch error:', error);
    } finally {
      setLoadingCaseDetail(false);
    }
  };

  const handleEditCase = (id) => {
    navigate(`/admin/cases?edit=${id}`);
  };

  if (loading) {
    return (
      <div className="admin-eval-page">
        <PageLoader
          message="Aggregating Results"
          subMessage="Syncing candidate performance data and platform analytics."
        />
      </div>
    );
  }

  // Filter results for the selected case
  const filteredResults = results.filter(r => r.case_study_id === selectedCase?.id);

  const totalAttempts = analytics?.totalCandidates ?? results.length;
  const avgScore = analytics?.avgScore ?? 0;
  const totalCases = caseStudies.length;

  return (
    <div className={`admin-eval-page dashboard-fixed ${sidebarOpen ? 'sidebar-active' : ''}`}>

      <div className="topbar-placeholder" />


      <div className="admin-eval-layout full-width" style={{ paddingTop: '0' }}>
        
        {view === 'cases' && (
          <section className="dashboard-stats-row">
            <div className="stat-card">
              <div className="stat-card-head">
                <div className="stat-icon-box" style={{ background: 'rgba(31, 111, 235, 0.1)', color: '#1f6feb' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                </div>
              </div>
              <div className="stat-label">Total Case Studies</div>
              <div className="stat-value">{totalCases}</div>
            </div>

            <div className="stat-card">
              <div className="stat-card-head">
                <div className="stat-icon-box" style={{ background: 'rgba(137, 87, 229, 0.1)', color: '#8957e5' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>
                </div>
              </div>
              <div className="stat-label">Total Submissions</div>
              <div className="stat-value">{totalAttempts}</div>
            </div>

            <div className="stat-card">
              <div className="stat-card-head">
                <div className="stat-icon-box" style={{ background: 'rgba(35, 134, 54, 0.1)', color: '#238636' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                </div>
              </div>
              <div className="stat-label">Average Score</div>
              <div className="stat-value">{Math.round(avgScore)}</div>
            </div>

            <div className="stat-card">
              <div className="stat-card-head">
                <div className="stat-icon-box" style={{ background: 'rgba(210, 153, 34, 0.1)', color: '#d29922' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                </div>
              </div>
              <div className="stat-label">Engagement Rate</div>
              <div className="stat-value">{(totalAttempts > 0 ? (totalAttempts / (totalCases || 1)).toFixed(1) : 0)}x</div>
            </div>
          </section>
        )}

        <section className="dashboard-main-grid single-column" style={{ display: 'grid', gridTemplateColumns: '1fr', width: '100%', gap: '20px' }}>
          
          {view === 'cases' && (
            <div className="dashboard-panel transparent">
              <div className="dashboard-panel-head">
                <div className="dashboard-panel-title">ALL CASE STUDIES</div>
                <div className="dashboard-panel-desc">Select a case study to view candidate responses</div>
              </div>
              <div className="activity-feed flex-grow">
                {caseStudies.length === 0 ? (
                  <div className="admin-hint">No case studies found.</div>
                ) : (
                  <div className="cases-list" style={{ gap: '12px', display: 'flex', flexDirection: 'column' }}>
                    {caseStudies.map((cs) => {
                      const caseAttempts = results.filter(r => r.case_study_id === cs.id);
                      const caseAvgScore = caseAttempts.length > 0 
                        ? (caseAttempts.reduce((acc, curr) => acc + (curr.total_score || 0), 0) / caseAttempts.length).toFixed(1)
                        : 0;

                      return (
                        <div key={cs.id} className="case-list-row clickable" onClick={() => handleCaseClick(cs)}>
                          <div className="case-list-leading">
                            <div className="case-icon-box">
                               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                            </div>
                            <div className="case-list-main">
                                <div className="case-title-row">
                                    <div className="case-list-title">{cs.title.toUpperCase()}</div>
                                    <span className="case-status-badge active">ACTIVE</span>
                                </div>
                                <div className="case-list-meta-new">
                                    <span className="meta-tag">{cs.industry?.toUpperCase() || 'GENERAL'}</span>
                                    <span className="meta-tag">{caseAttempts.length} RESPONSES</span>
                                    <span className="meta-tag">AVG. {Math.round(caseAvgScore)}</span>
                                </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {view === 'responses' && (
            <div className="dashboard-panel transparent">
              <div className="dashboard-panel-head">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div>
                      <div className="dashboard-panel-title">CANDIDATE RESPONSES</div>
                      <div className="dashboard-panel-desc">{filteredResults.length} total attempts for {selectedCase?.title}</div>
                    </div>
                  </div>
                  <button 
                      className="admin-btn secondary" 
                      onClick={() => fetchCaseDetail(selectedCase.id)}
                      style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                    >
                      VIEW CASE
                    </button>
                </div>
              </div>
              <div className="activity-feed flex-grow">
                {filteredResults.length === 0 ? (
                  <div className="admin-hint" style={{ padding: '20px' }}>No attempts for this case study.</div>
                ) : (
                  <div className="detailed-response-list">
                    {filteredResults.map((row) => {
                      const status = String(row.result_status || row.status || 'pending').toLowerCase();
                      const score = row.total_score ?? '--';
                      const dateObj = new Date(row.created_at);

                      return (
                        <div key={row.id} className="activity-item clickable detailed" onClick={() => handleResponseClick(row)}>
                          <div className="activity-leading">
                            <img
                              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(row.candidate_email)}`}
                              alt={row.candidate_email}
                              className="activity-avatar"
                            />
                            <div className="activity-content">
                              <div className="activity-text"><b>{row.candidate_email}</b></div>
                              <div className="activity-meta-tags">
                                <span className="meta-tag-small">{row.chat_count ?? 0} Messages</span>
                                <span className="meta-tag-small">Attempted {dateObj.toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="activity-trailing">
                            <div className="activity-status-box">
                               <div className={`admin-status ${status}`} style={{ fontSize: '0.6rem' }}>{status.toUpperCase()}</div>
                               <div className="results-score-badge large">{Math.round(score)}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
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
                  <span className="sidebar-badge green">PASS {Math.round((Number(selectedCaseDetail.threshold_passing_score || 0.6)) * 100)}</span>
                </div>
              </div>

              <button className="close-sidebar-btn" onClick={closeSidebar}>×</button>
            </div>
            <div className="sidebar-body">
              <div className="sidebar-case-content" style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
                {(() => {
                  const sections = selectedCaseDetail.parsed_sections?._sections || [];
                  return sections.map((s, idx) => {
                    return (
                      <article key={idx} className="section-document-card">
                        <header className="section-card-header">
                          <div className="section-card-icon-box">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                              <polyline points="14 2 14 8 20 8"></polyline>
                              <line x1="16" y1="13" x2="8" y2="13"></line>
                              <line x1="16" y1="17" x2="8" y2="17"></line>
                              <polyline points="10 9 9 9 8 9"></polyline>
                            </svg>
                          </div>
                          <h3 className="section-card-title">{idx + 1}. {s.heading}</h3>
                        </header>
                        
                        <div className="section-card-content">
                          {renderSectionContent(s.content)}
                        </div>
                      </article>
                    );
                  });
                })()}
                
                {selectedCaseDetail.financial_data?.series?.length > 0 && (
                  <div className="sidebar-section-block">
                     <div className="sidebar-section-title" style={{ color: 'var(--accent-primary)', marginBottom: '12px' }}>
                      FINANCIAL PERFORMANCE
                    </div>
                    <div className="sidebar-charts-grid" style={{ display: 'grid', gap: '16px' }}>
                      {selectedCaseDetail.financial_data.series.map((s, sIdx) => (
                        <MetricChart
                          key={sIdx}
                          label={s.label}
                          values={s.data}
                          xLabels={selectedCaseDetail.financial_data.timeline}
                          unit={s.unit}
                        />
                      ))}
                    </div>
                  </div>
                )}
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
                  <div className="sidebar-avatar-box" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="sidebar-avatar-wrapper">
                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedResponse.candidate_email}`} alt="Avatar" className="sidebar-avatar-img" />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="sidebar-name">{selectedResponse.candidate_email}</div>
                      <div className="sidebar-meta">{new Date(selectedResponse.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="sidebar-score-box">
                    <div className="sidebar-score-label">FINAL SCORE</div>
                    <div className="sidebar-score-value">{Math.round(selectedResponse.total_score)}</div>
                  </div>
                </div>
              </div>

              <button className="close-sidebar-btn" onClick={closeSidebar}>×</button>
            </div>

            <div className="sidebar-body">
              <div className="sidebar-section-title">
                QUESTION-WISE CONVERSATION
              </div>

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

export default AdminResults;
