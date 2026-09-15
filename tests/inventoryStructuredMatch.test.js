const mockQuery = jest.fn();

jest.mock('../postdb', () => ({ query: mockQuery }));

const inventoryService = require('../src/services/inventoryService');

const medicine = (overrides = {}) => ({
  id: 'medicine-id',
  medicineName: 'Paracetamol',
  genericName: 'Acetaminophen',
  strength: '500 mg',
  dosageForm: 'Tablet',
  isActive: true,
  ...overrides
});

describe('inventoryService structured prescription matching', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  test.each(['500mg', '500 mg', '500 MG', '500 Mg'])(
    'normalizes %s as the same strength',
    (value) => {
      expect(inventoryService.normalizeStrength(value)).toBe('500mg');
    }
  );

  test('parses medicine name, strength, and an optional dosage form conservatively', () => {
    expect(inventoryService.parseMedicineIdentity(' Paracetamol 500 MG Tablet ')).toEqual({
      name: 'paracetamol',
      strength: '500mg',
      dosageForm: 'tablet'
    });
    expect(inventoryService.parseMedicineIdentity('Artemether/Lumefantrine')).toEqual({
      name: 'artemether/lumefantrine',
      strength: null,
      dosageForm: null
    });
  });

  test('selects only the active Master record with the compatible strength', async () => {
    mockQuery.mockResolvedValue([
      medicine({ id: 'p100', strength: '100mg' }),
      medicine({ id: 'p500', strength: '500 mg' }),
      medicine({ id: 'p650', strength: '650mg' }),
      medicine({ id: 'syrup', strength: '125mg/5ml', dosageForm: 'Syrup' })
    ]);

    await expect(inventoryService.findStructuredMedicine('Paracetamol 500mg')).resolves.toEqual(
      expect.objectContaining({
        status: 'matched',
        medicine: expect.objectContaining({ id: 'p500', strength: '500 mg' })
      })
    );
  });

  test('excludes an inactive exact-strength record', async () => {
    mockQuery.mockResolvedValue([
      medicine({ id: 'inactive-500', isActive: false }),
      medicine({ id: 'active-650', strength: '650mg' })
    ]);

    await expect(inventoryService.findStructuredMedicine('Paracetamol 500mg')).resolves.toEqual(
      expect.objectContaining({ status: 'not_found' })
    );
  });

  test('does not select a database-order-dependent record when structured attributes remain ambiguous', async () => {
    mockQuery.mockResolvedValue([
      medicine({ id: 'tablet', dosageForm: 'Tablet' }),
      medicine({ id: 'capsule', dosageForm: 'Capsule' })
    ]);

    await expect(inventoryService.findStructuredMedicine('Paracetamol 500mg')).resolves.toEqual(
      expect.objectContaining({ status: 'ambiguous', matches: expect.arrayContaining([
        expect.objectContaining({ id: 'tablet' }),
        expect.objectContaining({ id: 'capsule' })
      ]) })
    );
  });

  test('uses a provided dosage form to resolve an otherwise ambiguous structured match', async () => {
    mockQuery.mockResolvedValue([
      medicine({ id: 'tablet', dosageForm: 'Tablet' }),
      medicine({ id: 'capsule', dosageForm: 'Capsule' })
    ]);

    await expect(inventoryService.findStructuredMedicine('Paracetamol 500mg Tablet')).resolves.toEqual(
      expect.objectContaining({
        status: 'matched',
        medicine: expect.objectContaining({ id: 'tablet' })
      })
    );
  });

  test('keeps Fuse fallback available and filters it to the OCR strength when one is supplied', async () => {
    mockQuery.mockResolvedValue([
      medicine({ id: 'p500', strength: '500mg' }),
      medicine({ id: 'p650', strength: '650mg' })
    ]);

    const result = await inventoryService.findMedicineFuzzy('Paracetamol', {
      requiredStrength: '500mg'
    });

    expect(result.medicine.id).toBe('p500');
    expect(result.confidence).toBeGreaterThanOrEqual(40);
  });
});