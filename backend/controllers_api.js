const createApiController = (service) => {
    const send = async (res, action) => {
        try {
            const payload = await action();
            res.json(payload);
        } catch (error) {
            const mapped = service.mapError(error);
            res.status(mapped.status || 500).json({ success: false, error: mapped.message });
        }
    };

    return {
        health: (req, res) => res.json(service.health()),

        createInvite: (req, res) => send(res, () => service.createInvite(req.body || {})),
        getInvite: (req, res) => send(res, () => service.getInvite(req.params.id)),
        startAssessment: (req, res) => send(res, () => service.startAssessment(req.body || {})),
        startDemoAssessment: (req, res) => send(res, () => service.startDemoAssessment(req.body || {})),
        respondAssessment: (req, res) => send(res, () => service.respondAssessment(req.body || {})),
        assessResults: (req, res) => send(res, () => service.assessResults()),

        listCaseStudies: (req, res) => send(res, () => service.listCaseStudies()),
        getCaseStudyBrief: (req, res) => send(res, () => service.getCaseStudyBrief(req.params.id)),
        getCaseStudyBriefSection: (req, res) => send(res, () => service.getCaseStudyBriefSection(req.params.id, req.params.sectionKey)),
        importCaseStudyPdf: (req, res) => send(res, () => service.importCaseStudyPdf(req.file)),
        createCaseStudy: (req, res) => send(res, () => service.createCaseStudy(req.body || {})),
        updateCaseStudy: (req, res) => send(res, () => service.updateCaseStudy(req.params.id, req.body || {})),
        deleteCaseStudy: (req, res) => send(res, () => service.deleteCaseStudy(req.params.id)),

        candidateDashboard: (req, res) => send(res, () => service.candidateDashboard(String(req.query.email || '').trim())),
        candidateStartCase: (req, res) => send(res, () => service.candidateStartCase(req.params.caseStudyId, String(req.body?.email || '').trim())),
        candidateResults: (req, res) => send(res, () => service.candidateResults(String(req.query.email || '').trim())),
        candidateResultDetail: (req, res) => send(res, () => service.candidateResultDetail(req.params.sessionId, String(req.query.email || '').trim())),

        adminAnalytics: (req, res) => send(res, () => service.adminAnalytics()),
        adminDashboard: (req, res) => send(res, () => service.adminDashboard()),
        adminCaseStudies: (req, res) => send(res, () => service.adminCaseStudies()),
        adminCaseStudyDetail: (req, res) => send(res, () => service.adminCaseStudyDetail(req.params.id)),
        adminResults: (req, res) => send(res, () => service.adminResults()),
        adminResultDetail: (req, res) => send(res, () => service.adminResultDetail(req.params.sessionId))
    };
};

module.exports = { createApiController };
