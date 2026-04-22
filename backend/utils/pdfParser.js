// backend/utils/pdfParser.js
// Parses any PDF using ONE simple rule:
//   bold text line  →  new section heading
//   regular text line →  content under the current section
// No LLM. No hardcoded section names. Completely dynamic.

const { execFile } = require('child_process');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

// ─── Python script (written to temp file, executed via subprocess) ─────────────
// Key fixes for Windows:
//   1. sys.stdout.reconfigure(encoding='utf-8') → forces UTF-8 output
//   2. ensure_ascii=True → escapes non-ASCII as \uXXXX (JSON-safe on any OS)
//   3. Problematic characters stripped before processing
const PYTHON_SCRIPT = `
import sys
import json
import re
import fitz  # PyMuPDF

# Force UTF-8 output — prevents cp1252 UnicodeEncodeError on Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

def is_bold(flags):
    """Bit 4 of PDF font flags = bold."""
    return bool(flags & (1 << 4))

def clean_text(text):
    """Remove control characters and other non-printable chars that break encoding."""
    # Keep printable ASCII + space; replace anything else with a space
    cleaned = re.sub(r'[\\x00-\\x08\\x0b\\x0c\\x0e-\\x1f\\x7f]', ' ', str(text))
    # Collapse multiple spaces
    cleaned = re.sub(r' +', ' ', cleaned)
    return cleaned.strip()

def parse_pdf(filepath):
    doc = fitz.open(filepath)
    spans = []

    for page_num, page in enumerate(doc):
        blocks = page.get_text("dict")["blocks"]
        for block in blocks:
            if block.get("type") != 0:
                continue
            for line in block.get("lines", []):
                line_texts  = []
                line_bold   = False
                line_size   = 0

                for span in line.get("spans", []):
                    raw = clean_text(span.get("text", ""))
                    if not raw:
                        continue
                    line_texts.append(raw)
                    if is_bold(span.get("flags", 0)):
                        line_bold = True
                    line_size = max(line_size, span.get("size", 0))

                full_text = " ".join(line_texts).strip()
                if full_text:
                    spans.append({
                        "text": full_text,
                        "bold": line_bold,
                        "size": round(line_size, 1),
                        "page": page_num + 1
                    })

    # ── Simple rule: bold line = new section, non-bold = content ─────────────
    sections        = []
    current_section = None
    doc_title       = None

    for span in spans:
        text = span["text"]
        bold = span["bold"]

        if not bold:
            # Regular text → append to current section's content
            if current_section is not None:
                current_section["content"].append(text)
            # If no section opened yet, ignore (likely pre-title content)
            continue

        # Bold line — treat as a heading
        if doc_title is None:
            # Very first bold line = document title (not a section)
            doc_title = text
            continue

        # Every subsequent bold line = a new section
        current_section = {
            "id":      len(sections),
            "title":   text,
            "content": [],
            "type":    classify_section(text)
        }
        sections.append(current_section)

    return {
        "title":    doc_title,
        "sections": sections
    }

def classify_section(title):
    """
    Lightweight keyword classifier — assigns a display type badge.
    No hardcoding of section names; just broad category detection.
    """
    t = title.upper()
    if any(k in t for k in ["FINANCIAL", "REVENUE", "PROFIT", "COST", "BALANCE", "METRIC",
                              "OPERATIONAL", "CUSTOMER", "MARKETING", "TREND", "DATA", "KPI"]):
        return "DATA"
    if any(k in t for k in ["QUESTION", "PROBLEM", "STATEMENT", "CHALLENGE", "TASK", "OBJECTIVE"]):
        return "PROBLEM"
    if any(k in t for k in ["INTERNAL", "NOTE", "CONFIDENTIAL", "ADMIN"]):
        return "INTERNAL"
    # Default — most sections are context / background
    return "CONTEXT"

if __name__ == "__main__":
    filepath = sys.argv[1]
    result   = parse_pdf(filepath)
    # ensure_ascii=True: all output is valid ASCII, immune to any OS encoding issue
    print(json.dumps(result, ensure_ascii=True))
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Locate the Python interpreter. Prefers the project .venv on Windows. */
/** Locate the Python interpreter. Robust cross-platform detection. */
function resolvePythonBin() {
    const configuredPython = String(process.env.PYTHON_BIN || '').trim();
    const projectRoot = path.resolve(__dirname, '..', '..');
    const venvPython = process.platform === 'win32'
        ? path.join(projectRoot, '.venv', 'Scripts', 'python.exe')
        : path.join(projectRoot, '.venv', 'bin', 'python');

    const candidates = [
        configuredPython,
        venvPython,
        process.platform === 'win32' ? 'python' : 'python3',
        'python',
    ].filter(Boolean);

    for (const cmd of candidates) {
        try {
            // If it's a file path, check existence first
            if (/[\\/]/.test(cmd) || cmd.toLowerCase().endsWith('.exe')) {
                if (fs.existsSync(cmd)) return cmd;
                continue;
            }
            return cmd; // Return system commands like 'python3' and assume they work (or let execFile fail gracefully)
        } catch (_) {}
    }

    return process.platform === 'win32' ? 'python' : 'python3';
}

// ─── Exported function ────────────────────────────────────────────────────────

/**
 * parsePDF(filePath)
 *
 * @param {string} filePath  Absolute path to an uploaded PDF on disk.
 * @returns {Promise<{title: string|null, sections: Array}>}
 *   sections: [{ id, title, type, content[] }]
 *   type: "CONTEXT" | "DATA" | "PROBLEM" | "INTERNAL"
 *   content items: string  (plain paragraph line)
 */
async function parsePDF(filePath) {
    const pythonBin  = resolvePythonBin();
    const scriptPath = path.join(os.tmpdir(), `pdf_parser_${Date.now()}_${process.pid}.py`);

    // Write the Python script to a temp file
    fs.writeFileSync(scriptPath, PYTHON_SCRIPT, 'utf8');

    return new Promise((resolve, reject) => {
        execFile(
            pythonBin,
            [scriptPath, filePath],
            {
                maxBuffer: 10 * 1024 * 1024,
                // Force UTF-8 on Windows — the subprocess env may default to CP1252
                env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }
            },
            (err, stdout, stderr) => {
                // Always clean up the temp script
                try { fs.unlinkSync(scriptPath); } catch (_) {}

                if (err) {
                    return reject(new Error(`PDF parse failed: ${stderr || err.message}`));
                }

                try {
                    const result = JSON.parse(stdout);
                    resolve(result);
                } catch (_) {
                    reject(new Error(`Failed to parse PDF output as JSON. Raw output: ${String(stdout).slice(0, 300)}`));
                }
            }
        );
    });
}

module.exports = { parsePDF };
