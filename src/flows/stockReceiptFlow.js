const formatter = require('../utils/formatter');
const validators = require('../utils/validators');
const { FLOW_NAMES } = require('../utils/constants');
const menuFlow = require('./menuFlow');
const defaultStockReceiptService =
  require('../services/stockReceiptService');
const defaultInventoryService =
  require('../services/inventoryService');

function optionalRequire(path) {
  try {
    return require(path);
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      return null;
    }

    throw err;
  }
}

const defaultNotificationService =
  optionalRequire('../services/notificationService');

const STEPS = {
  // Main Menu
  MAIN_MENU: "main_menu",

  // ==========================
  // CREATE STOCK ORDER
  // ==========================

  CREATE_ORDER_VENDOR: "create_order_vendor",

  CREATE_ORDER_MEDICINE_SEARCH: "create_order_medicine_search",

  CREATE_ORDER_MEDICINE_SELECT: "create_order_medicine_select",

  CREATE_ORDER_QUANTITY: "create_order_quantity",

  CREATE_ORDER_ADD_MORE: "create_order_add_more",

  CREATE_ORDER_SUMMARY: "create_order_summary",

  CREATE_ORDER_CONFIRM: "create_order_confirm",

  ORDER_CREATED_MENU: "order_created_menu",

  // ==========================
  // RECEIVE STOCK
  // ==========================

  RECEIVE_ORDER_LIST: "receive_order_list",

  RECEIVE_ORDER_SELECT: "receive_order_select",

  RECEIVE_MEDICINE_SELECT: "receive_medicine_select",

  RECEIVE_BATCH: "receive_batch",

  RECEIVE_EXPIRY: "receive_expiry",

  RECEIVE_QUANTITY: "receive_quantity",

  RECEIVE_ADD_MORE: "receive_add_more",

  RECEIVE_SUMMARY: "receive_summary",

  RECEIVE_CONFIRM: "receive_confirm"
};

const DEFAULT_RECEIPT_NOTIFY_THRESHOLD = 1000;

function getReceiptNotifyThreshold() {
  const configured =
    process.env.STOCK_RECEIPT_NOTIFY_THRESHOLD ||
    process.env.STOCK_RECEIPT_SUPERVISOR_THRESHOLD ||
    process.env.LARGE_RECEIPT_THRESHOLD;

  const threshold = Number(configured);

  return Number.isFinite(threshold) && threshold > 0
    ? threshold
    : DEFAULT_RECEIPT_NOTIFY_THRESHOLD;
}

function getStockReceiptService(context) {
  return context.services?.stockReceiptService ||
    defaultStockReceiptService;
}

function getInventoryService(context) {
  return context.services?.inventoryService ||
    defaultInventoryService;
}

function getNotificationService(context) {
  return context.services?.notificationService ||
    defaultNotificationService;
}

function getServiceMethod(service, methodNames) {
  for (const methodName of methodNames) {
    if (service && typeof service[methodName] === 'function') {
      return service[methodName].bind(service);
    }
  }

  return null;
}

function normalizeText(value) {
  return String(value || '').trim();
}

function asList(result) {
  if (Array.isArray(result)) {
    return result;
  }

  if (!result) {
    return [];
  }

  for (const key of [
    'items',
    'rows',
    'results',
    'data',
    'vendors',
    'medicines',
    'orders'
  ]) {
    if (Array.isArray(result[key])) {
      return result[key];
    }
  }

  return [result];
}

function medicineDisplayName(medicine = {}) {
  return formatter.productDisplayName(medicine);
}

function vendorDisplayName(vendor = {}) {
  return vendor.name ||
    vendor.vendorName ||
    vendor.vendor_name ||
    vendor.supplierName ||
    vendor.companyName ||
    'Unknown vendor';
}

function orderDisplayCode(order = {}) {
  return order.orderNumber ||
    order.orderNo ||
    order.referenceNumber ||
    order.reference ||
    order.code ||
    `Order ${order.id}`;
}

function lineId(line = {}) {
  return line.id ||
    line.lineId ||
    line.stockOrderLineId ||
    line.orderLineId ||
    line.StockOrderLineId ||
    line.medicineId ||
    line.productId ||
    line.product_id;
}

function medicineFromLine(line = {}) {
  const medicine =
    line.medicine ||
    line.Medicine ||
    line.product ||
    line.Product ||
    {};

  return {
    id:
      medicine.id ||
      line.medicineId ||
      line.productId ||
      line.product_id,
    code:
      medicine.code ||
      medicine.productCode ||
      medicine.product_code ||
      line.medicineCode ||
      line.productCode,
    name:
      medicine.name ||
      medicine.medicineName ||
      medicine.productName ||
      line.medicineName ||
      line.productName ||
      line.name,
    formulation:
      medicine.formulation ||
      medicine.dosageForm ||
      line.formulation ||
      line.dosageForm,
    strength:
      medicine.strength ||
      line.strength,
    generic_name:
      medicine.generic_name ||
      medicine.genericName ||
      line.genericName
  };
}

function requiredQuantityFromLine(line = {}) {
  return Number(
    line.quantityRequired ??
    line.requiredQuantity ??
    line.orderedQuantity ??
    line.orderQuantity ??
    line.quantity ??
    line.qty ??
    0
  );
}

function receivedQuantityFromLine(line = {}) {
  return Number(
    line.quantityReceived ??
    line.receivedQuantity ??
    line.receivedQty ??
    0
  );
}

function getOrderLines(order = {}) {
  return order.lines ||
    order.orderLines ||
    order.stockOrderLines ||
    order.StockOrderLine ||
    order.StockOrderLines ||
    order.items ||
    [];
}

function selectedReceiptLineKeys(receiptItems = []) {
  return new Set(
    receiptItems.map((item) =>
      String(item.orderLineId || item.lineId || item.medicineId)
    )
  );
}

function receiptHasBatch(receiptItems, medicineId, batchNumber) {
  const normalizedBatch =
    normalizeText(batchNumber).toLowerCase();

  return (receiptItems || []).some((item) =>
    String(item.medicine?.id) === String(medicineId) &&
    normalizeText(item.batchNumber).toLowerCase() === normalizedBatch
  );
}

function getRemainingOrderLines(order = {}, receiptItems = []) {
  const selected = selectedReceiptLineKeys(receiptItems);

  return getOrderLines(order).filter((line) => {
    const key = String(lineId(line));
    return key && !selected.has(key);
  });
}

function validateSelection(text, list) {
  const allowed = list.map((_, index) => String(index + 1));
  const option = validators.oneOf(text, allowed);

  if (!option.valid) {
    return {
      valid: false,
      message: 'Select a valid option from the list.'
    };
  }

  return {
    valid: true,
    value: list[Number(option.value) - 1]
  };
}

function stockReceiptMenu() {
  return [
    'Stock Receipt',
    '',
    '1. Create Order',
    '',
    '2. Receive Stock',
    '',
    'Reply with 1 or 2.'
  ].join('\n');
}

function askVendorSearch() {
  return [
    'Create Order',
    '',
    'Search vendor by name:'
  ].join('\n');
}

function askMedicineSearchForOrder() {
  return [
    'Search medicine to add to this order:'
  ].join('\n');
}

function askReceiveAnotherMedicine() {
  return [
    'Receive another medicine from this order?',
    '',
    '1. Yes',
    '',
    '2. No'
  ].join('\n');
}

function confirmationPrompt() {
  return [
    '1. Confirm',
    '',
    '2. Re-enter'
  ].join('\n');
}

function renderVendorMatches(vendors) {
  return [
    'Vendors found:',
    '',
    ...vendors.flatMap((vendor, index) => [
      `${index + 1}. ${vendorDisplayName(vendor)}`,
      ...(index < vendors.length - 1 ? [''] : [])
    ]),
    '',
    'Select vendor number, or type another search.'
  ].join('\n');
}

function renderMedicineMatches(medicines) {
  return [
    'Medicines found:',
    '',
    ...medicines.flatMap((medicine, index) => [
      `${index + 1}. ${medicineDisplayName(medicine)}`,
      ...(index < medicines.length - 1 ? [''] : [])
    ]),
    '',
    'Select medicine number, or type another search.'
  ].join('\n');
}

function renderPendingOrders(orders, facilityName) {
  if (!orders.length) {
    return [
      'No pending stock orders found.',
      '',
      `Facility: ${facilityName || 'Current facility'}`,
      '',
      menuFlow.renderMainMenu()
    ].join('\n');
  }

  return [
    'Pending Stock Orders',
    '',
    ...orders.flatMap((order, index) => {
      const vendor =
        order.vendor ||
        order.Vendor ||
        {};

      const lines = getOrderLines(order);
      const totalLines = lines.length ||
        order.totalLines ||
        order.lineCount ||
        0;

      const record = [
        `${index + 1}. ${orderDisplayCode(order)}`,
        `   Vendor: ${vendorDisplayName(vendor)}`,
        `   Medicines: ${totalLines}`
      ].join('\n');
      return [record, ...(index < orders.length - 1 ? [''] : [])];
    }),
    '',
    'Select order number.'
  ].join('\n');
}

function renderOrderMedicines(order, receiptItems = []) {
  const remainingLines =
    getRemainingOrderLines(order, receiptItems);

  if (!remainingLines.length) {
    return null;
  }

  return [
    'Medicines in Order',
    '',
    ...remainingLines.flatMap((line, index) => {
      const medicine = medicineFromLine(line);
      const required = requiredQuantityFromLine(line);
      const alreadyReceived = receivedQuantityFromLine(line);
      const remaining = Math.max(
        0,
        required - alreadyReceived
      );

      const record = [
        `${index + 1}. ${medicineDisplayName(medicine)}`,
        `   Ordered: ${required}`,
        `   Received: ${alreadyReceived}`,
        `   Remaining: ${remaining}`
      ].join('\n');
      return [record, ...(index < remainingLines.length - 1 ? [''] : [])];
    }),
    '',
    'Select medicine number.'
  ].join('\n');
}

function buildCreateOrderSummary(session) {
  const items = session.data.orderItems || [];
  const vendor = session.data.vendor;

  return [
    'Order Summary',
    '',
    `Facility: ${session.actor.facilityName}`,
    `Vendor: ${vendorDisplayName(vendor)}`,
    '',
    ...items.flatMap((item, index) => [
      `${index + 1}. ${medicineDisplayName(item.medicine)}\n` +
      `   Qty Required: ${item.quantityRequired}`,
      ...(index < items.length - 1 ? [''] : [])
    ]),
    '',
    confirmationPrompt()
  ].join('\n');
}

function buildReceiptSummary(session) {
  const order = session.data.selectedOrder || {};
  const items = session.data.receiptItems || [];
  const vendor =
    order.vendor ||
    order.Vendor ||
    session.data.vendor ||
    {};

  return [
    'Receipt Summary',
    '',
    `Facility: ${session.actor.facilityName}`,
    `Order: ${orderDisplayCode(order)}`,
    `Vendor: ${vendorDisplayName(vendor)}`,
    '',
    ...items.flatMap((item, index) => {
      const overage =
        item.quantityReceived > item.quantityRequired
          ? item.quantityReceived - item.quantityRequired
          : 0;

      const record = [
        `${index + 1}. ${medicineDisplayName(item.medicine)}`,
        `   Ordered: ${item.quantityRequired}`,
        `   Received: ${item.quantityReceived}`,
        `   Batch: ${item.batchNumber}`,
        `   Expiry: ${item.expiryYearMonth}`,
        `   Delivery: ${item.deliveryStatus}`,
        overage > 0 ? `   Overage: ${overage}` : ''
      ].filter(Boolean).join('\n');
      return [record, ...(index < items.length - 1 ? [''] : [])];
    }),
    '',
    confirmationPrompt()
  ].join('\n');
}

function mergeOrderItem(items, nextItem) {
  const existingIndex = items.findIndex(
    (item) =>
      String(item.medicine.id) === String(nextItem.medicine.id)
  );

  if (existingIndex === -1) {
    return [...items, nextItem];
  }

  return items.map((item, index) =>
    index === existingIndex
      ? {
          ...item,
          quantityRequired:
            item.quantityRequired + nextItem.quantityRequired
        }
      : item
  );
}

async function saveSession(context, session) {
  await context.sessionManager.saveSession(
    context.userId,
    session
  );
}

async function searchVendors(context, query) {
  const service = getStockReceiptService(context);
  const search =
    getServiceMethod(service, [
      'searchVendors',
      'findVendors',
      'listVendors'
    ]);

  if (!search) {
    throw new Error(
      'stockReceiptService.searchVendors is required for Create Order.'
    );
  }

  return asList(await search(query));
}

async function searchMedicines(context, query) {

    const medicines =
        await context.services.stockOrderService.findMedicine(query);

    return asList(medicines);

}

async function createStockOrder(context, input) {

    return context.services.stockOrderService.createOrder(input);

}

async function listPendingOrders(context, facilityId) {
  const service = getStockReceiptService(context);
  const list =
    getServiceMethod(service, [
      'listPendingOrders',
      'getPendingOrders',
      'findPendingOrders'
    ]);

  if (!list) {
    throw new Error(
      'stockReceiptService.listPendingOrders is required for Receive Stock.'
    );
  }

  return asList(await list(facilityId));
}

async function getOrderForReceipt(context, orderId, facilityId) {
  const service = getStockReceiptService(context);
  const getOrder =
    getServiceMethod(service, [
      'getOrderForReceipt',
      'getStockOrder',
      'getOrderById'
    ]);

  if (!getOrder) {
    throw new Error(
      'stockReceiptService.getOrderForReceipt is required for Receive Stock.'
    );
  }

  return getOrder(orderId, facilityId);
}

async function batchExists(context, medicineId, batchNumber, facilityId) {
  const service = getStockReceiptService(context);
  const exists =
    getServiceMethod(service, [
      'batchExists',
      'isDuplicateBatch',
      'stockBatchExists'
    ]);

  if (!exists) {
    throw new Error(
      'stockReceiptService.batchExists is required for Receive Stock.'
    );
  }

  return exists(medicineId, batchNumber, facilityId);
}

async function createStockReceipt(context, input) {
  const service = getStockReceiptService(context);
  const create =
    getServiceMethod(service, [
      'createStockReceipt',
      'createReceipt'
    ]);

  if (!create) {
    return null;
  }

  return create(input);
}

async function updateStockOrderStatus(context, input) {
  const service = getStockReceiptService(context);
  const update =
    getServiceMethod(service, [
      'updateStockOrderStatus',
      'updateOrderStatus',
      'markOrderReceiptStatus'
    ]);

  if (!update) {
    return null;
  }

  return update(input);
}

async function receiveInventoryStock(context, input) {
  const inventory = getInventoryService(context);
  const receive =
    getServiceMethod(inventory, ['receiveStock']);

  if (receive) {
    return receive(input);
  }

  const service = getStockReceiptService(context);
  const record =
    getServiceMethod(service, [
      'recordReceipt',
      'receiveStock'
    ]);

  if (!record) {
    throw new Error(
      'inventoryService.receiveStock is required for Receive Stock.'
    );
  }

  return record(input);
}

async function notifyLargeReceipt(context, session, item) {
  const threshold = getReceiptNotifyThreshold();

  if (item.quantityReceived <= threshold) {
    return;
  }

  const notification = getNotificationService(context);

  if (
    !notification ||
    typeof notification.notifySupervisor !== 'function'
  ) {
    return;
  }

  await notification.notifySupervisor({
    facilityId: session.facilityId,
    facilityName: session.actor.facilityName,
    userId: session.userDbId,
    medicineId: item.medicine.id,
    medicine: medicineDisplayName(item.medicine),
    quantity: item.quantityReceived,
    threshold,
    orderId: session.data.selectedOrder?.id,
    batchNumber: item.batchNumber,
    expiryDate: item.expiryDate
  });
}

function buildOrderCreateInput(session) {
  return {
    facilityId: session.facilityId,
    userId: session.userDbId,
    vendorId: session.data.vendor.id,
    vendor: session.data.vendor,
    items: session.data.orderItems.map((item) => ({
      medicineId: item.medicine.id,
      productId: item.medicine.id,
      medicine: item.medicine,
      quantityRequired: item.quantityRequired,
      quantity: item.quantityRequired
    }))
  };
}

function buildReceiptCreateInput(session) {
  const order = session.data.selectedOrder;

  return {
    facilityId: session.facilityId,
    userId: session.userDbId,
    stockOrderId: order.id,
    orderId: order.id,
    items: session.data.receiptItems.map((item) => ({
      stockOrderLineId: item.orderLineId,
      orderLineId: item.orderLineId,
      medicineId: item.medicine.id,
      productId: item.medicine.id,
      medicine: item.medicine,
      batchNumber: item.batchNumber,
      expiryDate: item.expiryDate,
      expiryYearMonth: item.expiryYearMonth,
      quantityReceived: item.quantityReceived,
      quantity: item.quantityReceived,
      quantityRequired: item.quantityRequired,
      shortfallQuantity: item.shortfallQuantity,
      deliveryStatus: item.deliveryStatus
    }))
  };
}

function orderStatusAfterReceipt(order, receiptItems) {
  const receiptByLine = new Map(
    receiptItems.map((item) => [
      String(item.orderLineId),
      item.quantityReceived
    ])
  );

  const allReceived = getOrderLines(order).every((line) => {
    const key = String(lineId(line));
    const required = requiredQuantityFromLine(line);
    const previouslyReceived = receivedQuantityFromLine(line);
    const currentReceived = receiptByLine.get(key) || 0;

    return previouslyReceived + currentReceived >= required;
  });

  return allReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
}

async function recordOrderReceipt(context, session) {
  const service = getStockReceiptService(context);
  const recordOrderReceiptMethod =
    getServiceMethod(service, [
      'recordOrderReceipt',
      'receiveOrder',
      'receiveStockOrder'
    ]);

  if (recordOrderReceiptMethod) {
    return recordOrderReceiptMethod({
      ...buildReceiptCreateInput(session),
      sourceMessageSid: context.messageSid,
      mediaUrls: context.media || []
    });
  }

  const receipt =
    await createStockReceipt(
      context,
      buildReceiptCreateInput(session)
    );

  const results = [];

  for (const item of session.data.receiptItems) {
    const result =
      await receiveInventoryStock(context, {
        facilityId: session.facilityId,
        userId: session.userDbId,
        product: item.medicine,
        productId: item.medicine.id,
        medicineId: item.medicine.id,
        quantity: item.quantityReceived,
        requestedQuantity: item.quantityRequired,
        shortfallQuantity: item.shortfallQuantity,
        deliveryStatus: item.deliveryStatus,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate,
        expiryYearMonth: item.expiryYearMonth,
        source: 'StockOrder',
        sourceMessageSid: context.messageSid,
        mediaUrls: context.media || [],
        stockOrderId: session.data.selectedOrder.id,
        orderId: session.data.selectedOrder.id,
        stockOrderLineId: item.orderLineId,
        orderLineId: item.orderLineId,
        stockReceiptId: receipt?.id || receipt?.receiptId || null
      });

    results.push(result);
  }

  await updateStockOrderStatus(context, {
    facilityId: session.facilityId,
    stockOrderId: session.data.selectedOrder.id,
    orderId: session.data.selectedOrder.id,
    status: orderStatusAfterReceipt(
      session.data.selectedOrder,
      session.data.receiptItems
    )
  });

  return {
    receipt,
    inventoryResults: results
  };
}

async function handleMainMenu(context,session){

const option=validators.oneOf(
context.text,
["1","2"]
);

if(!option.valid){

return[
"📦 Stock Receipt",
"",
"1. Create Order",
'',
"2. Receive Stock"
].join("\n");

}

if (option.value === "1") {

    const vendors =
    await context.services.stockOrderService.getVendors();

console.log(vendors);

    session.step = STEPS.CREATE_ORDER_VENDOR;

    session.data = {
        ...session.data,
        vendors
    };

    await context.sessionManager.saveSession(
        context.userId,
        session
    );

    return [
        "📦 Create Order",
        "",
        "Select Vendor",
        "",
        ...vendors.map(
            (vendor, index) =>
                `${index + 1}. ${vendor.name}`
        ),
        "",
        "Reply with the vendor number."
    ].join("\n");

}

session.step = STEPS.RECEIVE_ORDER_LIST;

await context.sessionManager.saveSession(
context.userId,
session
);

return handleReceiveOrderList(context, session);

}

async function handleCreateOrderVendor(context, session) {

    const vendors = session.data.vendors || [];

    const option = validators.oneOf(
        context.text,
        vendors.map((_, index) => String(index + 1))
    );

    if (!option.valid) {

        return [
            "📦 Select Vendor",
            "",
            ...vendors.map(
                (vendor, index) =>
                    `${index + 1}. ${vendor.name}`
            ),
            "",
            "Reply with the vendor number."
        ].join("\n");

    }

    const vendor = vendors[Number(option.value) - 1];

    session.step = STEPS.CREATE_ORDER_MEDICINE_SEARCH;

    session.data = {
        ...session.data,
        vendor
    };

    await context.sessionManager.saveSession(
        context.userId,
        session
    );

    return [
        `✅ Vendor Selected`,
        "",
        vendor.name,
        "",
        "Enter medicine name:"
    ].join("\n");

}

async function handleCreateOrderMedicine(context, session) {
  const data = session.data || {};
  const text = normalizeText(context.text);

  if (data.medicineMatches?.length && /^\d+$/.test(text)) {
    const selection =
      validateSelection(text, data.medicineMatches);

    if (!selection.valid) {
      return selection.message;
    }

    await saveSession(context, {
      ...session,
      step: STEPS.CREATE_ORDER_QUANTITY,
      data: {
        ...data,
        currentMedicine: selection.value,
        medicineMatches: []
      }
    });

    return [
      `Medicine selected: ${medicineDisplayName(selection.value)}`,
      '',
      'Enter quantity required:'
    ].join('\n');
  }

  const medicineName = validators.requiredText(text, 'medicine name');

  if (!medicineName.valid) {
    return medicineName.message;
  }

  const medicines =
    await searchMedicines(context, medicineName.value);

  if (!medicines.length) {
    return [
      'Medicine not found.',
      '',
      'Search medicine again:'
    ].join('\n');
  }

  await saveSession(context, {
    ...session,
    data: {
      ...data,
      medicineMatches: medicines
    }
  });

  return renderMedicineMatches(medicines);
}

async function handleCreateOrderQuantity(context, session) {
  const quantity = validators.positiveQuantity(context.text);

  if (!quantity.valid) {
    return quantity.message;
  }

  const item = {
    medicine: session.data.currentMedicine,
    quantityRequired: quantity.value
  };

  const items =
    mergeOrderItem(session.data.orderItems || [], item);

  await saveSession(context, {
    ...session,
    step: STEPS.CREATE_ORDER_ADD_MORE,
    data: {
      ...session.data,
      orderItems: items,
      currentMedicine: null
    }
  });

  return [
    'Medicine added to order.',
    '',
    formatter.askAddAnotherMedicine()
  ].join('\n');
}

async function handleCreateOrderAddMore(context, session) {
  const option = validators.oneOf(context.text, ['1', '2']);

  if (!option.valid) {
    return formatter.askAddAnotherMedicine();
  }

  if (option.value === '1') {
    await saveSession(context, {
      ...session,
      step: STEPS.CREATE_ORDER_MEDICINE_SEARCH
    });

    return askMedicineSearchForOrder();
  }

  const summarySession = {
    ...session,
    step: STEPS.CREATE_ORDER_SUMMARY
  };

  await saveSession(context, summarySession);

  return handleCreateOrderSummary(context, summarySession);
}

async function handleCreateOrderSummary(context, session) {
  await saveSession(context, {
    ...session,
    step: STEPS.CREATE_ORDER_CONFIRM
  });

  return buildCreateOrderSummary(session);
}

async function handleCreateOrderConfirm(context, session) {
  const option = validators.oneOf(context.text, ['1', '2']);

  if (!option.valid) {
    return 'Reply with 1 to Confirm or 2 to Re-enter';
  }

  if (option.value === '2') {
    await saveSession(context, {
      ...session,
      step: STEPS.CREATE_ORDER_VENDOR,
      data: {
        orderItems: [],
        receiptItems: []
      }
    });

    return askVendorSearch();
  }

  const order =
    await createStockOrder(
        context,
        buildOrderCreateInput(session)
    );

session.step = STEPS.ORDER_CREATED_MENU;

session.data = {
    ...session.data,
    createdOrder: order
};

await context.sessionManager.saveSession(
    context.userId,
    session
);

const medicineLines = session.data.orderItems.flatMap((item, index) => [
    `${index + 1}. ${medicineDisplayName(item.medicine)}`,
    `   Qty: ${item.quantityRequired}`,
    ""
]);

return [
    "✅ Stock Order Created Successfully",
    "",
    `Order Number: ${order.orderCode || order.orderNumber || order.id}`,
    "",
    `Facility: ${session.actor.facilityName}`,
    `Vendor: ${vendorDisplayName(session.data.vendor)}`,
    "",
    "Ordered Medicines",
    "",
    ...medicineLines,
    "Status: Pending",
    "",
    "What would you like to do next?",
    "",
    "1️⃣ Create Another Order",
    "",
    "2️⃣ Receive Stock",
    "",
    "0️⃣ Return to Main Menu"
].join("\n");
}

async function handleReceiveOrderList(context, session) {
  const pendingOrders =
    await listPendingOrders(context, session.facilityId);

  if (!pendingOrders.length) {
    await saveSession(context, {
      authenticated: true,
      actor: session.actor
    });

    return renderPendingOrders(
      [],
      session.actor.facilityName
    );
  }

  await saveSession(context, {
    ...session,
    step: STEPS.RECEIVE_ORDER_SELECT,
    data: {
      ...session.data,
      pendingOrders,
      receiptItems: []
    }
  });

  return renderPendingOrders(
    pendingOrders,
    session.actor.facilityName
  );
}

async function handleReceiveOrderSelect(context, session) {
  const pendingOrders = session.data.pendingOrders || [];
  const selection = validateSelection(context.text, pendingOrders);

  if (!selection.valid) {
    return renderPendingOrders(
      pendingOrders,
      session.actor.facilityName
    );
  }

  const selected =
    await getOrderForReceipt(
      context,
      selection.value.id,
      session.facilityId
    );

  const order = selected || selection.value;
  const orderLines = getOrderLines(order);

  if (!orderLines.length) {
    return [
      'Selected order has no medicines to receive.',
      '',
      'Select another order.'
    ].join('\n');
  }

  await saveSession(context, {
    ...session,
    step: STEPS.RECEIVE_MEDICINE_SELECT,
    data: {
      ...session.data,
      selectedOrder: order,
      receiptItems: []
    }
  });

  return [
    `Order selected: ${orderDisplayCode(order)}`,
    '',
    renderOrderMedicines(order, [])
  ].join('\n');
}

async function handleReceiveMedicineSelect(context, session) {
  const order = session.data.selectedOrder;
  const remaining =
    getRemainingOrderLines(
      order,
      session.data.receiptItems || []
    );

  if (!remaining.length) {
    const summarySession = {
      ...session,
      step: STEPS.RECEIVE_SUMMARY
    };

    await saveSession(context, summarySession);

    return handleReceiveSummary(context, summarySession);
  }

  const selection = validateSelection(context.text, remaining);

  if (!selection.valid) {
    return renderOrderMedicines(
      order,
      session.data.receiptItems || []
    );
  }

  const line = selection.value;
  const medicine = medicineFromLine(line);
  const quantityRequired = requiredQuantityFromLine(line);
  const previouslyReceived = receivedQuantityFromLine(line);

  await saveSession(context, {
    ...session,
    step: STEPS.RECEIVE_BATCH,
    data: {
      ...session.data,
      currentReceiptLine: {
        orderLineId: lineId(line),
        line,
        medicine,
        quantityRequired,
        previouslyReceived
      }
    }
  });

  return [
    `Medicine selected: ${medicineDisplayName(medicine)}`,
    `Ordered: ${quantityRequired}`,
    `Already received: ${previouslyReceived}`,
    '',
    'Enter batch number:'
  ].join('\n');
}

async function handleReceiveBatch(context, session) {
  const batch =
    validators.requiredText(context.text, 'batch number');

  if (!batch.valid) {
    return batch.message;
  }

  const current = session.data.currentReceiptLine;

  if (
    receiptHasBatch(
      session.data.receiptItems || [],
      current.medicine.id,
      batch.value
    )
  ) {
    return [
      `Batch ${batch.value} is already entered for this medicine.`,
      '',
      'Enter a different batch number:'
    ].join('\n');
  }

  const duplicate =
    await batchExists(
      context,
      current.medicine.id,
      batch.value,
      session.facilityId
    );

  if (duplicate) {
    return [
      `Batch ${batch.value} already exists.`,
      '',
      'Enter a different batch number:'
    ].join('\n');
  }

  await saveSession(context, {
    ...session,
    step: STEPS.RECEIVE_EXPIRY,
    data: {
      ...session.data,
      currentReceiptLine: {
        ...current,
        batchNumber: batch.value
      }
    }
  });

  return 'Enter expiry date (YYYY-MM):';
}

async function handleReceiveExpiry(context, session) {
  const expiry = validators.expiryMonth(context.text);

  if (!expiry.valid) {
    return expiry.message;
  }

  await saveSession(context, {
    ...session,
    step: STEPS.RECEIVE_QUANTITY,
    data: {
      ...session.data,
      currentReceiptLine: {
        ...session.data.currentReceiptLine,
        expiryDate: expiry.value.date,
        expiryYearMonth: expiry.value.yearMonth
      }
    }
  });

  return 'Enter quantity received:';
}

async function handleReceiveQuantity(context, session) {
  const quantity = validators.positiveQuantity(context.text);

  if (!quantity.valid) {
    return quantity.message;
  }

  const current = session.data.currentReceiptLine;
  const shortfallQuantity = Math.max(
    0,
    current.quantityRequired - quantity.value
  );
  const deliveryStatus =
    shortfallQuantity > 0 ? 'PARTIAL' : 'FULL';

  const receiptItem = {
    orderLineId: current.orderLineId,
    medicine: current.medicine,
    batchNumber: current.batchNumber,
    expiryDate: current.expiryDate,
    expiryYearMonth: current.expiryYearMonth,
    quantityRequired: current.quantityRequired,
    previouslyReceived: current.previouslyReceived,
    quantityReceived: quantity.value,
    shortfallQuantity,
    deliveryStatus
  };

  const receiptItems = [
    ...(session.data.receiptItems || []),
    receiptItem
  ];

  await saveSession(context, {
    ...session,
    step: STEPS.RECEIVE_ADD_MORE,
    data: {
      ...session.data,
      receiptItems,
      currentReceiptLine: null
    }
  });

  const remaining =
    getRemainingOrderLines(
      session.data.selectedOrder,
      receiptItems
    );

  if (!remaining.length) {
    const summarySession = {
      ...session,
      step: STEPS.RECEIVE_SUMMARY,
      data: {
        ...session.data,
        receiptItems,
        currentReceiptLine: null
      }
    };

    await saveSession(context, summarySession);

    return handleReceiveSummary(context, summarySession);
  }

  return askReceiveAnotherMedicine();
}

async function handleReceiveAddMore(context, session) {
  const option = validators.oneOf(context.text, ['1', '2']);

  if (!option.valid) {
    return askReceiveAnotherMedicine();
  }

  if (option.value === '1') {
    await saveSession(context, {
      ...session,
      step: STEPS.RECEIVE_MEDICINE_SELECT
    });

    return renderOrderMedicines(
      session.data.selectedOrder,
      session.data.receiptItems || []
    );
  }

  const summarySession = {
    ...session,
    step: STEPS.RECEIVE_SUMMARY
  };

  await saveSession(context, summarySession);

  return handleReceiveSummary(context, summarySession);
}

async function handleReceiveSummary(context, session) {
  await saveSession(context, {
    ...session,
    step: STEPS.RECEIVE_CONFIRM
  });

  return buildReceiptSummary(session);
}

async function handleReceiveConfirm(context, session) {
  const option = validators.oneOf(context.text, ['1', '2']);

  if (!option.valid) {
    return 'Reply with 1 to Confirm or 2 to Re-enter';
  }

  if (option.value === '2') {
    await saveSession(context, {
      ...session,
      step: STEPS.RECEIVE_MEDICINE_SELECT,
      data: {
        ...session.data,
        receiptItems: [],
        currentReceiptLine: null
      }
    });

    return renderOrderMedicines(
      session.data.selectedOrder,
      []
    );
  }

  const receiptResult =
    await recordOrderReceipt(context, session);

  for (const item of session.data.receiptItems) {
    await notifyLargeReceipt(context, session, item);
  }

  await context.sessionManager.clearSession(context.userId);

  return [
    'Stock receipt recorded.',
    '',
    `Facility: ${session.actor.facilityName}`,
    `Order: ${orderDisplayCode(session.data.selectedOrder)}`,
    `Medicines received: ${session.data.receiptItems.length}`,
    receiptResult?.receipt?.id ||
      receiptResult?.receiptId ||
      receiptResult?.id
      ? `Reference: ${
          receiptResult.receipt?.id ||
          receiptResult.receiptId ||
          receiptResult.id
        }`
      : '',
    '',
    'Stock level updated.',
    '',
    menuFlow.renderMainMenu()
  ].filter(Boolean).join('\n');
}

async function handleOrderCreatedMenu(context, session) {

    const option = validators.oneOf(
        context.text,
        ["0", "1", "2"]
    );

    if (!option.valid) {
        return [
            "What would you like to do next?",
            "",
            "1️⃣ Create Another Order",
            '',
            "2️⃣ Receive Stock",
            '',
            "0️⃣ Return to Main Menu"
        ].join("\n");
    }

    // Create another order
    if (option.value === "1") {

        const vendors =
            await context.services.stockOrderService.getVendors();

        session.step = STEPS.CREATE_ORDER_VENDOR;

        session.data = {
            vendor: null,
            vendors,
            orderItems: [],
            receiptItems: []
        };

        await context.sessionManager.saveSession(
            context.userId,
            session
        );

        return [
            "📦 Create Order",
            "",
            "Select Vendor",
            "",
            ...vendors.map(
                (vendor, index) =>
                    `${index + 1}. ${vendor.name}`
            ),
            "",
            "Reply with the vendor number."
        ].join("\n");
    }

    // Receive stock
    if (option.value === "2") {

        session.step = STEPS.RECEIVE_ORDER_LIST;

        await context.sessionManager.saveSession(
            context.userId,
            session
        );

        return handleReceiveOrderList(context, session);
    }

    // Main menu
    await context.sessionManager.clearSession(
        context.userId
    );

    return menuFlow.renderMainMenu();
}

async function start(context){

const session={
authenticated:true,
actor:context.actor,
flow:FLOW_NAMES.STOCK_RECEIPT,
step:STEPS.MAIN_MENU,
facilityId:context.actor.facilityId,
userDbId:context.actor.userId,
data:{
vendor:null,
orderItems:[],
receiptItems:[]
}
};

await context.sessionManager.saveSession(
context.userId,
session
);

return[
"📦 Stock Receipt",
"",
"1. Create Order",
'',
"2. Receive Stock",
"",
"Reply with an option."
].join("\n");

}

async function handle(context){

const session=context.session;

switch(session.step){

case STEPS.MAIN_MENU:
return handleMainMenu(context,session);

case STEPS.CREATE_ORDER_VENDOR:
    return handleCreateOrderVendor(context, session);

case STEPS.CREATE_ORDER_MEDICINE_SEARCH:
    return handleCreateOrderMedicine(context, session);

case STEPS.CREATE_ORDER_QUANTITY:
    return handleCreateOrderQuantity(context, session);

case STEPS.CREATE_ORDER_ADD_MORE:
    return handleCreateOrderAddMore(context, session);

case STEPS.CREATE_ORDER_SUMMARY:
    return handleCreateOrderSummary(context, session);

case STEPS.CREATE_ORDER_CONFIRM:
    return handleCreateOrderConfirm(context, session);

    case STEPS.ORDER_CREATED_MENU:
    return handleOrderCreatedMenu(context, session);

case STEPS.RECEIVE_ORDER_LIST:
    return handleReceiveOrderList(context, session);

case STEPS.RECEIVE_ORDER_SELECT:
    return handleReceiveOrderSelect(context, session);

    case STEPS.RECEIVE_MEDICINE_SELECT:
    return handleReceiveMedicineSelect(context, session);

case STEPS.RECEIVE_BATCH:
return handleReceiveBatch(context,session);

case STEPS.RECEIVE_EXPIRY:
return handleReceiveExpiry(context,session);

case STEPS.RECEIVE_QUANTITY:
return handleReceiveQuantity(context,session);

case STEPS.RECEIVE_SUMMARY:
return handleReceiveSummary(context,session);

case STEPS.RECEIVE_CONFIRM:
return handleReceiveConfirm(context,session);

default:

await context.sessionManager.clearSession(
context.userId
);

return menuFlow.renderMainMenu();

}

}

module.exports = {
  STEPS,
  start,
  handle
};
