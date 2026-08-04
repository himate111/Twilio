SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS facilities (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  district VARCHAR(120) NULL,
  state VARCHAR(120) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_facilities_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  facility_id BIGINT UNSIGNED NOT NULL,
  whatsapp_number VARCHAR(40) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role ENUM('HEALTH_WORKER', 'PHARMACIST', 'SUPERVISOR', 'ADMIN') NOT NULL DEFAULT 'HEALTH_WORKER',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_users_whatsapp_number (whatsapp_number),
  KEY idx_users_facility_role (facility_id, role),
  CONSTRAINT fk_users_facility
    FOREIGN KEY (facility_id) REFERENCES facilities (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  generic_name VARCHAR(255) NULL,
  strength VARCHAR(80) NULL,
  formulation VARCHAR(80) NULL,
  description TEXT NULL,
  unit VARCHAR(40) NOT NULL DEFAULT 'unit',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_products_code (code),
  KEY idx_products_name (name),
  FULLTEXT KEY ft_products_search (name, generic_name, description)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_batches (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  facility_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  batch_number VARCHAR(120) NOT NULL,
  expiry_date DATE NOT NULL,
  received_quantity INT UNSIGNED NOT NULL DEFAULT 0,
  available_quantity INT UNSIGNED NOT NULL DEFAULT 0,
  reserved_quantity INT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('ACTIVE', 'DISPOSED', 'EXPIRED', 'QUARANTINED') NOT NULL DEFAULT 'ACTIVE',
  expiry_acknowledged_at TIMESTAMP NULL DEFAULT NULL,
  expiry_acknowledged_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_inventory_batch (facility_id, product_id, batch_number, expiry_date),
  KEY idx_inventory_lookup (facility_id, product_id, status, expiry_date),
  KEY idx_inventory_expiry (facility_id, status, expiry_date),
  CONSTRAINT fk_inventory_facility
    FOREIGN KEY (facility_id) REFERENCES facilities (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_product
    FOREIGN KEY (product_id) REFERENCES products (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_expiry_ack_user
    FOREIGN KEY (expiry_acknowledged_by) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stock_transactions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  facility_id BIGINT UNSIGNED NOT NULL,
  transaction_type ENUM('RECEIPT', 'CONSUMPTION', 'DISPOSAL', 'ADJUSTMENT', 'AUDIT') NOT NULL,
  status ENUM('DRAFT', 'COMPLETED', 'FAILED', 'REVERSED') NOT NULL DEFAULT 'COMPLETED',
  source_channel ENUM('WHATSAPP', 'API', 'SYSTEM') NOT NULL DEFAULT 'WHATSAPP',
  source_message_sid VARCHAR(80) NULL,
  created_by BIGINT UNSIGNED NULL,
  notes VARCHAR(500) NULL,
  metadata JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_stock_tx_source (source_message_sid, transaction_type),
  KEY idx_stock_tx_facility_type_time (facility_id, transaction_type, created_at),
  CONSTRAINT fk_stock_tx_facility
    FOREIGN KEY (facility_id) REFERENCES facilities (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_stock_tx_user
    FOREIGN KEY (created_by) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stock_transaction_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  transaction_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  inventory_batch_id BIGINT UNSIGNED NULL,
  quantity INT UNSIGNED NOT NULL,
  unit VARCHAR(40) NULL,
  batch_number VARCHAR(120) NULL,
  expiry_date DATE NULL,
  shortfall_quantity INT UNSIGNED NOT NULL DEFAULT 0,
  metadata JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_stock_tx_items_product (product_id),
  KEY idx_stock_tx_items_batch (inventory_batch_id),
  CONSTRAINT fk_stock_tx_items_transaction
    FOREIGN KEY (transaction_id) REFERENCES stock_transactions (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_stock_tx_items_product
    FOREIGN KEY (product_id) REFERENCES products (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_stock_tx_items_batch
    FOREIGN KEY (inventory_batch_id) REFERENCES inventory_batches (id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS consumption_reports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  facility_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  quantity_consumed INT UNSIGNED NOT NULL,
  reported_by BIGINT UNSIGNED NULL,
  stock_transaction_id BIGINT UNSIGNED NOT NULL,
  reported_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata JSON NULL,
  PRIMARY KEY (id),
  KEY idx_consumption_facility_time (facility_id, reported_at),
  KEY idx_consumption_product_time (product_id, reported_at),
  CONSTRAINT fk_consumption_facility
    FOREIGN KEY (facility_id) REFERENCES facilities (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_consumption_product
    FOREIGN KEY (product_id) REFERENCES products (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_consumption_user
    FOREIGN KEY (reported_by) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_consumption_stock_tx
    FOREIGN KEY (stock_transaction_id) REFERENCES stock_transactions (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS expiry_disposals (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  facility_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  inventory_batch_id BIGINT UNSIGNED NOT NULL,
  quantity_disposed INT UNSIGNED NOT NULL,
  disposal_method VARCHAR(255) NOT NULL,
  responsible_person VARCHAR(255) NOT NULL,
  disposed_by BIGINT UNSIGNED NULL,
  stock_transaction_id BIGINT UNSIGNED NOT NULL,
  disposed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata JSON NULL,
  PRIMARY KEY (id),
  KEY idx_disposals_facility_time (facility_id, disposed_at),
  CONSTRAINT fk_disposals_facility
    FOREIGN KEY (facility_id) REFERENCES facilities (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_disposals_product
    FOREIGN KEY (product_id) REFERENCES products (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_disposals_batch
    FOREIGN KEY (inventory_batch_id) REFERENCES inventory_batches (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_disposals_user
    FOREIGN KEY (disposed_by) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_disposals_stock_tx
    FOREIGN KEY (stock_transaction_id) REFERENCES stock_transactions (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  facility_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  system_quantity INT UNSIGNED NOT NULL,
  physical_quantity INT UNSIGNED NOT NULL,
  variance_quantity INT NOT NULL,
  reason VARCHAR(255) NOT NULL,
  notes VARCHAR(500) NULL,
  status ENUM('PENDING_REVIEW', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING_REVIEW',
  created_by BIGINT UNSIGNED NULL,
  reviewed_by BIGINT UNSIGNED NULL,
  reviewed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_facility_status_time (facility_id, status, created_at),
  CONSTRAINT fk_audit_facility
    FOREIGN KEY (facility_id) REFERENCES facilities (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_audit_product
    FOREIGN KEY (product_id) REFERENCES products (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_audit_created_by
    FOREIGN KEY (created_by) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_audit_reviewed_by
    FOREIGN KEY (reviewed_by) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_phone VARCHAR(40) NOT NULL,
  session_key VARCHAR(120) NOT NULL DEFAULT 'whatsapp',
  flow VARCHAR(80) NOT NULL,
  step VARCHAR(120) NOT NULL,
  data JSON NOT NULL,
  expires_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_user_sessions_phone_key (user_phone, session_key),
  KEY idx_user_sessions_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS webhook_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  provider VARCHAR(40) NOT NULL DEFAULT 'TWILIO',
  message_sid VARCHAR(80) NOT NULL,
  user_phone VARCHAR(40) NOT NULL,
  payload JSON NOT NULL,
  response_text TEXT NULL,
  processed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_webhook_events_message_sid (message_sid),
  KEY idx_webhook_events_user_time (user_phone, processed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
