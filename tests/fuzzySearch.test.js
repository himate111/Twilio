const { searchProducts } = require('../src/utils/fuzzySearch');

describe('fuzzySearch', () => {
  const products = [
    {
      id: 1,
      code: '1456',
      name: 'Paracetamol',
      generic_name: 'Paracetamol',
      strength: '100mg',
      formulation: 'Tablet'
    },
    {
      id: 2,
      code: '2301',
      name: 'Amoxicillin',
      generic_name: 'Amoxicillin',
      strength: '250mg',
      formulation: 'Capsule'
    }
  ];

  test('matches medicine names with small spelling errors', () => {
    const [result] = searchProducts('Paracetmol', products);
    expect(result.code).toBe('1456');
  });

  test('prioritizes exact code search', () => {
    const [result] = searchProducts('2301', products);
    expect(result.name).toBe('Amoxicillin');
  });
});
