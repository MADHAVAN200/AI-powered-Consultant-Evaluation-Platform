import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './AdminEvaluation.css';
import { API_BASE } from '../config/api';
import PageLoader from '../components/PageLoader';

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

const isCandidateVisibleSection = (section = {}) => {
  const role = String(section?.role || '').toLowerCase().trim();

  const hiddenRoles = new Set(['private', 'confidential', 'not_visible_to_candidate']);
  if (hiddenRoles.has(role)) return false;

  return true;
};

const getCaseSections = (row = {}) => {
  const parsed = getParsedSections(row);
  if (Array.isArray(parsed?._sections) && parsed._sections.length > 0) {
    return parsed._sections
      .map((s, idx) => ({ id: `${idx + 1}`, heading: String(s?.heading || '').trim(), content: String(s?.content || '').trim() }))
      .filter((s) => isCandidateVisibleSection(s) && (s.heading || s.content));
  }

  const sections = [];
  if (row?.context) sections.push({ id: 'overview', heading: 'Overview', content: String(row.context) });
  if (row?.problem_statement || row?.problemStatement) sections.push({ id: 'problem', heading: 'Problem Statement', content: String(row.problem_statement || row.problemStatement) });
  if (row?.initial_prompt || row?.initialPrompt) sections.push({ id: 'prompt', heading: 'Initial Prompt', content: String(row.initial_prompt || row.initialPrompt) });
  return sections;
};

const splitSectionContent = (content = '') => {
  const text = String(content || '').trim();
  if (!text) return { summary: '', entries: [] };

  const normalized = text.replace(/\r\n/g, '\n');
  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const isInlineHeading = (line) => /:\s*$/.test(line) && line.length < 80 && !/^\d+[.)]\s+/.test(line);
  const isBullet = (line) => /^(\d+[.)]|[-*•])\s+/.test(line);
  const cleanBullet = (line) => String(line || '')
    .replace(/^(\d+[.)]\s*|[-*•]+\s*)+/g, '')
    .replace(/^[.:;\-\s]+/, '')
    .trim();

  const entries = [];
  const summaryLines = [];
  let reachedBody = false;

  lines.forEach((line) => {
    // Handle inline bullet sequences like: "Revenue Trend: • Jan ... • Feb ..."
    if (line.includes('•')) {
      const parts = line.split('•').map((p) => p.trim()).filter(Boolean);
      const lead = parts.shift();

      if (lead) {
        if (isInlineHeading(lead)) {
          entries.push({ type: 'heading', text: lead.replace(/:\s*$/, '').trim() });
        } else if (!reachedBody) {
          summaryLines.push(lead);
        } else if (reachedBody) {
          entries.push({ type: 'heading', text: lead.replace(/:\s*$/, '').trim() });
        }
      }

      parts.forEach((part) => {
        const clean = cleanBullet(part);
        if (clean) entries.push({ type: 'bullet', text: clean });
      });

      reachedBody = true;
      return;
    }

    if (!reachedBody && !isInlineHeading(line) && !isBullet(line)) {
      summaryLines.push(line);
      return;
    }

    reachedBody = true;

    if (isInlineHeading(line)) {
      entries.push({ type: 'heading', text: line.replace(/:\s*$/, '').trim() });
      return;
    }

    const clean = cleanBullet(line);
    if (clean) entries.push({ type: 'bullet', text: clean });
  });

  const dedupedEntries = [];
  const seen = new Set();
  entries.forEach((entry) => {
    const key = `${entry.type}:${String(entry.text || '').toLowerCase().trim()}`;
    if (!key || seen.has(key)) return;
    seen.add(key);
    dedupedEntries.push(entry);
  });

  const summarySource = summaryLines.join(' ').trim() || (entries.length === 0 ? text : '');
  const summary = summarySource.length > 240 ? `${summarySource.slice(0, 240).trim()}...` : summarySource;

  return {
    summary,
    entries: dedupedEntries
  };
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
    return (
      <div className="admin-eval-page">
        <PageLoader
          message="Loading Case Studies..."
          subMessage="Gathering available cases and preparing summaries for review."
        />
      </div>
    );
  }

  return (
    <div className="admin-eval-page">
      <div className="admin-eval-layout">
        <div className="admin-card">
          <div className="admin-card-title">AVAILABLE CASE STUDIES</div>
          <div className="admin-hint">Review each case summary and key signals before starting your assessment.</div>
        </div>

        <div className="candidate-case-panel">
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

              <div className="drawer-summary">
                {getCaseSections(selectedCase).map((sec) => (
                  <section className="drawer-section-card" key={sec.id}>
                    <div className="drawer-section-title">{sec.heading}</div>
                    {(() => {
                      const { summary, entries } = splitSectionContent(sec.content);
                      return (
                        <>
                          <div className="drawer-section-summary">{summary || 'No details available.'}</div>
                          {entries.length > 0 && (
                            <div className="drawer-entry-list">
                              {entries.map((entry, index) => (
                                entry.type === 'heading' ? (
                                  <div key={`${sec.id}-h-${index}`} className="drawer-inline-heading">{entry.text}</div>
                                ) : (
                                  <div key={`${sec.id}-b-${index}`} className="drawer-bullet-item">{/question/i.test(String(sec.heading || '')) ? `${entries.slice(0, index + 1).filter((e) => e.type === 'bullet').length}. ${entry.text}` : entry.text}</div>
                                )
                              ))}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </section>
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
