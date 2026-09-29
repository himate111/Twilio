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

  expect(extractMedicineCandidates(text)).toMatchObject([
    {
      rawText: 'Paracetamol 500mg Tablet | 10 Tablets',
      medicineText: 'Paracetamol 500mg Tablet',
      prescribedQuantityText: '10 Tablets',
      dosePerAdministration: null,
      frequency: null,
      duration: null,
      calculatedQuantity: null,
      explicitQuantity: 10,
      numericQuantity: 10,
      quantitySource: 'explicit_prescription_quantity',
      quantityConfidence: 1.0
    },
    {
      rawText: 'Amoxicillin 250mg Capsule | 20 Capsules',
      medicineText: 'Amoxicillin 250mg Capsule',
      prescribedQuantityText: '20 Capsules',
      dosePerAdministration: null,
      frequency: null,
      duration: null,
      calculatedQuantity: null,
      explicitQuantity: 20,
      numericQuantity: 20,
      quantitySource: 'explicit_prescription_quantity',
      quantityConfidence: 1.0
    },
    {
      rawText: 'Amlodipine 5mg Tablet | 30 Tablets',
      medicineText: 'Amlodipine 5mg Tablet',
      prescribedQuantityText: '30 Tablets',
      dosePerAdministration: null,
      frequency: null,
      duration: null,
      calculatedQuantity: null,
      explicitQuantity: 30,
      numericQuantity: 30,
      quantitySource: 'explicit_prescription_quantity',
      quantityConfidence: 1.0
    },
    {
      rawText: 'Omeprazole 20mg Capsule | 15 Capsules',
      medicineText: 'Omeprazole 20mg Capsule',
      prescribedQuantityText: '15 Capsules',
      dosePerAdministration: null,
      frequency: null,
      duration: null,
      calculatedQuantity: null,
      explicitQuantity: 15,
      numericQuantity: 15,
      quantitySource: 'explicit_prescription_quantity',
      quantityConfidence: 1.0
    }
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

describe('prescriptionParserService quantity extraction and calculation', () => {
  test('1. Explicit quantity: extracts numeric quantity from pipe format', () => {
    const text = 'Paracetamol 500mg Tablet | 10 Tablets';
    const candidates = extractMedicineCandidates(text);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].medicineText).toBe('Paracetamol 500mg Tablet');
    expect(candidates[0].prescribedQuantityText).toBe('10 Tablets');
    expect(candidates[0].explicitQuantity).toBe(10);
    expect(candidates[0].numericQuantity).toBe(10);
    expect(candidates[0].calculatedQuantity).toBeNull();
    expect(candidates[0].quantitySource).toBe('explicit_prescription_quantity');
  });

  test('1b. Explicit quantity variants: tabs, capsules, Qty prefix, Dispense prefix', () => {
    const variations = [
      { text: 'Paracetamol 500mg | 10 tabs', expected: 10 },
      { text: 'Amoxicillin 250mg | 10 capsules', expected: 10 },
      { text: 'Ibuprofen 400mg | Quantity: 10', expected: 10 },
      { text: 'Cetirizine 10mg | Qty: 10 tablets', expected: 10 },
      { text: 'Metformin 500mg | Dispense 10 tablets', expected: 10 }
    ];

    for (const v of variations) {
      const candidates = extractMedicineCandidates(v.text);
      expect(candidates).toHaveLength(1);
      expect(candidates[0].explicitQuantity).toBe(v.expected);
      expect(candidates[0].quantitySource).toBe('explicit_prescription_quantity');
    }
  });

  test('2. Calculated quantity: 1 tablet three times daily for 5 days = 15', () => {
    const text = [
      'Paracetamol 500mg',
      'Take 1 tablet three times daily for 5 days.'
    ].join('\n');
    const candidates = extractMedicineCandidates(text);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].medicineText).toBe('Paracetamol 500mg');
    expect(candidates[0].dosePerAdministration).toBe(1);
    expect(candidates[0].frequency).toBe(3);
    expect(candidates[0].duration).toBe(5);
    expect(candidates[0].calculatedQuantity).toBe(15);
    expect(candidates[0].numericQuantity).toBe(15);
    expect(candidates[0].quantitySource).toBe('calculated_from_directions');
  });

  test('3. Numeric frequency: Take 2 tablets 2 times daily for 7 days = 28', () => {
    const text = [
      'Amoxicillin 500mg',
      'Take 2 tablets 2 times daily for 7 days.'
    ].join('\n');
    const candidates = extractMedicineCandidates(text);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].dosePerAdministration).toBe(2);
    expect(candidates[0].frequency).toBe(2);
    expect(candidates[0].duration).toBe(7);
    expect(candidates[0].calculatedQuantity).toBe(28);
    expect(candidates[0].numericQuantity).toBe(28);
    expect(candidates[0].quantitySource).toBe('calculated_from_directions');
  });

  test('4. Missing duration: Take 1 tablet once daily requires manual input', () => {
    const text = [
      'Amlodipine 5mg',
      'Take 1 tablet once daily.'
    ].join('\n');
    const candidates = extractMedicineCandidates(text);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].medicineText).toBe('Amlodipine 5mg');
    expect(candidates[0].dosePerAdministration).toBe(1);
    expect(candidates[0].frequency).toBe(1);
    expect(candidates[0].duration).toBeNull();
    expect(candidates[0].calculatedQuantity).toBeNull();
    expect(candidates[0].quantitySource).toBe('manual_input_required');
  });

  test('5. PRN instruction: Take 1 tablet as needed requires manual input', () => {
    const text = [
      'Ibuprofen 400mg',
      'Take 1 tablet as needed.'
    ].join('\n');
    const candidates = extractMedicineCandidates(text);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].calculatedQuantity).toBeNull();
    expect(candidates[0].quantitySource).toBe('manual_input_required');
  });

  test('6. Strength must not be treated as quantity', () => {
    const text = 'Paracetamol 500mg';
    const candidates = extractMedicineCandidates(text);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].medicineText).toBe('Paracetamol 500mg');
    expect(candidates[0].prescribedQuantityText).toBeNull();
    expect(candidates[0].explicitQuantity).toBeNull();
    expect(candidates[0].calculatedQuantity).toBeNull();
    expect(candidates[0].quantitySource).toBe('manual_input_required');
  });

  test('7. Ambiguous or malformed instructions do not produce a guessed quantity', () => {
    const text = [
      'Paracetamol 500mg',
      'Take 1 or 2 tablets twice or thrice daily if fever occurs'
    ].join('\n');
    const candidates = extractMedicineCandidates(text);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].calculatedQuantity).toBeNull();
    expect(candidates[0].quantitySource).toBe('manual_input_required');
  });

  test('8. Required sample prescription with multiple medicines and separate directions', () => {
    const prescription = [
      'Paracetamol 500mg',
      'Take 1 tablet three times daily for 5 days.',
      '',
      'Amlodipine 5mg',
      'Take 1 tablet once daily.'
    ].join('\n');

    const candidates = extractMedicineCandidates(prescription);
    expect(candidates).toHaveLength(2);

    // Paracetamol: 1 tablet x 3 times daily x 5 days = 15 tablets
    expect(candidates[0].medicineText).toBe('Paracetamol 500mg');
    expect(candidates[0].calculatedQuantity).toBe(15);
    expect(candidates[0].quantitySource).toBe('calculated_from_directions');

    // Amlodipine: duration missing -> manual input required
    expect(candidates[1].medicineText).toBe('Amlodipine 5mg');
    expect(candidates[1].calculatedQuantity).toBeNull();
    expect(candidates[1].quantitySource).toBe('manual_input_required');
  });
});

describe('handwritten prescription noise and quantity regression tests', () => {
  test('A1. Excludes hospital / institution header lines', () => {
    const lines = [
      'Hospital & Research Centre',
      'City Polyclinic & Diagnostic Trust',
      'Apollo Medical Centre',
      'Rx',
      'Paracetamol 500mg'
    ].join('\n');
    const candidates = extractMedicineCandidates(lines);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].medicineText).toBe('Paracetamol 500mg');
  });

  test('A2. Excludes address and contact lines', () => {
    const lines = [
      'Balagangadharanatha Nagara-571 448',
      '12 Cross, Gandhi Nagar, Pin 560001',
      'Phone: 9876543210',
      'Rx',
      'Amoxicillin 250mg'
    ].join('\n');
    const candidates = extractMedicineCandidates(lines);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].medicineText).toBe('Amoxicillin 250mg');
  });

  test('A3. Excludes patient metadata labels (Name, UHID, Age/Gender, Date)', () => {
    const lines = [
      'Name / Vivek',
      'Pt Name: John Doe',
      'UHID : 1048291',
      'Age: 45 Yrs / Male',
      'Date: 12/05/2026',
      'Rx',
      'Metformin 500mg'
    ].join('\n');
    const candidates = extractMedicineCandidates(lines);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].medicineText).toBe('Metformin 500mg');
  });

  test('A4. Excludes symptoms, complaints, diagnosis, vitals, clinical advice, and signatures', () => {
    const lines = [
      'symptoms / hypoglycemia',
      'C/O fever and cough',
      'Diagnosis: Type 2 Diabetes Mellitus',
      'Vitals: BP 120/80, Pulse 72',
      'adequate fluid intake',
      'Bed rest for 3 days',
      'Rx',
      'Paracetamol 500mg',
      'Dr. Rajesh Sharma MBBS MD',
      'Signature'
    ].join('\n');
    const candidates = extractMedicineCandidates(lines);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].medicineText).toBe('Paracetamol 500mg');
  });

  test('B. Quantity grouping: Medicine + 2sachets. produces ONE candidate with explicitQuantity 2', () => {
    const lines = [
      'Rx',
      'ORS',
      '2sachets.'
    ].join('\n');
    const candidates = extractMedicineCandidates(lines);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].medicineText).toBe('ORS');
    expect(candidates[0].explicitQuantity).toBe(2);
    expect(candidates[0].prescribedQuantityText).toBe('2sachets.');
    expect(candidates[0].quantitySource).toBe('explicit_prescription_quantity');
  });

  test('B2. Supports generic count unit variants without space and with punctuation', () => {
    const variations = [
      { lines: 'Rx\nORS\n2sachets', expectedQty: 2, expectedText: '2sachets' },
      { lines: 'Rx\nORS\n2 sachets', expectedQty: 2, expectedText: '2 sachets' },
      { lines: 'Rx\nORS\n2sachets.', expectedQty: 2, expectedText: '2sachets.' },
      { lines: 'Rx\nCetirizine\n10tabs', expectedQty: 10, expectedText: '10tabs' },
      { lines: 'Rx\nCetirizine\n10 tabs.', expectedQty: 10, expectedText: '10 tabs.' },
      { lines: 'Rx\nInsulin\n5vials', expectedQty: 5, expectedText: '5vials' }
    ];

    for (const v of variations) {
      const candidates = extractMedicineCandidates(v.lines);
      expect(candidates).toHaveLength(1);
      expect(candidates[0].explicitQuantity).toBe(v.expectedQty);
      expect(candidates[0].prescribedQuantityText).toBe(v.expectedText);
      expect(candidates[0].quantitySource).toBe('explicit_prescription_quantity');
    }
  });

  test('C. Ensures Paracetamol 500mg does NOT become explicit quantity 500', () => {
    const text = 'Rx\nParacetamol 500mg';
    const candidates = extractMedicineCandidates(text);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].medicineText).toBe('Paracetamol 500mg');
    expect(candidates[0].explicitQuantity).toBeNull();
    expect(candidates[0].calculatedQuantity).toBeNull();
    expect(candidates[0].quantitySource).toBe('manual_input_required');
  });

  test('G. Multiple distinct medicines with their own quantities remain separate', () => {
    const text = [
      'Rx',
      'Paracetamol 500mg',
      'Take 1 tablet three times daily for 5 days.',
      'Amlodipine 5mg',
      'Take 1 tablet once daily.',
      'ORS',
      '2sachets.'
    ].join('\n');

    const candidates = extractMedicineCandidates(text);
    expect(candidates).toHaveLength(3);

    expect(candidates[0].medicineText).toBe('Paracetamol 500mg');
    expect(candidates[0].calculatedQuantity).toBe(15);
    expect(candidates[0].quantitySource).toBe('calculated_from_directions');

    expect(candidates[1].medicineText).toBe('Amlodipine 5mg');
    expect(candidates[1].calculatedQuantity).toBeNull();
    expect(candidates[1].quantitySource).toBe('manual_input_required');

    expect(candidates[2].medicineText).toBe('ORS');
    expect(candidates[2].explicitQuantity).toBe(2);
    expect(candidates[2].quantitySource).toBe('explicit_prescription_quantity');
  });
});

describe('prescription footer termination and administration modifier regression tests', () => {
  test('1. Footer termination: excludes complete footer block after medicines', () => {
    const lines = [
      'Prescription Name: Michael Johnson Date: 18/06/2026',
      'Rx',
      '1. | Paracetamol 500mg | Take 1 tablet three times daily for 5 days.',
      '(Tablet)',
      '2. | Amlodipine 5mg | Take 1 tablet once daily.',
      '(Tablet)',
      '3. | Zinc Sulphate 20mg | Take 1 tablet once daily after food for 14 days.',
      '(Tablet)',
      '4. | Artemether/Lumefantrine | Take 4 tablets twice daily for 3 days.',
      '(Tablet)',
      'Do Not Refill',
      'Refill',
      '0',
      'Times',
      '(Sign)',
      'Janka',
      'M.D.',
      'DEA Number',
      'MJ258712',
      'Date',
      '18/06/2026',
      'Print Last Name',
      'Johnson'
    ].join('\n');

    const candidates = extractMedicineCandidates(lines);
    expect(candidates).toHaveLength(4);
    expect(candidates.map(c => c.medicineText)).toEqual([
      'Paracetamol 500mg',
      'Amlodipine 5mg',
      'Zinc Sulphate 20mg',
      'Artemether/Lumefantrine'
    ]);
  });

  test('2. (Sign) + signature OCR value exclusion', () => {
    const text = [
      'Rx',
      'Paracetamol 500mg',
      '(Sign)',
      'Janka',
      'M.D.'
    ].join('\n');

    const candidates = extractMedicineCandidates(text);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].medicineText).toBe('Paracetamol 500mg');
  });

  test('3. DEA Number + following value exclusion', () => {
    const text = [
      'Rx',
      'Paracetamol 500mg',
      'DEA Number',
      'MJ258712'
    ].join('\n');

    const candidates = extractMedicineCandidates(text);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].medicineText).toBe('Paracetamol 500mg');
  });

  test('4. Print Last Name + following value exclusion', () => {
    const text = [
      'Rx',
      'Paracetamol 500mg',
      'Print Last Name',
      'Johnson'
    ].join('\n');

    const candidates = extractMedicineCandidates(text);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].medicineText).toBe('Paracetamol 500mg');
  });

  test('5. Zinc after food for 14 days -> 14', () => {
    const text = [
      'Rx',
      'Zinc Sulphate 20mg',
      'Take 1 tablet once daily after food for 14 days.'
    ].join('\n');

    const candidates = extractMedicineCandidates(text);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].medicineText).toBe('Zinc Sulphate 20mg');
    expect(candidates[0].calculatedQuantity).toBe(14);
    expect(candidates[0].dosePerAdministration).toBe(1);
    expect(candidates[0].frequency).toBe(1);
    expect(candidates[0].duration).toBe(14);
    expect(candidates[0].quantitySource).toBe('calculated_from_directions');
  });

  test('6. before food -> calculates correctly', () => {
    const text = [
      'Rx',
      'Zinc Sulphate 20mg',
      'Take 1 tablet once daily before food for 14 days.'
    ].join('\n');

    const candidates = extractMedicineCandidates(text);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].calculatedQuantity).toBe(14);
    expect(candidates[0].quantitySource).toBe('calculated_from_directions');
  });

  test('7. after meals -> calculates correctly', () => {
    const text = [
      'Rx',
      'Zinc Sulphate 20mg',
      'Take 1 tablet once daily after meals for 14 days.'
    ].join('\n');

    const candidates = extractMedicineCandidates(text);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].calculatedQuantity).toBe(14);
    expect(candidates[0].quantitySource).toBe('calculated_from_directions');
  });

  test('8. before meals -> calculates correctly', () => {
    const text = [
      'Rx',
      'Zinc Sulphate 20mg',
      'Take 1 tablet once daily before meals for 14 days.'
    ].join('\n');

    const candidates = extractMedicineCandidates(text);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].calculatedQuantity).toBe(14);
    expect(candidates[0].quantitySource).toBe('calculated_from_directions');
  });

  test('9. with food -> calculates correctly', () => {
    const text = [
      'Rx',
      'Zinc Sulphate 20mg',
      'Take 1 tablet once daily with food for 14 days.'
    ].join('\n');

    const candidates = extractMedicineCandidates(text);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].calculatedQuantity).toBe(14);
    expect(candidates[0].quantitySource).toBe('calculated_from_directions');
  });

  test('10. modifier with no duration -> manual quantity required', () => {
    const text = [
      'Rx',
      'Zinc Sulphate 20mg',
      'Take 1 tablet once daily after food'
    ].join('\n');

    const candidates = extractMedicineCandidates(text);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].calculatedQuantity).toBeNull();
    expect(candidates[0].quantitySource).toBe('manual_input_required');
  });

  test('11. PRN with duration -> manual quantity required', () => {
    const text = [
      'Rx',
      'Zinc Sulphate 20mg',
      'Take 1 tablet as needed after food for 14 days.'
    ].join('\n');

    const candidates = extractMedicineCandidates(text);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].calculatedQuantity).toBeNull();
    expect(candidates[0].quantitySource).toBe('manual_input_required');
  });

  test('12. Paracetamol remains 15', () => {
    const text = [
      'Rx',
      'Paracetamol 500mg',
      'Take 1 tablet three times daily for 5 days.'
    ].join('\n');

    const candidates = extractMedicineCandidates(text);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].calculatedQuantity).toBe(15);
    expect(candidates[0].quantitySource).toBe('calculated_from_directions');
  });

  test('13. Amlodipine remains manual quantity', () => {
    const text = [
      'Rx',
      'Amlodipine 5mg',
      'Take 1 tablet once daily.'
    ].join('\n');

    const candidates = extractMedicineCandidates(text);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].calculatedQuantity).toBeNull();
    expect(candidates[0].quantitySource).toBe('manual_input_required');
  });

  test('14. Artemether/Lumefantrine remains 24', () => {
    const text = [
      'Rx',
      'Artemether/Lumefantrine',
      'Take 4 tablets twice daily for 3 days.'
    ].join('\n');

    const candidates = extractMedicineCandidates(text);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].calculatedQuantity).toBe(24);
    expect(candidates[0].dosePerAdministration).toBe(4);
    expect(candidates[0].frequency).toBe(2);
    expect(candidates[0].duration).toBe(3);
    expect(candidates[0].quantitySource).toBe('calculated_from_directions');
  });

  test('15. Medicine + 2sachets. remains one candidate quantity 2', () => {
    const text = [
      'Rx',
      'ORS',
      '2sachets.'
    ].join('\n');

    const candidates = extractMedicineCandidates(text);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].medicineText).toBe('ORS');
    expect(candidates[0].explicitQuantity).toBe(2);
    expect(candidates[0].quantitySource).toBe('explicit_prescription_quantity');
  });
});

describe('prescriptionParserService real layout with OCR bounding boxes', () => {
  test('Michael Johnson real OCR lines layout: extracts 4 medicines, correct quantities, zero footer candidates', () => {
    const ocrLines = [
      { text: 'Patient Name: | Michael Johnson | Date: 18/06/2026', box: [100, 100, 700, 130] },
      { text: 'Rx', box: [100, 160, 140, 190] },
      // Medicine 1: Paracetamol
      { text: '1. Paracetamol 500mg', box: [100, 220, 350, 250] },
      { text: 'Take 1 tablet three times daily for 5 days.', box: [380, 220, 850, 250] },
      { text: '(Tablet)', box: [100, 260, 180, 285] },
      // Medicine 2: Amlodipine (no duration)
      { text: '2. Amlodipine 5mg', box: [100, 320, 320, 350] },
      { text: 'Take 1 tablet once daily.', box: [350, 320, 650, 350] },
      { text: '(Tablet)', box: [100, 360, 180, 385] },
      // Medicine 3: Zinc Sulphate (split into 3 boxes with slight Y variation: direction box Y1=419, med Y1=421)
      { text: '3.', box: [80, 420, 105, 448] },
      { text: 'Zinc Sulphate 20mg', box: [115, 421, 360, 450] },
      { text: 'Take 1 tablet once daily after food for 14 days.', box: [380, 419, 920, 449] },
      { text: '(Tablet)', box: [100, 460, 180, 485] },
      // Medicine 4: Artemether/Lumefantrine (split into 3 boxes)
      { text: '4.', box: [80, 520, 105, 548] },
      { text: 'Artemether/Lumefantrine', box: [115, 520, 420, 550] },
      { text: 'Take 4 tablets twice daily for 3 days.', box: [440, 520, 850, 550] },
      { text: '(Tablet)', box: [100, 560, 180, 585] },
      // Footer row elements: Janka signature box [869, 819, 1127, 937] starts higher than printed footer row [862..907]
      { text: 'Do Not Refill', box: [87, 866, 237, 898] },
      { text: 'Refill', box: [280, 866, 350, 898] },
      { text: '0', box: [390, 866, 410, 898] },
      { text: 'Times', box: [450, 866, 520, 898] },
      { text: '(Sign)', box: [721, 862, 805, 907] },
      { text: 'Janka', box: [869, 819, 1127, 937] },
      { text: 'M.D.', box: [1150, 866, 1200, 898] },
      // Footer metadata rows
      { text: 'DEA Number', box: [87, 940, 230, 970] },
      { text: 'MJ258712', box: [250, 940, 400, 970] },
      { text: 'Date', box: [87, 980, 150, 1010] },
      { text: '18/06/2026', box: [170, 980, 320, 1010] },
      { text: 'Print Last Name', box: [500, 980, 700, 1010] },
      { text: 'Johnson', box: [720, 980, 850, 1010] }
    ];

    const rawText = ocrLines.map(l => l.text).join('\n');
    const candidates = extractMedicineCandidates(rawText, ocrLines);

    expect(candidates).toHaveLength(4);
    expect(candidates.map(c => c.medicineText)).toEqual([
      'Paracetamol 500mg',
      'Amlodipine 5mg',
      'Zinc Sulphate 20mg',
      'Artemether/Lumefantrine'
    ]);

    // Paracetamol: 15 tablets calculated
    expect(candidates[0].calculatedQuantity).toBe(15);
    expect(candidates[0].dosePerAdministration).toBe(1);
    expect(candidates[0].frequency).toBe(3);
    expect(candidates[0].duration).toBe(5);
    expect(candidates[0].quantitySource).toBe('calculated_from_directions');

    // Amlodipine: manual quantity required (duration missing)
    expect(candidates[1].calculatedQuantity).toBeNull();
    expect(candidates[1].dosePerAdministration).toBe(1);
    expect(candidates[1].frequency).toBe(1);
    expect(candidates[1].duration).toBeNull();
    expect(candidates[1].quantitySource).toBe('manual_input_required');

    // Zinc Sulphate: 14 tablets calculated (direction with "after food" preserved across split boxes)
    expect(candidates[2].calculatedQuantity).toBe(14);
    expect(candidates[2].dosePerAdministration).toBe(1);
    expect(candidates[2].frequency).toBe(1);
    expect(candidates[2].duration).toBe(14);
    expect(candidates[2].quantitySource).toBe('calculated_from_directions');

    // Artemether/Lumefantrine: 24 tablets calculated
    expect(candidates[3].calculatedQuantity).toBe(24);
    expect(candidates[3].dosePerAdministration).toBe(4);
    expect(candidates[3].frequency).toBe(2);
    expect(candidates[3].duration).toBe(3);
    expect(candidates[3].quantitySource).toBe('calculated_from_directions');

    // Verify footer elements are strictly excluded
    const candidateNames = candidates.map(c => c.medicineText.toLowerCase());
    expect(candidateNames).not.toContain('janka');
    expect(candidateNames).not.toContain('mj258712');
    expect(candidateNames).not.toContain('johnson');
  });

  test('arbitrary doctor signature name overlapping footer row is excluded generically', () => {
    const ocrLines = [
      { text: 'Rx', box: [100, 100, 140, 130] },
      { text: 'Paracetamol 500mg', box: [100, 160, 350, 190] },
      { text: 'Take 1 tablet three times daily for 5 days.', box: [380, 160, 850, 190] },
      { text: '(Sign)', box: [700, 850, 780, 890] },
      { text: 'DrAlexanderK', box: [800, 810, 1050, 920] }, // Signature box overlapping (Sign) row
      { text: 'M.D.', box: [1100, 850, 1160, 890] },
      { text: 'Print Last Name', box: [500, 950, 700, 980] },
      { text: 'Alexander', box: [720, 950, 850, 980] }
    ];

    const candidates = extractMedicineCandidates('', ocrLines);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].medicineText).toBe('Paracetamol 500mg');
  });

  test('printed prescription with multi-column layout, parenthetical forms, and doctor signature block: extracts 4 medicines and quantities', () => {
    const { extractPatientName } = require('../src/services/prescriptionParserService');
    const ocrLines = [
      { text: 'SUNRISE MEDICAL CENTRE', box: [40, 20, 300, 40] },
      { text: '123 Cross Road, Bangalore 560001', box: [40, 45, 320, 60] },
      { text: 'Phone: +91 80 12345678', box: [40, 65, 250, 80] },
      { text: 'Patient Name: Arvind Kumar', box: [40, 100, 250, 120] },
      { text: 'Age / Gender: 45 / M', box: [40, 125, 220, 145] },
      { text: 'Patient ID: SMC012345', box: [40, 150, 240, 170] },
      { text: 'Date: 17/09/2026', box: [40, 175, 180, 195] },
      { text: 'OP No: OP67890', box: [40, 200, 170, 220] },
      { text: 'Rx', box: [40, 230, 70, 250] },
      { text: '1. Metformin 500 mg (Tablet)', box: [40, 270, 280, 290] },
      { text: 'Take 1 tablet twice daily for 30 days.', box: [40, 295, 340, 315] },
      { text: '2. Losartan 50 mg (Tablet)', box: [40, 340, 260, 360] },
      { text: 'Take 1 tablet once daily for 14 days.', box: [40, 365, 330, 385] },
      { text: '3. Cetirizine 10 mg (Tablet)', box: [40, 410, 270, 430] },
      { text: 'Take 1 tablet once daily for 5 days.', box: [40, 435, 320, 455] },
      { text: '4. Amoxicillin 500 mg (Capsule)', box: [40, 480, 290, 500] },
      { text: 'Take 1 capsule three times daily for 7 days.', box: [40, 505, 360, 525] },
      { text: 'Do Not Refill', box: [40, 560, 150, 580] },
      { text: 'Doctor signature', box: [380, 490, 500, 510] },
      { text: 'Dr. V. Ramanathan', box: [380, 530, 490, 550] },
      { text: 'M.B.B.S., M.D.', box: [380, 555, 480, 575] },
      { text: 'General Physician', box: [380, 580, 510, 600] },
      { text: 'Reg. No. KMC 78901', box: [380, 605, 530, 625] }
    ];

    const rawText = ocrLines.map(l => l.text).join('\n');
    expect(extractPatientName(rawText)).toBe('Arvind Kumar');

    const candidates = extractMedicineCandidates(rawText, ocrLines);
    expect(candidates).toHaveLength(4);
    expect(candidates.map(c => c.medicineText)).toEqual([
      'Metformin 500 mg',
      'Losartan 50 mg',
      'Cetirizine 10 mg',
      'Amoxicillin 500 mg'
    ]);

    expect(candidates[0].calculatedQuantity).toBe(60);
    expect(candidates[1].calculatedQuantity).toBe(14);
    expect(candidates[2].calculatedQuantity).toBe(5);
    expect(candidates[3].calculatedQuantity).toBe(21);

    const names = candidates.map(c => c.medicineText.toLowerCase());
    expect(names).not.toContain('ramanathan');
    expect(names).not.toContain('doctor signature');
    expect(names).not.toContain('do not refill');
    expect(names).not.toContain('general physician');
  });

  test('generic prescriber regression: doctor names, qualifications, specialties, and registration metadata produce zero candidates', () => {
    const ocrLines = [
      { text: 'SUNRISE MEDICAL CENTRE', box: [40, 20, 300, 40] },
      { text: 'Patient Name: Siva', box: [40, 100, 250, 120] },
      { text: 'Rx', box: [40, 230, 70, 250] },
      { text: '1. Metformin 500 mg (Tablet)', box: [40, 270, 280, 290] },
      { text: 'Take 1 tablet twice daily for 30 days.', box: [40, 295, 340, 315] },
      { text: '2. Losartan 50 mg (Tablet)', box: [40, 340, 260, 360] },
      { text: 'Take 1 tablet once daily for 14 days.', box: [40, 365, 330, 385] },
      { text: '3. Cetirizine 10 mg (Tablet)', box: [40, 410, 270, 430] },
      { text: 'Take 1 tablet once daily for 5 days.', box: [40, 435, 320, 455] },
      { text: '4. Amoxicillin 500 mg (Capsule)', box: [40, 480, 290, 500] },
      { text: 'Take 1 capsule three times daily for 7 days.', box: [40, 505, 360, 525] },
      // Footer block with arbitrary doctor name, degrees, specialty, and reg no
      { text: 'Do Not Refill', box: [40, 560, 150, 580] },
      { text: 'Doctor signature', box: [380, 520, 500, 540] },
      { text: 'Dr. A. Example', box: [380, 545, 510, 565] },
      { text: 'M.B.B.S., M.D.', box: [380, 570, 480, 590] },
      { text: 'General Physician', box: [380, 595, 510, 615] },
      { text: 'Reg. No. XYZ123', box: [380, 620, 530, 640] }
    ];

    const rawText = ocrLines.map(l => l.text).join('\n');
    const candidates = extractMedicineCandidates(rawText, ocrLines);

    expect(candidates).toHaveLength(4);
    expect(candidates.map(c => c.medicineText)).toEqual([
      'Metformin 500 mg',
      'Losartan 50 mg',
      'Cetirizine 10 mg',
      'Amoxicillin 500 mg'
    ]);

    expect(candidates[0].calculatedQuantity).toBe(60);
    expect(candidates[1].calculatedQuantity).toBe(14);
    expect(candidates[2].calculatedQuantity).toBe(5);
    expect(candidates[3].calculatedQuantity).toBe(21);

    const names = candidates.map(c => c.medicineText.toLowerCase());
    expect(names).not.toContain('a. example');
    expect(names).not.toContain('example');
    expect(names).not.toContain('m.b.b.s., m.d.');
    expect(names).not.toContain('mbbs');
    expect(names).not.toContain('md');
    expect(names).not.toContain('general physician');
    expect(names).not.toContain('reg. no. xyz123');
    expect(names).not.toContain('xyz123');
  });

  test('generic prescriber regression: standalone prescriber prefixes and separate boxes produce zero candidates', () => {
    const ocrLines = [
      { text: 'Rx', box: [40, 230, 70, 250] },
      { text: '1. Metformin 500 mg (Tablet)', box: [40, 270, 280, 290] },
      { text: 'Take 1 tablet twice daily for 30 days.', box: [40, 295, 340, 315] },
      { text: '2. Losartan 50 mg (Tablet)', box: [40, 340, 260, 360] },
      { text: 'Take 1 tablet once daily for 14 days.', box: [40, 365, 330, 385] },
      { text: '3. Cetirizine 10 mg (Tablet)', box: [40, 410, 270, 430] },
      { text: 'Take 1 tablet once daily for 5 days.', box: [40, 435, 320, 455] },
      { text: '4. Amoxicillin 500 mg (Capsule)', box: [40, 480, 290, 500] },
      { text: 'Take 1 capsule three times daily for 7 days.', box: [40, 505, 360, 525] },
      { text: 'Do Not Refill', box: [40, 560, 150, 580] },
      { text: 'Dr.', box: [380, 530, 405, 550] },
      { text: 'B. Sample', box: [410, 530, 520, 550] },
      { text: 'Consultant Physician', box: [380, 555, 520, 575] },
      { text: 'Medical Council Reg 98765', box: [380, 580, 540, 600] }
    ];

    const rawText = ocrLines.map(l => l.text).join('\n');
    const candidates = extractMedicineCandidates(rawText, ocrLines);

    expect(candidates).toHaveLength(4);
    expect(candidates.map(c => c.medicineText)).toEqual([
      'Metformin 500 mg',
      'Losartan 50 mg',
      'Cetirizine 10 mg',
      'Amoxicillin 500 mg'
    ]);
    expect(candidates.map(c => c.medicineText.toLowerCase())).not.toContain('b. sample');
  });
});

describe('separator-prefixed explicit quantity normalization regression', () => {
  test.each([
    ['ExampleDrug 500 mg tab | - 60 tablets', '500 mg', 'tablet', 60],
    ['ExampleDrug 5 mg tab | — 30 tablets', '5 mg', 'tablet', 30],
    ['ExampleDrug 500mg cap - 21 capsules', '500 mg', 'capsule', 21],
    ['ExampleDrug 500 mg tab | — 60 tablets', '500 mg', 'tablet', 60],
    ['ExampleDrug 500mg tab | - 60 tablets', '500 mg', 'tablet', 60]
  ])('separates generic medicine identity from an OCR separator-prefixed quantity: %s', (text, strength, dosageForm, quantity) => {
    const [candidate] = extractMedicineCandidates(text);
    expect(candidate).toMatchObject({ strength, dosageForm, explicitQuantity: quantity, numericQuantity: quantity, quantitySource: 'explicit_prescription_quantity' });
    expect(candidate.medicineText).not.toContain(String(quantity));
    expect(candidate.medicineText).not.toMatch(/[|—–]\s*-?\s*$/);
  });

  test('preserves a concentration and does not confuse either strength number with dispense quantity', () => {
    const [candidate] = extractMedicineCandidates('ExampleDrug 250 mg/5 ml');
    expect(candidate).toMatchObject({ strength: '250 mg/5 ml', explicitQuantity: null, numericQuantity: null, quantitySource: 'manual_input_required' });
  });

  test('does not treat strength as an explicit dispense quantity when quantity metadata is absent', () => {
    const [candidate] = extractMedicineCandidates('ExampleDrug 500 mg tab');
    expect(candidate).toMatchObject({ strength: '500 mg', dosageForm: 'tablet', explicitQuantity: null, quantitySource: 'manual_input_required' });
  });

  test('keeps a following direction associated while an explicit quantity remains primary', () => {
    const [candidate] = extractMedicineCandidates([
      'ExampleDrug 500 mg tab | - 21 tablets',
      'Take 1 tablet three times daily for 7 days'
    ].join('\n'));
    expect(candidate).toMatchObject({ explicitQuantity: 21, numericQuantity: 21, quantitySource: 'explicit_prescription_quantity', dosePerAdministration: 1, frequency: 3, duration: 7 });
  });

  test('does not replace a trusted explicit quantity when directions calculate a conflicting amount', () => {
    const [candidate] = extractMedicineCandidates([
      'ExampleDrug 500 mg tab | - 20 tablets',
      'Take 1 tablet three times daily for 7 days'
    ].join('\n'));
    expect(candidate).toMatchObject({ explicitQuantity: 20, numericQuantity: 20, calculatedQuantity: null, quantitySource: 'explicit_prescription_quantity' });
  });
});

describe('generic handwritten prescription notation normalization', () => {
  test.each([
    ['1 | Tab. ExampleDrug 40mg 1-0-0', '40 mg', '1-0-0'],
    ['(2) Tab. ExampleDrug 500 mg 1-0-1', '500 mg', '1-0-1'],
    ['(3) | Tab. ExampleDrug 10 mg 0-0-1', '10 mg', '0-0-1']
  ])('separates a numbered dosage-form row: %s', (text, strength, schedule) => {
    const [candidate] = extractMedicineCandidates(text);
    expect(candidate).toMatchObject({ medicineName: 'ExampleDrug', strength, dosageForm: 'tablet', schedule });
    expect(candidate.medicineText).not.toMatch(/[|()]|\b\d\s*-\s*\d\s*-\s*\d\b/i);
  });

  test('extracts compact tablet quantity and instructions without contaminating identity', () => {
    const [candidate] = extractMedicineCandidates('(5) | Tab. ExampleDrug 40 mg | 1-0-0 | 30T | empty stomach');
    expect(candidate).toMatchObject({ medicineName: 'ExampleDrug', strength: '40 mg', dosageForm: 'tablet', schedule: '1-0-0', explicitQuantity: 30, quantityUnit: 'tablet', instructions: 'empty stomach', quantitySource: 'explicit_prescription_quantity' });
    expect(candidate.medicineText).not.toMatch(/30T|empty stomach|1-0-0/i);
  });

  test('retains capsule count context and rejects standalone schedule metadata', () => {
    const [candidate] = extractMedicineCandidates('9 | Cap. | ExampleDrug | 1-0-1 | 60 cap');
    expect(candidate).toMatchObject({ medicineName: 'ExampleDrug', dosageForm: 'capsule', schedule: '1-0-1', explicitQuantity: 60, quantityUnit: 'capsule' });
    expect(extractMedicineCandidates('1-0-1 | 30T | after food')).toEqual([]);
  });

  test('preserves concentrations and keeps liquid total volume manual', () => {
    const [concentration] = extractMedicineCandidates('ExampleDrug 250 mg/5 ml');
    const [liquid] = extractMedicineCandidates('Syp. ExampleDrug 5ml 0-0-1 | 60 ml | HS');
    expect(concentration).toMatchObject({ strength: '250 mg/5 ml', explicitQuantity: null });
    expect(liquid).toMatchObject({ medicineName: 'ExampleDrug', dosageForm: 'syrup', schedule: '0-0-1', instructions: 'hs', dispenseVolumeText: '60 ml', explicitQuantity: null, quantitySource: 'manual_input_required' });
  });

  test('does not infer quantity from schedule plus duration and stops active parsing at a stop annotation', () => {
    const [candidate] = extractMedicineCandidates('Tab. ExampleDrug 500 mg | 1-1-1 | for 3 days');
    expect(candidate).toMatchObject({ medicineName: 'ExampleDrug', schedule: '1-1-1', duration: 3, durationText: '3 days', explicitQuantity: null, calculatedQuantity: null, quantitySource: 'manual_input_required' });
    expect(extractMedicineCandidates(['Rx', 'Stop', 'ExampleDrug 5 mg'].join('\n'))).toEqual([]);
  });

  test('extracts a pipe-delimited patient name without identifier metadata', () => {
    const { extractPatientName } = require('../src/services/prescriptionParserService');
    expect(extractPatientName('Name | Test Patient | UHID | ABC123')).toBe('Test Patient');
  });
});

describe('conservative detached OCR metadata association', () => {
  test('associates a spatially adjacent detached schedule without creating another candidate', () => {
    const ocrLines = [
      { text: 'Rx', box: [0, 0, 30, 20] },
      { text: 'Tab. ExampleDrug 75', box: [0, 60, 240, 80] },
      { text: '0-1-0', box: [300, 87, 370, 107] }
    ];
    const candidates = extractMedicineCandidates('', ocrLines);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ medicineName: 'ExampleDrug 75', dosageForm: 'tablet', schedule: '0-1-0' });
  });

  test('does not guess when a detached schedule is equally close to two medicine rows', () => {
    const ocrLines = [
      { text: 'Rx', box: [0, 0, 30, 20] },
      { text: 'Tab. ExampleDrugA 10 mg', box: [0, 60, 240, 80] },
      { text: '0-1-0', box: [300, 87, 370, 107] },
      { text: 'Tab. ExampleDrugB 20 mg', box: [0, 114, 240, 134] }
    ];
    const candidates = extractMedicineCandidates('', ocrLines);
    expect(candidates).toHaveLength(2);
    expect(candidates.every(candidate => candidate.schedule === null)).toBe(true);
  });

  test('associates detached tablet quantity and instruction while keeping search identity clean', () => {
    const ocrLines = [
      { text: 'Rx', box: [0, 0, 30, 20] },
      { text: 'Tab. ExampleDrug 40 mg', box: [0, 60, 240, 80] },
      { text: '30T', box: [300, 87, 350, 107] },
      { text: 'after food', box: [380, 87, 490, 107] }
    ];
    const [candidate] = extractMedicineCandidates('', ocrLines);
    expect(candidate).toMatchObject({ explicitQuantity: 30, quantityUnit: 'tablet', instructions: 'after food' });
    expect(candidate.medicineText).not.toMatch(/30T|after food/i);
  });

  test('uses decisive vertical alignment for a right-side detached quantity column', () => {
    const ocrLines = [
      { text: 'Rx', box: [0, 0, 30, 20] },
      { text: 'Tab. ExampleDrugA 10 mg', box: [0, 305, 240, 375] },
      { text: '30T', box: [300, 317, 350, 337] },
      { text: 'Tab. ExampleDrugB 20 mg', box: [0, 380, 240, 430] },
      { text: '60T', box: [300, 379, 350, 399] }
    ];
    const candidates = extractMedicineCandidates('', ocrLines);
    expect(candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ medicineName: 'ExampleDrugA', explicitQuantity: 30 }),
      expect.objectContaining({ medicineName: 'ExampleDrugB', explicitQuantity: 60 })
    ]));
  });

  test('keeps a detached quantity manual when vertical alignment remains ambiguous', () => {
    const ocrLines = [
      { text: 'Rx', box: [0, 0, 30, 20] },
      { text: 'Tab. ExampleDrugA 10 mg', box: [0, 305, 240, 375] },
      { text: '30T', box: [300, 355, 350, 389] },
      { text: 'Tab. ExampleDrugB 20 mg', box: [0, 370, 240, 440] }
    ];
    const candidates = extractMedicineCandidates('', ocrLines);
    expect(candidates).toHaveLength(2);
    expect(candidates.every(candidate => candidate.explicitQuantity === null)).toBe(true);
  });
  test('discards an unclassified standalone numeric artifact', () => {
    expect(extractMedicineCandidates('Rx\n1')).toEqual([]);
  });

  test('associates a boxed name label with one value and rejects an ambiguous layout', () => {
    const { extractPatientName } = require('../src/services/prescriptionParserService');
    expect(extractPatientName('ocr output', [
      { text: 'Name', box: [10, 10, 60, 30] },
      { text: 'Mr. Test Patient', box: [100, 8, 250, 32] },
      { text: 'UHID', box: [300, 10, 350, 30] }
    ])).toBe('Mr. Test Patient');
    expect(extractPatientName('ocr output', [
      { text: 'Name', box: [10, 10, 60, 30] },
      { text: 'First Possible Name', box: [100, 8, 250, 32] },
      { text: 'Second Possible Name', box: [100, 12, 260, 36] }
    ])).toBeNull();
  });

  test('keeps stopped medicine-looking text out of active candidates', () => {
    expect(extractMedicineCandidates(['Rx', 'Stop', 'ExampleDrug 5 mg', 'AnotherDrug 10 mg'].join('\n'))).toEqual([]);
  });
});

describe('generic imperative instruction continuations', () => {
  test.each(['Dissolve 1 sachet in 200 ml of water.', 'Give as needed.', 'Apply thinly twice daily.', 'Instill 1 drop in each eye.', 'Inhale as directed.', 'Inject once daily.', 'Use after meals.', 'Mix with water.', 'Swallow whole.', 'Chew thoroughly.', 'Gargle twice daily.', 'Spray once daily.'])('does not classify %s as a medicine candidate', (instruction) => {
    expect(extractMedicineCandidates(['Rx', 'ExamplePowder sachet', instruction].join('\n'))).toHaveLength(1);
  });

  test('associates consecutive imperative instructions with the preceding medicine', () => {
    const [candidate] = extractMedicineCandidates(['Rx', 'ExamplePowder sachet | 5 sachets', 'Dissolve 1 sachet in 200 ml of water.', 'Give as needed.'].join('\n'));
    expect(candidate).toMatchObject({ medicineName: 'ExamplePowder sachet', instructions: 'Dissolve 1 sachet in 200 ml of water.; Give as needed.' });
  });
});


describe('compact dosage directions and package-form continuations', () => {
  test('reconstructs multiline medicine identities across a right-side compact direction column', () => {
    const ocrLines = [
      { text: 'Rx', box: [50, 50, 80, 70] },
      { text: 'ExampleDrugA 650 mg Tablet', box: [100, 100, 360, 122] },
      { text: '1-0-1 x 5 days', box: [520, 100, 670, 122] },
      { text: 'ExampleDrugB + ComponentB', box: [100, 150, 370, 172] },
      { text: '10 ml TID x 5 days', box: [520, 150, 700, 172] },
      { text: 'Syrup (100 ml)', box: [100, 185, 245, 207] },
      { text: 'ExampleDrugC 40 mg Tablet', box: [100, 235, 360, 257] },
      { text: '1-0-0 x 5 days', box: [520, 235, 670, 257] },
      { text: 'ExampleDrugD 500 mg Tablet', box: [100, 285, 370, 307] },
      { text: '1-0-0 x 10 days', box: [520, 285, 680, 307] }
    ];

    const candidates = extractMedicineCandidates('', ocrLines);

    expect(candidates).toHaveLength(4);
    expect(candidates.map(candidate => candidate.medicineText)).toEqual([
      'ExampleDrugA 650 mg Tablet',
      'ExampleDrugB + ComponentB syrup (100 ml)',
      'ExampleDrugC 40 mg Tablet',
      'ExampleDrugD 500 mg Tablet'
    ]);
    expect(candidates.map(candidate => candidate.instructions)).toEqual([
      '1-0-1 x 5 days',
      '10 ml TID x 5 days',
      '1-0-0 x 5 days',
      '1-0-0 x 10 days'
    ]);
    expect(candidates[1]).toMatchObject({
      medicineName: 'ExampleDrugB + ComponentB',
      dosageForm: 'syrup',
      duration: 5
    });
  });

  test.each([
    '1-0-1 x 5 days',
    '1-0-0 x 5 days',
    '10 ml TID x 5 days',
    '5 ml BD x 3 days',
    '1 tab OD x 7 days',
    '2 puffs SOS'
  ])('associates compact direction %s without creating another candidate', (instruction) => {
    const candidates = extractMedicineCandidates(['Rx', 'ExampleDrugE 10 mg Tablet', instruction].join('\n'));
    expect(candidates).toHaveLength(1);
    expect(candidates[0].medicineText).toBe('ExampleDrugE 10 mg Tablet');
    expect(candidates[0].instructions).toBe(instruction);
  });

  test.each([
    ['Syrup (100 ml)', 'syrup', '100 ml'],
    ['(60 ml) Suspension', 'suspension', '60 ml'],
    ['Inhaler (100 mcg)', 'inhaler', '100 mcg'],
    ['Spray (50 mcg)', 'spray', '50 mcg']
  ])('joins generic package-form continuation %s', (continuation, dosageForm, packageSize) => {
    const candidates = extractMedicineCandidates(['Rx', 'ExampleDrugF', continuation].join('\n'));
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ medicineName: 'ExampleDrugF', dosageForm });
    expect(candidates[0].medicineText).toContain(packageSize);
    expect(candidates[0].medicineText).toMatch(new RegExp(dosageForm, 'i'));
  });

  test('keeps the imperative dissolve continuation associated with its preceding medicine', () => {
    const candidates = extractMedicineCandidates([
      'Rx',
      'ExamplePowder sachet | 5 sachets',
      'Dissolve 1 sachet in 200 ml of water.'
    ].join('\n'));
    expect(candidates).toHaveLength(1);
    expect(candidates[0].instructions).toBe('Dissolve 1 sachet in 200 ml of water.');
  });

  test.each([
    'ExampleDrug 20 mg Tablet x 5 days',
    'ExampleDrug 20 mg Tablet × 5 days',
    'ExampleDrug 20 mg Tablet X 7 days',
    'ExampleDrug Capsule x 10 days'
  ])('removes treatment-duration suffix from Master-match identity: %s', (line) => {
    const [candidate] = extractMedicineCandidates(line);
    expect(candidate.medicineText).not.toMatch(/\s(?:x|×)\s*\d+\s*(?:days?|weeks?)$/i);
    expect(candidate.instructions).toMatch(/(?:x|×)\s*\d+\s*(?:days?|weeks?)/i);
  });

  test('associates a detached right-column treatment-duration suffix without creating a candidate', () => {
    const candidates = extractMedicineCandidates('', [
      { text: 'Rx', box: [50, 50, 80, 70] },
      { text: 'ExampleDrug 20 mg Tablet', box: [100, 100, 350, 122] },
      { text: '× 5 days', box: [520, 100, 620, 122] }
    ]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].medicineText).toBe('ExampleDrug 20 mg Tablet');
    expect(candidates[0].instructions).toBe('× 5 days');
  });
});
