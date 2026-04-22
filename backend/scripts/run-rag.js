const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const backendDir = path.resolve(__dirname, '..');
const rootDir = path.resolve(backendDir, '..');
const isDev = process.argv.includes('--dev');

// Centralize runtime config so this launcher behaves like backend/server.js.
require('dotenv').config({ path: path.join(backendDir, '.env') });

const configuredPython = String(process.env.PYTHON_BIN || '').trim();
const venvPython = process.platform === 'win32'
  ? path.join(rootDir, '.venv', 'Scripts', 'python.exe')
  : path.join(rootDir, '.venv', 'bin', 'python');

const candidates = [
  configuredPython,
  venvPython,
  process.platform === 'win32' ? 'python' : 'python3',
  'python',
].filter(Boolean);

const isFilePath = (value) => /[\\/]/.test(value) || value.toLowerCase().endsWith('.exe');

const canExecute = (pythonCmd) => {
  if (isFilePath(pythonCmd) && !fs.existsSync(pythonCmd)) return false;
  const probe = spawnSync(pythonCmd, ['--version'], {
    cwd: backendDir,
    shell: !isFilePath(pythonCmd),
    stdio: 'ignore',
  });
  return probe.status === 0;
};

const pythonCmd = candidates.find(canExecute);

if (!pythonCmd) {
  console.error('[RAG] Could not find a working Python interpreter.');
  console.error('[RAG] Set PYTHON_BIN in backend/.env or install python3 in PATH.');
  process.exit(1);
}

const args = isDev
  ? [
      '-m',
      'uvicorn',
      'python_rag_service.app:app',
      '--host',
      process.env.RAG_HOST || '0.0.0.0',
      '--port',
      String(process.env.RAG_PORT || '8001'),
      '--reload',
      '--reload-dir',
      'python_rag_service',
    ]
  : ['python_rag_service/run_service.py'];

console.log(`[RAG] Starting with ${pythonCmd} (${isDev ? 'dev' : 'prod'} mode)`);

const child = spawn(pythonCmd, args, {
  cwd: backendDir,
  shell: !isFilePath(pythonCmd),
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code) => {
  process.exit(code == null ? 1 : code);
});

child.on('error', (err) => {
  console.error('[RAG] Failed to start Python process:', err.message);
  process.exit(1);
});
