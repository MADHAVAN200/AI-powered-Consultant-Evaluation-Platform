const os     = require('os');
const path   = require('path');
const multer = require('multer');

const registerCaseStudyRoutes = (app, controller, _upload) => {
    // Disk-storage multer specifically for the PDF import route.
    // PyMuPDF subprocess reads directly from the filesystem, so we must
    // save the file to disk before calling parsePDF().
    const diskUpload = multer({
        storage: multer.diskStorage({
            destination: (req, file, cb) => cb(null, os.tmpdir()),
            filename: (req, file, cb) => {
                const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
                cb(null, `${unique}${path.extname(file.originalname)}`);
            }
        }),
        fileFilter: (req, file, cb) => {
            if (file.mimetype === 'application/pdf') cb(null, true);
            else cb(new Error('Only PDF files are allowed'), false);
        },
        limits: { fileSize: 20 * 1024 * 1024 } // 20 MB
    });

    app.get('/api/case-studies',                              controller.listCaseStudies);
    app.get('/api/case-studies/:id/brief',                    controller.getCaseStudyBrief);
    app.get('/api/case-studies/:id/brief-section/:sectionKey', controller.getCaseStudyBriefSection);
    app.get('/api/admin/case-studies/:id/detail',             controller.adminCaseStudyDetail);
    app.post('/api/case-studies/import-pdf', diskUpload.single('pdf'), controller.importCaseStudyPdf);
    app.post('/api/case-studies',                             controller.createCaseStudy);
    app.put('/api/case-studies/:id',                          controller.updateCaseStudy);
    app.delete('/api/case-studies/:id',                       controller.deleteCaseStudy);
};

module.exports = { registerCaseStudyRoutes };
