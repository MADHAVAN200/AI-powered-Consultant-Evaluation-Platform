const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { Groq } = require('groq-sdk');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// ---------------------------------------------------------
// GROQ MULTI-KEY ROTATION ENGINE (HA/High-Availability)
// ---------------------------------------------------------
const groqKeys = [
    process.env.GROQ_API_KEY_1,
    process.env.GROQ_API_KEY_2
].filter(Boolean);

const groqClients = groqKeys.map(key => new Groq({ apiKey: key }));
let currentKeyIndex = 0;

const getNextGroqClient = () => {
    currentKeyIndex = (currentKeyIndex + 1) % groqClients.length;
    console.log(`[HA-FAILOVER] Switching to Groq Key #${currentKeyIndex + 1}...`);
    return groqClients[currentKeyIndex];
};
// ---------------------------------------------------------

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Utility: Sleep for throttling
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const { spawn } = require('child_process');
const path = require('path');

// Utility: Python-Powered Intelligence Engine (Metaschema Compression)
// Executes analyzer.py (Pandas) to bypass LLM context bottlenecks (Option 3 & 6)
const computeMetadata = async (history) => {
    if (!history || history.length === 0) return { status: "NO_HISTORY" };

    return new Promise((resolve, reject) => {
        // ABSOLUTE PATH RESOLUTION: Fixes [PY-ERROR] path mismatches
        const scriptPath = path.join(__dirname, 'scripts', 'analyzer.py');
        const pythonProcess = spawn('python', [scriptPath]);
        
        let stdoutData = '';
        let stderrData = '';

        pythonProcess.stdin.write(JSON.stringify(history));
        pythonProcess.stdin.end();

        pythonProcess.stdout.on('data', (chunk) => {
            stdoutData += chunk.toString();
        });

        pythonProcess.stderr.on('data', (chunk) => {
            stderrData += chunk.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                console.error(`[PY-ERROR] Exit Code ${code}:`, stderrData || "Unexpected script termination.");
                // Fallback to JS-only basic metadata if Python fails
                resolve(basicComputeMetadata(history)); 
            } else {
                try {
                    const result = JSON.parse(stdoutData.trim());
                    if (result.status === "ERROR" || result.status === "CRASH") {
                        console.error("[PY-SCRIPT-LOGIC-ERROR]", result.message || "Logic failure.");
                    }
                    resolve(result);
                } catch (e) {
                    console.error("[PY-PARSE-ERROR] Raw Output:", stdoutData);
                    resolve(basicComputeMetadata(history));
                }
            }
        });

        // Timeout guard: 5s
        setTimeout(() => {
            pythonProcess.kill();
            resolve(basicComputeMetadata(history));
        }, 5000);
    });
};

const basicComputeMetadata = (history) => {
    const keys = Object.keys(history[0]).filter(k => 
        k !== 'raw_data' && k !== 'user_email' && k !== 'id' && k !== 'created_at' && k !== 'scenario_name'
    );
    return {
        columnCount: keys.length,
        rowCount: history.length,
        mode: "BASIC_JS_FALLBACK",
        latestSnapshot: history[0]
    };
};

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', supabaseConnected: !!supabase, groqConnected: groqClients.length > 0 });
});

// 1. Fetch User History
app.get('/api/history', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: "Email required" });

  try {
    const { data, error } = await supabase
      .from('enterprise_metrics')
      .select('*')
      .eq('user_email', email)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, metrics: data });
  } catch (error) {
    console.error("[ERROR] /api/history:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 1.5 Fetch ALL Historical Decisions
app.get('/api/all-decisions', async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: "Email required" });

    try {
        const { data, error } = await supabase
            .from('strategic_decisions')
            .select('*')
            .eq('user_email', email)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ success: true, decisions: data });
    } catch (error) {
        console.error("[ERROR] /api/all-decisions:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2. Save Metric Snapshot
app.post('/api/save-snapshot', async (req, res) => {
  const { email, metrics, rawData } = req.body;
  
  try {
    const { error } = await supabase
      .from('enterprise_metrics')
      .insert([{
        user_email: email,
        revenue: metrics.Revenue,
        cost: metrics.Cost,
        profit: metrics.Profit,
        margin: metrics.Margin,
        attrition: metrics.AttritionRate || 0,
        churn_rate: metrics.ChurnRate || 0,
        logistics_cost: metrics.LogisticsCost || 0,
        scenario_name: metrics.scenario || 'manual_upload',
        raw_data: rawData
      }]);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error("[ERROR] /api/save-snapshot:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/delete-snapshot/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await supabase
            .from('enterprise_metrics')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error("[ERROR] /api/delete-snapshot:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 3. Fetch Global Signals
app.get('/api/global-signals', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('global_signals')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, signals: data });
  } catch (error) {
    console.error("[ERROR] /api/global-signals:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Strategic AI Analysis with Python-Powered Statistical Intelligence
app.post('/api/analyze', async (req, res) => {
  const { email, metrics, activeSignals, history } = req.body;

  // OPTION 3 & 6: EXECUTE PYTHON ANALYZER (Awaited for deep insights)
  const metadata = await computeMetadata(history ? history.slice(0, 100) : []);

  const systemPrompt = `
    You are a Master Strategic Auditor for the Indian IT/Industrial Sector.
    Instead of raw CSV rows, you are analyzing DEEP KPI STATISTICS generated by a PANDAS Intelligence Engine.
    
    LENS 1: STATISTICAL AUDITOR. 
    - CITE specific Peaks (from metadata.peaks), Outliers (if any), and Growth Deltas.
    - Reference specific Correlations (e.g. "As Utilization rose, Profit followed...").

    LENS 2: STRATEGIC CONSULTANT (Indian Domain). 
    - Scale: Lakhs/Crores and ₹. Focus on Utilization (Services) or MRR/Churn (SaaS).
    
    LENS 3: LOGIC GUARD. Cross-reference signals with Python-generated trends.

    MANDATORY OUTPUT SCHEMA (ONLY 2 KEYS ALLOWED):
    {
      "insights": [
        { "id": 1, "title": "...", "why": "[AUDIT] ... [GUARD] ...", "type": "warning/critical/success" }
      ],
      "recommendations": [
        {
          "id": "rec1",
          "perspective": "Low Risk",
          "title": "...",
          "impact": "...",
          "risk": "Low",
          "confidence": 0.9,
          "why": "[AUDIT] Citation from Pandas... [STRATEGY] Technical advice... [GUARD] Conflict Check.",
          "simulation": { "best": "Scenario", "exp": "Scenario", "worst": "Scenario" }
        }
      ]
    }
  `;

  const userPrompt = `
    LATEST_METRICS: ${JSON.stringify(metrics)}
    ACTIVE_SIGNALS: ${JSON.stringify(activeSignals)}
    PANDAS_INTELLIGENCE_REPORT: ${JSON.stringify(metadata)}
    Output ONLY raw JSON. No markdown backticks.
  `;

  // Retry with Sequential Key Rotation & Backoff
  let totalRetries = groqClients.length * 2; 
  let attempt = 0;
  let activeClient = groqClients[currentKeyIndex];

  while (attempt < totalRetries) {
    try {
      const chatCompletion = await activeClient.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        model: "llama-3.3-70b-versatile",
        response_format: { type: "json_object" }
      });

      let analysis = JSON.parse(chatCompletion.choices[0]?.message?.content);
      
      // FAIL-SAFE SCHEMA VALIDATOR
      if (!analysis.insights) analysis.insights = [];
      if (!analysis.recommendations) {
        const potentialKeys = ['strategicRecommendations', 'recommendation', 'recommendations_list'];
        for (const key of potentialKeys) {
            if (analysis[key]) {
                analysis.recommendations = Array.isArray(analysis[key]) ? analysis[key] : [analysis[key]];
                break;
            }
        }
        if (!analysis.recommendations) analysis.recommendations = [];
      }
      
      if (analysis && analysis.recommendations && email) {
          const decisionsToInsert = analysis.recommendations.map(rec => ({
              user_email: email,
              title: rec.title,
              perspective: rec.perspective,
              impact: rec.impact,
              risk: rec.risk === 'Medium' ? 'Med' : rec.risk, 
              confidence: rec.confidence,
              why: rec.why,
              simulation: rec.simulation
          }));
          await supabase.from('strategic_decisions').insert(decisionsToInsert);
      }

      return res.json({ success: true, analysis });
    } catch (error) {
      if (error.status === 429) {
        console.warn(`[429-RATE-LIMIT] Key #${currentKeyIndex + 1} exhausted. Attempting failover...`);
        activeClient = getNextGroqClient();
        attempt++;
        if (attempt >= groqClients.length) {
            console.log(`[COOL-DOWN] All keys exhausted. Waiting 5s...`);
            await sleep(5000); 
        }
        continue;
      }
      console.error("[ERROR] /api/analyze:", error.message);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
});

// 5. Dynamic RAG Conversational Intelligence via Groq
app.post('/api/chat', async (req, res) => {
    const { query, decisionContext, email } = req.body;
    if (!query) return res.status(400).json({ error: "Query required" });

    const systemPrompt = `
        You are a Strategic AI Consultant. 
        Analyze the provided context for a specific BUSINESS DECISION and answer the user's question.
        
        CONTEXT (The specific decision being discussed):
        ${JSON.stringify(decisionContext)}
        
        RULES:
        1. STRIGENT DATA ADHERENCE: Only use info from the CONTEXT. 
        2. If the user asks about something not in the context, relate it back to the decision's ROI or risk profile.
        3. Use Indian business formatting (Lakhs/Crores) and ₹ symbols.
        4. Be professional, technical, and concise.
    `;

    const userPrompt = `USER_QUESTION: ${query}`;

    // Use Key-Rotation & Retry logic
    let totalRetries = groqClients.length * 2;
    let attempt = 0;
    let activeClient = groqClients[currentKeyIndex];

    while (attempt < totalRetries) {
        try {
            const chatCompletion = await activeClient.chat.completions.create({
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                model: "llama-3.3-70b-versatile",
            });

            const responseText = chatCompletion.choices[0]?.message?.content;
            return res.json({ success: true, response: responseText });
        } catch (error) {
            if (error.status === 429) {
                console.warn(`[CHAT-FAILOVER] Key exhausted. Switching...`);
                activeClient = getNextGroqClient();
                attempt++;
                if (attempt >= groqClients.length) await sleep(3000); 
                continue;
            }
            console.error("[ERROR] /api/chat:", error.message);
            return res.status(500).json({ success: false, error: error.message });
        }
    }
});

app.listen(PORT, () => {
    console.log(`[BOOT] AI Consultant Server running on http://localhost:${PORT}`);
});
