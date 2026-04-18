import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import './AdminEvaluation.css';
import './Assessment.css';

const API_BASE = 'http://localhost:5000/api';
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const METRICS_SECTION_ID = '__metrics_preview__';

const toSectionKey = (raw = '') => String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const prettifyLabel = (raw = '') => String(raw || '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();

const extractProblemQuestions = (text = '') => {
    const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
    const lineBased = lines
        .map((l) => {
            const m = l.match(/^\d+[).:]\s+(.{8,})$/);
            return m ? m[1].trim() : '';
        })
        .filter(Boolean);
    if (lineBased.length > 0) return lineBased;

    const flat = String(text || '').replace(/\s+/g, ' ').trim();
    return [...flat.matchAll(/(?:^|\s)\d+[).:]\s*(.+?)(?=(?:\s+\d+[).:]\s)|$)/g)]
        .map((m) => String(m[1] || '').trim())
        .filter((q) => q.length > 8);
};

const isMetricsSection = (section) => {
    if (!section || typeof section !== 'object') return false;
    const heading = String(section.heading || '').toLowerCase();
    const sourceKey = String(section.sourceKey || '').toLowerCase();
    const content = String(section.content || '').toLowerCase();
    const combined = `${heading} ${sourceKey}`;

    if (/(metric|kpi|financial|finance|revenue|profit|cost|margin|trend|timeseries|time series|data series|dataset|analytics)/.test(combined)) {
        return true;
    }

    const numberSignals = (content.match(/-?\d+(?:\.\d+)?/g) || []).length;
    const hasSeriesPattern = /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|q1|q2|q3|q4|month|quarter)/.test(content);
    return numberSignals >= 8 && hasSeriesPattern;
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

const buildMetricsEditorText = (rows = []) => rows
    .map((row) => `${row.key}: ${row.values.map((v) => Number(v)).join(', ')}`)
    .join('\n');

const parseSimulationConfigText = (text = '', metricRows = []) => {
    const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
    const parsedLevers = [];

    for (const line of lines) {
        // Format: group|label|metric_key|min|max|step|default
        const parts = line.split('|').map((p) => p.trim());
        if (parts.length < 7) continue;
        const [group, label, metricKeyRaw, minRaw, maxRaw, stepRaw, defaultRaw] = parts;
        const metricKey = toSectionKey(metricKeyRaw);
        const min = Number(minRaw);
        const max = Number(maxRaw);
        const step = Number(stepRaw);
        const defaultValue = Number(defaultRaw);
        if (!group || !label || !metricKey) continue;
        if (![min, max, step, defaultValue].every(Number.isFinite)) continue;
        if (max <= min || step <= 0) continue;

        parsedLevers.push({
            id: `${metricKey}_${parsedLevers.length + 1}`,
            group,
            label,
            metricKey,
            min,
            max,
            step,
            defaultValue,
            weight: 1
        });
    }

    if (parsedLevers.length > 0) return parsedLevers;

    return metricRows.slice(0, 8).map((row, idx) => ({
        id: `${row.key}_${idx + 1}`,
        group: (/revenue|profit|margin|cost|cash|ebitda/.test(row.key) ? 'Financial' : /churn|customer|nps|cac|ltv|conversion/.test(row.key) ? 'Market' : /delay|delivery|ops|inventory|utilization/.test(row.key) ? 'Operations' : 'Strategy'),
        label: `${row.label} Lever`,
        metricKey: row.key,
        min: -30,
        max: 30,
        step: 5,
        defaultValue: 0,
        weight: 1
    }));
};

const serializeSimulationConfig = (levers = []) => (levers || [])
    .map((l) => `${l.group}|${l.label}|${l.metricKey}|${l.min}|${l.max}|${l.step}|${l.defaultValue}`)
    .join('\n');

const parseMetricsEditorText = (text = '') => {
    const parsed = [];
    const lines = String(text || '').split('\n');

    for (const raw of lines) {
        const line = String(raw || '').trim();
        if (!line) continue;
        const m = line.match(/^([a-zA-Z][a-zA-Z0-9_\- ]*?)\s*:\s*(.+)$/);
        if (!m) continue;
        const key = String(m[1] || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
        const values = (String(m[2] || '').match(/-?\d+(?:\.\d+)?/g) || []).map(Number).filter(Number.isFinite);
        if (!key || values.length < 2) continue;

        const unit = inferMetricUnit(key, values);
        const delta = values[values.length - 1] - values[0];
        const improving = getMetricDirection(key) === 'higher'
            ? values[values.length - 1] >= values[0]
            : values[values.length - 1] <= values[0];

        parsed.push({
            key,
            label: prettifyLabel(key).replace(/\b\w/g, (c) => c.toUpperCase()),
            unit,
            values,
            quarterly: aggregateQuarterly(values),
            delta,
            improving
        });
    }

    return parsed;
};

const buildSectionsFromDraft = (draft) => {
    if (!draft) return [];
    const sections = [];
    const seenKeys = new Set();

    const pushSection = (section) => {
        if (!section || typeof section !== 'object') return;
        const content = String(section.content || '').trim();
        const heading = String(section.heading || '').trim();
        // Must have both a heading and meaningful content
        if (!heading || content.length < 10) return;
        const normKey = heading.toLowerCase().replace(/[^a-z0-9]+/g, '_');
        if (seenKeys.has(normKey)) return;
        seenKeys.add(normKey);
        sections.push({ ...section, heading, content });
    };

    // ── PRIMARY PATH: LLM-extracted role-tagged sections array ─────────────
    // _sections[] is the clean structured output from the LLM. Each entry
    // has { heading, content, role } — decodable later without re-parsing.
    const llmSections = Array.isArray(draft?.parsedSections?._sections)
        ? draft.parsedSections._sections
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

    // ── FALLBACK PATH: LLM failed, use heuristic draft fields ──────────────
    // Only inject a section if the field actually has content.
    if (String(draft.context || '').trim().length > 10) {
        pushSection({ id: 'h-overview', heading: 'Overview', content: draft.context, role: 'context', kind: 'heuristic' });
    }
    if (String(draft.problemStatement || '').trim().length > 10) {
        pushSection({ id: 'h-problem', heading: 'Problem Statement', content: draft.problemStatement, role: 'problem', kind: 'heuristic' });
    }
    if (String(draft.initialPrompt || '').trim().length > 10) {
        pushSection({ id: 'h-opening', heading: 'Opening Prompt', content: draft.initialPrompt, role: 'prompt', kind: 'heuristic' });
    }
    // Add any remaining flat-key parsed sections (heuristic section detection)
    Object.entries(draft.parsedSections || {})
        .filter(([k, v]) => !String(k).startsWith('_') && String(v || '').trim().length > 10)
        .forEach(([key, value], idx) => {
            pushSection({
                id: `h-parsed-${idx + 1}`,
                heading: prettifyLabel(key),
                sourceKey: key,
                content: String(value || '').trim(),
                role: 'other',
                kind: 'heuristic'
            });
        });

    return sections;
};

const getMetricDirection = (label = '') => {
    const key = String(label).toLowerCase();
    if (/cost|complaint|churn|delay|debt|risk|downtime|attrition|days sales outstanding/.test(key)) return 'lower';
    return 'higher';
};

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

const normalizeCaseDetail = (detail) => {
    if (!detail || typeof detail !== 'object') return null;

    const raw = (detail.caseStudy && typeof detail.caseStudy === 'object')
        ? detail.caseStudy
        : detail;

    const parsedSections = (raw.parsed_sections && typeof raw.parsed_sections === 'object')
        ? raw.parsed_sections
        : ((raw.parsedSections && typeof raw.parsedSections === 'object') ? raw.parsedSections : {});

    const financialData = (raw.financial_data && typeof raw.financial_data === 'object')
        ? raw.financial_data
        : ((raw.financialData && typeof raw.financialData === 'object') ? raw.financialData : {});

    const thresholdRaw = raw.threshold_passing_score ?? raw.thresholdPassingScore ?? parsedSections?._meta?.passingThreshold ?? 0.6;
    const threshold = Number(thresholdRaw);

    return {
        id: raw.id || null,
        title: String(raw.title || '').trim(),
        industry: String(raw.industry || '').trim(),
        context: String(raw.context || '').trim(),
        problemStatement: String(raw.problem_statement || raw.problemStatement || '').trim(),
        initialPrompt: String(raw.initial_prompt || raw.initialPrompt || '').trim(),
        thresholdPassingScore: Number.isFinite(threshold) ? threshold : 0.6,
        financialData,
        rawContent: String(raw.raw_content || raw.rawContent || ''),
        parsedSections
    };
};

const AdminEvaluation = () => {
    const [importingPdf, setImportingPdf] = useState(false);
    const [savingCase, setSavingCase] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [pdfDraftMeta, setPdfDraftMeta] = useState(null);
    const [pdfDraft, setPdfDraft] = useState(null);
    const [caseStudies, setCaseStudies] = useState([]);
    const [caseTitle, setCaseTitle] = useState('');
    const [caseIndustry, setCaseIndustry] = useState('');
    const [thresholdPassingScore, setThresholdPassingScore] = useState(0.6);
    const [showPreviewDialog, setShowPreviewDialog] = useState(false);
    const [theme, setTheme] = useState(document.documentElement.getAttribute('data-theme') || 'light');

    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    };
    const [sections, setSections] = useState([]);
    const [activeSectionId, setActiveSectionId] = useState('overview');
    const [editingCaseId, setEditingCaseId] = useState(null);
    const [metricsEditorText, setMetricsEditorText] = useState('');
    const [metricsEditorSectionId, setMetricsEditorSectionId] = useState('');
    const [assessmentMode, setAssessmentMode] = useState('chat_only');
    const [simulationConfigText, setSimulationConfigText] = useState('');

    const fetchCaseStudies = async () => {
        try {
            const res = await axios.get(`${API_BASE}/admin/case-studies`);
            setCaseStudies(Array.isArray(res.data?.caseStudies) ? res.data.caseStudies : []);
        } catch {
            setCaseStudies([]);
        }
    };

    useEffect(() => { fetchCaseStudies(); }, []);

    useEffect(() => {
        if (pdfDraft) {
            document.body.classList.add('hide-global-sidebar');
        } else {
            document.body.classList.remove('hide-global-sidebar');
        }
        return () => document.body.classList.remove('hide-global-sidebar');
    }, [pdfDraft]);

    const handleImportPdf = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.name.toLowerCase().endsWith('.pdf')) {
            setSaveError('Please upload a PDF file only.');
            return;
        }

        setImportingPdf(true);
        setSaveError('');
        setSaveSuccess(false);

        try {
            const formData = new FormData();
            formData.append('pdf', file);
            const res = await axios.post(`${API_BASE}/case-studies/import-pdf`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data?.success && res.data?.draft) {
                const draft = res.data.draft;
                setPdfDraft(draft);
                setPdfDraftMeta(res.data.meta || null);
                setCaseTitle(String(draft.title || '').trim());
                setCaseIndustry(String(draft.industry || '').trim());
                setThresholdPassingScore(Number(draft.thresholdPassingScore ?? 0.6));
                const draftSections = buildSectionsFromDraft(draft);
                setSections(draftSections);
                setActiveSectionId(draftSections[0]?.id || 'overview');

                const savedMode = String(draft?.parsedSections?._caseMode || 'chat_only').toLowerCase();
                const normalizedMode = savedMode === 'mock_drill_chat' ? 'mock_drill_chat' : 'chat_only';
                setAssessmentMode(normalizedMode);
                const savedLevers = Array.isArray(draft?.parsedSections?._mockDrill?.levers) ? draft.parsedSections._mockDrill.levers : [];
                setSimulationConfigText(serializeSimulationConfig(savedLevers));
            }
        } catch (err) {
            setSaveError(err.response?.data?.error || 'Failed to import PDF.');
        } finally {
            setImportingPdf(false);
            e.target.value = '';
        }
    };

    const activeSection = useMemo(
        () => sections.find((s) => s.id === activeSectionId) || null,
        [sections, activeSectionId]
    );

    const questionList = useMemo(() => {
        // ── Priority 1: LLM-extracted questions ─────────────────────────────
        const parsedQuestions = Array.isArray(pdfDraft?.parsedSections?._problemQuestions)
            ? pdfDraft.parsedSections._problemQuestions.map((q) => String(q || '').trim()).filter((q) => q.length > 8)
            : [];
        if (parsedQuestions.length > 0) return parsedQuestions;

        // ── Priority 2: Scan problem-role sections ───────────────────────────
        const problemSection = sections.find((s) => s.role === 'problem')
            || sections.find((s) => /problem|question|objective|task|deliverable/i.test(String(s.heading || '')))
            || null;
        if (problemSection) {
            const fromSection = extractProblemQuestions(problemSection.content || '');
            if (fromSection.length > 0) return fromSection;
        }

        // ── Priority 3: Scan all section content ─────────────────────────────
        const allContent = sections.map((s) => s.content || '').join('\n');
        return extractProblemQuestions(allContent).slice(0, 8);
    }, [sections, pdfDraft]);

    const metricRows = useMemo(() => {
        const numericFromDraft = pdfDraft?.financialData && typeof pdfDraft.financialData === 'object'
            ? pdfDraft.financialData
            : {};
        const numericFromParsed = (pdfDraft?.parsedSections && typeof pdfDraft.parsedSections._numericSeries === 'object')
            ? Object.fromEntries(
                Object.entries(pdfDraft.parsedSections._numericSeries).map(([k, v]) => {
                    const values = Array.isArray(v?.values) ? v.values : [];
                    return [k, values];
                })
            )
            : {};

        const merged = {
            ...numericFromParsed,
            ...numericFromDraft
        };

        return Object.entries(merged)
            .filter(([, v]) => Array.isArray(v) && v.length > 0)
            .map(([key, values]) => {
                const nums = values.map(Number).filter(Number.isFinite);
                const unit = inferMetricUnit(key, nums);
                const qAgg = aggregateQuarterly(nums);
                const delta = nums.length > 1 ? nums[nums.length - 1] - nums[0] : 0;
                const improving = nums.length > 1
                    ? (getMetricDirection(key) === 'higher' ? nums[nums.length - 1] >= nums[0] : nums[nums.length - 1] <= nums[0])
                    : true;

                return {
                    key,
                    label: prettifyLabel(key).replace(/\b\w/g, (c) => c.toUpperCase()),
                    unit,
                    values: nums,
                    quarterly: qAgg,
                    delta,
                    improving
                };
            });
    }, [pdfDraft]);

    const timelineLabels = useMemo(() => {
        const seriesLen = Math.max(...metricRows.map((row) => row.values.length), 0);
        if (seriesLen <= 0) return [];
        if (seriesLen <= 12) return monthNames.slice(0, seriesLen);
        return Array.from({ length: seriesLen }, (_, i) => `P${i + 1}`);
    }, [metricRows]);

    const metricKpis = useMemo(() => metricRows.slice(0, 8).map((row) => {
        const base = Number(row.values[0] || 0);
        const current = Number(row.values[row.values.length - 1] || 0);
        const deltaPct = row.values.length > 1 && base !== 0 ? ((current - base) / Math.abs(base)) * 100 : 0;
        return {
            key: row.key,
            label: row.label,
            unit: row.unit,
            current,
            delta: row.delta,
            deltaPct,
            isImproving: row.improving
        };
    }), [metricRows]);

    const showMetricsPreview = useMemo(() => {
        if (activeSectionId === METRICS_SECTION_ID) return true;
        return isMetricsSection(activeSection);
    }, [activeSection, activeSectionId]);

    const scopedMetricRows = useMemo(() => {
        if (!showMetricsPreview) return [];
        if (activeSectionId === METRICS_SECTION_ID || !activeSection) return metricRows;
        return metricRows.filter((row) => metricBelongsToSection(row, activeSection));
    }, [showMetricsPreview, activeSectionId, activeSection, metricRows]);

    const scopedMetricKeys = useMemo(() => new Set(scopedMetricRows.map((r) => r.key)), [scopedMetricRows]);

    useEffect(() => {
        if (!showMetricsPreview) return;
        if (metricsEditorSectionId === activeSectionId) return;
        setMetricsEditorText(buildMetricsEditorText(scopedMetricRows));
        setMetricsEditorSectionId(activeSectionId);
    }, [showMetricsPreview, scopedMetricRows, activeSectionId, metricsEditorSectionId]);

    const editedMetricRows = useMemo(() => {
        if (!showMetricsPreview) return [];
        const parsed = parseMetricsEditorText(metricsEditorText);
        return parsed.length > 0 ? parsed : scopedMetricRows;
    }, [showMetricsPreview, metricsEditorText, scopedMetricRows]);

    const editedMetricKpis = useMemo(() => editedMetricRows.slice(0, 8).map((row) => {
        const base = Number(row.values[0] || 0);
        const current = Number(row.values[row.values.length - 1] || 0);
        const deltaPct = row.values.length > 1 && base !== 0 ? ((current - base) / Math.abs(base)) * 100 : 0;
        return {
            key: row.key,
            label: row.label,
            unit: row.unit,
            current,
            delta: row.delta,
            deltaPct,
            isImproving: row.improving
        };
    }), [editedMetricRows]);

    const editedTimelineLabels = useMemo(() => {
        const seriesLen = Math.max(...editedMetricRows.map((row) => row.values.length), 0);
        if (seriesLen <= 0) return [];
        if (seriesLen <= 12) return monthNames.slice(0, seriesLen);
        return Array.from({ length: seriesLen }, (_, i) => `P${i + 1}`);
    }, [editedMetricRows]);

    const handleMetricsEditorChange = (value) => {
        setMetricsEditorText(value);

        const parsedRows = parseMetricsEditorText(value);
        if (parsedRows.length === 0) return;

        setPdfDraft((prev) => {
            if (!prev || typeof prev !== 'object') return prev;

            const nextFinancial = { ...(prev.financialData || {}) };
            const nextNumericSeries = {
                ...(prev.parsedSections && typeof prev.parsedSections._numericSeries === 'object'
                    ? prev.parsedSections._numericSeries
                    : {})
            };

            if (activeSectionId === METRICS_SECTION_ID) {
                Object.keys(nextFinancial).forEach((k) => { delete nextFinancial[k]; });
                Object.keys(nextNumericSeries).forEach((k) => { delete nextNumericSeries[k]; });
            } else {
                scopedMetricKeys.forEach((k) => {
                    delete nextFinancial[k];
                    delete nextNumericSeries[k];
                });
            }

            parsedRows.forEach((row) => {
                nextFinancial[row.key] = row.values;
                nextNumericSeries[row.key] = {
                    label: row.label,
                    values: row.values
                };
            });

            return {
                ...prev,
                financialData: nextFinancial,
                parsedSections: {
                    ...(prev.parsedSections || {}),
                    _numericSeries: nextNumericSeries
                }
            };
        });
    };

    const updateActiveSection = (patch) => {
        if (!activeSection || showMetricsPreview) return;
        setSections((prev) => prev.map((s) => (s.id === activeSection.id ? { ...s, ...patch } : s)));
    };

    const addSection = () => {
        const id = `custom-${Date.now()}`;
        const next = { id, heading: `Custom Section ${sections.length + 1}`, content: '', kind: 'custom' };
        setSections((prev) => [...prev, next]);
        setActiveSectionId(id);
    };

    const deleteActiveSection = () => {
        if (!activeSection || showMetricsPreview) return;
        const nextSections = sections.filter((s) => s.id !== activeSection.id);
        setSections(nextSections);
        setActiveSectionId(nextSections[0]?.id || '');
    };

    const handleEditCase = async (caseId) => {
        try {
            setSaveError('');
            const res = await axios.get(`${API_BASE}/admin/case-studies/${caseId}/detail`);
            if (res.data?.success && res.data?.detail) {
                const draft = normalizeCaseDetail(res.data.detail);
                if (!draft) {
                    throw new Error('Invalid case study detail response.');
                }
                const llmSectionCount = Array.isArray(draft.parsedSections?._sections)
                        ? draft.parsedSections._sections.length
                        : Object.keys(draft.parsedSections).filter((k) => !String(k).startsWith('_')).length;
                setPdfDraftMeta({
                    fileName: 'Editing Existing Case Study',
                    pages: '?',
                    sectionsDiscovered: llmSectionCount,
                    numericSeriesFound: Object.keys(draft.financialData).length
                });
                setPdfDraft(draft);
                setCaseTitle(draft.title || '');
                setCaseIndustry(draft.industry || '');
                setThresholdPassingScore(draft.thresholdPassingScore || 0.6);
                setEditingCaseId(draft.id || caseId);

                const draftSections = buildSectionsFromDraft(draft);
                setSections(draftSections);
                setActiveSectionId(draftSections[0]?.id || 'overview');

                const savedMode = String(draft?.parsedSections?._caseMode || 'chat_only').toLowerCase();
                const normalizedMode = savedMode === 'mock_drill_chat' ? 'mock_drill_chat' : 'chat_only';
                setAssessmentMode(normalizedMode);
                const savedLevers = Array.isArray(draft?.parsedSections?._mockDrill?.levers) ? draft.parsedSections._mockDrill.levers : [];
                setSimulationConfigText(serializeSimulationConfig(savedLevers));
            }
        } catch (err) {
            setSaveError(err.response?.data?.error || err.message || 'Failed to fetch case study details.');
        }
    };

    const handleDeleteCase = async (caseId) => {
        if (!window.confirm("Are you sure you want to delete this case study?")) return;
        try {
            await axios.delete(`${API_BASE}/case-studies/${caseId}`);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
            await fetchCaseStudies();
        } catch (e) {
            setSaveError('Failed to delete case study.');
        }
    };

    const handleCreateCaseStudy = async () => {
        if (!pdfDraft) return;
        setSavingCase(true);
        setSaveError('');
        setSaveSuccess(false);

        try {
            const passing = Number(thresholdPassingScore);
            if (!Number.isFinite(passing) || passing < 0 || passing > 1) {
                throw new Error('Passing threshold must be between 0.0 and 1.0');
            }

            const normalizedSections = sections
                .map((s) => ({
                    ...s,
                    heading: String(s.heading || '').trim(),
                    content: String(s.content || '').trim()
                }))
                .filter((s) => s.heading || s.content);

            // Match by LLM role (new) or heading pattern (heuristic fallback)
            const pickByRole = (llmRole, heuristicRole, fallbackPattern) => (
                normalizedSections.find((s) => s.role === llmRole)
                || normalizedSections.find((s) => s.role === heuristicRole)
                || normalizedSections.find((s) => fallbackPattern.test(String(s.heading || '').toLowerCase()))
                || null
            );

            const overviewSection = pickByRole('context', 'context', /overview|context|background/);
            const problemSection  = pickByRole('problem',  'problem',  /problem|question|challenge|objective/);
            const openingSection  = pickByRole('prompt',   'prompt',   /opening|prompt|start|intro/);

            const overviewText = String(overviewSection?.content || '').trim();
            const problemText  = String(problemSection?.content  || '').trim();
            const openingText  = String(openingSection?.content  || '').trim();

            // Build cleansed _sections array from the current editor state
            // (preserves any edits the admin made to headings/content)
            const editedSections = normalizedSections
                .filter((s) => s.content.length > 0)
                .map((s) => ({
                    heading: s.heading,
                    content: s.content,
                    role: s.role || 'other'
                }));

            // Build parsedSections — store _sections for future decode,
            // plus individual string keys for other sections
            const canonicalSectionIds = new Set([
                overviewSection?.id,
                problemSection?.id,
                openingSection?.id
            ].filter(Boolean));

            const parsedSections = {};
            normalizedSections
                .filter((s) => !canonicalSectionIds.has(s.id))
                .forEach((s, idx) => {
                    const key = toSectionKey(s.heading) || `section_${idx + 1}`;
                    parsedSections[key] = String(s.content || '').trim();
                });

            // Resolve questions: prefer LLM-extracted, then derive from problem text
            const existingLlmQuestions = Array.isArray(pdfDraft?.parsedSections?._problemQuestions)
                ? pdfDraft.parsedSections._problemQuestions.filter((q) => String(q || '').trim().length > 8)
                : [];
            parsedSections._problemQuestions = existingLlmQuestions.length > 0
                ? existingLlmQuestions
                : extractProblemQuestions(problemText || normalizedSections.map((s) => s.content).join('\n'));

            // Store role-tagged sections array for downstream decode
            parsedSections._sections = editedSections;
            parsedSections._numericSeries = (pdfDraft.parsedSections && typeof pdfDraft.parsedSections._numericSeries === 'object')
                ? pdfDraft.parsedSections._numericSeries
                : {};
            parsedSections._caseMode = assessmentMode;
            parsedSections._mockDrill = {
                enabled: assessmentMode === 'mock_drill_chat',
                levers: parseSimulationConfigText(simulationConfigText, metricRows)
            };

            const payload = {
                title: caseTitle,
                industry: caseIndustry,
                context: overviewText || normalizedSections[0]?.content || '',
                problemStatement: problemText || parsedSections._problemQuestions.map((q, i) => `${i + 1}) ${q}`).join('\n'),
                initialPrompt: openingText || pdfDraft?.initialPrompt || 'Please begin with your diagnosis of the core business problem using the available case data.',
                thresholdPassingScore: passing,
                financialData: pdfDraft.financialData || {},
                rawContent: pdfDraft.rawContent || null,
                parsedSections
            };

            let res;
            if (editingCaseId) {
                res = await axios.put(`${API_BASE}/case-studies/${editingCaseId}`, payload);
            } else {
                res = await axios.post(`${API_BASE}/case-studies`, payload);
            }

            if (res.data?.success) {
                setSaveSuccess(true);
                setShowPreviewDialog(false);
                setPdfDraft(null);
                setPdfDraftMeta(null);
                setEditingCaseId(null);
                setSections([]);
                setActiveSectionId('overview');
                setCaseTitle('');
                setCaseIndustry('');
                setThresholdPassingScore(0.6);
                setAssessmentMode('chat_only');
                setSimulationConfigText('');
                await fetchCaseStudies();
            }
        } catch (err) {
            setSaveError(err.response?.data?.error || err.message || 'Failed to create case study.');
        } finally {
            setSavingCase(false);
        }
    };

    if (pdfDraft) {
        return (
            <div className="assessment-portal metric-priority-layout admin-preview-layout" style={{ '--left-width': '300px', '--right-width': '0px', gridTemplateColumns: 'var(--left-width) 4px minmax(0, 1fr)' }}>
                <aside className="assessment-sidebar assessment-sidebar--sections">
                    <div className="sidebar-case-header">
                        <div className="case-header-top">
                            <span className="case-tag-pill">CASE PREVIEW</span>
                            <span className="difficulty-pill difficulty-pill--medium">Admin Mode</span>
                        </div>
                        <h2 className="case-title">Draft Outline</h2>
                        <p className="case-industry">Review and finalize content</p>
                    </div>

                    <div className="sidebar-card">
                        <div className="sidebar-card__header">
                            <h3 className="sidebar-card__title">Section Navigator</h3>
                        </div>
                        <div className="sidebar-card__body sidebar-section-nav">
                            {sections.map((s) => (
                                <button
                                    key={s.id}
                                    type="button"
                                    className={`sidebar-section-btn ${activeSection?.id === s.id ? 'active' : ''}`}
                                    onClick={() => setActiveSectionId(s.id)}
                                >
                                    <span style={{ flex: 1, textAlign: 'left' }}>{s.heading || 'Untitled Section'}</span>
                                    {s.role && s.role !== 'other' && (
                                        <span className={`role-pill role-pill--${s.role}`}>{s.role}</span>
                                    )}
                                </button>
                            ))}
                            <button
                                type="button"
                                className={`sidebar-section-btn ${activeSectionId === METRICS_SECTION_ID ? 'active' : ''}`}
                                onClick={() => setActiveSectionId(METRICS_SECTION_ID)}
                            >
                                Data & Metrics
                            </button>
                            <button type="button" className="sidebar-section-btn sidebar-section-btn--add" onClick={addSection}>+ Add Section</button>
                        </div>
                    </div>

                    <div className="sidebar-card">
                        <div className="sidebar-card__header">
                            <h3 className="sidebar-card__title">Detected Questions</h3>
                        </div>
                        <div className="sidebar-card__body" style={{ padding: '10px 12px' }}>
                            {questionList.length > 0 ? (
                                <ol style={{ margin: 0, paddingLeft: '18px' }}>
                                    {questionList.map((q, idx) => (
                                        <li
                                            key={idx}
                                            style={{ fontSize: '0.72rem', marginBottom: '10px', color: 'var(--text-secondary)', lineHeight: '1.5' }}
                                        >
                                            {q}
                                        </li>
                                    ))}
                                </ol>
                            ) : (
                                <div style={{
                                    fontSize: '0.72rem',
                                    color: 'var(--accent-warning, #f5a623)',
                                    lineHeight: '1.5',
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '6px'
                                }}>
                                    <span>⚠️</span>
                                    <span>No explicit questions detected. Check that the PDF has a clear Problem Statement or numbered questions section.</span>
                                </div>
                            )}
                        </div>
                    </div>
                </aside>

                <div className="resize-handle" title="Preview sidebar" />

                <main className="metrics-workspace" style={{ padding: '24px 40px' }}>
                    <header className="workspace-header" style={{ alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <input
                                    className="workspace-title admin-input"
                                    value={caseTitle}
                                    onChange={(e) => setCaseTitle(e.target.value)}
                                    placeholder="Case Title"
                                    style={{ margin: 0, padding: '4px 8px', width: '400px', background: 'transparent' }}
                                />
                                <div className="score-chip" style={{ margin: 0, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div className="score-chip__label" style={{ marginBottom: 0 }}>THRESHOLD</div>
                                    <input
                                        type="number"
                                        min="0"
                                        max="1"
                                        step="0.05"
                                        value={thresholdPassingScore}
                                        onChange={(e) => setThresholdPassingScore(e.target.value)}
                                        style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', width: '40px', fontWeight: 900, outline: 'none' }}
                                    />
                                </div>
                            </div>
                            <input
                                className="workspace-subtitle admin-input"
                                value={caseIndustry}
                                onChange={(e) => setCaseIndustry(e.target.value)}
                                placeholder="Industry"
                                style={{ margin: 0, padding: '4px 8px', width: '300px', background: 'transparent' }}
                            />
                            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                                <button
                                    type="button"
                                    className={`metric-tab ${assessmentMode === 'chat_only' ? 'active' : ''}`}
                                    onClick={() => setAssessmentMode('chat_only')}
                                >
                                    Standard Chat
                                </button>
                                <button
                                    type="button"
                                    className={`metric-tab ${assessmentMode === 'mock_drill_chat' ? 'active' : ''}`}
                                    onClick={() => setAssessmentMode('mock_drill_chat')}
                                >
                                    Mock Drill + Chat
                                </button>
                            </div>
                        </div>
                        <div className="workspace-actions">
                            <button className="theme-toggle" onClick={toggleTheme}>
                                {theme === 'light' ? 'DARK' : 'LIGHT'}
                            </button>
                            <button className="admin-btn secondary" onClick={() => { setPdfDraft(null); setPdfDraftMeta(null); setEditingCaseId(null); }}>
                                Cancel
                            </button>
                            <button className="btn-exit" onClick={() => setShowPreviewDialog(true)} disabled={savingCase} style={{ background: 'var(--accent-primary)', color: '#fff', border: 'none' }}>
                                {savingCase ? (editingCaseId ? 'Updating...' : 'Creating...') : (editingCaseId ? 'Update case study' : 'Create case study')}
                            </button>
                        </div>
                    </header>

                    {showMetricsPreview && (
                        <section className="case-content-pane" style={{ marginTop: '20px' }}>
                            {assessmentMode === 'mock_drill_chat' && (
                                <article className="main-section-card" style={{ marginBottom: '12px' }}>
                                    <h3 style={{ marginBottom: '8px' }}>Mock Drill Config</h3>
                                    <p className="hint-line" style={{ marginTop: 0, marginBottom: '8px' }}>
                                        Define simulation levers as: group|label|metric_key|min|max|step|default
                                    </p>
                                    <textarea
                                        style={{ width: '100%', minHeight: '130px', fontSize: '0.8rem', lineHeight: '1.5', background: 'var(--bg-subtle)', border: '1px dashed var(--border-default)', color: 'var(--text-primary)', padding: '12px', resize: 'vertical' }}
                                        value={simulationConfigText}
                                        onChange={(e) => setSimulationConfigText(e.target.value)}
                                        placeholder={'Financial|Price Increase|total_revenue|-20|20|5|0\nOperations|Lead Time Compression|average_lead_time|-30|10|5|0'}
                                    />
                                </article>
                            )}

                            {editedMetricRows.length > 0 ? (
                                <>
                                    <article className="main-section-card" style={{ marginBottom: '12px' }}>
                                        <h3 style={{ marginBottom: '8px' }}>Metrics Editor</h3>
                                        <p className="hint-line" style={{ marginTop: 0, marginBottom: '8px' }}>
                                            Edit metrics as: metric_key: value1, value2, value3. Visualizations update instantly.
                                        </p>
                                        <textarea
                                            style={{ width: '100%', minHeight: '180px', fontSize: '0.82rem', lineHeight: '1.55', background: 'var(--bg-subtle)', border: '1px dashed var(--border-default)', color: 'var(--text-primary)', padding: '12px', resize: 'vertical' }}
                                            value={metricsEditorText}
                                            onChange={(e) => handleMetricsEditorChange(e.target.value)}
                                            placeholder="revenue_cr: 1.2, 1.3, 1.4\nnet_profit_l: 12, 10, 8"
                                        />
                                    </article>

                                    <section className="kpi-rail" aria-label="Case metric KPI rail">
                                        {editedMetricKpis.map((metric) => (
                                            <article key={metric.key} className={`kpi-tile ${metric.isImproving ? 'up' : 'down'}`}>
                                                <p className="kpi-tile__name">{metric.label}</p>
                                                <p className="kpi-tile__value">{formatMetricValue(metric.current, metric.unit)}</p>
                                                <p className={`kpi-tile__delta ${metric.delta >= 0 ? 'positive' : 'negative'}`}>
                                                    {metric.delta >= 0 ? '+' : ''}{metric.delta.toFixed(2)} ({metric.deltaPct >= 0 ? '+' : ''}{metric.deltaPct.toFixed(1)}%)
                                                </p>
                                            </article>
                                        ))}
                                    </section>

                                    <section className="metrics-deep-dive" style={{ marginTop: '12px' }}>
                                        <div className="table-card">
                                            <div className="table-card__header">
                                                <h3>Monthly Metrics Breakdown</h3>
                                                <p>Admin preview of all detected case data points with units and trend.</p>
                                            </div>
                                            <div className="metrics-table-wrap">
                                                <table className="metrics-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Parameter</th>
                                                            <th>Unit</th>
                                                            {editedTimelineLabels.map((label) => <th key={label}>{label}</th>)}
                                                            <th>Trend</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {editedMetricRows.map((row) => (
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
                                                <p>Quarterly average view to validate directional case trajectory.</p>
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
                                                        {editedMetricRows.map((row) => (
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

                                    <section className="trend-strip" style={{ marginTop: '12px' }}>
                                        {editedMetricRows.slice(0, 6).map((row) => (
                                            <MetricLineChart
                                                key={row.key}
                                                label={row.label}
                                                values={row.values}
                                                xLabels={editedTimelineLabels}
                                                unit={row.unit}
                                            />
                                        ))}
                                    </section>
                                </>
                            ) : (
                                <article className="main-section-card">
                                    <h3>No Metrics Found</h3>
                                    <p>No numeric metric series were detected in this case study.</p>
                                </article>
                            )}
                        </section>
                    )}

                    {!showMetricsPreview && activeSection && (
                        <section className="case-content-pane" style={{ marginTop: '20px' }}>
                            <article className="main-section-card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' }}>
                                    <input
                                        style={{ fontSize: '1.15rem', fontWeight: 900, textTransform: 'uppercase', background: 'transparent', border: '1px dashed var(--border-default)', color: 'var(--text-primary)', padding: '4px 8px', width: '100%' }}
                                        value={activeSection.heading}
                                        onChange={(e) => updateActiveSection({ heading: e.target.value })}
                                        placeholder="Section heading"
                                    />
                                    <button className="admin-btn secondary" onClick={deleteActiveSection} style={{ marginLeft: '12px', whiteSpace: 'nowrap', padding: '6px 12px' }}>
                                        Delete Section
                                    </button>
                                </div>
                                <textarea
                                    style={{ width: '100%', minHeight: '600px', fontSize: '0.85rem', lineHeight: '1.6', background: 'var(--bg-subtle)', border: '1px dashed var(--border-default)', color: 'var(--text-primary)', padding: '16px', resize: 'vertical' }}
                                    value={activeSection.content}
                                    onChange={(e) => updateActiveSection({ content: e.target.value })}
                                    placeholder="Section content"
                                />
                            </article>
                        </section>
                    )}

                    {!showMetricsPreview && !activeSection && (
                        <section className="case-content-pane" style={{ marginTop: '20px' }}>
                            <article className="main-section-card">
                                <h3>No Sections Left</h3>
                                <p>Add a new section from the sidebar to continue editing this case study.</p>
                            </article>
                        </section>
                    )}
                </main>
                {showPreviewDialog && (
                    <div className="assessment-loading-state" style={{ background: 'rgba(0,0,0,0.7)', zIndex: 9999 }}>
                        <div className="admin-card" style={{ maxWidth: '600px', width: '90%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden', padding: '20px' }}>
                            <div className="admin-card-title" style={{ margin: 0, borderBottom: 'none', paddingBottom: '0' }}>
                                Confirm Case Study Details
                            </div>
                            <p className="admin-hint" style={{ margin: 0, borderBottom: '1px solid var(--border-default)', paddingBottom: '16px' }}>
                                Review the properties below before saving.
                            </p>
                            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, paddingRight: '4px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '12px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <div className="admin-label">Title</div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{caseTitle || 'Untitled Case'}</div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <div className="admin-label">Industry</div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{caseIndustry || 'Not set'}</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <div className="admin-label">Sections Included ({sections.filter(s => s.content.trim().length > 0).length})</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {sections.filter(s => s.content.trim().length > 0).map(s => (
                                            <span key={s.id} className="case-chip" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', textTransform: 'none' }}>
                                                {s.role && s.role !== 'other' && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-primary)' }}></span>}
                                                {s.heading}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <div className="admin-label">Detected Questions ({questionList.length})</div>
                                    {questionList.length > 0 ? (
                                        <ol style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: '1.5' }}>
                                            {questionList.map((q, idx) => <li key={idx}>{q}</li>)}
                                        </ol>
                                    ) : (
                                        <div style={{ color: 'var(--accent-warning)', fontSize: '0.8rem', fontStyle: 'italic' }}>⚠️ No explicit questions detected.</div>
                                    )}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <div className="admin-label">Case Mode</div>
                                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                        {assessmentMode === 'mock_drill_chat' ? 'Mock Drill + Chat (simulation required before answer)' : 'Standard Chat'}
                                    </div>
                                </div>
                            </div>
                            <div className="admin-actions" style={{ borderTop: '1px solid var(--border-default)', paddingTop: '16px', marginTop: 'auto' }}>
                                <button className="admin-btn secondary" onClick={() => setShowPreviewDialog(false)} disabled={savingCase}>
                                    Cancel
                                </button>
                                <button className="admin-btn primary" onClick={handleCreateCaseStudy} disabled={savingCase}>
                                    {savingCase ? 'Saving...' : 'Confirm and create'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="admin-eval-page">
            <div className="admin-eval-layout">
                <div className="admin-card import-zone">
                    <div className="admin-card-title">Upload Case Study PDF</div>
                    <p className="admin-hint">Upload a PDF. It opens directly in a no-chat case-attempt style preview for admin review and creation.</p>
                    <div className="import-row">
                        <label className={`file-drop-label ${importingPdf ? 'loading' : ''}`}>
                            <input
                                type="file"
                                accept="application/pdf"
                                onChange={handleImportPdf}
                                className="hidden-file-input"
                                disabled={importingPdf}
                            />
                            <span className="file-drop-icon">[PDF]</span>
                            <span className="file-drop-text">{importingPdf ? 'Parsing PDF...' : 'Click to upload PDF'}</span>
                        </label>
                        {pdfDraftMeta && (
                            <div className="import-meta-strip">
                                <span className="meta-chip">{pdfDraftMeta.fileName}</span>
                                <span className="meta-chip">{pdfDraftMeta.pages || '?'} pages</span>
                                <span className="meta-chip">{pdfDraftMeta.sectionsDiscovered || 0} sections</span>
                                <span className="meta-chip">{pdfDraftMeta.numericSeriesFound || 0} data series</span>
                                {pdfDraftMeta.llmExtracted !== undefined && (
                                    <span className={`meta-chip ${pdfDraftMeta.llmExtracted ? 'success' : 'warning'}`} style={{
                                        borderColor: pdfDraftMeta.llmExtracted ? '#3fb950' : '#f5a623',
                                        color: pdfDraftMeta.llmExtracted ? '#3fb950' : '#f5a623'
                                    }}>
                                        {pdfDraftMeta.llmExtracted ? 'LLM Parsed' : 'Heuristic Fallback'}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {saveSuccess && <div className="save-banner save-banner--success">Case study created successfully.</div>}
                {saveError && <div className="save-banner save-banner--error">{saveError}</div>}

                <div className="admin-card">
                    <div className="admin-card-title">Created Case Studies ({caseStudies.length})</div>
                    {caseStudies.length === 0 ? (
                        <p className="admin-hint">No case studies created yet.</p>
                    ) : (
                        <div className="cases-list">
                            {caseStudies.map((row) => (
                                <div key={row.id} className="case-list-row">
                                    <div className="case-list-main">
                                        <div className="case-list-title">{row.title}</div>
                                        <div className="case-list-meta">
                                            {row.industry && <span className="case-chip">{row.industry}</span>}
                                            <span className={`case-chip status-chip ${row.is_active ? 'active' : 'inactive'}`}>
                                                {row.is_active ? 'ACTIVE' : 'INACTIVE'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="case-row-actions">
                                        <button className="icon-action-btn" onClick={() => handleEditCase(row.id)} title="Edit Case">✏️</button>
                                        <button className="icon-action-btn" onClick={() => handleDeleteCase(row.id)} title="Delete Case" style={{ color: '#ff4d4f' }}>🗑️</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminEvaluation;
