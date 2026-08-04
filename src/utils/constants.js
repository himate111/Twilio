const FLOW_NAMES = {
  STOCK_RECEIPT: 'stock_receipt',
  CONSUMPTION: 'consumption',
  EXPIRY: 'expiry',
  AUDIT: 'audit',
  INVENTORY_LOOKUP: 'inventory_lookup',
  CATEGORY_MASTER: 'category_master',
  MEDICINE_MASTER: 'medicine_master',
  DISPENSING: 'dispensing',
  SEARCH_MEDICINE:
  'search_medicine',
  RETURN: 'return',
  TRANSFER: 'transfer'
};

const SESSION_STATUS = {
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
};

const MENU_TRIGGERS = new Set(['hi', 'hello', 'start', 'menu', 'help']);
const CANCEL_TRIGGERS = new Set(['cancel', 'stop', 'exit']);

const TRANSACTION_TYPES = {
  RECEIPT: 'RECEIPT',
  CONSUMPTION: 'CONSUMPTION',
  DISPOSAL: 'DISPOSAL',
  ADJUSTMENT: 'ADJUSTMENT',
  AUDIT: 'AUDIT'
};

const AUDIT_REASONS = {
  1: 'Breakage',
  2: 'Theft',
  3: 'Data Error',
  4: 'Other'
};

module.exports = {
  FLOW_NAMES,
  SESSION_STATUS,
  MENU_TRIGGERS,
  CANCEL_TRIGGERS,
  TRANSACTION_TYPES,
  AUDIT_REASONS
};
