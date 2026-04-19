const { parsePDF } = require('./utils/pdfParser');
const path = require('path');
const os   = require('os');
const fs   = require('fs');

const MAX_STRIKES = 3;
const PASSING_MARKS = 65;
const FAILING_MARKS = 50;

const DEMO_CASE_STUDY = {
    id: 'demo-aurumcart-case',
    title: 'AurumCart: Profitability Recovery Sprint',
    industry: 'D2C / E-commerce',
    context: 'AurumCart is experiencing strong revenue growth but has recently started reporting losses. Analyze financial, operational and customer metrics to diagnose why profitability is declining.',
    initial_prompt: 'Primary Case Question: 1) Identify root causes of declining profitability. 2) Recommend a structured action plan to restore profitability within 6 months. 3) Highlight key risks in your approach. Start with your diagnostic hypothesis.',
    financial_data: {
        revenue_cr: [1.2, 1.25, 1.3, 1.35, 1.4, 1.45],
        net_profit_l: [11, 9, 3, -2, -9, -16],
        logistics_cost_l: [12, 13, 15, 17, 19, 21],
        churn_rate_pct: [18, 20, 22, 24, 26, 28],
        delayed_orders_pct: [12, 14, 16, 18, 20, 22],
        complaints_pct: [5, 6, 8, 10, 13, 17]
    },
    threshold_passing_score: 0.6,
    is_active: true
};

const inMemoryDemoSessions = new Map();
const caseCorpusCache = new Map();

class ApiError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

const safeJson = (value, fallback = null) => {
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const extractTotalScore = (row = {}) => {
    const embedded = row?.assessment_scores;
    if (Array.isArray(embedded)) return Number(embedded[0]?.total_score || 0);
    if (embedded && typeof embedded === 'object') return Number(embedded.total_score || 0);
    return 0;
};

const attachTotalScore = (rows = []) => (rows || []).map((row) => ({
    ...row,
    total_score: extractTotalScore(row)
}));

const deriveResultStatus = (row = {}) => {
    const scoreObj = Array.isArray(row?.assessment_scores) ? row.assessment_scores[0] : row?.assessment_scores;
    const isPassing = Boolean(scoreObj?.is_passing);
    const total = Number(row?.total_score || extractTotalScore(row));
    if (isPassing || total >= PASSING_MARKS) return 'pass';
    if (String(row?.status || '').toLowerCase() === 'active' && total <= 0) return 'pending';
    return 'fail';
};

const attachResultStatus = (rows = []) => (rows || []).map((row) => {
    const total_score = Number(row?.total_score || extractTotalScore(row));
    return {
        ...row,
        total_score,
        result_status: deriveResultStatus({ ...row, total_score })
    };
});

const normalizeRubric = (rubric = {}) => ({
    problemUnderstanding: clamp(Number(rubric.problemUnderstanding || 0), 0, 20),
    dataUsage: clamp(Number(rubric.dataUsage || 0), 0, 20),
    rootCauseIdentification: clamp(Number(rubric.rootCauseIdentification || 0), 0, 20),
    solutionQuality: clamp(Number(rubric.solutionQuality || 0), 0, 25),
    crossQuestionConsistency: clamp(Number(rubric.crossQuestionConsistency || 0), 0, 15)
});

const isMissingTableError = (message = '') => {
    const msg = String(message || '').toLowerCase();
    return (
        (msg.includes('relation') && msg.includes('does not exist')) ||
        msg.includes('schema cache') ||
        msg.includes('could not find the table')
    );
};

const formatMissingTableMessage = () => 'DATABASE ERROR: Tables missing. Please execute backend/schema_v2_evaluation.sql in Supabase SQL Editor.';

const cleanPdfText = (raw = '') => String(raw || '')
    .replace(/\r/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

const inferIndustryFromText = (text) => {
    const t = text.toLowerCase();
    if (t.includes('e-commerce') || t.includes('d2c')) return 'D2C / E-commerce';
    if (t.includes('fintech') || t.includes('neobank')) return 'FinTech';
    if (t.includes('saas')) return 'SaaS';
    if (t.includes('bank') || t.includes('banking')) return 'Banking';
    if (t.includes('cyber') || t.includes(' soc ') || t.includes('security operations')) return 'Cybersecurity';
    if (t.includes('logistics') || t.includes('last-mile') || t.includes('delivery')) return 'Logistics';
    if (t.includes('healthcare') || t.includes('pharma')) return 'Healthcare';
    if (t.includes('manufacturing') || t.includes('supply chain')) return 'Manufacturing';
    if (t.includes('retail')) return 'Retail';
    if (t.includes('energy') || t.includes('oil') || t.includes('renewable')) return 'Energy';
    return 'General Business Strategy';
};

const normalizeHeadingKey = (value = '') => String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[\u2013\u2014]/g, '-')
    .trim()
    .toUpperCase();

const isHeadingLike = (value = '') => {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text.length < 4 || text.length > 120) return false;
    if (!/[A-Za-z]/.test(text)) return false;
    if (/^\d[\d\s,.:;%-]*$/.test(text)) return false;
    if ((text.match(/[,.]/g) || []).length > 3) return false;
    const words = text.split(' ').filter(Boolean);
    if (words.length > 12) return false;

    const uppercaseLike = text === text.toUpperCase();
    const titleLike = /^[A-Z][A-Za-z0-9/&()\-,: ]+$/.test(text);
    const endsLikeHeading = /[:)]$/.test(text) || !/[.!?]$/.test(text);
    return (uppercaseLike || titleLike) && endsLikeHeading;
};

const extractBoldHeadingsFromPdfBuffer = async (buffer) => {
    try {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer), disableWorker: true });
        const pdf = await loadingTask.promise;
        const headings = [];
        const seen = new Set();

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const styleMap = textContent.styles || {};
            const items = (textContent.items || []).map((item) => {
                const transform = item.transform || [];
                const style = styleMap[item.fontName] || {};
                const fontName = String(item.fontName || '');
                const fontFamily = String(style.fontFamily || '');
                return {
                    str: String(item.str || '').trim(),
                    x: Number(transform[4] || 0),
                    y: Number(transform[5] || 0),
                    charLen: String(item.str || '').trim().length,
                    fontName,
                    isBold: /bold|black|demi|heavy/i.test(fontName) || /bold|black|demi|heavy/i.test(fontFamily)
                };
            }).filter((i) => i.str.length > 0);

            const fontCharCount = new Map();
            for (const item of items) {
                fontCharCount.set(item.fontName, (fontCharCount.get(item.fontName) || 0) + (item.charLen || 0));
            }
            const dominantFont = [...fontCharCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';

            const lines = new Map();
            for (const item of items) {
                const yKey = Math.round(item.y * 2) / 2;
                if (!lines.has(yKey)) lines.set(yKey, []);
                lines.get(yKey).push(item);
            }

            for (const lineItems of lines.values()) {
                lineItems.sort((a, b) => a.x - b.x);
                const candidate = lineItems.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim();

                const lineFontChars = new Map();
                for (const item of lineItems) {
                    lineFontChars.set(item.fontName, (lineFontChars.get(item.fontName) || 0) + (item.charLen || 0));
                }
                const linePrimaryFont = [...lineFontChars.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';

                const hasExplicitBold = lineItems.some((i) => i.isBold);
                const hasHeadingFontContrast = Boolean(linePrimaryFont && dominantFont && linePrimaryFont !== dominantFont);
                
                if (!hasExplicitBold && !hasHeadingFontContrast) continue;

                // If explicitly bold, use relaxed constraints, else use strict constraints
                if (hasExplicitBold) {
                    if (candidate.length < 3 || candidate.length > 200) continue;
                } else {
                    if (!isHeadingLike(candidate)) continue;
                }

                const key = normalizeHeadingKey(candidate);
                if (!seen.has(key)) {
                    seen.add(key);
                    headings.push(candidate);
                }
            }
        }

        return headings;
    } catch {
        return [];
    }
};

const discoverAllSections = (text) => {
    const lines = text.split('\n');
    const boundaries = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (
            line.length >= 4 &&
            /^[A-Z][A-Z0-9 &\/\-():,.%#*]{3,}$/.test(line) &&
            !/^\d[\d,.\s\-]+$/.test(line)
        ) {
            boundaries.push({ heading: line, idx: i });
        }
    }
    const sections = {};
    for (let i = 0; i < boundaries.length; i++) {
        const { heading, idx } = boundaries[i];
        const endIdx = i + 1 < boundaries.length ? boundaries[i + 1].idx : lines.length;
        const body = lines.slice(idx + 1, endIdx)
            .filter((l) => l.trim().length > 0)
            .join('\n')
            .trim();
        if (body.length > 5) {
            sections[heading] = sections[heading] ? sections[heading] + '\n' + body : body;
        }
    }
    return sections;
};

const discoverSectionsByHeadingList = (text, headingList = []) => {
    const lines = String(text || '').split('\n');
    const normalizedHeadingMap = new Map();
    for (const heading of headingList) {
        const normalized = normalizeHeadingKey(heading);
        if (normalized) normalizedHeadingMap.set(normalized, String(heading).trim());
    }

    if (normalizedHeadingMap.size === 0) return {};

    const boundaries = [];
    for (let i = 0; i < lines.length; i += 1) {
        const line = String(lines[i] || '').trim();
        if (!line) continue;
        const normalizedLine = normalizeHeadingKey(line);
        if (normalizedHeadingMap.has(normalizedLine)) {
            boundaries.push({ idx: i, heading: normalizedHeadingMap.get(normalizedLine) });
        }
    }

    if (boundaries.length === 0) return {};

    const sections = {};
    for (let i = 0; i < boundaries.length; i += 1) {
        const current = boundaries[i];
        const endIdx = i + 1 < boundaries.length ? boundaries[i + 1].idx : lines.length;
        const body = lines
            .slice(current.idx + 1, endIdx)
            .filter((l) => String(l || '').trim().length > 0)
            .join('\n')
            .trim();

        if (body.length > 3) {
            sections[current.heading] = sections[current.heading]
                ? `${sections[current.heading]}\n${body}`
                : body;
        }
    }

    return sections;
};

const extractAllNumericSeries = (text) => {
    const results = {};
    for (const line of text.split('\n')) {
        const m = line.match(/^([A-Za-z][A-Za-z0-9 &\/\-()%:,.']+?)\s*:\s*((?:-?\d+(?:\.\d+)?[\s,|;]+){1,10}-?\d+(?:\.\d+)?)\s*(?:\([^)]*\))?\s*$/);
        if (!m) continue;
        const label = m[1].trim();
        const nums = (m[2].match(/-?\d+(?:\.\d+)?/g) || []).map(Number).filter(Number.isFinite);
        if (nums.length >= 2) {
            const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
            results[key] = { label, values: nums };
        }
    }
    return results;
};

const extractProblemStatement = (sections, fullText) => {
    const problemKeys = Object.keys(sections).filter((k) =>
        /problem|question|objective|challenge|tasks?/i.test(k)
    );
    if (problemKeys.length > 0) {
        return problemKeys.map((k) => `${k}:\n${sections[k]}`).join('\n\n');
    }
    const numberedQs = fullText.match(/\d[).]\s[^\n]{10,}/g);
    if (numberedQs && numberedQs.length >= 2) return numberedQs.join('\n');
    const longLines = fullText.split('\n').filter((l) => l.trim().length > 60);
    return longLines[longLines.length - 1] || 'Identify the root cause of the primary business challenge and propose a structured, data-driven recovery plan.';
};

const extractProblemQuestionsFromText = (problemText = '', fallbackFullText = '') => {
    const source = String(problemText || '').trim() || String(fallbackFullText || '').trim();
    if (!source) return [];

    const lineBased = [];
    for (const raw of source.split('\n')) {
        const line = String(raw || '').trim();
        const m = line.match(/^(\d+)[).:]?\s+(.{8,})$/);
        if (!m) continue;
        lineBased.push({ order: Number(m[1]), text: m[2].trim() });
    }

    if (lineBased.length >= 2) {
        return lineBased
            .sort((a, b) => a.order - b.order)
            .map((q) => q.text)
            .filter(Boolean);
    }

    // Handles inline forms like: "1) ... 2) ... 3) ..."
    const flattened = source.replace(/\s+/g, ' ').trim();
    const inlineMatches = [...flattened.matchAll(/(?:^|\s)(\d+)[).:]?\s*(.+?)(?=(?:\s+\d+[).:]?\s)|$)/g)];
    const inlineQuestions = inlineMatches
        .map((m) => ({ order: Number(m[1] || 0), text: String(m[2] || '').trim() }))
        .filter((q) => q.order > 0 && q.text.length > 8)
        .sort((a, b) => a.order - b.order)
        .map((q) => q.text);

    if (inlineQuestions.length >= 2) return inlineQuestions;

    // Additional fallback: bullet/question line candidates.
    const bulletCandidates = source
        .split('\n')
        .map((l) => String(l || '').trim())
        .filter((l) => /^[-•*]\s+/.test(l) || /\?$/.test(l))
        .map((l) => l.replace(/^[-•*]\s+/, '').trim())
        .filter((q) => q.length > 12);
    if (bulletCandidates.length >= 2) return bulletCandidates.slice(0, 8);

    // Final fallback: detect numbered prompts in full text globally.
    const globalMatches = [...String(fallbackFullText || '').matchAll(/(?:^|\n)\s*(\d+)[).:]\s+(.{8,})(?=\n|$)/g)];
    const globalQuestions = globalMatches
        .map((m) => ({ order: Number(m[1] || 0), text: String(m[2] || '').trim() }))
        .filter((q) => q.order > 0 && q.text.length > 8)
        .sort((a, b) => a.order - b.order)
        .map((q) => q.text);

    if (globalQuestions.length >= 2) return globalQuestions;

    // Last-resort semantic extraction from long task-like lines.
    return source
        .split('\n')
        .map((l) => String(l || '').trim())
        .filter((l) => /(?:identify|analy[sz]e|propose|recommend|evaluate|assess|quantify|calculate|how|what|why)/i.test(l))
        .filter((l) => l.length > 18)
        .slice(0, 6);
};

const extractQuestionsFromSections = (sections = {}, fallbackText = '') => {
    const entries = Object.entries(sections || {});
    if (entries.length === 0) return extractProblemQuestionsFromText('', fallbackText);

    const priorityBuckets = entries
        .filter(([heading]) => /problem|question|objective|task|deliverable|ask/i.test(String(heading || '')))
        .map(([, body]) => String(body || '').trim())
        .filter(Boolean);

    const source = priorityBuckets.length > 0
        ? priorityBuckets.join('\n\n')
        : entries.map(([, body]) => String(body || '').trim()).join('\n\n');

    return extractProblemQuestionsFromText(source, fallbackText);
};

const toSectionStorageKey = (raw = '') => String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const prettifySectionLabel = (raw = '') => String(raw || '')
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const deriveCandidateSectionsFromParsed = (parsedSections = {}) => {
    const sections = [];
    const seen = new Set();

    const pushSection = (section) => {
        const heading = String(section?.heading || '').trim();
        const content = String(section?.content || '').trim();
        if (!heading || !content) return;

        const keySeed = `${normalizeSectionHeadingForDedup(heading)}::${normalizeTextForComparison(content).slice(0, 220)}`;
        if (seen.has(keySeed)) return;
        seen.add(keySeed);

        sections.push({
            key: section.key,
            heading,
            role: section.role || 'other',
            content
        });
    };

    const llmSections = Array.isArray(parsedSections?._sections) ? parsedSections._sections : [];
    if (llmSections.length > 0) {
        llmSections.forEach((s, idx) => {
            pushSection({
                key: `section_${idx}`,
                heading: String(s?.heading || `Section ${idx + 1}`),
                role: String(s?.role || 'other'),
                content: String(s?.content || '')
            });
        });
        return sections;
    }

    Object.entries(parsedSections || {})
        .filter(([k, v]) => !String(k).startsWith('_') && String(v || '').trim().length > 0)
        .forEach(([k, v]) => {
            pushSection({
                key: `flat_${toSectionStorageKey(k)}`,
                heading: prettifySectionLabel(k),
                role: 'other',
                content: String(v || '')
            });
        });

    return sections;
};

const normalizeSectionHeadingForDedup = (heading = '') => {
    const base = String(heading || '')
        .toLowerCase()
        .replace(/[()\[\]{}]/g, ' ')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (!base) return '';
    if (/^(problem|problem statement|case question|questions|objectives?|tasks?)$/.test(base)) return 'problem_statement';
    if (/^(overview|context|background|company overview|introduction)$/.test(base)) return 'overview';
    if (/^(opening prompt|initial prompt|interview prompt|prompt)$/.test(base)) return 'opening_prompt';
    return base;
};

const normalizeTextForComparison = (value = '') => String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .trim()
    .toLowerCase();

const mergeSectionBodies = (existingBody = '', nextBody = '') => {
    const a = normalizeTextForComparison(existingBody);
    const b = normalizeTextForComparison(nextBody);
    if (!a) return String(nextBody || '').trim();
    if (!b) return String(existingBody || '').trim();

    if (a === b) return String(existingBody || '').trim();
    if (a.includes(b)) return String(existingBody || '').trim();
    if (b.includes(a)) return String(nextBody || '').trim();

    return `${String(existingBody || '').trim()}\n\n${String(nextBody || '').trim()}`.trim();
};

const dedupeSectionsObject = (sections = {}) => {
    const byCanonicalHeading = new Map();

    for (const [heading, rawBody] of Object.entries(sections || {})) {
        const body = String(rawBody || '').trim();
        const headingText = String(heading || '').trim();
        if (!headingText || body.length < 4) continue;

        const normalizedHeading = normalizeSectionHeadingForDedup(headingText);
        if (!normalizedHeading) continue;

        if (!byCanonicalHeading.has(normalizedHeading)) {
            byCanonicalHeading.set(normalizedHeading, {
                heading: headingText,
                body
            });
            continue;
        }

        const existing = byCanonicalHeading.get(normalizedHeading);
        byCanonicalHeading.set(normalizedHeading, {
            heading: existing.heading.length >= headingText.length ? existing.heading : headingText,
            body: mergeSectionBodies(existing.body, body)
        });
    }

    const finalSections = {};
    for (const { heading, body } of byCanonicalHeading.values()) {
        finalSections[heading] = body;
    }
    return finalSections;
};

const generateCaseDraftFromPdf = (pdfText, options = {}) => {
    const text = cleanPdfText(pdfText);
    const boldHeadings = Array.isArray(options.boldHeadings) ? options.boldHeadings : [];

    const titleMatch = text.match(/Case Study\s*[-–:]\s*([^\n]{5,80})/i)
        || text.match(/^([A-Z][^\n]{10,80})$/m);
    const rawTitle = titleMatch ? (titleMatch[1] || titleMatch[0]) : 'Imported Case Study';
    const title = String(rawTitle).replace(/case study\s*[-–:]\s*/i, '').replace(/[:\-\s]+$/g, '').trim();

    const industry = inferIndustryFromText(text);

    const sectionsFromBold = discoverSectionsByHeadingList(text, boldHeadings);
    const discoveredSections = Object.keys(sectionsFromBold).length > 0 ? sectionsFromBold : discoverAllSections(text);
    const sections = dedupeSectionsObject(discoveredSections);

    const numericSeries = extractAllNumericSeries(text);

    const contextParts = Object.entries(sections)
        .map(([heading, body]) => `${heading}\n${body}`)
        .join('\n\n');
    const context = contextParts.length > 100 ? contextParts : text;

    const problemStatement = extractProblemStatement(sections, text);
    const problemQuestions = extractQuestionsFromSections(sections, text);
    const questionLines = (problemQuestions.length > 0
        ? problemQuestions.map((q, idx) => `${idx + 1}) ${q}`)
        : problemStatement
            .split('\n')
            .filter((l) => l.trim().length > 0)
            .slice(0, 3)
    ).join('\n');
    const initialPrompt = `Welcome to your ${industry} case study: "${title}".\n\nHere is your problem to solve:\n\n${questionLines}\n\nPlease begin by sharing your initial diagnostic hypothesis — what do you believe are the top 2–3 root causes of the central business problem? Be specific and reference the data provided in the case.`;

    const financialData = {};
    for (const [key, seriesObj] of Object.entries(numericSeries)) {
        financialData[key] = seriesObj.values;
    }

    return {
        title,
        industry,
        context,
        problemStatement,
        initialPrompt,
        thresholdPassingScore: 0.6,
        financialData,
        parsedSections: {
            ...sections,
            _problemQuestions: problemQuestions,
            _numericSeries: numericSeries
        },
        rawContent: text
    };
};

const deriveRubricFromText = (userMessage = '') => {
    const text = String(userMessage || '').toLowerCase();
    const financialTokens = ['revenue', 'profit', 'margin', 'inventory', 'logistics', 'churn', 'cac', 'ltv', 'cost', 'roi'];
    const rootCauseTokens = ['root cause', 'because', 'driver', 'due to', 'led to', 'caused by'];
    const actionTokens = ['reduce', 'optimize', 'improve', 'prioritize', 'renegotiate', 'forecast', 'timeline', 'risk', 'phase', 'owner'];
    const consistencyTokens = ['first', 'second', 'third', 'therefore', 'hence', 'tradeoff', 'assumption'];

    const tokenMatches = (tokens) => tokens.filter((t) => text.includes(t)).length;
    const financialHits = tokenMatches(financialTokens);
    const rootCauseHits = tokenMatches(rootCauseTokens);
    const actionHits = tokenMatches(actionTokens);
    const consistencyHits = tokenMatches(consistencyTokens);
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    return normalizeRubric({
        problemUnderstanding: clamp(7 + financialHits * 2 + (wordCount > 45 ? 2 : 0), 0, 20),
        dataUsage: clamp(financialHits * 3, 0, 20),
        rootCauseIdentification: clamp((financialHits + rootCauseHits) * 2, 0, 20),
        solutionQuality: clamp(actionHits * 3 + (wordCount > 70 ? 4 : 0), 0, 25),
        crossQuestionConsistency: clamp(consistencyHits * 3, 0, 15)
    });
};

const normalizeQuestionContext = (activeQuestion) => {
    if (!activeQuestion || typeof activeQuestion !== 'object') return null;
    const text = normalizeWhitespace(activeQuestion.text || activeQuestion.question || '');
    if (!text) return null;

    const index = Math.max(0, Number(activeQuestion.index || 0));
    const questionId = String(activeQuestion.id || `q-${index + 1}`);
    const total = Math.max(index + 1, Number(activeQuestion.total || index + 1));
    return { id: questionId, index, total, text };
};

const toScoreBand = (totalScore) => {
    if (totalScore >= 80) return 'High Distinction';
    if (totalScore >= PASSING_MARKS) return 'Pass';
    if (totalScore >= FAILING_MARKS) return 'Borderline';
    return 'Fail';
};

const buildConversationalFeedback = (rubricScores, totalScore, attemptsLeft, currentStep) => {
    const weakestArea = Object.entries({
        problemUnderstanding: rubricScores.problemUnderstanding,
        dataUsage: rubricScores.dataUsage,
        rootCauseIdentification: rubricScores.rootCauseIdentification,
        solutionQuality: rubricScores.solutionQuality,
        crossQuestionConsistency: rubricScores.crossQuestionConsistency
    }).sort((a, b) => a[1] - b[1])[0]?.[0] || 'dataUsage';

    return `Current score: ${totalScore}/100 (${toScoreBand(totalScore)}). Attempts left: ${attemptsLeft}. Focus next on ${weakestArea} and keep your response structured for the ${currentStep} phase.`;
};

const getRuleBasedEvaluation = (userMessage, currentStep = 'diagnostic') => {
    const rubricScores = deriveRubricFromText(userMessage);
    const totalScore = Object.values(rubricScores).reduce((sum, n) => sum + n, 0);
    const logicalDepth = totalScore >= 70 ? 4 : totalScore >= 50 ? 3 : 2;

    return {
        response: currentStep === 'final_recommendation'
            ? 'You are close. Give me your final 6-month plan with clear owners, milestones, and the top two execution risks.'
            : 'Good start. Walk me through your reasoning with specific data points and tell me which lever you would prioritize first and why.',
        analysis: 'Rule-based fallback evaluation applied because AI output was unavailable or invalid.',
        logicalDepth,
        rubricScores,
        isDisqualified: false,
        nextStep: currentStep === 'diagnostic' ? 'brainstorming' : currentStep,
        weakResponse: logicalDepth <= 2
    };
};

const normalizeWhitespace = (text = '') => String(text || '').replace(/\s+/g, ' ').trim();

const tokenize = (text = '') => normalizeWhitespace(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s.%]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);

const splitIntoChunks = (text = '', maxLen = 900, overlap = 120) => {
    const clean = normalizeWhitespace(text);
    if (!clean) return [];

    const chunks = [];
    let start = 0;
    while (start < clean.length) {
        const end = Math.min(clean.length, start + maxLen);
        const chunk = clean.slice(start, end).trim();
        if (chunk.length > 40) chunks.push(chunk);
        if (end >= clean.length) break;
        start = Math.max(end - overlap, start + 1);
    }
    return chunks;
};

const buildCaseCorpus = (caseStudy = {}) => {
    const id = String(caseStudy.id || caseStudy.title || 'unknown-case');
    if (caseCorpusCache.has(id)) return caseCorpusCache.get(id);

    const sources = [];
    const pushSource = (tag, value) => {
        const text = normalizeWhitespace(value);
        if (text) sources.push({ tag, text });
    };

    pushSource('context', caseStudy.context || '');
    pushSource('initial_prompt', caseStudy.initial_prompt || '');
    pushSource('raw_content', caseStudy.raw_content || '');

    if (caseStudy.financial_data && typeof caseStudy.financial_data === 'object') {
        const financialLines = Object.entries(caseStudy.financial_data)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
            .join('\n');
        pushSource('financial_data', financialLines);
    }

    if (caseStudy.parsed_sections && typeof caseStudy.parsed_sections === 'object') {
        for (const [section, body] of Object.entries(caseStudy.parsed_sections)) {
            if (section === '_numericSeries') continue;
            pushSource(`section:${section}`, typeof body === 'string' ? body : JSON.stringify(body));
        }
    }

    const chunks = [];
    for (const source of sources) {
        const split = splitIntoChunks(source.text, 900, 140);
        split.forEach((chunk, idx) => {
            chunks.push({
                id: `${source.tag}-${idx + 1}`,
                source: source.tag,
                text: chunk,
                tokens: tokenize(chunk)
            });
        });
    }

    caseCorpusCache.set(id, chunks);
    return chunks;
};

const scoreChunkForQuery = (queryTokens = [], chunk = {}, recentTokens = []) => {
    if (!chunk || !Array.isArray(chunk.tokens)) return 0;
    const tokenSet = new Set(chunk.tokens);

    const queryMatches = queryTokens.filter((t) => tokenSet.has(t)).length;
    const recentMatches = recentTokens.filter((t) => tokenSet.has(t)).length;

    // Give extra signal to numeric consistency for case math questions.
    const hasNumbers = /\d/.test(chunk.text || '') ? 1 : 0;

    return (queryMatches * 3) + recentMatches + hasNumbers;
};

const retrieveCaseEvidence = ({ caseStudy, userMessage, history = [], topK = 8 }) => {
    const chunks = buildCaseCorpus(caseStudy);
    if (!chunks.length) return [];

    const queryTokens = tokenize(userMessage);
    const recentAssistantAndUser = history.slice(-6).map((m) => m.content || '').join(' ');
    const recentTokens = tokenize(recentAssistantAndUser);

    const ranked = chunks
        .map((chunk) => ({
            chunk,
            score: scoreChunkForQuery(queryTokens, chunk, recentTokens)
        }))
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
        .map((r) => r.chunk);

    // Safe fallback if lexical scoring misses but case exists.
    if (ranked.length > 0) return ranked;
    return chunks.slice(0, Math.min(topK, chunks.length));
};

const buildEvaluationPrompt = (session, currentStep, evidenceChunks = [], activeQuestion = null) => {
    const cs = session.case_studies;
    const fullCaseDocument = cs.raw_content || cs.context || '';
    const financialSummary = cs.financial_data && Object.keys(cs.financial_data).length > 0
        ? Object.entries(cs.financial_data)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
            .join('\n')
        : 'See case document for financial data.';

    const evidencePack = evidenceChunks.length > 0
        ? evidenceChunks.map((c, i) => `[E${i + 1}] (${c.source}) ${c.text}`).join('\n\n')
        : '[E1] No retrieved chunks. Use only explicit case text below and ask for clarification when data is missing.';

    const questionContext = normalizeQuestionContext(activeQuestion);
    const activeQuestionBlock = questionContext
        ? `ACTIVE PROBLEM STATEMENT FOCUS:\n- Question ${questionContext.index + 1} of ${questionContext.total}: ${questionContext.text}\n- Evaluate the candidate answer specifically against this question.\n- Your follow-up must be a counter-question that deepens THIS question (not a different one).`
        : 'ACTIVE PROBLEM STATEMENT FOCUS:\n- No specific question focus provided. Evaluate normally.';

    return `You are a Senior Partner at a top-tier strategy consulting firm conducting a live case study interview.

CASE TITLE: ${cs.title}
INDUSTRY: ${cs.industry || 'General Business Strategy'}
CURRENT INTERVIEW PHASE: ${currentStep}
${activeQuestionBlock}

GROUNDING MODE (STRICT):
- You MUST ground all reasoning and follow-up questions in the EVIDENCE PACK.
- If a fact is not present in evidence, do not invent it.
- If evidence is insufficient, ask a clarification question instead of making up details.
- Do not use external knowledge, prior assumptions, or generic industry facts unless present in evidence.

--- EVIDENCE PACK (retrieved for this candidate turn) ---
${evidencePack}
--- END EVIDENCE PACK ---

--- FULL CASE DOCUMENT (read carefully — this is exactly what the candidate sees) ---
${fullCaseDocument}
--- END OF CASE DOCUMENT ---

KEY METRICS SUMMARY:
${financialSummary}

STRICT EVALUATION RUBRIC (score exactly in these ranges):
- problemUnderstanding: 0-20
- dataUsage: 0-20
- rootCauseIdentification: 0-20
- solutionQuality: 0-25
- crossQuestionConsistency: 0-15

INTERVIEW RULES:
- Sound human, direct, and professional. Avoid robotic wording.
- Ask exactly one focused follow-up question based on the candidate's latest answer.
- Reference specific data points FROM THE CASE DOCUMENT in your questions.
- Keep your interviewer response concise (1-3 sentences).
- Push for quantified reasoning, practical trade-offs, and sequencing.
- Never mention scores, fail counts, rubric labels, or internal evaluation logic to the candidate.
- Penalize generic answers (those not referencing case-specific data) with low rubric scores.
- If response is weak/illogical/generic, set weakResponse=true.
- Candidate is disqualified after 3 weak responses.

PHASE GUIDANCE:
- diagnostic: test framing quality and hypothesis sharpness using specific metrics
- brainstorming: test option breadth and prioritization logic against the case constraints
- calculations: test assumptions, math discipline, and KPI impact relative to the case data
- final_recommendation: test sequencing, ownership, and risk mitigation with a 90-day plan

Return valid JSON only using this shape:
{
  "response": "next interviewer question",
  "analysis": "short internal assessment",
  "logicalDepth": 1,
  "rubricScores": {
    "problemUnderstanding": 0,
    "dataUsage": 0,
    "rootCauseIdentification": 0,
    "solutionQuality": 0,
    "crossQuestionConsistency": 0
  },
  "weakResponse": false,
  "isDisqualified": false,
  "nextStep": "diagnostic|brainstorming|calculations|final_recommendation|complete"
}
`;
};

const createApiService = ({ supabase, groqClients, getNextGroqClient }) => {
    const ragServiceUrl = String(process.env.PY_RAG_SERVICE_URL || '').trim();
    const ragDebugLogs = /^(1|true|yes|on)$/i.test(String(process.env.RAG_DEBUG_LOGS || '').trim());

    const callPythonRagEvaluate = async ({ session, history, userMessage, currentStep, activeQuestion = null }) => {
        if (!ragServiceUrl) return null;
        try {
            const res = await fetch(`${ragServiceUrl.replace(/\/$/, '')}/rag/evaluate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    caseStudy: session.case_studies || {},
                    history: Array.isArray(history) ? history.slice(-12) : [],
                    userMessage,
                    currentStep,
                    sessionId: session.id || null,
                    activeQuestion: normalizeQuestionContext(activeQuestion)
                })
            });
            if (!res.ok) return null;
            const payload = await res.json();
            if (!payload || !payload.success || !payload.evaluation) return null;

            const ev = payload.evaluation;
            if (ragDebugLogs) {
                const metrics = ev.retrievalMetrics || {};
                console.info('[RAG DEBUG] evaluate', {
                    sessionId: session.id || null,
                    retrievalCount: metrics.retrievalCount,
                    retrievedChunkIds: metrics.retrievedChunkIds || [],
                    citedChunkIds: metrics.citedChunkIds || [],
                    groundingPassed: metrics.groundingPassed,
                    regenerated: metrics.regenerated
                });
            }
            return {
                response: ev.response || 'Please continue with a structured answer and measurable assumptions.',
                analysis: ev.analysis || 'RAG evaluation completed.',
                logicalDepth: clamp(Number(ev.logicalDepth || 2), 1, 5),
                rubricScores: normalizeRubric(ev.rubricScores || {}),
                weakResponse: Boolean(ev.weakResponse),
                isDisqualified: Boolean(ev.isDisqualified),
                nextStep: ev.nextStep || currentStep,
                citations: Array.isArray(ev.citations) ? ev.citations : [],
                retrievalMetrics: ev.retrievalMetrics || null
            };
        } catch {
            return null;
        }
    };

    const triggerPythonRagIndex = async (caseStudy) => {
        if (!ragServiceUrl || !caseStudy) return;
        try {
            const res = await fetch(`${ragServiceUrl.replace(/\/$/, '')}/rag/index-case`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ caseStudy })
            });
            if (ragDebugLogs && res.ok) {
                const payload = await res.json();
                console.info('[RAG DEBUG] index-case', payload?.result || payload);
            }
        } catch {
            // Non-blocking best-effort indexing.
        }
    };

    const runAiEvaluation = async (session, history, userMessage, currentStep, activeQuestion = null) => {
        const ragFirst = await callPythonRagEvaluate({ session, history, userMessage, currentStep, activeQuestion });
        if (ragFirst) return ragFirst;

        if (groqClients.length === 0) {
            return getRuleBasedEvaluation(userMessage, currentStep);
        }

        const evidenceChunks = retrieveCaseEvidence({
            caseStudy: session.case_studies || {},
            userMessage,
            history,
            topK: 8
        });
        const systemPrompt = buildEvaluationPrompt(session, currentStep, evidenceChunks, activeQuestion);

        for (let attempt = 0; attempt < groqClients.length; attempt += 1) {
            const activeClient = groqClients[(attempt + (groqClients.length - 1)) % groqClients.length] || groqClients[0];
            try {
                const chatCompletion = await activeClient.chat.completions.create({
                    messages: [
                        { role: 'system', content: systemPrompt },
                        ...history.slice(-8).map((m) => ({ role: m.role, content: m.content })),
                        { role: 'user', content: userMessage }
                    ],
                    model: 'llama-3.3-70b-versatile',
                    response_format: { type: 'json_object' }
                });

                const parsed = safeJson(chatCompletion.choices[0]?.message?.content, null);
                if (!parsed) throw new Error('Invalid AI JSON response');

                return {
                    response: parsed.response || 'Please continue with a structured answer and measurable assumptions.',
                    analysis: parsed.analysis || 'AI evaluation completed.',
                    logicalDepth: clamp(Number(parsed.logicalDepth || 2), 1, 5),
                    rubricScores: (() => {
                        const aiRubric = normalizeRubric(parsed.rubricScores || {});
                        const ruleRubric = deriveRubricFromText(userMessage);
                        return normalizeRubric({
                            problemUnderstanding: Math.max(aiRubric.problemUnderstanding, ruleRubric.problemUnderstanding),
                            dataUsage: Math.max(aiRubric.dataUsage, ruleRubric.dataUsage),
                            rootCauseIdentification: Math.max(aiRubric.rootCauseIdentification, ruleRubric.rootCauseIdentification),
                            solutionQuality: Math.max(aiRubric.solutionQuality, ruleRubric.solutionQuality),
                            crossQuestionConsistency: Math.max(aiRubric.crossQuestionConsistency, ruleRubric.crossQuestionConsistency)
                        });
                    })(),
                    weakResponse: Boolean(parsed.weakResponse) || Number(parsed.logicalDepth || 0) <= 2,
                    isDisqualified: Boolean(parsed.isDisqualified),
                    nextStep: parsed.nextStep || currentStep
                };
            } catch {
                getNextGroqClient();
            }
        }

        return getRuleBasedEvaluation(userMessage, currentStep);
    };

    const refineImportedCaseDraftWithLlm = async (rawPdfText, heuristicDraft) => {
        const safeDraft = heuristicDraft && typeof heuristicDraft === 'object' ? heuristicDraft : {};
        if (!rawPdfText || groqClients.length === 0) return safeDraft;

        const compactText = String(rawPdfText || '').replace(/\s+/g, ' ').trim();
        if (compactText.length < 300) return safeDraft;

        const head = compactText.slice(0, 18000);
        const tail = compactText.length > 22000 ? compactText.slice(-4000) : '';
        const extractionSource = tail ? `${head}\n\n[TAIL OF DOCUMENT]\n${tail}` : head;

        // ─── Dynamic LLM prompt ─────────────────────────────────────────────────
        // The LLM discovers ALL sections present in the document without any
        // hard-coded assumptions. Each section gets a ROLE tag so the frontend
        // and any future decoder knows exactly what the section represents.
        // Stored as _sections[] for easy decode later.
        const prompt = `You are a document parser. Extract a consulting case study PDF into structured JSON.

STRICT RULES:
1. Return VALID JSON only — no markdown, no prose, no explanation.
2. Do NOT invent sections that do not exist in the source document.
3. If a concept (e.g. financial data, problem statement) is absent from the document, omit it entirely — do not fabricate placeholder content.
4. Extract ALL distinct sections present in the document.
5. Normalize heading names to clean human-readable titles (e.g. "Company Overview", "Problem Statement", "Financial Data").
6. No duplicate headings — if two headings are near-identical, merge their content under one heading.
7. Preserve all factual details, numbers, and specifics from the source.

SECTION ROLES (assign exactly one per section):
  "context"  — background, company overview, market/industry context, introduction
  "problem"  — the challenge, problem posed, tasks or questions asked of the candidate
  "prompt"   — opening interview statement or candidate prompt (if explicitly present)
  "data"     — financial tables, KPIs, metrics, numerical data, exhibits
  "other"    — any other named section (appendix, guidelines, evaluation rubric, etc.)

QUESTION EXTRACTION:
  - In "problemQuestions", list ONLY the explicit questions/tasks the candidate must answer.
  - These are usually numbered (1. 2. 3.) or bulleted in the Problem/Questions section.
  - Extract them verbatim or lightly cleaned. Do NOT paraphrase or invent new ones.
  - If no explicit questions are found, return an empty array [].

INITIAL PROMPT:
  - Generate a concise (2–4 sentence) opening message a case interviewer would say to introduce this case.
  - Reference the case title and the top-level business problem.
  - If a "prompt" role section already exists in the document, use its content verbatim instead.

JSON SCHEMA — return EXACTLY this shape:
{
  "title": "<the case study title>",
  "industry": "<industry/domain e.g. E-commerce, FinTech, Healthcare, Logistics>",
  "sections": [
    {
      "heading": "<clean section name>",
      "content": "<full verbatim section content from the document>",
      "role": "context | problem | prompt | data | other"
    }
  ],
  "problemQuestions": ["<question 1>", "<question 2>"],
  "initialPrompt": "<opening message for the candidate>"
}

SOURCE DOCUMENT:
${extractionSource}`;

        for (let attempt = 0; attempt < groqClients.length; attempt += 1) {
            const client = groqClients[(attempt + (groqClients.length - 1)) % groqClients.length] || groqClients[0];
            try {
                const completion = await client.chat.completions.create({
                    messages: [{ role: 'user', content: prompt }],
                    model: 'llama-3.3-70b-versatile',
                    response_format: { type: 'json_object' }
                });

                const parsed = safeJson(completion.choices[0]?.message?.content, null);
                if (!parsed || typeof parsed !== 'object') throw new Error('Invalid parser JSON');

                // ── Build clean, deduped, role-tagged sections array ─────────
                // Stored as _sections[] so any downstream decoder (admin UI,
                // RAG indexer, future export tooling) can read the structure
                // without re-parsing.
                const llmSectionsRaw = Array.isArray(parsed.sections) ? parsed.sections : [];
                const seenHeadingNorms = new Set();
                const cleanSections = [];

                for (const item of llmSectionsRaw) {
                    const heading = String(item?.heading || '').trim();
                    const content = String(item?.content || '').trim();
                    const role = ['context', 'problem', 'prompt', 'data', 'other'].includes(String(item?.role || ''))
                        ? String(item.role)
                        : 'other';

                    if (!heading || content.length < 8) continue;

                    // Normalised key for dedup
                    const normKey = normalizeHeadingKey(heading);
                    if (seenHeadingNorms.has(normKey)) continue;
                    seenHeadingNorms.add(normKey);

                    cleanSections.push({ heading, content, role });
                }

                // ── Extract problem questions ────────────────────────────────
                const llmQuestions = Array.isArray(parsed.problemQuestions)
                    ? parsed.problemQuestions.map((q) => String(q || '').trim()).filter((q) => q.length > 8)
                    : [];

                // Fallback: mine questions from problem-role sections
                const problemQuestions = llmQuestions.length > 0
                    ? llmQuestions
                    : extractQuestionsFromSections(
                        Object.fromEntries(
                            cleanSections
                                .filter((s) => s.role === 'problem')
                                .map((s) => [s.heading, s.content])
                        ),
                        safeDraft.rawContent || rawPdfText || ''
                    );

                // ── Preserve numeric series from heuristic pass ──────────────
                const existingNumericSeries = (
                    safeDraft.parsedSections &&
                    typeof safeDraft.parsedSections._numericSeries === 'object'
                )
                    ? safeDraft.parsedSections._numericSeries
                    : {};

                // ── Resolve context, problemStatement, initialPrompt ─────────
                const contextSection = cleanSections.find((s) => s.role === 'context');
                const problemSection = cleanSections.find((s) => s.role === 'problem');
                const promptSection = cleanSections.find((s) => s.role === 'prompt');

                const resolvedContext = contextSection?.content || safeDraft.context || '';
                const resolvedProblemStatement = problemSection?.content || safeDraft.problemStatement || '';
                const resolvedInitialPrompt =
                    String(parsed.initialPrompt || '').trim() ||
                    promptSection?.content ||
                    safeDraft.initialPrompt ||
                    `Welcome to your case study: "${parsed.title || safeDraft.title || 'Case Study'}". Please begin by sharing your diagnostic hypothesis.`;

                return {
                    ...safeDraft,
                    title: String(parsed.title || '').trim() || safeDraft.title || 'Imported Case Study',
                    industry: String(parsed.industry || '').trim() || safeDraft.industry || inferIndustryFromText(rawPdfText || ''),
                    context: resolvedContext,
                    problemStatement: resolvedProblemStatement,
                    initialPrompt: resolvedInitialPrompt,
                    parsedSections: {
                        // ── _sections: primary structured store (role-tagged, decodable) ──
                        _sections: cleanSections,
                        // ── _problemQuestions: flat question list for interview engine ──
                        _problemQuestions: problemQuestions,
                        // ── _numericSeries: numeric time-series for chart rendering ──
                        _numericSeries: existingNumericSeries,
                        // ── _llmExtracted: audit flag ───────────────────────────────
                        _llmExtracted: true
                    }
                };
            } catch {
                getNextGroqClient();
            }
        }

        // LLM completely failed — return heuristic draft as-is with a flag
        // The heuristic parsedSections (flat object keys) will be used by
        // the frontend as a graceful fallback.
        return {
            ...safeDraft,
            parsedSections: {
                ...(safeDraft.parsedSections || {}),
                _llmExtracted: false
            }
        };
    };

    return {
        health: () => ({ status: 'OK', supabaseConnected: !!supabase, groqConnected: groqClients.length > 0 }),

        async createInvite({ email, candidateName, candidateEmail, caseStudyId }) {
            if (!candidateEmail || !caseStudyId) throw new ApiError(400, 'Candidate Email and Case Study ID required');
            const { data, error } = await supabase
                .from('assessment_invites')
                .insert([{
                    candidate_email: candidateEmail,
                    candidate_name: candidateName,
                    case_study_id: caseStudyId,
                    created_by: email,
                    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
                }])
                .select();
            if (error) throw new ApiError(500, error.message);
            return { success: true, invite: data[0] };
        },

        async getInvite(id) {
            const { data, error } = await supabase.from('assessment_invites').select('*, case_studies(*)').eq('id', id).single();
            if (error || !data) throw new ApiError(404, 'Invite not found');
            if (data.is_used) throw new ApiError(403, 'Invite already used');
            return { success: true, invite: data };
        },

        async startAssessment({ inviteId, email }) {
            const { data: invite } = await supabase.from('assessment_invites').select('case_study_id').eq('id', inviteId).single();
            const { data: caseStudy } = await supabase.from('case_studies').select('*').eq('id', invite.case_study_id).single();
            const { data: session, error } = await supabase
                .from('assessment_sessions')
                .insert([{ invite_id: inviteId, candidate_email: email, case_study_id: invite.case_study_id, chat_history: [{ role: 'assistant', content: caseStudy.initial_prompt }] }])
                .select()
                .single();
            if (error) throw new ApiError(500, error.message);
            await supabase.from('assessment_invites').update({ is_used: true }).eq('id', inviteId);
            return { success: true, session, caseStudy };
        },

        async startDemoAssessment({ caseStudyId, email }) {
            try {
                const { data: caseStudy, error: caseError } = await supabase.from('case_studies').select('*').eq('id', caseStudyId).single();
                if (caseError) throw caseError;
                if (!caseStudy) throw new Error('CASE_NOT_FOUND');

                const { data: session, error } = await supabase
                    .from('assessment_sessions')
                    .insert([{ candidate_email: email || 'demo-candidate@enterprise.ai', case_study_id: caseStudyId, chat_history: [{ role: 'assistant', content: caseStudy.initial_prompt }] }])
                    .select()
                    .single();
                if (error) throw error;
                return { success: true, session, caseStudy };
            } catch (error) {
                if (isMissingTableError(error.message) || error.message === 'CASE_NOT_FOUND') {
                    const sessionId = `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                    const session = {
                        id: sessionId,
                        candidate_email: email || 'demo-candidate@enterprise.ai',
                        case_study_id: DEMO_CASE_STUDY.id,
                        status: 'active',
                        strikes: 0,
                        current_step: 'diagnostic',
                        created_at: new Date().toISOString(),
                        chat_history: [{ role: 'assistant', content: DEMO_CASE_STUDY.initial_prompt }],
                        case_studies: DEMO_CASE_STUDY
                    };
                    inMemoryDemoSessions.set(sessionId, session);
                    return { success: true, session, caseStudy: DEMO_CASE_STUDY, fallbackMode: true };
                }
                throw new ApiError(500, error.message);
            }
        },

        async respondAssessment({ sessionId, userMessage, currentStep, activeQuestion, enforcePerQuestionAttempts = false }) {
            if (!sessionId || !userMessage) throw new ApiError(400, 'sessionId and userMessage are required');

            let session;
            let isFallback = false;
            if (inMemoryDemoSessions.has(sessionId)) {
                session = inMemoryDemoSessions.get(sessionId);
                isFallback = true;
            } else {
                const { data, error } = await supabase
                    .from('assessment_sessions')
                    .select('*, case_studies(*)')
                    .eq('id', sessionId)
                    .single();
                if (error || !data) throw new ApiError(404, 'Session not found');
                session = data;
            }

            if (session.status !== 'active') {
                throw new ApiError(403, 'Session is not active');
            }

            const history = Array.isArray(session.chat_history) ? [...session.chat_history] : [];
            history.push({ role: 'user', content: userMessage });

            const normalizedQuestion = normalizeQuestionContext(activeQuestion);
            const evaluated = await runAiEvaluation(
                session,
                history,
                userMessage,
                currentStep || session.current_step || 'diagnostic',
                normalizedQuestion
            );
            const rubricScores = normalizeRubric(evaluated.rubricScores || {});
            const totalRubricScore = Object.values(rubricScores).reduce((sum, n) => sum + n, 0);
            const questionPassed = totalRubricScore >= PASSING_MARKS;
            const questionStatus = questionPassed ? 'passed' : 'failed';

            const nextStrikes = evaluated.weakResponse ? Number(session.strikes || 0) + 1 : Number(session.strikes || 0);
            const disqualified = !enforcePerQuestionAttempts && (nextStrikes >= MAX_STRIKES || Boolean(evaluated.isDisqualified));
            const finalStatus = enforcePerQuestionAttempts
                ? 'active'
                : disqualified
                    ? 'disqualified'
                    : (evaluated.nextStep === 'complete' || currentStep === 'final_recommendation')
                        ? 'completed'
                        : 'active';

            const aiResponse = evaluated.response;
            history.push({ role: 'assistant', content: aiResponse });

            const updatedPayload = {
                status: finalStatus,
                strikes: nextStrikes,
                current_step: evaluated.nextStep || session.current_step,
                chat_history: history,
                completed_at: finalStatus !== 'active' ? new Date().toISOString() : null
            };

            if (isFallback) {
                session = {
                    ...session,
                    ...updatedPayload,
                    last_score_breakdown: {
                        ...rubricScores,
                        totalScore: totalRubricScore
                    }
                };
                inMemoryDemoSessions.set(sessionId, session);
            } else {
                const { data: updatedSession, error: updateError } = await supabase
                    .from('assessment_sessions')
                    .update(updatedPayload)
                    .eq('id', sessionId)
                    .select('*, case_studies(*)')
                    .single();
                if (updateError) throw new ApiError(500, updateError.message);
                session = updatedSession;

                const isPassing = totalRubricScore >= PASSING_MARKS;
                const { error: scoreError } = await supabase
                    .from('assessment_scores')
                    .upsert([{
                        session_id: sessionId,
                        total_score: totalRubricScore,
                        is_passing: isPassing
                    }], { onConflict: 'session_id' });
                if (scoreError) throw new ApiError(500, scoreError.message);
            }

            const attemptsLeft = Math.max(0, MAX_STRIKES - nextStrikes);
            const scoring = {
                passingMarks: PASSING_MARKS,
                failingMarks: FAILING_MARKS,
                band: toScoreBand(totalRubricScore)
            };

            return {
                success: true,
                aiResponse,
                status: finalStatus,
                strikes: nextStrikes,
                attemptsLeft,
                currentStep: evaluated.nextStep || session.current_step,
                scoreBreakdown: {
                    ...rubricScores,
                    totalScore: totalRubricScore
                },
                scoring,
                conversationalFeedback: buildConversationalFeedback(rubricScores, totalRubricScore, attemptsLeft, evaluated.nextStep || session.current_step),
                fallbackMode: isFallback,
                citations: Array.isArray(evaluated.citations) ? evaluated.citations : [],
                retrievalMetrics: evaluated.retrievalMetrics || null,
                questionResult: normalizedQuestion
                    ? {
                        questionId: normalizedQuestion.id,
                        questionIndex: normalizedQuestion.index,
                        questionText: normalizedQuestion.text,
                        status: questionStatus,
                        passed: questionPassed,
                        score: totalRubricScore
                    }
                    : null
            };
        },

        async listCaseStudies() {
            try {
                const { data, error } = await supabase
                    .from('case_studies')
                    .select('*')
                    .eq('is_active', true)
                    .order('created_at', { ascending: false });
                if (error) throw error;
                return { success: true, cases: data || [] };
            } catch (error) {
                if (isMissingTableError(error.message)) {
                    return { success: true, fallbackMode: true, cases: [DEMO_CASE_STUDY], warning: formatMissingTableMessage() };
                }
                throw new ApiError(500, error.message);
            }
        },

        async getCaseStudyBrief(id) {
            const { data: cs, error } = await supabase.from('case_studies').select('*').eq('id', id).single();
            if (error || !cs) throw new ApiError(404, 'Case study not found');

            const financialData = cs.financial_data || {};
            const parsedSections = (typeof cs.parsed_sections === 'object' && cs.parsed_sections) ? cs.parsed_sections : {};
            const numericSeries = parsedSections._numericSeries || {};
            const passingThreshold = clamp(Number(cs.threshold_passing_score ?? 0.6), 0, 1);

            const overviewKeys = Object.keys(parsedSections).filter((k) => /overview|background|company|introduction/i.test(k));
            const eventKeys = Object.keys(parsedSections).filter((k) => /event|context|trend|timeline/i.test(k));

            const companyOverview = overviewKeys.length > 0
                ? parsedSections[overviewKeys[0]].split('\n').filter((l) => l.trim().length > 15).slice(0, 3)
                : [cs.context ? cs.context.split('\n').find((l) => l.trim().length > 40) || 'Review the case document provided.' : 'Review the case document provided.'];

            const keyMetrics = Object.entries(financialData).slice(0, 8).map(([k, v]) => ({
                label: k.replace(/_/g, ' ').toUpperCase(),
                value: Array.isArray(v) ? `${v[0]} -> ${v[v.length - 1]}` : String(v)
            }));

            const businessEvents = eventKeys.length > 0
                ? parsedSections[eventKeys[0]].split('\n').filter((l) => l.trim().startsWith('-')).slice(0, 5)
                : ['Use the provided data trends and recent events to form hypotheses.'];

            const candidateSections = deriveCandidateSectionsFromParsed(parsedSections)
                .map((s) => ({
                    key: s.key,
                    label: s.heading,
                    role: s.role
                }));

            return {
                success: true,
                brief: {
                    companyOverview,
                    primaryQuestion: cs.initial_prompt || 'Diagnose the core business problem and propose a practical turnaround plan.',
                    problemStatement: cs.initial_prompt || 'Diagnose the core business problem and propose a practical turnaround plan.',
                    passingThreshold,
                    passingMarks: Math.round(passingThreshold * 100),
                    keyInsights: Object.values(numericSeries).slice(0, 5).map((s) => `${s.label}: ${s.values.join(', ')} (last: ${s.values[s.values.length - 1]})`),
                    keyMetrics,
                    businessEvents,
                    expectedOutput: [
                        'Identify the root causes of the central business problem.',
                        'Provide a structured, data-backed action plan.',
                        'Call out implementation risks and trade-offs.'
                    ],
                    sections: candidateSections,
                    difficulty: 'Medium',
                    estimatedMinutes: 30
                },
                aiGenerated: false
            };
        },

        async getCaseStudyBriefSection(id, sectionKey) {
            const section = String(sectionKey || '').toLowerCase().trim();
            if (!section) throw new ApiError(400, 'Invalid section key');

            const { data: cs, error } = await supabase.from('case_studies').select('id, parsed_sections, initial_prompt').eq('id', id).single();
            if (error || !cs) throw new ApiError(404, 'Case study not found');

            const parsedSections = (cs.parsed_sections && typeof cs.parsed_sections === 'object') ? cs.parsed_sections : {};

            if (section.startsWith('section_') || section.startsWith('flat_')) {
                const derived = deriveCandidateSectionsFromParsed(parsedSections);
                const found = derived.find((s) => String(s.key) === section);
                if (!found) throw new ApiError(404, 'Section not found');

                const bullets = found.content
                    .split('\n')
                    .map((l) => String(l || '').trim())
                    .filter((l) => /^[-•*]\s+/.test(l))
                    .map((l) => l.replace(/^[-•*]\s+/, '').trim())
                    .filter(Boolean);

                return {
                    success: true,
                    sectionKey: section,
                    section: {
                        title: found.heading,
                        heading: found.heading,
                        role: found.role,
                        content: found.content,
                        bullets
                    }
                };
            }

            const allowedSections = new Set(['snapshot', 'problem', 'objectives', 'events', 'insights']);
            if (!allowedSections.has(section)) {
                throw new ApiError(400, 'Invalid section key');
            }

            const briefRes = await this.getCaseStudyBrief(id);
            const brief = briefRes?.brief || {};

            if (section === 'snapshot') {
                const summary = [
                    `Primary ask: ${brief.primaryQuestion || 'Diagnose the core business problem.'}`,
                    `Passing benchmark: ${Number.isFinite(Number(brief.passingMarks)) ? Number(brief.passingMarks) : 60}/100 with structured, data-backed reasoning.`,
                    `This case should be solved using business context, event timeline, and metric trend interpretation together.`
                ];

                return {
                    success: true,
                    sectionKey: 'snapshot',
                    section: {
                        title: 'AI Snapshot',
                        headline: `${brief.primaryQuestion || 'Diagnose the business problem and propose an action plan.'}`,
                        contextLines: Array.isArray(brief.companyOverview) ? brief.companyOverview : [],
                        diagnosticSummary: summary,
                        pressureSignals: Array.isArray(brief.keyInsights) ? brief.keyInsights.slice(0, 5) : [],
                        positiveSignals: Array.isArray(brief.keyMetrics) ? brief.keyMetrics.slice(0, 4).map((m) => `${m.label}: ${m.value}`) : [],
                        businessEvents: Array.isArray(brief.businessEvents) ? brief.businessEvents : [],
                        coreQuestions: String(brief.problemStatement || brief.primaryQuestion || '')
                            .split('\n')
                            .map((q) => q.replace(/^\d+[).:\s]+/, '').trim())
                            .filter(Boolean)
                            .slice(0, 5),
                        expectedOutputs: Array.isArray(brief.expectedOutput) ? brief.expectedOutput : []
                    }
                };
            }

            if (section === 'problem') {
                return {
                    success: true,
                    sectionKey: 'problem',
                    section: {
                        title: 'Problem Statement',
                        introLines: String(brief.problemStatement || brief.primaryQuestion || '')
                            .split('\n')
                            .map((l) => l.trim())
                            .filter((l) => l.length > 0 && !/^\d+[).:]/.test(l))
                            .slice(0, 3),
                        questions: String(brief.problemStatement || brief.primaryQuestion || '')
                            .split('\n')
                            .map((l) => l.trim())
                            .filter((l) => /^\d+[).:]/.test(l))
                            .map((l) => l.replace(/^\d+[).:\s]+/, '').trim())
                            .slice(0, 6)
                    }
                };
            }

            if (section === 'objectives') {
                return {
                    success: true,
                    sectionKey: 'objectives',
                    section: {
                        title: 'Objectives and Deliverables',
                        objectives: Array.isArray(brief.expectedOutput) ? brief.expectedOutput : []
                    }
                };
            }

            if (section === 'events') {
                return {
                    success: true,
                    sectionKey: 'events',
                    section: {
                        title: 'Business Events and Context',
                        events: Array.isArray(brief.businessEvents) ? brief.businessEvents.map((e) => String(e).replace(/^[-—•]\s?/, '').trim()) : []
                    }
                };
            }

            return {
                success: true,
                sectionKey: 'insights',
                section: {
                    title: 'Key Insights',
                    insights: Array.isArray(brief.keyInsights) ? brief.keyInsights : []
                }
            };
        },

        async candidateDashboard(email) {
            if (!email) throw new ApiError(400, 'email query parameter is required');
            try {
                const { data: sessions, error } = await supabase
                    .from('assessment_sessions')
                    .select('id, status, created_at, case_study_id, case_studies(title), assessment_scores(total_score)')
                    .eq('candidate_email', email)
                    .order('created_at', { ascending: false });
                if (error) throw error;

                const rows = attachResultStatus(attachTotalScore(sessions || []));
                const totalAttempts = rows.length;
                const evaluatedRows = rows.filter((r) => r.result_status !== 'pending');
                const passCount = evaluatedRows.filter((r) => r.result_status === 'pass').length;
                const failCount = evaluatedRows.filter((r) => r.result_status === 'fail').length;
                const avgScoreValues = evaluatedRows.map((r) => Number(r.total_score || 0)).filter((n) => n > 0);
                const avgScore = avgScoreValues.length ? Number((avgScoreValues.reduce((s, n) => s + n, 0) / avgScoreValues.length).toFixed(1)) : 0;

                const { data: caseStudies, error: caseError } = await supabase.from('case_studies').select('id').eq('is_active', true);
                if (caseError) throw caseError;

                return {
                    success: true,
                    dashboard: {
                        totalAttempts,
                        passCount,
                        failCount,
                        avgScore,
                        activeCaseStudies: (caseStudies || []).length,
                        recent: evaluatedRows.slice(0, 10)
                    }
                };
            } catch (error) {
                if (isMissingTableError(error.message)) {
                    const fallbackRows = Array.from(inMemoryDemoSessions.values())
                        .filter((s) => s.candidate_email === email)
                        .map((s) => ({
                            id: s.id,
                            status: s.status,
                            created_at: s.created_at || new Date().toISOString(),
                            case_studies: { title: DEMO_CASE_STUDY.title },
                            assessment_scores: s.last_score_breakdown ? [{ total_score: s.last_score_breakdown.totalScore }] : [],
                            total_score: Number(s?.last_score_breakdown?.totalScore || 0)
                        }));
                    const normalizedFallback = attachResultStatus(fallbackRows);
                    const evaluatedFallback = normalizedFallback.filter((r) => r.result_status !== 'pending');
                    const avgValues = evaluatedFallback.map((r) => Number(r.total_score || 0)).filter((n) => n > 0);
                    const avgScore = avgValues.length ? Number((avgValues.reduce((a, b) => a + b, 0) / avgValues.length).toFixed(1)) : 0;
                    return {
                        success: true,
                        fallbackMode: true,
                        dashboard: {
                            totalAttempts: normalizedFallback.length,
                            passCount: evaluatedFallback.filter((r) => r.result_status === 'pass').length,
                            failCount: evaluatedFallback.filter((r) => r.result_status === 'fail').length,
                            avgScore,
                            activeCaseStudies: 1,
                            recent: evaluatedFallback.slice(0, 10)
                        }
                    };
                }
                throw new ApiError(500, error.message);
            }
        },

        async candidateStartCase(caseStudyId, email) {
            if (!email) throw new ApiError(400, 'email is required');
            try {
                const { data: caseStudy, error: caseError } = await supabase.from('case_studies').select('*').eq('id', caseStudyId).eq('is_active', true).single();
                if (caseError) throw caseError;
                if (!caseStudy) throw new ApiError(404, 'Case study not found');

                const { data: session, error } = await supabase
                    .from('assessment_sessions')
                    .insert([{ candidate_email: email, case_study_id: caseStudyId, chat_history: [{ role: 'assistant', content: caseStudy.initial_prompt }], status: 'active', current_step: 'diagnostic' }])
                    .select()
                    .single();
                if (error) throw error;
                return { success: true, session, caseStudy };
            } catch (error) {
                if (isMissingTableError(error.message)) {
                    const sessionId = `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                    const session = {
                        id: sessionId,
                        candidate_email: email,
                        case_study_id: DEMO_CASE_STUDY.id,
                        status: 'active',
                        strikes: 0,
                        current_step: 'diagnostic',
                        created_at: new Date().toISOString(),
                        chat_history: [{ role: 'assistant', content: DEMO_CASE_STUDY.initial_prompt }],
                        case_studies: DEMO_CASE_STUDY
                    };
                    inMemoryDemoSessions.set(sessionId, session);
                    return { success: true, session, caseStudy: DEMO_CASE_STUDY, fallbackMode: true };
                }
                throw new ApiError(500, error.message);
            }
        },

        async candidateResults(email) {
            if (!email) throw new ApiError(400, 'email query parameter is required');
            try {
                const { data, error } = await supabase
                    .from('assessment_sessions')
                    .select('id, created_at, completed_at, status, strikes, current_step, chat_history, case_studies(title), assessment_scores(*)')
                    .eq('candidate_email', email)
                    .order('created_at', { ascending: false });
                if (error) throw error;
                return { success: true, results: attachResultStatus(attachTotalScore(data || [])) };
            } catch (error) {
                if (isMissingTableError(error.message)) {
                    const fallback = Array.from(inMemoryDemoSessions.values())
                        .filter((s) => s.candidate_email === email)
                        .map((s) => ({
                            id: s.id,
                            created_at: s.created_at || new Date().toISOString(),
                            completed_at: s.completed_at || null,
                            status: s.status,
                            strikes: s.strikes || 0,
                            current_step: s.current_step || 'diagnostic',
                            chat_history: s.chat_history || [],
                            case_studies: { title: DEMO_CASE_STUDY.title },
                            assessment_scores: s.last_score_breakdown ? [{ total_score: s.last_score_breakdown.totalScore }] : [],
                            total_score: Number(s?.last_score_breakdown?.totalScore || 0)
                        }));
                    return { success: true, fallbackMode: true, results: attachResultStatus(fallback) };
                }
                throw new ApiError(500, error.message);
            }
        },

        async candidateResultDetail(sessionId, email) {
            if (!email) throw new ApiError(400, 'email query parameter is required');
            if (inMemoryDemoSessions.has(sessionId)) {
                const s = inMemoryDemoSessions.get(sessionId);
                if (s.candidate_email !== email) throw new ApiError(403, 'Forbidden');
                return { success: true, detail: { ...s, assessment_scores: s.last_score_breakdown ? [{ total_score: s.last_score_breakdown.totalScore }] : [] }, fallbackMode: true };
            }
            const { data, error } = await supabase
                .from('assessment_sessions')
                .select('*, case_studies(*), assessment_scores(*)')
                .eq('id', sessionId)
                .eq('candidate_email', email)
                .single();
            if (error) throw new ApiError(500, error.message);
            if (!data) throw new ApiError(404, 'Session not found');
            return { success: true, detail: data };
        },

        async importCaseStudyPdf(file) {
            if (!file) throw new ApiError(400, 'PDF file is required (field name: pdf).');

            // ── Resolve a filesystem path for the PyMuPDF subprocess ──────────
            // The main upload route now uses disk storage, so file.path is the
            // normal case. If an old memory-storage caller sends file.buffer,
            // we write it to a temp file so the subprocess can read it.
            let filePath;
            let tempCreated = false;

            if (file.path) {
                filePath = file.path;
            } else if (file.buffer) {
                filePath = path.join(os.tmpdir(), `pdf_import_${Date.now()}_${process.pid}.pdf`);
                fs.writeFileSync(filePath, file.buffer);
                tempCreated = true;
            } else {
                throw new ApiError(400, 'PDF file is required (field name: pdf).');
            }

            try {
                // ── PyMuPDF bold-text section extraction (no LLM) ────────────
                const pymupdfResult = await parsePDF(filePath);

                // ── Map PyMuPDF sections → _sections[] ───────────────────────
                // PyMuPDF type  →  role expected by AdminEvaluation
                const typeToRole = {
                    DATA:     'data',
                    CONTEXT:  'context',
                    PROBLEM:  'problem',
                    INTERNAL: 'other'
                };

                const seenHeadings = new Set();
                const cleanSections = [];

                for (const s of (pymupdfResult.sections || [])) {
                    const heading = String(s.title || '').trim();
                    if (!heading) continue;

                    // Dedup by normalised heading key
                    const normKey = normalizeHeadingKey(heading);
                    if (seenHeadings.has(normKey)) continue;
                    seenHeadings.add(normKey);

                    // Flatten content[] (strings + { subheading } objects) → single string
                    const contentLines = (Array.isArray(s.content) ? s.content : [])
                        .map((item) => {
                            if (typeof item === 'string') return item;
                            if (item && typeof item.subheading === 'string') return `\n${item.subheading}`;
                            return '';
                        })
                        .filter(Boolean);

                    const content = contentLines.join('\n').trim();
                    if (!content) continue;

                    cleanSections.push({
                        heading,
                        content,
                        role: typeToRole[s.type] || 'other'
                    });
                }

                // ── Derive auxiliary draft fields from parsed content ─────────
                const allText = [
                    pymupdfResult.title || '',
                    ...cleanSections.map((s) => `${s.heading}\n${s.content}`)
                ].join('\n\n');

                const title    = String(pymupdfResult.title || '').trim() || 'Imported Case Study';
                const industry = inferIndustryFromText(allText);

                // Numeric time-series (for Data & Metrics panel)
                const numericSeries  = extractAllNumericSeries(allText);
                const financialData  = {};
                for (const [key, seriesObj] of Object.entries(numericSeries)) {
                    financialData[key] = seriesObj.values;
                }

                // Context and problem text
                const contextSection  = cleanSections.find((s) => s.role === 'context');
                const problemSection  = cleanSections.find((s) => s.role === 'problem');
                const context         = contextSection?.content || cleanSections[0]?.content || '';
                const problemStatement = problemSection?.content || '';

                // Problem questions
                const sectionsForQ   = Object.fromEntries(
                    cleanSections.filter((s) => s.role === 'problem').map((s) => [s.heading, s.content])
                );
                const problemQuestions = extractQuestionsFromSections(sectionsForQ, allText);

                // Opening interviewer prompt
                const initialPrompt = problemQuestions.length > 0
                    ? `Welcome to your ${industry} case study: "${title}".\n\nHere are your problem questions:\n\n${problemQuestions.map((q, i) => `${i + 1}) ${q}`).join('\n')}\n\nPlease begin with your diagnostic hypothesis.`
                    : `Welcome to your ${industry} case study: "${title}". Please begin by sharing your initial diagnostic hypothesis — what are the top 2–3 root causes of the central business problem?`;

                const draft = {
                    title,
                    industry,
                    context,
                    problemStatement,
                    initialPrompt,
                    thresholdPassingScore: 0.6,
                    financialData,
                    parsedSections: {
                        _sections:        cleanSections,
                        _problemQuestions: problemQuestions,
                        _numericSeries:   numericSeries,
                        _llmExtracted:    false
                    },
                    rawContent: allText
                };

                return {
                    success: true,
                    draft,
                    meta: {
                        fileName:            file.originalname || 'uploaded.pdf',
                        pages:               null,
                        textLength:          allText.length,
                        sectionsDiscovered:  cleanSections.length,
                        numericSeriesFound:  Object.keys(financialData).length,
                        boldHeadingsDetected: cleanSections.length,
                        llmExtracted:        false,
                        llmSectionsCount:    cleanSections.length
                    }
                };
            } finally {
                if (tempCreated) { try { fs.unlinkSync(filePath); } catch (_) {} }
            }
        },

        async createCaseStudy(payload) {
            const {
                title,
                industry,
                context,
                problemStatement,
                initialPrompt,
                thresholdPassingScore,
                financialData,
                rawContent,
                parsedSections
            } = payload || {};

            if (!title || !initialPrompt) throw new ApiError(400, 'title and initialPrompt are required');

            const parsedThreshold = Number(thresholdPassingScore);
            if (!Number.isFinite(parsedThreshold)) {
                throw new ApiError(400, 'PASSING THRESHOLD must be a valid number between 0.0 and 1.0');
            }
            const normalizedThreshold = clamp(parsedThreshold, 0, 1);
            const existingParsedSections = (parsedSections && typeof parsedSections === 'object') ? parsedSections : {};
            const metadata = {
                ...(existingParsedSections._meta && typeof existingParsedSections._meta === 'object' ? existingParsedSections._meta : {}),
                passingThreshold: normalizedThreshold,
                passingMarks: Math.round(normalizedThreshold * 100)
            };

            const insertPayload = {
                title,
                industry: industry || inferIndustryFromText(`${title}\n${context || ''}`),
                context: context || problemStatement || '',
                initial_prompt: initialPrompt,
                threshold_passing_score: normalizedThreshold,
                financial_data: financialData || {},
                raw_content: rawContent || null,
                parsed_sections: {
                    ...existingParsedSections,
                    _meta: metadata
                }
            };

            const { data, error } = await supabase
                .from('case_studies')
                .insert([insertPayload])
                .select()
                .single();
            if (error) throw new ApiError(500, error.message);
            triggerPythonRagIndex(data);
            return { success: true, caseStudy: data };
        },

        async updateCaseStudy(caseStudyId, payload) {
            if (!caseStudyId) throw new ApiError(400, 'caseStudyId is required');

            const { data: existing, error: existingError } = await supabase
                .from('case_studies')
                .select('*')
                .eq('id', caseStudyId)
                .single();
            if (existingError || !existing) throw new ApiError(404, 'Case study not found');

            const {
                title,
                industry,
                context,
                problemStatement,
                initialPrompt,
                thresholdPassingScore,
                financialData,
                rawContent,
                parsedSections,
                isActive
            } = payload || {};

            const nextParsedSections = (parsedSections && typeof parsedSections === 'object')
                ? parsedSections
                : ((existing.parsed_sections && typeof existing.parsed_sections === 'object') ? existing.parsed_sections : {});

            const updatePayload = {};
            if (typeof title === 'string' && title.trim()) updatePayload.title = title.trim();
            if (typeof industry === 'string') updatePayload.industry = industry;
            if (typeof context === 'string') updatePayload.context = context;
            if (typeof problemStatement === 'string' && !context) updatePayload.context = problemStatement;
            if (typeof initialPrompt === 'string' && initialPrompt.trim()) updatePayload.initial_prompt = initialPrompt;
            if (financialData && typeof financialData === 'object') updatePayload.financial_data = financialData;
            if (typeof rawContent === 'string') updatePayload.raw_content = rawContent;
            if (typeof isActive === 'boolean') updatePayload.is_active = isActive;

            if (thresholdPassingScore !== undefined) {
                const parsedThreshold = Number(thresholdPassingScore);
                if (!Number.isFinite(parsedThreshold)) {
                    throw new ApiError(400, 'PASSING THRESHOLD must be a valid number between 0.0 and 1.0');
                }
                const normalizedThreshold = clamp(parsedThreshold, 0, 1);
                updatePayload.threshold_passing_score = normalizedThreshold;

                const metadata = {
                    ...(nextParsedSections._meta && typeof nextParsedSections._meta === 'object' ? nextParsedSections._meta : {}),
                    passingThreshold: normalizedThreshold,
                    passingMarks: Math.round(normalizedThreshold * 100)
                };
                updatePayload.parsed_sections = {
                    ...nextParsedSections,
                    _meta: metadata
                };
            } else if (parsedSections && typeof parsedSections === 'object') {
                updatePayload.parsed_sections = parsedSections;
            }

            const { data, error } = await supabase
                .from('case_studies')
                .update(updatePayload)
                .eq('id', caseStudyId)
                .select()
                .single();
            if (error) throw new ApiError(500, error.message);
            triggerPythonRagIndex(data);
            return { success: true, caseStudy: data };
        },

        async deleteCaseStudy(caseStudyId) {
            if (!caseStudyId) throw new ApiError(400, 'caseStudyId is required');

            const { data, error } = await supabase
                .from('case_studies')
                .delete()
                .eq('id', caseStudyId)
                .select('id, title')
                .single();

            if (!error) {
                return { success: true, deleted: data, softDeleted: false };
            }

            const errMsg = String(error.message || '').toLowerCase();
            const blockedByReferences =
                errMsg.includes('foreign key') ||
                errMsg.includes('violates') ||
                errMsg.includes('constraint');

            if (!blockedByReferences) {
                throw new ApiError(500, error.message);
            }

            const { data: archived, error: archiveError } = await supabase
                .from('case_studies')
                .update({ is_active: false })
                .eq('id', caseStudyId)
                .select('id, title, is_active')
                .single();

            if (archiveError) throw new ApiError(500, archiveError.message);

            return {
                success: true,
                deleted: archived,
                softDeleted: true,
                message: 'Case study had existing attempts, so it was deactivated and removed from active use.'
            };
        },

        async assessResults() {
            const { data, error } = await supabase
                .from('assessment_sessions')
                .select('*, case_studies(title), assessment_scores(*)')
                .order('created_at', { ascending: false });
            if (error) throw new ApiError(500, error.message);
            return { success: true, results: data };
        },

        async adminAnalytics() {
            const { data: sessions, error: sessionError } = await supabase.from('assessment_sessions').select('id, status, case_study_id');
            if (sessionError) throw new ApiError(500, sessionError.message);
            const { data: scores, error: scoreError } = await supabase.from('assessment_scores').select('session_id, total_score');
            if (scoreError) throw new ApiError(500, scoreError.message);
            const { data: caseStudies, error: caseError } = await supabase.from('case_studies').select('id, title');
            if (caseError) throw new ApiError(500, caseError.message);

            const totalCandidates = sessions.length;
            const disqualifiedCount = sessions.filter((s) => s.status === 'disqualified').length;
            const completedCount = sessions.filter((s) => s.status === 'completed').length;
            const activeSessions = sessions.filter((s) => s.status === 'active').length;
            const avgScore = scores.length ? Number((scores.reduce((sum, row) => sum + Number(row.total_score || 0), 0) / scores.length).toFixed(1)) : 0;
            const disqualificationRate = totalCandidates ? Number(((disqualifiedCount / totalCandidates) * 100).toFixed(1)) : 0;

            const caseMap = Object.fromEntries(caseStudies.map((c) => [c.id, c.title]));
            const perCase = {};
            for (const s of sessions) {
                if (!s.case_study_id) continue;
                if (!perCase[s.case_study_id]) perCase[s.case_study_id] = { id: s.case_study_id, title: caseMap[s.case_study_id] || 'Unknown', attempts: 0, disqualified: 0 };
                perCase[s.case_study_id].attempts += 1;
                if (s.status === 'disqualified') perCase[s.case_study_id].disqualified += 1;
            }

            const casePerformance = Object.values(perCase).map((row) => ({
                ...row,
                disqualificationRate: row.attempts ? Number(((row.disqualified / row.attempts) * 100).toFixed(1)) : 0
            }));

            return {
                success: true,
                analytics: {
                    totalCandidates,
                    completedCount,
                    disqualifiedCount,
                    activeSessions,
                    avgScore,
                    disqualificationRate,
                    casePerformance
                }
            };
        },

        async adminDashboard() {
            const [analyticsRes, recentRes, casesRes] = await Promise.all([
                supabase.from('assessment_sessions').select('id, status, case_study_id'),
                supabase.from('assessment_sessions').select('id, candidate_email, status, created_at, case_study_id, case_studies(title)').order('created_at', { ascending: false }).limit(10),
                supabase.from('case_studies').select('id, title, is_active').order('created_at', { ascending: false })
            ]);

            if (analyticsRes.error) throw new ApiError(500, analyticsRes.error.message);
            if (recentRes.error) throw new ApiError(500, recentRes.error.message);
            if (casesRes.error) throw new ApiError(500, casesRes.error.message);

            const sessions = analyticsRes.data || [];
            const totalCandidates = sessions.length;
            const completedCount = sessions.filter((s) => s.status === 'completed').length;
            const disqualifiedCount = sessions.filter((s) => s.status === 'disqualified').length;
            const activeSessions = sessions.filter((s) => s.status === 'active').length;

            const { data: scores, error: scoreError } = await supabase.from('assessment_scores').select('total_score');
            if (scoreError) throw new ApiError(500, scoreError.message);
            const avgScore = scores.length ? Number((scores.reduce((sum, row) => sum + Number(row.total_score || 0), 0) / scores.length).toFixed(1)) : 0;

            return {
                success: true,
                dashboard: {
                    totalCandidates,
                    completedCount,
                    disqualifiedCount,
                    activeSessions,
                    avgScore,
                    recentAttempts: recentRes.data || [],
                    caseStudies: casesRes.data || []
                }
            };
        },

        async adminCaseStudies() {
            const { data: cases, error: caseError } = await supabase.from('case_studies').select('*').order('created_at', { ascending: false });
            if (caseError) throw new ApiError(500, caseError.message);
            const { data: sessions, error: sessionError } = await supabase.from('assessment_sessions').select('id, case_study_id');
            if (sessionError) throw new ApiError(500, sessionError.message);

            const attemptsByCase = {};
            for (const s of sessions) {
                attemptsByCase[s.case_study_id] = (attemptsByCase[s.case_study_id] || 0) + 1;
            }

            const enhancedCases = (cases || []).map((c) => ({ ...c, attempts: attemptsByCase[c.id] || 0 }));
            return { success: true, caseStudies: enhancedCases };
        },

        async adminCaseStudyDetail(caseStudyId) {
            if (!caseStudyId) throw new ApiError(400, 'caseStudyId is required');

            const { data: caseStudy, error: caseError } = await supabase
                .from('case_studies')
                .select('*')
                .eq('id', caseStudyId)
                .single();
            if (caseError || !caseStudy) throw new ApiError(404, 'Case study not found');

            const { data: sessions, error: sessionError } = await supabase
                .from('assessment_sessions')
                .select('id, candidate_email, status, strikes, current_step, created_at, completed_at, chat_history, assessment_scores(*)')
                .eq('case_study_id', caseStudyId)
                .order('created_at', { ascending: false });
            if (sessionError) throw new ApiError(500, sessionError.message);

            const submissions = attachResultStatus(attachTotalScore(sessions || []));

            return {
                success: true,
                detail: {
                    caseStudy,
                    submissions,
                    submissionCount: submissions.length
                }
            };
        },

        async adminResults() {
            const { data, error } = await supabase
                .from('assessment_sessions')
                .select('id, candidate_email, status, strikes, current_step, created_at, completed_at, chat_history, case_studies(title), assessment_scores(*)')
                .order('created_at', { ascending: false });
            if (error) throw new ApiError(500, error.message);
            return { success: true, results: attachResultStatus(attachTotalScore(data || [])) };
        },

        async adminResultDetail(sessionId) {
            if (inMemoryDemoSessions.has(sessionId)) {
                const demoSession = inMemoryDemoSessions.get(sessionId);
                return { success: true, detail: { ...demoSession, assessment_scores: [] }, fallbackMode: true };
            }
            const { data, error } = await supabase
                .from('assessment_sessions')
                .select('*, case_studies(*), assessment_scores(*)')
                .eq('id', sessionId)
                .single();
            if (error) throw new ApiError(500, error.message);
            if (!data) throw new ApiError(404, 'Session not found');
            return { success: true, detail: data };
        },

        mapError(error) {
            if (error instanceof ApiError) return error;
            if (isMissingTableError(error?.message || '')) {
                return new ApiError(500, formatMissingTableMessage());
            }
            return new ApiError(500, error?.message || 'Internal server error');
        }
    };
};

module.exports = {
    createApiService,
    ApiError,
    isMissingTableError,
    formatMissingTableMessage,
    DEMO_CASE_STUDY
};
