const registerCandidateRoutes = (app, controller) => {
    app.get('/api/candidate/dashboard', controller.candidateDashboard);
    app.post('/api/candidate/cases/:caseStudyId/start', controller.candidateStartCase);
    app.get('/api/candidate/results', controller.candidateResults);
    app.get('/api/candidate/results/:sessionId', controller.candidateResultDetail);
};

module.exports = { registerCandidateRoutes };
