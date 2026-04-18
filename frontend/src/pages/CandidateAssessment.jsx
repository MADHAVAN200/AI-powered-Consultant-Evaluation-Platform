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

const extractProblemQuestions = (caseStudy = {}, fallback = 'Please diagnose the core problem and propose a quantified action plan.') => {
    const parsedSections = caseStudy?.parsed_sections || caseStudy?.parsedSections || {};
    const parsedQuestions = Array.isArray(parsedSections?._problemQuestions)
        ? parsedSections._problemQuestions.map((q) => String(q || '').trim()).filter(Boolean)
        : [];

    if (parsedQuestions.length > 0) {
        return parsedQuestions.map((text, idx) => ({
            id: `q-${idx + 1}`,
            index: idx,
            text,
            status: 'not_attempted',
            attempted: false,
            flagged: false,
            attempts: 0,
            lastScore: null
        }));
    }

    const initialPrompt = caseStudy?.initial_prompt || caseStudy?.initialPrompt || '';
    const lines = String(initialPrompt || '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

    let numbered = lines
        .filter((line) => /^\d+[).:]\s+/.test(line))
        .map((line) => line.replace(/^\d+[).:]\s*/, '').trim())
        .filter(Boolean);

    if (numbered.length < 2) {
        const flattened = String(initialPrompt || '').replace(/\s+/g, ' ').trim();
        const inlineMatches = [...flattened.matchAll(/(?:^|\s)\d+[).:]\s*(.+?)(?=(?:\s+\d+[).:]\s)|$)/g)];
        const inline = inlineMatches
            .map((m) => String(m[1] || '').trim())
            .filter((q) => q.length > 8);
        if (inline.length > 0) numbered = inline;
    }

    const questions = numbered.length > 0 ? numbered : [fallback];
    return questions.map((text, idx) => ({
        id: `q-${idx + 1}`,
        index: idx,
        text,
        status: 'not_attempted',
        attempted: false,
        flagged: false,
        attempts: 0,
        lastScore: null,
        locked: false
    }));
};

const isQuestionClosed = (q) => {
    if (!q || typeof q !== 'object') return false;
    if (q.status === 'passed') return true;
    return q.status === 'failed' && Number(q.attempts || 0) >= 3;
};

const getNextOpenQuestionIndex = (questions = [], fromIndex = 0) => {
    if (!Array.isArray(questions) || questions.length === 0) return -1;
    for (let i = Math.max(0, fromIndex); i < questions.length; i += 1) {
        if (!isQuestionClosed(questions[i])) return i;
    }
    return -1;
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

const getParsedSectionsFromCase = (caseStudy = {}) => {
    const rawSections = caseStudy?.parsed_sections ?? caseStudy?.parsedSections ?? {};
    if (rawSections && typeof rawSections === 'object') return rawSections;
    if (typeof rawSections === 'string') {
        try {
            const parsed = JSON.parse(rawSections);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch {
            return {};
        }
    }
    return {};
};

const normalizeMockDrillMode = (caseStudy = {}) => {
    const parsedSections = getParsedSectionsFromCase(caseStudy);
    const caseModeRaw = parsedSections?._caseMode || caseStudy?.case_mode || caseStudy?.caseMode || '';
    const caseMode = String(caseModeRaw).toLowerCase().replace(/[\s-]+/g, '_');
    const enabledByMode = ['mock_drill_chat', 'mock_drill', 'mockdrill_chat', 'mockdrill', 'simulation_chat'].includes(caseMode);
    const hasLeverConfig = Array.isArray(parsedSections?._mockDrill?.levers) && parsedSections._mockDrill.levers.length > 0;
    const enabledByFlag = parsedSections?._mockDrill?.enabled === true;
    return enabledByMode || enabledByFlag || hasLeverConfig;
};

const buildDefaultLeversFromMetrics = (financialData = {}) => {
    return Object.entries(financialData || {})
        .filter(([, values]) => Array.isArray(values) && values.length > 1)
        .slice(0, 8)
        .map(([metricKey, values], idx) => ({
            id: `${metricKey}_${idx + 1}`,
            group: /revenue|profit|margin|cost|cash|ebitda/.test(metricKey) ? 'Financial' : /churn|customer|nps|cac|ltv|conversion/.test(metricKey) ? 'Market' : /delay|delivery|ops|inventory|utilization/.test(metricKey) ? 'Operations' : 'Strategy',
            label: `${prettifyMetricLabel(metricKey)} Lever`,
            metricKey,
            min: -30,
            max: 30,
            step: 5,
            defaultValue: 0,
            weight: 1,
            _baselineValues: values.map(Number).filter(Number.isFinite)
        }));
};

const resolveMockDrillLevers = (caseStudy = {}) => {
    const parsedSections = getParsedSectionsFromCase(caseStudy);
    const configured = Array.isArray(parsedSections?._mockDrill?.levers) ? parsedSections._mockDrill.levers : [];
    if (configured.length > 0) {
        return configured.map((lever, idx) => ({
            id: String(lever.id || `${lever.metricKey || 'metric'}_${idx + 1}`),
            group: String(lever.group || 'Strategy'),
            label: String(lever.label || prettifyMetricLabel(lever.metricKey || `lever_${idx + 1}`)),
            metricKey: String(lever.metricKey || ''),
            min: Number.isFinite(Number(lever.min)) ? Number(lever.min) : -30,
            max: Number.isFinite(Number(lever.max)) ? Number(lever.max) : 30,
            step: Number.isFinite(Number(lever.step)) && Number(lever.step) > 0 ? Number(lever.step) : 5,
            defaultValue: Number.isFinite(Number(lever.defaultValue)) ? Number(lever.defaultValue) : 0,
            weight: Number.isFinite(Number(lever.weight)) ? Number(lever.weight) : 1
        })).filter((l) => l.metricKey);
    }

    return buildDefaultLeversFromMetrics(caseStudy?.financial_data || {});
};

const applyMockDrillToMetricRows = (baseRows = [], levers = [], valuesByLeverId = {}) => {
    if (!Array.isArray(baseRows) || baseRows.length === 0) return [];
    const rows = baseRows.map((row) => ({ ...row, values: [...(row.values || [])] }));
    const metricLevers = {};
    for (const lever of levers || []) {
        if (!lever?.metricKey) continue;
        if (!metricLevers[lever.metricKey]) metricLevers[lever.metricKey] = [];
        metricLevers[lever.metricKey].push(lever);
    }

    return rows.map((row) => {
        const linkedLevers = metricLevers[row.key] || [];
        if (linkedLevers.length === 0) return row;

        const nextValues = [...row.values];
        const multiplier = linkedLevers.reduce((acc, lever) => {
            const current = Number(valuesByLeverId?.[lever.id] ?? lever.defaultValue ?? 0);
            const bounded = Math.max(Number(lever.min), Math.min(Number(lever.max), current));
            const weight = Number.isFinite(Number(lever.weight)) ? Number(lever.weight) : 1;
            return acc * (1 + (bounded / 100) * weight);
        }, 1);

        for (let i = 0; i < nextValues.length; i += 1) {
            nextValues[i] = Number((Number(nextValues[i]) * multiplier).toFixed(2));
        }

        const delta = nextValues.length > 1 ? nextValues[nextValues.length - 1] - nextValues[0] : 0;
        const improving = getMetricDirection(row.key) === 'higher'
            ? nextValues[nextValues.length - 1] >= nextValues[0]
            : nextValues[nextValues.length - 1] <= nextValues[0];

        return {
            ...row,
            values: nextValues,
            quarterly: aggregateQuarterly(nextValues),
            delta,
            improving
        };
    });
};

const isLikelyMetricSeriesLine = (text = '') => {
    const line = String(text || '').trim();
    if (!line) return false;
    const hasMetricWord = /(revenue|profit|margin|cost|churn|ratio|spend|kpi|metric|trend|active user|cac|ltv|retention)/i.test(line);
    const numbers = line.match(/-?\d+(?:\.\d+)?/g) || [];
    const hasSeriesSeparator = /[:,]/.test(line);
    return hasMetricWord && numbers.length >= 3 && hasSeriesSeparator;
};

// ─── Main Component ────────────────────────────────────────────────────────
const CandidateAssessment = ({ isDemo = false, isDirectCase = false }) => {
    const { inviteId, caseStudyId } = useParams();
    const { userEmail, userRole } = useData();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [session, setSession] = useState(null);
    const [caseStudy, setCaseStudy] = useState(null);
    const [briefSections, setBriefSections] = useState([]);
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
    const [activeCaseSection, setActiveCaseSection] = useState('overview');
    const [theme, setTheme] = useState(getInitialTheme);
    const [leftWidth, setLeftWidth] = useState(() => window.innerWidth <= 1280 ? 280 : 300);
    const [rightWidth, setRightWidth] = useState(() => window.innerWidth <= 1280 ? 340 : 370);
    const [questionTracker, setQuestionTracker] = useState([]);
    const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
    const [simulationValues, setSimulationValues] = useState({});
    const [simulationRows, setSimulationRows] = useState([]);
    const [simulationRunsByQuestionId, setSimulationRunsByQuestionId] = useState({});
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

    useEffect(() => {
        if (!session?.id || !Array.isArray(questionTracker) || questionTracker.length === 0) return;
        localStorage.setItem(`assessment-question-tracker-${session.id}`, JSON.stringify({
            questionTracker,
            activeQuestionIndex
        }));
    }, [session?.id, questionTracker, activeQuestionIndex]);

    const applySessionData = (sess, cs) => {
        setSession(sess);
        setCaseStudy(cs);
        setBriefSections([]);
        setSectionPayloads({});
        setSectionLoadingKey('');
        setSectionError('');
        setActiveCaseSection('overview');
        const history = Array.isArray(sess.chat_history) && sess.chat_history.length > 0
            ? sess.chat_history
            : [{ role: 'assistant', content: cs.initial_prompt }];
        setMessages(history);
        setStatus(sess.status || 'active');
        setStrikes(sess.strikes || 0);
        setAttemptsLeft(Math.max(0, 3 - (sess.strikes || 0)));
        setCurrentStep(sess.current_step || 'diagnostic');
        const extractedQuestions = extractProblemQuestions(cs || {});
        const trackerStorageKey = `assessment-question-tracker-${sess.id}`;
        const storedTrackerRaw = localStorage.getItem(trackerStorageKey);

        if (storedTrackerRaw) {
            try {
                const parsed = JSON.parse(storedTrackerRaw);
                const storedQuestions = Array.isArray(parsed?.questionTracker) ? parsed.questionTracker : [];
                if (storedQuestions.length === extractedQuestions.length) {
                    setQuestionTracker(storedQuestions);
                    setActiveQuestionIndex(Math.max(0, Math.min(storedQuestions.length - 1, Number(parsed?.activeQuestionIndex || 0))));
                } else {
                    setQuestionTracker(extractedQuestions);
                    setActiveQuestionIndex(0);
                }
            } catch {
                setQuestionTracker(extractedQuestions);
                setActiveQuestionIndex(0);
            }
        } else {
            setQuestionTracker(extractedQuestions);
            setActiveQuestionIndex(0);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (!caseStudy?.id) {
            setBriefSections([]);
            return;
        }

        let cancelled = false;
        const fetchBriefSections = async () => {
            try {
                const res = await axios.get(`${API_BASE}/case-studies/${caseStudy.id}/brief`);
                const dbSections = Array.isArray(res.data?.brief?.sections) ? res.data.brief.sections : [];
                if (cancelled) return;
                setBriefSections(dbSections);
            } catch {
                if (!cancelled) setBriefSections([]);
            }
        };

        fetchBriefSections();
        return () => { cancelled = true; };
    }, [caseStudy?.id]);

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
        const activeQuestion = questionTracker[activeQuestionIndex] || null;
        if (activeQuestion && isQuestionClosed(activeQuestion)) {
            setCoachNote('This question is closed (passed or 3 attempts completed). Move to another open question.');
            return;
        }
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setIsSending(true);
        try {
            const res = await axios.post(`${API_BASE}/assess/respond`, {
                sessionId: session.id,
                userMessage: userMsg,
                currentStep,
                activeQuestion: activeQuestion
                    ? {
                        id: activeQuestion.id,
                        index: activeQuestion.index,
                        total: questionTracker.length,
                        text: activeQuestion.text
                    }
                    : null,
                enforcePerQuestionAttempts: true
            });
            if (res.data.success) {
                setMessages(prev => [...prev, { role: 'assistant', content: res.data.aiResponse }]);
                setStatus(res.data.status);
                setStrikes(res.data.strikes);
                setAttemptsLeft(res.data.attemptsLeft ?? Math.max(0, 3 - (res.data.strikes || 0)));
                setCurrentStep(res.data.currentStep || currentStep);
                setScoreBreakdown(res.data.scoreBreakdown || null);
                setScoring(res.data.scoring || null);
                if (res.data.conversationalFeedback) setCoachNote(res.data.conversationalFeedback);

                let nextActiveIndex = activeQuestionIndex;
                setQuestionTracker((prev) => {
                    if (!Array.isArray(prev) || prev.length === 0) return prev;
                    const idx = Math.max(0, Math.min(activeQuestionIndex, prev.length - 1));
                    const questionResult = res.data.questionResult;
                    const isPassed = questionResult
                        ? Boolean(questionResult.passed)
                        : Number(res.data?.scoreBreakdown?.totalScore || 0) >= 60;

                    const next = [...prev];
                    const current = next[idx];
                    if (!current) return prev;

                    const nextAttempts = Number(current.attempts || 0) + 1;
                    const reachedLimit = nextAttempts >= 3;
                    const closed = isPassed || reachedLimit;

                    next[idx] = {
                        ...current,
                        attempted: true,
                        flagged: closed ? false : current.flagged,
                        attempts: nextAttempts,
                        status: isPassed ? 'passed' : 'failed',
                        lastScore: Number(res.data?.scoreBreakdown?.totalScore ?? current.lastScore),
                        locked: closed
                    };

                    if (closed) {
                        const nextOpen = getNextOpenQuestionIndex(next, idx + 1);
                        if (nextOpen >= 0) {
                            nextActiveIndex = nextOpen;
                        }
                    }

                    return next;
                });
                setActiveQuestionIndex(nextActiveIndex);
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

    const numberedQs = questionTracker.map((q) => q.text).filter(Boolean);
    const activeQuestion = questionTracker[activeQuestionIndex] || null;
    const activeQuestionAttempts = Number(activeQuestion?.attempts || 0);
    const activeQuestionAttemptsLeft = Math.max(0, 3 - activeQuestionAttempts);
    const activeQuestionClosed = Boolean(activeQuestion && isQuestionClosed(activeQuestion));
    const allQuestionsClosed = questionTracker.length > 0 && questionTracker.every((q) => isQuestionClosed(q));
    const attemptedQuestionCount = questionTracker.filter((q) => q.attempted).length;
    const passedQuestionCount = questionTracker.filter((q) => q.status === 'passed').length;
    const failedQuestionCount = questionTracker.filter((q) => q.status === 'failed').length;
    const flaggedQuestionCount = questionTracker.filter((q) => q.flagged && !q.attempted).length;

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
        if (!Array.isArray(metricRows) || metricRows.length === 0) return null;

        if (!hasCandidateProgress || !latestCandidateAnswer.trim()) {
            const baselineEntries = metricRows
                .map((row) => {
                    const first = Number(row.values?.[0] || 0);
                    const last = Number(row.values?.[row.values.length - 1] || 0);
                    const diff = last - first;
                    if (!Number.isFinite(diff) || Math.abs(diff) < 0.0001) return null;

                    const direction = getMetricDirection(row.key);
                    const isImprovement = direction === 'higher' ? diff > 0 : diff < 0;
                    return {
                        isImprovement,
                        magnitude: Math.abs(diff),
                        text: `${row.label}: ${diff >= 0 ? '+' : ''}${formatMetricValue(diff, row.unit)}`
                    };
                })
                .filter(Boolean)
                .sort((a, b) => b.magnitude - a.magnitude);

            return {
                title: 'Case Metrics Overview',
                improved: baselineEntries.filter((e) => e.isImprovement).slice(0, 4).map((e) => e.text),
                worsened: baselineEntries.filter((e) => !e.isImprovement).slice(0, 4).map((e) => e.text),
                missed: [],
                isBaseline: true
            };
        }

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
            title: 'Latest Answer Impact',
            improved: improved.slice(0, 4),
            worsened: worsened.slice(0, 4),
            missed,
            isBaseline: false
        };
    }, [latestCandidateAnswer, metricRows, dynamicMetricRows, cockpitMetrics, hasCandidateProgress]);

    const mockDrillEnabled = useMemo(() => normalizeMockDrillMode(caseStudy || {}), [caseStudy]);
    const mockDrillLevers = useMemo(() => resolveMockDrillLevers(caseStudy || {}), [caseStudy]);

    useEffect(() => {
        if (!mockDrillEnabled) {
            setSimulationValues({});
            setSimulationRows([]);
            setSimulationRunsByQuestionId({});
            return;
        }

        const nextValues = {};
        for (const lever of mockDrillLevers) {
            nextValues[lever.id] = Number(lever.defaultValue || 0);
        }
        setSimulationValues(nextValues);
        setSimulationRows([]);
        setSimulationRunsByQuestionId({});
    }, [mockDrillEnabled, mockDrillLevers]);

    const activeQuestionSimulationKey = activeQuestion?.id || 'global';
    const hasSimulationRunForActiveQuestion = Boolean(simulationRunsByQuestionId?.[activeQuestionSimulationKey]);

    const simulationPreviewRows = useMemo(() => {
        if (!mockDrillEnabled) return [];
        return applyMockDrillToMetricRows(metricRows, mockDrillLevers, simulationValues);
    }, [mockDrillEnabled, metricRows, mockDrillLevers, simulationValues]);

    const simulationDisplayRows = simulationRows.length > 0 ? simulationRows : simulationPreviewRows;

    const simulationTimelineLabels = useMemo(() => {
        const seriesLen = Math.max(...simulationDisplayRows.map((row) => row.values.length), 0);
        if (seriesLen <= 0) return [];
        if (seriesLen <= 12) return monthNames.slice(0, seriesLen);
        return Array.from({ length: seriesLen }, (_, i) => `P${i + 1}`);
    }, [simulationDisplayRows]);

    const simulationKpis = useMemo(() => simulationDisplayRows.slice(0, 8).map((row) => ({
        key: row.key,
        label: row.label,
        current: row.values[row.values.length - 1] || 0,
        delta: row.delta,
        deltaPct: row.values.length > 1 && row.values[0] !== 0 ? ((row.values[row.values.length - 1] - row.values[0]) / Math.abs(row.values[0])) * 100 : 0,
        isImproving: row.improving,
        touched: false
    })), [simulationDisplayRows]);

    const simulationLeversByGroup = useMemo(() => {
        return Object.entries(mockDrillLevers.reduce((acc, lever) => {
            const group = lever.group || 'Strategy';
            if (!acc[group]) acc[group] = [];
            acc[group].push(lever);
            return acc;
        }, {}));
    }, [mockDrillLevers]);

    const runSimulationForActiveQuestion = () => {
        const nextRows = applyMockDrillToMetricRows(metricRows, mockDrillLevers, simulationValues);
        setSimulationRows(nextRows);
        setSimulationRunsByQuestionId((prev) => ({ ...prev, [activeQuestionSimulationKey]: true }));
        setCoachNote('Simulation executed. Use these impact signals in your answer.');
    };

    const caseSections = useMemo(() => {
        const deduped = [];
        const seen = new Set();

        const push = (section) => {
            const key = String(section?.key || '').trim();
            const label = String(section?.label || '').trim();
            if (!key || !label) return;
            const dedupeKey = `${label.toLowerCase()}::${key}`;
            if (seen.has(dedupeKey)) return;
            seen.add(dedupeKey);
            deduped.push({ key, label, role: String(section?.role || 'other') });
        };

        if (Array.isArray(briefSections) && briefSections.length > 0) {
            briefSections.forEach(push);
            return deduped;
        }

        const rawSections = getParsedSectionsFromCase(caseStudy);
        const llmSections = Array.isArray(rawSections?._sections) ? rawSections._sections : [];
        llmSections.forEach((s, idx) => {
            const content = String(s?.content || '').trim();
            if (!content) return;
            push({ key: `section_${idx}`, label: String(s?.heading || `Section ${idx + 1}`), role: String(s?.role || 'other') });
        });

        return deduped;
    }, [briefSections, caseStudy]);

    const handleSectionSelect = (sectionKey) => {
        setActiveCaseSection(sectionKey);
        setSectionError('');
    };

    useEffect(() => {
        if (!['overview', 'data', 'simulation'].includes(activeCaseSection)) {
            setActiveCaseSection('overview');
        }
    }, [activeCaseSection]);

    useEffect(() => {
        if (!caseStudy?.id || !Array.isArray(caseSections) || caseSections.length === 0) return;

        const targets = caseSections
            .map((s) => String(s?.key || '').trim())
            .filter((k) => k.length > 0 && !sectionPayloads[k]);

        if (targets.length === 0) return;

        let cancelled = false;
        const fetchAllSections = async () => {
            setSectionLoadingKey('overview_all');
            setSectionError('');
            try {
                const results = await Promise.all(targets.map(async (key) => {
                    const res = await axios.get(`${API_BASE}/case-studies/${caseStudy.id}/brief-section/${key}`);
                    return { key, section: res.data?.section || null, success: Boolean(res.data?.success && res.data?.section) };
                }));

                if (cancelled) return;

                const nextPayloads = {};
                for (const item of results) {
                    if (item.success) nextPayloads[item.key] = item.section;
                }
                setSectionPayloads((prev) => ({ ...prev, ...nextPayloads }));
            } catch (err) {
                if (!cancelled) setSectionError(err.response?.data?.error || 'Failed to load section content.');
            } finally {
                if (!cancelled) setSectionLoadingKey('');
            }
        };

        fetchAllSections();
        return () => { cancelled = true; };
    }, [caseStudy?.id, caseSections, sectionPayloads]);

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

                <SidebarCard label="Case Flow" variant="accent">
                    <div className="sidebar-section-nav" aria-label="Candidate case flow">
                        <button
                            className={`sidebar-section-btn ${activeCaseSection === 'overview' ? 'active' : ''}`}
                            onClick={() => handleSectionSelect('overview')}
                        >
                            Overview
                        </button>
                        <button
                            className={`sidebar-section-btn ${activeCaseSection === 'data' ? 'active' : ''}`}
                            onClick={() => handleSectionSelect('data')}
                        >
                            Data & Metrics
                        </button>
                        {mockDrillEnabled && (
                            <button
                                className={`sidebar-section-btn sidebar-section-btn--mock-drill ${activeCaseSection === 'simulation' ? 'active' : ''}`}
                                onClick={() => setActiveCaseSection('simulation')}
                            >
                                Run Simulations
                            </button>
                        )}
                    </div>
                </SidebarCard>

                <SidebarCard label="Question Tracker" variant="accent">
                    <div className="question-tracker-summary">
                        <p>Attempted {attemptedQuestionCount}/{questionTracker.length || 0}</p>
                        <p>Passed {passedQuestionCount} · Failed {failedQuestionCount} · Later {flaggedQuestionCount}</p>
                    </div>
                    <div className="question-tracker-list" role="list" aria-label="Problem question status tracker">
                        {questionTracker.map((q, idx) => {
                            const stateClass = q.flagged && !q.attempted ? 'flagged' : q.status;
                            return (
                                <button
                                    key={q.id}
                                    role="listitem"
                                    className={`question-chip question-chip--${stateClass} ${activeQuestionIndex === idx ? 'active' : ''}`}
                                    onClick={() => setActiveQuestionIndex(idx)}
                                    title={q.text}
                                >
                                    <span className="question-chip__index">Q{idx + 1}</span>
                                    <span className="question-chip__text">{q.text}</span>
                                </button>
                            );
                        })}
                    </div>
                    <div className="question-legend" aria-label="Question status legend">
                        <span><i className="dot dot--grey" />Not attempted</span>
                        <span><i className="dot dot--green" />Attempted and passed</span>
                        <span><i className="dot dot--red" />Attempted and failed</span>
                        <span><i className="dot dot--yellow" />Flagged for later</span>
                    </div>
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

                {activeCaseSection === 'overview' && (
                <section className="case-content-pane" aria-label="Overview content">
                    <article className="main-section-card">
                        <h3>Overview</h3>
                        {sectionLoadingKey === 'overview_all' && (
                            <p>Loading overview sections...</p>
                        )}
                        {sectionError && (
                            <p>{sectionError}</p>
                        )}

                        {!sectionError && caseSections.length === 0 && (
                            <p>No overview sections were found for this case study.</p>
                        )}

                        {!sectionError && caseSections.length > 0 && caseSections.map((section) => {
                            const payload = sectionPayloads[section.key] || {};
                            const title = String(payload.title || payload.heading || section.label || 'Section').trim();
                            const content = String(payload.content || '').trim();
                            const bullets = Array.isArray(payload.bullets)
                                ? payload.bullets.map((b) => String(b || '').trim()).filter(Boolean)
                                : [];
                            const paragraphs = content
                                ? content.split(/\n{2,}/).map((p) => String(p || '').trim()).filter(Boolean)
                                : [];

                            if (!title && paragraphs.length === 0 && bullets.length === 0) return null;

                            return (
                                <section key={section.key} style={{ marginBottom: '14px' }}>
                                    <h4 className="brief-subheading" style={{ marginTop: 0 }}>{title}</h4>
                                    {paragraphs.length > 0 && paragraphs.map((p, idx) => (
                                        <p key={`${section.key}-p-${idx}`} style={{ whiteSpace: 'pre-wrap' }}>{p}</p>
                                    ))}
                                    {bullets.length > 0 && (
                                        <ul>
                                            {bullets.map((item, idx) => <li key={`${section.key}-b-${idx}`}>{item}</li>)}
                                        </ul>
                                    )}
                                </section>
                            );
                        })}
                    </article>
                </section>
                )}

                {activeCaseSection === 'data' && (
                <section className="kpi-rail" aria-label="Executive KPI rail">
                    {staticKpis.slice(0, 8).map((metric) => (
                        <article key={metric.key} className={`kpi-tile ${metric.isImproving ? 'up' : 'down'}`}>
                            <p className="kpi-tile__name">{metric.label}</p>
                            <p className="kpi-tile__value">{formatMetricValue(metric.current, inferMetricUnit(metric.key, [metric.current]))}</p>
                            <p className={`kpi-tile__delta ${metric.delta >= 0 ? 'positive' : 'negative'}`}>
                                {metric.delta >= 0 ? '+' : ''}{metric.delta.toFixed(2)} ({metric.deltaPct >= 0 ? '+' : ''}{metric.deltaPct.toFixed(1)}%)
                            </p>
                        </article>
                    ))}
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
                                    {metricRows.map((row) => (
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
                                    {metricRows.map((row) => (
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
                        {metricRows.slice(0, 5).map((row) => (
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

                {activeCaseSection === 'simulation' && mockDrillEnabled && (
                    <>
                        <section className="simulation-hero" aria-label="Run simulations workspace">
                            <div>
                                <p className="simulation-hero__eyebrow">Interactive Scenario Lab</p>
                                <h3>Run Simulations</h3>
                                <p className="simulation-hero__desc">This simulation is dynamic and uses only the metrics available in this case study. Adjust levers and execute to see updated KPI, tables, and trends.</p>
                            </div>
                            <div className="simulation-hero__status-wrap">
                                <div className={`simulation-status-pill ${hasSimulationRunForActiveQuestion ? 'ready' : 'pending'}`}>
                                    {hasSimulationRunForActiveQuestion ? 'Simulation Executed' : 'Simulation Pending'}
                                </div>
                                <button className="theme-switch" onClick={() => setActiveCaseSection('data')}>
                                    Back To Data & Metrics
                                </button>
                            </div>
                        </section>

                        <section className="metrics-deep-dive">
                            <div className="table-card">
                                <div className="table-card__header">
                                    <h3>Simulation Controls</h3>
                                    <p>Configure levers and run impact simulation for this case.</p>
                                </div>
                                <div className="simulation-controls-grid">
                                    {simulationLeversByGroup.length === 0 && (
                                        <div className="simulation-empty-card">
                                            <h4>No simulation levers available</h4>
                                            <p>This case has no simulation controls configured.</p>
                                        </div>
                                    )}

                                    {simulationLeversByGroup.map(([group, levers]) => (
                                        <div key={group} className="simulation-group-card">
                                            <div className="simulation-group-title">{group}</div>
                                            <div className="simulation-group-levers">
                                                {levers.map((lever) => (
                                                    <label key={lever.id} className="simulation-lever-row">
                                                        <div className="simulation-lever-header">
                                                            <span>{lever.label}</span>
                                                            <span>{Number(simulationValues[lever.id] ?? lever.defaultValue ?? 0)}%</span>
                                                        </div>
                                                        <input
                                                            type="range"
                                                            min={lever.min}
                                                            max={lever.max}
                                                            step={lever.step}
                                                            value={Number(simulationValues[lever.id] ?? lever.defaultValue ?? 0)}
                                                            onChange={(event) => {
                                                                const v = Number(event.target.value);
                                                                setSimulationValues((prev) => ({ ...prev, [lever.id]: v }));
                                                            }}
                                                        />
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}

                                    <div className="simulation-controls-actions">
                                        <button className="theme-switch" onClick={() => {
                                            const resetValues = {};
                                            for (const lever of mockDrillLevers) resetValues[lever.id] = Number(lever.defaultValue || 0);
                                            setSimulationValues(resetValues);
                                            setSimulationRows([]);
                                            setSimulationRunsByQuestionId((prev) => ({ ...prev, [activeQuestionSimulationKey]: false }));
                                        }}>
                                            Reset
                                        </button>
                                        <button className="btn-primary" onClick={runSimulationForActiveQuestion} disabled={simulationLeversByGroup.length === 0}>
                                            Execute Simulation
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="table-card">
                                <div className="table-card__header">
                                    <h3>Simulation KPI Rail</h3>
                                    <p>Live KPI impact from current simulation parameters.</p>
                                </div>
                                <div className="simulation-impact-wrap">
                                    <section className="kpi-rail" aria-label="Simulation KPI rail">
                                        {simulationKpis.map((metric) => (
                                            <article key={metric.key} className={`kpi-tile ${metric.isImproving ? 'up' : 'down'}`}>
                                                <p className="kpi-tile__name">{metric.label}</p>
                                                <p className="kpi-tile__value">{formatMetricValue(metric.current, inferMetricUnit(metric.key, [metric.current]))}</p>
                                                <p className={`kpi-tile__delta ${metric.delta >= 0 ? 'positive' : 'negative'}`}>
                                                    {metric.delta >= 0 ? '+' : ''}{metric.delta.toFixed(2)} ({metric.deltaPct >= 0 ? '+' : ''}{metric.deltaPct.toFixed(1)}%)
                                                </p>
                                            </article>
                                        ))}
                                    </section>
                                </div>
                            </div>
                        </section>

                        <section className="metrics-deep-dive">
                            <div className="table-card">
                                <div className="table-card__header">
                                    <h3>Simulated Monthly Metrics</h3>
                                    <p>Case-specific dynamic series after simulation execution.</p>
                                </div>
                                <div className="metrics-table-wrap">
                                    <table className="metrics-table">
                                        <thead>
                                            <tr>
                                                <th>Parameter</th>
                                                <th>Unit</th>
                                                {simulationTimelineLabels.map((label) => <th key={label}>{label}</th>)}
                                                <th>Trend</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {simulationDisplayRows.map((row) => (
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
                                    <h3>Simulated Quarterly Rollup</h3>
                                    <p>Quarterly summary based on this case's metric structure.</p>
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
                                            {simulationDisplayRows.map((row) => (
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

                        {simulationDisplayRows.length > 0 && (
                            <section className="trend-strip">
                                {simulationDisplayRows.slice(0, 5).map((row) => (
                                    <MetricLineChart
                                        key={row.key}
                                        label={row.label}
                                        values={row.values}
                                        xLabels={simulationTimelineLabels}
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

                    {activeQuestion && (
                        <div className="active-question-box">
                            <p className="active-question-box__label">Current problem statement</p>
                            <p className="active-question-box__title">Question {activeQuestion.index + 1} of {questionTracker.length}</p>
                            <p className="active-question-box__text">{activeQuestion.text}</p>
                            <div className="active-question-box__actions">
                                <button
                                    type="button"
                                    className="btn-flag"
                                    onClick={() => {
                                        setQuestionTracker((prev) => prev.map((q, idx) => idx === activeQuestionIndex
                                            ? (() => {
                                                const nextFlagged = !q.flagged;
                                                return {
                                                    ...q,
                                                    flagged: nextFlagged,
                                                    status: q.attempted ? q.status : (nextFlagged ? 'flagged' : 'not_attempted')
                                                };
                                            })()
                                            : q));
                                    }}
                                >
                                    {activeQuestion.flagged ? 'Unflag' : 'Flag for later'}
                                </button>
                                <button
                                    type="button"
                                    className="btn-next-question"
                                    onClick={() => setActiveQuestionIndex((prev) => Math.min(questionTracker.length - 1, prev + 1))}
                                    disabled={activeQuestionIndex >= questionTracker.length - 1}
                                >
                                    Next Question
                                </button>
                            </div>
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

                {status === 'active' && !allQuestionsClosed ? (
                    <form className="chat-input-form" onSubmit={handleSendMessage}>
                        <div className="chat-input-wrap">
                            <textarea
                                className="chat-textarea"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder={activeQuestionClosed ? 'This question is closed. Select another open question.' : 'Respond with diagnosis, numbers, recommendations, and risk'}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); }
                                }}
                                rows={3}
                                disabled={activeQuestionClosed}
                            />
                            <button type="submit" className="chat-send-btn" disabled={isSending || !input.trim() || activeQuestionClosed} aria-label="Send">
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                                    <path d="M3 11.5L21 3L13.5 21L11 13L3 11.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </button>
                        </div>
                        <p className="input-hint">Coach hint: {coachNote}</p>
                        <p className="input-hint">Question attempts left: {activeQuestionAttemptsLeft}/3</p>
                    </form>
                ) : (
                    <div className="session-conclusion">
                        <div className="conclusion-icon">{allQuestionsClosed || status === 'completed' ? '✅' : '🚫'}</div>
                        <h2>{allQuestionsClosed || status === 'completed' ? 'Assessment Concluded' : 'Session Terminated'}</h2>
                        <p>{allQuestionsClosed ? 'All questions are closed (passed or 3 attempts used). Your responses have been captured.' : status === 'completed' ? 'Your responses have been submitted.' : 'Session ended due to logical consistency thresholds.'}</p>
                        <button className="btn-primary" onClick={() => navigate(dashboardPath)}>RETURN TO DASHBOARD</button>
                    </div>
                )}
            </aside>
        </div>
    );
};

export default CandidateAssessment;
