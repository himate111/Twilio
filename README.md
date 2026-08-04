# WhatsApp Drug Supply Chain Management Chatbot

Fresh Node.js/Express implementation of a WhatsApp-based operational inventory assistant for Primary Health Centres. The system uses guided conversational workflows over Twilio WhatsApp, MariaDB/MySQL for inventory records, Redis for conversation sessions when available, and in-memory sessions for local development.

## What It Does

- Stock Receipt: medicine search, quantity, batch, expiry, partial delivery, image attachment metadata, receipt transaction logging, and stock balance update.
- Consumption Reporting: medicine search, quantity capture, FEFO stock deduction, transaction logging, and resumable drafts.
- Expiry Alert Management: near-expiry batch alerts, acknowledgement, disposal quantity/method/responsible person capture, and disposal records.
- Stock Audit: system stock lookup, physical count capture, variance calculation, reason capture, and supervisor-review-ready audit logs.
- Inventory Lookup: fuzzy search by product name, code, description, formulation, and strength, showing only available unexpired stock.
- Help/Main Menu: accessible at any time with `hi`, `hello`, `start`, `menu`, or `help`.

## Architecture

```text
src/
  app.js
  server.js
  config/              environment, DB, Redis, Twilio
  routes/              Express route wiring
  controllers/         Twilio webhook orchestration
  services/            transactional domain services
  flows/               WhatsApp workflow state machines
  session/             Redis session manager with memory fallback
  utils/               formatting, validation, fuzzy search, errors
  middleware/          logging, validation, errors
migrations/            SQL schema and seed data
tests/                 unit tests for workflow behavior
docs/                  webhook and sample payload documentation
```

## Requirements

- Node.js 20+
- MariaDB 10.5+ or MySQL 8+
- Redis recommended for production sessions
- Twilio WhatsApp Sandbox or production WhatsApp sender

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create environment config:

   ```bash
   cp .env.example .env
   ```

3. Create the database and run migrations:

   ```bash
   mysql -u root -p -e "CREATE DATABASE drug_supply_chain CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
   mysql -u root -p drug_supply_chain < migrations/001_initial_schema.sql
   mysql -u root -p drug_supply_chain < migrations/002_seed_reference_data.sql
   ```

4. Start the server:

   ```bash
   npm run dev
   ```

5. Configure Twilio WhatsApp webhook:

   ```text
   POST https://your-public-host/webhooks/whatsapp
   Content-Type: application/x-www-form-urlencoded
   ```

For local development, expose the app with a tunnel such as ngrok and set `PUBLIC_BASE_URL` in `.env` if `TWILIO_VALIDATE_SIGNATURE=true`.

## Environment

Important variables:

- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `REDIS_URL` for persistent sessions; leave blank for in-memory development fallback
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`
- `TWILIO_VALIDATE_SIGNATURE=true` in production
- `DEFAULT_FACILITY_ID=1` for sandbox testing
- `EXPIRY_ALERT_DAYS=90`
- `ENABLE_CRON=true` to enable scheduled reminders

## User Registration

Incoming WhatsApp users are matched against `users.whatsapp_number`, for example:

```text
whatsapp:+15551234567
```

For sandbox development, `ALLOW_UNKNOWN_USERS=true` allows unknown numbers to use `DEFAULT_FACILITY_ID`. In production, set it to `false`.

## Main Menu

Send:

```text
hi
hello
start
menu
help
```

The bot replies:

```text
🏥 Drug Supply Assistant

Main Menu:
1️⃣ Stock Receipt
2️⃣ Consumption Reporting
3️⃣ Expiry Alerts
4️⃣ Stock Audit
5️⃣ Inventory Lookup
6️⃣ Help
```

Send `cancel` to end the active workflow.

## Running Tests

```bash
npm test
```

The tests cover workflow state transitions and fuzzy medicine matching without requiring Twilio, Redis, or MariaDB.

## Production Notes

- Enable Twilio request signature validation with `TWILIO_VALIDATE_SIGNATURE=true`.
- Use Redis for session persistence across restarts and multiple Node instances.
- Run behind TLS and a reverse proxy; set `TRUST_PROXY=true` if rate limiting should respect proxy headers.
- Keep `ALLOW_UNKNOWN_USERS=false` and pre-register facility users.
- Use database backups and operational monitoring for stock transaction tables.
- Keep cron reminders on a single worker process or use a distributed scheduler in clustered deployments.
