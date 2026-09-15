const { PassThrough, Writable } = require('stream');
const fs = require('fs');
const path = require('path');
const {
  ENGINE,
  DETECTOR_MODEL,
  RECOGNIZER_MODEL,
  PaddleOcrWorker,
  createOcrService
} = require('../src/services/prescriptionOcrService');

function fakeChild() {
  const child = new (require('events'))();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.killed = false;
  child.kill = jest.fn(() => { child.killed = true; child.emit('exit', 0); });
  child.stdin = new Writable({
    write(chunk, _encoding, callback) {
      const request = JSON.parse(chunk.toString());
      child.stdout.write(`${JSON.stringify({ id: request.id, engine: ENGINE, text: `medicine-${request.filePath}`, confidence: 0.91, lines: [], warnings: [] })}\n`);
      callback();
    }
  });
  return child;
}

describe('prescriptionOcrService', () => {
  test('declares PP-OCRv6 Small models and engine in the Python worker', () => {
    const workerSource = fs.readFileSync(path.join(process.cwd(), 'ocr', 'ocr.py'), 'utf8');
    expect(ENGINE).toBe('paddle-ocr-v6');
    expect(DETECTOR_MODEL).toBe('PP-OCRv6_small_det');
    expect(RECOGNIZER_MODEL).toBe('PP-OCRv6_small_rec');
    expect(workerSource).toContain('text_detection_model_name=DETECTOR_MODEL');
    expect(workerSource).toContain('text_recognition_model_name=RECOGNIZER_MODEL');
  });

  test('uses Paddle first and preserves text compatibility without calling Tesseract', async () => {
    const worker = { recognize: jest.fn().mockResolvedValue({ engine: ENGINE, text: 'Amoxicillin 250mg', confidence: 0.95, lines: [], warnings: [] }), shutdown: jest.fn() };
    const fallback = jest.fn();
    const service = createOcrService({ worker, tesseractRecognize: fallback });
    await expect(service.extractText('fixture.jpg')).resolves.toBe('Amoxicillin 250mg');
    expect(worker.recognize).toHaveBeenCalledWith('fixture.jpg');
    expect(fallback).not.toHaveBeenCalled();
  });

  test('uses Tesseract only when Paddle fails', async () => {
    const worker = { recognize: jest.fn().mockRejectedValue(new Error('worker crashed')), shutdown: jest.fn() };
    const fallback = jest.fn().mockResolvedValue({ engine: 'tesseract', text: 'fallback text', confidence: 70, lines: [], warnings: [] });
    const service = createOcrService({ worker, tesseractRecognize: fallback });
    await expect(service.extractText('fixture.jpg')).resolves.toBe('fallback text');
    expect(fallback).toHaveBeenCalledTimes(1);
  });

  test('reuses one persistent worker across recognition requests', async () => {
    const child = fakeChild();
    const spawn = jest.fn(() => child);
    const worker = new PaddleOcrWorker({ spawn, pythonPath: 'python', workerScript: 'ocr.py', startupTimeoutMs: 1000 });
    const first = worker.recognize('first.jpg');
    await Promise.resolve();
    child.stdout.write('{"type":"ready"}\n');
    await expect(first).resolves.toMatchObject({ engine: ENGINE, text: expect.stringContaining('first.jpg') });
    await expect(worker.recognize('second.jpg')).resolves.toMatchObject({ engine: ENGINE, text: expect.stringContaining('second.jpg') });
    expect(spawn).toHaveBeenCalledTimes(1);
    worker.shutdown();
  });
});