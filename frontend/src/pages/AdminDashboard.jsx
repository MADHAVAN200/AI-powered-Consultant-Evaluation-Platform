import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './AdminEvaluation.css';
import { API_BASE } from '../config/api';
import PageLoader from '../components/PageLoader';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);

  const toDisplayName = (email = '') => String(email || '').split('@')[0] || 'unknown-user';

  const getMarksSummary = (row = {}) => {
    const scores = Array.isArray(row.assessment_scores) ? row.assessment_scores : [];
    const summed = scores.reduce(
      (acc, item) => {
        acc.obtained += Number(item?.total_score ?? item?.score ?? 0) || 0;
        acc.total += Number(item?.max_score ?? item?.total_possible_score ?? item?.total_marks ?? 0) || 0;
        return acc;
      },
      { obtained: 0, total: 0 }
    );

    const obtained = Number(row.total_score ?? summed.obtained) || 0;
    let total = Number(row.total_marks ?? row.max_score ?? summed.total) || 0;

    if (!total) {
      const threshold = Number(row?.case_studies?.threshold_passing_score ?? row?.threshold_passing_score ?? 0.6);
      if (obtained > 0 && threshold > 0 && threshold < 1) {
        total = Math.round(obtained / threshold);
      }
    }

    if (!total) total = obtained;

    return {
      obtained,
      total
    };
  };

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/admin/dashboard`);
      const data = res.data?.dashboard || null;
      setDashboard(data);
    } catch (error) {
      console.error('Dashboard fetch error:', error);
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="admin-eval-page">
        <PageLoader
          message="Loading Dashboard..."
          subMessage="Preparing candidate metrics and latest assessment outcomes."
        />
      </div>
    );
  }

  return (
    <div className="admin-eval-page">
      <div className="admin-eval-layout">
        <div className="admin-card">
          <div className="admin-card-title">KEY METRICS</div>
          <div className="admin-metrics-strip">
            <div className="admin-metric-card">
              <div className="admin-metric-name">TOTAL CANDIDATES</div>
              <div className="admin-metric-value">{dashboard?.totalCandidates ?? 0}</div>
            </div>
            <div className="admin-metric-card">
              <div className="admin-metric-name">AVERAGE SCORE</div>
              <div className="admin-metric-value">{dashboard?.avgScore ?? 0}%</div>
            </div>
            <div className="admin-metric-card">
              <div className="admin-metric-name">COMPLETED</div>
              <div className="admin-metric-value">{dashboard?.completedCount ?? 0}</div>
            </div>
            <div className="admin-metric-card">
              <div className="admin-metric-name">DISQUALIFIED</div>
              <div className="admin-metric-value">{dashboard?.disqualifiedCount ?? 0}</div>
            </div>
            <div className="admin-metric-card">
              <div className="admin-metric-name">ACTIVE SESSIONS</div>
              <div className="admin-metric-value">{dashboard?.activeSessions ?? 0}</div>
            </div>
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-card-title">RECENT ASSESSMENT RESULTS</div>
          <div className="dashboard-results-panel" role="region" aria-label="Recent assessment results">
            <table className="dashboard-results-table">
              <thead>
                <tr>
                  <th>User Name</th>
                  <th>Assessment</th>
                  <th>Date Taken</th>
                  <th>Score</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(dashboard?.recentAttempts || []).map((row) => {
                  const marks = getMarksSummary(row);
                  return (
                    <tr key={row.id}>
                      <td>
                        <div className="dashboard-user-name">{toDisplayName(row.candidate_email)}</div>
                      </td>
                      <td>
                        <div className="dashboard-assessment-title">{row.case_studies?.title || 'Unknown Assessment'}</div>
                      </td>
                      <td>
                        <div className="dashboard-date-cell">{new Date(row.created_at).toLocaleString()}</div>
                      </td>
                      <td>
                        <div className="dashboard-marks-line">
                          <span className="dashboard-marks-obtained">{marks.obtained}</span>
                          <span className="dashboard-marks-sep">/</span>
                          <span className="dashboard-marks-total">{marks.total}</span>
                          <span className="dashboard-marks-label">marks</span>
                        </div>
                      </td>
                      <td>
                        <button className="dashboard-action-link" onClick={() => navigate('/admin/results')}>
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {(dashboard?.recentAttempts || []).length === 0 && (
                  <tr><td colSpan={5} className="admin-hint">No attempts yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
