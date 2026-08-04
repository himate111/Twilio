const AppError = require('../src/utils/appError');
const consumptionFlow = require('../src/flows/consumptionFlow');
const FakeSessionManager = require('./helpers/fakeSessionManager');

describe('consumptionFlow', () => {
  const userId = 'whatsapp:+15551234567';
  const actor = { facilityId: 1, userId: 10 };
  const product = {
    id: 100,
    code: '1456',
    name: 'Paracetamol',
    formulation: 'Tablet',
    strength: '100mg'
  };

  function createContext(sessionManager, services, text, session = null) {
    return {
      userId,
      actor,
      session,
      text,
      media: [],
      messageSid: `SM-${text}`,
      sessionManager,
      services
    };
  }

  test('logs consumption after medicine and quantity capture', async () => {
    const sessionManager = new FakeSessionManager();
    const services = {
      consumptionService: {
        findMedicine: jest.fn(async () => product),
        logConsumption: jest.fn(async () => ({ transactionId: 5 }))
      }
    };

    await consumptionFlow.start(createContext(sessionManager, services, ''));
    let session = await sessionManager.getSession(userId);
    const foundReply = await consumptionFlow.handle(createContext(sessionManager, services, 'Paracetamol', session));
    expect(foundReply).toContain('Enter quantity consumed');

    session = await sessionManager.getSession(userId);
    const finalReply = await consumptionFlow.handle(createContext(sessionManager, services, '20', session));
    expect(finalReply).toContain('✅ Consumption Logged');
    expect(finalReply).toContain('Qty Used: 20');
    expect(services.consumptionService.logConsumption).toHaveBeenCalledWith(expect.objectContaining({
      facilityId: 1,
      productId: 100,
      quantity: 20
    }));
    await expect(sessionManager.getSession(userId)).resolves.toBeNull();
  });

  test('keeps draft active when stock is insufficient', async () => {
    const sessionManager = new FakeSessionManager();
    const services = {
      consumptionService: {
        findMedicine: jest.fn(async () => product),
        logConsumption: jest.fn(async () => {
          throw new AppError('Insufficient stock. Available stock is 5.', 409, 'INSUFFICIENT_STOCK');
        })
      }
    };

    await consumptionFlow.start(createContext(sessionManager, services, ''));
    let session = await sessionManager.getSession(userId);
    await consumptionFlow.handle(createContext(sessionManager, services, 'Paracetamol', session));
    session = await sessionManager.getSession(userId);

    const reply = await consumptionFlow.handle(createContext(sessionManager, services, '20', session));
    expect(reply).toContain('Insufficient stock');
    await expect(sessionManager.getSession(userId)).resolves.toMatchObject({
      flow: 'consumption',
      step: 'quantity_entry'
    });
  });
});
