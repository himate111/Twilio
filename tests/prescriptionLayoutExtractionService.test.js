const {
  resolvePrescriptionExtractionMode,
  layoutExtractionErrorCategory,
  validateLayoutCandidates,
  createLayoutExtractionService
} = require('../src/services/prescriptionLayoutExtractionService');

function candidate(overrides = {}) {
  return {
    rawText: 'synthetic source text',
    medicineName: 'ExampleDrug',
    strength: '20 mg',
    dosageForm: 'Tablet',
    quantity: null,
    instructions: 'one tablet daily',
    sourceEvidence: { sourceType: 'geometry', references: [{ kind: 'line' }] },
    fieldEvidence: { medicineName: [{ kind: 'line' }], strength: [{ kind: 'line' }], dosageForm: [{ kind: 'line' }], quantity: [], instructions: [{ kind: 'line' }] },
    extractionConfidence: { level: 'medium', score: 0.72, signals: ['geometryRow', 'identitySignal', 'alignedSeries'] },
    ...overrides
  };
}

describe('prescriptionLayoutExtractionService', () => {
  test('defaults to legacy mode and only accepts the explicit layout mode', () => {
    expect(resolvePrescriptionExtractionMode()).toBe('legacy');
    expect(resolvePrescriptionExtractionMode('legacy')).toBe('legacy');
    expect(resolvePrescriptionExtractionMode('unexpected')).toBe('legacy');
    expect(resolvePrescriptionExtractionMode('layout')).toBe('layout');
  });

  test('validates high-confidence structured table medication rows and preserves explicit package quantity', () => {
    const result = validateLayoutCandidates([candidate({
      sourceEvidence: { sourceType: 'table', references: [{ kind: 'tableCell' }] },
      strength: null,
      dosageForm: null,
      quantity: '10',
      extractionConfidence: { level: 'high', score: 0.9, signals: ['tableRow', 'headerMapped', 'identitySignal'] }
    })]);

    expect(result.rejectedCount).toBe(0);
    expect(result.candidates).toEqual([expect.objectContaining({
      medicineText: 'ExampleDrug',
      prescribedQuantityText: '10',
      calculatedQuantity: null,
      explicitQuantity: 10,
      quantitySource: 'prescription_explicit',
      sourceEvidence: expect.any(Object),
      fieldEvidence: expect.any(Object)
    })]);
  });

  test('accepts structurally supported medium-confidence geometry medication rows but rejects advice/footer candidates', () => {
    const result = validateLayoutCandidates([
      candidate(),
      candidate({
        medicineName: 'Advice footer',
        strength: null,
        dosageForm: 'Tablet',
        sourceEvidence: { sourceType: 'geometry', references: [{ kind: 'line' }] },
        extractionConfidence: { level: 'low', score: 0.31, signals: ['geometryRow', 'identitySignal'] }
      })
    ]);

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].medicineText).toBe('ExampleDrug 20 mg Tablet');
    expect(result.rejectedCount).toBe(1);
  });

  test('does not accept a geometry candidate solely because it contains a dosage-form word', () => {
    const result = validateLayoutCandidates([candidate({
      medicineName: 'Document note',
      strength: null,
      dosageForm: 'Tablet',
      extractionConfidence: { level: 'medium', score: 0.65, signals: ['geometryRow', 'identitySignal'] }
    })]);

    expect(result.candidates).toEqual([]);
    expect(result.rejectedCount).toBe(1);
  });

  test('does not turn a dosage schedule into a dispensing quantity', () => {
    const result = validateLayoutCandidates([candidate({
      quantity: null,
      instructions: '1 tablet three times daily for 3 days'
    })]);

    expect(result.candidates[0]).toMatchObject({
      prescribedQuantityText: null,
      calculatedQuantity: null,
      explicitQuantity: null,
      quantitySource: 'manual_input_required'
    });
  });

  test('runs canonical Layout extraction and surfaces extraction failure without parser fallback', async () => {
    const client = { analyze: jest.fn().mockResolvedValue({ pages: [] }) };
    const extractor = jest.fn().mockReturnValue({ candidates: [candidate()] });
    const service = createLayoutExtractionService({ client, extractor });

    await expect(service.extract('synthetic-image.jpg')).resolves.toMatchObject({
      candidates: [expect.objectContaining({ medicineText: 'ExampleDrug 20 mg Tablet' })]
    });
    expect(client.analyze).toHaveBeenCalledWith('synthetic-image.jpg');
    expect(extractor).toHaveBeenCalledWith({ pages: [] });

    const failing = createLayoutExtractionService({
      client: { analyze: jest.fn().mockResolvedValue({ pages: [] }) },
      extractor: jest.fn(() => { throw new Error('synthetic'); })
    });
    await expect(failing.extract('synthetic-image.jpg')).rejects.toMatchObject({ code: 'LAYOUT_EXTRACTION_FAILED' });
  });

  test('uses sanitized error categories', () => {
    expect(layoutExtractionErrorCategory({ code: 'AZURE_TIMEOUT' })).toBe('AZURE_TIMEOUT');
    expect(layoutExtractionErrorCategory({ code: 'unexpected' })).toBe('LAYOUT_EXTRACTION_FAILED');
  });
});
