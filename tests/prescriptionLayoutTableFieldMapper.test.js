const { extractMedicationCandidates } = require('../src/services/prescriptionLayoutExtractorService');

function cell(text, rowIndex, columnIndex, cellIndex, tableIndex = 0) {
  return {
    text,
    rowIndex,
    columnIndex,
    rowSpan: 1,
    columnSpan: 1,
    kind: 'content',
    spans: [{ offset: cellIndex * 30, length: text.length }],
    boundingRegions: [{ pageNumber: 1, polygon: [columnIndex * 120, rowIndex * 40, columnIndex * 120 + 110, rowIndex * 40, columnIndex * 120 + 110, rowIndex * 40 + 30, columnIndex * 120, rowIndex * 40 + 30] }],
    tableIndex
  };
}

function table(headers, rows) {
  let cellIndex = 0;
  const cells = headers.map((header, columnIndex) => cell(header, 0, columnIndex, cellIndex++));
  rows.forEach((row, rowIndex) => row.forEach((value, columnIndex) => cells.push(cell(value, rowIndex + 1, columnIndex, cellIndex++))));
  return { rowCount: rows.length + 1, columnCount: headers.length, cells };
}

function evidence(tables) {
  return { pages: [{ pageNumber: 1, width: 1000, height: 1600, lines: [], words: [] }], paragraphs: [], tables };
}

describe('Layout structural table field mapper', () => {
  test('maps an explicit six-column medication table directly from body cells', () => {
    const extraction = extractMedicationCandidates(evidence([table(
      ['S. No.', 'Medicine Name', 'Strength', 'Dosage Form', 'Quantity', 'Directions'],
      [
        ['1', 'ExampleDrugAlpha', '20 mg', 'Tablet', '10 tablets', '1 tablet 3 times daily for 3 days'],
        ['2', 'ExampleDrugBeta', '30 mg', 'Syrup', '100 ml', '10 ml twice daily for 5 days']
      ]
    )]));

    expect(extraction.candidates).toHaveLength(2);
    expect(extraction.candidates[0]).toMatchObject({
      medicineName: 'ExampleDrugAlpha', strength: '20 mg', dosageForm: 'Tablet', quantity: '10 tablets',
      instructions: '1 tablet 3 times daily for 3 days'
    });
    expect(extraction.candidates[1]).toMatchObject({
      medicineName: 'ExampleDrugBeta', strength: '30 mg', dosageForm: 'Syrup', quantity: '100 ml',
      instructions: '10 ml twice daily for 5 days'
    });
    expect(extraction.candidates[0].medicineName).not.toContain('1');
    expect(extraction.candidates[0].extractionConfidence.level).toBe('high');
  });

  test('maps reordered columns and normalizes multi-line instruction cell whitespace', () => {
    const extraction = extractMedicationCandidates(evidence([table(
      ['Directions', 'Qty', 'Drug', 'Form', 'Strength', 'Sr. No.'],
      [['1 tablet\n twice daily for 4 days', '3', 'ExampleDrugGamma', 'Capsule', '5 mg', '1']]
    )]));

    expect(extraction.candidates[0]).toMatchObject({
      medicineName: 'ExampleDrugGamma', strength: '5 mg', dosageForm: 'Capsule', quantity: '3',
      instructions: '1 tablet twice daily for 4 days'
    });
  });

  test('leaves missing and ambiguous header fields null while retaining raw table evidence', () => {
    const extraction = extractMedicationCandidates(evidence([table(
      ['Serial No.', 'Medicine', 'Details', 'Qty', 'Directions'],
      [['1', 'ExampleDrugDelta', '20 mg Tablet', '8', '1 tablet daily for 8 days']]
    )]));
    const candidate = extraction.candidates[0];

    expect(candidate).toMatchObject({ medicineName: 'ExampleDrugDelta', strength: null, dosageForm: null, quantity: '8', instructions: '1 tablet daily for 8 days' });
    expect(candidate.rawText).toContain('20 mg Tablet');
    expect(candidate.fieldEvidence.strength).toEqual([]);
    expect(candidate.fieldEvidence.dosageForm).toEqual([]);
  });

  test('leaves strength and quantity null when their columns are absent', () => {
    const extraction = extractMedicationCandidates(evidence([table(
      ['Serial No.', 'Medicine Name', 'Form', 'Directions'],
      [['1', 'ExampleDrugMissing', 'Spray', '1 spray daily for 5 days']]
    )]));

    expect(extraction.candidates[0]).toMatchObject({
      medicineName: 'ExampleDrugMissing', strength: null, dosageForm: 'Spray', quantity: null,
      instructions: '1 spray daily for 5 days'
    });
    expect(extraction.candidates[0].fieldEvidence.strength).toEqual([]);
    expect(extraction.candidates[0].fieldEvidence.quantity).toEqual([]);
  });

  test('preserves field-level source references and ignores unrelated tables', () => {
    const medicationTable = table(
      ['No.', 'Medication', 'Strength', 'Form', 'Quantity', 'Instructions'],
      [['1', 'ExampleDrugEpsilon', '40 mg', 'Tablet', '12', '1 tablet nightly for 12 days']]
    );
    const unrelatedTable = table(['Test', 'Result'], [['Synthetic marker', 'normal']]);
    const extraction = extractMedicationCandidates(evidence([unrelatedTable, medicationTable]));
    const candidate = extraction.candidates[0];

    expect(extraction.candidates).toHaveLength(1);
    expect(candidate.fieldEvidence).toMatchObject({
      medicineName: [expect.objectContaining({ tableIndex: 1, rowIndex: 1, columnIndex: 1 })],
      strength: [expect.objectContaining({ tableIndex: 1, rowIndex: 1, columnIndex: 2 })],
      dosageForm: [expect.objectContaining({ tableIndex: 1, rowIndex: 1, columnIndex: 3 })],
      quantity: [expect.objectContaining({ tableIndex: 1, rowIndex: 1, columnIndex: 4 })],
      instructions: [expect.objectContaining({ tableIndex: 1, rowIndex: 1, columnIndex: 5 })]
    });
    expect(candidate.sourceEvidence.references).toEqual(expect.arrayContaining([expect.objectContaining({ spans: expect.any(Array), boundingRegions: expect.any(Array) })]));
  });
});
