import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './AdminEvaluation.css';

const API_BASE = 'http://localhost:5000/api';

const getParsedSections = (row = {}) => {
  const raw = row?.parsed_sections ?? row?.parsedSections ?? {};
  if (raw && typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
};

const getCaseModeLabel = (row = {}) => {
  const parsed = getParsedSections(row);
  const modeRaw = parsed?._caseMode || row?.case_mode || row?.caseMode || 'chat_only';
  const mode = String(modeRaw).toLowerCase().replace(/[\s-]+/g, '_');
  return mode === 'mock_drill_chat' ? 'Mock Drill + Chat' : 'Chat Only';
};

const getCaseSections = (row = {}) => {
  const parsed = getParsedSections(row);
  if (Array.isArray(parsed?._sections) && parsed._sections.length > 0) {
    return parsed._sections
      .map((s, idx) => ({ id: `${idx + 1}`, heading: String(s?.heading || '').trim(), content: String(s?.content || '').trim() }))
      .filter((s) => s.heading || s.content);
  }

  const sections = [];
  if (row?.context) sections.push({ id: 'overview', heading: 'Overview', content: String(row.context) });
  if (row?.problem_statement || row?.problemStatement) sections.push({ id: 'problem', heading: 'Problem Statement', content: String(row.problem_statement || row.problemStatement) });
  if (row?.initial_prompt || row?.initialPrompt) sections.push({ id: 'prompt', heading: 'Initial Prompt', content: String(row.initial_prompt || row.initialPrompt) });
  return sections;
};

const CandidateCaseStudies = () => {
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState(null);

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
              const caseModeLabel = getCaseModeLabel(c);
              return (
                <article className="candidate-case-card-horizontal" key={c.id} onClick={() => setSelectedCase(c)} style={{ cursor: 'pointer' }}>
                  <div className="candidate-case-head-horizontal">
                    <div>
                      <div className="candidate-case-title">{c.title}</div>
                      <div className="candidate-case-meta">{c.industry || 'General'} | Passing: {Math.round((Number(c.threshold_passing_score || 0.6) || 0.6) * 100)}%</div>
                      <div className="candidate-case-meta" style={{ marginTop: '5px' }}>
                        <span className="case-chip case-mode-chip">{caseModeLabel}</span>
                      </div>
                    </div>
                    <button
                      className="admin-btn primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/candidate/assessment/${c.id}`);
                      }}
                    >
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

        {selectedCase && (
          <>
            <div className="case-drawer-backdrop" onClick={() => setSelectedCase(null)} />
            <aside className="case-drawer" role="dialog" aria-label="Case study details">
              <div className="case-drawer-head">
                <div>
                  <div className="case-list-title">{selectedCase.title}</div>
                  <div className="case-list-meta" style={{ marginTop: '6px' }}>
                    {selectedCase.industry && <span className="case-chip">{selectedCase.industry}</span>}
                    <span className="case-chip case-mode-chip">{getCaseModeLabel(selectedCase)}</span>
                    <span className="case-chip">PASS {Math.round((Number(selectedCase.threshold_passing_score || 0.6) || 0.6) * 100)}%</span>
                  </div>
                </div>
                <button className="icon-action-btn" onClick={() => setSelectedCase(null)} title="Close">✕</button>
              </div>

              <div className="drawer-actions">
                <button className="admin-btn primary" onClick={() => navigate(`/candidate/assessment/${selectedCase.id}`)}>START CASE</button>
              </div>

              <div className="drawer-summary" style={{ display: 'grid', gap: '10px' }}>
                {getCaseSections(selectedCase).map((sec) => (
                  <div key={sec.id}>
                    <div className="preview-field-label">{sec.heading}</div>
                    <div className="candidate-case-summary" style={{ marginBottom: 0 }}>{sec.content || 'No details available.'}</div>
                  </div>
                ))}
              </div>
            </aside>
          </>
        )}
      </div>
    </div>
  );
};

export default CandidateCaseStudies;
