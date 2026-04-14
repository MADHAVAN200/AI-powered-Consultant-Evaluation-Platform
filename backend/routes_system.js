const registerSystemRoutes = (app, controller) => {
    app.get('/api/health', controller.health);
};

module.exports = { registerSystemRoutes };
