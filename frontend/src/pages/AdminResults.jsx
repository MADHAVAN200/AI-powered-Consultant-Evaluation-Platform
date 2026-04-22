import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './AdminEvaluation.css';
import { API_BASE } from '../config/api';

const toSafeArray = (value) => (Array.isArray(value) ? value : []);

const AdminResults = () => {
  const [results, setResults] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchResults = async () => {
    setLoading(true);
    try {
      const [resResults, resAnalytics] = await Promise.all([
        axios.get(`${API_BASE}/admin/results`),
        axios.get(`${API_BASE}/admin/analytics`)
      ]);
      setResults(resResults.data?.results || []);
      setAnalytics(resAnalytics.data?.analytics || null);
    } catch (error) {
      console.error('Results fetch error:', error);
      setResults([]);
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, []);

  if (loading) {
    return <div className="admin-eval-page"><div className="admin-eval-layout">Loading results...</div></div>;
  }

  return (
    <div className="admin-eval-page">
      <div className="admin-eval-layout">
        <div className="admin-top-grid">
          <div className="admin-card">
            <div className="admin-card-title">ALL ATTEMPTS (WITH CONVERSATIONS)</div>
            <div className="admin-hint">Each attempt includes score, pass/fail status, candidate answers, and full chat transcript.</div>
          </div>

          <div className="admin-metrics">
            <div className="admin-metric-card">
              <div className="admin-metric-name">TOTAL ATTEMPTS</div>
              <div className="admin-metric-value">{analytics?.totalCandidates ?? 0}</div>
            </div>
            <div className="admin-metric-card">
              <div className="admin-metric-name">AVERAGE SCORE</div>
              <div className="admin-metric-value">{analytics?.avgScore ?? 0}%</div>
            </div>
            <div className="admin-metric-card">
              <div className="admin-metric-name">DISQUALIFICATION RATE</div>
              <div className="admin-metric-value">{analytics?.disqualificationRate ?? 0}%</div>
            </div>
          </div>
        </div>

        <div className="results-attempt-list">
          {results.map((row) => {
            const status = String(row.result_status || row.status || 'pending').toLowerCase();
            const score = row.total_score ?? row.assessment_scores?.[0]?.total_score ?? '--';
            const chatHistory = toSafeArray(row.chat_history);
            const candidateAnswers = chatHistory.filter((m) => String(m.role || '').toLowerCase() === 'user');

            return (
              <div key={row.id} className="admin-card results-attempt-card">
                <div className="results-attempt-head">
                  <div>
                    <div className="results-attempt-title">{row.case_studies?.title || 'Unknown Case Study'}</div>
                    <div className="admin-hint">Candidate: {row.candidate_email} | Step: {row.current_step || '--'} | Strikes: {row.strikes ?? 0}</div>
                    <div className="admin-hint">Date: {new Date(row.created_at).toLocaleString()}</div>
                  </div>
                  <div className="results-attempt-badges">
                    <span className={`admin-status ${status}`}>{status.toUpperCase()}</span>
                    <span className="results-score-badge">Score: {score}</span>
                  </div>
                </div>

                <div className="results-grid-2">
                  <div className="results-block">
                    <div className="results-block-title">CANDIDATE ANSWERS</div>
                    <div className="candidate-chat-history">
                      {candidateAnswers.length === 0 ? (
                        <div className="admin-hint">No answers submitted yet.</div>
                      ) : (
                        candidateAnswers.map((msg, idx) => (
                          <div key={idx} className="candidate-chat-item user">
                            <div className="candidate-chat-role">ANSWER {idx + 1}</div>
                            <div className="candidate-chat-content">{msg.content}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="results-block">
                    <div className="results-block-title">FULL CONVERSATION</div>
                    <div className="candidate-chat-history">
                      {chatHistory.length === 0 ? (
                        <div className="admin-hint">No conversation history found.</div>
                      ) : (
                        chatHistory.map((msg, idx) => {
                          const role = String(msg.role || '').toLowerCase();
                          const roleClass = role === 'assistant' ? 'assistant' : 'user';
                          return (
                            <div key={idx} className={`candidate-chat-item ${roleClass}`}>
                              <div className="candidate-chat-role">{String(msg.role || '').toUpperCase()}</div>
                              <div className="candidate-chat-content">{msg.content}</div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {results.length === 0 && (
            <div className="admin-card">
              <div className="admin-hint">No attempts available.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminResults;
