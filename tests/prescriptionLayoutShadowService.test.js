const {
  AZURE_API_VERSION,
  AZURE_LAYOUT_MODEL_ID,
  AzureDocumentIntelligenceLayoutClient,
  AzureOcrError,
  normaliseAzureLayoutAnalyzeResult
} = require('../src/services/azureDocumentIntelligenceService');
const { createOcrService } = require('../src/services/prescriptionOcrService');
const {
  isLayoutShadowEnabled,
  createLayoutShadowRunner
} = require('../src/services/prescriptionLayoutShadowService');
const { structuralMetrics } = require("../src/services/documentEvidenceService");

function environment(overrides = {}) {
  return {
    AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT: 'https://example.cognitiveservices.azure.com',
    AZURE_DOCUMENT_INTELLIGENCE_KEY: 'test-key',
    ...overrides
  };
}

function layoutResult() {
  return {
    pages: [{
      pageNumber: 1,
      width: 1000,
      height: 1400,
      unit: 'pixel',
      angle: 0,
      words: [{
        content: "Sensitive",
        confidence: 0.96,
        polygon: [10, 20, 90, 20, 90, 50, 10, 50],
        spans: [{ offset: 0, length: 9 }]
      }],
      lines: [{
        content: 'Sensitive prescription content',
        polygon: [10, 20, 210, 20, 210, 50, 10, 50],
        confidence: 0.97,
        spans: [{ offset: 0, length: 28 }]
      }]
    }],
    paragraphs: [{
      content: 'Sensitive prescription content',
      role: 'sectionHeading',
      spans: [{ offset: 0, length: 28 }],
      boundingRegions: [{ pageNumber: 1, polygon: [10, 20, 210, 20, 210, 50, 10, 50] }]
    }],
    tables: [{
      rowCount: 1,
      columnCount: 2,
      spans: [{ offset: 0, length: 28 }],
      boundingRegions: [{ pageNumber: 1, polygon: [10, 80, 400, 80, 400, 130, 10, 130] }],
      cells: [{
        content: 'Sensitive',
        rowIndex: 0,
        columnIndex: 0,
        rowSpan: 1,
        columnSpan: 1,
        kind: 'content',
        spans: [{ offset: 0, length: 9 }],
        boundingRegions: [{ pageNumber: 1, polygon: [10, 80, 200, 80, 200, 130, 10, 130] }]
      }]
    }]
  };
}

describe('prescription Layout shadow evidence', () => {
  test('shadow flag defaults to false and only enables on true', () => {
    expect(isLayoutShadowEnabled(undefined)).toBe(false);
    expect(isLayoutShadowEnabled('false')).toBe(false);
    expect(isLayoutShadowEnabled('TRUE')).toBe(true);
  });

  test('normalizes canonical Layout evidence without semantic interpretation', () => {
    const evidence = normaliseAzureLayoutAnalyzeResult(layoutResult());

    expect(evidence.source).toBe('azure-document-intelligence-prebuilt-layout');
    expect(evidence.pages[0]).toMatchObject({ pageNumber: 1, width: 1000, height: 1400, unit: 'pixel', angle: 0 });
    expect(evidence.pages[0].lines[0]).toMatchObject({
      text: 'Sensitive prescription content',
      polygon: [10, 20, 210, 20, 210, 50, 10, 50],
      confidence: 0.97,
      spans: [{ offset: 0, length: 28 }],
      readingOrder: 0
    });
    expect(evidence.pages[0].words[0]).toMatchObject({
      text: 'Sensitive', confidence: 0.96, spans: [{ offset: 0, length: 9 }]
    });
    expect(structuralMetrics(evidence)).toMatchObject({ pages: 1, lines: 1, words: 1, tables: 1, paragraphs: 1 });
    expect(evidence.paragraphs[0]).toMatchObject({ role: 'sectionHeading', spans: [{ offset: 0, length: 28 }] });
    expect(evidence.tables[0]).toMatchObject({ rowCount: 1, columnCount: 2 });
    expect(evidence.tables[0].cells[0]).toMatchObject({ rowIndex: 0, columnIndex: 0, kind: 'content' });
  });

  test('uses the Layout model with bounded polling and canonical evidence', async () => {
    const http = jest.fn()
      .mockResolvedValueOnce({ headers: { 'operation-location': 'https://example.cognitiveservices.azure.com/documentintelligence/documentModels/prebuilt-layout/analyzeResults/abc?api-version=2024-11-30' } })
      .mockResolvedValueOnce({ data: { status: 'succeeded', analyzeResult: layoutResult() } });
    const client = new AzureDocumentIntelligenceLayoutClient({
      environment: environment(), http, sleep: jest.fn(), readFile: jest.fn().mockResolvedValue(Buffer.from('image')),
      timeoutMs: 10_000, pollIntervalMs: 5
    });

    await expect(client.analyze('prescription.jpg')).resolves.toMatchObject({ source: 'azure-document-intelligence-prebuilt-layout' });
    expect(AZURE_LAYOUT_MODEL_ID).toBe('prebuilt-layout');
    expect(http.mock.calls[0][0]).toMatchObject({
      method: 'POST',
      url: expect.stringContaining(`/documentModels/${AZURE_LAYOUT_MODEL_ID}:analyze?api-version=${AZURE_API_VERSION}`)
    });
  });
});

describe('prescription Layout shadow isolation', () => {
  const liveRecognition = { engine: 'paddle-ocr-v6', text: 'live OCR result', confidence: 0.9, lines: [], warnings: [] };

  const settleShadow = () => new Promise(resolve => setImmediate(resolve));
  test('does not call Layout when shadow mode is disabled and returns the unchanged live result', async () => {
    const worker = { recognize: jest.fn().mockResolvedValue(liveRecognition), shutdown: jest.fn() };
    const layoutShadowClient = { analyze: jest.fn() };
    const service = createOcrService({ worker, layoutShadowClient, environment: environment() });

    await expect(service.recognize('fixture.jpg')).resolves.toBe(liveRecognition);
    expect(service.layoutShadowEnabled).toBe(false);
    expect(layoutShadowClient.analyze).not.toHaveBeenCalled();
  });

  test('runs Layout only in shadow mode while returning the unchanged live result', async () => {
    const worker = { recognize: jest.fn().mockResolvedValue(liveRecognition), shutdown: jest.fn() };
    const layoutShadowClient = { analyze: jest.fn().mockResolvedValue(normaliseAzureLayoutAnalyzeResult(layoutResult())) };
    const logger = { log: jest.fn(), error: jest.fn() };
    const service = createOcrService({
      worker,
      layoutShadowClient,
      shadowLogger: logger,
      environment: environment({ PRESCRIPTION_LAYOUT_SHADOW_ENABLED: 'true' })
    });

    await expect(service.recognize('fixture.jpg')).resolves.toBe(liveRecognition);
    await settleShadow();
    expect(service.layoutShadowEnabled).toBe(true);
    expect(layoutShadowClient.analyze).toHaveBeenCalledWith('fixture.jpg');
    expect(logger.log).toHaveBeenCalledWith('[PRESCRIPTION SHADOW] layout started');
    expect(logger.log).toHaveBeenCalledWith('[PRESCRIPTION SHADOW] layout succeeded');
    expect(logger.log).toHaveBeenCalledWith('[PRESCRIPTION SHADOW] pages: 1');
    expect(logger.log).toHaveBeenCalledWith('[PRESCRIPTION SHADOW] lines: 1');
    expect(logger.log).toHaveBeenCalledWith('[PRESCRIPTION SHADOW] words: 1');
    expect(logger.log).toHaveBeenCalledWith('[PRESCRIPTION SHADOW] tables: 1');
    expect(logger.log).toHaveBeenCalledWith('[PRESCRIPTION SHADOW] paragraphs: 1');
    expect(logger.log.mock.calls.flat().join('\n')).not.toContain('Sensitive prescription content');
  });

  test('isolates Layout failures and does not log sensitive evidence text', async () => {
    const worker = { recognize: jest.fn().mockResolvedValue(liveRecognition), shutdown: jest.fn() };
    const layoutShadowClient = { analyze: jest.fn().mockRejectedValue(new AzureOcrError('AZURE_TIMEOUT', 'Sensitive prescription content')) };
    const logger = { log: jest.fn(), error: jest.fn() };
    const service = createOcrService({
      worker,
      layoutShadowClient,
      shadowLogger: logger,
      environment: environment({ PRESCRIPTION_LAYOUT_SHADOW_ENABLED: 'true' })
    });

    await expect(service.recognize('fixture.jpg')).resolves.toBe(liveRecognition);
    await settleShadow();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('category=AZURE_TIMEOUT'));
    const logs = [...logger.log.mock.calls, ...logger.error.mock.calls].flat().join('\n');
    expect(logs).not.toContain('Sensitive prescription content');
  });


  test("returns the live Azure result while a slow Layout shadow remains pending", async () => {
    let completeLayout;
    const pendingLayout = new Promise(resolve => { completeLayout = resolve; });
    const azureClient = { recognize: jest.fn().mockResolvedValue(liveRecognition) };
    const layoutShadowClient = { analyze: jest.fn().mockReturnValue(pendingLayout) };
    const logger = { log: jest.fn(), error: jest.fn() };
    const service = createOcrService({
      worker: { recognize: jest.fn(), shutdown: jest.fn() },
      azureClient,
      layoutShadowClient,
      shadowLogger: logger,
      environment: environment({ PRESCRIPTION_OCR_PROVIDER: "azure", PRESCRIPTION_LAYOUT_SHADOW_ENABLED: "true" })
    });

    await expect(service.recognize("fixture.jpg")).resolves.toBe(liveRecognition);
    expect(azureClient.recognize).toHaveBeenCalledWith("fixture.jpg");
    expect(layoutShadowClient.analyze).toHaveBeenCalledWith("fixture.jpg");
    expect(logger.log).toHaveBeenCalledWith("[PRESCRIPTION SHADOW] layout started");
    expect(logger.log).not.toHaveBeenCalledWith("[PRESCRIPTION SHADOW] layout succeeded");

    completeLayout(normaliseAzureLayoutAnalyzeResult(layoutResult()));
    await settleShadow();
    expect(logger.log).toHaveBeenCalledWith("[PRESCRIPTION SHADOW] layout succeeded");
  });

  test("handles an unexpected shadow-runner rejection without affecting live OCR", async () => {
    const terminalLogger = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      const logger = { log: jest.fn(() => { throw new Error("unexpected shadow logger failure"); }), error: jest.fn() };
      const service = createOcrService({
        worker: { recognize: jest.fn(), shutdown: jest.fn() },
        azureClient: { recognize: jest.fn().mockResolvedValue(liveRecognition) },
        layoutShadowClient: { analyze: jest.fn() },
        shadowLogger: logger,
        environment: environment({ PRESCRIPTION_OCR_PROVIDER: "azure", PRESCRIPTION_LAYOUT_SHADOW_ENABLED: "true" })
      });

      await expect(service.recognize("fixture.jpg")).resolves.toBe(liveRecognition);
      await settleShadow();
      expect(terminalLogger).toHaveBeenCalledWith("[PRESCRIPTION SHADOW] layout failed category=LAYOUT_FAILED");
    } finally {
      terminalLogger.mockRestore();
    }
  });

  test("logs live recognition duration before pending Layout completes", async () => {
    let completeLayout;
    const pendingLayout = new Promise(resolve => { completeLayout = resolve; });
    const ocrLogger = jest.spyOn(console, "log").mockImplementation(() => {});
    try {
      const service = createOcrService({
        worker: { recognize: jest.fn(), shutdown: jest.fn() },
        azureClient: { recognize: jest.fn().mockResolvedValue(liveRecognition) },
        layoutShadowClient: { analyze: jest.fn().mockReturnValue(pendingLayout) },
        shadowLogger: { log: jest.fn(), error: jest.fn() },
        environment: environment({ PRESCRIPTION_OCR_PROVIDER: "azure", PRESCRIPTION_LAYOUT_SHADOW_ENABLED: "true" })
      });

      await expect(service.recognize("fixture.jpg")).resolves.toBe(liveRecognition);
      expect(ocrLogger).toHaveBeenCalledWith(expect.stringMatching(/^\[PRESCRIPTION OCR\] recognition duration: \d+ms$/));
      completeLayout(normaliseAzureLayoutAnalyzeResult(layoutResult()));
      await settleShadow();
    } finally {
      ocrLogger.mockRestore();
    }
  });
  test('shadow runner returns no evidence when disabled', async () => {
    const client = { analyze: jest.fn() };
    const runShadow = createLayoutShadowRunner({ enabled: false, client, logger: { log: jest.fn(), error: jest.fn() } });
    await expect(runShadow('fixture.jpg')).resolves.toBeNull();
    expect(client.analyze).not.toHaveBeenCalled();
  });
});
