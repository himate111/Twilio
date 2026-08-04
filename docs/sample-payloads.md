# Sample API Payloads

Use these examples against a local server at `http://localhost:3000`.

## Main Menu

```bash
curl -X POST http://localhost:3000/webhooks/whatsapp \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "From=whatsapp:+15551234567" \
  --data-urlencode "To=whatsapp:+14155238886" \
  --data-urlencode "Body=menu" \
  --data-urlencode "MessageSid=SM_MENU_001" \
  --data-urlencode "NumMedia=0"
```

## Start Stock Receipt

```bash
curl -X POST http://localhost:3000/webhooks/whatsapp \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "From=whatsapp:+15551234567" \
  --data-urlencode "To=whatsapp:+14155238886" \
  --data-urlencode "Body=1" \
  --data-urlencode "MessageSid=SM_RECEIPT_001" \
  --data-urlencode "NumMedia=0"
```

Then send these messages with new `MessageSid` values:

```text
Paracetamol
100
B2304
2027-12
1
2
```

## Receipt With Image Metadata

```bash
curl -X POST http://localhost:3000/webhooks/whatsapp \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "From=whatsapp:+15551234567" \
  --data-urlencode "To=whatsapp:+14155238886" \
  --data-urlencode "Body=Paracetamol" \
  --data-urlencode "MessageSid=SM_RECEIPT_IMAGE_001" \
  --data-urlencode "NumMedia=1" \
  --data-urlencode "MediaUrl0=https://api.twilio.com/2010-04-01/Accounts/ACxxx/Messages/MMxxx/Media/MExxx" \
  --data-urlencode "MediaContentType0=image/jpeg"
```

## Consumption Reporting

```bash
curl -X POST http://localhost:3000/webhooks/whatsapp \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "From=whatsapp:+15551234567" \
  --data-urlencode "To=whatsapp:+14155238886" \
  --data-urlencode "Body=2" \
  --data-urlencode "MessageSid=SM_CONSUMPTION_001" \
  --data-urlencode "NumMedia=0"
```

Then:

```text
Paracetamol
20
```

## Inventory Lookup

```bash
curl -X POST http://localhost:3000/webhooks/whatsapp \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "From=whatsapp:+15551234567" \
  --data-urlencode "To=whatsapp:+14155238886" \
  --data-urlencode "Body=Paracetmol" \
  --data-urlencode "MessageSid=SM_LOOKUP_001" \
  --data-urlencode "NumMedia=0"
```
