import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './AdminEvaluation.css';

const API_BASE = 'http://localhost:5000/api';

const CandidateCaseStudies = () => {
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCases = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_BASE}/case-studies`);
        setCases(res.data?.cases || []);
      } catch (error) {
        console.error('Case list fetch error:', error);
        setCases([]);
      } finally {
        setLoading(false);
      }
    };
    fetchCases();
  }, []);

  if (loading) {
    return <div className="admin-eval-page"><div className="admin-eval-layout">Loading case studies...</div></div>;
  }

  return (
    <div className="admin-eval-page">
      <div className="admin-eval-layout">
        <div className="admin-card">
          <div className="admin-card-title">AVAILABLE CASE STUDIES</div>
          <div className="admin-hint">Review each case summary and key signals before starting your assessment.</div>
        </div>

        <div className="admin-card">
          <div className="candidate-case-list">
            {cases.map((c) => {
              const summary = String(c.context || '').replace(/\s+/g, ' ').trim();
              const snippet = summary.length > 220 ? `${summary.slice(0, 220)}...` : summary;
              const signalKeys = Object.keys(c.financial_data || {}).slice(0, 4);
              return (
                <article className="candidate-case-card-horizontal" key={c.id}>
                  <div className="candidate-case-head-horizontal">
                    <div>
                      <div className="candidate-case-title">{c.title}</div>
                      <div className="candidate-case-meta">{c.industry || 'General'} | Passing: {Math.round((Number(c.threshold_passing_score || 0.6) || 0.6) * 100)}%</div>
                    </div>
                    <button className="admin-btn primary" onClick={() => navigate(`/candidate/assessment/${c.id}`)}>
                      START CASE
                    </button>
                  </div>
                  <div className="candidate-case-summary">{snippet || 'No summary available for this case.'}</div>
                  <div className="candidate-signal-row">
                    {signalKeys.length > 0 ? signalKeys.map((k) => (
                      <span key={k} className="candidate-signal-pill">{String(k).replace(/_/g, ' ')}</span>
                    )) : <span className="admin-hint">No key signals listed</span>}
                  </div>
                </article>
              );
            })}
            {cases.length === 0 && (
              <div className="admin-hint">No case studies available yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CandidateCaseStudies;
