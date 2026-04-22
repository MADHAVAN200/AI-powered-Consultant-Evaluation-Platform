import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useData } from '../context/DataContext';
import './AdminEvaluation.css';
import { API_BASE } from '../config/api';

const CandidateDashboard = () => {
  const { userEmail } = useData();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_BASE}/candidate/dashboard`, { params: { email: userEmail } });
        setDashboard(res.data?.dashboard || null);
      } catch (error) {
        console.error('Candidate dashboard fetch error:', error);
        setDashboard(null);
      } finally {
        setLoading(false);
      }
    };
    if (userEmail) fetchDashboard();
  }, [userEmail]);

  if (loading) {
    return <div className="admin-eval-page"><div className="admin-eval-layout">Loading candidate dashboard...</div></div>;
  }

  return (
    <div className="admin-eval-page">
      <div className="admin-eval-layout">
        <div className="admin-top-grid">
          <div className="admin-card">
            <div className="admin-card-title">MY SUMMARY</div>
            <div className="admin-hint">Track your attempts, outcomes and performance trend across all case studies.</div>
          </div>
          <div className="admin-metrics">
            <div className="admin-metric-card">
              <div className="admin-metric-name">TOTAL ATTEMPTS</div>
              <div className="admin-metric-value">{dashboard?.totalAttempts ?? 0}</div>
            </div>
            <div className="admin-metric-card">
              <div className="admin-metric-name">PASSED</div>
              <div className="admin-metric-value">{dashboard?.passCount ?? 0}</div>
            </div>
            <div className="admin-metric-card">
              <div className="admin-metric-name">FAILED</div>
              <div className="admin-metric-value">{dashboard?.failCount ?? 0}</div>
            </div>
            <div className="admin-metric-card">
              <div className="admin-metric-name">AVERAGE SCORE</div>
              <div className="admin-metric-value">{dashboard?.avgScore ?? 0}%</div>
            </div>
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-card-title">RECENT SUBMISSIONS</div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Case Study</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {(dashboard?.recent || []).map((row) => (
                  <tr key={row.id}>
                    <td>{row.case_studies?.title || 'Unknown'}</td>
                    <td><span className={`admin-status ${row.result_status || 'fail'}`}>{String(row.result_status || 'fail').toUpperCase()}</span></td>
                    <td>{row.total_score ?? row.assessment_scores?.[0]?.total_score ?? '--'}</td>
                    <td>{new Date(row.created_at).toLocaleString()}</td>
                  </tr>
                ))}
                {(dashboard?.recent || []).length === 0 && (
                  <tr><td colSpan={4} className="admin-hint">No evaluated submissions yet. Complete a case to see pass/fail results.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CandidateDashboard;
