const {
  extractMedicationCandidates,
  compareCandidateCounts
} = require('../src/services/prescriptionLayoutExtractorService');
const { createLayoutShadowRunner } = require('../src/services/prescriptionLayoutShadowService');
const { createOcrService } = require('../src/services/prescriptionOcrService');

function line(text, left, top, confidence = 0.95) {
  return {
    text,
    confidence,
    spans: [{ offset: top, length: text.length }],
    polygon: [left, top, left + 240, top, left + 240, top + 24, left, top + 24]
  };
}

function cell(text, rowIndex, columnIndex, cellIndex) {
  return {
    text,
    rowIndex,
    columnIndex,
    spans: [{ offset: cellIndex * 20, length: text.length }],
    boundingRegions: [{ pageNumber: 1, polygon: [columnIndex * 200, rowIndex * 40, columnIndex * 200 + 180, rowIndex * 40, columnIndex * 200 + 180, rowIndex * 40 + 30, columnIndex * 200, rowIndex * 40 + 30] }]
  };
}

function tableEvidence() {
  return {
    pages: [{ pageNumber: 1, width: 1000, height: 1600, unit: 'pixel', angle: 0, lines: [], words: [] }],
    paragraphs: [],
    tables: [{
      rowCount: 3,
      columnCount: 3,
      cells: [
        cell('Product', 0, 0, 0), cell('Details', 0, 1, 1), cell('Directions', 0, 2, 2),
        cell('ExampleDrugAlpha', 1, 0, 3), cell('20 mg Tablet', 1, 1, 4), cell('Qty: 1 bottle', 1, 2, 5),
        cell('ExampleDrugBeta', 2, 0, 6), cell('Suspension (60 ml)', 2, 1, 7), cell('5 ml BD x 3 days', 2, 2, 8)
      ]
    }]
  };
}

function geometryEvidence() {
  return {
    pages: [
      {
        pageNumber: 1, width: 1000, height: 1600, unit: 'pixel', angle: 0, words: [],
        lines: [
          line('Unrelated header', 80, 30),
          line('ExampleDrugGamma 10 mg Tablet', 100, 180),
          line('1-0-1 x 5 days', 620, 180),
          line('ExampleDrugDelta', 100, 400),
          line('Syrup (100 ml)', 100, 440),
          line('10 ml x 5 days', 620, 480),
          line('ExampleDrugEpsilon Capsule', 100, 700),
          line('ExampleDrugZeta 5 mg Tablet', 100, 900),
          line('Ambiguous annotation', 510, 1040, 0.2),
          line('Unrelated footer', 100, 1540)
        ]
      },
      {
        pageNumber: 2, width: 1000, height: 1600, unit: 'pixel', angle: 0, words: [],
        lines: [line('ExampleDrugLow 5 mg Tablet', 100, 300, 0.1)]
      }
    ],
    paragraphs: [], tables: []
  };
}

describe('prescription Layout structural extractor', () => {
  test('groups generic table rows, preserves source evidence, and skips a non-medication header row', () => {
    const extraction = extractMedicationCandidates(tableEvidence());

    expect(extraction.candidates).toHaveLength(2);
    expect(extraction.metrics).toMatchObject({ candidates: 2, tableDerived: 2, geometryDerived: 0 });
    expect(extraction.candidates[0]).toMatchObject({ medicineName: 'ExampleDrugAlpha', strength: '20 mg', dosageForm: 'Tablet', quantity: '1 bottle', instructions: null });
    expect(extraction.candidates[1]).toMatchObject({ medicineName: 'ExampleDrugBeta', dosageForm: 'Suspension', quantity: '(60 ml)', instructions: '5 ml BD x 3 days' });
    extraction.candidates.forEach(candidate => {
      expect(candidate.sourceEvidence.sourceType).toBe('table');
      expect(candidate.sourceEvidence.references.length).toBeGreaterThan(0);
      expect(candidate.fieldEvidence.medicineName.length).toBeGreaterThan(0);
      expect(candidate.extractionConfidence).toEqual(expect.objectContaining({ score: expect.any(Number), level: expect.any(String) }));
    });
    expect(extraction.candidates[1].fieldEvidence.instructions[0]).toEqual(expect.objectContaining({ kind: 'tableCell', rowIndex: 2, columnIndex: 2 }));
  });

  test('groups geometry rows, keeps continuation and instruction evidence together, and preserves null fields', () => {
    const extraction = extractMedicationCandidates(geometryEvidence());
    const byName = new Map(extraction.candidates.map(candidate => [candidate.medicineName, candidate]));

    expect(extraction.metrics.geometryDerived).toBe(5);
    expect(byName.get('ExampleDrugGamma').instructions).toBe('1-0-1 x 5 days');
    expect(byName.get('ExampleDrugDelta')).toMatchObject({ dosageForm: 'Syrup', quantity: '(100 ml)', instructions: '10 ml x 5 days' });
    expect(byName.get('ExampleDrugEpsilon')).toMatchObject({ strength: null, dosageForm: 'Capsule', quantity: null });
    expect(byName.get('ExampleDrugZeta')).toMatchObject({ quantity: null });
    expect(byName.get('ExampleDrugLow').extractionConfidence.level).toBe('low');
    expect(byName.has('Unrelated header')).toBe(false);
    expect(byName.has('Unrelated footer')).toBe(false);
    expect(byName.has('Ambiguous annotation')).toBe(false);
    expect(byName.get('ExampleDrugDelta').sourceEvidence.references).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'line', pageNumber: 1 })]));
  });

  test('keeps ambiguous evidence out of confident medication data and is a pure evidence-only service', () => {
    const extraction = extractMedicationCandidates({
      pages: [{ pageNumber: 1, width: 1000, height: 1200, lines: [line('Uncertain annotation', 500, 500, 0.1)], words: [] }],
      paragraphs: [], tables: []
    });

    expect(extraction.candidates).toEqual([]);
    expect(compareCandidateCounts(4, extraction)).toEqual({ existingParserCandidates: 4, layoutExtractorCandidates: 0 });
    expect(compareCandidateCounts(['a', 'b'], { candidates: ['x', 'y', 'z'] })).toEqual({ existingParserCandidates: 2, layoutExtractorCandidates: 3 });
  });

  test('logs only extractor aggregates and isolates extractor failure from live OCR', async () => {
    const logger = { log: jest.fn(), error: jest.fn() };
    const evidence = { pages: [{ pageNumber: 1, width: 100, height: 100, lines: [], words: [] }], paragraphs: [], tables: [] };
    const extractor = jest.fn().mockReturnValue({
      candidates: [{ rawText: 'Synthetic private text' }],
      metrics: { candidates: 1, highConfidence: 1, mediumConfidence: 0, lowConfidence: 0, tableDerived: 1, geometryDerived: 0 }
    });
    const runner = createLayoutShadowRunner({ enabled: true, client: { analyze: jest.fn().mockResolvedValue(evidence) }, extractor, logger });

    await expect(runner('fixture.jpg')).resolves.toBe(evidence);
    const logs = [...logger.log.mock.calls, ...logger.error.mock.calls].flat().join('\n');
    expect(logs).toContain('[PRESCRIPTION SHADOW EXTRACTOR] candidates: 1');
    expect(logs).not.toContain('Synthetic private text');

    const service = createOcrService({
      worker: { recognize: jest.fn(), shutdown: jest.fn() },
      azureClient: { recognize: jest.fn().mockResolvedValue({ engine: 'azure', text: '', lines: [], warnings: [] }) },
      layoutShadowClient: { analyze: jest.fn().mockResolvedValue(evidence) },
      layoutShadowExtractor: jest.fn(() => { throw new Error('unexpected extractor failure'); }),
      shadowLogger: logger,
      environment: { PRESCRIPTION_OCR_PROVIDER: 'azure', PRESCRIPTION_LAYOUT_SHADOW_ENABLED: 'true' }
    });

    await expect(service.recognize('fixture.jpg')).resolves.toMatchObject({ engine: 'azure' });
    await new Promise(resolve => setImmediate(resolve));
    expect(logger.error).toHaveBeenCalledWith('[PRESCRIPTION SHADOW EXTRACTOR] failed category=EXTRACTION_FAILED');
  });
});
