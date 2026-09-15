const { extractMedicineCandidates, extractMedicines } = require('../src/services/prescriptionParserService');

describe('prescriptionParserService medicine candidates', () => {
  test('excludes common prescription document noise while retaining plausible medicine rows', () => {
    const lines = [
      'AFSAR POLYCLINIC', 'FAMILY HEALTH CARE CENTRE', 'Dr. MD. THAHER | Dr. SHAHEEN',
      'BAMS | MBBS., MD', 'General Physician | Gynecologist', 'Phone: 9876543210',
      '12 Main Street, Chennai 600001', 'Patient Name: Siva', 'Age: 34 Gender: Male',
      'Bring prescription on next visit', 'Rx', '1. Amoxicillin 250 mg Capsule', 'Footer notes'
    ].map((text, index) => ({ text, box: [10, index * 20, 500, index * 20 + 15], confidence: 0.9 }));
    expect(extractMedicines(lines.map(line => line.text).join('\n'), lines)).toEqual(['Amoxicillin 250 mg Capsule']);
  });

  test('keeps uncertain OCR text as a raw candidate instead of fabricating a medicine', () => {
    expect(extractMedicines('Rx\nAmoxcilln 25O mg')).toEqual(['Amoxcilln 25O mg']);
  });
});
test('separates prescribed quantities and excludes clinical document noise before Master lookup', () => {
  const text = [
    'AFSAR POLYCLINIC',
    'Ph: 044 1234 5678',
    'Rx',
    'Paracetamol 500mg Tablet | 10 Tablets',
    'Amoxicillin 250mg Capsule | 20 Capsules',
    'Amlodipine 5mg Tablet | 30 Tablets',
    'Omeprazole 20mg Capsule | 15 Capsules',
    'Dose: 1 tablet after food',
    'Duration: 5 days',
    'Directions: Take after meals',
    'Note: Follow up if symptoms persist'
  ].join('\n');

  expect(extractMedicineCandidates(text)).toEqual([
    { rawText: 'Paracetamol 500mg Tablet | 10 Tablets', medicineText: 'Paracetamol 500mg Tablet', prescribedQuantityText: '10 Tablets' },
    { rawText: 'Amoxicillin 250mg Capsule | 20 Capsules', medicineText: 'Amoxicillin 250mg Capsule', prescribedQuantityText: '20 Capsules' },
    { rawText: 'Amlodipine 5mg Tablet | 30 Tablets', medicineText: 'Amlodipine 5mg Tablet', prescribedQuantityText: '30 Tablets' },
    { rawText: 'Omeprazole 20mg Capsule | 15 Capsules', medicineText: 'Omeprazole 20mg Capsule', prescribedQuantityText: '15 Capsules' }
  ]);
  expect(extractMedicines(text)).toEqual([
    'Paracetamol 500mg Tablet',
    'Amoxicillin 250mg Capsule',
    'Amlodipine 5mg Tablet',
    'Omeprazole 20mg Capsule'
  ]);
});
describe('prescriptionParserService OCR layout cleanup', () => {
  const michaelJohnsonPrescription = [
    'Patient Name: | Michael Johnson | Date: 18/06/2026',
    '',
    '1. Paracetamol 500mg | Take 1 tablet three times daily for 5 days.',
    '(Tablet)',
    '2. Amlodipine 5mg | Take 1 tablet once daily.',
    '(Tablet)',
    '3. | Zinc Sulphate 20mg | Take 1 tablet once daily after food for 14 days.',
    '(Tablet)',
    '4. | Artemether/Lumefantrine | Take 4 tablets twice daily for 3 days.',
    '(Tablet)',
    'Do Not Refill | Refill | 0 | Times | (Sign) | Janka | M.D.',
    'DEA Number | MJ258712',
    'Date | 18/06/2026 | Print Last Name | Johnson'
  ].join('\n');

  test('normalizes boundary layout artifacts without changing internal name characters', () => {
    expect(require('../src/services/prescriptionParserService').extractPatientName(michaelJohnsonPrescription))
      .toBe('Michael Johnson');
  });

  test('returns only clean medicine candidates from the representative OCR layout', () => {
    expect(extractMedicines(michaelJohnsonPrescription)).toEqual([
      'Paracetamol 500mg',
      'Amlodipine 5mg',
      'Zinc Sulphate 20mg',
      'Artemether/Lumefantrine'
    ]);
  });

  test('keeps internal slashes and valid dosage-form medicine names', () => {
    expect(extractMedicines([
      'Rx',
      '| Artemether/Lumefantrine |',
      'Amlodipine 5mg Tablet',
      'Amoxicillin 250mg Capsule'
    ].join('\n'))).toEqual([
      'Artemether/Lumefantrine',
      'Amlodipine 5mg Tablet',
      'Amoxicillin 250mg Capsule'
    ]);
  });

  test('excludes standalone dosage forms, directions, and form metadata', () => {
    expect(extractMedicines([
      'Rx',
      '(Tablet)', '(Capsule)', 'Do Not Refill', 'Refill', 'Times', '(Sign)',
      'M.D.', 'DEA Number', 'DEA Number | MJ258712', 'Print Last Name | Johnson',
      'Take 1 tablet once daily.'
    ].join('\n'))).toEqual([]);
  });
});