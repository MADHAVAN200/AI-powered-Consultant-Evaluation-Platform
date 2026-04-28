import React from 'react';
import MetricChart from './MetricLineChart';

const splitSectionContent = (content = '') => {
    const text = String(content || '').trim();
    if (!text) return { summary: '', entries: [] };

    // Handle single-line bullet strings using " ● " or " • "
    // We convert these into standard newlines with a bullet marker
    const normalized = text
        .replace(/\s*[●•]\s*/g, '\n- ')
        .replace(/\r\n/g, '\n');

    const lines = normalized
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

    const isInlineHeading = (line) => /:\s*$/.test(line) && line.length < 80 && !/^\d+[.)]\s+/.test(line);
    const isBullet = (line) => /^(\d+[.)]|[-* ])\s+/.test(line);
    
    // Improved cleanBullet: preserve numbers if the user wants "proper points format"
    const cleanBullet = (line) => {
        if (/^\d+[.)]\s+/.test(line)) return line; // Keep numbers like "1. "
        return line.replace(/^[-* ]\s*/, '').trim();
    };

    const entries = [];
    const summaryLines = [];
    let reachedBody = false;

    lines.forEach((line) => {
        if (isInlineHeading(line)) {
            reachedBody = true;
            entries.push({ type: 'heading', text: line });
        } else if (isBullet(line)) {
            reachedBody = true;
            entries.push({ type: 'bullet', text: cleanBullet(line) });
        } else if (!reachedBody) {
            summaryLines.push(line);
        } else {
            entries.push({ type: 'text', text: line });
        }
    });

    return {
        summary: summaryLines.join(' '),
        entries
    };
};

const getCaseModeMeta = (source = {}) => {
    const parsed = (source?.parsedSections && typeof source.parsedSections === 'object')
        ? source.parsedSections
        : ((source?.parsed_sections && typeof source.parsed_sections === 'object') ? source.parsed_sections : {});

    const modeRaw = parsed?._caseMode || source?.case_mode || source?.caseMode || 'chat_only';
    const mode = String(modeRaw).toLowerCase().replace(/[\s-]+/g, '_');
    if (mode === 'mock_drill_chat') {
        return { mode, label: 'Mock Drill + Chat' };
    }
    return { mode: 'chat_only', label: 'Chat Only' };
};

const CaseStudyDrawer = ({ caseStudy, onClose, onEdit, onStart }) => {
    if (!caseStudy) return null;

    const sectionsObj = caseStudy.parsedSections || caseStudy.parsed_sections || {};
    const sectionsArray = sectionsObj._sections || [];
    
    let drawerSections = [];
    if (Array.isArray(sectionsArray) && sectionsArray.length > 0) {
        drawerSections = sectionsArray.map((s, idx) => ({
            id: s.id || `section-${idx}`,
            heading: s.heading,
            content: s.content,
            role: s.role
        }));
    } else {
        // Fallback to entries for older data
        drawerSections = Object.entries(sectionsObj)
            .filter(([k]) => !k.startsWith('_'))
            .map(([k, v]) => ({ id: k, heading: k.replace(/_/g, ' ').toUpperCase(), content: v }));
    }

    // Add Questions if present and not already a section
    const hasQuestionsSection = drawerSections.some(s => /question/i.test(s.heading));
    if (!hasQuestionsSection && caseStudy.problemStatement) {
        drawerSections.push({
            id: 'problem-statement',
            heading: 'QUESTIONS',
            content: caseStudy.problemStatement,
            role: 'problem'
        });
    }

    const financialData = caseStudy.financialData || caseStudy.financial_data || {};
    const drawerMetricRows = (financialData.series || []).map((s) => ({
        key: s.label,
        label: s.label,
        values: s.data,
        unit: s.unit || 'count'
    }));
    const drawerTimelineLabels = financialData.timeline || [];

    return (
        <>
            <div className="case-drawer-backdrop" onClick={onClose} />
            <aside className="case-drawer premium-sidebar" role="dialog">
                <div className="case-drawer-head">
                    <div className="drawer-header-left">
                        <div className="drawer-main-title">{caseStudy.title}</div>
                        <div className="drawer-meta-tags">
                            {caseStudy.industry && <span className="drawer-tag industry">{caseStudy.industry}</span>}
                            <span className="drawer-tag mode">{getCaseModeMeta(caseStudy).label}</span>
                            <span className="drawer-tag score">PASS {Math.round((Number(caseStudy.thresholdPassingScore || caseStudy.threshold_passing_score || 0.6)) * 100)}%</span>
                        </div>
                    </div>
                    <button className="drawer-close-btn" onClick={onClose} title="Close">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                <div className="drawer-actions-row">
                    {onEdit && (
                        <button className="drawer-action-btn secondary" onClick={() => onEdit(caseStudy.id)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            <span>Edit Case Study</span>
                        </button>
                    )}
                    {onStart && (
                        <button className="drawer-action-btn primary start-btn" onClick={() => onStart(caseStudy.id)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                            <span>Start Case</span>
                        </button>
                    )}
                </div>

                <div className="drawer-scroll-content">
                    {drawerSections.map((s) => (
                        <section className="drawer-content-card" key={`drawer-${s.id}`}>
                            <div className="drawer-content-title">
                                <span className="title-icon">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                </span>
                                <span>{s.heading}</span>
                            </div>
                            {(() => {
                                const { summary, entries } = splitSectionContent(s.content);
                                return (
                                    <div className="drawer-card-body">
                                        {summary && <div className="drawer-card-summary">{summary}</div>}
                                        {entries.length > 0 && (
                                            <div className="drawer-bullet-list">
                                                {entries.map((entry, index) => (
                                                    entry.type === 'heading' ? (
                                                        <div key={index} className="drawer-inline-heading">{entry.text}</div>
                                                    ) : (
                                                        <div key={index} className="drawer-bullet-row">
                                                            {!/^\d+[.)]/.test(entry.text) && <span className="bullet-dot"></span>}
                                                            <span className="bullet-text" style={{ marginLeft: /^\d+[.)]/.test(entry.text) ? '0' : 'inherit' }}>{entry.text}</span>
                                                        </div>
                                                    )
                                                ))}
                                            </div>
                                        )}
                                        {!summary && entries.length === 0 && <div className="drawer-card-summary" style={{ opacity: 0.5 }}>No details available.</div>}
                                    </div>
                                );
                            })()}
                        </section>
                    ))}

                    {drawerMetricRows.length > 0 && (
                        <div className="drawer-metrics-grid">
                            <div className="drawer-content-title" style={{ gridColumn: '1 / -1', marginBottom: '8px' }}>
                                <span className="title-icon">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                                </span>
                                <span>FINANCIAL PERFORMANCE</span>
                            </div>
                            {drawerMetricRows.map((row) => (
                                <MetricChart
                                    key={`drawer-chart-${row.key}`}
                                    label={row.label}
                                    values={row.values}
                                    xLabels={drawerTimelineLabels}
                                    unit={row.unit}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </aside>
        </>
    );
};

export default CaseStudyDrawer;
