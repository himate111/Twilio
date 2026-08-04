# WhatsApp Webhook

## Endpoint

```text
POST /webhooks/whatsapp
Content-Type: application/x-www-form-urlencoded
```

This endpoint is designed for Twilio WhatsApp inbound messages. It returns TwiML XML with a single WhatsApp reply.

## Required Twilio Fields

- `From`: sender WhatsApp number, for example `whatsapp:+15551234567`
- `Body`: inbound text message
- `MessageSid` or `SmsMessageSid`: Twilio message id used for retry safety
- `NumMedia`: number of attached media files

Media fields are supported as:

- `MediaUrl0`, `MediaContentType0`
- `MediaUrl1`, `MediaContentType1`

Media metadata is attached to receipt transactions when sent during the Stock Receipt workflow.

## Signature Validation

Set:

```text
TWILIO_VALIDATE_SIGNATURE=true
TWILIO_AUTH_TOKEN=...
PUBLIC_BASE_URL=https://your-public-host
```

The validator uses Twilio's `X-Twilio-Signature` header and the full webhook URL.

## Retry Safety

Twilio may retry webhook delivery. The controller caches replies by `MessageSid` in Redis or memory so duplicate webhooks return the same response without advancing workflow state. Transaction tables also include `source_message_sid` uniqueness per transaction type.

## Example TwiML Response

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>🏥 Drug Supply Assistant&#xA;&#xA;Main Menu:...</Message>
</Response>
```

## Error Behavior

Operational errors inside the webhook return HTTP 200 with a safe WhatsApp message. This prevents Twilio retry storms while avoiding internal error leakage.
