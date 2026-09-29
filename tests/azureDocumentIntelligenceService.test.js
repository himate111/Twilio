const fs = require('fs');
const {
  AZURE_API_VERSION,
  AZURE_MODEL_ID,
  AzureDocumentIntelligenceClient,
  AzureOcrError,
  normaliseAzureAnalyzeResult
} = require('../src/services/azureDocumentIntelligenceService');
const { createOcrService, resolveOcrProvider } = require('../src/services/prescriptionOcrService');

const sampleResult = {
  content: 'Patient Name: Jane Doe\nMetformin 500 mg\nTake 1 tablet twice daily for 30 days',
  pages: [
    { pageNumber: 1, width: 1000, height: 1400, unit: 'pixel', lines: [
      { content: 'Patient Name: Jane Doe', polygon: [10, 10, 310, 10, 310, 35, 10, 35], words: [
        { content: 'Patient', confidence: 0.99, polygon: [10, 10, 100, 10, 100, 35, 10, 35] },
        { content: 'Name:', confidence: 0.98, polygon: [105, 10, 160, 10, 160, 35, 105, 35] },
        { content: 'Jane', confidence: 0.97, polygon: [170, 10, 220, 10, 220, 35, 170, 35] },
        { content: 'Doe', confidence: 0.96, polygon: [230, 10, 310, 10, 310, 35, 230, 35] }
      ] },
      { content: 'Metformin 500 mg', polygon: [10, 90, 250, 90, 250, 120, 10, 120], words: [
        { content: 'Metformin', confidence: 0.93, polygon: [10, 90, 120, 90, 120, 120, 10, 120] },
        { content: '500', confidence: 0.92, polygon: [130, 90, 180, 90, 180, 120, 130, 120] },
        { content: 'mg', confidence: 0.91, polygon: [190, 90, 250, 90, 250, 120, 190, 120] }
      ] }
    ] },
    { pageNumber: 2, width: 1000, height: 1400, unit: 'pixel', lines: [
      { content: 'Take 1 tablet twice daily for 30 days', polygon: [20, 60, 450, 60, 450, 90, 20, 90], words: [
        { content: 'Take', confidence: 0.88, polygon: [20, 60, 70, 60, 70, 90, 20, 90] }
      ] }
    ] }
  ]
};

function environment(overrides = {}) {
  return { AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT: 'https://example.cognitiveservices.azure.com/', AZURE_DOCUMENT_INTELLIGENCE_KEY: 'unit-test-key', ...overrides };
}

describe('Azure Document Intelligence prebuilt-read adapter', () => {
  test('uses the documented GA API and prebuilt-read model', () => {
    expect(AZURE_API_VERSION).toBe('2024-11-30');
    expect(AZURE_MODEL_ID).toBe('prebuilt-read');
  });

  test('normalizes page-ordered text, geometry, words, and confidence without changing reading order', () => {
    const recognition = normaliseAzureAnalyzeResult(sampleResult);
    expect(recognition.text).toBe('Patient Name: Jane Doe\nMetformin 500 mg\nTake 1 tablet twice daily for 30 days');
    expect(recognition.fullText).toBe(sampleResult.content);
    expect(recognition.pages).toHaveLength(2);
    expect(recognition.lines.map(line => line.pageNumber)).toEqual([1, 1, 2]);
    expect(recognition.lines[1]).toMatchObject({ box: [10, 90, 250, 120], polygon: [10, 90, 250, 90, 250, 120, 10, 120], confidence: 0.92 });
    expect(recognition.lines[1].words[0]).toMatchObject({ text: 'Metformin', confidence: 0.93, box: [10, 90, 120, 120] });
    expect(recognition.pages[0]).toMatchObject({ pageNumber: 1, width: 1000, height: 1400, unit: 'pixel' });
  });

  test('rejects malformed and empty Azure output safely', () => {
    expect(() => normaliseAzureAnalyzeResult({})).toThrow('malformed');
    expect(() => normaliseAzureAnalyzeResult({ pages: [], content: '' })).toThrow('no recognized text');
  });

  test('submits the image then bounded-polls the returned operation location', async () => {
    const http = jest.fn()
      .mockResolvedValueOnce({ headers: { 'operation-location': 'https://example.cognitiveservices.azure.com/documentintelligence/documentModels/prebuilt-read/analyzeResults/abc?api-version=2024-11-30' } })
      .mockResolvedValueOnce({ data: { status: 'running' } })
      .mockResolvedValueOnce({ data: { status: 'succeeded', analyzeResult: sampleResult } });
    const sleep = jest.fn().mockResolvedValue();
    const client = new AzureDocumentIntelligenceClient({ environment: environment(), http, sleep, readFile: jest.fn().mockResolvedValue(Buffer.from('image')), timeoutMs: 10_000, pollIntervalMs: 5 });
    await expect(client.recognize('prescription.jpg')).resolves.toMatchObject({ engine: 'azure-document-intelligence-prebuilt-read', text: expect.stringContaining('Metformin') });
    expect(http).toHaveBeenCalledTimes(3);
    expect(http.mock.calls[0][0]).toMatchObject({ method: 'POST', url: expect.stringContaining(`/documentModels/${AZURE_MODEL_ID}:analyze?api-version=${AZURE_API_VERSION}`), headers: expect.objectContaining({ 'Content-Type': 'image/jpeg' }) });
    expect(sleep).toHaveBeenCalledWith(5);
  });

  test.each([
    [{ AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT: '' }, 'AZURE_ENDPOINT_MISSING'],
    [{ AZURE_DOCUMENT_INTELLIGENCE_KEY: '' }, 'AZURE_KEY_MISSING']
  ])('handles missing Azure configuration safely', async (overrides, code) => {
    const client = new AzureDocumentIntelligenceClient({ environment: environment(overrides), readFile: jest.fn() });
    await expect(client.recognize('prescription.jpg')).rejects.toMatchObject({ code });
  });

  test.each([401, 403, 429])('sanitizes Azure HTTP %i failures without exposing a key', async status => {
    const secret = 'not-for-logs-secret';
    const http = jest.fn().mockRejectedValue({ response: { status, data: { error: { code: 'MockFailure', message: secret } } } });
    const client = new AzureDocumentIntelligenceClient({ environment: environment({ AZURE_DOCUMENT_INTELLIGENCE_KEY: secret }), http, readFile: jest.fn().mockResolvedValue(Buffer.from('image')) });
    await expect(client.recognize('prescription.jpg')).rejects.toMatchObject({ code: status === 429 ? 'AZURE_HTTP_429' : `AZURE_HTTP_${status}` });
    try { await client.recognize('prescription.jpg'); } catch (error) { expect(error.message).not.toContain(secret); }
  });

  test('sanitizes network timeout failures', async () => {
    const client = new AzureDocumentIntelligenceClient({ environment: environment(), http: jest.fn().mockRejectedValue({ code: 'ECONNABORTED', message: 'timeout' }), readFile: jest.fn().mockResolvedValue(Buffer.from('image')) });
    await expect(client.recognize('prescription.png')).rejects.toMatchObject({ code: 'AZURE_TIMEOUT' });
  });
});

describe('OCR provider selection and deterministic fallbacks', () => {
  test.each([[undefined, 'paddle'], ['', 'paddle'], ['invalid', 'paddle'], ['paddle', 'paddle'], ['azure', 'azure']])('resolves %p to %s', (value, expected) => expect(resolveOcrProvider(value)).toBe(expected));

  test('uses Azure only when explicitly selected and does not send duplicate results to Paddle', async () => {
    const worker = { recognize: jest.fn(), shutdown: jest.fn() };
    const azureClient = { recognize: jest.fn().mockResolvedValue({ text: 'Azure only', lines: [], warnings: [] }) };
    const service = createOcrService({ environment: environment({ PRESCRIPTION_OCR_PROVIDER: 'azure' }), worker, azureClient, tesseractRecognize: jest.fn() });
    await expect(service.extractText('image.jpg')).resolves.toBe('Azure only');
    expect(service.provider).toBe('azure'); expect(worker.recognize).not.toHaveBeenCalled();
  });

  test('falls back once from Azure to Paddle and retains Paddle-to-Tesseract behavior', async () => {
    const worker = { recognize: jest.fn().mockRejectedValue(new AzureOcrError('PADDLE_FAILED', 'Paddle failed')), shutdown: jest.fn() };
    const azureClient = { recognize: jest.fn().mockRejectedValue(new AzureOcrError('AZURE_TIMEOUT', 'Azure timed out')) };
    const tesseractRecognize = jest.fn().mockResolvedValue({ engine: 'tesseract', text: 'fallback', lines: [], warnings: [] });
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const service = createOcrService({ environment: environment({ PRESCRIPTION_OCR_PROVIDER: 'azure' }), worker, azureClient, tesseractRecognize });
      await expect(service.extractText('image.jpg')).resolves.toBe('fallback');
      expect(azureClient.recognize).toHaveBeenCalledTimes(1); expect(worker.recognize).toHaveBeenCalledTimes(1); expect(tesseractRecognize).toHaveBeenCalledTimes(1);
    } finally { log.mockRestore(); }
  });

  test('benchmark utility does not import database or dispensing code', () => {
    const source = fs.readFileSync(require.resolve('../scripts/benchmark-prescription-ocr.js'), 'utf8');
    expect(source).not.toMatch(/config\/db|dispensingService|StockTransaction|DispensingRecord|sendMessagesSequentially/);
  });
});
