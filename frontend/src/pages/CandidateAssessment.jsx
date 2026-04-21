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

const toMetricKey = (raw = '') => String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

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

const isMetricsSection = (section) => {
    if (!section || typeof section !== 'object') return false;
    if (String(section.role || '').toLowerCase() === 'data') return true;
    
    const heading = String(section.heading || '').toLowerCase();
    const sourceKey = String(section.sourceKey || '').toLowerCase();
    const content = String(section.content || '').toLowerCase();
    const combined = `${heading} ${sourceKey}`;

    if (/(metric|kpi|financial|finance|revenue|profit|cost|margin|trend|timeseries|time series|data series|dataset|analytics|balance sheet|asset|liabilit|cash flow|income statement)/.test(combined)) {
        return true;
    }

    const numberSignals = (content.match(/-?\d+(?:\.\d+)?/g) || []).length;
    const hasSeriesPattern = /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|q1|q2|q3|q4|month|quarter)/.test(content);
    return numberSignals >= 8 && hasSeriesPattern;
};

// Mirrors AdminEvaluation inline-chart extraction so candidates see visualizations
// directly from section content (without relying only on financial_data mapping).
const extractInlineSeries = (text = '') => {
    const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
    const groups = [];
    let currentGroup = null;
    let pendingLabel = '';

    for (const line of lines) {
        const stripped = line.replace(/^[•\-\*]\s*/, '').trim();
        const kvMatch = stripped.match(/^([^:]{1,60}):\s*([-+]?\d[\d,.]*(?:\.\d+)?)\s*([A-Za-z%/]*)\s*$/);
        if (kvMatch) {
            const pointLabel = kvMatch[1].trim();
            const value = parseFloat(kvMatch[2].replace(/,/g, ''));
            if (Number.isFinite(value)) {
                if (!currentGroup) {
                    currentGroup = { groupLabel: pendingLabel || 'Series', points: [] };
                    groups.push(currentGroup);
                }
                currentGroup.points.push({ label: pointLabel, value });
                continue;
            }
        }

        if (currentGroup) {
            if (currentGroup.points.length < 2) groups.pop();
            currentGroup = null;
        }

        if (stripped.length > 0 && stripped.length < 60 && !stripped.includes('.') && stripped.endsWith(':')) {
            pendingLabel = stripped.slice(0, -1).trim();
        } else if (stripped.length > 0 && stripped.length < 60) {
            pendingLabel = stripped;
        }
    }

    if (currentGroup && currentGroup.points.length < 2) groups.pop();

    return groups.filter((g) => g.points.length >= 2);
};

const tokenizeSimple = (text = '') => String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);

const metricBelongsToSection = (row, section) => {
    if (!row) return false;
    if (!section) return true;

    const sectionText = `${section.heading || ''} ${section.sourceKey || ''} ${section.content || ''}`.toLowerCase();
    const metricText = `${row.key || ''} ${row.label || ''}`.toLowerCase();

    const inFinancialSection = /financial|revenue|profit|margin|cost|ebitda|cash|income|expense/.test(sectionText);
    const inCustomerSection = /customer|marketing|retention|acquisition|nps|satisfaction|churn|conversion/.test(sectionText);
    const inOperationsSection = /operations|operational|delivery|logistics|process|efficiency|utilization|downtime/.test(sectionText);
    const inTrendSection = /time series|timeseries|trend|event|timeline|month|quarter/.test(sectionText);

    if (inFinancialSection) {
        return /revenue|profit|margin|cost|ebitda|cash|arpu|aov|pricing|income|expense|burn/.test(metricText);
    }
    if (inCustomerSection) {
        return /churn|retention|customer|nps|cac|ltv|conversion|repeat|complaint|satisfaction/.test(metricText);
    }
    if (inOperationsSection) {
        return /delay|delivery|cycle|utilization|downtime|sla|throughput|inventory|defect|backlog|ops|operations/.test(metricText);
    }
    if (inTrendSection) {
        return /trend|month|quarter|time|series|growth|rate|revenue|profit|cost|churn|delivery/.test(metricText);
    }

    const sectionTokens = new Set(tokenizeSimple(sectionText));
    const metricTokens = tokenizeSimple(metricText);
    return metricTokens.some((t) => sectionTokens.has(t));
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

const normalizeQuestionText = (text = '') => String(text || '')
    .replace(/^\s*\d+[).:\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim();

const isLegacyInitialPrompt = (content = '') => {
    const text = String(content || '').toLowerCase();
    return text.includes('welcome to your')
        || text.includes('here are your problem questions')
        || text.includes('please begin with your diagnostic hypothesis');
};

const extractProblemQuestions = (caseStudy = {}, draftSections = [], fallback = 'Please diagnose the core problem and propose a quantified action plan.') => {
    const extractLineQuestions = (text) => {
        const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
        return lines
            .map((line) => {
                const m = line.replace(/^[•\-\*]\s*/, '').match(/^(\d+)[.)\s]\s*(.{8,})$/);
                return m ? String(m[2] || '').trim() : '';
            })
            .filter(Boolean);
    };

    const extractInlineQuestions = (text) => {
        const flat = String(text || '').replace(/\s+/g, ' ').trim();
        return [...flat.matchAll(/(?:^|\s)\d+[).:]\s*(.+?)(?=(?:\s+\d+[).:]\s)|$)/g)]
            .map((m) => String(m[1] || '').trim())
            .filter((q) => q.length > 8);
    };

    // 1) Match AdminEvaluation behavior: derive from displayed problem-like sections first.
    const problemSections = (Array.isArray(draftSections) ? draftSections : []).filter((s) =>
        String(s?.role || '') === 'problem' ||
        /question|problem|statement|challenge|task|objective|deliverable/i.test(String(s?.heading || ''))
    );

    const found = [];
    for (const sec of problemSections) {
        const lineBased = extractLineQuestions(sec?.content || '');
        if (lineBased.length > 0) {
            found.push(...lineBased);
            continue;
        }
        const inline = extractInlineQuestions(sec?.content || '');
        if (inline.length > 0) found.push(...inline);
    }

    if (found.length > 0) {
        return found.map((text, idx) => ({
            id: `q-${idx + 1}`,
            index: idx,
            text: normalizeQuestionText(text),
            status: 'not_attempted',
            attempted: false,
            flagged: false,
            attempts: 0,
            lastScore: null,
            locked: false
        }));
    }

    // 2) Fallback to canonical problem statement fields.
    const problemText = String(
        caseStudy?.problem_statement ||
        caseStudy?.problemStatement ||
        ''
    );
    const lineBasedFromProblem = extractLineQuestions(problemText);
    const inlineFromProblem = extractInlineQuestions(problemText);
    const numbered = lineBasedFromProblem.length > 0 ? lineBasedFromProblem : inlineFromProblem;

    if (numbered.length > 0) {
        return numbered.map((text, idx) => ({
            id: `q-${idx + 1}`,
            index: idx,
            text: normalizeQuestionText(text),
            status: 'not_attempted',
            attempted: false,
            flagged: false,
            attempts: 0,
            lastScore: null,
            locked: false
        }));
    }

    // 3. Fallback to parsed sections
    const parsedSections = caseStudy?.parsed_sections || caseStudy?.parsedSections || {};
    const parsedQuestions = Array.isArray(parsedSections?._problemQuestions)
        ? parsedSections._problemQuestions.map((q) => String(q || '').trim()).filter(Boolean)
        : [];

    if (parsedQuestions.length > 0) {
        return parsedQuestions.map((text, idx) => ({
            id: `q-${idx + 1}`,
            index: idx,
            text: normalizeQuestionText(text),
            status: 'not_attempted',
            attempted: false,
            flagged: false,
            attempts: 0,
            lastScore: null,
            locked: false
        }));
    }

    // 4. Last resort fallback
    return (fallback || '').split('\n').filter(l => l.trim().length > 4).map((text, idx) => ({
        id: `q-${idx + 1}`,
        index: idx,
        text: normalizeQuestionText(text),
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
    const maxVal = Math.max(...values.map((n) => Math.abs(Number(n) || 0)), 0);
    const looksMonetary = /(revenue|sales|spend|budget|marketing|logistics|cost|profit|income|ebitda|cash|investment|pricing|price|arpu|cac|ltv|aov|gmv|arr|mrr|dollar)/.test(k);

    if (k.includes('pct') || k.includes('percent') || k.includes('rate') || k.includes('margin')) return 'percent';
    if (k.includes('ratio')) return 'ratio';
    if (k.includes('days') || k.includes('delivery_time')) return 'days';
    if (k.endsWith('_cr')) return 'inr_cr';
    if (k.endsWith('_l') || k.endsWith('_lakhs') || k.includes('lakh')) return 'inr_lakh';
    if (k.includes('crore') || k.includes('cr_')) return 'inr_cr';
    if (looksMonetary) {
        if (maxVal >= 1000) return 'inr';
        if (maxVal >= 100) return 'inr_cr';
        return 'inr_lakh';
    }

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
    if (unit === 'inr') return 'INR (Rs)';
    if (unit === 'inr_cr') return 'INR Crore';
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
                <span>{unitDisplayLabel(unit)}</span>
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

const buildSectionsFromDraft = (draft) => {
    if (!draft) return [];
    const sections = [];
    const seenKeys = new Set();

    const pushSection = (section) => {
        if (!section || typeof section !== 'object') return;
        const content = String(section.content || '').trim();
        const heading = String(section.heading || '').trim();
        if (!heading || content.length < 10) return;
        const normKey = heading.toLowerCase().replace(/[^a-z0-9]+/g, '_');
        if (seenKeys.has(normKey)) return;
        seenKeys.add(normKey);
        sections.push({ ...section, heading, content });
    };

    const parsedSections = getParsedSectionsFromCase(draft);
    const llmSections = Array.isArray(parsedSections._sections)
        ? parsedSections._sections
        : [];

    if (llmSections.length > 0) {
        llmSections.forEach((s, idx) => {
            pushSection({
                id: `llm-${idx}`,
                heading: s.heading,
                content: s.content,
                role: s.role || 'other',
                kind: 'llm'
            });
        });
        return sections;
    }

    if (String(draft.context || '').trim().length > 10) {
        pushSection({ id: 'h-overview', heading: 'Overview', content: draft.context, role: 'context', kind: 'heuristic' });
    }
    if (String(draft.problemStatement || '').trim().length > 10) {
        pushSection({ id: 'h-problem', heading: 'Problem Statement', content: draft.problemStatement, role: 'problem', kind: 'heuristic' });
    }
    if (String(draft.initialPrompt || '').trim().length > 10) {
        pushSection({ id: 'h-opening', heading: 'Opening Prompt', content: draft.initialPrompt, role: 'prompt', kind: 'heuristic' });
    }
    Object.entries(parsedSections)
        .filter(([k, v]) => !String(k).startsWith('_') && String(v || '').trim().length > 10)
        .forEach(([key, value], idx) => {
            pushSection({
                id: `h-parsed-${idx + 1}`,
                heading: prettifyMetricLabel(key),
                sourceKey: key,
                content: String(value || '').trim(),
                role: 'other',
                kind: 'heuristic'
            });
        });

    return sections;
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

const buildDefaultLeversFromMetricRows = (rows = []) => {
    return (rows || [])
        .filter((row) => row?.key && Array.isArray(row?.values) && row.values.length > 1)
        .map((row, idx) => ({
            id: `${row.key}_${idx + 1}`,
            group: /revenue|profit|margin|cost|cash|ebitda/.test(row.key) ? 'Financial' : /churn|customer|nps|cac|ltv|conversion/.test(row.key) ? 'Market' : /delay|delivery|ops|inventory|utilization/.test(row.key) ? 'Operations' : 'Strategy',
            label: `${prettifyMetricLabel(row.key)} Lever`,
            metricKey: row.key,
            min: -30,
            max: 30,
            step: 1,
            defaultValue: 0,
            weight: 1,
            _baselineValues: row.values.map(Number).filter(Number.isFinite)
        }));
};

const resolveMockDrillLevers = (caseStudy = {}, fallbackMetricRows = []) => {
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
            step: 1,
            defaultValue: Number.isFinite(Number(lever.defaultValue)) ? Number(lever.defaultValue) : 0,
            weight: Number.isFinite(Number(lever.weight)) ? Number(lever.weight) : 1
        })).filter((l) => l.metricKey);
    }

    return buildDefaultLeversFromMetricRows(fallbackMetricRows);
};

const applyMockDrillToMetricRows = (baseRows = [], levers = [], valuesByLeverId = {}) => {
    if (!Array.isArray(baseRows) || baseRows.length === 0) return [];
    const rows = baseRows.map((row) => ({ ...row, values: [...(row.values || [])] }));
    const normalizeKey = (raw = '') => String(raw || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const metricLevers = {};
    for (const lever of levers || []) {
        if (!lever?.metricKey) continue;
        if (!metricLevers[lever.metricKey]) metricLevers[lever.metricKey] = [];
        metricLevers[lever.metricKey].push(lever);
    }

    return rows.map((row) => {
        let linkedLevers = metricLevers[row.key] || [];
        if (linkedLevers.length === 0) {
            const rowNorm = normalizeKey(row.key);
            linkedLevers = (levers || []).filter((lever) => {
                const leverNorm = normalizeKey(lever?.metricKey || '');
                if (!leverNorm || !rowNorm) return false;
                return rowNorm.includes(leverNorm) || leverNorm.includes(rowNorm);
            });
        }
        if (linkedLevers.length === 0) return row;

        const nextValues = [...row.values];
        const totalImpact = linkedLevers.reduce((acc, lever) => {
            const current = Number(valuesByLeverId?.[lever.id] ?? lever.defaultValue ?? 0);
            const bounded = Math.max(Number(lever.min), Math.min(Number(lever.max), current));
            const weight = Number.isFinite(Number(lever.weight)) ? Number(lever.weight) : 1;
            return acc + (bounded / 100) * weight;
        }, 0);

        const rowDirection = getMetricDirection(row.key);
        const signedImpact = rowDirection === 'lower' ? -totalImpact : totalImpact;

        const periods = Math.max(1, nextValues.length - 1);
        const baseDelta = nextValues.length > 1
            ? Number(nextValues[nextValues.length - 1]) - Number(nextValues[0])
            : 0;

        for (let i = 0; i < nextValues.length; i += 1) {
            const base = Number(nextValues[i]) || 0;
            const timeWeight = periods > 0 ? i / periods : 1;
            const levelShift = signedImpact * (0.18 + 0.82 * timeWeight);
            const slopeShift = signedImpact * (0.55 * timeWeight * timeWeight) * (baseDelta || Math.max(1, Math.abs(base)));
            const adjusted = (base * (1 + levelShift)) + slopeShift;
            nextValues[i] = Number(adjusted.toFixed(2));
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

const clampLeverValue = (value, lever) => {
    const min = Number(lever?.min);
    const max = Number(lever?.max);
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return Number(lever?.defaultValue ?? 0);
    const bounded = Math.max(min, Math.min(max, parsed));
    return Math.round(bounded);
};

const getLeverValue = (lever, simulationValues = {}) => {
    const raw = simulationValues?.[lever?.id] ?? lever?.defaultValue ?? 0;
    return clampLeverValue(raw, lever);
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
    const [activeCaseSection, setActiveCaseSection] = useState('overview');
    const [theme, setTheme] = useState(getInitialTheme);
    const [leftWidth, setLeftWidth] = useState(() => window.innerWidth <= 1280 ? 280 : 300);
    const [rightWidth, setRightWidth] = useState(() => window.innerWidth <= 1280 ? 340 : 370);
    const [questionTracker, setQuestionTracker] = useState([]);
    const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
    const [questionAnswerLog, setQuestionAnswerLog] = useState({});
    const [simulationValues, setSimulationValues] = useState({});
    const [simulationRows, setSimulationRows] = useState([]);
    const [simulationRunsByQuestionId, setSimulationRunsByQuestionId] = useState({});
    const [speechSupported, setSpeechSupported] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [speechError, setSpeechError] = useState('');
    const chatEndRef = useRef(null);
    const speechRecognitionRef = useRef(null);
    const speechBaseInputRef = useRef('');
    const speechFinalTranscriptRef = useRef('');
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
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setSpeechSupported(false);
            return undefined;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            setIsListening(true);
            setSpeechError('');
        };

        recognition.onresult = (event) => {
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i += 1) {
                const text = String(event.results[i]?.[0]?.transcript || '').trim();
                if (!text) continue;
                if (event.results[i].isFinal) {
                    speechFinalTranscriptRef.current = `${speechFinalTranscriptRef.current} ${text}`.trim();
                } else {
                    interimTranscript = `${interimTranscript} ${text}`.trim();
                }
            }

            const merged = [speechBaseInputRef.current, speechFinalTranscriptRef.current, interimTranscript]
                .filter((part) => String(part || '').trim().length > 0)
                .join(' ')
                .replace(/\s+/g, ' ')
                .trim();

            setInput(merged);
        };

        recognition.onerror = (event) => {
            const code = String(event?.error || 'unknown');
            const map = {
                'not-allowed': 'Microphone access was denied.',
                'service-not-allowed': 'Speech service unavailable in this browser.',
                'no-speech': 'No speech detected. Try again.',
                'audio-capture': 'No microphone detected.',
                'network': 'Speech recognition network error.'
            };
            setSpeechError(map[code] || 'Speech recognition error.');
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        speechRecognitionRef.current = recognition;
        setSpeechSupported(true);

        return () => {
            try {
                recognition.stop();
            } catch {
                // no-op
            }
            speechRecognitionRef.current = null;
            setIsListening(false);
        };
    }, []);

    const toggleSpeechToText = () => {
        if (!speechSupported || !speechRecognitionRef.current) return;

        if (isListening) {
            try {
                speechRecognitionRef.current.stop();
            } catch {
                // no-op
            }
            return;
        }

        speechBaseInputRef.current = String(input || '').trim();
        speechFinalTranscriptRef.current = '';
        setSpeechError('');

        try {
            speechRecognitionRef.current.start();
        } catch {
            setSpeechError('Unable to start speech recognition.');
        }
    };

    useEffect(() => {
        if (!session?.id || !Array.isArray(questionTracker) || questionTracker.length === 0) return;
        localStorage.setItem(`assessment-question-tracker-${session.id}`, JSON.stringify({
            questionTracker,
            activeQuestionIndex
        }));
    }, [session?.id, questionTracker, activeQuestionIndex]);

    useEffect(() => {
        // Reset view state when interviewer moves to another question.
    }, [activeQuestionIndex]);

    const applySessionData = (sess, cs) => {
        setSession(sess);
        setCaseStudy(cs);
        const draftSections = buildSectionsFromDraft(cs);
        setBriefSections(draftSections);
        setActiveCaseSection(draftSections.length > 0 ? draftSections[0].id : 'overview');
        const extractedQuestions = extractProblemQuestions(cs || {}, draftSections);
        const initialPromptText = String(cs?.initial_prompt || cs?.initialPrompt || '').trim().toLowerCase();
        const history = Array.isArray(sess.chat_history) && sess.chat_history.length > 0
            ? sess.chat_history.filter((m) => {
                if (m?.role !== 'assistant') return true;
                const msg = String(m?.content || '').trim().toLowerCase();
                if (!msg) return false;
                if (isLegacyInitialPrompt(msg)) return false;
                if (initialPromptText && msg === initialPromptText) return false;
                return true;
            })
            : [];
        setMessages(history);
        setQuestionAnswerLog({});
        setStatus(sess.status || 'active');
        setStrikes(sess.strikes || 0);
        setAttemptsLeft(Math.max(0, 3 - (sess.strikes || 0)));
        setCurrentStep(sess.current_step || 'diagnostic');
        const trackerStorageKey = `assessment-question-tracker-${sess.id}`;
        const storedTrackerRaw = localStorage.getItem(trackerStorageKey);

        if (storedTrackerRaw) {
            try {
                const parsed = JSON.parse(storedTrackerRaw);
                const storedQuestions = Array.isArray(parsed?.questionTracker) ? parsed.questionTracker : [];
                const normalizeQ = (q) => String(q || '').replace(/^\d+[).:\s]+/, '').replace(/\s+/g, ' ').trim().toLowerCase();
                const sameLength = storedQuestions.length === extractedQuestions.length;
                const sameSequence = sameLength && storedQuestions.every((q, idx) =>
                    normalizeQ(q?.text) === normalizeQ(extractedQuestions[idx]?.text)
                );

                if (sameSequence) {
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

        if (isListening && speechRecognitionRef.current) {
            try {
                speechRecognitionRef.current.stop();
            } catch {
                // no-op
            }
        }

        const userMsg = input.trim();
        const activeQuestion = questionTracker[activeQuestionIndex] || null;
        const activeQuestionId = activeQuestion?.id || 'global';
        if (activeQuestion && isQuestionClosed(activeQuestion)) {
            setCoachNote('This question is closed (passed or 3 attempts completed). Move to another open question.');
            return;
        }
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg, questionId: activeQuestionId }]);
        setQuestionAnswerLog((prev) => ({
            ...prev,
            [activeQuestionId]: [...(Array.isArray(prev[activeQuestionId]) ? prev[activeQuestionId] : []), userMsg]
        }));
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
                setMessages(prev => [...prev, { role: 'assistant', content: res.data.aiResponse, questionId: activeQuestionId }]);
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

    // ── Derive Sections from caseStudy directly (matches Admin UI) ──
    useEffect(() => {
        if (!caseStudy) return;
        const draftSections = buildSectionsFromDraft(caseStudy);
        setBriefSections(draftSections);
        if (draftSections.length > 0 && !draftSections.find(s => s.id === activeCaseSection)) {
            setActiveCaseSection(draftSections[0].id);
        }
    }, [caseStudy]);

    const activeSectionData = useMemo(() => briefSections.find(s => s.id === activeCaseSection), [briefSections, activeCaseSection]);
    const activeInlineSeries = useMemo(() => extractInlineSeries(activeSectionData?.content || ''), [activeSectionData]);
    const activeInlineMetricRows = useMemo(() => {
        return (activeInlineSeries || []).map((series, idx) => {
            const values = (series?.points || []).map((p) => Number(p?.value)).filter(Number.isFinite);
            const keySeed = series?.groupLabel || `series_${idx + 1}`;
            const key = toMetricKey(keySeed) || `series_${idx + 1}`;
            const delta = values.length > 1 ? values[values.length - 1] - values[0] : 0;
            const improving = values.length > 1 ? values[values.length - 1] >= values[0] : true;
            return {
                key,
                label: String(series?.groupLabel || `Series ${idx + 1}`),
                unit: inferMetricUnit(key, values),
                values,
                quarterly: aggregateQuarterly(values),
                delta,
                improving
            };
        }).filter((row) => Array.isArray(row.values) && row.values.length > 0);
    }, [activeInlineSeries]);

    // ── Derive chart and cockpit data (must stay before conditional returns) ──
    const threshold = Number(caseStudy?.threshold_passing_score ?? 0.6);
    const passingMarks = Math.round((Number.isFinite(threshold) ? threshold : 0.6) * 100);

    const activeQuestion = questionTracker[activeQuestionIndex] || null;
    const activeQuestionAttempts = Number(activeQuestion?.attempts || 0);
    const activeQuestionAttemptsLeft = Math.max(0, 3 - activeQuestionAttempts);
    const activeQuestionClosed = Boolean(activeQuestion && isQuestionClosed(activeQuestion));
    const allQuestionsClosed = questionTracker.length > 0 && questionTracker.every((q) => isQuestionClosed(q));
    const attemptedQuestionCount = questionTracker.filter((q) => q.attempted).length;
    const passedQuestionCount = questionTracker.filter((q) => q.status === 'passed').length;
    const failedQuestionCount = questionTracker.filter((q) => q.status === 'failed').length;
    const flaggedQuestionCount = questionTracker.filter((q) => q.flagged && !q.attempted).length;
    const activeQuestionId = activeQuestion?.id || 'global';

    const activeQuestionAnswers = Array.isArray(questionAnswerLog[activeQuestionId]) ? questionAnswerLog[activeQuestionId] : [];
    const latestActiveQuestionAnswer = activeQuestionAnswers[activeQuestionAnswers.length - 1] || '';
    const activeQuestionAnswerCorpus = activeQuestionAnswers.join(' ').trim();
    const hasActiveQuestionProgress = activeQuestionAnswerCorpus.length > 0;

    const inlineSeriesData = useMemo(() => {
        if (!Array.isArray(briefSections) || briefSections.length === 0) return {};
        const map = {};

        for (const section of briefSections) {
            const sectionSeed = toMetricKey(section?.sourceKey || section?.heading || section?.id || 'section');
            const groups = extractInlineSeries(section?.content || '');

            groups.forEach((series, idx) => {
                const values = (series?.points || []).map((p) => Number(p?.value)).filter(Number.isFinite);
                if (values.length < 2) return;

                let key = toMetricKey(`${sectionSeed}_${series?.groupLabel || `series_${idx + 1}`}`);
                if (!key) key = `series_${sectionSeed}_${idx + 1}`;

                if (Array.isArray(map[key]) && map[key].length >= values.length) return;
                map[key] = values;
            });
        }

        return map;
    }, [briefSections]);

    const mergedNumericData = useMemo(() => {
        const financialData = (caseStudy?.financial_data && typeof caseStudy.financial_data === 'object')
            ? caseStudy.financial_data
            : {};
        const parsedSections = getParsedSectionsFromCase(caseStudy || {});
        const numericFromParsed = (parsedSections && typeof parsedSections._numericSeries === 'object')
            ? Object.fromEntries(
                Object.entries(parsedSections._numericSeries).map(([k, v]) => [k, Array.isArray(v?.values) ? v.values : []])
            )
            : {};

        return {
            ...inlineSeriesData,
            ...numericFromParsed,
            ...financialData
        };
    }, [caseStudy, inlineSeriesData]);

    // Stable string representation for deps (avoid re-creating arrays)
    const financialDataKey = useMemo(() => JSON.stringify(mergedNumericData || {}), [mergedNumericData]);

    const dynamicCockpitMetrics = useMemo(
        () => buildCockpitMetrics(
            mergedNumericData || {},
            activeQuestionAnswerCorpus,
            activeQuestion?.lastScore ?? scoreBreakdown?.totalScore
        ),
        [financialDataKey, activeQuestionAnswerCorpus, activeQuestion?.lastScore, scoreBreakdown?.totalScore, mergedNumericData]
    );

    // Phase step labels
    const stepNames  = { diagnostic: 'Diagnose', brainstorming: 'Brainstorm', calculations: 'Calculate', final_recommendation: 'Recommend' };

    const timelineLabels = useMemo(() => {
        const seriesLen = Math.max(...Object.values(mergedNumericData || {}).map((v) => (Array.isArray(v) ? v.length : 0)), 0);
        if (seriesLen <= 0) return [];
        if (seriesLen <= 12) return monthNames.slice(0, seriesLen);
        return Array.from({ length: seriesLen }, (_, i) => `P${i + 1}`);
    }, [mergedNumericData]);

    const metricRows = useMemo(() => {
        return Object.entries(mergedNumericData || {})
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
    }, [mergedNumericData]);

    const scopedMetricRows = useMemo(() => {
        if (!activeSectionData) return [];
        return metricRows.filter(row => metricBelongsToSection(row, activeSectionData));
    }, [metricRows, activeSectionData]);

    const dynamicMetricRows = useMemo(() => {
        if (!hasActiveQuestionProgress) return metricRows;

        const signalMap = Object.fromEntries(dynamicCockpitMetrics.map((m) => [m.key, m]));
        const activeQuestionCoverage = Math.max(
            5,
            buildQuestionCoverage(activeQuestion ? [activeQuestion.text] : [], activeQuestionAnswerCorpus)
        );
        const influence = Math.max(0.25, ((activeQuestionCoverage / 100) + ((scoreBreakdown?.totalScore || 0) / 100)) / 2);
        const weakAnswer = latestActiveQuestionAnswer.trim().length < 40;

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
    }, [
        metricRows,
        dynamicCockpitMetrics,
        activeQuestion,
        activeQuestionAnswerCorpus,
        latestActiveQuestionAnswer,
        scoreBreakdown?.totalScore,
        hasActiveQuestionProgress
    ]);

    const dynamicScopedMetricRows = useMemo(() => {
        if (!activeSectionData) return [];
        return dynamicMetricRows.filter((row) => metricBelongsToSection(row, activeSectionData));
    }, [dynamicMetricRows, activeSectionData]);

    const sectionOriginalMetricRows = useMemo(() => {
        if (scopedMetricRows.length > 0) return scopedMetricRows;
        return activeInlineMetricRows;
    }, [scopedMetricRows, activeInlineMetricRows]);

    const sectionDynamicMetricRows = useMemo(() => {
        if (dynamicScopedMetricRows.length > 0) return dynamicScopedMetricRows;

        if (sectionOriginalMetricRows.length === 0) return [];
        if (!hasActiveQuestionProgress) return sectionOriginalMetricRows;

        const signalEntries = Array.isArray(dynamicCockpitMetrics) ? dynamicCockpitMetrics : [];
        const findSignal = (row) => {
            const rowKey = String(row?.key || '').toLowerCase();
            const rowLabel = String(row?.label || '').toLowerCase();
            const matched = signalEntries.find((s) => {
                const sk = String(s?.key || '').toLowerCase();
                const sl = String(s?.label || s?.key || '').toLowerCase();
                return sk === rowKey || sl === rowLabel || rowLabel.includes(sl) || sl.includes(rowLabel);
            });

            if (matched) return matched;

            // Fallback for section-specific inline rows that are not in canonical metric map.
            return {
                key: row?.key || rowLabel,
                label: row?.label || rowLabel,
                direction: getMetricDirection(row?.key || row?.label || ''),
                touched: candidateTouchesMetric(row?.label || row?.key || '', activeQuestionAnswerCorpus)
            };
        };

        const activeQuestionCoverage = Math.max(
            5,
            buildQuestionCoverage(activeQuestion ? [activeQuestion.text] : [], activeQuestionAnswerCorpus)
        );
        const influence = Math.max(0.25, ((activeQuestionCoverage / 100) + ((scoreBreakdown?.totalScore || 0) / 100)) / 2);
        const weakAnswer = latestActiveQuestionAnswer.trim().length < 40;

        return sectionOriginalMetricRows.map((row, idx) => {
            const signal = findSignal(row);
            if (!signal || !Array.isArray(row.values) || row.values.length === 0) return row;

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
            const improving = getMetricDirection(row.key || row.label || `series_${idx + 1}`) === 'higher'
                ? nextValues[lastIdx] >= nextValues[0]
                : nextValues[lastIdx] <= nextValues[0];

            return {
                ...row,
                values: nextValues,
                quarterly: aggregateQuarterly(nextValues),
                delta,
                improving
            };
        });
    }, [
        dynamicScopedMetricRows,
        sectionOriginalMetricRows,
        hasActiveQuestionProgress,
        dynamicCockpitMetrics,
        activeQuestion,
        activeQuestionAnswerCorpus,
        scoreBreakdown?.totalScore,
        latestActiveQuestionAnswer
    ]);

    const sectionHasDataMetrics = sectionOriginalMetricRows.length > 0;

    const displayedMetricRows = useMemo(() => sectionDynamicMetricRows, [sectionDynamicMetricRows]);

    const displayedTimelineLabels = useMemo(() => {
        const seriesLen = Math.max(...displayedMetricRows.map((row) => Array.isArray(row?.values) ? row.values.length : 0), 0);
        if (seriesLen <= 0) return [];
        if (seriesLen <= 12) return monthNames.slice(0, seriesLen);
        return Array.from({ length: seriesLen }, (_, i) => `P${i + 1}`);
    }, [displayedMetricRows]);

    const displayedKpis = useMemo(() => displayedMetricRows.slice(0, 8).map((row) => ({
        key: row.key,
        label: row.label,
        unit: row.unit,
        current: row.values[row.values.length - 1] || 0,
        delta: row.delta,
        deltaPct: row.values.length > 1 && row.values[0] !== 0
            ? ((row.values[row.values.length - 1] - row.values[0]) / Math.abs(row.values[0])) * 100
            : 0,
        isImproving: row.improving,
        touched: false
    })), [displayedMetricRows]);

    const displayedUnitLegend = useMemo(() => {
        const entries = Array.from(new Set(displayedMetricRows.map((row) => row.unit).filter(Boolean)));
        return entries.map((unit) => ({
            unit,
            label: unitDisplayLabel(unit)
        }));
    }, [displayedMetricRows]);

    const decisionImpact = useMemo(() => {
        if (!Array.isArray(metricRows) || metricRows.length === 0) return null;

        if (!hasActiveQuestionProgress) {
            return {
                title: 'LATEST ANSWER IMPACT',
                improved: [],
                worsened: [],
                missed: [],
                isBaseline: false,
                isReset: true
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
            const shortLabel = String(row.label || '').length > 44
                ? `${String(row.label).slice(0, 44)}...`
                : row.label;
            const entry = `${shortLabel}: ${diff >= 0 ? '+' : ''}${formatMetricValue(diff, row.unit)}`;
            if (isImprovement) improved.push(entry);
            else worsened.push(entry);
        }

        const missed = dynamicCockpitMetrics.filter((m) => !m.touched).slice(0, 3).map((m) => m.label);
        return {
            title: 'LATEST ANSWER IMPACT',
            improved: improved.slice(0, 4),
            worsened: worsened.slice(0, 4),
            missed,
            isBaseline: false,
            isReset: false
        };
    }, [metricRows, dynamicMetricRows, dynamicCockpitMetrics, hasActiveQuestionProgress, activeQuestionId]);

    const sidebarImpactSeries = useMemo(() => {
        if (!hasActiveQuestionProgress) return [];

        const baseMap = Object.fromEntries(metricRows.map((m) => [m.key, m.values[m.values.length - 1] || 0]));
        const ranked = dynamicMetricRows
            .map((row) => {
                const key = row.key;
                const baseline = Number(baseMap[key] || 0);
                const current = Number(row.values?.[row.values.length - 1] || 0);
                const diff = current - baseline;
                const touched = candidateTouchesMetric(row.label || row.key, activeQuestionAnswerCorpus);
                return {
                    ...row,
                    diff,
                    touched,
                    magnitude: Math.abs(diff)
                };
            })
            .filter((row) => Array.isArray(row.values) && row.values.length > 1)
            .sort((a, b) => {
                if (a.touched !== b.touched) return a.touched ? -1 : 1;
                return b.magnitude - a.magnitude;
            });

        return ranked.slice(0, 3);
    }, [hasActiveQuestionProgress, metricRows, dynamicMetricRows, activeQuestionAnswerCorpus]);

    const mockDrillEnabled = useMemo(() => normalizeMockDrillMode(caseStudy || {}), [caseStudy]);
    const mockDrillLevers = useMemo(() => resolveMockDrillLevers(caseStudy || {}, metricRows), [caseStudy, metricRows]);

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

    const simulationDisplayRows = simulationPreviewRows;

    const simulationTimelineLabels = useMemo(() => {
        const seriesLen = Math.max(...simulationDisplayRows.map((row) => row.values.length), 0);
        if (seriesLen <= 0) return [];
        if (seriesLen <= 12) return monthNames.slice(0, seriesLen);
        return Array.from({ length: seriesLen }, (_, i) => `P${i + 1}`);
    }, [simulationDisplayRows]);

    const simulationKpis = useMemo(() => simulationDisplayRows.map((row) => ({
        key: row.key,
        label: row.label,
        unit: row.unit,
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
                        <span className="time-pill">30 min</span>
                    </div>
                    <h2 className="case-title">Case Sections</h2>
                    <p className="case-industry">Navigate the full brief before responding</p>
                </div>

                <SidebarCard label="Section Navigator">
                    <div className="sidebar-section-nav" aria-label="Candidate section flow">
                        {briefSections.map((s) => (
                            <button
                                key={s.id}
                                type="button"
                                className={`sidebar-section-btn ${activeCaseSection === s.id ? 'active' : ''}`}
                                onClick={() => setActiveCaseSection(s.id)}
                            >
                                <span style={{ flex: 1, textAlign: 'left' }}>{s.heading || 'Untitled Section'}</span>
                                {s.role && s.role !== 'other' && (
                                    <span className={`role-pill role-pill--${s.role}`}>{s.role}</span>
                                )}
                            </button>
                        ))}
                        {mockDrillEnabled && (
                            <button
                                className={`sidebar-section-btn sidebar-section-btn--mock-drill ${activeCaseSection === 'simulation' ? 'active' : ''}`}
                                style={{ marginTop: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}
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
                                    <span className="question-chip__text">{normalizeQuestionText(q.text)}</span>
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

                {activeSectionData && (
                <section className="case-content-pane" aria-label={`${activeSectionData.heading} content`}>
                    <article className="main-section-card">
                        <h3 style={{ textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '0.04em' }}>{activeSectionData.heading}</h3>
                        <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '24px' }}>
                            {activeSectionData.content}
                        </div>
                    </article>

                    {activeInlineSeries.length > 0 && !sectionHasDataMetrics && (
                        <>
                            <div style={{
                                marginTop: '16px',
                                padding: '12px 0 4px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                letterSpacing: '0.08em',
                                color: 'var(--text-secondary)',
                                textTransform: 'uppercase',
                            }}>
                                Data Visualisation
                            </div>
                            <section className="trend-strip" style={{ marginTop: '8px', flexWrap: 'wrap', gap: '12px' }}>
                                {activeInlineSeries.map((series, si) => (
                                    <MetricLineChart
                                        key={`${activeSectionData.id}-series-${si}`}
                                        label={series.groupLabel}
                                        values={series.points.map((p) => p.value)}
                                        xLabels={series.points.map((p) => p.label)}
                                        unit="count"
                                    />
                                ))}
                            </section>
                        </>
                    )}
                </section>
                )}

                {sectionHasDataMetrics && displayedMetricRows.length > 0 && (
                <section className="metric-legend-strip" aria-label="Units and indicator legend">
                    <div className="metric-legend-group">
                        <span className="metric-legend-title">Units</span>
                        {displayedUnitLegend.map((entry) => (
                            <span key={`unit-${entry.unit}`} className="metric-legend-chip">{entry.label}</span>
                        ))}
                    </div>
                    <div className="metric-legend-group">
                        <span className="metric-legend-title">Indicators</span>
                        <span className="metric-legend-chip metric-legend-chip--good">Green = Improving</span>
                        <span className="metric-legend-chip metric-legend-chip--bad">Red = Worsening</span>
                        <span className="metric-legend-chip">Heatmap = Higher intensity means higher value</span>
                    </div>
                </section>
                )}

                {sectionHasDataMetrics && displayedMetricRows.length > 0 && (
                <section className="kpi-rail" aria-label="Executive KPI rail">
                    {displayedKpis.slice(0, 8).map((metric) => (
                        <article key={metric.key} className={`kpi-tile ${metric.isImproving ? 'up' : 'down'}`}>
                            <p className="kpi-tile__name">{metric.label}</p>
                            <p className="kpi-tile__unit">{unitDisplayLabel(metric.unit)}</p>
                            <p className="kpi-tile__value">{formatMetricValue(metric.current, metric.unit)}</p>
                            <p className={`kpi-tile__delta ${metric.delta >= 0 ? 'positive' : 'negative'}`}>
                                {metric.delta >= 0 ? '+' : '-'}{formatMetricValue(Math.abs(metric.delta), metric.unit)} ({metric.deltaPct >= 0 ? '+' : ''}{metric.deltaPct.toFixed(1)}%)
                            </p>
                        </article>
                    ))}
                </section>
                )}

                {sectionHasDataMetrics && displayedMetricRows.length > 0 && (
                <>
                <section className="metrics-deep-dive metrics-deep-dive--single">
                    <div className="table-card">
                        <div className="table-card__header">
                            <h3>Section Metrics Breakdown</h3>
                            <p>{`Answer-driven changes for ${activeQuestion ? `Q${activeQuestion.index + 1}` : 'the current question'} including follow-up/counter-question responses`}</p>
                        </div>
                        <div className="metrics-table-wrap">
                            <table className="metrics-table">
                                <thead>
                                    <tr>
                                        <th>Parameter</th>
                                        <th>Unit</th>
                                        {displayedTimelineLabels.map((label, idx) => <th key={`${label}-${idx}`}>{label}</th>)}
                                        <th>Trend</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayedMetricRows.map((row) => (
                                        <tr key={row.key}>
                                            <td className="sticky-col">{row.label}</td>
                                            <td>{unitDisplayLabel(row.unit)}</td>
                                            {displayedTimelineLabels.map((_, idx) => {
                                                const val = row.values[idx];
                                                return (
                                                    <td key={`${row.key}-${idx}`}>
                                                        {val !== undefined ? formatMetricValue(val, row.unit) : '—'}
                                                    </td>
                                                );
                                            })}
                                            <td className={`trend-cell ${row.improving ? 'trend-positive' : 'trend-negative'}`}>{row.improving ? 'Improving' : 'Down'}</td>
                                        </tr>
                                    ))}
                
                                </tbody>
                            </table>
                        </div>
                    </div>

                </section>

                <section className="metrics-deep-dive metrics-deep-dive--single">
                    <div className="table-card">
                        <div className="table-card__header">
                            <h3>Metric Heatmap</h3>
                            <p>Each row is a parameter; darker cells indicate larger values in that series.</p>
                        </div>
                        <div className="metrics-table-wrap">
                            <div className="metric-heatmap-wrap">
                                {displayedMetricRows.slice(0, 8).map((row) => {
                                    const values = row.values.map(Number).filter(Number.isFinite);
                                    const min = Math.min(...values);
                                    const max = Math.max(...values);
                                    const span = Math.max(0.0001, max - min);

                                    return (
                                        <div key={`heat-${row.key}`} className="metric-heatmap-row">
                                            <div className="metric-heatmap-row__label">{row.label}</div>
                                            <div className="metric-heatmap-cells">
                                                {displayedTimelineLabels.map((label, idx) => {
                                                    const value = values[idx];
                                                    if (value === undefined) {
                                                        return <div key={`heat-${row.key}-${idx}`} className="metric-heatmap-cell metric-heatmap-cell--empty">—</div>;
                                                    }
                                                    const normalized = (value - min) / span;
                                                    const alpha = 0.16 + normalized * 0.78;
                                                    return (
                                                        <div
                                                            key={`heat-${row.key}-${idx}`}
                                                            className="metric-heatmap-cell"
                                                            style={{ background: `rgba(31,111,235,${alpha.toFixed(3)})` }}
                                                            title={`${row.label} · ${label}: ${formatMetricValue(value, row.unit)}`}
                                                        >
                                                            <span>{label}</span>
                                                            <strong>{formatAxisTickValue(value, row.unit)}</strong>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                </section>

                {displayedMetricRows.length > 0 && (
                    <section className="trend-strip">
                        {displayedMetricRows.slice(0, 5).map((row) => (
                            <MetricLineChart
                                key={row.key}
                                label={row.label}
                                values={row.values}
                                xLabels={displayedTimelineLabels}
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
                                <button className="theme-switch" onClick={() => {
                                    const firstDataSection = briefSections.find((s) => isMetricsSection(s));
                                    setActiveCaseSection(firstDataSection?.id || briefSections?.[0]?.id || 'overview');
                                }}>
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
                                                            <div className="simulation-lever-value-wrap">
                                                                <input
                                                                    type="number"
                                                                    className="simulation-lever-value-input"
                                                                    min={lever.min}
                                                                    max={lever.max}
                                                                    step={1}
                                                                    value={getLeverValue(lever, simulationValues)}
                                                                    onChange={(event) => {
                                                                        const v = clampLeverValue(event.target.value, lever);
                                                                        setSimulationValues((prev) => ({ ...prev, [lever.id]: v }));
                                                                    }}
                                                                    onBlur={(event) => {
                                                                        const v = clampLeverValue(event.target.value, lever);
                                                                        setSimulationValues((prev) => ({ ...prev, [lever.id]: v }));
                                                                    }}
                                                                />
                                                                <span className="simulation-lever-value-unit">%</span>
                                                            </div>
                                                        </div>
                                                        <input
                                                            type="range"
                                                            min={lever.min}
                                                            max={lever.max}
                                                            step={1}
                                                            value={getLeverValue(lever, simulationValues)}
                                                            onChange={(event) => {
                                                                const v = clampLeverValue(event.target.value, lever);
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
                                                <p className="kpi-tile__unit">{unitDisplayLabel(metric.unit)}</p>
                                                <p className="kpi-tile__value">{formatMetricValue(metric.current, metric.unit)}</p>
                                                <p className={`kpi-tile__delta ${metric.delta >= 0 ? 'positive' : 'negative'}`}>
                                                    {metric.delta >= 0 ? '+' : '-'}{formatMetricValue(Math.abs(metric.delta), metric.unit)} ({metric.deltaPct >= 0 ? '+' : ''}{metric.deltaPct.toFixed(1)}%)
                                                </p>
                                            </article>
                                        ))}
                                    </section>
                                </div>
                            </div>
                        </section>

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
                        <div className="impact-box" style={{ marginTop: '16px' }}>
                            <p className="impact-box__title">{decisionImpact.title}</p>

                            {decisionImpact.isReset ? (
                                <p className="impact-empty-text">Awaiting candidate response...</p>
                            ) : (
                                <>
                                    <div className="impact-kpi-grid">
                                        <article className="impact-kpi-card good">
                                            <p className="impact-kpi-label">Improved</p>
                                            <p className="impact-kpi-value">{decisionImpact.improved.length}</p>
                                        </article>
                                        <article className="impact-kpi-card bad">
                                            <p className="impact-kpi-label">Worsened</p>
                                            <p className="impact-kpi-value">{decisionImpact.worsened.length}</p>
                                        </article>
                                        <article className="impact-kpi-card neutral">
                                            <p className="impact-kpi-label">Missed</p>
                                            <p className="impact-kpi-value">{decisionImpact.missed.length}</p>
                                        </article>
                                    </div>

                                    {(decisionImpact.worsened.length > 0 || decisionImpact.improved.length > 0) && (
                                        <div className="impact-kpi-signals">
                                            {decisionImpact.worsened.slice(0, 2).map((item, idx) => (
                                                <div key={`wk-${idx}`} className="impact-signal-row bad">
                                                    <span>Down</span>
                                                    <strong>{String(item || '').split(':')[0]}</strong>
                                                </div>
                                            ))}
                                            {decisionImpact.improved.slice(0, 1).map((item, idx) => (
                                                <div key={`ik-${idx}`} className="impact-signal-row good">
                                                    <span>Up</span>
                                                    <strong>{String(item || '').split(':')[0]}</strong>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {activeQuestion && (
                        <div className="active-question-box">
                            <p className="active-question-box__label">Current problem statement</p>
                            <p className="active-question-box__title">Question {activeQuestion.index + 1} of {questionTracker.length}</p>
                            <p className="active-question-box__text">{normalizeQuestionText(activeQuestion.text)}</p>
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
                        <div className="chat-input-wrap prompt-composer">
                            <textarea
                                className="chat-textarea prompt-text-input"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Type a message..."
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); }
                                }}
                                rows={1}
                                disabled={activeQuestionClosed}
                            />
                            <div className="prompt-actions">
                                {!input.trim() ? (
                                    <button
                                        type="button"
                                        className={`chat-send-btn prompt-send-btn ${isListening ? 'active' : ''}`}
                                        onClick={toggleSpeechToText}
                                        disabled={!speechSupported || activeQuestionClosed || isSending}
                                        aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
                                        title={isListening ? 'Stop voice input' : 'Start voice input'}
                                        style={isListening ? { background: '#f85149', boxShadow: '0 0 12px rgba(248, 81, 73, 0.4)' } : {}}
                                    >
                                        <svg viewBox="0 0 24 24" width="26" height="26" fill="none">
                                            <rect x="9" y="3" width="6" height="10" rx="3" stroke="currentColor" strokeWidth="2.4" />
                                            <path d="M6 10.5C6 14.09 8.91 17 12.5 17C16.09 17 19 14.09 19 10.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                                            <path d="M12.5 17V21" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                                        </svg>
                                    </button>
                                ) : (
                                    <button 
                                        type="submit" 
                                        className="chat-send-btn prompt-send-btn" 
                                        disabled={isSending || activeQuestionClosed} 
                                        aria-label="Send"
                                    >
                                        <svg viewBox="0 0 24 24" width="26" height="26" fill="none">
                                            <path d="M12 6V18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
                                            <path d="M7 11L12 6L17 11" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </div>
                        {speechError && <p className="input-hint speech-error-hint">{speechError}</p>}
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
