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
