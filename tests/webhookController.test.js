const mockMessagesCreate = jest.fn();
const mockDispensingStart = jest.fn();
const mockStockReceiptStart = jest.fn();
const mockSearchMedicineStart = jest.fn();
const mockSessionManager = {
  getSession: jest.fn(),
  saveSession: jest.fn(),
  clearSession: jest.fn()
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
jest.mock('../src/flows/searchMedicineFlow', () => ({ start: mockSearchMedicineStart }));
jest.mock('../src/flows/stockReceiptFlow', () => ({ start: mockStockReceiptStart }));
jest.mock('../src/flows/expiryFlow', () => ({}));
jest.mock('../src/flows/auditFlow', () => ({}));
jest.mock('../src/flows/medicineMasterFlow', () => ({}));
jest.mock('../src/flows/inventoryLookupFlow', () => ({}));
jest.mock('../src/flows/returnFlow', () => ({}));
jest.mock('../src/flows/dispensingFlow', () => ({ start: mockDispensingStart }));
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
  toTwiml: jest.fn(() => '<Response><Message>flow response</Message></Response>')
}));

const inventoryService = require('../src/services/inventoryService');
const { welcomeMessages } = require('../src/utils/formatter');
const { handleWhatsappWebhook } = require('../src/controllers/webhookController');

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    type: jest.fn().mockReturnThis(),
    send: jest.fn()
  };
}

describe('handleWhatsappWebhook welcome menu and routing', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const welcomeMessage = [
    '👋 Welcome to StockTrackRx, Test User WhatsApp!',
    '',
    'How can I help you today?',
    '',
    'Reply with the number of your choice.',
    '',
    '1️⃣ Medicine Dispensing',
    '',
    '2️⃣ Stock Receipt',
    '',
    '3️⃣ Search Medicine'
  ].join('\n');

  test('adds the WhatsApp label exactly once for either form of the dynamic user name', () => {
    expect(welcomeMessages('Siva')[0].startsWith(
      '👋 Welcome to StockTrackRx, Siva WhatsApp!'
    )).toBe(true);
    expect(welcomeMessages('Siva WhatsApp')[0].startsWith(
      '👋 Welcome to StockTrackRx, Siva WhatsApp!'
    )).toBe(true);
  });

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    jest.clearAllMocks();
    inventoryService.resolveActor.mockResolvedValue({ userName: 'Test User WhatsApp' });
    mockSessionManager.getSession.mockResolvedValue(null);
    mockSessionManager.saveSession.mockResolvedValue({});
    mockSessionManager.clearSession.mockResolvedValue();
    mockMessagesCreate.mockResolvedValue({});
    mockDispensingStart.mockResolvedValue('Medicine Dispensing started.');
    mockStockReceiptStart.mockResolvedValue('Stock Receipt started.');
    mockSearchMedicineStart.mockResolvedValue('Search Medicine started.');
  });

  afterAll(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
      return;
    }

    process.env.NODE_ENV = originalNodeEnv;
  });

  test('returns a one-bubble HTML preview and skips Twilio when DryRun=true', async () => {
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
    expect(html).toContain(welcomeMessage);
    expect((html.match(/class="message-bubble"/g) || []).length).toBe(1);
    expect(res.json).not.toHaveBeenCalled();
    expect(mockMessagesCreate).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test('sends the complete welcome menu in one Twilio WhatsApp message', async () => {
    const res = createResponse();
    const next = jest.fn();

    await handleWhatsappWebhook({
      body: {
        From: 'whatsapp:+916380365019',
        Body: 'hi',
        MessageSid: 'SM-real'
      }
    }, res, next);

    expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
    expect(mockMessagesCreate).toHaveBeenCalledWith({
      from: 'whatsapp:+15005550006',
      to: 'whatsapp:+916380365019',
      body: welcomeMessage
    });
    expect(welcomeMessage).toContain('👋 Welcome to StockTrackRx, Test User WhatsApp!');
    expect(welcomeMessage).not.toContain('WhatsApp WhatsApp!');
    expect(welcomeMessage).toContain('1️⃣ Medicine Dispensing');
    expect(welcomeMessage).toContain('2️⃣ Stock Receipt');
    expect(welcomeMessage).toContain('3️⃣ Search Medicine');
    expect(welcomeMessage).toContain(
      '1️⃣ Medicine Dispensing\n\n2️⃣ Stock Receipt\n\n3️⃣ Search Medicine'
    );
    expect(welcomeMessage).not.toMatch(/[─┈]/);
    expect(res.type).toHaveBeenCalledWith('text/xml');
    expect(res.send).toHaveBeenCalledWith('<Response />');
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test.each(['hi', 'hello', 'start', 'menu', 'help'])(
    'returns the one-message welcome menu for "%s" from an authenticated session',
    async (trigger) => {
      const res = createResponse();
      const next = jest.fn();
      mockSessionManager.getSession.mockResolvedValue({
        authenticated: true,
        actor: { userName: 'Test User WhatsApp' }
      });

      await handleWhatsappWebhook({
        body: {
          From: 'whatsapp:+916380365019',
          Body: trigger,
          MessageSid: `SM-${trigger}`
        }
      }, res, next);

      expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
      expect(mockMessagesCreate.mock.calls[0][0].body).toBe(welcomeMessage);
      expect(next).not.toHaveBeenCalled();
    }
  );

  test.each([
    ['1', mockDispensingStart],
    ['2', mockStockReceiptStart],
    ['3', mockSearchMedicineStart]
  ])('routes reply %s to its existing flow', async (choice, startFlow) => {
    const res = createResponse();
    const next = jest.fn();
    mockSessionManager.getSession.mockResolvedValue({
      authenticated: true,
      actor: { userName: 'Test User WhatsApp' }
    });

    await handleWhatsappWebhook({
      body: {
        From: 'whatsapp:+916380365019',
        Body: choice,
        MessageSid: `SM-choice-${choice}`
      }
    }, res, next);

    expect(startFlow).toHaveBeenCalledTimes(1);
    expect(mockMessagesCreate).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
