const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const { Groq } = require('groq-sdk');
require('dotenv').config();

const { createApiService } = require('./services_api');
const { createApiController } = require('./controllers_api');
const { registerSystemRoutes } = require('./routes_system');
const { registerAssessmentRoutes } = require('./routes_assessment');
const { registerCaseStudyRoutes } = require('./routes_case_studies');
const { registerCandidateRoutes } = require('./routes_candidate');
const { registerAdminRoutes } = require('./routes_admin');

const app = express();
const PORT = process.env.PORT || 5000;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const groqKeys = [
    process.env.GROQ_API_KEY_1,
    process.env.GROQ_API_KEY_2
].filter(Boolean);

const groqClients = groqKeys.map((key) => new Groq({ apiKey: key }));
let currentKeyIndex = 0;
const getNextGroqClient = () => {
    if (groqClients.length === 0) return null;
    currentKeyIndex = (currentKeyIndex + 1) % groqClients.length;
    return groqClients[currentKeyIndex];
};

const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const apiService = createApiService({ supabase, groqClients, getNextGroqClient });
const apiController = createApiController(apiService);

registerSystemRoutes(app, apiController);
registerAssessmentRoutes(app, apiController);
registerCaseStudyRoutes(app, apiController, upload);
registerCandidateRoutes(app, apiController);
registerAdminRoutes(app, apiController);

app.listen(PORT, () => {
    console.log(`[BOOT] Interview Engine Server running on http://localhost:${PORT}`);
});
