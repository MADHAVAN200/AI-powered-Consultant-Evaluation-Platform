import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useData } from '../context/DataContext';
import './AdminEvaluation.css';

const API_BASE = 'http://localhost:5000/api';

const toSafeArray = (value) => (Array.isArray(value) ? value : []);

const CandidateResults = () => {
  const { userEmail } = useData();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return <div className="admin-eval-page"><div className="admin-eval-layout">Loading candidate results...</div></div>;
  }

  return (
    <div className="admin-eval-page">
      <div className="admin-eval-layout">
        <div className="admin-card">
          <div className="admin-card-title">MY ATTEMPTED CASE STUDIES</div>
          <div className="admin-hint">View every attempt with your answers, full conversation, pass/fail status, and score.</div>
        </div>

        <div className="results-attempt-list">
          {results.map((row) => {
            const status = String(row.result_status || row.status || 'pending').toLowerCase();
            const score = row.total_score ?? row.assessment_scores?.[0]?.total_score ?? '--';
            const chatHistory = toSafeArray(row.chat_history);
            const myAnswers = chatHistory.filter((m) => String(m.role || '').toLowerCase() === 'user');

            return (
              <div key={row.id} className="admin-card results-attempt-card">
                <div className="results-attempt-head">
                  <div>
                    <div className="results-attempt-title">{row.case_studies?.title || 'Unknown Case Study'}</div>
                    <div className="admin-hint">Date: {new Date(row.created_at).toLocaleString()} | Step: {row.current_step || '--'} | Strikes: {row.strikes ?? 0}</div>
                  </div>
                  <div className="results-attempt-badges">
                    <span className={`admin-status ${status}`}>{status.toUpperCase()}</span>
                    <span className="results-score-badge">Score: {score}</span>
                  </div>
                </div>

                <div className="results-grid-2">
                  <div className="results-block">
                    <div className="results-block-title">MY ANSWERS</div>
                    <div className="candidate-chat-history">
                      {myAnswers.length === 0 ? (
                        <div className="admin-hint">No answers submitted yet.</div>
                      ) : (
                        myAnswers.map((msg, idx) => (
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
              <div className="admin-hint">No submissions yet.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CandidateResults;
