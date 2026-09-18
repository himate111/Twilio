const mockSearchMedicines = jest.fn();
const mockSearchMedicinesForLookup = jest.fn();
const mockResolveSuggestedMedicine = jest.fn();
const mockValidateStock = jest.fn();
const mockExtractText = jest.fn();
const mockValidateImageFile = jest.fn();
const mockCleanupTemporaryImage = jest.fn();

jest.mock('../src/services/dispensingService', () => ({
  searchMedicines: mockSearchMedicines,
  searchMedicinesForLookup: mockSearchMedicinesForLookup,
  resolveSuggestedMedicine: mockResolveSuggestedMedicine,
  validateStock: mockValidateStock
}));
jest.mock('../src/services/imageDownloadService', () => ({
  isSupportedImageMimeType: jest.fn(() => true),
  validateImageFile: mockValidateImageFile,
  cleanupTemporaryImage: mockCleanupTemporaryImage
}));
jest.mock('../src/services/prescriptionOcrService', () => ({ extractText: mockExtractText }));
jest.mock('../src/services/patientNotificationService', () => ({}));

const dispensingFlow = require('../src/flows/dispensingFlow');
const { welcomeMessages } = require('../src/utils/formatter');
const FakeSessionManager = require('./helpers/fakeSessionManager');

describe('dispensingFlow Step 1 patient selection', () => {
  const userId = 'whatsapp:+15551234567';
  const actor = { facilityId: 1, userId: 10 };
  const visualSeparator = /[─┈]/;

  function context(sessionManager, text, session = null) {
    return {
      userId,
      actor,
      session,
      text,
      media: [],
      sessionManager,
      services: {}
    };
  }

  test('returns one Step 1 message with blank-line spacing between patient options', async () => {
    const sessionManager = new FakeSessionManager();
    const reply = await dispensingFlow.start(context(sessionManager, ''));
    const lines = reply.split('\n');

    expect(Array.isArray(reply)).toBe(false);
    expect(lines).toEqual([
      '📋 Step 1 of 3',
      '',
      '👤 Patient',
      '',
      '1️⃣ Existing Patient',
      '',
      '2️⃣ New Patient',
      '',
      'Reply with 1 or 2.'
    ]);
    expect(lines[5]).toBe('');
    expect(reply).not.toMatch(visualSeparator);
    expect(welcomeMessages('Siva')[0]).not.toMatch(visualSeparator);
  });

  test.each([
    ['1', 'Enter Patient Phone Number', 'existing_patient_phone'],
    ['2', 'Enter Patient Name', 'name']
  ])('preserves patient selection routing for reply %s', async (choice, expectedReply, expectedStep) => {
    const sessionManager = new FakeSessionManager();
    await dispensingFlow.start(context(sessionManager, ''));
    const session = await sessionManager.getSession(userId);

    await expect(
      dispensingFlow.handle(context(sessionManager, choice, session))
    ).resolves.toBe(expectedReply);

    await expect(sessionManager.getSession(userId)).resolves.toEqual(
      expect.objectContaining({ step: expectedStep })
    );
  });
});

describe('dispensingFlow message formatting', () => {
  const userId = 'whatsapp:+15551234567';
  const actor = { facilityId: 1, userId: 10 };

  function context(sessionManager, text, session) {
    return { userId, actor, sessionManager, session, text, media: [], services: {} };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('keeps selected medicine records grouped and separates them with one blank line', async () => {
    const sessionManager = new FakeSessionManager();
    mockSearchMedicines.mockResolvedValue([
      { id: 1, name: 'Amoxicillin', batchNumber: 'AMOXI', expiryDate: '2026-10-31', stock: 539 },
      { id: 2, name: 'Amoxicillin 250mg', batchNumber: 'AMOXI250', expiryDate: '2026-09-30', stock: 880 }
    ]);
    const session = {
      facilityId: 1,
      step: 'medicine_entry',
      data: { items: [] }
    };

    await expect(dispensingFlow.handle(context(sessionManager, 'amoxi', session))).resolves.toBe([
      'Select Medicine',
      '',
      '1. Amoxicillin',
      'Batch: AMOXI',
      'Expiry: 2026-10-31',
      'Stock: 539',
      '',
      '2. Amoxicillin 250mg',
      'Batch: AMOXI250',
      'Expiry: 2026-09-30',
      'Stock: 880',
      '',
      'Reply with option number'
    ].join('\n'));
  });

  test('separates add-more and summary confirmation choices with blank lines', async () => {
    const sessionManager = new FakeSessionManager();
    mockValidateStock.mockResolvedValue();
    const quantitySession = {
      facilityId: 1,
      step: 'quantity_entry',
      data: {
        product: { id: 1, name: 'Amoxicillin', controlledDrug: false },
        batch: 'AMOXI',
        items: []
      }
    };

    await expect(dispensingFlow.handle(context(sessionManager, '20', quantitySession))).resolves.toContain(
      '1 Add Another Medicine\n\n2 Continue'
    );

    const summarySession = {
      facilityId: 1,
      step: 'add_more_medicines',
      data: {
        patientName: 'Michael Johnson',
        prescriptionUploaded: false,
        items: [
          { medicineName: 'Amoxicillin', batch: 'AMOXI', quantity: 20 },
          { medicineName: 'Paracetamol', batch: 'PARA', quantity: 10 }
        ]
      }
    };

    const reply = await dispensingFlow.handle(context(sessionManager, '2', summarySession));
    expect(reply).toContain('1. Amoxicillin\nBatch: AMOXI\nQty: 20\n\n2. Paracetamol');
    expect(reply).toContain('1 Confirm Dispense\n\n0 Cancel');
    expect(reply).not.toMatch(/[─┈]/);
  });
});

describe('dispensingFlow prescription OCR integration', () => {
  test('sends only clean medicine identities to Master lookup and cleans the temporary image', async () => {
    const userId = 'whatsapp:+15551234567';
    const actor = { facilityId: 1, userId: 10 };
    const sessionManager = new FakeSessionManager();
    mockExtractText.mockResolvedValue([
      'AFSAR POLYCLINIC',
      'Ph: 044 1234 5678',
      'Rx',
      'Paracetamol 500mg Tablet | 10 Tablets',
      'Amoxicillin 250mg Capsule | 20 Capsules',
      'Amlodipine 5mg Tablet | 30 Tablets',
      'Omeprazole 20mg Capsule | 15 Capsules',
      'Dose: 1 tablet after food',
      'Duration: 5 days'
    ].join('\n'));
    mockSearchMedicines.mockResolvedValue([{ id: 1, name: 'Matched medicine', batchNumber: 'MATCHED', expiryDate: '2027-01-01', stock: 10 }]);
    const session = { facilityId: 1, step: 'prescription_upload', data: { patientName: '', items: [] } };
    const reply = await dispensingFlow.handle({
      userId, actor, sessionManager, session, text: '',
      media: [{ path: 'uploads/prescription-test.jpg', contentType: 'image/jpeg' }], services: {}
    });
    expect(mockExtractText).toHaveBeenCalledWith('uploads/prescription-test.jpg');
    expect(mockSearchMedicines.mock.calls).toEqual([
      ['Paracetamol 500mg Tablet', 1],
      ['Amoxicillin 250mg Capsule', 1],
      ['Amlodipine 5mg Tablet', 1],
      ['Omeprazole 20mg Capsule', 1]
    ]);
    expect(mockCleanupTemporaryImage).toHaveBeenCalledWith('uploads/prescription-test.jpg');
    expect(reply).toContain('PRESCRIPTION ANALYSIS');
  });

  test('keeps an unmatched prescription medicine unresolved without forcing a match', async () => {
    const userId = 'whatsapp:+15551234567';
    const actor = { facilityId: 1, userId: 10 };
    const sessionManager = new FakeSessionManager();
    mockExtractText.mockResolvedValue('Rx\nUnknownmedicine 500mg Tablet | 10 Tablets');
    mockSearchMedicines.mockResolvedValue([]);
    const session = { facilityId: 1, step: 'prescription_upload', data: { patientName: '', items: [] } };

    const reply = await dispensingFlow.handle({
      userId, actor, sessionManager, session, text: '',
      media: [{ path: 'uploads/unmatched-prescription.jpg', contentType: 'image/jpeg' }], services: {}
    });

    expect(mockSearchMedicines).toHaveBeenCalledWith('Unknownmedicine 500mg Tablet', 1);
    expect(session.data.unmatchedMedicines).toEqual(['Unknownmedicine 500mg Tablet']);
    expect(reply).toContain('Unable to identify medicines from prescription');
  });
});

describe('dispensingFlow OCR re-upload', () => {
  const userId = 'whatsapp:+15551234567';
  const actor = { facilityId: 7, userId: 10 };
  const makeContext = (sessionManager, session, text, media = []) => ({ userId, actor, sessionManager, session, text, media, services: {} });

  beforeEach(() => {
    jest.clearAllMocks();
    mockExtractText.mockResolvedValue('AFSAR POLYCLINIC\nDr. MD. THAHER\nRx\nAmoxicillin 250mg');
    mockSearchMedicines.mockResolvedValue([{ id: 1, name: 'Amoxicillin 250mg', batchNumber: 'A1', expiryDate: '2027-01-01', stock: 4 }]);
  });

  test('option 1 resets stale OCR state and the next image runs OCR', async () => {
    const sessionManager = new FakeSessionManager();
    const session = { facilityId: 7, step: 'ocr_suggestion', data: { patientName: 'Siva', pendingSuggestion: null, unmatchedMedicines: ['old'], ocrText: 'old', items: [{ old: true }] } };
    await expect(dispensingFlow.handle(makeContext(sessionManager, session, '1'))).resolves.toContain('Upload another prescription image');
    expect(session.step).toBe('prescription_upload');
    expect(session.data.unmatchedMedicines).toEqual([]);
    expect(session.data.pendingSuggestion).toBeNull();
    const reply = await dispensingFlow.handle(makeContext(sessionManager, session, '', [{ path: 'uploads/replacement.jpg', contentType: 'image/jpeg' }]));
    expect(mockExtractText).toHaveBeenCalledWith('uploads/replacement.jpg');
    expect(session.facilityId).toBe(7);
    expect(session.data.patientName).toBe('Siva');
    expect(reply).toContain('PRESCRIPTION ANALYSIS');
  });

  test('a direct replacement image in ocr_suggestion re-enters OCR instead of rejecting it', async () => {
    const sessionManager = new FakeSessionManager();
    const session = { facilityId: 7, step: 'ocr_suggestion', data: { patientName: 'Siva', pendingSuggestion: null, unmatchedMedicines: ['old'], items: [] } };
    const reply = await dispensingFlow.handle(makeContext(sessionManager, session, '', [{ path: 'uploads/direct-replacement.jpg', contentType: 'image/jpeg' }]));
    expect(mockExtractText).toHaveBeenCalledWith('uploads/direct-replacement.jpg');
    expect(reply).not.toBe('Select 1, 2 or 0');
    expect(reply).toContain('PRESCRIPTION ANALYSIS');
  });

  test('option 2 preserves manual entry and option 0 cancels', async () => {
    const sessionManager = new FakeSessionManager();
    const manual = { facilityId: 7, step: 'ocr_suggestion', data: { pendingSuggestion: null, items: [] } };
    await expect(dispensingFlow.handle(makeContext(sessionManager, manual, '2'))).resolves.toBe('Enter medicine name manually');
    expect(manual.step).toBe('medicine_entry');
    const cancel = { facilityId: 7, step: 'ocr_suggestion', data: { pendingSuggestion: null, items: [] } };
    await dispensingFlow.handle(makeContext(sessionManager, cancel, '0'));
    await expect(sessionManager.getSession(userId)).resolves.toBeNull();
  });
});
describe('dispensingFlow representative OCR cleanup integration', () => {
  const michaelJohnsonPrescription = [
    'Patient Name: | Michael Johnson | Date: 18/06/2026',
    'Rx',
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

  beforeEach(() => {
    jest.clearAllMocks();
    mockExtractText.mockResolvedValue(michaelJohnsonPrescription);
    mockSearchMedicines.mockResolvedValue([{ id: 1, name: 'Matched medicine', batchNumber: 'B1', expiryDate: '2027-01-01', stock: 10 }]);
  });

  test('passes only the four cleaned medicine values to searchMedicines', async () => {
    const sessionManager = new FakeSessionManager();
    const session = { facilityId: 1, step: 'prescription_upload', data: { patientName: 'Michael Johnson', items: [] } };

    const reply = await dispensingFlow.handle({
      userId: 'whatsapp:+15551234567', actor: { facilityId: 1, userId: 10 }, sessionManager, session,
      text: '', media: [{ path: 'uploads/michael-johnson.jpg', contentType: 'image/jpeg' }], services: {}
    });

    expect(mockSearchMedicines.mock.calls).toEqual([
      ['Paracetamol 500mg', 1],
      ['Amlodipine 5mg', 1],
      ['Zinc Sulphate 20mg', 1],
      ['Artemether/Lumefantrine', 1]
    ]);
    expect(reply).toContain('PRESCRIPTION ANALYSIS');
  });

  test('uses the cleaned prescription name in the existing mismatch response and state', async () => {
    const sessionManager = new FakeSessionManager();
    const session = { facilityId: 1, step: 'prescription_upload', data: { patientName: 'sivasankar', items: [] } };

    const reply = await dispensingFlow.handle({
      userId: 'whatsapp:+15551234567', actor: { facilityId: 1, userId: 10 }, sessionManager, session,
      text: '', media: [{ path: 'uploads/mismatch-michael-johnson.jpg', contentType: 'image/jpeg' }], services: {}
    });

    expect(reply).toContain('Prescription Name: Michael Johnson');
    expect(session.data.prescriptionName).toBe('Michael Johnson');
    expect(mockSearchMedicines).not.toHaveBeenCalled();
  });
});
describe('dispensingFlow OCR candidate queue resume', () => {
  const userId = 'whatsapp:+15551234567';
  const actor = { facilityId: 1, userId: 10 };
  const makeContext = (sessionManager, session, text, media = []) => ({
    userId, actor, sessionManager, session, text, media, services: {}
  });
  const accepted = (id, name, batch) => ({
    id,
    name,
    batches: [{ id: `${id}-batch`, batchNumber: batch, expiryDate: '2027-01-01', stock: 10 }]
  });
  const resolved = (id, name, batch) => ({
    id, name, batchNumber: batch, expiryDate: '2027-01-01', stock: 10
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('persists later candidates and resumes them after accepting a possible match', async () => {
    mockExtractText.mockResolvedValue('Rx\n1. Paracetamol 500mg\n2. Amlodipine 5mg');
    mockSearchMedicines
      .mockResolvedValueOnce({ length: 1, 0: { detected: 'Paracetamol 500mg', suggested: 'Paracetamol', confidence: 65 } })
      .mockResolvedValueOnce([resolved('aml-5', 'Amlodipine', 'AQ21')]);
    mockSearchMedicinesForLookup.mockResolvedValue([accepted('para-500', 'Paracetamol', 'PR-12')]);
    const sessionManager = new FakeSessionManager();
    const session = { facilityId: 1, step: 'prescription_upload', data: { patientName: '', items: [] } };

    const firstReply = await dispensingFlow.handle(makeContext(
      sessionManager,
      session,
      '',
      [{ path: 'uploads/queue.jpg', contentType: 'image/jpeg' }]
    ));

    expect(firstReply).toContain('Possible Match:');
    expect(session.data.ocrCandidates.map((candidate) => candidate.medicineText)).toEqual([
      'Paracetamol 500mg',
      'Amlodipine 5mg'
    ]);
    expect(session.data.ocrCandidateIndex).toBe(0);
    expect(session.data.items).toEqual([]);

    const finalReply = await dispensingFlow.handle(makeContext(sessionManager, session, '1'));

    expect(mockSearchMedicines.mock.calls).toEqual([
      ['Paracetamol 500mg', 1],
      ['Amlodipine 5mg', 1]
    ]);
    expect(finalReply).toContain('Paracetamol');
    expect(finalReply).toContain('Amlodipine');
    expect(session.data.items.map((item) => item.medicineName)).toEqual([
      'Paracetamol',
      'Amlodipine'
    ]);
    expect(session.data.ocrCandidates).toBeUndefined();
  });

  test('preserves three candidates across multiple sequential possible-match pauses', async () => {
    mockExtractText.mockResolvedValue('Rx\n1. Alpha 1mg\n2. Beta 2mg\n3. Gamma 3mg');
    mockSearchMedicines
      .mockResolvedValueOnce([{ detected: 'Alpha 1mg', suggested: 'Alpha', confidence: 65 }])
      .mockResolvedValueOnce([{ detected: 'Beta 2mg', suggested: 'Beta', confidence: 65 }])
      .mockResolvedValueOnce([{ detected: 'Gamma 3mg', suggested: 'Gamma', confidence: 65 }]);
    mockSearchMedicinesForLookup
      .mockResolvedValueOnce([accepted('alpha', 'Alpha', 'A1')])
      .mockResolvedValueOnce([accepted('beta', 'Beta', 'B1')])
      .mockResolvedValueOnce([accepted('gamma', 'Gamma', 'G1')]);
    const sessionManager = new FakeSessionManager();
    const session = { facilityId: 1, step: 'prescription_upload', data: { patientName: '', items: [] } };

    await dispensingFlow.handle(makeContext(sessionManager, session, '', [{ path: 'uploads/three.jpg', contentType: 'image/jpeg' }]));
    expect(session.data.ocrCandidates).toHaveLength(3);
    await dispensingFlow.handle(makeContext(sessionManager, session, '1'));
    expect(session.data.items.map((item) => item.medicineName)).toEqual(['Alpha']);
    expect(session.data.ocrCandidateIndex).toBe(1);
    await dispensingFlow.handle(makeContext(sessionManager, session, '1'));
    expect(session.data.items.map((item) => item.medicineName)).toEqual(['Alpha', 'Beta']);
    expect(session.data.ocrCandidateIndex).toBe(2);
    const finalReply = await dispensingFlow.handle(makeContext(sessionManager, session, '1'));

    expect(finalReply).toContain('Gamma');
    expect(session.data.items.map((item) => item.medicineName)).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  test('accepting a strength-constrained fuzzy suggestion preserves its Master ID before resuming', async () => {
    mockResolveSuggestedMedicine.mockResolvedValue([resolved('p500', 'Paracetamol', 'PR-12')]);
    mockSearchMedicines.mockResolvedValue([resolved('aml5', 'Amlodipine', 'AQ21')]);
    const sessionManager = new FakeSessionManager();
    const suggestion = {
      detected: 'Paracetmol 500mg',
      suggested: 'Paracetamol',
      suggestedMedicine: { id: 'p500', name: 'Paracetamol', strength: '500 mg' },
      confidence: 65,
      candidateIndex: 0
    };
    const session = {
      facilityId: 1,
      step: 'ocr_suggestion',
      data: {
        items: [],
        unmatchedMedicines: [],
        ocrCandidates: [
          { medicineText: 'Paracetmol 500mg', rawText: 'Paracetmol 500mg' },
          { medicineText: 'Amlodipine 5mg', rawText: 'Amlodipine 5mg' }
        ],
        ocrCandidateIndex: 0,
        pendingSuggestion: suggestion
      }
    };

    const reply = await dispensingFlow.handle(makeContext(sessionManager, session, '1'));

    expect(mockResolveSuggestedMedicine).toHaveBeenCalledWith(suggestion, 1);
    expect(session.data.items.map((item) => item.productId)).toEqual(['p500', 'aml5']);
    expect(reply).toContain('Amlodipine');
  });
  test('preserves an ambiguous candidate without selecting a database-order-dependent Master row', async () => {
    mockExtractText.mockResolvedValue('Rx\nParacetamol 500mg');
    mockSearchMedicines.mockResolvedValue([{
      detected: 'Paracetamol 500mg',
      ambiguous: true,
      confidence: 0,
      alternatives: [
        { name: 'Paracetamol', strength: '500mg', formulation: 'Tablet' },
        { name: 'Paracetamol', strength: '500mg', formulation: 'Capsule' }
      ]
    }]);
    const sessionManager = new FakeSessionManager();
    const session = { facilityId: 1, step: 'prescription_upload', data: { patientName: '', items: [] } };

    const reply = await dispensingFlow.handle(makeContext(
      sessionManager,
      session,
      '',
      [{ path: 'uploads/ambiguous.jpg', contentType: 'image/jpeg' }]
    ));

    expect(reply).toContain('A medicine was not selected automatically.');
    expect(session.step).toBe('ocr_suggestion');
    expect(session.data.ocrCandidates).toHaveLength(1);
    expect(session.data.ocrCandidateIndex).toBe(0);
    expect(session.data.items).toEqual([]);
  });
  test('replacement upload clears stale candidate queue and progress before processing the new image', async () => {
    mockExtractText.mockResolvedValue('Rx\nAmoxicillin 250mg');
    mockSearchMedicines.mockResolvedValue([resolved('amox', 'Amoxicillin', 'AMOX-1')]);
    const sessionManager = new FakeSessionManager();
    const session = {
      facilityId: 1,
      step: 'ocr_suggestion',
      data: {
        items: [{ medicineName: 'Old' }],
        unmatchedMedicines: ['Old'],
        ocrCandidates: [{ medicineText: 'Old 1mg' }],
        ocrCandidateIndex: 0,
        pendingSuggestion: { suggested: 'Old' }
      }
    };

    await dispensingFlow.handle(makeContext(
      sessionManager,
      session,
      '',
      [{ path: 'uploads/replacement-queue.jpg', contentType: 'image/jpeg' }]
    ));

    expect(session.data.items.map((item) => item.medicineName)).toEqual(['Amoxicillin']);
    expect(session.data.ocrCandidates).toBeUndefined();
    expect(session.data.ocrCandidateIndex).toBeUndefined();
  });

  test('cancel clears the pending OCR candidate state with the session', async () => {
    const sessionManager = new FakeSessionManager();
    const session = {
      facilityId: 1,
      step: 'ocr_suggestion',
      data: {
        ocrCandidates: [{ medicineText: 'Paracetamol 500mg' }],
        ocrCandidateIndex: 0,
        pendingSuggestion: { suggested: 'Paracetamol' }
      }
    };

    await dispensingFlow.handle(makeContext(sessionManager, session, '0'));
    await expect(sessionManager.getSession(userId)).resolves.toBeNull();
  });
  test('manual entry clears stale candidate-processing state', async () => {
    const sessionManager = new FakeSessionManager();
    const session = {
      facilityId: 1,
      step: 'ocr_suggestion',
      data: {
        items: [{ medicineName: 'Old' }],
        unmatchedMedicines: ['Old'],
        ocrCandidates: [{ medicineText: 'Old 1mg' }],
        ocrCandidateIndex: 0,
        pendingSuggestion: { suggested: 'Old' }
      }
    };

    await expect(dispensingFlow.handle(makeContext(sessionManager, session, '3'))).resolves.toBe('Enter medicine name manually');
    expect(session.step).toBe('medicine_entry');
    expect(session.data.ocrCandidates).toBeUndefined();
    expect(session.data.ocrCandidateIndex).toBeUndefined();
    expect(session.data.pendingSuggestion).toBeNull();
  });
});

describe('dispensingFlow quantity integration', () => {
  const userId = 'whatsapp:+15551234567';
  const actor = { facilityId: 1, userId: 10 };
  const makeContext = (sessionManager, session, text, media = []) => ({
    userId, actor, sessionManager, session, text, media, services: {}
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Paracetamol with 5-day direction gets calculatedQuantity 15 pre-filled in session item', async () => {
    mockExtractText.mockResolvedValue(
      'Paracetamol 500mg\nTake 1 tablet three times daily for 5 days.'
    );
    mockSearchMedicines.mockResolvedValue([{
      id: 'para-500',
      name: 'Paracetamol',
      batchNumber: 'PR-12',
      expiryDate: '2027-01-01',
      stock: 30
    }]);

    const sessionManager = new FakeSessionManager();
    const session = { facilityId: 1, step: 'prescription_upload', data: { patientName: '', items: [] } };

    const reply = await dispensingFlow.handle(makeContext(
      sessionManager, session, '',
      [{ path: 'uploads/para-5day.jpg', contentType: 'image/jpeg' }]
    ));

    expect(reply).toContain('PRESCRIPTION ANALYSIS');
    expect(reply).toContain('Quantity to dispense: 15 tablets');

    expect(session.data.items).toHaveLength(1);
    const item = session.data.items[0];
    expect(item.medicineName).toBe('Paracetamol');
    expect(item.calculatedQuantity).toBe(15);
    expect(item.quantitySource).toBe('calculated_from_directions');
    expect(item.quantity).toBe(15);
  });

  test('Amlodipine without duration gets quantitySource manual_input_required and no pre-fill', async () => {
    mockExtractText.mockResolvedValue(
      'Amlodipine 5mg\nTake 1 tablet once daily.'
    );
    mockSearchMedicines.mockResolvedValue([{
      id: 'aml-5',
      name: 'Amlodipine',
      batchNumber: 'AQ21',
      expiryDate: '2027-06-01',
      stock: 10
    }]);

    const sessionManager = new FakeSessionManager();
    const session = { facilityId: 1, step: 'prescription_upload', data: { patientName: '', items: [] } };

    await dispensingFlow.handle(makeContext(
      sessionManager, session, '',
      [{ path: 'uploads/aml-noduration.jpg', contentType: 'image/jpeg' }]
    ));

    expect(session.data.items).toHaveLength(1);
    const item = session.data.items[0];
    expect(item.medicineName).toBe('Amlodipine');
    expect(item.quantitySource).toBe('manual_input_required');
    expect(item.quantity).toBeNull();
    expect(item.calculatedQuantity).toBeNull();
  });

  test('OCR_REVIEW reply "1" transitions to OCR_QUANTITY_ENTRY and shows renderQuantityPrompt', async () => {
    const sessionManager = new FakeSessionManager();
    const session = {
      facilityId: 1,
      step: 'ocr_review',
      data: {
        items: [{
          medicineName: 'Paracetamol',
          quantity: 15,
          batch: 'PR-12',
          expiryDate: '2027-01-01',
          availableStock: 30,
          calculatedQuantity: 15,
          quantitySource: 'calculated_from_directions'
        }],
        currentQuantityIndex: 0
      }
    };

    const reply = await dispensingFlow.handle(makeContext(sessionManager, session, '1'));

    expect(session.step).toBe('ocr_quantity_confirmation');
    expect(reply).toContain('Paracetamol');
    expect(reply).toContain('Quantity to dispense: 15 tablets');
    expect(reply).toContain('1 Keep this quantity');
    expect(reply).toContain('2 Enter a different quantity');
    expect(reply).not.toContain('Prefilled Quantity:');
    expect(reply).not.toContain('reply 1 or OK');
    expect(reply).not.toContain('or OK');
    expect(reply).not.toContain('OK to keep');
    expect(reply).not.toContain('Prescribed Quantity:');
    expect(reply).not.toContain('Quantity Source:');
  });

  test('OCR analysis message includes simplified "Quantity to dispense:" for each item', async () => {
    mockExtractText.mockResolvedValue(
      'Paracetamol 500mg\nTake 1 tablet three times daily for 5 days.'
    );
    mockSearchMedicines.mockResolvedValue([{
      id: 'para-500',
      name: 'Paracetamol',
      batchNumber: 'PR-12',
      expiryDate: '2027-01-01',
      stock: 30
    }]);

    const sessionManager = new FakeSessionManager();
    const session = { facilityId: 1, step: 'prescription_upload', data: { patientName: '', items: [] } };

    const reply = await dispensingFlow.handle(makeContext(
      sessionManager, session, '',
      [{ path: 'uploads/para-analysis.jpg', contentType: 'image/jpeg' }]
    ));

    expect(reply).toContain('Quantity to dispense: 15 tablets');
    expect(reply).not.toContain('Prescribed quantity:');
    expect(reply).not.toContain('Quantity source:');
  });

  test('pre-filled quantity is kept when user replies OK in OCR_QUANTITY_CONFIRMATION', async () => {
    const sessionManager = new FakeSessionManager();
    const session = {
      facilityId: 1,
      step: 'ocr_quantity_confirmation',
      data: {
        currentQuantityIndex: 0,
        items: [{
          medicineName: 'Paracetamol',
          quantity: 15,
          batch: 'PR-12',
          expiryDate: '2027-01-01',
          availableStock: 30,
          calculatedQuantity: 15,
          quantitySource: 'calculated_from_directions'
        }]
      }
    };

    const reply = await dispensingFlow.handle(makeContext(sessionManager, session, 'OK'));

    expect(reply).toContain('DISPENSING SUMMARY');
    expect(session.data.items[0].quantity).toBe(15);
  });

  test('pre-filled quantity is overridden when user enters a different numeric value in OCR_QUANTITY_OVERRIDE_ENTRY', async () => {
    const sessionManager = new FakeSessionManager();
    const session = {
      facilityId: 1,
      step: 'ocr_quantity_override_entry',
      data: {
        currentQuantityIndex: 0,
        items: [{
          medicineName: 'Paracetamol',
          quantity: 15,
          batch: 'PR-12',
          expiryDate: '2027-01-01',
          availableStock: 30,
          calculatedQuantity: 15,
          quantitySource: 'calculated_from_directions'
        }]
      }
    };

    await dispensingFlow.handle(makeContext(sessionManager, session, '20'));

    expect(session.data.items[0].quantity).toBe(20);
  });

  test('pre-filled quantity is kept when user replies 1 in OCR_QUANTITY_CONFIRMATION', async () => {
    const sessionManager = new FakeSessionManager();
    const session = {
      facilityId: 1,
      step: 'ocr_quantity_confirmation',
      data: {
        currentQuantityIndex: 0,
        items: [{
          medicineName: 'Metformin',
          quantity: 60,
          batch: 'METH',
          expiryDate: '2026-09-30',
          availableStock: 720,
          calculatedQuantity: 60,
          quantitySource: 'calculated_from_directions'
        }]
      }
    };

    const reply = await dispensingFlow.handle(makeContext(sessionManager, session, '1'));

    expect(reply).toContain('DISPENSING SUMMARY');
    expect(session.data.items[0].quantity).toBe(60);
  });

  test('pre-filled quantity is overridden when user enters 50 in OCR_QUANTITY_OVERRIDE_ENTRY', async () => {
    const sessionManager = new FakeSessionManager();
    const session = {
      facilityId: 1,
      step: 'ocr_quantity_override_entry',
      data: {
        currentQuantityIndex: 0,
        items: [{
          medicineName: 'Metformin',
          quantity: 60,
          batch: 'METH',
          expiryDate: '2026-09-30',
          availableStock: 720,
          calculatedQuantity: 60,
          quantitySource: 'calculated_from_directions'
        }]
      }
    };

    const reply = await dispensingFlow.handle(makeContext(sessionManager, session, '50'));

    expect(reply).toContain('DISPENSING SUMMARY');
    expect(session.data.items[0].quantity).toBe(50);
  });

  test('multi-medicine: Paracetamol pre-filled 15, Amlodipine requires manual input', async () => {
    mockExtractText.mockResolvedValue(
      'Paracetamol 500mg\nTake 1 tablet three times daily for 5 days.\nAmlodipine 5mg\nTake 1 tablet once daily.'
    );
    mockSearchMedicines
      .mockResolvedValueOnce([{
        id: 'para-500',
        name: 'Paracetamol',
        batchNumber: 'PR-12',
        expiryDate: '2027-01-01',
        stock: 30
      }])
      .mockResolvedValueOnce([{
        id: 'aml-5',
        name: 'Amlodipine',
        batchNumber: 'AQ21',
        expiryDate: '2027-06-01',
        stock: 10
      }]);

    const sessionManager = new FakeSessionManager();
    const session = { facilityId: 1, step: 'prescription_upload', data: { patientName: '', items: [] } };

    await dispensingFlow.handle(makeContext(
      sessionManager, session, '',
      [{ path: 'uploads/multi-med.jpg', contentType: 'image/jpeg' }]
    ));

    expect(session.data.items).toHaveLength(2);
    const [para, aml] = session.data.items;
    expect(para.medicineName).toBe('Paracetamol');
    expect(para.calculatedQuantity).toBe(15);
    expect(para.quantity).toBe(15);
    expect(aml.medicineName).toBe('Amlodipine');
    expect(aml.quantitySource).toBe('manual_input_required');
    expect(aml.quantity).toBeNull();
  });
});

describe('dispensingFlow product deduplication and metadata merge', () => {
  const { mergeOcrItems, addOrMergeOcrItem, formatQuantityToDispense, renderQuantityPrompt } = dispensingFlow._testing;

  test('renderQuantityPrompt format for calculated/prefilled quantity', () => {
    const item = {
      medicineName: 'Metformin',
      calculatedQuantity: 60,
      quantity: 60,
      batch: 'METH',
      expiryDate: '2026-09-30',
      availableStock: 720
    };
    const prompt = renderQuantityPrompt(item);

    expect(prompt).toBe([
      'Metformin',
      '',
      'Quantity to dispense: 60 tablets',
      '',
      'Batch: METH',
      'Expiry: 2026-09-30',
      'Available Stock: 720',
      '',
      '1 Keep this quantity',
      '2 Enter a different quantity'
    ].join('\n'));

    expect(prompt).toContain('Quantity to dispense: 60 tablets');
    expect(prompt).toContain('1 Keep this quantity');
    expect(prompt).toContain('2 Enter a different quantity');
    expect(prompt).not.toContain('Prefilled Quantity:');
    expect(prompt).not.toContain('reply 1 or OK');
    expect(prompt).not.toContain('or OK');
    expect(prompt).not.toContain('OK to keep');
    expect(prompt).not.toContain('Prescribed Quantity:');
    expect(prompt).not.toContain('Quantity Source:');
  });

  test('renderQuantityPrompt format for manual quantity branch', () => {
    const item = {
      medicineName: 'Metformin',
      calculatedQuantity: null,
      quantity: null,
      batch: 'METH',
      expiryDate: '2026-09-30',
      availableStock: 720
    };
    const prompt = renderQuantityPrompt(item);

    expect(prompt).toBe([
      'Metformin',
      '',
      'Quantity to dispense: Enter manually',
      '',
      'Batch: METH',
      'Expiry: 2026-09-30',
      'Available Stock: 720',
      '',
      'Enter quantity:'
    ].join('\n'));

    expect(prompt).toContain('Quantity to dispense: Enter manually');
    expect(prompt).toContain('Enter quantity:');
    expect(prompt).not.toContain('1 Keep this quantity');
    expect(prompt).not.toContain('Prefilled Quantity:');
  });

  test('formatQuantityToDispense returns prescribedQuantityText when present', () => {
    expect(formatQuantityToDispense({ prescribedQuantityText: '2 sachets' })).toBe('2 sachets');
  });

  test('formatQuantityToDispense returns calculatedQuantity with tablets suffix', () => {
    expect(formatQuantityToDispense({ calculatedQuantity: 60 })).toBe('60 tablets');
  });

  test('formatQuantityToDispense returns Enter manually when no quantity is present', () => {
    expect(formatQuantityToDispense({})).toBe('Enter manually');
    expect(formatQuantityToDispense({ calculatedQuantity: null })).toBe('Enter manually');
  });

  test('E1. Quantity merge: null + trusted 2 -> 2', () => {
    const existing = {
      productId: 'prod-ors',
      medicineName: 'ORS Sachets',
      quantity: null,
      calculatedQuantity: null,
      explicitQuantity: null,
      quantitySource: 'manual_input_required'
    };
    const incoming = {
      productId: 'prod-ors',
      medicineName: 'ORS Sachets',
      quantity: 2,
      explicitQuantity: 2,
      prescribedQuantityText: '2sachets.',
      quantitySource: 'explicit_prescription_quantity',
      quantityConfidence: 1.0
    };

    mergeOcrItems(existing, incoming);

    expect(existing.quantity).toBe(2);
    expect(existing.explicitQuantity).toBe(2);
    expect(existing.prescribedQuantityText).toBe('2sachets.');
    expect(existing.quantitySource).toBe('explicit_prescription_quantity');
  });

  test('E2. Quantity merge: trusted 2 + null -> keeps trusted 2', () => {
    const existing = {
      productId: 'prod-ors',
      medicineName: 'ORS Sachets',
      quantity: 2,
      explicitQuantity: 2,
      prescribedQuantityText: '2 sachets',
      quantitySource: 'explicit_prescription_quantity'
    };
    const incoming = {
      productId: 'prod-ors',
      medicineName: 'ORS Sachets',
      quantity: null,
      quantitySource: 'manual_input_required'
    };

    mergeOcrItems(existing, incoming);

    expect(existing.quantity).toBe(2);
    expect(existing.quantitySource).toBe('explicit_prescription_quantity');
  });

  test('E3. Quantity merge: trusted 2 + trusted 2 -> keeps one item with quantity 2', () => {
    const existing = {
      productId: 'prod-ors',
      medicineName: 'ORS Sachets',
      quantity: 2,
      explicitQuantity: 2,
      prescribedQuantityText: '2 sachets',
      quantitySource: 'explicit_prescription_quantity'
    };
    const incoming = {
      productId: 'prod-ors',
      medicineName: 'ORS Sachets',
      quantity: 2,
      explicitQuantity: 2,
      prescribedQuantityText: '2sachets.',
      quantitySource: 'explicit_prescription_quantity'
    };

    mergeOcrItems(existing, incoming);

    expect(existing.quantity).toBe(2);
  });

  test('E4. Quantity merge: conflicting trusted 2 + trusted 3 -> manual review required (null), not 5 and not arbitrary', () => {
    const existing = {
      productId: 'prod-ors',
      medicineName: 'ORS Sachets',
      quantity: 2,
      explicitQuantity: 2,
      prescribedQuantityText: '2 sachets',
      quantitySource: 'explicit_prescription_quantity'
    };
    const incoming = {
      productId: 'prod-ors',
      medicineName: 'ORS Sachets',
      quantity: 3,
      explicitQuantity: 3,
      prescribedQuantityText: '3 sachets',
      quantitySource: 'explicit_prescription_quantity'
    };

    mergeOcrItems(existing, incoming);

    expect(existing.quantity).toBeNull();
    expect(existing.explicitQuantity).toBeNull();
    expect(existing.quantitySource).toBe('manual_input_required');
  });

  test('D. Product deduplication: two candidates resolving to the same productId produce ONE session item', async () => {
    // Simulate OCR where "ORS" and another candidate both resolve to the same productId 'ors-1'
    mockExtractText.mockResolvedValue('Rx\nORS\nORS Oral Powder');
    mockSearchMedicines
      .mockResolvedValueOnce([{
        id: 'ors-1',
        name: 'ORS Sachets',
        batchNumber: 'OR-01',
        expiryDate: '2027-01-01',
        stock: 50
      }])
      .mockResolvedValueOnce([{
        id: 'ors-1',
        name: 'ORS Sachets',
        batchNumber: 'OR-01',
        expiryDate: '2027-01-01',
        stock: 50
      }]);

    const sessionManager = new FakeSessionManager();
    const session = { facilityId: 1, step: 'prescription_upload', data: { patientName: '', items: [] } };

    await dispensingFlow.handle({
      userId: 'whatsapp:+15551234567',
      actor: { facilityId: 1, userId: 10 },
      sessionManager,
      session,
      text: '',
      media: [{ path: 'uploads/duplicate-ors.jpg', contentType: 'image/jpeg' }],
      services: {}
    });

    // Exactly one item with productId 'ors-1'
    expect(session.data.items).toHaveLength(1);
    expect(session.data.items[0].productId).toBe('ors-1');
    expect(session.data.items[0].medicineName).toBe('ORS Sachets');
  });

  test('end-to-end real PP-OCRv6 recognition with bounding boxes: extracts 4 items, preserves quantities, excludes footer', async () => {
    const ocrLines = [
      { text: 'Patient Name: | Michael Johnson | Date: 18/06/2026', box: [100, 100, 700, 130] },
      { text: 'Rx', box: [100, 160, 140, 190] },
      { text: '1. Paracetamol 500mg', box: [100, 220, 350, 250] },
      { text: 'Take 1 tablet three times daily for 5 days.', box: [380, 220, 850, 250] },
      { text: '(Tablet)', box: [100, 260, 180, 285] },
      { text: '2. Amlodipine 5mg', box: [100, 320, 320, 350] },
      { text: 'Take 1 tablet once daily.', box: [350, 320, 650, 350] },
      { text: '(Tablet)', box: [100, 360, 180, 385] },
      { text: '3.', box: [80, 420, 105, 448] },
      { text: 'Zinc Sulphate 20mg', box: [115, 421, 360, 450] },
      { text: 'Take 1 tablet once daily after food for 14 days.', box: [380, 419, 920, 449] },
      { text: '(Tablet)', box: [100, 460, 180, 485] },
      { text: '4.', box: [80, 520, 105, 548] },
      { text: 'Artemether/Lumefantrine', box: [115, 520, 420, 550] },
      { text: 'Take 4 tablets twice daily for 3 days.', box: [440, 520, 850, 550] },
      { text: '(Tablet)', box: [100, 560, 180, 585] },
      { text: 'Do Not Refill', box: [87, 866, 237, 898] },
      { text: 'Refill', box: [280, 866, 350, 898] },
      { text: '0', box: [390, 866, 410, 898] },
      { text: 'Times', box: [450, 866, 520, 898] },
      { text: '(Sign)', box: [721, 862, 805, 907] },
      { text: 'Janka', box: [869, 819, 1127, 937] },
      { text: 'M.D.', box: [1150, 866, 1200, 898] },
      { text: 'DEA Number', box: [87, 940, 230, 970] },
      { text: 'MJ258712', box: [250, 940, 400, 970] },
      { text: 'Date', box: [87, 980, 150, 1010] },
      { text: '18/06/2026', box: [170, 980, 320, 1010] },
      { text: 'Print Last Name', box: [500, 980, 700, 1010] },
      { text: 'Johnson', box: [720, 980, 850, 1010] }
    ];

    const prescriptionOcrService = require('../src/services/prescriptionOcrService');
    prescriptionOcrService.recognize = jest.fn().mockResolvedValueOnce({
      engine: 'paddle-ocr-v6',
      text: ocrLines.map(l => l.text).join('\n'),
      lines: ocrLines,
      confidence: 0.95,
      warnings: []
    });

    try {
      mockSearchMedicines
        .mockResolvedValueOnce([{ id: 101, name: 'Paracetamol 500mg', batchNumber: 'PR-01', expiryDate: '2027-01-01', stock: 100 }])
        .mockResolvedValueOnce([{ id: 102, name: 'Amlodipine 5mg', batchNumber: 'AM-01', expiryDate: '2027-01-01', stock: 100 }])
        .mockResolvedValueOnce([{ id: 103, name: 'Zinc Sulphate 20mg', batchNumber: 'ZN-01', expiryDate: '2027-01-01', stock: 100 }])
        .mockResolvedValueOnce([{ id: 104, name: 'Artemether/Lumefantrine', batchNumber: 'AL-01', expiryDate: '2027-01-01', stock: 100 }]);

      const sessionManager = new FakeSessionManager();
      const session = { facilityId: 1, step: 'prescription_upload', data: { patientName: 'Michael Johnson', items: [] } };

      const reply = await dispensingFlow.handle({
        userId: 'whatsapp:+15551234567',
        actor: { facilityId: 1, userId: 10 },
        sessionManager,
        session,
        text: '',
        media: [{ path: 'uploads/real-michael-johnson.jpg', contentType: 'image/jpeg' }],
        services: {}
      });

      // Verify searchMedicines was called exactly 4 times for the 4 medicines, never for Janka or footer
      expect(mockSearchMedicines.mock.calls).toEqual([
        ['Paracetamol 500mg', 1],
        ['Amlodipine 5mg', 1],
        ['Zinc Sulphate 20mg', 1],
        ['Artemether/Lumefantrine', 1]
      ]);

      expect(session.data.items).toHaveLength(4);
      expect(session.data.items[0].medicineName).toBe('Paracetamol 500mg');
      expect(session.data.items[0].quantity).toBe(15);
      expect(session.data.items[0].quantitySource).toBe('calculated_from_directions');

      expect(session.data.items[1].medicineName).toBe('Amlodipine 5mg');
      expect(session.data.items[1].quantity).toBeNull();
      expect(session.data.items[1].quantitySource).toBe('manual_input_required');

      expect(session.data.items[2].medicineName).toBe('Zinc Sulphate 20mg');
      expect(session.data.items[2].quantity).toBe(14);
      expect(session.data.items[2].quantitySource).toBe('calculated_from_directions');

      expect(session.data.items[3].medicineName).toBe('Artemether/Lumefantrine');
      expect(session.data.items[3].quantity).toBe(24);
      expect(session.data.items[3].quantitySource).toBe('calculated_from_directions');

      // Verify analysis output includes simplified quantity display
      expect(reply).toContain('Quantity to dispense: 15 tablets');
      expect(reply).toContain('Quantity to dispense: Enter manually');
      expect(reply).toContain('Quantity to dispense: 14 tablets');
      expect(reply).toContain('Quantity to dispense: 24 tablets');
      expect(reply).not.toContain('Prescribed quantity:');
      expect(reply).not.toContain('Quantity source:');
    } finally {
      delete prescriptionOcrService.recognize;
    }
  });

  test('printed multi-line layout with mismatched patient name routes to OCR_NAME_MISMATCH', async () => {
    const ocrService = require('../src/services/prescriptionOcrService');
    const ocrLines = [
      { text: 'Patient Name: Siva', box: [40, 50, 200, 70] },
      { text: 'Age / Gender: 45 / M', box: [40, 75, 220, 95] },
      { text: 'Date: 17/09/2026', box: [40, 100, 180, 120] },
      { text: 'Rx', box: [40, 140, 70, 160] },
      { text: '1. Metformin 500 mg (Tablet)', box: [40, 180, 280, 200] },
      { text: 'Take 1 tablet twice daily for 30 days.', box: [40, 205, 340, 225] }
    ];

    ocrService.recognize = jest.fn().mockResolvedValue({
      engine: 'paddle',
      text: ocrLines.map(l => l.text).join('\n'),
      lines: ocrLines,
      confidence: 0.95,
      warnings: []
    });

    try {
      const sessionManager = new FakeSessionManager();
      const session = { facilityId: 1, step: 'prescription_upload', data: { patientName: 'Michael', items: [] } };

      const reply = await dispensingFlow.handle({
        userId: 'whatsapp:+15551234567',
        actor: { facilityId: 1, userId: 10 },
        sessionManager,
        session,
        text: '',
        media: [{ path: 'uploads/siva-prescription.jpg', contentType: 'image/jpeg' }],
        services: {}
      });

      expect(reply).toContain('❌ PATIENT NAME MISMATCH');
      expect(reply).toContain('Entered Name: Michael');
      expect(reply).toContain('Prescription Name: Siva');
      expect(session.step).toBe('ocr_name_mismatch');
      expect(session.data.prescriptionName).toBe('Siva');
    } finally {
      delete ocrService.recognize;
    }
  });

  describe('two-option quantity confirmation flow (TEST 1 to TEST 8)', () => {
    const { STEPS } = dispensingFlow._testing;
    const userId = 'whatsapp:+15551234567';
    const actor = { facilityId: 1, userId: 10 };
    const makeContext = (sessionManager, session, text, media = []) => ({
      userId, actor, sessionManager, session, text, media, services: {}
    });

    // TEST 1: trusted quantity = 60, prompt shows 1 Keep, 2 Enter different, input 1 -> quantity = 60
    test('TEST 1: trusted quantity 60 with input 1 retains quantity 60', async () => {
      const sessionManager = new FakeSessionManager();
      const session = {
        facilityId: 1,
        step: STEPS.OCR_QUANTITY_CONFIRMATION,
        data: {
          currentQuantityIndex: 0,
          items: [{
            medicineName: 'Metformin',
            quantity: 60,
            batch: 'METH',
            expiryDate: '2026-09-30',
            availableStock: 660,
            calculatedQuantity: 60,
            quantitySource: 'calculated_from_directions'
          }]
        }
      };

      const prompt = dispensingFlow._testing.renderQuantityPrompt(session.data.items[0]);
      expect(prompt).toContain('Quantity to dispense: 60 tablets');
      expect(prompt).toContain('1 Keep this quantity');
      expect(prompt).toContain('2 Enter a different quantity');

      const reply = await dispensingFlow.handle(makeContext(sessionManager, session, '1'));
      expect(session.data.items[0].quantity).toBe(60);
      expect(session.step).toBe(STEPS.PRESCRIPTION_REVIEW);
      expect(reply).toContain('DISPENSING SUMMARY');
    });

    // TEST 2: trusted quantity = 60, input 2 -> asks "Enter quantity to dispense:", then input 50 -> quantity = 50
    test('TEST 2: trusted quantity 60 with input 2 transitions to override entry, then input 50 sets quantity 50', async () => {
      const sessionManager = new FakeSessionManager();
      const session = {
        facilityId: 1,
        step: STEPS.OCR_QUANTITY_CONFIRMATION,
        data: {
          currentQuantityIndex: 0,
          items: [{
            medicineName: 'Metformin',
            quantity: 60,
            batch: 'METH',
            expiryDate: '2026-09-30',
            availableStock: 660,
            calculatedQuantity: 60,
            quantitySource: 'calculated_from_directions'
          }]
        }
      };

      const reply1 = await dispensingFlow.handle(makeContext(sessionManager, session, '2'));
      expect(reply1).toBe('Enter quantity to dispense:');
      expect(session.step).toBe(STEPS.OCR_QUANTITY_OVERRIDE_ENTRY);

      const reply2 = await dispensingFlow.handle(makeContext(sessionManager, session, '50'));
      expect(session.data.items[0].quantity).toBe(50);
      expect(session.step).toBe(STEPS.PRESCRIPTION_REVIEW);
      expect(reply2).toContain('DISPENSING SUMMARY');
    });

    // TEST 3: trusted quantity = 60, input 2 -> then 1 -> quantity = 1 (not menu 1)
    test('TEST 3: trusted quantity 60 with input 2 then 1 sets quantity 1', async () => {
      const sessionManager = new FakeSessionManager();
      const session = {
        facilityId: 1,
        step: STEPS.OCR_QUANTITY_CONFIRMATION,
        data: {
          currentQuantityIndex: 0,
          items: [{
            medicineName: 'Metformin',
            quantity: 60,
            batch: 'METH',
            expiryDate: '2026-09-30',
            availableStock: 660,
            calculatedQuantity: 60,
            quantitySource: 'calculated_from_directions'
          }]
        }
      };

      await dispensingFlow.handle(makeContext(sessionManager, session, '2'));
      expect(session.step).toBe(STEPS.OCR_QUANTITY_OVERRIDE_ENTRY);

      const reply = await dispensingFlow.handle(makeContext(sessionManager, session, '1'));
      expect(session.data.items[0].quantity).toBe(1);
      expect(session.step).toBe(STEPS.PRESCRIPTION_REVIEW);
      expect(reply).toContain('DISPENSING SUMMARY');
    });

    // TEST 4: trusted quantity = 1, prompt shows "Quantity to dispense: 1 tablet", input 1 -> quantity = 1
    test('TEST 4: trusted quantity 1 shows 1 tablet and input 1 retains quantity 1', async () => {
      const sessionManager = new FakeSessionManager();
      const session = {
        facilityId: 1,
        step: STEPS.OCR_QUANTITY_CONFIRMATION,
        data: {
          currentQuantityIndex: 0,
          items: [{
            medicineName: 'Metformin',
            quantity: 1,
            batch: 'METH',
            expiryDate: '2026-09-30',
            availableStock: 660,
            calculatedQuantity: 1,
            quantitySource: 'calculated_from_directions'
          }]
        }
      };

      const prompt = dispensingFlow._testing.renderQuantityPrompt(session.data.items[0]);
      expect(prompt).toContain('Quantity to dispense: 1 tablet');
      expect(prompt).toContain('1 Keep this quantity');
      expect(prompt).toContain('2 Enter a different quantity');

      const reply = await dispensingFlow.handle(makeContext(sessionManager, session, '1'));
      expect(session.data.items[0].quantity).toBe(1);
      expect(session.step).toBe(STEPS.PRESCRIPTION_REVIEW);
      expect(reply).toContain('DISPENSING SUMMARY');
    });

    // TEST 5: trusted quantity = 2, input 1 -> keeps trusted quantity = 2, NOT option 2 behavior
    test('TEST 5: trusted quantity 2 with input 1 retains quantity 2', async () => {
      const sessionManager = new FakeSessionManager();
      const session = {
        facilityId: 1,
        step: STEPS.OCR_QUANTITY_CONFIRMATION,
        data: {
          currentQuantityIndex: 0,
          items: [{
            medicineName: 'ORS Sachets',
            quantity: 2,
            batch: 'OR-01',
            expiryDate: '2026-09-30',
            availableStock: 100,
            explicitQuantity: 2,
            quantitySource: 'explicit_prescription_quantity'
          }]
        }
      };

      const prompt = dispensingFlow._testing.renderQuantityPrompt(session.data.items[0]);
      expect(prompt).toContain('Quantity to dispense: 2 tablets');
      expect(prompt).toContain('1 Keep this quantity');
      expect(prompt).toContain('2 Enter a different quantity');

      const reply = await dispensingFlow.handle(makeContext(sessionManager, session, '1'));
      expect(session.data.items[0].quantity).toBe(2);
      expect(session.step).toBe(STEPS.PRESCRIPTION_REVIEW);
      expect(reply).toContain('DISPENSING SUMMARY');
    });

    // TEST 6: trusted quantity = 2, input 2 -> asks "Enter quantity to dispense:", then input 1 -> quantity = 1
    test('TEST 6: trusted quantity 2 with input 2 then input 1 sets quantity 1', async () => {
      const sessionManager = new FakeSessionManager();
      const session = {
        facilityId: 1,
        step: STEPS.OCR_QUANTITY_CONFIRMATION,
        data: {
          currentQuantityIndex: 0,
          items: [{
            medicineName: 'ORS Sachets',
            quantity: 2,
            batch: 'OR-01',
            expiryDate: '2026-09-30',
            availableStock: 100,
            explicitQuantity: 2,
            quantitySource: 'explicit_prescription_quantity'
          }]
        }
      };

      const reply1 = await dispensingFlow.handle(makeContext(sessionManager, session, '2'));
      expect(reply1).toBe('Enter quantity to dispense:');
      expect(session.step).toBe(STEPS.OCR_QUANTITY_OVERRIDE_ENTRY);

      const reply2 = await dispensingFlow.handle(makeContext(sessionManager, session, '1'));
      expect(session.data.items[0].quantity).toBe(1);
      expect(session.step).toBe(STEPS.PRESCRIPTION_REVIEW);
      expect(reply2).toContain('DISPENSING SUMMARY');
    });

    // TEST 7: manual/no trusted quantity, prompt shows "Quantity to dispense: Enter manually" and "Enter quantity:", input 2 -> quantity = 2
    test('TEST 7: manual/no trusted quantity prompt has no menu and input 2 sets quantity 2', async () => {
      const sessionManager = new FakeSessionManager();
      const item = {
        medicineName: 'Amlodipine',
        quantity: null,
        batch: 'AM-01',
        expiryDate: '2027-01-01',
        availableStock: 50,
        calculatedQuantity: null,
        quantitySource: 'manual_input_required'
      };

      const prompt = dispensingFlow._testing.renderQuantityPrompt(item);
      expect(prompt).toContain('Quantity to dispense: Enter manually');
      expect(prompt).toContain('Enter quantity:');
      expect(prompt).not.toContain('1 Keep this quantity');
      expect(prompt).not.toContain('2 Enter a different quantity');

      const session = {
        facilityId: 1,
        step: STEPS.OCR_QUANTITY_OVERRIDE_ENTRY,
        data: {
          currentQuantityIndex: 0,
          items: [item]
        }
      };

      const reply = await dispensingFlow.handle(makeContext(sessionManager, session, '2'));
      expect(session.data.items[0].quantity).toBe(2);
      expect(session.step).toBe(STEPS.PRESCRIPTION_REVIEW);
      expect(reply).toContain('DISPENSING SUMMARY');
    });

    // TEST 8: trusted quantity = 60, unsupported input at confirmation menu remains at confirmation step
    test('TEST 8: unsupported input at confirmation menu does not set quantity and re-shows menu', async () => {
      const sessionManager = new FakeSessionManager();
      const session = {
        facilityId: 1,
        step: STEPS.OCR_QUANTITY_CONFIRMATION,
        data: {
          currentQuantityIndex: 0,
          items: [{
            medicineName: 'Metformin',
            quantity: 60,
            batch: 'METH',
            expiryDate: '2026-09-30',
            availableStock: 660,
            calculatedQuantity: 60,
            quantitySource: 'calculated_from_directions'
          }]
        }
      };

      const reply = await dispensingFlow.handle(makeContext(sessionManager, session, 'hello'));
      expect(reply).toBe([
        'Please choose:',
        '',
        '1 Keep this quantity',
        '2 Enter a different quantity'
      ].join('\n'));
      expect(session.step).toBe(STEPS.OCR_QUANTITY_CONFIRMATION);
      expect(session.data.items[0].quantity).toBe(60);
    });

    // TEST 9: Override quantity exceeding available stock returns error and stays in override entry
    test('Override entry exceeding available stock returns error and remains in override entry', async () => {
      const sessionManager = new FakeSessionManager();
      const session = {
        facilityId: 1,
        step: STEPS.OCR_QUANTITY_OVERRIDE_ENTRY,
        data: {
          currentQuantityIndex: 0,
          items: [{
            medicineName: 'Metformin',
            quantity: 60,
            batch: 'METH',
            expiryDate: '2026-09-30',
            availableStock: 660,
            calculatedQuantity: 60,
            quantitySource: 'calculated_from_directions'
          }]
        }
      };

      const reply = await dispensingFlow.handle(makeContext(sessionManager, session, '700'));
      expect(reply).toBe('Only 660 available');
      expect(session.step).toBe(STEPS.OCR_QUANTITY_OVERRIDE_ENTRY);
      expect(session.data.items[0].quantity).toBe(60);
    });
  });
});
