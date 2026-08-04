SET NAMES utf8mb4;
SET time_zone = '+00:00';

INSERT INTO facilities (id, code, name, district, state)
VALUES (1, 'PHC-001', 'Primary Health Centre Demo', 'Demo District', 'Demo State')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  district = VALUES(district),
  state = VALUES(state);

INSERT INTO users (facility_id, whatsapp_number, name, role)
VALUES
  (1, 'whatsapp:+15551234567', 'Demo Health Worker', 'PHARMACIST'),
  (1, 'whatsapp:+15557654321', 'Demo Supervisor', 'SUPERVISOR')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  role = VALUES(role),
  is_active = 1;

INSERT INTO products (code, name, generic_name, strength, formulation, description, unit)
VALUES
  ('1456', 'Paracetamol', 'Paracetamol', '100mg', 'Tablet', 'Analgesic and antipyretic tablet', 'tablet'),
  ('2301', 'Amoxicillin', 'Amoxicillin', '250mg', 'Capsule', 'Antibiotic capsule', 'capsule'),
  ('7820', 'ORS', 'Oral Rehydration Salts', '20.5g', 'Sachet', 'WHO formula oral rehydration salts', 'sachet'),
  ('9902', 'Iron Folic Acid', 'Ferrous Sulfate + Folic Acid', '60mg + 500mcg', 'Tablet', 'IFA supplementation tablet', 'tablet')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  generic_name = VALUES(generic_name),
  strength = VALUES(strength),
  formulation = VALUES(formulation),
  description = VALUES(description),
  unit = VALUES(unit),
  is_active = 1;

INSERT INTO inventory_batches
  (facility_id, product_id, batch_number, expiry_date, received_quantity, available_quantity, status)
SELECT 1, p.id, 'B2304', '2027-12-31', 150, 150, 'ACTIVE'
FROM products p
WHERE p.code = '1456'
ON DUPLICATE KEY UPDATE
  received_quantity = VALUES(received_quantity),
  available_quantity = VALUES(available_quantity),
  status = 'ACTIVE';

INSERT INTO inventory_batches
  (facility_id, product_id, batch_number, expiry_date, received_quantity, available_quantity, status)
SELECT 1, p.id, 'EXP0626', '2026-06-30', 40, 40, 'ACTIVE'
FROM products p
WHERE p.code = '1456'
ON DUPLICATE KEY UPDATE
  received_quantity = VALUES(received_quantity),
  available_quantity = VALUES(available_quantity),
  status = 'ACTIVE',
  expiry_acknowledged_at = NULL,
  expiry_acknowledged_by = NULL;
