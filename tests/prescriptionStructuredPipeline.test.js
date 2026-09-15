const mockQuery = jest.fn();

jest.mock('../postdb', () => ({ query: mockQuery }));

const dispensingService = require('../src/services/dispensingService');

const masters = [
  { id: 'p100', medicineName: 'Paracetamol', genericName: 'Acetaminophen', strength: '100mg', dosageForm: 'Tablet', isActive: true },
  { id: 'p650', medicineName: 'Paracetamol', genericName: 'Acetaminophen', strength: '650mg', dosageForm: 'Tablet', isActive: true },
  { id: 'syrup', medicineName: 'Paracetamol', genericName: 'Panadol', strength: '125mg/5ml', dosageForm: 'Syrup', isActive: true },
  { id: 'inactive-500', medicineName: 'Paracetamol', genericName: 'Acetaminophen', strength: '500mg', dosageForm: 'Tablet', isActive: false },
  { id: 'p500', medicineName: 'Paracetamol', genericName: 'Acetaminophen', strength: '500 mg', dosageForm: 'Tablet', isActive: true },
  { id: 'aml5', medicineName: 'Amlodipine', genericName: 'Amlodipine', strength: '5mg', dosageForm: 'Tablet', isActive: true }
];

const batches = {
  p500: [{ id: 'pr-12', batchNumber: 'PR-12', expiryDate: '2027-07-22', stock: 100 }],
  aml5: [{ id: 'aq21', batchNumber: 'AQ21', expiryDate: '2026-12-22', stock: 90 }]
};

describe('prescription structured matching pipeline', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockImplementation(async (sql, params = []) => {
      if (sql.includes('FROM "Medicine"')) {
        return masters;
      }
      if (sql.includes('SUM(quantity)')) {
        const medicineId = params[0];
        return [{ stock: String(batches[medicineId]?.[0]?.stock || 0) }];
      }
      if (sql.includes('FROM "StockBatch"')) {
        return batches[params[0]] || [];
      }
      throw new Error(`Unexpected query: ${sql}`);
    });
  });

  test('resolves both representative OCR medicines by active name plus normalized strength', async () => {
    const paracetamol = await dispensingService.searchMedicines('Paracetamol 500mg', 'facility-1');
    const amlodipine = await dispensingService.searchMedicines('Amlodipine 5mg', 'facility-1');

    expect(paracetamol).toEqual([
      expect.objectContaining({
        id: 'p500',
        strength: '500 mg',
        batchNumber: 'PR-12',
        stock: 100,
        expiryDate: '2027-07-22'
      })
    ]);
    expect(amlodipine).toEqual([
      expect.objectContaining({
        id: 'aml5',
        strength: '5mg',
        batchNumber: 'AQ21',
        stock: 90,
        expiryDate: '2026-12-22'
      })
    ]);
    expect(paracetamol[0].id).not.toBe('p100');
    expect(paracetamol[0].id).not.toBe('p650');
    expect(paracetamol[0].id).not.toBe('syrup');
    expect(paracetamol[0].id).not.toBe('inactive-500');
  });
});