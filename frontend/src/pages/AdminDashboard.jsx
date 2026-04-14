import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './AdminEvaluation.css';

const API_BASE = 'http://localhost:5000/api';

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);

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
    return <div className="admin-eval-page"><div className="admin-eval-layout">Loading dashboard...</div></div>;
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
          <div className="admin-card-title">RECENT ATTEMPTS</div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Case Study</th>
                  <th>Status</th>
                  <th>Started</th>
                </tr>
              </thead>
              <tbody>
                {(dashboard?.recentAttempts || []).map((row) => (
                  <tr key={row.id}>
                    <td>{row.candidate_email}</td>
                    <td>{row.case_studies?.title || 'Unknown'}</td>
                    <td><span className={`admin-status ${row.status}`}>{String(row.status || '').toUpperCase()}</span></td>
                    <td>{new Date(row.created_at).toLocaleString()}</td>
                  </tr>
                ))}
                {(dashboard?.recentAttempts || []).length === 0 && (
                  <tr><td colSpan={4} className="admin-hint">No attempts yet.</td></tr>
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
