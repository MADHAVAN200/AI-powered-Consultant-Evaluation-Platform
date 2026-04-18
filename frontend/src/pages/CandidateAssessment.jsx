import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useData } from '../context/DataContext';
import './Assessment.css';

const API_BASE = 'http://localhost:5000/api';

const getSystemTheme = () => (
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
);

const getInitialTheme = () => {
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') return stored;

    const attrTheme = document.documentElement.getAttribute('data-theme');
    if (attrTheme === 'light' || attrTheme === 'dark') return attrTheme;

    return getSystemTheme();
};

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

const prettifyMetricLabel = (raw = '') => String(raw)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

const getMetricDirection = (label = '') => {
    const key = String(label).toLowerCase();
    if (/cost|complaint|churn|delay|debt|risk|downtime|attrition|days sales outstanding/.test(key)) return 'lower';
    return 'higher';
};

const getMetricFocusArea = (label = '') => {
    const key = String(label).toLowerCase();
    if (/revenue|margin|profit|cost|pricing|cash|days sales outstanding/.test(key)) return 'financial';
    if (/complaint|churn|client|customer|rating|nps|quality/.test(key)) return 'customer';
    if (/delay|logistics|cycle|headcount|maintenance|utilization|efficiency/.test(key)) return 'operations';
    return 'strategy';
};

const keywordSetFromText = (text = '') => {
    const cleaned = String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    return new Set(cleaned.split(/\s+/).filter((w) => w.length > 2));
};

const candidateTouchesMetric = (metricLabel = '', candidateText = '') => {
    const metricWords = String(metricLabel).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2);
    const candidateWords = keywordSetFromText(candidateText);
    if (metricWords.length === 0 || candidateWords.size === 0) return false;
    return metricWords.some((w) => candidateWords.has(w));
};

const buildCockpitMetrics = (financialData = {}, latestCandidateAnswer = '', totalScore = null) => {
    const entries = Object.entries(financialData || {}).filter(([, v]) => Array.isArray(v) && v.length > 1);
    const cards = entries.map(([key, values]) => {
        const numericValues = values.map(Number).filter(Number.isFinite);
        if (numericValues.length < 2) return null;

        const baseline = numericValues[0];
        const current = numericValues[numericValues.length - 1];
        const direction = getMetricDirection(key);
        const delta = current - baseline;
        const deltaPct = baseline !== 0 ? (delta / Math.abs(baseline)) * 100 : 0;
        const isImproving = direction === 'higher' ? current >= baseline : current <= baseline;
        const touched = candidateTouchesMetric(key, latestCandidateAnswer);
        const focusArea = getMetricFocusArea(key);

        const rubricInfluence = Number.isFinite(totalScore)
            ? Math.max(0.25, Math.min(1, Number(totalScore) / 100))
            : 0.5;
        const trendInfluence = Math.max(0, Math.min(1, (isImproving ? 0.55 : 0.35) + (touched ? 0.25 : 0)));
        const confidence = Math.round((0.65 * trendInfluence + 0.35 * rubricInfluence) * 100);

        return {
            key,
            label: prettifyMetricLabel(key),
            focusArea,
            direction,
            baseline,
            current,
            delta,
            deltaPct,
            isImproving,
            touched,
            confidence,
            targetText: direction === 'higher' ? 'Target: push upward' : 'Target: bring downward',
            candidateText: touched ? 'Candidate addressed this signal in latest answer' : 'Candidate has not addressed this signal yet'
        };
    }).filter(Boolean);

    return cards;
};

const buildQuestionCoverage = (questions = [], allCandidateAnswers = '') => {
    if (!Array.isArray(questions) || questions.length === 0) return 0;
    const corpus = String(allCandidateAnswers || '').toLowerCase();
    let covered = 0;
    for (const q of questions) {
        const tokens = String(q || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 4);
        if (tokens.length === 0) continue;
        const matched = tokens.some((t) => corpus.includes(t));
        if (matched) covered += 1;
    }
    return Math.round((covered / questions.length) * 100);
};

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const inferMetricUnit = (key = '', values = []) => {
    const k = String(key).toLowerCase();
    if (k.includes('pct') || k.includes('percent') || k.includes('rate') || k.includes('margin')) return 'percent';
    if (k.includes('ratio')) return 'ratio';
    if (k.includes('days') || k.includes('delivery_time')) return 'days';
    if (k.endsWith('_cr')) return 'inr_cr';
    if (k.endsWith('_l') || k.endsWith('_lakhs')) return 'inr_lakh';
    if (k.includes('cac') || k.includes('ltv') || k.includes('aov') || k.includes('price') || k.includes('cost')) return 'inr';

    const maxVal = Math.max(...values.map((n) => Math.abs(Number(n) || 0)), 0);
    if (maxVal <= 100 && values.some((n) => Number(n) % 1 !== 0)) return 'percent';
    return 'count';
};

const formatMetricValue = (value, unit) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    if (unit === 'percent') return `${n.toFixed(1)}%`;
    if (unit === 'ratio') return `${n.toFixed(2)}x`;
    if (unit === 'days') return `${n.toFixed(1)} days`;
    if (unit === 'inr') return `INR ${Math.round(n).toLocaleString('en-IN')}`;
    if (unit === 'inr_cr') return `INR ${n.toFixed(2)} Cr`;
    if (unit === 'inr_lakh') return `INR ${n.toFixed(1)} L`;
    return Number.isInteger(n) ? n.toLocaleString('en-IN') : n.toFixed(2);
};

const unitDisplayLabel = (unit = 'count') => {
    if (unit === 'percent') return '%';
    if (unit === 'ratio') return 'Ratio (x)';
    if (unit === 'days') return 'Days';
    if (unit === 'inr') return 'INR';
    if (unit === 'inr_cr') return 'INR Cr';
    if (unit === 'inr_lakh') return 'INR Lakh';
    return 'Count';
};

const formatAxisTickValue = (value, unit) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    if (unit === 'percent') return `${n.toFixed(0)}%`;
    if (unit === 'ratio') return `${n.toFixed(1)}x`;
    if (unit === 'days') return `${n.toFixed(1)}d`;
    if (unit === 'inr_cr') return `${n.toFixed(2)}Cr`;
    if (unit === 'inr_lakh') return `${n.toFixed(1)}L`;
    if (unit === 'inr') return `${Math.round(n / 1000)}k`;
    return Number.isInteger(n) ? `${n}` : n.toFixed(1);
};

const aggregateQuarterly = (values = []) => {
    const nums = values.map(Number).filter(Number.isFinite);
    if (nums.length < 3) return [];
    const chunks = [];
    for (let i = 0; i < nums.length; i += 3) {
        const q = nums.slice(i, i + 3);
        if (q.length === 0) continue;
        chunks.push(q.reduce((sum, n) => sum + n, 0) / q.length);
    }
    return chunks;
};

const MetricLineChart = ({ label, values = [], xLabels = [], unit = 'count' }) => {
    const nums = values.map(Number).filter(Number.isFinite);
    if (nums.length < 2) return null;

    const width = 360;
    const height = 190;
    const leftPad = 44;
    const rightPad = 14;
    const topPad = 14;
    const bottomPad = 36;
    const plotW = width - leftPad - rightPad;
    const plotH = height - topPad - bottomPad;

    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const span = Math.max(1, max - min);
    const yMin = min - span * 0.1;
    const yMax = max + span * 0.1;

    const xAt = (i) => leftPad + (i * plotW) / Math.max(1, nums.length - 1);
    const yAt = (v) => topPad + ((yMax - v) * plotH) / Math.max(0.0001, yMax - yMin);

    const points = nums.map((v, i) => `${xAt(i)},${yAt(v)}`).join(' ');
    const yTicks = 4;
    const tickValues = Array.from({ length: yTicks + 1 }, (_, i) => yMin + ((yMax - yMin) * i) / yTicks);

    return (
        <article className="line-chart-card">
            <div className="line-chart-header">
                <h4>{label}</h4>
                <span>{unit.replace('_', ' ')}</span>
            </div>
            <svg className="line-chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label} line chart`}>
                <line x1={leftPad} y1={topPad} x2={leftPad} y2={topPad + plotH} className="axis-line" />
                <line x1={leftPad} y1={topPad + plotH} x2={leftPad + plotW} y2={topPad + plotH} className="axis-line" />

                {tickValues.map((t, idx) => {
                    const y = yAt(t);
                    return (
                        <g key={idx}>
                            <line x1={leftPad} y1={y} x2={leftPad + plotW} y2={y} className="grid-line" />
                            <text x={leftPad - 6} y={y + 3} className="tick-label" textAnchor="end">{formatAxisTickValue(t, unit)}</text>
                        </g>
                    );
                })}

                <polyline points={points} className="series-line" />
                {nums.map((v, i) => (
                    <circle key={i} cx={xAt(i)} cy={yAt(v)} r="3" className="series-point" />
                ))}

                {nums.map((_, i) => (
                    <text key={`x-${i}`} x={xAt(i)} y={topPad + plotH + 16} className="tick-label" textAnchor="middle">
                        {xLabels[i] || `P${i + 1}`}
                    </text>
                ))}

                <text x={leftPad + plotW / 2} y={height - 4} className="axis-title" textAnchor="middle">Time</text>
                <text x={leftPad} y={10} className="axis-title" textAnchor="start">Y: {unitDisplayLabel(unit)}</text>
            </svg>
        </article>
    );
};

// ─── Main Component ────────────────────────────────────────────────────────
const CandidateAssessment = ({ isDemo = false, isDirectCase = false }) => {
    const { inviteId, caseStudyId } = useParams();
    const { userEmail, userRole } = useData();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [session, setSession] = useState(null);
    const [caseStudy, setCaseStudy] = useState(null);
    const [sectionPayloads, setSectionPayloads] = useState({});
    const [sectionLoadingKey, setSectionLoadingKey] = useState('');
    const [sectionError, setSectionError] = useState('');
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
    const [metricViewMode, setMetricViewMode] = useState('case');
    const [activeCaseSection, setActiveCaseSection] = useState('snapshot');
    const [theme, setTheme] = useState(getInitialTheme);
    const [leftWidth, setLeftWidth] = useState(() => window.innerWidth <= 1280 ? 280 : 300);
    const [rightWidth, setRightWidth] = useState(() => window.innerWidth <= 1280 ? 340 : 370);
    const chatEndRef = useRef(null);
    const dashboardPath = userRole === 'admin' ? '/admin/dashboard' : '/candidate/dashboard';

    const startLeftResize = (e) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = leftWidth;
        const doDrag = (moveEvent) => setLeftWidth(Math.max(200, Math.min(600, startWidth + moveEvent.clientX - startX)));
        const stopDrag = () => { document.removeEventListener('mousemove', doDrag); document.removeEventListener('mouseup', stopDrag); };
        document.addEventListener('mousemove', doDrag);
        document.addEventListener('mouseup', stopDrag);
    };

    const startRightResize = (e) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = rightWidth;
        const doDrag = (moveEvent) => setRightWidth(Math.max(250, Math.min(800, startWidth - (moveEvent.clientX - startX))));
        const stopDrag = () => { document.removeEventListener('mousemove', doDrag); document.removeEventListener('mouseup', stopDrag); };
        document.addEventListener('mousemove', doDrag);
        document.addEventListener('mouseup', stopDrag);
    };

    useEffect(() => { validateAndStart(); }, [inviteId, caseStudyId, isDemo, isDirectCase, userEmail]);
    useEffect(() => { document.body.classList.add('assessment-lock'); return () => document.body.classList.remove('assessment-lock'); }, []);
    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    useEffect(() => {
        if (localStorage.getItem('theme')) return undefined;

        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const onChange = (e) => setTheme(e.matches ? 'dark' : 'light');

        if (typeof media.addEventListener === 'function') {
            media.addEventListener('change', onChange);
            return () => media.removeEventListener('change', onChange);
        }

        if (typeof media.addListener === 'function') {
            media.addListener(onChange);
            return () => media.removeListener(onChange);
        }

        return undefined;
    }, []);

    const applySessionData = (sess, cs) => {
        setSession(sess);
        setCaseStudy(cs);
        setSectionPayloads({});
        setSectionLoadingKey('');
        setSectionError('');
        setActiveCaseSection('snapshot');
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

    // ── Derive chart and cockpit data (must stay before conditional returns) ──
    const chartSeries = Object.entries(caseStudy?.financial_data || {})
        .filter(([, v]) => Array.isArray(v) && v.length > 1)
        .slice(0, 5);

    const threshold = Number(caseStudy?.threshold_passing_score ?? 0.6);
    const passingMarks = Math.round((Number.isFinite(threshold) ? threshold : 0.6) * 100);

    const problemLines = (caseStudy?.initial_prompt || '')
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0);

    const numberedQs = problemLines.filter(l => /^\d+[).:]/.test(l));

    const candidateMessages = messages.filter((m) => m.role === 'user').map((m) => String(m.content || ''));
    const latestCandidateAnswer = candidateMessages[candidateMessages.length - 1] || '';
    const hasCandidateProgress = candidateMessages.some((msg) => msg.trim().length > 0);

    // Stable string representation for deps (avoid re-creating arrays)
    const candidateTexKey = useMemo(() => candidateMessages.join('|'), [messages]);
    const financialDataKey = useMemo(() => JSON.stringify(caseStudy?.financial_data || {}), [caseStudy?.financial_data]);

    const questionCoverage = useMemo(
        () => buildQuestionCoverage(numberedQs, candidateMessages.join(' ')),
        [candidateTexKey]
    );

    const cockpitMetrics = useMemo(
        () => buildCockpitMetrics(caseStudy?.financial_data || {}, latestCandidateAnswer, scoreBreakdown?.totalScore),
        [financialDataKey, latestCandidateAnswer, scoreBreakdown?.totalScore]
    );

    const focusTouchedCount = cockpitMetrics.filter((m) => m.touched).length;
    const liveFocusRatio = cockpitMetrics.length > 0 ? Math.round((focusTouchedCount / cockpitMetrics.length) * 100) : 0;

    // Phase step labels
    const stepLabels = { diagnostic: '01', brainstorming: '02', calculations: '03', final_recommendation: '04' };
    const stepNames  = { diagnostic: 'Diagnose', brainstorming: 'Brainstorm', calculations: 'Calculate', final_recommendation: 'Recommend' };

    const timelineLabels = useMemo(() => {
        const seriesLen = Math.max(...Object.values(caseStudy?.financial_data || {}).map((v) => (Array.isArray(v) ? v.length : 0)), 0);
        if (seriesLen <= 0) return [];
        if (seriesLen <= 12) return monthNames.slice(0, seriesLen);
        return Array.from({ length: seriesLen }, (_, i) => `P${i + 1}`);
    }, [caseStudy?.financial_data]);

    const metricRows = useMemo(() => {
        return Object.entries(caseStudy?.financial_data || {})
            .filter(([, v]) => Array.isArray(v) && v.length > 0)
            .map(([key, values]) => {
                const nums = values.map(Number).filter(Number.isFinite);
                const unit = inferMetricUnit(key, nums);
                const qAgg = aggregateQuarterly(nums);
                const delta = nums.length > 1 ? nums[nums.length - 1] - nums[0] : 0;
                const direction = getMetricDirection(key);
                const improving = nums.length > 1 ? (direction === 'higher' ? nums[nums.length - 1] >= nums[0] : nums[nums.length - 1] <= nums[0]) : true;
                return {
                    key,
                    label: prettifyMetricLabel(key),
                    unit,
                    values: nums,
                    quarterly: qAgg,
                    delta,
                    improving
                };
            });
    }, [caseStudy?.financial_data]);

    const staticKpis = useMemo(() => metricRows.slice(0, 8).map((row) => ({
        key: row.key,
        label: row.label,
        current: row.values[row.values.length - 1] || 0,
        delta: row.delta,
        deltaPct: row.values.length > 1 && row.values[0] !== 0 ? ((row.values[row.values.length - 1] - row.values[0]) / Math.abs(row.values[0])) * 100 : 0,
        isImproving: row.improving,
        touched: false
    })), [metricRows]);

    const dynamicMetricRows = useMemo(() => {
        if (!hasCandidateProgress) return metricRows;

        const signalMap = Object.fromEntries(cockpitMetrics.map((m) => [m.key, m]));
        const influence = Math.max(0.25, ((questionCoverage / 100) + ((scoreBreakdown?.totalScore || 0) / 100)) / 2);
        const weakAnswer = latestCandidateAnswer.trim().length < 40;

        return metricRows.map((row) => {
            const signal = signalMap[row.key];
            if (!signal || row.values.length === 0) return row;

            const nextValues = [...row.values];
            const first = nextValues[0];
            const lastIdx = nextValues.length - 1;
            const span = Math.max(1, Math.abs(nextValues[lastIdx] - first), Math.abs(nextValues[lastIdx]));
            const directionSign = signal.direction === 'higher' ? 1 : -1;
            const positiveFactor = signal.touched ? 0.11 : 0;
            const negativeFactor = signal.touched ? 0 : (weakAnswer ? 0.09 : 0.055);
            const netFactor = positiveFactor - negativeFactor;
            const change = span * netFactor * influence;

            nextValues[lastIdx] = Number((nextValues[lastIdx] + directionSign * change).toFixed(2));
            if (lastIdx > 0) {
                nextValues[lastIdx - 1] = Number((nextValues[lastIdx - 1] + directionSign * change * 0.45).toFixed(2));
            }

            const delta = nextValues.length > 1 ? nextValues[lastIdx] - nextValues[0] : 0;
            const improving = getMetricDirection(row.key) === 'higher' ? nextValues[lastIdx] >= nextValues[0] : nextValues[lastIdx] <= nextValues[0];

            return {
                ...row,
                values: nextValues,
                quarterly: aggregateQuarterly(nextValues),
                delta,
                improving
            };
        });
    }, [metricRows, cockpitMetrics, questionCoverage, scoreBreakdown?.totalScore, latestCandidateAnswer, hasCandidateProgress]);

    const decisionImpact = useMemo(() => {
        if (metricViewMode !== 'dynamic' || !hasCandidateProgress || !latestCandidateAnswer.trim()) return null;

        const baseMap = Object.fromEntries(metricRows.map((m) => [m.key, m.values[m.values.length - 1] || 0]));
        const dynamicMap = Object.fromEntries(dynamicMetricRows.map((m) => [m.key, m.values[m.values.length - 1] || 0]));
        const directionMap = Object.fromEntries(metricRows.map((m) => [m.key, getMetricDirection(m.key)]));

        const improved = [];
        const worsened = [];
        for (const row of dynamicMetricRows) {
            const key = row.key;
            const diff = (dynamicMap[key] || 0) - (baseMap[key] || 0);
            if (Math.abs(diff) < 0.0001) continue;
            const direction = directionMap[key];
            const isImprovement = direction === 'higher' ? diff > 0 : diff < 0;
            const entry = `${row.label}: ${diff >= 0 ? '+' : ''}${formatMetricValue(diff, row.unit)}`;
            if (isImprovement) improved.push(entry);
            else worsened.push(entry);
        }

        const missed = cockpitMetrics.filter((m) => !m.touched).slice(0, 3).map((m) => m.label);
        return {
            improved: improved.slice(0, 4),
            worsened: worsened.slice(0, 4),
            missed
        };
    }, [metricViewMode, latestCandidateAnswer, metricRows, dynamicMetricRows, cockpitMetrics, hasCandidateProgress]);

    const displayedRows = metricViewMode === 'case' ? metricRows : dynamicMetricRows;
    const displayedKpis = metricViewMode === 'case' ? staticKpis : (hasCandidateProgress ? cockpitMetrics : staticKpis);

    const caseSections = useMemo(() => ([
        { key: 'snapshot', label: 'Overview' },
        { key: 'data', label: 'Data & Metrics' },
        { key: 'problem', label: 'Problem Statement' },
        { key: 'objectives', label: 'Objectives' },
        { key: 'events', label: 'Events & Context' },
        { key: 'insights', label: 'Key Insights' }
    ]), []);

    const handleSectionSelect = (sectionKey) => {
        setActiveCaseSection(sectionKey);
        setSectionError('');
    };

    useEffect(() => {
        if (!caseStudy?.id || !activeCaseSection || activeCaseSection === 'data') return;
        if (sectionPayloads[activeCaseSection] || sectionLoadingKey === activeCaseSection) return;

        const fetchActiveSection = async () => {
            setSectionLoadingKey(activeCaseSection);
            try {
                const res = await axios.get(`${API_BASE}/case-studies/${caseStudy.id}/brief-section/${activeCaseSection}`);
                if (res.data?.success && res.data?.section) {
                    setSectionPayloads((prev) => ({ ...prev, [activeCaseSection]: res.data.section }));
                } else {
                    setSectionError('Failed to load section content.');
                }
            } catch (err) {
                setSectionError(err.response?.data?.error || 'Failed to load section content.');
            } finally {
                setSectionLoadingKey('');
            }
        };

        fetchActiveSection();
    }, [activeCaseSection, caseStudy?.id, sectionPayloads, sectionLoadingKey]);

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

    return (
        <div 
            className="assessment-portal metric-priority-layout"
            style={{ '--left-width': `${leftWidth}px`, '--right-width': `${rightWidth}px` }}
        >
            <aside className="assessment-sidebar assessment-sidebar--sections">
                <div className="sidebar-case-header">
                    <div className="case-header-top">
                        <span className="case-tag-pill">CASE BRIEF</span>
                        <span className="difficulty-pill difficulty-pill--medium">Medium</span>
                        <span className="time-pill">30 min</span>
                    </div>
                    <h2 className="case-title">Case Sections</h2>
                    <p className="case-industry">Navigate the full brief before responding</p>
                </div>

                <SidebarCard label="Section Navigator" variant="accent">
                    <nav className="sidebar-section-nav" aria-label="Case study sections">
                        {caseSections.map((section) => (
                            <button
                                key={section.key}
                                className={`sidebar-section-btn ${activeCaseSection === section.key ? 'active' : ''}`}
                                onClick={() => handleSectionSelect(section.key)}
                            >
                                {section.label}
                            </button>
                        ))}
                    </nav>
                </SidebarCard>
            </aside>

            <div className="resize-handle" onMouseDown={startLeftResize} title="Drag to resize" />

            <main className="metrics-workspace">
                <header className="workspace-header">
                    <div>
                        <p className="workspace-tag">AurumCart Case Evaluation</p>
                        <h1 className="workspace-title">{caseStudy.title}</h1>
                        <p className="workspace-subtitle">{caseStudy.industry || 'Business Strategy'} · Metrics-first assessment cockpit</p>
                    </div>
                    <div className="workspace-actions">
                        <div className="score-chip">
                            <div className="score-chip__label">LIVE SCORE</div>
                            <div className="score-chip__value">{scoreBreakdown?.totalScore ?? '--'}<span>/100</span></div>
                            <div className="score-chip__sub">{scoring?.band || 'Pending'} · PASS {passingMarks}</div>
                        </div>
                        <button className="theme-toggle assessment-theme-toggle" onClick={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}>
                            {theme === 'light' ? 'DARK' : 'LIGHT'}
                        </button>
                        <div className={`session-status-badge session-status-badge--${status}`}>{status.toUpperCase()}</div>
                        <button className="btn-exit" onClick={() => navigate(dashboardPath)}>EXIT</button>
                    </div>
                </header>

                {activeCaseSection === 'data' && (
                    <>
                        <section className="metric-tabs" aria-label="Metric data view switcher">
                            <button
                                className={`metric-tab ${metricViewMode === 'case' ? 'active' : ''}`}
                                onClick={() => setMetricViewMode('case')}
                            >
                                Actual Case Study Data
                            </button>
                            <button
                                className={`metric-tab ${metricViewMode === 'dynamic' ? 'active' : ''}`}
                                onClick={() => setMetricViewMode('dynamic')}
                            >
                                Candidate-Driven Dynamic View
                            </button>
                        </section>

                        {!hasCandidateProgress && metricViewMode === 'dynamic' && (
                            <p className="hint-line">Dynamic simulation activates after your first answer. Until then, both views show the same baseline metrics.</p>
                        )}

                        <section className="kpi-rail" aria-label="Executive KPI rail">
                            {displayedKpis.slice(0, 8).map((metric) => (
                                <article key={metric.key} className={`kpi-tile ${metric.isImproving ? 'up' : 'down'} ${metric.touched ? 'touched' : ''}`}>
                                    <p className="kpi-tile__name">{metric.label}</p>
                                    <p className="kpi-tile__value">{formatMetricValue(metric.current, inferMetricUnit(metric.key, [metric.current]))}</p>
                                    <p className={`kpi-tile__delta ${metric.delta >= 0 ? 'positive' : 'negative'}`}>
                                        {metric.delta >= 0 ? '+' : ''}{metric.delta.toFixed(2)} ({metric.deltaPct >= 0 ? '+' : ''}{metric.deltaPct.toFixed(1)}%)
                                    </p>
                                </article>
                            ))}
                        </section>
                    </>
                )}

                {activeCaseSection !== 'data' && (
                <section className="case-content-pane" aria-label="Selected case section content">
                    {!activeCaseSection && (
                        <article className="main-section-card">
                            <h3>Select A Section</h3>
                            <p>Choose a section from the left navigator to fetch and view its content.</p>
                        </article>
                    )}

                    {!!activeCaseSection && sectionLoadingKey === activeCaseSection && !sectionPayloads[activeCaseSection] && (
                        <article className="main-section-card">
                            <h3>Loading Section</h3>
                            <p>Fetching latest content from backend...</p>
                        </article>
                    )}

                    {!!activeCaseSection && sectionError && (
                        <article className="main-section-card">
                            <h3>Section Load Failed</h3>
                            <p>{sectionError}</p>
                        </article>
                    )}

                    {!!activeCaseSection && !sectionError && sectionPayloads[activeCaseSection] && (
                    <article key={activeCaseSection} className="main-section-card">
                        {activeCaseSection === 'snapshot' && (
                            <>
                                <h3>Case Overview</h3>
                                <p>{sectionPayloads.snapshot?.headline || 'Case summary unavailable.'}</p>

                                {(sectionPayloads.snapshot?.contextLines || []).length > 0 && (
                                    <>
                                        <h4 className="brief-subheading">Case Context</h4>
                                        <ul>
                                            {(sectionPayloads.snapshot?.contextLines || []).map((line, idx) => <li key={`ctx-${idx}`}>{line}</li>)}
                                        </ul>
                                    </>
                                )}

                                <h4 className="brief-subheading">Diagnostic Summary</h4>
                                <ul>
                                    {(sectionPayloads.snapshot?.diagnosticSummary || []).map((line, idx) => <li key={`diag-${idx}`}>{line}</li>)}
                                </ul>

                                {(sectionPayloads.snapshot?.pressureSignals || []).length > 0 && (
                                    <>
                                        <h4 className="brief-subheading">Pressure Signals</h4>
                                        <ul>
                                            {(sectionPayloads.snapshot?.pressureSignals || []).map((item, idx) => <li key={`pain-${idx}`}>{item}</li>)}
                                        </ul>
                                    </>
                                )}

                                {(sectionPayloads.snapshot?.positiveSignals || []).length > 0 && (
                                    <>
                                        <h4 className="brief-subheading">Positive Signals</h4>
                                        <ul>
                                            {(sectionPayloads.snapshot?.positiveSignals || []).map((item, idx) => <li key={`str-${idx}`}>{item}</li>)}
                                        </ul>
                                    </>
                                )}

                                {(sectionPayloads.snapshot?.businessEvents || []).length > 0 && (
                                    <>
                                        <h4 className="brief-subheading">Business Events to Factor</h4>
                                        <ul>
                                            {(sectionPayloads.snapshot?.businessEvents || []).map((item, idx) => <li key={`evt-${idx}`}>{item}</li>)}
                                        </ul>
                                    </>
                                )}

                                {(sectionPayloads.snapshot?.coreQuestions || []).length > 0 && (
                                    <>
                                        <h4 className="brief-subheading">Core Questions</h4>
                                        <ol>
                                            {(sectionPayloads.snapshot?.coreQuestions || []).map((item, idx) => <li key={`q-${idx}`}>{item}</li>)}
                                        </ol>
                                    </>
                                )}

                                {(sectionPayloads.snapshot?.expectedOutputs || []).length > 0 && (
                                    <>
                                        <h4 className="brief-subheading">Expected Outputs</h4>
                                        <ul>
                                            {(sectionPayloads.snapshot?.expectedOutputs || []).map((item, idx) => <li key={`out-${idx}`}>{item}</li>)}
                                        </ul>
                                    </>
                                )}
                            </>
                        )}

                        {activeCaseSection === 'problem' && (
                            <>
                                <h3>Problem Statement</h3>
                                {(sectionPayloads.problem?.introLines || []).slice(0, 2).map((l, i) => <p key={i}>{l}</p>)}
                                <ol>
                                    {(sectionPayloads.problem?.questions || []).slice(0, 6).map((q, i) => (
                                        <li key={i}>{q}</li>
                                    ))}
                                </ol>
                            </>
                        )}

                        {activeCaseSection === 'objectives' && (
                            <>
                                <h3>Objectives and Deliverables</h3>
                                <ul>
                                    {(sectionPayloads.objectives?.objectives || ['Identify root causes', 'Build six-month action plan', 'Highlight risks']).map((line, i) => (
                                        <li key={i}>{line}</li>
                                    ))}
                                </ul>
                                <p className="hint-line">Coverage: {questionCoverage}% · Metric focus: {liveFocusRatio}% · Attempts left: {attemptsLeft}</p>
                            </>
                        )}

                        {activeCaseSection === 'events' && (
                            <>
                                <h3>Business Events and Context</h3>
                                <ul>
                                    {(sectionPayloads.events?.events || []).slice(0, 8).map((ev, i) => (
                                        <li key={i}>{ev}</li>
                                    ))}
                                </ul>
                            </>
                        )}

                        {activeCaseSection === 'insights' && (
                            <>
                                <h3>Key Insights</h3>
                                <ul>
                                    {(sectionPayloads.insights?.insights || []).length > 0
                                        ? sectionPayloads.insights.insights.slice(0, 10).map((ins, i) => <li key={i}>{ins}</li>)
                                        : ['No extracted key insights yet. Use metrics below to form your hypothesis.'].map((ins, i) => <li key={i}>{ins}</li>)}
                                </ul>
                            </>
                        )}
                    </article>
                    )}
                </section>
                )}

                {activeCaseSection === 'data' && (
                    <>
                <section className="metrics-deep-dive">
                    <div className="table-card">
                        <div className="table-card__header">
                            <h3>Monthly Metrics Breakdown</h3>
                            <p>All parameters with units (INR, %, days, ratio), trend, and monthly values</p>
                        </div>
                        <div className="metrics-table-wrap">
                            <table className="metrics-table">
                                <thead>
                                    <tr>
                                        <th>Parameter</th>
                                        <th>Unit</th>
                                        {timelineLabels.map((label) => <th key={label}>{label}</th>)}
                                        <th>Trend</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayedRows.map((row) => (
                                        <tr key={row.key}>
                                            <td className="sticky-col">{row.label}</td>
                                            <td>{row.unit.replace('_', ' ')}</td>
                                            {row.values.map((val, idx) => <td key={`${row.key}-${idx}`}>{formatMetricValue(val, row.unit)}</td>)}
                                            <td className={row.improving ? 'trend-positive' : 'trend-negative'}>{row.improving ? 'Improving' : 'Deteriorating'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="table-card">
                        <div className="table-card__header">
                            <h3>Quarterly Rollup</h3>
                            <p>Quarterly average view derived from monthly values</p>
                        </div>
                        <div className="metrics-table-wrap">
                            <table className="metrics-table quarterly-table">
                                <thead>
                                    <tr>
                                        <th>Parameter</th>
                                        <th>Q1</th>
                                        <th>Q2</th>
                                        <th>Direction</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayedRows.map((row) => (
                                        <tr key={`${row.key}-q`}>
                                            <td className="sticky-col">{row.label}</td>
                                            <td>{row.quarterly[0] !== undefined ? formatMetricValue(row.quarterly[0], row.unit) : '—'}</td>
                                            <td>{row.quarterly[1] !== undefined ? formatMetricValue(row.quarterly[1], row.unit) : '—'}</td>
                                            <td>{getMetricDirection(row.key) === 'higher' ? 'Higher is better' : 'Lower is better'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                {chartSeries.length > 0 && (
                    <section className="trend-strip">
                        {displayedRows.slice(0, 5).map((row) => (
                            <MetricLineChart
                                key={row.key}
                                label={row.label}
                                values={row.values}
                                xLabels={timelineLabels}
                                unit={row.unit}
                            />
                        ))}
                    </section>
                )}
                    </>
                )}
            </main>

            <div className="resize-handle" onMouseDown={startRightResize} title="Drag to resize" />

            <aside className="chat-dock">
                <header className="chat-dock__header">
                    <div className="interviewer-info">
                        <div className="avatar-mbb">AI</div>
                        <div>
                            <p className="interviewer-name">Case Interview Bot</p>
                            <p className="interviewer-status"><span className="status-dot" /> {stepNames[currentStep]} phase</p>
                        </div>
                    </div>
                    <div className="strike-hud">
                        <span className="strike-hud__label">STRIKES</span>
                        <div className="strike-dots">
                            {[1, 2, 3].map(i => <div key={i} className={`strike-dot ${i <= strikes ? 'used' : ''}`} />)}
                        </div>
                    </div>

                    {decisionImpact && (
                        <div className="decision-impact-box">
                            <p className="decision-impact-title">Latest Answer Impact</p>
                            {decisionImpact.improved.length > 0 && (
                                <div>
                                    <p className="impact-sub impact-sub--good">Improved Signals</p>
                                    <ul>
                                        {decisionImpact.improved.map((item, idx) => <li key={`imp-${idx}`}>{item}</li>)}
                                    </ul>
                                </div>
                            )}
                            {decisionImpact.worsened.length > 0 && (
                                <div>
                                    <p className="impact-sub impact-sub--bad">Worsened Signals</p>
                                    <ul>
                                        {decisionImpact.worsened.map((item, idx) => <li key={`wrs-${idx}`}>{item}</li>)}
                                    </ul>
                                </div>
                            )}
                            {decisionImpact.missed.length > 0 && (
                                <p className="impact-missed">Missed metrics: {decisionImpact.missed.join(', ')}</p>
                            )}
                        </div>
                    )}
                </header>

                <div className="messages-container">
                    {messages.map((m, i) => (
                        <div key={i} className={`msg-wrapper msg-wrapper--${m.role}`}>
                            {m.role === 'assistant' && <div className="msg-avatar">AI</div>}
                            <div className={`msg-bubble msg-bubble--${m.role}`}>{renderFormattedMessage(m.content)}</div>
                        </div>
                    ))}
                    {isSending && (
                        <div className="msg-wrapper msg-wrapper--assistant">
                            <div className="msg-avatar">AI</div>
                            <div className="msg-bubble msg-bubble--assistant msg-typing"><span /><span /><span /></div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                {status === 'active' ? (
                    <form className="chat-input-form" onSubmit={handleSendMessage}>
                        <div className="chat-input-wrap">
                            <textarea
                                className="chat-textarea"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Respond with diagnosis, numbers, recommendations, and risk"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); }
                                }}
                                rows={3}
                            />
                            <button type="submit" className="chat-send-btn" disabled={isSending || !input.trim()} aria-label="Send">
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                                    <path d="M3 11.5L21 3L13.5 21L11 13L3 11.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </button>
                        </div>
                        <p className="input-hint">Coach hint: {coachNote}</p>
                    </form>
                ) : (
                    <div className="session-conclusion">
                        <div className="conclusion-icon">{status === 'completed' ? '✅' : '🚫'}</div>
                        <h2>{status === 'completed' ? 'Assessment Concluded' : 'Session Terminated'}</h2>
                        <p>{status === 'completed' ? 'Your responses have been submitted.' : 'Session ended due to logical consistency thresholds.'}</p>
                        <button className="btn-primary" onClick={() => navigate(dashboardPath)}>RETURN TO DASHBOARD</button>
                    </div>
                )}
            </aside>
        </div>
    );
};

export default CandidateAssessment;
