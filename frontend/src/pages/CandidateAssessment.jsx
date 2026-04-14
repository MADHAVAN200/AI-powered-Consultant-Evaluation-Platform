import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useData } from '../context/DataContext';
import './Assessment.css';

const API_BASE = 'http://localhost:5000/api';

// ─── Message Formatter ─────────────────────────────────────────────────────
// Renders chat message content with proper visual structure:
// numbered lists, bullet points, labelled sections, and plain paragraphs.
const renderFormattedMessage = (content) => {
    const lines = String(content || '').split('\n');
    const elements = [];
    let currentGroup = [];
    let groupType = null; // 'bullets' | 'numbered' | 'text'
    let globalCounter = 0; // track question numbers across entire message

    const flushGroup = () => {
        if (currentGroup.length === 0) return;
        if (groupType === 'bullets') {
            elements.push(
                <ul key={elements.length} className="msg-list bullet-list">
                    {currentGroup.map((l, i) => <li key={i}>{l}</li>)}
                </ul>
            );
        } else if (groupType === 'numbered') {
            elements.push(
                <ol key={elements.length} className="msg-list numbered-list" start={globalCounter - currentGroup.length + 1}>
                    {currentGroup.map((l, i) => <li key={i}>{l}</li>)}
                </ol>
            );
        } else {
            currentGroup.forEach((l, i) => {
                elements.push(<p key={`${elements.length}-${i}`} className="msg-para">{l}</p>);
            });
        }
        currentGroup = [];
        groupType = null;
    };

    lines.forEach((rawLine) => {
        const line = rawLine.trim();
        if (!line) { flushGroup(); return; }

        // Numbered list: "1) ...", "2. ..."
        if (/^\d+[).:]\s/.test(line)) {
            if (groupType !== 'numbered') { flushGroup(); groupType = 'numbered'; }
            globalCounter++;
            currentGroup.push(line.replace(/^\d+[).:] ?/, '').trim());
        // Bullet: "- ...", "• ...", "→ ...", "— ..."
        } else if (/^[-•→—]\s/.test(line)) {
            if (groupType !== 'bullets') { flushGroup(); groupType = 'bullets'; }
            currentGroup.push(line.replace(/^[-•→—]\s/, '').trim());
        // Section label: all-caps ending in colon, short
        } else if (line.endsWith(':') && line.length < 40 && line === line.toUpperCase() && /[A-Z]/.test(line)) {
            flushGroup();
            elements.push(<p key={elements.length} className="msg-section-label">{line}</p>);
        } else {
            if (groupType !== 'text') { flushGroup(); groupType = 'text'; }
            currentGroup.push(line);
        }
    });
    flushGroup();
    return elements.length > 0 ? elements : <p className="msg-para">{content}</p>;
};

// ─── Sidebar Section Card ──────────────────────────────────────────────────
const SidebarCard = ({ label, variant = 'default', children }) => (
    <div className={`sidebar-card sidebar-card--${variant}`}>
        <div className="sidebar-card__header">
            <h3 className="sidebar-card__title">{label}</h3>
        </div>
        <div className="sidebar-card__body">{children}</div>
    </div>
);


// ─── Spark Bar Chart ───────────────────────────────────────────────────────
const SparkBar = ({ label, values }) => {
    const nums = values.map(Number).filter(Number.isFinite);
    const maxAbs = Math.max(...nums.map(Math.abs), 1);
    const isNegativeTrend = nums[nums.length - 1] < nums[0];
    return (
        <div className="spark-chart">
            <span className="spark-label">{label}</span>
            <div className="spark-bars">
                {nums.map((v, i) => (
                    <div key={i} className="spark-bar-col">
                        <div
                            className={`spark-bar-fill ${v < 0 ? 'negative' : ''}`}
                            style={{ height: `${Math.max(6, (Math.abs(v) / maxAbs) * 100)}%` }}
                        />
                    </div>
                ))}
            </div>
            <div className="spark-range">
                <span>{nums[0]}</span>
                <span className={isNegativeTrend ? 'trend-down' : 'trend-up'}>
                    {isNegativeTrend ? '▼' : '▲'} {nums[nums.length - 1]}
                </span>
            </div>
        </div>
    );
};

// ─── Main Component ────────────────────────────────────────────────────────
const CandidateAssessment = ({ isDemo = false, isDirectCase = false }) => {
    const { inviteId, caseStudyId } = useParams();
    const { userEmail, userRole } = useData();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [briefLoading, setBriefLoading] = useState(false);
    const [session, setSession] = useState(null);
    const [caseStudy, setCaseStudy] = useState(null);
    const [brief, setBrief] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [status, setStatus] = useState('active');
    const [strikes, setStrikes] = useState(0);
    const [attemptsLeft, setAttemptsLeft] = useState(3);
    const [currentStep, setCurrentStep] = useState('diagnostic');
    const [scoreBreakdown, setScoreBreakdown] = useState(null);
    const [scoring, setScoring] = useState(null);
    const [coachNote, setCoachNote] = useState('Answer with data-backed reasoning. Reference specific metrics from the case document.');
    const [error, setError] = useState(null);
    const chatEndRef = useRef(null);
    const dashboardPath = userRole === 'admin' ? '/admin/dashboard' : '/candidate/dashboard';

    useEffect(() => { validateAndStart(); }, [inviteId, caseStudyId, isDemo, isDirectCase, userEmail]);
    useEffect(() => { document.body.classList.add('assessment-lock'); return () => document.body.classList.remove('assessment-lock'); }, []);
    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
    useEffect(() => { if (caseStudy?.id) fetchBrief(caseStudy.id); }, [caseStudy?.id]);

    const fetchBrief = async (id) => {
        setBriefLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/case-studies/${id}/brief`);
            if (res.data.success) setBrief(res.data.brief);
        } catch (err) {
            console.warn('[BRIEF] Failed:', err.message);
            setBrief(buildFallbackBrief(caseStudy));
        } finally {
            setBriefLoading(false);
        }
    };

    const buildFallbackBrief = (cs) => ({
        companyOverview: [cs?.context?.split('\n').find((l) => l.trim().length > 40) || 'Review the case document.'],
        primaryQuestion: cs?.initial_prompt || 'Diagnose the core business problem.',
        problemStatement: cs?.initial_prompt || 'Diagnose the core business problem.',
        keyInsights: [],
        keyMetrics: Object.entries(cs?.financial_data || {}).slice(0, 8).map(([k, v]) => ({
            label: k.replace(/_/g, ' ').toUpperCase(),
            value: Array.isArray(v) ? `${v[0]} → ${v[v.length - 1]}` : String(v)
        })),
        businessEvents: ['Use data trends and events to form hypotheses.'],
        expectedOutput: ['Identify root causes.', 'Provide a data-backed action plan.', 'Call out risks.'],
        difficulty: 'Medium',
        estimatedMinutes: 30
    });

    const applySessionData = (sess, cs) => {
        setSession(sess);
        setCaseStudy(cs);
        const history = Array.isArray(sess.chat_history) && sess.chat_history.length > 0
            ? sess.chat_history
            : [{ role: 'assistant', content: cs.initial_prompt }];
        setMessages(history);
        setStatus(sess.status || 'active');
        setStrikes(sess.strikes || 0);
        setAttemptsLeft(Math.max(0, 3 - (sess.strikes || 0)));
        setCurrentStep(sess.current_step || 'diagnostic');
        setLoading(false);
    };

    const validateAndStart = async () => {
        setLoading(true); setError(null);
        try {
            if (isDirectCase && caseStudyId) {
                const r = await axios.post(`${API_BASE}/candidate/cases/${caseStudyId}/start`, { email: userEmail || 'candidate@enterprise.ai' });
                if (r.data.success) { applySessionData(r.data.session, r.data.caseStudy); return; }
            }
            if (isDemo) {
                const caseRes = await axios.get(`${API_BASE}/case-studies`);
                if (caseRes.data.success && caseRes.data.cases.length > 0) {
                    const r = await axios.post(`${API_BASE}/assess/demo/start`, { caseStudyId: caseRes.data.cases[0].id, email: 'demo-candidate@enterprise.ai' });
                    if (r.data.success) { applySessionData(r.data.session, r.data.caseStudy); return; }
                } else throw new Error('No case studies available.');
            }
            if (!inviteId && !isDemo) throw new Error('Missing Invite ID');
            const invRes = await axios.get(`${API_BASE}/invites/${inviteId}`);
            if (invRes.data.success) {
                const r = await axios.post(`${API_BASE}/assess/start`, { inviteId, email: invRes.data.invite.candidate_email });
                applySessionData(r.data.session, r.data.caseStudy);
            }
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Failed to initialize assessment.');
            setLoading(false);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim() || isSending || status !== 'active') return;
        const userMsg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setIsSending(true);
        try {
            const res = await axios.post(`${API_BASE}/assess/respond`, { sessionId: session.id, userMessage: userMsg, currentStep });
            if (res.data.success) {
                setMessages(prev => [...prev, { role: 'assistant', content: res.data.aiResponse }]);
                setStatus(res.data.status);
                setStrikes(res.data.strikes);
                setAttemptsLeft(res.data.attemptsLeft ?? Math.max(0, 3 - (res.data.strikes || 0)));
                setCurrentStep(res.data.currentStep || currentStep);
                setScoreBreakdown(res.data.scoreBreakdown || null);
                setScoring(res.data.scoring || null);
                if (res.data.conversationalFeedback) setCoachNote(res.data.conversationalFeedback);
            }
        } catch (err) {
            console.error('Chat error:', err);
            if (isDemo && err?.response?.status === 403) {
                await validateAndStart();
                setMessages(prev => [...prev, { role: 'assistant', content: 'Session refreshed. Please resend your last response.' }]);
            }
        } finally { setIsSending(false); }
    };

    // ── Loading / Error screens ──────────────────────────────────────────────
    if (loading) return (
        <div className="assessment-loading-state">
            <div className="loading-card glassmorphism">
                <div className="spinner" />
                <h2 className="loading-title">INITIALIZING SECURE PROTOCOL</h2>
                <p className="loading-sub">SYNCING INTELLIGENCE NODES...</p>
            </div>
        </div>
    );

    if (error) return (
        <div className="assessment-loading-state">
            <div className="loading-card glassmorphism error-card">
                <div className="error-icon">⚠️</div>
                <h2 className="loading-title" style={{ color: '#f85149' }}>INITIALIZATION FAILED</h2>
                <p className="loading-sub" style={{ opacity: 0.85, margin: '12px 0' }}>{error}</p>
                <button className="btn-primary" onClick={() => navigate(dashboardPath)}>RETURN TO DASHBOARD</button>
            </div>
        </div>
    );

    // ── Derive chart data ────────────────────────────────────────────────────
    const chartSeries = Object.entries(caseStudy?.financial_data || {})
        .filter(([, v]) => Array.isArray(v) && v.length > 1)
        .slice(0, 5);

    const threshold = Number(brief?.passingThreshold ?? caseStudy?.threshold_passing_score ?? 0.6);
    const passingMarks = Number.isFinite(Number(brief?.passingMarks))
        ? Number(brief.passingMarks)
        : Math.round((Number.isFinite(threshold) ? threshold : 0.6) * 100);

    // Parse problem statement sub-questions
    const problemLines = (brief?.problemStatement || brief?.primaryQuestion || caseStudy?.initial_prompt || '')
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0);

    const numberedQs = problemLines.filter(l => /^\d+[).:]/.test(l));
    const introLines = problemLines.filter(l => !/^\d+[).:]/.test(l));

    // Phase step labels
    const stepLabels = { diagnostic: '01', brainstorming: '02', calculations: '03', final_recommendation: '04' };
    const stepNames  = { diagnostic: 'Diagnose', brainstorming: 'Brainstorm', calculations: 'Calculate', final_recommendation: 'Recommend' };

    return (
        <div className="assessment-portal">

            {/* ═══ LEFT SIDEBAR ══════════════════════════════════════════════ */}
            <aside className="assessment-sidebar">

                {/* Case Header */}
                <div className="sidebar-case-header">
                    <div className="case-header-top">
                        <span className="case-tag-pill">LIVE CASE</span>
                        <span className="pass-pill">PASS {passingMarks}/100</span>
                        {brief?.difficulty && (
                            <span className={`difficulty-pill difficulty-pill--${brief.difficulty.toLowerCase()}`}>
                                {brief.difficulty.toUpperCase()}
                            </span>
                        )}
                        {brief?.estimatedMinutes && (
                            <span className="time-pill">~{brief.estimatedMinutes} MIN</span>
                        )}
                    </div>
                    <h1 className="case-title">{caseStudy.title}</h1>
                    <p className="case-industry">{caseStudy.industry || 'Business Strategy'}</p>
                </div>

                {/* Company Overview */}
                <SidebarCard label="COMPANY OVERVIEW">
                    {briefLoading ? (
                        <p className="brief-shimmer">Generating AI summary...</p>
                    ) : (
                        (brief?.companyOverview || ['Review the context and identify the key performance problem.']).map((line, i) => (
                            <p key={i} className="overview-line">{line}</p>
                        ))
                    )}
                </SidebarCard>

                {/* Problem Statement — primary card */}
                <SidebarCard label="PROBLEM STATEMENT" variant="accent">
                    {introLines.filter(l => !/^\d/.test(l)).slice(0, 2).map((l, i) => (
                        <p key={i} className="problem-intro">{l}</p>
                    ))}
                    {numberedQs.length > 0 ? (
                        <ol className="problem-question-list">
                            {numberedQs.map((q, i) => (
                                <li key={i}>{q.replace(/^\d+[).:\s]+/, '')}</li>
                            ))}
                        </ol>
                    ) : (
                        introLines.map((l, i) => <p key={i} className="problem-intro">{l}</p>)
                    )}
                </SidebarCard>

                {/* Key Insights */}
                {brief?.keyInsights && brief.keyInsights.length > 0 && (
                    <SidebarCard label="KEY DATA INSIGHTS">
                        <ul className="insight-list">
                            {brief.keyInsights.map((ins, i) => (
                                <li key={i} className="insight-item">{ins}</li>
                            ))}
                        </ul>
                    </SidebarCard>
                )}

                {/* What You Must Deliver */}
                <SidebarCard label="WHAT YOU MUST DELIVER">
                    <ol className="deliver-list">
                        {(brief?.expectedOutput || ['Identify root causes.', 'Provide an action plan.', 'Call out risks.']).map((line, i) => (
                            <li key={i}>{line}</li>
                        ))}
                    </ol>
                </SidebarCard>

                {/* Key Metrics Grid */}
                {(brief?.keyMetrics || []).length > 0 && (
                    <SidebarCard label="KEY DATA SIGNALS">
                        <div className="metrics-grid">
                            {(brief?.keyMetrics || []).slice(0, 8).map((item, i) => (
                                <div key={i} className="metric-cell">
                                    <span className="metric-cell__label">{item.label}</span>
                                    <span className="metric-cell__value">{item.value}</span>
                                </div>
                            ))}
                        </div>
                    </SidebarCard>
                )}

                {/* Trend Visualisations */}
                {chartSeries.length > 0 && (
                    <SidebarCard label="TREND VISUALS">
                        <div className="spark-grid">
                            {chartSeries.map(([key, vals]) => (
                                <SparkBar key={key} label={key.replace(/_/g, ' ')} values={vals} />
                            ))}
                        </div>
                    </SidebarCard>
                )}

                {/* Interview Progress */}
                <SidebarCard label="INTERVIEW PROGRESS">
                    <div className="step-progress">
                        {Object.keys(stepLabels).map((step) => (
                            <div key={step} className={`step-item ${currentStep === step ? 'active' : ''} ${Object.keys(stepLabels).indexOf(step) < Object.keys(stepLabels).indexOf(currentStep) ? 'done' : ''}`}>
                                <span className="step-num">{stepLabels[step]}</span>
                                <span className="step-name">{stepNames[step]}</span>
                            </div>
                        ))}
                    </div>
                    <div className="strike-hud">
                        <span className="strike-hud__label">LOGICAL STRIKES</span>
                        <div className="strike-dots">
                            {[1, 2, 3].map(i => (
                                <div key={i} className={`strike-dot ${i <= strikes ? 'used' : ''}`} title={`Strike ${i}`} />
                            ))}
                        </div>
                        <span className="attempts-label">{attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} left</span>
                    </div>
                </SidebarCard>

                {/* Live Score */}
                {scoreBreakdown && (
                    <SidebarCard label="RUBRIC SNAPSHOT">
                        <div className="rubric-grid">
                            {[
                                { label: 'Problem Understanding', val: scoreBreakdown.problemUnderstanding, max: 20 },
                                { label: 'Data Usage', val: scoreBreakdown.dataUsage, max: 20 },
                                { label: 'Root Cause ID', val: scoreBreakdown.rootCauseIdentification, max: 20 },
                                { label: 'Solution Quality', val: scoreBreakdown.solutionQuality, max: 25 },
                                { label: 'Consistency', val: scoreBreakdown.crossQuestionConsistency, max: 15 },
                            ].map(({ label, val, max }) => (
                                <div key={label} className="rubric-row">
                                    <span className="rubric-row__label">{label}</span>
                                    <div className="rubric-bar-wrap">
                                        <div className="rubric-bar" style={{ width: `${(val / max) * 100}%` }} />
                                    </div>
                                    <span className="rubric-row__score">{val}/{max}</span>
                                </div>
                            ))}
                            <div className="rubric-total">
                                <span>Total Score</span>
                                <strong>{scoreBreakdown.totalScore}/100</strong>
                            </div>
                        </div>
                        {scoring && (
                            <div className="band-pill" data-band={scoring.band?.toLowerCase()}>
                                {scoring.band}
                            </div>
                        )}
                    </SidebarCard>
                )}

                {/* Coach Note */}
                <SidebarCard label="EVALUATION HINT">
                    <p className="coach-note">{coachNote}</p>
                </SidebarCard>

            </aside>

            {/* ═══ MAIN CHAT AREA ═════════════════════════════════════════════ */}
            <main className="assessment-chat-area">

                {/* Top Bar */}
                <header className="chat-topbar">
                    <div className="interviewer-info">
                        <div className="avatar-mbb">AI</div>
                        <div>
                            <p className="interviewer-name">Partner, Intelligence Eng.</p>
                            <p className="interviewer-status">
                                <span className="status-dot" /> Direct Assessment in Progress
                            </p>
                        </div>
                    </div>
                    <div className="topbar-right">
                        <div className="score-chip">
                            <div className="score-chip__label">LIVE SCORE</div>
                            <div className="score-chip__value">{scoreBreakdown?.totalScore ?? '--'}<span>/100</span></div>
                            <div className="score-chip__sub">
                                {scoring?.band || 'Pending'} &nbsp;·&nbsp; {attemptsLeft} left
                            </div>
                        </div>
                        <div className={`session-status-badge session-status-badge--${status}`}>
                            {status.toUpperCase()}
                        </div>
                        <button className="btn-exit" onClick={() => navigate(dashboardPath)}>
                            ✕ EXIT
                        </button>
                    </div>
                </header>

                {/* Messages */}
                <div className="messages-container">

                    {/* Business Events — formatted banner */}
                    {brief?.businessEvents && brief.businessEvents.length > 0 && (
                        <div className="events-banner">
                            <div className="events-banner__header">
                                <span className="events-banner__icon">📌</span>
                                <span className="events-banner__title">Business Events &amp; Context</span>
                            </div>
                            <ul className="events-banner__list">
                                {brief.businessEvents.map((ev, i) => (
                                    <li key={i}>{ev.replace(/^[-—•]\s?/, '')}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Chat thread */}
                    {messages.map((m, i) => (
                        <div key={i} className={`msg-wrapper msg-wrapper--${m.role}`}>
                            {m.role === 'assistant' && (
                                <div className="msg-avatar">AI</div>
                            )}
                            <div className={`msg-bubble msg-bubble--${m.role}`}>
                                {renderFormattedMessage(m.content)}
                            </div>
                        </div>
                    ))}

                    {isSending && (
                        <div className="msg-wrapper msg-wrapper--assistant">
                            <div className="msg-avatar">AI</div>
                            <div className="msg-bubble msg-bubble--assistant msg-typing">
                                <span /><span /><span />
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                {/* Input Area */}
                {status === 'active' ? (
                    <form className="chat-input-form" onSubmit={handleSendMessage}>
                        <div className="chat-input-wrap">
                            <textarea
                                className="chat-textarea"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Type your structured response here... (Shift+Enter for newline)"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); }
                                }}
                                rows={3}
                            />
                            <button
                                type="submit"
                                className="chat-send-btn"
                                disabled={isSending || !input.trim()}
                                aria-label="Send"
                            >
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                                    <path d="M3 11.5L21 3L13.5 21L11 13L3 11.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </button>
                        </div>
                        <p className="input-hint">Structure your response: Diagnose → Quantify → Recommend → Risk</p>
                    </form>
                ) : (
                    <div className="session-conclusion">
                        <div className="conclusion-icon">{status === 'completed' ? '✅' : '🚫'}</div>
                        <h2>{status === 'completed' ? 'Assessment Concluded' : 'Session Terminated'}</h2>
                        <p>
                            {status === 'completed'
                                ? 'Your responses have been recorded and submitted to the evaluation panel.'
                                : 'The assessment ended due to insufficient logical consistency in your responses.'}
                        </p>
                        <button className="btn-primary" onClick={() => navigate(dashboardPath)}>RETURN TO DASHBOARD</button>
                    </div>
                )}
            </main>
        </div>
    );
};

export default CandidateAssessment;
