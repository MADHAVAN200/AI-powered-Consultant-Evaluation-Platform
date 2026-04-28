import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './AdminEvaluation.css';
import { API_BASE } from '../config/api';
import PageLoader from '../components/PageLoader';
import CaseStudyDrawer from '../components/CaseStudyDrawer';

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
        <section className="dashboard-main-grid single-column" style={{ display: 'grid', gridTemplateColumns: '1fr', width: '100%', gap: '20px' }}>
          <div className="dashboard-panel transparent">
            <div className="dashboard-panel-head">
              <div className="dashboard-panel-title">AVAILABLE CASE STUDIES</div>
              <div className="dashboard-panel-desc">Review each case summary and key signals before starting your assessment.</div>
            </div>
            <div className="activity-feed flex-grow">
              {cases.length === 0 ? (
                <div className="admin-hint">No case studies available yet.</div>
              ) : (
                <div className="cases-list" style={{ gap: '12px', display: 'flex', flexDirection: 'column' }}>
                  {cases.map((c) => {
                    const caseModeLabel = getCaseModeLabel(c);
                    return (
                      <div key={c.id} className="case-list-row clickable" onClick={() => setSelectedCase(c)}>
                        <div className="case-list-leading">
                          <div className="case-icon-box">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                          </div>
                          <div className="case-list-main">
                            <div className="case-title-row">
                              <div className="case-list-title">{c.title.toUpperCase()}</div>
                              <span className="case-status-badge active">READY</span>
                            </div>
                            <div className="case-list-meta-new">
                              <span className="meta-tag">{c.industry?.toUpperCase() || 'GENERAL'}</span>
                              <span className="meta-tag">{caseModeLabel.toUpperCase()}</span>
                              <span className="meta-tag">PASS {Math.round((Number(c.threshold_passing_score || 0.6) || 0.6) * 100)}%</span>
                            </div>
                          </div>
                        </div>
                        <div className="case-row-actions" style={{ borderLeft: 'none' }}>
                          <button
                            className="admin-btn start"
                            style={{ padding: '8px 16px', fontSize: '0.72rem', height: 'auto' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/candidate/assessment/${c.id}`);
                            }}
                          >
                            START CASE
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        <CaseStudyDrawer
          caseStudy={selectedCase}
          onClose={() => setSelectedCase(null)}
          onStart={(id) => navigate(`/candidate/assessment/${id}`)}
        />
      </div>
    </div>
  );
};

export default CandidateCaseStudies;
