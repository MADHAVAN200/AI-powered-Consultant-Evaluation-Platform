const registerCaseStudyRoutes = (app, controller, upload) => {
    app.get('/api/case-studies', controller.listCaseStudies);
    app.get('/api/case-studies/:id/brief', controller.getCaseStudyBrief);
    app.get('/api/admin/case-studies/:id/detail', controller.adminCaseStudyDetail);
    app.post('/api/case-studies/import-pdf', upload.single('pdf'), controller.importCaseStudyPdf);
    app.post('/api/case-studies', controller.createCaseStudy);
    app.put('/api/case-studies/:id', controller.updateCaseStudy);
    app.delete('/api/case-studies/:id', controller.deleteCaseStudy);
};

module.exports = { registerCaseStudyRoutes };
