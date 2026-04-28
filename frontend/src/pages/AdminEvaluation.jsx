import React, { useEffect, useMemo, useState, useRef } from 'react';
import axios from 'axios';
import './AdminEvaluation.css';
import './Assessment.css';
import { API_BASE } from '../config/api';
import PageLoader from '../components/PageLoader';
import MetricChart from '../components/MetricLineChart';
import CaseStudyDrawer from '../components/CaseStudyDrawer';
import SidebarCard from '../components/SidebarCard';

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const METRICS_SECTION_ID = '__metrics_preview__';

const toSectionKey = (raw = '') => String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const prettifyLabel = (raw = '') => {
    let s = String(raw || '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    s = s.replace(/^(\d+[\.\s_:-]+|section\s+\d+[\.\s_:-]+)/i, '');
    return s.trim();
};

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

const extractInlineSeries = (text = '') => {
    const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
    const groups = [];
    let currentGroup = null;
    let pendingLabel = '';

    for (const line of lines) {
        const stripped = line.replace(/^[•\-\*●]\s*/, '').trim();
        const kvMatch = stripped.match(/^([^:]{1,60}):\s*([-+]?\d[\d,.]*(?:\.\d+)?)\s*([A-Za-z%/]*)\s*(?:.*)?$/);
        if (kvMatch) {
            const pointLabel = kvMatch[1].trim();
            let value = parseFloat(kvMatch[2].replace(/,/g, ''));
            const unitSuffix = (kvMatch[3] || '').toLowerCase();

            if (Number.isFinite(value)) {
                if (unitSuffix === 'cr') value *= 100;
                else if (unitSuffix === 'm') value *= 10;
                else if (unitSuffix === 'k') value /= 100;

                if (!currentGroup) {
                    currentGroup = { groupLabel: pendingLabel || 'Series', points: [], unit: unitSuffix || 'count' };
                    groups.push(currentGroup);
                }
                currentGroup.points.push({ label: pointLabel, value, rawValue: parseFloat(kvMatch[2].replace(/,/g, '')), unit: unitSuffix });
                continue;
            }
        }

        if (currentGroup) {
            if (currentGroup.points.length < 2) groups.pop();
            currentGroup = null;
        }
        if (stripped.length > 0 && stripped.length < 60 && !stripped.includes('.') && stripped.endsWith(':')) {
            pendingLabel = stripped.slice(0, -1).trim();
        } else if (stripped.length > 0 && stripped.length < 60 && !stripped.includes('•')) {
            pendingLabel = stripped;
        }
    }

    if (currentGroup && currentGroup.points.length < 2) groups.pop();
    return groups.filter((g) => g.points.length >= 2);
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

// MetricLineChart removed (imported from components)

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

const AdminEvaluation = () => {
    const [importingPdf, setImportingPdf] = useState(false);
    const [uploadingFileName, setUploadingFileName] = useState('');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [savingCase, setSavingCase] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [pdfDraftMeta, setPdfDraftMeta] = useState(null);
    const [pdfDraft, setPdfDraft] = useState(null);
    const [caseStudies, setCaseStudies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [caseTitle, setCaseTitle] = useState('');
    const [caseIndustry, setCaseIndustry] = useState('');
    const [thresholdPassingScore, setThresholdPassingScore] = useState(0.6);
    const [showPreviewDialog, setShowPreviewDialog] = useState(false);
    const [theme, setTheme] = useState(document.documentElement.getAttribute('data-theme') || 'light');
    const [sidebarWidth, setSidebarWidth] = useState(() => window.innerWidth <= 1280 ? 280 : 320);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    useEffect(() => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            setTheme(savedTheme);
            document.documentElement.setAttribute('data-theme', savedTheme);
        }
    }, []);

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
    const [selectedCaseDetail, setSelectedCaseDetail] = useState(null);
    const [loadingCaseDetail, setLoadingCaseDetail] = useState(false);

    const fetchCaseStudies = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/admin/case-studies`);
            setCaseStudies(Array.isArray(res.data?.caseStudies) ? res.data.caseStudies : []);
        } catch {
            setCaseStudies([]);
        } finally {
            setLoading(false);
        }
    };

    const fileInputRef = useRef(null);

    useEffect(() => {
        const handleAction = (e) => {
            const { type } = e.detail;
            if (type === 'create') handleCreateManualCase();
            if (type === 'upload') fileInputRef.current?.click();
        };
        window.addEventListener('case-study-action', handleAction);
        return () => window.removeEventListener('case-study-action', handleAction);
    }, []);

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
        setUploadingFileName(file.name);
        setUploadProgress(10); // Start at 10%
        setSaveError('');
        setSaveSuccess(false);

        // Progress simulation for better UX during network upload
        const progressInterval = setInterval(() => {
            setUploadProgress(prev => {
                if (prev >= 90) return prev;
                return prev + Math.random() * 10;
            });
        }, 800);

        try {
            const formData = new FormData();
            formData.append('pdf', file);
            const res = await axios.post(`${API_BASE}/case-studies/import-pdf`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    // Combine with manual progress but don't let it go backwards
                    setUploadProgress(prev => Math.max(prev, percentCompleted));
                }
            });

            if (res.data?.success && res.data?.draft) {
                setUploadProgress(100);
                clearInterval(progressInterval);
                // Short delay to show 100% before switching
                setTimeout(() => {
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

                    setImportingPdf(false);
                    setUploadingFileName('');
                    setUploadProgress(0);
                }, 500);
            }
        } catch (err) {
            clearInterval(progressInterval);
            setSaveError(err.response?.data?.error || 'Failed to import PDF.');
            setImportingPdf(false);
            setUploadingFileName('');
            setUploadProgress(0);
        } finally {
            e.target.value = '';
        }
    };

    const handleCreateManualCase = () => {
        setSaveError('');
        setSaveSuccess(false);
        setEditingCaseId(null);

        const manualDraft = {
            id: null,
            title: '',
            industry: '',
            context: '',
            problemStatement: '',
            initialPrompt: '',
            thresholdPassingScore: 0.6,
            financialData: {},
            rawContent: '',
            parsedSections: {
                _sections: [
                    { heading: 'Overview', content: '', role: 'context' }
                ],
                _problemQuestions: [],
                _numericSeries: {},
                _caseMode: 'chat_only',
                _mockDrill: {
                    enabled: false,
                    levers: []
                }
            }
        };

        setPdfDraft(manualDraft);
        setPdfDraftMeta({
            fileName: 'Manual Case Draft',
            pages: '-',
            sectionsDiscovered: 1,
            numericSeriesFound: 0,
            llmExtracted: false
        });
        setCaseTitle('');
        setCaseIndustry('');
        setThresholdPassingScore(0.6);

        const draftSections = buildSectionsFromDraft(manualDraft);
        setSections(draftSections);
        setActiveSectionId(draftSections[0]?.id || 'overview');
        setAssessmentMode('chat_only');
        setSimulationConfigText('');
    };

    const activeSection = useMemo(
        () => sections.find((s) => s.id === activeSectionId) || null,
        [sections, activeSectionId]
    );

    const startSidebarResize = (event) => {
        event.preventDefault();
        const startX = event.clientX;
        const startWidth = sidebarWidth;
        const doDrag = (moveEvent) => setSidebarWidth(Math.max(220, Math.min(560, startWidth + moveEvent.clientX - startX)));
        const stopDrag = () => {
            document.removeEventListener('mousemove', doDrag);
            document.removeEventListener('mouseup', stopDrag);
        };

        document.addEventListener('mousemove', doDrag);
        document.addEventListener('mouseup', stopDrag);
    };

    const questionList = useMemo(() => {
        // Read directly from the content of problem/questions sections that are
        // being displayed — ensures sidebar always reflects what the user sees.
        const problemSections = sections.filter((s) =>
            s.role === 'problem' ||
            /question|problem|statement|challenge|task|objective|deliverable/i.test(String(s.heading || ''))
        );

        const found = [];
        for (const sec of problemSections) {
            const lines = String(sec.content || '').split('\n').map((l) => l.trim()).filter(Boolean);
            for (const line of lines) {
                // Match numbered items: "1. text" or "1) text" (but NOT "1.2" decimal numbers)
                const m = line.replace(/^[•\-\*]\s*/, '').match(/^(\d+)[.)\s]\s*(.{8,})$/);
                if (m) found.push(m[2].trim());
            }
        }
        if (found.length > 0) return found;

        // Fallback: use backend-extracted questions
        const parsedQuestions = Array.isArray(pdfDraft?.parsedSections?._problemQuestions)
            ? pdfDraft.parsedSections._problemQuestions.map((q) => String(q || '').trim()).filter((q) => q.length > 8)
            : [];
        if (parsedQuestions.length > 0) return parsedQuestions;

        // Last resort: scan all section content
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

    const showMetricsPreview = useMemo(() => {
        if (activeSectionId === METRICS_SECTION_ID) return true;
        return isMetricsSection(activeSection);
    }, [activeSection, activeSectionId]);

    const activeInlineSeries = useMemo(() => {
        return extractInlineSeries(activeSection?.content || '');
    }, [activeSection?.content]); // Live updates on content change

    const activeInlineMetricRows = useMemo(() => {
        return (activeInlineSeries || []).map((series, idx) => {
            const values = (series?.points || []).map((p) => Number(p?.value)).filter(Number.isFinite);
            const keySeed = series?.groupLabel || `series_${idx + 1}`;
            const key = toSectionKey(keySeed) || `series_${idx + 1}`;
            const delta = values.length > 1 ? values[values.length - 1] - values[0] : 0;
            const improving = values.length > 1 ? values[values.length - 1] >= values[0] : true;
            return {
                key,
                label: String(series?.groupLabel || `Series ${idx + 1}`),
                unit: series.unit === 'cr' ? 'inr_cr' : series.unit === 'lakh' ? 'inr_lakh' : series.unit === 'percent' ? 'percent' : 'count',
                values,
                quarterly: aggregateQuarterly(values),
                delta,
                improving
            };
        }).filter((row) => Array.isArray(row.values) && row.values.length > 0);
    }, [activeInlineSeries]);

    const scopedMetricRows = useMemo(() => {
        if (!activeSection) return metricRows;
        // Prioritize inline series found in the current active section's content
        const inlineRows = activeInlineMetricRows;
        if (inlineRows.length > 0) return inlineRows;

        const scoped = metricRows.filter((row) => metricBelongsToSection(row, activeSection));
        return scoped.length > 0 ? scoped : metricRows;
    }, [activeSection, metricRows, activeInlineMetricRows]);

    const scopedMetricKeys = useMemo(() => new Set(scopedMetricRows.map((r) => r.key)), [scopedMetricRows]);

    useEffect(() => {
        if (metricsEditorSectionId === activeSectionId) return;
        setMetricsEditorText(buildMetricsEditorText(scopedMetricRows));
        setMetricsEditorSectionId(activeSectionId);
    }, [scopedMetricRows, activeSectionId, metricsEditorSectionId]);

    const editedMetricRows = useMemo(() => {
        // If we have live inline series, prioritize them over the metrics editor text
        // This ensures real-time updates as the user types in the Raw Content textarea.
        if (activeInlineMetricRows.length > 0) return activeInlineMetricRows;
        const parsed = parseMetricsEditorText(metricsEditorText);
        return parsed.length > 0 ? parsed : scopedMetricRows;
    }, [metricsEditorText, scopedMetricRows, activeInlineMetricRows]);

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

    const editedUnitLegend = useMemo(() => {
        const entries = Array.from(new Set(editedMetricRows.map((row) => row.unit).filter(Boolean)));
        return entries.map((unit) => ({ unit, label: unitDisplayLabel(unit) }));
    }, [editedMetricRows]);

    const drawerSections = useMemo(() => {
        if (!selectedCaseDetail) return [];
        return buildSectionsFromDraft(selectedCaseDetail);
    }, [selectedCaseDetail]);

    const drawerMetricRows = useMemo(() => {
        if (!selectedCaseDetail) return [];

        const numericFromDraft = selectedCaseDetail.financialData && typeof selectedCaseDetail.financialData === 'object'
            ? selectedCaseDetail.financialData
            : {};

        const numericFromParsed = (selectedCaseDetail.parsedSections && typeof selectedCaseDetail.parsedSections._numericSeries === 'object')
            ? Object.fromEntries(
                Object.entries(selectedCaseDetail.parsedSections._numericSeries).map(([k, v]) => {
                    const values = Array.isArray(v?.values) ? v.values : [];
                    return [k, values];
                })
            )
            : {};

        const merged = { ...numericFromParsed, ...numericFromDraft };

        return Object.entries(merged)
            .filter(([, v]) => Array.isArray(v) && v.length > 1)
            .map(([key, values]) => {
                const nums = values.map(Number).filter(Number.isFinite);
                const unit = inferMetricUnit(key, nums);
                const delta = nums.length > 1 ? nums[nums.length - 1] - nums[0] : 0;
                const improving = nums.length > 1
                    ? (getMetricDirection(key) === 'higher' ? nums[nums.length - 1] >= nums[0] : nums[nums.length - 1] <= nums[0])
                    : true;
                return {
                    key,
                    label: prettifyLabel(key).replace(/\b\w/g, (c) => c.toUpperCase()),
                    unit,
                    values: nums,
                    delta,
                    improving
                };
            });
    }, [selectedCaseDetail]);

    const drawerTimelineLabels = useMemo(() => {
        const seriesLen = Math.max(...drawerMetricRows.map((row) => row.values.length), 0);
        if (seriesLen <= 0) return [];
        if (seriesLen <= 12) return monthNames.slice(0, seriesLen);
        return Array.from({ length: seriesLen }, (_, i) => `P${i + 1}`);
    }, [drawerMetricRows]);

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

            // Wipe the keys currently in scope, then replace with edited values
            scopedMetricKeys.forEach((k) => {
                delete nextFinancial[k];
                delete nextNumericSeries[k];
            });

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
        if (!activeSection) return;
        setSections((prev) => prev.map((s) => (s.id === activeSection.id ? { ...s, ...patch } : s)));
    };

    const addSection = () => {
        const id = `custom-${Date.now()}`;
        const next = { id, heading: `Custom Section ${sections.length + 1}`, content: '', kind: 'custom' };
        setSections((prev) => [...prev, next]);
        setActiveSectionId(id);
    };

    const deleteActiveSection = () => {
        if (!activeSection) return;
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

    const handleOpenCaseDetail = async (caseId) => {
        setLoadingCaseDetail(true);
        try {
            const res = await axios.get(`${API_BASE}/admin/case-studies/${caseId}/detail`);
            if (res.data?.success && res.data?.detail) {
                const detail = normalizeCaseDetail(res.data.detail);
                setSelectedCaseDetail(detail);
            }
        } catch {
            setSelectedCaseDetail(null);
        } finally {
            setLoadingCaseDetail(false);
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
            const problemSection = pickByRole('problem', 'problem', /problem|question|challenge|objective/);
            const openingSection = pickByRole('prompt', 'prompt', /opening|prompt|start|intro/);

            const overviewText = String(overviewSection?.content || '').trim();
            const problemText = String(problemSection?.content || '').trim();
            const openingText = String(openingSection?.content || '').trim();

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

    if (loading) {
        return (
            <div className="admin-eval-page">
                <PageLoader
                    message="Syncing Case Repository"
                    subMessage="Loading the latest case study data from the cloud."
                />
            </div>
        );
    }

    if (pdfDraft) {
        return (
            <div className="assessment-portal metric-priority-layout admin-preview-layout" style={{ '--left-width': '320px', '--right-width': '0px', gridTemplateColumns: 'var(--left-width) 4px minmax(0, 1fr)' }}>
                <aside className="assessment-sidebar assessment-sidebar--sections">

                    <SidebarCard label="Section Navigator">
                        <div className="sidebar-section-nav">
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
                            <button type="button" className="sidebar-section-btn sidebar-section-btn--add" onClick={addSection}>+ Add Section</button>
                        </div>
                    </SidebarCard>

                    <SidebarCard label="Question Tracker" variant="accent">
                        <div className="question-tracker-summary">
                            <p>Detected {questionList.length} Questions</p>
                        </div>
                        <div className="question-tracker-list">
                            {questionList.length > 0 ? (
                                questionList.map((q, idx) => (
                                    <div 
                                        key={idx} 
                                        className="question-chip question-chip--not_attempted"
                                        title={q}
                                    >
                                        <span className="question-chip__index">Q{idx + 1}</span>
                                        <span className="question-chip__text">{String(q).replace(/^\d+[.):\s]+\s*/, '').trim()}</span>
                                    </div>
                                ))
                            ) : (
                                <div style={{ fontSize: '0.75rem', color: 'var(--accent-warning)', lineHeight: '1.6', display: 'flex', gap: '8px', padding: '12px' }}>
                                    <span>⚠️</span>
                                    <span>No explicit questions detected.</span>
                                </div>
                            )}
                        </div>
                        <div className="question-legend">
                            <span><i className="dot dot--grey" />Not attempted</span>
                            <span><i className="dot dot--green" />Attempted and passed</span>
                            <span><i className="dot dot--red" />Attempted and failed</span>
                            <span><i className="dot dot--yellow" />Flagged for later</span>
                        </div>
                    </SidebarCard>
                </aside>

                <div className="resize-handle" title="Preview sidebar" />

                <main className="metrics-workspace" style={{ padding: '8px 12px' }}>
                    <header className="workspace-header" style={{ marginBottom: '8px' }}>
                        <div style={{ flex: 1 }}>
                            <input
                                className="admin-title-input"
                                value={caseTitle}
                                onChange={(e) => setCaseTitle(e.target.value)}
                                placeholder="Enter Case Title..."
                            />
                            <input
                                className="admin-industry-input"
                                value={caseIndustry}
                                onChange={(e) => setCaseIndustry(e.target.value)}
                                placeholder="Industry (e.g. Finance, E-commerce)"
                            />
                        </div>

                        <div className="admin-threshold-box">
                            <span className="threshold-label">Passing Score</span>
                            <div className="threshold-input-wrap">
                                <input
                                    type="number"
                                    className="admin-threshold-input"
                                    min="0" max="1" step="0.05"
                                    value={thresholdPassingScore}
                                    onChange={(e) => setThresholdPassingScore(e.target.value)}
                                />
                            </div>
                        </div>

                        <button
                            className="theme-toggle-pill"
                            onClick={toggleTheme}
                            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
                            style={{ marginRight: '12px' }}
                        >
                            {theme === 'light' ? (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                            ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                            )}
                        </button>

                        <div className="preview-actions">
                            <button className="pill-btn secondary" onClick={() => { setPdfDraft(null); setPdfDraftMeta(null); setEditingCaseId(null); }}>
                                Cancel
                            </button>
                            <button className="pill-btn primary" onClick={() => setShowPreviewDialog(true)} disabled={savingCase}>
                                {savingCase ? (editingCaseId ? 'Updating...' : 'Creating...') : (editingCaseId ? 'Update Case Study' : 'Create Case Study')}
                            </button>
                        </div>
                    </header>

                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', paddingLeft: '4px' }}>
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

                    {/* ── Section text editor — always shown for any selected section ── */}
                    {activeSection && (
                        <section className="case-content-pane" style={{ marginTop: '4px' }}>
                            <article className="main-section-card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' }}>
                                    <input
                                        style={{ fontSize: '1.25rem', fontWeight: 900, textTransform: 'uppercase', background: 'transparent', border: '1px dashed var(--border-default)', color: 'var(--text-primary)', padding: '6px 10px', width: '100%', letterSpacing: '0.02em' }}
                                        value={activeSection.heading}
                                        onChange={(e) => updateActiveSection({ heading: e.target.value })}
                                        placeholder="Section heading"
                                    />
                                    <button className="admin-btn secondary" onClick={deleteActiveSection} style={{ marginLeft: '12px', whiteSpace: 'nowrap', padding: '6px 12px' }}>
                                        Delete Section
                                    </button>
                                </div>

                                {/* Dual-pane editor and live preview */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)', gap: '20px', alignItems: 'start' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span>Raw Content</span>
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                <button
                                                    className="admin-btn secondary"
                                                    style={{ padding: '2px 8px', fontSize: '0.65rem', height: '20px' }}
                                                    onClick={() => {
                                                        const beautifyContent = (text) => {
                                                            if (!text) return '';
                                                            const lines = text.split('\n');
                                                            const result = [];
                                                            for (let i = 0; i < lines.length; i++) {
                                                                const line = lines[i].trimEnd();
                                                                if (!line.trim()) {
                                                                    if (result.length > 0 && result[result.length - 1] !== '') result.push('');
                                                                    continue;
                                                                }
                                                                const isHeading = /:\s*$/.test(line) && line.length < 80 && !/^[-*•]/.test(line);
                                                                if (isHeading && i > 0 && result.length > 0 && result[result.length - 1] !== '') {
                                                                    result.push('');
                                                                }
                                                                result.push(line);
                                                            }
                                                            return result.join('\n');
                                                        };
                                                        updateActiveSection({ content: beautifyContent(activeSection.content) });
                                                    }}
                                                >
                                                    Auto-Format Spacing
                                                </button>
                                                <span style={{ color: 'var(--accent-primary)', opacity: 0.8 }}>Editable</span>
                                            </div>
                                        </div>
                                        <textarea
                                            className="section-editor-textarea"
                                            value={String(activeSection.content || '').replace(/●/g, '•')}
                                            onChange={(e) => {
                                                e.target.style.height = 'auto';
                                                e.target.style.height = Math.max(200, e.target.scrollHeight) + 'px';
                                                updateActiveSection({ content: e.target.value.replace(/●/g, '•') });
                                            }}
                                            onBlur={(e) => {
                                                const text = e.target.value;
                                                const lines = text.split('\n');
                                                const result = [];
                                                let changed = false;
                                                for (let i = 0; i < lines.length; i++) {
                                                    const line = lines[i].trimEnd();
                                                    if (!line.trim()) {
                                                        if (result.length > 0 && result[result.length - 1] !== '') result.push('');
                                                        else changed = true;
                                                        continue;
                                                    }
                                                    const isHeading = /:\s*$/.test(line) && line.length < 80 && !/^[-*•]/.test(line);
                                                    if (isHeading && i > 0 && result.length > 0 && result[result.length - 1] !== '') {
                                                        result.push('');
                                                        changed = true;
                                                    }
                                                    result.push(line);
                                                }
                                                if (changed) updateActiveSection({ content: result.join('\n') });
                                            }}
                                            onFocus={(e) => {
                                                e.target.style.height = 'auto';
                                                e.target.style.height = Math.max(200, e.target.scrollHeight) + 'px';
                                            }}
                                            ref={(el) => {
                                                if (el) {
                                                    el.style.height = 'auto';
                                                    el.style.height = Math.max(200, el.scrollHeight) + 'px';
                                                }
                                            }}
                                            placeholder="Section content..."
                                            style={{ minHeight: '200px', backgroundColor: 'var(--surface-sunken)', border: '1px solid var(--border-default)', padding: '16px', borderRadius: '8px', overflow: 'hidden', lineHeight: '1.6', fontSize: '1.05rem', fontWeight: 500 }}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em', display: 'flex', justifyContent: 'space-between' }}>
                                            <span>Live Preview</span>
                                            <span style={{ color: 'var(--accent-success)', opacity: 0.8 }}>Candidate View</span>
                                        </div>
                                        <div className="drawer-content-card" style={{ margin: 0, height: '100%' }}>
                                            <div className="drawer-content-title" style={{ padding: '12px 16px', marginBottom: 0 }}>
                                                <span className="title-icon">
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                                </span>
                                                <span>{activeSection.heading || 'Untitled Section'}</span>
                                            </div>
                                            {(() => {
                                                const { summary, entries } = splitSectionContent(activeSection.content);
                                                const headingColors = ['#8957e5', '#238636', '#d29922', '#bf3989', '#1f6feb'];
                                                let headingCount = 0;
                                                return (
                                                    <div className="drawer-card-body" style={{ padding: '16px', paddingTop: '12px' }}>
                                                        {summary && <div className="drawer-card-summary">{summary}</div>}
                                                        {entries.length > 0 && (
                                                            <div className="drawer-bullet-list" style={{ gap: '6px' }}>
                                                                {entries.map((entry, index) => {
                                                                    if (entry.type === 'heading') {
                                                                        const color = headingColors[headingCount % headingColors.length];
                                                                        headingCount++;
                                                                        return (
                                                                            <div key={index} className="drawer-inline-heading" style={{ marginTop: index === 0 && !summary ? '0' : '32px', marginBottom: '4px', borderLeftColor: color }}>{entry.text}</div>
                                                                        );
                                                                    } else if (entry.type === 'bullet') {
                                                                        return (
                                                                            <div key={index} className="drawer-bullet-row">
                                                                                {!/^\d+[.)]/.test(entry.text) && <span className="bullet-dot"></span>}
                                                                                <span className="bullet-text" style={{ marginLeft: /^\d+[.)]/.test(entry.text) ? '0' : 'inherit' }}>{entry.text}</span>
                                                                            </div>
                                                                        );
                                                                    } else {
                                                                        return (
                                                                            <div key={index} style={{ marginBottom: '4px', fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: '1.6' }}>{entry.text}</div>
                                                                        );
                                                                    }
                                                                })}
                                                            </div>
                                                        )}
                                                        {!summary && entries.length === 0 && <div className="drawer-card-summary" style={{ opacity: 0.5, fontStyle: 'italic' }}>No content available.</div>}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            </article>

                            {/* ── Inline charts from section content — no backend dependency ── */}
                            {(() => {
                                const inlineSeries = extractInlineSeries(activeSection.content || '');
                                if (inlineSeries.length === 0 || showMetricsPreview) return null;
                                return (
                                    <>
                                        <div style={{
                                            marginTop: '24px',
                                            padding: '12px 0 8px',
                                            fontSize: '0.75rem',
                                            fontWeight: 800,
                                            letterSpacing: '0.1em',
                                            color: 'var(--text-secondary)',
                                            textTransform: 'uppercase',
                                            borderTop: '1px solid var(--border-light)',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}>
                                            <span>Dynamic Data Intelligence</span>
                                            <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>Updated Real-Time</span>
                                        </div>
                                        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px', marginTop: '4px' }}>
                                            {inlineSeries.map((series, si) => {
                                                const headingColors = ['#8957e5', '#238636', '#d29922', '#bf3989', '#1f6feb'];
                                                const color = headingColors[si % headingColors.length];
                                                const hasNegatives = series.points.some(p => p.value < 0);
                                                const chartType = hasNegatives ? 'line' : (si % 2 === 0 ? 'line' : 'bar');

                                                return (
                                                    <MetricChart
                                                        key={`${activeSection.id}-series-${si}`}
                                                        label={series.groupLabel}
                                                        values={series.points.map((p) => p.value)}
                                                        xLabels={series.points.map((p) => p.label)}
                                                        unit={series.unit || 'count'}
                                                        type={chartType}
                                                        color={color}
                                                    />
                                                );
                                            })}
                                        </section>
                                    </>
                                );
                            })()}

                            {showMetricsPreview && editedMetricRows.length > 0 && (
                                <>
                                    <section className="metric-legend-strip" style={{ marginTop: '14px' }}>
                                        <div className="metric-legend-group">
                                            <span className="metric-legend-title">Units</span>
                                            {editedUnitLegend.map((entry) => (
                                                <span key={`admin-unit-${entry.unit}`} className="metric-legend-chip">{entry.label}</span>
                                            ))}
                                        </div>
                                    </section>

                                    <section className="kpi-rail" aria-label="Admin metrics KPI preview">
                                        {editedMetricKpis.map((metric) => (
                                            <article key={metric.key} className="kpi-tile" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <span className="kpi-tile__name">{metric.label}</span>
                                                <div className="kpi-tile__value">{formatMetricValue(metric.current, metric.unit)}</div>
                                                <div className={`kpi-tile__delta ${metric.deltaPct >= 0 ? 'pos' : 'neg'}`}>
                                                    {metric.deltaPct >= 0 ? '▲' : '▼'} {Math.abs(metric.deltaPct).toFixed(1)}%
                                                </div>
                                            </article>
                                        ))}
                                    </section>

                                    <section className="metrics-deep-dive metrics-deep-dive--single" style={{ marginTop: '10px' }}>
                                        <div className="table-card">
                                            <div className="table-card__header">
                                                <h3>Section Metrics Breakdown</h3>
                                                <p>Live preview of case metrics in candidate format.</p>
                                            </div>
                                            <div className="metrics-table-wrap">
                                                <table className="metrics-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Parameter</th>
                                                            <th>Unit</th>
                                                            {editedTimelineLabels.map((label, idx) => <th key={`${label}-${idx}`}>{label}</th>)}
                                                            <th>Trend</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {editedMetricRows.map((row) => (
                                                            <tr key={row.key}>
                                                                <td className="sticky-col">{row.label}</td>
                                                                <td>{unitDisplayLabel(row.unit)}</td>
                                                                {editedTimelineLabels.map((_, idx) => {
                                                                    const val = row.values[idx];
                                                                    return <td key={`${row.key}-${idx}`}>{val !== undefined ? formatMetricValue(val, row.unit) : '—'}</td>;
                                                                })}
                                                                <td className={`trend-cell ${row.improving ? 'trend-positive' : 'trend-negative'}`}>{row.improving ? 'Improving' : 'Down'}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </section>

                                    <section className="metrics-deep-dive metrics-deep-dive--single" style={{ marginTop: '10px' }}>
                                        <div className="table-card">
                                            <div className="table-card__header">
                                                <h3>Metric Heatmap</h3>
                                                <p>Darker cells indicate larger values in each row.</p>
                                            </div>
                                            <div className="metrics-table-wrap">
                                                <div className="metric-heatmap-wrap">
                                                    {editedMetricRows.slice(0, 8).map((row) => {
                                                        const values = row.values.map(Number).filter(Number.isFinite);
                                                        const min = Math.min(...values);
                                                        const max = Math.max(...values);
                                                        const span = Math.max(0.0001, max - min);

                                                        return (
                                                            <div key={`admin-heat-${row.key}`} className="metric-heatmap-row">
                                                                <div className="metric-heatmap-row__label">{row.label}</div>
                                                                <div className="metric-heatmap-cells">
                                                                    {editedTimelineLabels.map((label, idx) => {
                                                                        const value = values[idx];
                                                                        if (value === undefined) {
                                                                            return <div key={`admin-heat-${row.key}-${idx}`} className="metric-heatmap-cell metric-heatmap-cell--empty">—</div>;
                                                                        }
                                                                        const normalized = (value - min) / span;
                                                                        const alpha = 0.16 + normalized * 0.78;
                                                                        return (
                                                                            <div
                                                                                key={`admin-heat-${row.key}-${idx}`}
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

                                    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px', marginTop: '16px' }}>
                                        {editedMetricRows.slice(0, 6).map((row, si) => {
                                            const headingColors = ['#8957e5', '#238636', '#d29922', '#bf3989', '#1f6feb'];
                                            const color = headingColors[si % headingColors.length];
                                            const hasNegatives = row.values.some(v => v < 0);
                                            const chartType = hasNegatives ? 'line' : (si % 2 === 0 ? 'line' : 'bar');
                                            return (
                                                <MetricChart
                                                    key={`admin-chart-${row.key}`}
                                                    label={row.label}
                                                    values={row.values}
                                                    xLabels={editedTimelineLabels}
                                                    unit={row.unit}
                                                    type={chartType}
                                                    color={color}
                                                />
                                            );
                                        })}
                                    </section>
                                </>
                            )}
                        </section>
                    )}

                    {!activeSection && (
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
                <div className="admin-eval-hero">
                    <div className="admin-card import-zone centered">
                        <label className={`file-drop-label-centered ${importingPdf ? 'loading' : ''}`}>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="application/pdf"
                                onChange={handleImportPdf}
                                className="hidden-file-input"
                                disabled={importingPdf}
                            />
                            {importingPdf ? (
                                <div className="import-progress-container">
                                    <div className="importing-filename">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                            <polyline points="14 2 14 8 20 8" />
                                        </svg>
                                        {uploadingFileName}
                                    </div>
                                    <div className="import-progress-bar-bg">
                                        <div
                                            className="import-progress-bar-fill"
                                            style={{ width: `${uploadProgress}%` }}
                                        />
                                    </div>
                                    <div className="import-status-text">
                                        {uploadProgress < 100 ? 'Case study is being created...' : 'Analysis complete!'}
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="import-icon-box">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                            <polyline points="14 2 14 8 20 8" />
                                            <path d="M12 18v-6" />
                                            <path d="M9 15l3-3 3 3" />
                                        </svg>
                                    </div>
                                    <div className="import-text-block">
                                        <h2 className="import-title">Upload Case Study PDF</h2>
                                        <p className="import-subtitle">Drag and drop your document here or click to browse</p>
                                    </div>
                                </>
                            )}
                        </label>
                    </div>
                </div>

                {saveSuccess && <div className="save-banner save-banner--success">Case study created successfully.</div>}
                {saveError && <div className="save-banner save-banner--error">{saveError}</div>}

                <div className="cases-list-header">
                    <h2 className="cases-list-title">Created Case Studies</h2>
                    <div className="cases-list-actions">
                        <button className="list-sort-btn">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="21" y1="10" x2="7" y2="10" />
                                <line x1="21" y1="6" x2="3" y2="6" />
                                <line x1="21" y1="14" x2="11" y2="14" />
                                <line x1="21" y1="18" x2="15" y2="18" />
                            </svg>
                            Sort by Date
                        </button>
                    </div>
                </div>

                <div className="cases-list-container">
                    {caseStudies.length === 0 ? (
                        <p className="admin-hint">No case studies created yet.</p>
                    ) : (
                        <div className="cases-list">
                            {caseStudies.map((row) => (
                                <div key={row.id} className="case-list-row clickable" onClick={() => handleOpenCaseDetail(row.id)}>
                                    <div className="case-list-leading">
                                        <div className="case-icon-box">
                                            {row.industry?.toLowerCase().includes('data') || row.title?.toLowerCase().includes('data') ? (
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <line x1="18" y1="20" x2="18" y2="10" />
                                                    <line x1="12" y1="20" x2="12" y2="4" />
                                                    <line x1="6" y1="20" x2="6" y2="14" />
                                                </svg>
                                            ) : (
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                                                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                                                </svg>
                                            )}
                                        </div>
                                        <div className="case-list-main">
                                            <div className="case-title-row">
                                                <div className="case-list-title">{row.title.toUpperCase()}</div>
                                                <span className={`case-status-badge ${row.is_active ? 'active' : 'draft'}`}>
                                                    {row.is_active ? 'ACTIVE' : 'DRAFT'}
                                                </span>
                                            </div>
                                            <div className="case-list-meta-new">
                                                <span className="meta-tag">{row.industry?.toUpperCase() || 'GENERAL'}</span>
                                                <span className="meta-tag">{getCaseModeMeta(row).label.toUpperCase()}</span>
                                                <span className="meta-time">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                                                        <circle cx="12" cy="12" r="10" />
                                                        <polyline points="12 6 12 12 16 14" />
                                                    </svg>
                                                    Updated {new Date(row.updated_at || row.created_at).toLocaleDateString() === new Date().toLocaleDateString() ? 'today' : 'recently'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="case-row-actions">
                                        <button className="icon-action-btn" onClick={(e) => { e.stopPropagation(); handleEditCase(row.id); }} title="Edit Case" aria-label="Edit Case">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M12 20h9" />
                                                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
                                            </svg>
                                        </button>
                                        <button className="icon-action-btn danger" onClick={(e) => { e.stopPropagation(); handleDeleteCase(row.id); }} title="Delete Case" aria-label="Delete Case">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="3 6 5 6 21 6" />
                                                <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
                                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                                <line x1="10" y1="11" x2="10" y2="17" />
                                                <line x1="14" y1="11" x2="14" y2="17" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>



                <CaseStudyDrawer
                    caseStudy={selectedCaseDetail}
                    onClose={() => setSelectedCaseDetail(null)}
                    onEdit={handleEditCase}
                />
            </div>
        </div>
    );
};

export default AdminEvaluation;
