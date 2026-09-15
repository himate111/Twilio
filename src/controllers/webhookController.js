const SessionManager = require('../session/sessionManager');
const inventoryService = require('../services/inventoryService');
const stockOrderService =
  require('../services/stockOrderService');
const stockReceiptService = require('../services/stockReceiptService');
const searchMedicineFlow =
  require('../flows/searchMedicineFlow');
const consumptionService = require('../services/consumptionService');
const expiryService = require('../services/expiryService');
const auditService = require('../services/auditService');
const categoryMasterService =
  require('../services/categoryMasterService');
  const medicineMasterService =
  require('../services/medicineMasterService');
const whatsappService = require('../services/whatsappService');
const menuFlow = require('../flows/menuFlow');
const stockReceiptFlow = require('../flows/stockReceiptFlow');

const expiryFlow = require('../flows/expiryFlow');
const auditFlow = require('../flows/auditFlow');


const medicineMasterFlow =
  require('../flows/medicineMasterFlow');

const inventoryLookupFlow = require('../flows/inventoryLookupFlow');
const returnFlow = require('../flows/returnFlow');
const dispensingFlow = require('../flows/dispensingFlow');

const formatter = require('../utils/formatter');
const twilioConfig = require('../config/twilio');
const env = require('../config/env');

const { FLOW_NAMES } = require('../utils/constants');

const sessionManager = new SessionManager();

const services = {
  inventoryService,
  stockOrderService,      // <-- ADD THIS
  stockReceiptService,
  consumptionService,
  expiryService,
  auditService,
  categoryMasterService,
  medicineMasterService
};

function toTwiml(response) {
  return whatsappService.toTwiml(response);
}

async function sendMessagesSequentially(to, messages) {
  const client = twilioConfig.getTwilioClient();

  if (!client || !env.twilio.whatsappFrom) {
    throw new Error('Twilio WhatsApp outbound messaging is not configured.');
  }

  for (const body of messages) {
    await client.messages.create({
      from: env.twilio.whatsappFrom,
      to: `whatsapp:${to}`,
      body
    });
  }
}

function createContext(incoming, actor, session = null) {
  return {
    userId: incoming.from,
    actor,
    session,
    text: incoming.body,
    media: incoming.media,
    messageSid: incoming.messageSid,
    raw: incoming.raw,
    traceTiming: incoming.traceTiming,
    sessionManager,
    services
  };
}

function createTimingLogger(startedAt) {
  return (event) => {
    console.log(`[RX TIMING] ${event} elapsedMs=${Date.now() - startedAt}`);
  };
}

function isPrescriptionUpload(incoming, session) {
  return Boolean(
    incoming.media.length &&
    session &&
    session.authenticated &&
    session.flow === FLOW_NAMES.DISPENSING &&
    session.step === 'prescription_upload'
  );
}

function cloneSession(session) {
  return JSON.parse(JSON.stringify(session));
}

function isDevelopmentLocalPrescription(req) {
  return Boolean(req.file) && !env.isProduction;
}

async function startFlowByChoice(choice, context) {
  switch (choice) {
    

        case '1':
      return dispensingFlow.start(context);

    case '2':
      return stockReceiptFlow.start(context);

    case '3':
  return searchMedicineFlow.start(context);

    // case '3':
    //   return categoryMasterFlow.start(context);

    // case '4':
    //   return medicineMasterFlow.start(context);


    // case '5':
    //   return consumptionFlow.start(context);

    // case '6':
    //   return auditFlow.start(context);

    // case '7':
    //   return expiryFlow.start(context);

    // case '8':
    //   return inventoryLookupFlow.start(context);

    

    // case '9':
    //   return returnFlow.start(context);

    // case '10':
    //   return transferFlow.start(context);

    default:
      return formatter.invalidOption();
  }
}

async function dispatchActiveFlow(context) {


  switch (context.session.flow) {
    case FLOW_NAMES.STOCK_RECEIPT:
      return stockReceiptFlow.handle(context);
    case FLOW_NAMES.CONSUMPTION:
      return consumptionFlow.handle(context);
    case FLOW_NAMES.EXPIRY:
      return expiryFlow.handle(context);
    case FLOW_NAMES.AUDIT:
      return auditFlow.handle(context);
    case FLOW_NAMES.CATEGORY_MASTER:
      return categoryMasterFlow.handle(context);
      case FLOW_NAMES.MEDICINE_MASTER:
  return medicineMasterFlow.handle(context);

    case FLOW_NAMES.DISPENSING:
       return dispensingFlow.handle(context);

    case FLOW_NAMES.RETURN:
      return returnFlow.handle(context);
  
    case FLOW_NAMES.TRANSFER:
      return transferFlow.handle(context);

    case FLOW_NAMES.INVENTORY_LOOKUP:
      return inventoryLookupFlow.handle(context);

      case FLOW_NAMES.SEARCH_MEDICINE:
  return searchMedicineFlow.handle(context);
  
    default:
      await sessionManager.clearSession(context.userId);
      return menuFlow.renderMainMenu();
  }
}

async function buildReply(incoming) {
  const actor = await inventoryService.resolveActor(incoming.from);
  const session = await sessionManager.getSession(incoming.from);

  console.log('ACTOR:', actor);
console.log('SESSION:', session);

  // account lock check
  if (actor.lockedUntil && new Date(actor.lockedUntil) > new Date()) {
    return '🔒 Account locked. Try again later or contact administrator.';
  }

  // no session → authentication flow
  // no session -> auto login using registered phone number
if (!session || !session.authenticated) {

  await sessionManager.saveSession(
    incoming.from,
    {
      authenticated: true,
      actor
    }
  );

  return formatter.welcomeMessages(actor.userName);
}

  const baseContext = createContext(incoming, session.actor, session);

  if (menuFlow.isCancelTrigger(incoming.body)) {
    await sessionManager.clearSession(incoming.from);
    return 'Workflow cancelled.\n\n' + menuFlow.renderMainMenu();
  }

  if (menuFlow.isMenuTrigger(incoming.body)) {

  await sessionManager.clearSession(
    incoming.from
  );

  await sessionManager.saveSession(
    incoming.from,
    {
      authenticated: true,
      actor: session.actor
    }
  );

  return formatter.welcomeMessages(session.actor.userName);
}

  if (session.prescriptionProcessing) {
    return 'Prescription is being processed. Please wait for the result before sending another reply.';
  }

console.log(
  'CURRENT FLOW:',
  session?.flow
);

console.log(
  'CURRENT STEP:',
  session?.step
);

  if (session.flow) {
    return dispatchActiveFlow(baseContext);
  }

  const choice = menuFlow.getMenuChoice(incoming.body);
  if (choice) {
    return startFlowByChoice(choice, baseContext);
  }

  if (!incoming.body && incoming.media.length) {
    return 'Image received.\n\nStart Stock Receipt from menu.';
  }

  return inventoryLookupFlow.quickLookup(baseContext);
}

async function processPrescriptionAsync(incoming, session, startedAt) {
  const traceTiming = createTimingLogger(startedAt);
  const expectedMessageSid = incoming.messageSid;

  try {
    const currentSession = await sessionManager.getSession(incoming.from);
    if (!currentSession || currentSession.prescriptionProcessing?.messageSid !== expectedMessageSid) {
      console.log(`[RX TIMING] async processing skipped elapsedMs=${Date.now() - startedAt} reason=session_changed`);
      return;
    }

    const processingSession = cloneSession(session);
    delete processingSession.prescriptionProcessing;
    const response = await dispensingFlow.handle(createContext(
      { ...incoming, traceTiming },
      processingSession.actor,
      processingSession
    ));
    traceTiming('response generated');

    const messages = Array.isArray(response) ? response : [response];
    await sendMessagesSequentially(incoming.from, messages);
    await sessionManager.completeMessageProcessing(expectedMessageSid, response);
    traceTiming('response sent');
  } catch (error) {
    console.error('[RX] asynchronous prescription processing failed:', error);

    try {
      const safeResponse = 'Unable to read that prescription image. Please upload a clear JPEG or PNG image.';
      await sendMessagesSequentially(incoming.from, [safeResponse]);
      await sessionManager.completeMessageProcessing(expectedMessageSid, safeResponse);
      console.log(`[RX TIMING] response sent elapsedMs=${Date.now() - startedAt} fallback=true`);
    } catch (sendError) {
      console.error('[RX] unable to send asynchronous prescription failure response:', sendError);
    }
  }
}

async function handleWhatsappWebhook(req, res, next) {
  try {
    const startedAt = Date.now();
    const traceTiming = createTimingLogger(startedAt);
    traceTiming('webhook received');
    console.log('TWILIO WEBHOOK HIT');
    console.log(req.body);



    console.log('FILE:', req.file);

const media = [];

if (req.file) {
  media.push({
    path: req.file.path,
    originalName: req.file.originalname,
    contentType: req.file.mimetype
  });
}

const numMedia = Number(req.body.NumMedia || 0);

for (let i = 0; i < numMedia; i++) {
  media.push({
    url: req.body[`MediaUrl${i}`],
    contentType: req.body[`MediaContentType${i}`]
  });
}

console.log('MEDIA RECEIVED:', media);

const incoming = {
  from: req.body.From.replace('whatsapp:', ''),
  body: req.body.Body || '',
  messageSid: req.body.MessageSid,
  media,
  raw: req.body,
  traceTiming
};

    const dryRun =
      process.env.NODE_ENV !== 'production' &&
      String(req.body.DryRun || '').toLowerCase() === 'true';

    const existingSession = await sessionManager.getSession(incoming.from);
    const localSynchronousPrescription = isDevelopmentLocalPrescription(req);
    if (!dryRun && !localSynchronousPrescription && isPrescriptionUpload(incoming, existingSession)) {
      const acquired = await sessionManager.acquireMessageProcessing(incoming.messageSid);

      res
        .status(200)
        .type('text/xml')
        .send(twilioConfig.createMessagingResponse().toString());
      traceTiming('webhook acknowledged');

      if (!acquired) {
        console.log(`[RX TIMING] duplicate prescription ignored elapsedMs=${Date.now() - startedAt} messageSid=${incoming.messageSid}`);
        return;
      }

      const processingSession = cloneSession(existingSession);
      processingSession.prescriptionProcessing = {
        messageSid: incoming.messageSid,
        startedAt: new Date().toISOString(),
        patientId: existingSession.data?.patientId,
        patientName: existingSession.data?.patientName,
        facilityId: existingSession.facilityId
      };
      await sessionManager.saveSession(incoming.from, processingSession);

      setImmediate(() => {
        processPrescriptionAsync(incoming, processingSession, startedAt);
      });
      return;
    }

    const botResponse = await buildReply(incoming);
    traceTiming('response generated');

    console.log('BOT RESPONSE:', botResponse);

    if (dryRun) {
      const messages = Array.isArray(botResponse)
        ? botResponse
        : [botResponse];
      const escapeHtml = (message) => String(message)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
      const messageBubbles = messages
        .map((message) => `<div class="message-bubble">${escapeHtml(message)}</div>`)
        .join('');

      console.log('DRY RUN MODE: Twilio send skipped');
      res
        .status(200)
        .type('html')
        .send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DRY RUN PREVIEW</title>
  <style>
    body { margin: 0; padding: 24px; background: #ece5dd; color: #111b21; font-family: Arial, sans-serif; }
    .preview { max-width: 420px; margin: 0 auto; }
    h1 { margin: 0; font-size: 16px; letter-spacing: .08em; }
    .notice { margin: 6px 0 16px; color: #667781; font-size: 14px; }
    .chat { padding: 14px; background: #e5ddd5; border-radius: 12px; }
    .message-bubble { width: fit-content; max-width: 85%; margin: 0 0 10px; padding: 8px 10px; background: #fff; border-radius: 0 8px 8px; box-shadow: 0 1px 1px rgba(0, 0, 0, .12); line-height: 1.4; white-space: pre-wrap; }
    .message-bubble:last-child { margin-bottom: 0; }
  </style>
</head>
<body>
  <main class="preview">
    <h1>DRY RUN PREVIEW</h1>
    <p class="notice">No WhatsApp message was sent</p>
    <section class="chat">${messageBubbles}</section>
  </main>
</body>
</html>`);
      traceTiming('response sent');
      return;
    }

    if (Array.isArray(botResponse)) {
      await sendMessagesSequentially(incoming.from, botResponse);

      res
        .status(200)
        .type('text/xml')
        .send(twilioConfig.createMessagingResponse().toString());
      traceTiming('response sent');
      return;
    }

    res
      .status(200)
      .type('text/xml')
      .send(toTwiml(botResponse));
    traceTiming('response sent');

  } catch (error) {
    next(error);
  }
}

module.exports = {
  handleWhatsappWebhook
};
