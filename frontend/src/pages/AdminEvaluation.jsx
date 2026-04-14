import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './AdminEvaluation.css';

const API_BASE = 'http://localhost:5000/api';

// ─── Utility: render a block of text as structured lines ──────────────────
const StructuredText = ({ text, maxLines = 0 }) => {
    if (!text) return <span className="builder-empty">Not extracted</span>;
    const lines = String(text).split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const shown = maxLines > 0 ? lines.slice(0, maxLines) : lines;
    return (
        <div className="structured-text">
            {shown.map((line, i) => {
                if (/^\d+[).:]/.test(line)) {
                    return <div key={i} className="st-numbered">{line}</div>;
                }
                if (/^[-•]/.test(line)) {
                    return <div key={i} className="st-bullet">{line.replace(/^[-•]\s?/, '')}</div>;
                }
                if (line === line.toUpperCase() && line.length < 60 && /[A-Z]{3}/.test(line)) {
                    return <div key={i} className="st-heading">{line}</div>;
                }
                return <div key={i} className="st-para">{line}</div>;
            })}
        </div>
    );
};

// ─── Metric Preview Row ────────────────────────────────────────────────────
const MetricRow = ({ name, values }) => {
    const nums = (Array.isArray(values) ? values : []).map(Number).filter(Number.isFinite);
    if (nums.length === 0) return null;
    const first = nums[0];
    const last = nums[nums.length - 1];
    const trend = last > first ? 'up' : last < first ? 'down' : 'flat';
    const maxAbs = Math.max(...nums.map(Math.abs), 1);
    return (
        <div className="metric-preview-row">
            <div className="metric-preview-name">{name.replace(/_/g, ' ').toUpperCase()}</div>
            <div className="metric-preview-bars">
                {nums.map((v, i) => (
                    <div key={i} className="metric-bar-col" title={v}>
                        <div
                            className={`metric-bar-fill ${v < 0 ? 'neg' : ''}`}
                            style={{ height: `${Math.max(10, (Math.abs(v) / maxAbs) * 100)}%` }}
                        />
                    </div>
                ))}
            </div>
            <div className="metric-preview-vals">
                <span>{first}</span>
                <span className={`trend-arrow trend-${trend}`}>
                    {trend === 'up' ? '▲' : trend === 'down' ? '▼' : '─'} {last}
                </span>
            </div>
        </div>
    );
};

// ─── Main Component ────────────────────────────────────────────────────────
const AdminEvaluation = () => {
    const [savingCase, setSavingCase] = useState(false);
    const [importingPdf, setImportingPdf] = useState(false);
    const [pdfDraftMeta, setPdfDraftMeta] = useState(null);
    const [pdfDraft, setPdfDraft] = useState(null);   // full parsed draft from backend
    const [caseStudies, setCaseStudies] = useState([]);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [selectedCaseId, setSelectedCaseId] = useState(null);
    const [caseDetail, setCaseDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [savingEdit, setSavingEdit] = useState(false);
    const [deletingCase, setDeletingCase] = useState(false);
    const [editForm, setEditForm] = useState({
        title: '',
        industry: '',
        context: '',
        initialPrompt: '',
        thresholdPassingScore: 0.6,
        isActive: true
    });

    // Editable fields (admin can tweak after PDF import)
    const [caseForm, setCaseForm] = useState({
        title: '',
        industry: '',
        problemStatement: '',
        initialPrompt: '',
        thresholdPassingScore: 0.6,
    });

    const fetchCases = async () => {
        try {
            const res = await axios.get(`${API_BASE}/admin/case-studies`);
            setCaseStudies(res.data?.caseStudies || []);
        } catch { setCaseStudies([]); }
    };

    useEffect(() => { fetchCases(); }, []);

    const fetchCaseDetail = async (caseId) => {
        if (!caseId) return;
        setDetailLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/admin/case-studies/${caseId}/detail`);
            const detail = res.data?.detail || null;
            setCaseDetail(detail);
            if (detail?.caseStudy) {
                setEditForm({
                    title: detail.caseStudy.title || '',
                    industry: detail.caseStudy.industry || '',
                    context: detail.caseStudy.context || '',
                    initialPrompt: detail.caseStudy.initial_prompt || '',
                    thresholdPassingScore: Number(detail.caseStudy.threshold_passing_score ?? 0.6),
                    isActive: Boolean(detail.caseStudy.is_active)
                });
            }
        } catch (err) {
            setCaseDetail(null);
            setSaveError(err.response?.data?.error || 'Failed to load case details');
        } finally {
            setDetailLoading(false);
        }
    };

    const openCaseDrawer = async (caseId) => {
        setDrawerOpen(true);
        setSelectedCaseId(caseId);
        setEditMode(false);
        await fetchCaseDetail(caseId);
    };

    const closeCaseDrawer = () => {
        setDrawerOpen(false);
        setSelectedCaseId(null);
        setCaseDetail(null);
        setEditMode(false);
    };

    const handleQuickEditClick = async (e, row) => {
        e.stopPropagation();
        await openCaseDrawer(row.id);
        setEditMode(true);
    };

    const handleSaveEdit = async () => {
        if (!selectedCaseId) return;
        setSavingEdit(true);
        setSaveError('');
        try {
            const parsedThreshold = Number(editForm.thresholdPassingScore);
            if (!Number.isFinite(parsedThreshold) || parsedThreshold < 0 || parsedThreshold > 1) {
                throw new Error('PASSING THRESHOLD must be between 0.0 and 1.0');
            }

            const payload = {
                title: editForm.title,
                industry: editForm.industry,
                context: editForm.context,
                initialPrompt: editForm.initialPrompt,
                thresholdPassingScore: parsedThreshold,
                isActive: Boolean(editForm.isActive)
            };

            const res = await axios.put(`${API_BASE}/case-studies/${selectedCaseId}`, payload);
            if (res.data.success) {
                await fetchCases();
                await fetchCaseDetail(selectedCaseId);
                setEditMode(false);
            }
        } catch (err) {
            setSaveError(err.response?.data?.error || err.message || 'Failed to update case study');
        } finally {
            setSavingEdit(false);
        }
    };

    const handleDeleteCase = async (caseId) => {
        if (!caseId) return;
        if (!window.confirm('Delete this case study permanently?')) return;
        setDeletingCase(true);
        setSaveError('');
        try {
            const res = await axios.delete(`${API_BASE}/case-studies/${caseId}`);
            if (res.data.success) {
                await fetchCases();
                if (selectedCaseId === caseId) closeCaseDrawer();
            }
        } catch (err) {
            setSaveError(err.response?.data?.error || 'Failed to delete case study');
        } finally {
            setDeletingCase(false);
        }
    };

    const handleImportPdf = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.name.toLowerCase().endsWith('.pdf')) {
            alert('Please upload a PDF file.');
            return;
        }
        setImportingPdf(true);
        setSaveSuccess(false);
        setSaveError('');
        try {
            const formData = new FormData();
            formData.append('pdf', file);
            const res = await axios.post(`${API_BASE}/case-studies/import-pdf`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (res.data.success) {
                const draft = res.data.draft;
                setPdfDraft(draft);
                setPdfDraftMeta(res.data.meta || null);
                setCaseForm({
                    title: draft.title || '',
                    industry: draft.industry || '',
                    problemStatement: draft.problemStatement || '',
                    initialPrompt: draft.initialPrompt || '',
                    thresholdPassingScore: draft.thresholdPassingScore ?? 0.6,
                });
            }
        } catch (err) {
            setSaveError(err.response?.data?.error || 'Failed to import PDF.');
        } finally {
            setImportingPdf(false);
            e.target.value = '';
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setSavingCase(true);
        setSaveSuccess(false);
        setSaveError('');
        try {
            const parsedThreshold = Number(caseForm.thresholdPassingScore);
            if (!Number.isFinite(parsedThreshold) || parsedThreshold < 0 || parsedThreshold > 1) {
                throw new Error('PASSING THRESHOLD must be between 0.0 and 1.0');
            }
            const payload = {
                title: caseForm.title,
                industry: caseForm.industry,
                context: pdfDraft?.context || caseForm.problemStatement,
                problemStatement: caseForm.problemStatement,
                initialPrompt: caseForm.initialPrompt,
                thresholdPassingScore: parsedThreshold,
                financialData: pdfDraft?.financialData || {},
                rawContent: pdfDraft?.rawContent || null,
                parsedSections: pdfDraft?.parsedSections || {},
            };
            const res = await axios.post(`${API_BASE}/case-studies`, payload);
            if (res.data.success) {
                setSaveSuccess(true);
                setPdfDraft(null);
                setPdfDraftMeta(null);
                setCaseForm({ title: '', industry: '', problemStatement: '', initialPrompt: '', thresholdPassingScore: 0.6 });
                await fetchCases();
            }
        } catch (err) {
            setSaveError(err.response?.data?.error || 'Failed to create case study.');
        } finally {
            setSavingCase(false);
        }
    };

    const field = (key) => ({
        value: caseForm[key] ?? '',
        onChange: (e) => setCaseForm(prev => ({ ...prev, [key]: e.target.value }))
    });

    // Derive sections to preview from pdfDraft
    const previewSections = pdfDraft
        ? Object.entries(pdfDraft.parsedSections || {})
            .filter(([k]) => k !== '_numericSeries')
            .slice(0, 10)
        : [];

    const metricEntries = pdfDraft
        ? Object.entries(pdfDraft.financialData || {}).filter(([, v]) => Array.isArray(v) && v.length > 0)
        : [];

    return (
        <div className="admin-eval-page">
            <div className="admin-eval-layout">

                {/* ── PDF IMPORT ZONE ─────────────────────────────────── */}
                <div className="admin-card import-zone">
                    <div className="admin-card-title">IMPORT CASE STUDY FROM PDF</div>
                    <p className="admin-hint">
                        Upload a formatted case study PDF. The system automatically extracts all sections,
                        metrics, problem statement, and data series for preview and editing.
                    </p>
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
                            <span className="file-drop-text">
                                {importingPdf ? 'Parsing PDF...' : 'Click to select PDF or drag and drop'}
                            </span>
                        </label>
                        {pdfDraftMeta && !importingPdf && (
                            <div className="import-meta-strip">
                                <span className="meta-chip">{pdfDraftMeta.fileName}</span>
                                <span className="meta-chip">{pdfDraftMeta.pages || '?'} pages</span>
                                <span className="meta-chip">{pdfDraftMeta.sectionsDiscovered || 0} sections found</span>
                                <span className="meta-chip">{pdfDraftMeta.numericSeriesFound || 0} data series</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── PARSED CONTENT PREVIEW (shows after PDF import) ─── */}
                {pdfDraft && (
                    <div className="admin-card preview-card">
                        <div className="admin-card-title">EXTRACTED CASE CONTENT PREVIEW</div>
                        <p className="admin-hint">This is how the system read your PDF. Review all sections below before publishing.</p>

                        {/* Identity row */}
                        <div className="preview-identity-row">
                            <div className="preview-identity-field">
                                <span className="preview-field-label">TITLE</span>
                                <span className="preview-field-value">{pdfDraft.title || '—'}</span>
                            </div>
                            <div className="preview-identity-field">
                                <span className="preview-field-label">INDUSTRY</span>
                                <span className="preview-field-value">{pdfDraft.industry || '—'}</span>
                            </div>
                            <div className="preview-identity-field">
                                <span className="preview-field-label">PASSING THRESHOLD</span>
                                <span className="preview-field-value">{(Math.max(0, Math.min(1, Number(caseForm.thresholdPassingScore ?? 0.6))) * 100).toFixed(0)}%</span>
                            </div>
                        </div>

                        {/* Problem Statement preview */}
                        <div className="preview-section">
                            <div className="preview-section-label">PROBLEM STATEMENT</div>
                            <div className="preview-section-body">
                                <StructuredText text={pdfDraft.problemStatement} />
                            </div>
                        </div>

                        {/* Opening Question preview */}
                        <div className="preview-section">
                            <div className="preview-section-label">CANDIDATE OPENING QUESTION</div>
                            <div className="preview-section-body">
                                <StructuredText text={pdfDraft.initialPrompt} />
                            </div>
                        </div>

                        {/* Discovered Sections */}
                        {previewSections.length > 0 && (
                            <div className="preview-section">
                                <div className="preview-section-label">PARSED DOCUMENT SECTIONS ({previewSections.length})</div>
                                <div className="sections-accordion">
                                    {previewSections.map(([heading, body], i) => (
                                        <details key={i} className="section-item">
                                            <summary className="section-item-heading">{heading}</summary>
                                            <div className="section-item-body">
                                                <StructuredText text={body} maxLines={20} />
                                            </div>
                                        </details>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Extracted Data Series */}
                        {metricEntries.length > 0 && (
                            <div className="preview-section">
                                <div className="preview-section-label">EXTRACTED DATA SERIES ({metricEntries.length})</div>
                                <div className="metrics-preview-list">
                                    {metricEntries.map(([key, values]) => (
                                        <MetricRow key={key} name={key} values={values} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── EDITABLE FIELDS + SAVE ───────────────────────────── */}
                <div className="admin-card">
                    <div className="admin-card-title">
                        {pdfDraft ? 'REVIEW & PUBLISH CASE STUDY' : 'CREATE CASE STUDY MANUALLY'}
                    </div>
                    {pdfDraft && (
                        <p className="admin-hint">
                            Fields have been pre-filled from the PDF. Edit anything before publishing.
                        </p>
                    )}

                    <form onSubmit={handleCreate} className="admin-form">
                        <div className="admin-grid-2">
                            <div className="admin-field">
                                <label className="admin-label">CASE TITLE *</label>
                                <input className="admin-input" required {...field('title')} placeholder="e.g. ZenithPay: The Unit Economics Paradox" />
                            </div>
                            <div className="admin-field">
                                <label className="admin-label">INDUSTRY</label>
                                <input className="admin-input" {...field('industry')} placeholder="e.g. FinTech, Banking, SaaS" />
                            </div>
                        </div>

                        <div className="admin-field">
                            <label className="admin-label">PROBLEM STATEMENT</label>
                            <p className="admin-hint" style={{ marginBottom: 6 }}>
                                The structured questions the candidate must solve. This appears in the candidate sidebar.
                            </p>
                            <textarea
                                className="admin-textarea auto-height"
                                {...field('problemStatement')}
                                placeholder="1) Diagnose the root cause... 2) Propose a plan... 3) Identify risks..."
                            />
                        </div>

                        <div className="admin-field">
                            <label className="admin-label">CANDIDATE OPENING QUESTION</label>
                            <p className="admin-hint" style={{ marginBottom: 6 }}>
                                The first message the candidate sees in the chat window when they begin the session.
                            </p>
                            <textarea
                                className="admin-textarea auto-height"
                                required
                                {...field('initialPrompt')}
                                placeholder="Welcome to your case study. Please begin by stating your diagnostic hypothesis..."
                            />
                        </div>

                        <div className="admin-field" style={{ maxWidth: 280 }}>
                            <label className="admin-label">PASSING THRESHOLD (0.0 – 1.0)</label>
                            <input
                                type="number"
                                min="0" max="1" step="0.05"
                                className="admin-input"
                                {...field('thresholdPassingScore')}
                            />
                        </div>

                        {saveSuccess && (
                            <div className="save-banner save-banner--success">
                                Case study published successfully and is now live.
                            </div>
                        )}
                        {saveError && (
                            <div className="save-banner save-banner--error">{saveError}</div>
                        )}

                        <div className="admin-actions">
                            <button type="submit" disabled={savingCase} className="admin-btn primary">
                                {savingCase ? 'PUBLISHING...' : pdfDraft ? 'PUBLISH CASE STUDY' : 'CREATE CASE STUDY'}
                            </button>
                        </div>
                    </form>
                </div>

                {/* ── EXISTING CASE STUDIES ────────────────────────────── */}
                <div className="admin-card">
                    <div className="admin-card-title">PUBLISHED CASE STUDIES ({caseStudies.length})</div>
                    {caseStudies.length === 0 ? (
                        <p className="admin-hint">No case studies published yet. Import a PDF above to get started.</p>
                    ) : (
                        <div className="cases-list">
                            {caseStudies.map((row) => (
                                <div key={row.id} className="case-list-row clickable" onClick={() => openCaseDrawer(row.id)}>
                                    <div className="case-list-main">
                                        <div className="case-list-title">{row.title}</div>
                                        <div className="case-list-meta">
                                            {row.industry && <span className="case-chip">{row.industry}</span>}
                                            <span className={`case-chip status-chip ${row.is_active ? 'active' : 'inactive'}`}>
                                                {row.is_active ? 'ACTIVE' : 'INACTIVE'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="case-list-stats">
                                        <div className="case-stat">
                                            <span className="case-stat-val">{row.attempts ?? 0}</span>
                                            <span className="case-stat-label">Attempts</span>
                                        </div>
                                        <div className="case-stat">
                                            <span className="case-stat-val">{row.created_at ? new Date(row.created_at).toLocaleDateString() : '—'}</span>
                                            <span className="case-stat-label">Created</span>
                                        </div>
                                        <div className="case-row-actions">
                                            <button
                                                type="button"
                                                className="icon-action-btn"
                                                title="Edit case"
                                                onClick={(e) => handleQuickEditClick(e, row)}
                                            >
                                                ✎
                                            </button>
                                            <button
                                                type="button"
                                                className="icon-action-btn danger"
                                                title="Delete case"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteCase(row.id);
                                                }}
                                                disabled={deletingCase}
                                            >
                                                🗑
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {drawerOpen && (
                    <>
                        <div className="case-drawer-backdrop" onClick={closeCaseDrawer} />
                        <aside className="case-drawer">
                            <div className="case-drawer-head">
                                <div>
                                    <div className="admin-card-title" style={{ marginBottom: 4 }}>CASE DETAILS</div>
                                    <div className="admin-hint">View full case data and all submissions.</div>
                                </div>
                                <button className="icon-action-btn" onClick={closeCaseDrawer}>X</button>
                            </div>

                            {detailLoading ? (
                                <div className="admin-hint">Loading case details...</div>
                            ) : !caseDetail?.caseStudy ? (
                                <div className="admin-hint">No case detail found.</div>
                            ) : (
                                <>
                                    <div className="drawer-actions">
                                        {!editMode ? (
                                            <>
                                                <button className="admin-btn secondary" onClick={() => setEditMode(true)}>EDIT</button>
                                                <button className="admin-btn secondary" onClick={() => handleDeleteCase(caseDetail.caseStudy.id)} disabled={deletingCase}>DELETE</button>
                                            </>
                                        ) : (
                                            <>
                                                <button className="admin-btn primary" onClick={handleSaveEdit} disabled={savingEdit}>{savingEdit ? 'SAVING...' : 'SAVE'}</button>
                                                <button className="admin-btn secondary" onClick={() => setEditMode(false)}>CANCEL</button>
                                                <button className="admin-btn secondary" onClick={() => handleDeleteCase(caseDetail.caseStudy.id)} disabled={deletingCase}>DELETE</button>
                                            </>
                                        )}
                                    </div>

                                    {editMode ? (
                                        <div className="admin-form">
                                            <div className="admin-field">
                                                <label className="admin-label">CASE TITLE</label>
                                                <input className="admin-input" value={editForm.title} onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))} />
                                            </div>
                                            <div className="admin-field">
                                                <label className="admin-label">INDUSTRY</label>
                                                <input className="admin-input" value={editForm.industry} onChange={(e) => setEditForm((p) => ({ ...p, industry: e.target.value }))} />
                                            </div>
                                            <div className="admin-field">
                                                <label className="admin-label">PROBLEM STATEMENT / CONTEXT</label>
                                                <textarea className="admin-textarea" value={editForm.context} onChange={(e) => setEditForm((p) => ({ ...p, context: e.target.value }))} />
                                            </div>
                                            <div className="admin-field">
                                                <label className="admin-label">CANDIDATE OPENING QUESTION</label>
                                                <textarea className="admin-textarea" value={editForm.initialPrompt} onChange={(e) => setEditForm((p) => ({ ...p, initialPrompt: e.target.value }))} />
                                            </div>
                                            <div className="admin-grid-2">
                                                <div className="admin-field">
                                                    <label className="admin-label">PASSING THRESHOLD (0.0 – 1.0)</label>
                                                    <input type="number" min="0" max="1" step="0.05" className="admin-input" value={editForm.thresholdPassingScore} onChange={(e) => setEditForm((p) => ({ ...p, thresholdPassingScore: e.target.value }))} />
                                                </div>
                                                <div className="admin-field">
                                                    <label className="admin-label">ACTIVE</label>
                                                    <select className="admin-select" value={editForm.isActive ? 'true' : 'false'} onChange={(e) => setEditForm((p) => ({ ...p, isActive: e.target.value === 'true' }))}>
                                                        <option value="true">Yes</option>
                                                        <option value="false">No</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="drawer-summary">
                                            <div className="admin-hint">Title: {caseDetail.caseStudy.title}</div>
                                            <div className="admin-hint">Industry: {caseDetail.caseStudy.industry || 'General'}</div>
                                            <div className="admin-hint">Passing Marks: {Math.round(Number(caseDetail.caseStudy.threshold_passing_score || 0.6) * 100)}%</div>
                                            <div className="admin-hint">Submissions: {caseDetail.submissionCount || 0}</div>
                                            <div className="preview-section" style={{ marginTop: 10 }}>
                                                <div className="preview-section-label">CONTEXT</div>
                                                <div className="preview-section-body">
                                                    <StructuredText text={caseDetail.caseStudy.context} maxLines={12} />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="results-attempt-list" style={{ marginTop: 12 }}>
                                        {(caseDetail.submissions || []).map((s) => {
                                            const displayStatus = String(s.result_status || s.status || 'pending').toLowerCase();
                                            const score = s.total_score ?? s.assessment_scores?.[0]?.total_score ?? '--';
                                            return (
                                                <div key={s.id} className="admin-card results-attempt-card">
                                                    <div className="results-attempt-head">
                                                        <div className="admin-hint">{s.candidate_email} | {new Date(s.created_at).toLocaleString()}</div>
                                                        <div className="results-attempt-badges">
                                                            <span className={`admin-status ${displayStatus}`}>{displayStatus.toUpperCase()}</span>
                                                            <span className="results-score-badge">Score: {score}</span>
                                                        </div>
                                                    </div>
                                                    <div className="candidate-chat-history" style={{ maxHeight: 220 }}>
                                                        {(s.chat_history || []).map((msg, idx) => {
                                                            const role = String(msg.role || '').toLowerCase();
                                                            const roleClass = role === 'assistant' ? 'assistant' : 'user';
                                                            return (
                                                                <div key={idx} className={`candidate-chat-item ${roleClass}`}>
                                                                    <div className="candidate-chat-role">{String(msg.role || '').toUpperCase()}</div>
                                                                    <div className="candidate-chat-content">{msg.content}</div>
                                                                </div>
                                                            );
                                                        })}
                                                        {(s.chat_history || []).length === 0 && <div className="admin-hint">No conversation available.</div>}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {(caseDetail.submissions || []).length === 0 && (
                                            <div className="admin-hint">No submissions for this case yet.</div>
                                        )}
                                    </div>
                                </>
                            )}
                        </aside>
                    </>
                )}

            </div>
        </div>
    );
};

export default AdminEvaluation;
