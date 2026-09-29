const { extractMedicationCandidates } = require('../src/services/prescriptionLayoutExtractorService');

function line(text, left, top, confidence = 0.95) {
  return {
    text,
    confidence,
    spans: [{ offset: top, length: text.length }],
    polygon: [left, top, left + 360, top, left + 360, top + 24, left, top + 24]
  };
}

function evidence(lines, pageNumber = 1) {
  return { pages: [{ pageNumber, width: 1000, height: 1800, lines, words: [] }], paragraphs: [], tables: [] };
}

describe('Layout non-table medication block segmentation', () => {
  test('segments a numbered free-form medication block instead of merging the region', () => {
    const extraction = extractMedicationCandidates(evidence([
      line('Unrelated diagnosis heading', 90, 160),
      line('1. ExampleDrugAlpha 20 mg Tablet', 100, 280),
      line('1 tablet three times daily for 3 days', 160, 320),
      line('2. ExampleDrugBeta 30 mg Tablet', 100, 470),
      line('1 tablet once daily for 3 days', 160, 530),
      line('3. ExampleDrugGamma 5 mg Tablet', 100, 720),
      line('1 tablet at night for 5 days', 160, 760),
      line('4. ExampleDrugDelta 4 mg Tablet', 100, 980),
      line('1 tablet twice daily as needed', 160, 1040),
      line('Advice footer text', 100, 1710)
    ]));

    expect(extraction.metrics.geometryDerived).toBe(4);
    expect(extraction.candidates.map(candidate => candidate.medicineName)).toEqual([
      'ExampleDrugAlpha', 'ExampleDrugBeta', 'ExampleDrugGamma', 'ExampleDrugDelta'
    ]);
    extraction.candidates.forEach(candidate => {
      expect(candidate.rawText).not.toContain('Unrelated diagnosis heading');
      expect(candidate.medicineName).not.toMatch(/^\d/);
      expect(candidate.instructions).toBeTruthy();
      expect(candidate.quantity).toBeNull();
      expect(candidate.extractionConfidence.level).toBe('high');
    });
  });

  test('segments repeated identity-direction structure without ordinal markers and attaches multiline directions', () => {
    const extraction = extractMedicationCandidates(evidence([
      line('ExampleDrugEpsilon 10 mg Tablet', 100, 250),
      line('1 tablet twice daily', 170, 295),
      line('after meals for 5 days', 170, 330),
      line('ExampleDrugZeta 25 mg Capsule', 100, 520),
      line('1 capsule daily for 7 days', 170, 590)
    ]));
    const byName = new Map(extraction.candidates.map(candidate => [candidate.medicineName, candidate]));

    expect(extraction.candidates).toHaveLength(2);
    expect(byName.get('ExampleDrugEpsilon').instructions).toBe('1 tablet twice daily after meals for 5 days');
    expect(byName.get('ExampleDrugZeta').instructions).toBe('1 capsule daily for 7 days');
    expect(byName.get('ExampleDrugEpsilon').fieldEvidence.instructions.length).toBe(2);
  });

  test('attaches administration-shaped dosage-form lines without promoting them to medicine identities', () => {
    const extraction = extractMedicationCandidates(evidence([
      line('Tablet', 100, 120),
      line('ExampleDrugAlpha 20 mg Tablet', 100, 220),
      line('1 tablet three times daily for 3 days', 160, 260),
      line('ExampleDrugBeta 30 mg Tablet', 100, 420),
      line('I tablet three times daily for 3 days', 160, 460),
      line('ExampleDrugGamma 5 mg Tablet', 100, 620),
      line('one tablet at night', 160, 660),
      line('ExampleDrugDelta 4 mg Capsule', 100, 820),
      line('2 capsules twice daily', 160, 860),
      line('ExampleDrugEpsilon Syrup', 100, 1020),
      line('5 ml three times daily', 160, 1060),
      line('ExampleDrugZeta 100 mcg Inhaler', 100, 1220),
      line('2 puffs as needed', 160, 1260)
    ]));
    const byName = new Map(extraction.candidates.map(candidate => [candidate.medicineName, candidate]));

    expect(extraction.candidates).toHaveLength(6);
    expect(byName.get('ExampleDrugAlpha')).toMatchObject({ instructions: '1 tablet three times daily for 3 days', quantity: null });
    expect(byName.get('ExampleDrugBeta')).toMatchObject({ instructions: 'I tablet three times daily for 3 days', quantity: null });
    expect(byName.get('ExampleDrugGamma')).toMatchObject({ instructions: 'one tablet at night', quantity: null });
    expect(byName.get('ExampleDrugDelta')).toMatchObject({ instructions: '2 capsules twice daily', quantity: null });
    expect(byName.get('ExampleDrugEpsilon')).toMatchObject({ instructions: '5 ml three times daily', quantity: null });
    expect(byName.get('ExampleDrugZeta')).toMatchObject({ instructions: '2 puffs as needed', quantity: null });
    expect(extraction.candidates.some(candidate => candidate.medicineName === 'Tablet')).toBe(false);
    expect(extraction.candidates.some(candidate => /three times daily|at night|twice daily|as needed/i.test(candidate.medicineName || ''))).toBe(false);
    extraction.candidates.forEach(candidate => expect(candidate.fieldEvidence.instructions).toHaveLength(1));
  });
  test('preserves optional fields, package quantity, source evidence, and schedule-as-instruction behavior', () => {
    const extraction = extractMedicationCandidates(evidence([
      line('ExampleDrugNoForm 15 mg', 100, 240),
      line('1 tablet 1-0-1', 160, 280),
      line('ExampleDrugNoStrength Syrup', 100, 470),
      line('5 ml twice daily', 160, 510),
      line('ExampleDrugPackage Suspension (100 ml)', 100, 700),
      line('10 ml daily for 5 days', 160, 750)
    ]));
    const byName = new Map(extraction.candidates.map(candidate => [candidate.medicineName, candidate]));

    expect(byName.get('ExampleDrugNoForm')).toMatchObject({ strength: '15 mg', dosageForm: null, quantity: null, instructions: '1 tablet 1-0-1' });
    expect(byName.get('ExampleDrugNoStrength')).toMatchObject({ strength: null, dosageForm: 'Syrup', quantity: null });
    expect(byName.get('ExampleDrugPackage')).toMatchObject({ dosageForm: 'Suspension', quantity: '(100 ml)', instructions: '10 ml daily for 5 days' });
    expect(byName.get('ExampleDrugPackage').fieldEvidence).toMatchObject({
      medicineName: [expect.objectContaining({ kind: 'line', pageNumber: 1 })],
      quantity: [expect.objectContaining({ spans: expect.any(Array), polygon: expect.any(Array) })],
      instructions: [expect.objectContaining({ kind: 'line', pageNumber: 1 })]
    });
  });

  test('does not promote unrelated aligned text or ambiguous low-confidence evidence to high confidence', () => {
    const extraction = extractMedicationCandidates(evidence([
      line('ExampleDrugEta 20 mg Tablet', 100, 260),
      line('1 tablet daily for 3 days', 160, 300),
      line('Unrelated aligned note', 100, 560),
      line('Clinician signature', 100, 1480),
      line('ExampleDrugAmbiguous 5 mg Tablet', 500, 920, 0.1)
    ]));
    const unrelated = extraction.candidates.find(candidate => candidate.rawText.includes('Unrelated aligned note'));
    const ambiguous = extraction.candidates.find(candidate => candidate.medicineName === 'ExampleDrugAmbiguous');

    expect(unrelated?.extractionConfidence.level).not.toBe('high');
    expect(ambiguous.extractionConfidence.level).toBe('low');
    expect(extraction.candidates.filter(candidate => candidate.extractionConfidence.level === 'high')).toHaveLength(1);
  });
});
