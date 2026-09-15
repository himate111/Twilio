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