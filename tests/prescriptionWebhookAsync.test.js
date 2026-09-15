const mockMessagesCreate = jest.fn();
const mockDispensingHandle = jest.fn();
const mockResolveActor = jest.fn();
const mockEnv = {
  isProduction: false,
  twilio: { whatsappFrom: 'whatsapp:+15005550006' }
};
const mockSessionManager = {
  getSession: jest.fn(),
  saveSession: jest.fn(),
  acquireMessageProcessing: jest.fn(),
  completeMessageProcessing: jest.fn()
};

jest.mock('../src/session/sessionManager', () => jest.fn(() => mockSessionManager));
jest.mock('../src/services/inventoryService', () => ({ resolveActor: mockResolveActor }));
jest.mock('../src/services/stockOrderService', () => ({}));
jest.mock('../src/services/stockReceiptService', () => ({}));
jest.mock('../src/services/consumptionService', () => ({}));
jest.mock('../src/services/expiryService', () => ({}));
jest.mock('../src/services/auditService', () => ({}));
jest.mock('../src/services/categoryMasterService', () => ({}));
jest.mock('../src/services/medicineMasterService', () => ({}));
jest.mock('../src/flows/searchMedicineFlow', () => ({}));
jest.mock('../src/flows/stockReceiptFlow', () => ({}));
jest.mock('../src/flows/expiryFlow', () => ({}));
jest.mock('../src/flows/auditFlow', () => ({}));
jest.mock('../src/flows/medicineMasterFlow', () => ({}));
jest.mock('../src/flows/inventoryLookupFlow', () => ({}));
jest.mock('../src/flows/returnFlow', () => ({}));
jest.mock('../src/flows/dispensingFlow', () => ({ handle: mockDispensingHandle }));
jest.mock('../src/config/env', () => mockEnv);
jest.mock('../src/config/twilio', () => ({
  getTwilioClient: jest.fn(() => ({ messages: { create: mockMessagesCreate } })),
  createMessagingResponse: jest.fn(() => ({ toString: () => '<Response />' }))
}));
jest.mock('../src/services/whatsappService', () => ({
  toTwiml: jest.fn((message) => '<Response><Message>' + message + '</Message></Response>')
}));

const { handleWhatsappWebhook } = require('../src/controllers/webhookController');

function response() {
  return {
    status: jest.fn().mockReturnThis(),
    type: jest.fn().mockReturnThis(),
    send: jest.fn()
  };
}

function request(messageSid = 'MM-prescription-1') {
  return {
    body: {
      From: 'whatsapp:+916380365019',
      Body: '',
      MessageSid: messageSid,
      NumMedia: '1',
      MediaUrl0: 'https://api.twilio.test/prescription.jpg',
      MediaContentType0: 'image/jpeg'
    }
  };
}

async function flushAsyncWork() {
  await new Promise(setImmediate);
  await new Promise(setImmediate);
}

function localRequest(messageSid = 'LOCAL-prescription-1') {
  return {
    body: {
      From: 'whatsapp:+916380365019',
      Body: '',
      MessageSid: messageSid,
      NumMedia: '0'
    },
    file: {
      fieldname: 'prescription',
      path: 'uploads/local-prescription.jpg',
      originalname: 'john-smith.jpg',
      mimetype: 'image/jpeg'
    }
  };
}

describe('asynchronous prescription webhook delivery', () => {
  let activeSession;
  let consoleLog;
  let consoleError;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    activeSession = {
      authenticated: true,
      actor: { userName: 'Pharmacist', facilityId: 11 },
      flow: 'dispensing',
      step: 'prescription_upload',
      facilityId: 11,
      userDbId: 22,
      data: { patientId: 33, patientName: 'sivasankar', items: [] }
    };
    mockSessionManager.getSession.mockImplementation(async () => activeSession);
    mockSessionManager.saveSession.mockImplementation(async (userId, session) => {
      activeSession = session;
      return session;
    });
    mockSessionManager.acquireMessageProcessing.mockResolvedValue(true);
    mockSessionManager.completeMessageProcessing.mockResolvedValue();
    mockMessagesCreate.mockResolvedValue({ sid: 'SM-outbound' });
    mockResolveActor.mockResolvedValue({ userName: 'Pharmacist' });
    mockEnv.isProduction = false;
  });

  afterEach(() => {
    consoleLog.mockRestore();
    consoleError.mockRestore();
  });

  test('acknowledges a slow upload before OCR completes and sends its mismatch result once', async () => {
    let completeOcr;
    mockDispensingHandle.mockImplementation(() => new Promise((resolve) => {
      completeOcr = resolve;
    }));
    const res = response();

    await handleWhatsappWebhook(request(), res, jest.fn());

    expect(res.send).toHaveBeenCalledWith('<Response />');
    expect(mockMessagesCreate).not.toHaveBeenCalled();
    await new Promise(setImmediate);
    expect(mockDispensingHandle).toHaveBeenCalledWith(expect.objectContaining({
      session: expect.objectContaining({
        facilityId: 11,
        data: expect.objectContaining({ patientId: 33, patientName: 'sivasankar' })
      })
    }));

    completeOcr('❌ PATIENT NAME MISMATCH\n\nEntered Name: sivasankar\nPrescription Name: John Smith');
    await flushAsyncWork();

    expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
    expect(mockMessagesCreate).toHaveBeenCalledWith(expect.objectContaining({
      to: 'whatsapp:+916380365019',
      body: expect.stringContaining('PATIENT NAME MISMATCH')
    }));
    expect(mockSessionManager.completeMessageProcessing).toHaveBeenCalledTimes(1);
  });

  test('delivers the existing matching-patient prescription analysis through outbound WhatsApp', async () => {
    mockDispensingHandle.mockResolvedValue('PRESCRIPTION ANALYSIS\n\n✅ MEDICINES IN STOCK');
    const res = response();

    await handleWhatsappWebhook(request('MM-analysis'), res, jest.fn());
    await flushAsyncWork();

    expect(res.send).toHaveBeenCalledWith('<Response />');
    expect(mockMessagesCreate).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.stringContaining('PRESCRIPTION ANALYSIS')
    }));
  });

  test.each([
    ['❌ PATIENT NAME MISMATCH', 'PATIENT NAME MISMATCH'],
    ['PRESCRIPTION ANALYSIS\n\n✅ MEDICINES IN STOCK', 'PRESCRIPTION ANALYSIS']
  ])('returns local multipart %s through HTTP without outbound WhatsApp', async (flowResponse, expectedBody) => {
    mockDispensingHandle.mockResolvedValue(flowResponse);
    const res = response();

    await handleWhatsappWebhook(localRequest(), res, jest.fn());

    expect(mockDispensingHandle).toHaveBeenCalledWith(expect.objectContaining({
      media: [expect.objectContaining({ path: 'uploads/local-prescription.jpg', contentType: 'image/jpeg' })]
    }));
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining(expectedBody));
    expect(mockMessagesCreate).not.toHaveBeenCalled();
    expect(mockSessionManager.acquireMessageProcessing).not.toHaveBeenCalled();
  });

  test('does not allow multipart files to use the synchronous path in production', async () => {
    mockEnv.isProduction = true;
    mockDispensingHandle.mockResolvedValue('PRESCRIPTION ANALYSIS');
    const res = response();

    await handleWhatsappWebhook(localRequest('LOCAL-production'), res, jest.fn());
    await flushAsyncWork();

    expect(res.send).toHaveBeenCalledWith('<Response />');
    expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
  });

  test('does not start or send a duplicate result for the same MessageSid', async () => {
    let completeOcr;
    mockDispensingHandle.mockImplementation(() => new Promise((resolve) => {
      completeOcr = resolve;
    }));
    mockSessionManager.acquireMessageProcessing
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    await handleWhatsappWebhook(request('MM-duplicate'), response(), jest.fn());
    await handleWhatsappWebhook(request('MM-duplicate'), response(), jest.fn());
    await new Promise(setImmediate);
    completeOcr('❌ PATIENT NAME MISMATCH');
    await flushAsyncWork();

    expect(mockDispensingHandle).toHaveBeenCalledTimes(1);
    expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
  });

  test('returns the existing safe retry response if asynchronous OCR fails', async () => {
    mockDispensingHandle.mockRejectedValue(new Error('OCR unavailable'));

    await handleWhatsappWebhook(request('MM-failure'), response(), jest.fn());
    await flushAsyncWork();

    expect(mockMessagesCreate).toHaveBeenCalledWith(expect.objectContaining({
      body: 'Unable to read that prescription image. Please upload a clear JPEG or PNG image.'
    }));
  });
});