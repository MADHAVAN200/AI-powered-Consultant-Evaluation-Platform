const registerAssessmentRoutes = (app, controller) => {
    app.post('/api/invites', controller.createInvite);
    app.get('/api/invites/:id', controller.getInvite);

    app.post('/api/assess/start', controller.startAssessment);
    app.post('/api/assess/demo/start', controller.startDemoAssessment);
    app.post('/api/assess/respond', controller.respondAssessment);
    app.get('/api/assess/results', controller.assessResults);
};

module.exports = { registerAssessmentRoutes };
