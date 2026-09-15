const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { randomUUID } = require('crypto');
const Tesseract = require('tesseract.js');

const ENGINE = 'paddle-ocr-v6';
const DETECTOR_MODEL = 'PP-OCRv6_small_det';
const RECOGNIZER_MODEL = 'PP-OCRv6_small_rec';

function resolvePythonPath(root = process.cwd(), environment = process.env) {
  if (environment.OCR_PYTHON_PATH) return environment.OCR_PYTHON_PATH;
  const folder = process.platform === 'win32' ? 'Scripts' : 'bin';
  const executable = process.platform === 'win32' ? 'python.exe' : 'python';
  for (const name of ['ocr-env', '.venv']) {
    const candidate = path.join(root, name, folder, executable);
    if (fs.existsSync(candidate)) return candidate;
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}

class PaddleOcrWorker {
  constructor(options = {}) {
    this.spawn = options.spawn || spawn;
    this.pythonPath = options.pythonPath || resolvePythonPath();
    this.workerScript = options.workerScript || path.join(process.cwd(), 'ocr', 'ocr.py');
    this.modelCacheDir = options.modelCacheDir || path.join(process.cwd(), '.ocr-models');
    this.timeoutMs = options.timeoutMs || Number(process.env.OCR_TIMEOUT_MS || 90000);
    this.startupTimeoutMs = options.startupTimeoutMs || Number(process.env.OCR_STARTUP_TIMEOUT_MS || 120000);
    this.child = null;
    this.ready = null;
    this.pending = new Map();
    this.serial = Promise.resolve();
  }

  reset(child) {
    if (this.child === child) {
      this.child = null;
      this.ready = null;
    }
  }

  rejectPending(error) {
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(error);
    }
    this.pending.clear();
  }

  start() {
    if (this.child && !this.child.killed && this.ready) return this.ready;
    const child = this.spawn(this.pythonPath, [this.workerScript], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PADDLE_PDX_CACHE_HOME: this.modelCacheDir }
    });
    this.child = child;
    this.ready = new Promise((resolve, reject) => {
      let settled = false;
      const settle = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn(value);
      };
      const timer = setTimeout(() => {
        this.reset(child);
        child.kill();
        settle(reject, new Error(`Paddle OCR worker did not become ready within ${this.startupTimeoutMs}ms`));
      }, this.startupTimeoutMs);
      readline.createInterface({ input: child.stdout }).on('line', line => {
        let message;
        try { message = JSON.parse(line); } catch { return; }
        if (message.type === 'ready') return settle(resolve, child);
        const request = this.pending.get(message.id);
        if (!request) return;
        clearTimeout(request.timer);
        this.pending.delete(message.id);
        message.error ? request.reject(new Error(message.error)) : request.resolve(message);
      });
      child.stderr.on('data', chunk => console.error(`[paddle-ocr] ${String(chunk).trim()}`));
      child.once('error', error => { this.reset(child); settle(reject, error); });
      child.once('exit', code => {
        const error = new Error(`Paddle OCR worker exited (${code ?? 'unknown'})`);
        this.rejectPending(error);
        this.reset(child);
        settle(reject, error);
      });
    });
    return this.ready;
  }

  async send(imagePath) {
    const child = await this.start();
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        this.reset(child);
        child.kill();
        reject(new Error(`Paddle OCR timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      child.stdin.write(`${JSON.stringify({ id, filePath: path.resolve(imagePath) })}\n`, error => {
        if (!error) return;
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      });
    });
  }

  recognize(imagePath) {
    const task = this.serial.then(() => this.send(imagePath));
    this.serial = task.then(() => undefined, () => undefined);
    return task;
  }

  shutdown() {
    if (!this.child) return;
    const child = this.child;
    this.rejectPending(new Error('Paddle OCR worker is shutting down'));
    this.reset(child);
    child.kill();
  }
}

async function recognizeWithTesseract(imagePath, tesseract = Tesseract) {
  const { data = {} } = await tesseract.recognize(imagePath, 'eng', { logger: () => {} });
  return {
    engine: 'tesseract', text: data.text || '', confidence: data.confidence || 0,
    lines: (data.lines || []).map(line => ({ text: line.text, confidence: line.confidence })),
    warnings: ['Paddle OCR was unavailable; Tesseract fallback was used.']
  };
}

function createOcrService(options = {}) {
  const worker = options.worker || new PaddleOcrWorker(options);
  const fallback = options.tesseractRecognize || (imagePath => recognizeWithTesseract(imagePath));
  async function recognize(imagePath) {
    try { return await worker.recognize(imagePath); }
    catch (error) {
      console.error('[paddle-ocr] Primary OCR failed; using Tesseract fallback', error.message);
      return fallback(imagePath);
    }
  }
  return { recognize, extractText: async imagePath => (await recognize(imagePath)).text, shutdown: () => worker.shutdown(), worker };
}

const service = createOcrService();
process.once('SIGINT', () => service.shutdown());
process.once('SIGTERM', () => service.shutdown());

module.exports = { ...service, ENGINE, DETECTOR_MODEL, RECOGNIZER_MODEL, PaddleOcrWorker, createOcrService, recognizeWithTesseract, resolvePythonPath };