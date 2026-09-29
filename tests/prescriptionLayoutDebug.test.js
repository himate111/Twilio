const {
  createLayoutShadowRunner,
  isLayoutDebugEnabled
} = require('../src/services/prescriptionLayoutShadowService');
const { createOcrService } = require('../src/services/prescriptionOcrService');

const evidence = { pages: [{ pageNumber: 1, width: 100, height: 100, lines: [], words: [] }], paragraphs: [], tables: [] };
const extraction = {
  candidates: [{
    rawText: 'SyntheticExample 10 mg Tablet',
    sourceEvidence: { sourceType: 'geometry', references: [] },
    medicineName: 'SyntheticExample',
    strength: '10 mg',
    dosageForm: 'Tablet',
    quantity: null,
    instructions: '1-0-1 x 3 days',
    extractionConfidence: { level: 'high', score: 0.9, signals: ['geometryRow'] }
  }],
  metrics: { candidates: 1, highConfidence: 1, mediumConfidence: 0, lowConfidence: 0, tableDerived: 0, geometryDerived: 1 }
};

function runnerOptions(overrides = {}) {
  return {
    enabled: true,
    client: { analyze: jest.fn().mockResolvedValue(evidence) },
    extractor: jest.fn().mockReturnValue(extraction),
    logger: { log: jest.fn(), error: jest.fn() },
    ...overrides
  };
}

describe('local Layout extractor debug output', () => {
  test('is disabled by default and for non-true values', () => {
    expect(isLayoutDebugEnabled({ NODE_ENV: 'development' })).toBe(false);
    expect(isLayoutDebugEnabled({ NODE_ENV: 'development', PRESCRIPTION_LAYOUT_DEBUG: 'false' })).toBe(false);
    expect(isLayoutDebugEnabled({ NODE_ENV: 'development', PRESCRIPTION_LAYOUT_DEBUG: '1' })).toBe(false);
  });

  test('cannot be enabled in production', async () => {
    expect(isLayoutDebugEnabled({ NODE_ENV: 'production', PRESCRIPTION_LAYOUT_DEBUG: 'true' })).toBe(false);
    const options = runnerOptions({ debugEnabled: isLayoutDebugEnabled({ NODE_ENV: 'production', PRESCRIPTION_LAYOUT_DEBUG: 'true' }) });

    await expect(createLayoutShadowRunner(options)('fixture.jpg')).resolves.toBe(evidence);
    const logs = options.logger.log.mock.calls.flat().join('\n');
    expect(logs).toContain('[PRESCRIPTION SHADOW EXTRACTOR] candidates: 1');
    expect(logs).not.toContain('Candidate 1');
    expect(logs).not.toContain('SyntheticExample');
  });

  test('prints detailed candidates only when explicitly enabled locally without changing extraction output', async () => {
    expect(isLayoutDebugEnabled({ NODE_ENV: 'development', PRESCRIPTION_LAYOUT_DEBUG: 'true' })).toBe(true);
    const options = runnerOptions({ debugEnabled: true });
    const runner = createLayoutShadowRunner(options);

    await expect(runner('fixture.jpg')).resolves.toBe(evidence);
    expect(options.extractor).toHaveBeenCalledWith(evidence);
    const logs = options.logger.log.mock.calls.flat().join('\n');
    expect(logs).toContain('[PRESCRIPTION SHADOW EXTRACTOR] Candidate 1');
    expect(logs).toContain('Source: geometry');
    expect(logs).toContain('Confidence: high');
    expect(logs).toContain('Medicine name: SyntheticExample');
    expect(logs).toContain('Raw text: SyntheticExample 10 mg Tablet');

    const service = createOcrService({
      worker: { recognize: jest.fn(), shutdown: jest.fn() },
      azureClient: { recognize: jest.fn().mockResolvedValue({ engine: 'azure', text: '', lines: [], warnings: [] }) },
      layoutShadowClient: { analyze: jest.fn().mockResolvedValue(evidence) },
      layoutShadowExtractor: options.extractor,
      shadowLogger: options.logger,
      environment: { NODE_ENV: 'development', PRESCRIPTION_OCR_PROVIDER: 'azure', PRESCRIPTION_LAYOUT_SHADOW_ENABLED: 'true', PRESCRIPTION_LAYOUT_DEBUG: 'true' }
    });

    await expect(service.recognize('fixture.jpg')).resolves.toMatchObject({ engine: 'azure' });
  });
});
