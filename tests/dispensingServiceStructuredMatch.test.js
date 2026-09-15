const mockFindStructuredMedicine = jest.fn();
const mockFindMedicineFuzzy = jest.fn();
const mockLookupAvailableInventory = jest.fn();
const mockGetAvailableStock = jest.fn();
const mockGetAvailableBatches = jest.fn();

jest.mock('../postdb', () => ({ query: jest.fn() }));
jest.mock('../src/services/inventoryService', () => ({
  findStructuredMedicine: mockFindStructuredMedicine,
  findMedicineFuzzy: mockFindMedicineFuzzy,
  lookupAvailableInventory: mockLookupAvailableInventory,
  getAvailableStock: mockGetAvailableStock,
  getAvailableBatches: mockGetAvailableBatches
}));

const dispensingService = require('../src/services/dispensingService');

const structuredMedicine = {
  id: 'p500',
  name: 'Paracetamol',
  generic_name: 'Acetaminophen',
  strength: '500 mg',
  formulation: 'Tablet'
};

describe('dispensingService structured prescription matching', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAvailableStock.mockResolvedValue(100);
    mockGetAvailableBatches.mockResolvedValue([
      { id: 'batch-1', batchNumber: 'PR-12', expiryDate: '2027-07-22', stock: 100 }
    ]);
  });

  test('resolves a safe name-plus-strength match before direct lookup or Fuse', async () => {
    mockFindStructuredMedicine.mockResolvedValue({
      status: 'matched',
      identity: { name: 'paracetamol', strength: '500mg' },
      medicine: structuredMedicine
    });

    await expect(dispensingService.searchMedicines('Paracetamol 500mg', 'facility-1')).resolves.toEqual([
      expect.objectContaining({
        id: 'p500',
        strength: '500 mg',
        batchNumber: 'PR-12',
        stock: 100
      })
    ]);
    expect(mockLookupAvailableInventory).not.toHaveBeenCalled();
    expect(mockFindMedicineFuzzy).not.toHaveBeenCalled();
    expect(mockGetAvailableStock).toHaveBeenCalledWith('p500', 'facility-1');
  });

  test('does not invoke Fuse or select a row when structured attributes are ambiguous', async () => {
    mockFindStructuredMedicine.mockResolvedValue({
      status: 'ambiguous',
      identity: { name: 'paracetamol', strength: '500mg' },
      matches: [
        { medicineName: 'Paracetamol', strength: '500mg', dosageForm: 'Tablet' },
        { medicineName: 'Paracetamol', strength: '500mg', dosageForm: 'Capsule' }
      ]
    });

    await expect(dispensingService.searchMedicines('Paracetamol 500mg', 'facility-1')).resolves.toEqual([
      expect.objectContaining({ ambiguous: true, detected: 'Paracetamol 500mg' })
    ]);
    expect(mockFindMedicineFuzzy).not.toHaveBeenCalled();
    expect(mockGetAvailableStock).not.toHaveBeenCalled();
  });

  test('keeps Fuse fallback but constrains it to the extracted strength', async () => {
    mockFindStructuredMedicine.mockResolvedValue({
      status: 'not_found',
      identity: { name: 'paracetmol', strength: '500mg' }
    });
    mockFindMedicineFuzzy.mockResolvedValue({
      detected: 'Paracetmol 500mg',
      medicine: structuredMedicine,
      confidence: 65
    });

    await expect(dispensingService.searchMedicines('Paracetmol 500mg', 'facility-1')).resolves.toEqual([
      expect.objectContaining({
        detected: 'Paracetmol 500mg',
        suggested: 'Paracetamol',
        suggestedMedicine: expect.objectContaining({ id: 'p500', strength: '500 mg' }),
        confidence: 65
      })
    ]);
    expect(mockFindMedicineFuzzy).toHaveBeenCalledWith('Paracetmol 500mg', {
      requiredStrength: '500mg'
    });
    expect(mockGetAvailableStock).not.toHaveBeenCalled();
  });

  test('keeps direct and Fuse behavior for input with no recognizable strength', async () => {
    mockFindStructuredMedicine.mockResolvedValue({
      status: 'not_found',
      identity: { name: 'paracetamol', strength: null }
    });
    mockLookupAvailableInventory.mockResolvedValue([]);
    mockFindMedicineFuzzy.mockResolvedValue({
      detected: 'Paracetamol',
      medicine: structuredMedicine,
      confidence: 90
    });

    await expect(dispensingService.searchMedicines('Paracetamol', 'facility-1')).resolves.toEqual([
      expect.objectContaining({ id: 'p500', stock: 100 })
    ]);
    expect(mockFindMedicineFuzzy).toHaveBeenCalledWith('Paracetamol', {
      requiredStrength: undefined
    });
  });
});