// backend/routes/upload.js
// Multer-based upload route that parses the PDF and returns structured sections.
// Used exclusively by the Admin Case Study builder for PDF ingestion.

const express = require('express');
const multer = require('multer');
const path = require('path');
const os = require('os');
const { parsePDF } = require('../utils/pdfParser');

const router = express.Router();

// Store uploads in the OS temp dir with original extension preserved.
// Disk storage (not memoryStorage) is required because parsePDF reads from
// the file-system via the Python subprocess.
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, os.tmpdir()),
    filename: (req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${unique}${path.extname(file.originalname)}`);
    },
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') cb(null, true);
        else cb(new Error('Only PDF files are allowed'), false);
    },
    limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
});

/**
 * POST /api/upload/case-study
 *
 * Body: multipart/form-data with field name "pdf"
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     title: "AURUMCART ...",
 *     sections: [ { id, title, type, content[] }, ... ]
 *   }
 * }
 */
router.post('/case-study', upload.single('pdf'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No PDF file uploaded.' });
    }

    try {
        const parsed = await parsePDF(req.file.path);

        return res.json({
            success: true,
            data: parsed,
        });
    } catch (err) {
        console.error('PDF parse error:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
