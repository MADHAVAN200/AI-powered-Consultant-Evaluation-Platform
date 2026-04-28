import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useData } from '../context/DataContext';
import { useNavigate } from 'react-router-dom';
import './AdminEvaluation.css';
import { API_BASE } from '../config/api';
import PageLoader from '../components/PageLoader';

const CandidateDashboard = () => {
  const { userEmail } = useData();
  const navigate = useNavigate();
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
    return (
      <div className="admin-eval-page">
        <PageLoader
          message="Loading Dashboard..."
          subMessage="Preparing your latest attempts, outcomes, and trend metrics."
        />
      </div>
    );
  }

  return (
    <div className="admin-eval-page dashboard-fixed">
      <div className="admin-eval-layout full-width" style={{ paddingTop: '0' }}>
        
        <section className="dashboard-stats-row">
          <div className="stat-card">
            <div className="stat-card-head">
              <div className="stat-icon-box" style={{ background: 'rgba(31, 111, 235, 0.1)', color: '#1f6feb' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
              </div>
            </div>
            <div className="stat-label">Total Attempts</div>
            <div className="stat-value">{dashboard?.totalAttempts ?? 0}</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-head">
              <div className="stat-icon-box" style={{ background: 'rgba(35, 134, 54, 0.1)', color: '#238636' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
              </div>
            </div>
            <div className="stat-label">Passed</div>
            <div className="stat-value">{dashboard?.passCount ?? 0}</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-head">
              <div className="stat-icon-box" style={{ background: 'rgba(248, 81, 73, 0.1)', color: '#f85149' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
              </div>
            </div>
            <div className="stat-label">Failed</div>
            <div className="stat-value">{dashboard?.failCount ?? 0}</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-head">
              <div className="stat-icon-box" style={{ background: 'rgba(210, 153, 34, 0.1)', color: '#d29922' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
              </div>
            </div>
            <div className="stat-label">Average Score</div>
            <div className="stat-value">{dashboard?.avgScore ?? 0}%</div>
          </div>
        </section>

        <section className="dashboard-main-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', width: '100%', gap: '20px' }}>
          <div className="dashboard-panel transparent">
            <div className="dashboard-panel-head">
              <div className="dashboard-panel-title">RECENT SUBMISSIONS</div>
              <button className="list-sort-btn" onClick={() => navigate('/candidate/results')}>View All</button>
            </div>
            <div className="activity-feed flex-grow" style={{ padding: '0px' }}>
              {(dashboard?.recent || []).length === 0 ? (
                <div className="admin-hint" style={{ textAlign: 'center', padding: '40px' }}>No evaluated submissions yet. Complete a case to see results.</div>
              ) : (
                <div className="detailed-response-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {(dashboard?.recent || []).map((row) => (
                    <div key={row.id} className="case-list-row clickable" onClick={() => navigate(`/candidate/results?open=${row.id}`)}>
                      <div className="case-list-leading">
                        <div className="case-icon-box" style={{ width: '36px', height: '36px' }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                        </div>
                        <div className="case-list-main">
                           <div className="case-title-row">
                             <div className="case-list-title" style={{ fontSize: '0.85rem' }}>{row.case_studies?.title?.toUpperCase()}</div>
                             <div className={`case-status-badge ${row.result_status || 'fail'}`} style={{ fontSize: '0.55rem' }}>
                                {String(row.result_status || 'fail').toUpperCase()}
                             </div>
                           </div>
                           <div className="case-list-meta-new">
                             <span className="meta-tag-small">Score: {row.total_score ?? row.assessment_scores?.[0]?.total_score ?? '--'}%</span>
                             <span className="meta-tag-small">{new Date(row.created_at).toLocaleDateString()}</span>
                           </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="dashboard-panel transparent">
             <div className="dashboard-panel-head">
               <div className="dashboard-panel-title">AVAILABLE CASE STUDIES</div>
               <button className="list-sort-btn" onClick={() => navigate('/candidate/cases')}>View All</button>
             </div>
             <div className="activity-feed flex-grow" style={{ padding: '0px' }}>
                {(dashboard?.caseStudies || []).length === 0 ? (
                  <div className="admin-hint" style={{ textAlign: 'center', padding: '40px' }}>No active case studies available.</div>
                ) : (
                  <div className="detailed-response-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {dashboard.caseStudies.map((cs) => (
                      <div key={cs.id} className="case-list-row clickable" onClick={() => navigate(`/candidate/assessment/${cs.id}`)}>
                         <div className="case-list-leading">
                            <div className="case-icon-box" style={{ width: '36px', height: '36px', color: 'var(--accent-primary)', background: 'rgba(31, 111, 235, 0.1)' }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>
                            </div>
                            <div className="case-list-main">
                               <div className="case-title-row">
                                 <div className="case-list-title" style={{ fontSize: '0.85rem' }}>{cs.title?.toUpperCase()}</div>
                                 <span className="case-status-badge active">NEW</span>
                               </div>
                               <div className="case-list-meta-new">
                                 <span className="meta-tag-small">{cs.industry?.toUpperCase() || 'STRATEGY'}</span>
                                 <span className="meta-tag-small">{cs.attemptCount || 0} ATTEMPTS</span>
                               </div>
                            </div>
                         </div>
                      </div>
                    ))}
                  </div>
                )}
             </div>
          </div>
        </section>

      </div>
    </div>
  );
};

export default CandidateDashboard;
