const mockMessagesCreate = jest.fn();
const mockSessionManager = {
  getSession: jest.fn(),
  saveSession: jest.fn()
};

jest.mock('../src/session/sessionManager', () => jest.fn(() => mockSessionManager));
jest.mock('../src/services/inventoryService', () => ({
  resolveActor: jest.fn()
}));
jest.mock('../src/services/stockOrderService', () => ({}));
jest.mock('../src/services/stockReceiptService', () => ({}));
jest.mock('../src/services/consumptionService', () => ({}));
jest.mock('../src/services/expiryService', () => ({}));
jest.mock('../src/services/auditService', () => ({}));
jest.mock('../src/services/categoryMasterService', () => ({}));
jest.mock('../src/services/medicineMasterService', () => ({}));
jest.mock('../src/flows/searchMedicineFlow', () => ({}));
jest.mock('../src/flows/menuFlow', () => ({}));
jest.mock('../src/flows/stockReceiptFlow', () => ({}));
jest.mock('../src/flows/expiryFlow', () => ({}));
jest.mock('../src/flows/auditFlow', () => ({}));
jest.mock('../src/flows/medicineMasterFlow', () => ({}));
jest.mock('../src/flows/inventoryLookupFlow', () => ({}));
jest.mock('../src/flows/returnFlow', () => ({}));
jest.mock('../src/flows/dispensingFlow', () => ({}));
jest.mock('../src/utils/formatter', () => ({
  welcomeMessages: jest.fn(() => [
    'welcome message',
    '1️⃣ Medicine Dispensing',
    '2️⃣ Stock Receipt',
    '3️⃣ Search Medicine'
  ])
}));
jest.mock('../src/config/env', () => ({
  twilio: { whatsappFrom: 'whatsapp:+15005550006' }
}));
jest.mock('../src/config/twilio', () => ({
  getTwilioClient: jest.fn(() => ({
    messages: { create: mockMessagesCreate }
  })),
  createMessagingResponse: jest.fn(() => ({ toString: () => '<Response />' }))
}));
jest.mock('../src/services/whatsappService', () => ({
  toTwiml: jest.fn()
}));

const inventoryService = require('../src/services/inventoryService');
const { handleWhatsappWebhook } = require('../src/controllers/webhookController');

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    type: jest.fn().mockReturnThis(),
    send: jest.fn()
  };
}

describe('handleWhatsappWebhook dry run mode', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const botMessages = [
    'welcome message',
    '1️⃣ Medicine Dispensing',
    '2️⃣ Stock Receipt',
    '3️⃣ Search Medicine'
  ];

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    jest.clearAllMocks();
    inventoryService.resolveActor.mockResolvedValue({ userName: 'Test User' });
    mockSessionManager.getSession.mockResolvedValue(null);
    mockSessionManager.saveSession.mockResolvedValue({});
    mockMessagesCreate.mockResolvedValue({});
  });

  afterAll(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
      return;
    }

    process.env.NODE_ENV = originalNodeEnv;
  });

  test('returns an HTML preview and skips Twilio when DryRun=true', async () => {
    const res = createResponse();
    const next = jest.fn();

    await handleWhatsappWebhook({
      body: {
        From: 'whatsapp:+916380365019',
        Body: 'hi',
        MessageSid: 'TEST026',
        DryRun: 'true'
      }
    }, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.type).toHaveBeenCalledWith('html');
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('DRY RUN PREVIEW'));
    const html = res.send.mock.calls[0][0];
    expect(html).toContain('No WhatsApp message was sent');
    expect(html).toContain('white-space: pre-wrap');
    botMessages.forEach((message) => expect(html).toContain(message));
    expect(res.json).not.toHaveBeenCalled();
    expect(mockMessagesCreate).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test('preserves normal sequential Twilio sends when DryRun is absent', async () => {
    const res = createResponse();
    const next = jest.fn();

    await handleWhatsappWebhook({
      body: {
        From: 'whatsapp:+916380365019',
        Body: 'hi',
        MessageSid: 'SM-real'
      }
    }, res, next);

    expect(mockMessagesCreate).toHaveBeenCalledTimes(botMessages.length);
    expect(mockMessagesCreate.mock.calls.map(([message]) => message.body))
      .toEqual(botMessages);
    expect(res.type).toHaveBeenCalledWith('text/xml');
    expect(res.send).toHaveBeenCalledWith('<Response />');
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
