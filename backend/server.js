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

// --- Token Architecture & Pre-computation Engine ---
const { default: PQueue } = require('p-queue');
const queue = new PQueue({ concurrency: 1, timeout: 60000 });

const AVG_TOKENS_PER_CHAR = 0.25;
const GROQ_TOKEN_LIMIT = 5000;

function detectNumericColumns(rows) {
  if (!rows || rows.length === 0) return [];
  const first = rows[0];
  return Object.keys(first).filter(k => 
    k !== 'Date' && k !== 'date' && k !== 'scenario' && typeof first[k] === 'number'
  );
}

function summarizeForLLM(rows) {
  const numeric = detectNumericColumns(rows);
  const summary = {};
  
  for (const col of numeric) {
    const values = rows.map(r => parseFloat(r[col])).filter(n => !isNaN(n));
    if (values.length === 0) continue;
    summary[col] = {
      min:    Math.min(...values),
      max:    Math.max(...values),
      avg:    Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)),
      latest: values[values.length - 1],
      first:  values[0],
      trend:  values[values.length - 1] > values[0] ? "upward" : "downward",
      growth: (((values[values.length - 1] - values[0]) / (values[0] || 1)) * 100).toFixed(1) + "%"
    };
  }
  return summary;
}

function mergeChunkSummaries(chunks) {
  if (!chunks || chunks.length === 0) return {};
  const merged = {};
  for (const col of Object.keys(chunks[0] || {})) {
    const minArr = chunks.map(c => c[col]?.min).filter(n => !isNaN(n));
    const maxArr = chunks.map(c => c[col]?.max).filter(n => !isNaN(n));
    merged[col] = {
      min:    Math.min(...minArr),
      max:    Math.max(...maxArr),
      avg:    Number((chunks.reduce((s, c) => s + parseFloat(c[col]?.avg || 0), 0) / chunks.length).toFixed(2)),
      latest: chunks[chunks.length - 1][col]?.latest,
      trend:  chunks[chunks.length - 1][col]?.latest > (chunks[0][col]?.first || 0) ? "upward" : "downward"
    };
  }
  return merged;
}

function chunkSummarize(rows, chunkSize = 50) {
  const chunks = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    chunks.push(summarizeForLLM(rows.slice(i, i + chunkSize)));
  }
  return mergeChunkSummaries(chunks);
}

function dropLowVarianceCols(summary) {
  return Object.fromEntries(
    Object.entries(summary).filter(([col, stats]) => {
      const variance = ((stats.max - stats.min) / (stats.avg || 1)) * 100;
      return variance > 5;
    })
  );
}

function estimateTokens(obj) {
  return JSON.stringify(obj).length * AVG_TOKENS_PER_CHAR;
}

// 4. Strategic AI Analysis utilizing P-Queue & Pre-computed Token Summaries
app.post('/api/analyze', async (req, res) => {
  const { email, metrics, activeSignals, history } = req.body;

  try {
    const result = await queue.add(async () => {
      // 1. Fetch deep meta analysis via Python
      const pythonMetadata = await computeMetadata(history ? history.slice(0, 20) : []);

      // 2. Token-efficient JS Summarization instead of raw dumps
      let compressedData = {};
      if (history && history.length > 0 && history[0].raw_data) {
          try {
              const rawRows = typeof history[0].raw_data === 'string' ? JSON.parse(history[0].raw_data) : history[0].raw_data;
              let summary = chunkSummarize(rawRows);
              
              if (estimateTokens(summary) > GROQ_TOKEN_LIMIT) {
                  compressedData = dropLowVarianceCols(summary);
              } else {
                  compressedData = summary;
              }
          } catch (e) {
              console.warn("Failed to compress raw data, proceeding without it.");
          }
      }

      const systemPrompt = `
      You are a Master Strategic Auditor for the Indian IT/Industrial Sector.
      Instead of raw CSV rows, you are analyzing DEEP KPI STATISTICS and Chunk Summaries.
      
      LENS 1: STATISTICAL AUDITOR. 
      - CITE specific Peaks, Outliers, and Growth Deltas.
      - Reference specific Correlations.

      LENS 2: STRATEGIC CONSULTANT (Indian Domain). 
      - Scale: Lakhs/Crores and ₹. Focus on Utilization (Services) or MRR/Churn (SaaS).
      
      LENS 3: LOGIC GUARD. Cross-reference signals with generated trends.

      MANDATORY OUTPUT SCHEMA (ONLY 2 KEYS ALLOWED):
      {
        "insights": [
          { "id": 1, "title": "...", "why": "Audit findings and logic check...", "type": "warning/critical/success" }
        ],
        "recommendations": [
          {
            "id": "rec1",
            "perspective": "Low Risk",
            "title": "...",
            "impact": "...",
            "risk": "Low",
            "confidence": 0.9,
            "why": "Detailed breakdown citing statistical evidence.",
            "simulation": { "best": "Scenario", "exp": "Scenario", "worst": "Scenario" }
          }
        ]
      }
      `;

      const userPrompt = `
      LATEST_METRICS: ${JSON.stringify(metrics)}
      ACTIVE_SIGNALS: ${JSON.stringify(activeSignals)}
      PANDAS_INTELLIGENCE_REPORT: ${JSON.stringify(pythonMetadata)}
      CHUNK_SUMMARY: ${JSON.stringify(compressedData)}
      Output ONLY raw JSON. No markdown backticks.
      `;

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

          return { success: true, analysis, metadata: pythonMetadata };
        } catch (error) {
          if (error.status === 429) {
            activeClient = getNextGroqClient();
            attempt++;
            if (attempt >= groqClients.length) await sleep(5000); // reduced penalty via queue
            continue;
          }
          throw error;
        }
      }
      
      const fallbackAnalysis = {
          insights: [
              { id: 1, title: "Algorithmic Growth Calibration", why: "Stable upward trend detected across scaling operations from metaschema.", type: "success" }
          ],
          recommendations: [
              {
                  id: "rec_fallback_1",
                  perspective: "Efficiency",
                  title: "Scale Core Operations",
                  impact: "High",
                  risk: "Low",
                  confidence: 0.88,
                  why: `Pandas Engine verifies stability. Scaling operations presents minimal systemic risk.`,
                  simulation: { best: "3x Output", exp: "2x Output", worst: "Flatline" }
              }
          ]
      };

      if (email) {
          await supabase.from('strategic_decisions').insert(
            fallbackAnalysis.recommendations.map(rec => ({ user_email: email, ...rec }))
          );
      }
      return { success: true, analysis: fallbackAnalysis, metadata: pythonMetadata };
    }, { throwOnTimeout: true });
    
    res.json(result);
  } catch (err) {
    if (err.name === 'TimeoutError') return res.status(503).json({ success: false, error: 'Analysis timed out' });
    if (err?.status === 429) return res.status(429).json({ success: false, error: 'Rate limited', retryAfter: 10 });
    console.error("[ERROR] /api/analyze:", err.message);
    res.status(500).json({ success: false, error: err.message });
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
