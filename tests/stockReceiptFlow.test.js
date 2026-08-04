const stockReceiptFlow = require('../src/flows/stockReceiptFlow');
const FakeSessionManager = require('./helpers/fakeSessionManager');

describe('stockReceiptFlow', () => {
  const userId = 'whatsapp:+15551234567';
  const actor = { facilityId: 1, userId: 10 };
  const product = {
    id: 100,
    code: '1456',
    name: 'Paracetamol',
    formulation: 'Tablet',
    strength: '100mg'
  };

  function createHarness() {
    const sessionManager = new FakeSessionManager();
    const receipts = [];
    const services = {
      stockReceiptService: {
        findMedicine: jest.fn(async () => product),
        recordReceipt: jest.fn(async (input) => {
          receipts.push(input);
          return {
            transactionId: 200,
            batchId: 300
          };
        })
      }
    };

    async function send(text, messageSid = `SM-${text}`) {
      const session = await sessionManager.getSession(userId);
      return stockReceiptFlow.handle({
        userId,
        actor,
        session,
        text,
        media: [],
        messageSid,
        sessionManager,
        services
      });
    }

    return { sessionManager, services, receipts, send };
  }

  test('records a complete full delivery receipt', async () => {
    const harness = createHarness();

    const startReply = await stockReceiptFlow.start({
      userId,
      actor,
      media: [],
      sessionManager: harness.sessionManager
    });
    expect(startReply).toContain('Stock Receipt Flow');

    await expect(harness.send('Paracetamol')).resolves.toContain('Enter quantity received');
    await expect(harness.send('100')).resolves.toBe('Enter batch number:');
    await expect(harness.send('B2304')).resolves.toContain('YYYY-MM');
    await expect(harness.send('2099-12')).resolves.toContain('Was full delivery received');
    await expect(harness.send('1', 'SM-final')).resolves.toContain('add another medicine');

    const finalReply = await harness.send('2');
    expect(finalReply).toContain('✅ Receipt Recorded');
    expect(finalReply).toContain('Medicine: Paracetamol Tablet 100mg');
    expect(finalReply).toContain('Qty: 100');

    expect(harness.receipts).toHaveLength(1);
    expect(harness.receipts[0]).toMatchObject({
      facilityId: 1,
      productId: 100,
      quantity: 100,
      batchNumber: 'B2304',
      expiryDate: '2099-12-31',
      deliveryStatus: 'FULL',
      shortfallQuantity: 0,
      sourceMessageSid: 'SM-final'
    });
    await expect(harness.sessionManager.getSession(userId)).resolves.toBeNull();
  });
});
