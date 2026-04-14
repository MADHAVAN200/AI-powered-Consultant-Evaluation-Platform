const registerAdminRoutes = (app, controller) => {
    app.get('/api/admin/analytics', controller.adminAnalytics);
    app.get('/api/admin/dashboard', controller.adminDashboard);
    app.get('/api/admin/case-studies', controller.adminCaseStudies);
    app.get('/api/admin/results', controller.adminResults);
    app.get('/api/admin/results/:sessionId', controller.adminResultDetail);
};

module.exports = { registerAdminRoutes };
