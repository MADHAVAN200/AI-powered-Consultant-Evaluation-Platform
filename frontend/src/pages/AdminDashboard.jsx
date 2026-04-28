import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './AdminEvaluation.css';
import { API_BASE } from '../config/api';
import PageLoader from '../components/PageLoader';
import CaseStudyDrawer from '../components/CaseStudyDrawer';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/admin/dashboard`);
      setDashboard(res.data?.dashboard || null);
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

  const [selectedCaseDetail, setSelectedCaseDetail] = useState(null);
  const [loadingCaseDetail, setLoadingCaseDetail] = useState(false);

  if (loading) {
    return (
      <div className="admin-eval-page">
        <PageLoader
          message="Preparing Analytics"
          subMessage="Fetching latest candidate metrics and activity trends."
        />
      </div>
    );
  }

  const stats = dashboard?.stats || {};
  const activityTrend = dashboard?.activityTrend || [];
  const recentActivity = dashboard?.recentActivity || [];
  const maxCount = Math.max(...activityTrend.map(d => d.count), 5);

  const fetchCaseDetail = async (caseId) => {
    if (!caseId) return;
    setLoadingCaseDetail(true);
    try {
      const res = await axios.get(`${API_BASE}/admin/case-studies/${caseId}`);
      setSelectedCaseDetail(res.data?.caseStudy || null);
    } catch (error) {
      console.error('Case detail fetch error:', error);
    } finally {
      setLoadingCaseDetail(false);
    }
  };

  const handleActivityClick = (act) => {
    if (act.caseStudyId) {
      fetchCaseDetail(act.caseStudyId);
    }
  };

  const handleEditCase = (id) => {
    navigate(`/admin/cases?edit=${id}`);
  };

  return (
    <div className="admin-eval-page dashboard-fixed">
      <div className="admin-eval-layout full-width" style={{ paddingTop: '0' }}>

        <CaseStudyDrawer
          caseStudy={selectedCaseDetail}
          onClose={() => setSelectedCaseDetail(null)}
          onEdit={handleEditCase}
        />

        <section className="dashboard-stats-row">
          <div className="stat-card">
            <div className="stat-card-head">
              <div className="stat-icon-box" style={{ background: 'rgba(31, 111, 235, 0.1)', color: '#1f6feb' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
              </div>
              <span className="stat-status-pill live">Live</span>
            </div>
            <div className="stat-label">Total Candidates</div>
            <div className="stat-value">{stats.totalCandidates ?? 0}</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-head">
              <div className="stat-icon-box" style={{ background: 'rgba(137, 87, 229, 0.1)', color: '#8957e5' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
              </div>
              <span className="stat-status-pill ready">Ready</span>
            </div>
            <div className="stat-label">Total Assessments</div>
            <div className="stat-value">{stats.totalAssessments ?? 0}</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-head">
              <div className="stat-icon-box" style={{ background: 'rgba(35, 134, 54, 0.1)', color: '#238636' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
              </div>
              <span className="stat-status-pill active">Active</span>
            </div>
            <div className="stat-label">Total Submissions</div>
            <div className="stat-value">{stats.totalSubmissions ?? 0}</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-head">
              <div className="stat-icon-box" style={{ background: 'rgba(210, 153, 34, 0.1)', color: '#d29922' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              </div>
              <span className="stat-status-pill avg">Avg</span>
            </div>
            <div className="stat-label">Avg. Time (Min)</div>
            <div className="stat-value">{stats.avgTimeMin ?? 0}</div>
          </div>
        </section>

        <section className="dashboard-main-grid half-half">
          {/* Platform Activity Chart */}
          <div className="dashboard-panel">
            <div className="dashboard-panel-head">
              <div>
                <div className="dashboard-panel-title">Platform Activity</div>
                <div className="dashboard-panel-desc">Assessment engagement over the last 7 days</div>
              </div>
            </div>
            <div className="chart-container">
              {activityTrend.map((data, idx) => (
                <div key={idx} className="chart-bar-wrap">
                  <div
                    className="chart-bar-fill"
                    style={{ height: `${(data.count / maxCount) * 100}%` }}
                  >
                    <div className="chart-bar-value-tooltip">{data.count}</div>
                  </div>
                  <div className="chart-bar-label">{data.day}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity List */}
          <div className="dashboard-panel">
            <div className="dashboard-panel-head">
              <div className="dashboard-panel-title">Recent Activity</div>
            </div>
            <div className="activity-feed flex-grow">
              {recentActivity.length === 0 ? (
                <div className="admin-hint" style={{ padding: '20px', textAlign: 'center' }}>No recent activity.</div>
              ) : (
                recentActivity.map((act) => (
                  <div 
                    key={act.id} 
                    className={`activity-item ${act.caseStudyId ? 'clickable' : ''}`}
                    onClick={() => handleActivityClick(act)}
                  >
                    <img
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(act.user)}&backgroundColor=b6e3f4,c0aede,d1d4f9`}
                      alt={act.user}
                      className="activity-avatar"
                    />
                    <div className="activity-content">
                      <div className="activity-text">
                        <b>{act.user}</b> {act.action}
                      </div>
                      <div className="activity-meta">
                        {new Date(act.timestamp).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                    <div className={`activity-dot ${act.status}`} style={{ marginLeft: 'auto' }}></div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

      </div>
    </div>
  );
};

export default AdminDashboard;
