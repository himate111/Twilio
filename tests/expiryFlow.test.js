const expiryFlow = require('../src/flows/expiryFlow');
const FakeSessionManager = require('./helpers/fakeSessionManager');

describe('expiryFlow', () => {
  const userId = 'whatsapp:+15551234567';
  const actor = { facilityId: 1, userId: 10 };
  const alert = {
    batchId: 77,
    productId: 100,
    code: '1456',
    name: 'Paracetamol',
    formulation: 'Tablet',
    strength: '100mg',
    batchNumber: 'EXP0626',
    expiryDate: '2026-06-30',
    availableQuantity: 40
  };

  function context(sessionManager, services, text, session = null) {
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

  test('captures disposal details and logs disposal', async () => {
    const sessionManager = new FakeSessionManager();
    const services = {
      expiryService: {
        getActiveAlerts: jest.fn(async () => [alert]),
        acknowledge: jest.fn(),
        dispose: jest.fn(async () => ({ transactionId: 9 }))
      }
    };

    const startReply = await expiryFlow.start(context(sessionManager, services, ''));
    expect(startReply).toContain('Expiry Alerts');
    expect(startReply).toContain('EXP0626');

    let session = await sessionManager.getSession(userId);
    await expect(expiryFlow.handle(context(sessionManager, services, '2', session))).resolves.toBe('Enter disposal quantity:');

    session = await sessionManager.getSession(userId);
    await expect(expiryFlow.handle(context(sessionManager, services, '10', session))).resolves.toBe('Enter disposal method:');

    session = await sessionManager.getSession(userId);
    await expect(expiryFlow.handle(context(sessionManager, services, 'Deep burial', session))).resolves.toBe('Enter responsible person:');

    session = await sessionManager.getSession(userId);
    const finalReply = await expiryFlow.handle(context(sessionManager, services, 'Dr Rao', session));
    expect(finalReply).toContain('✅ Disposal Logged');
    expect(finalReply).toContain('Qty Disposed: 10');
    expect(services.expiryService.dispose).toHaveBeenCalledWith(expect.objectContaining({
      facilityId: 1,
      batchId: 77,
      quantity: 10,
      disposalMethod: 'Deep burial',
      responsiblePerson: 'Dr Rao'
    }));
    await expect(sessionManager.getSession(userId)).resolves.toBeNull();
  });
});
