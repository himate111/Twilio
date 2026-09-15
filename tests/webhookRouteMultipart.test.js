const express = require('express');
const request = require('supertest');
const fs = require('fs');

const mockHandle = jest.fn(async (req, res) => {
  await fs.promises.unlink(req.file.path);
  res.status(200).json({ fieldName: req.file.fieldname });
});

jest.mock('../src/controllers/webhookController', () => ({
  handleWhatsappWebhook: mockHandle
}));
jest.mock('../src/middleware/webhookValidator', () => (req, res, next) => next());

const webhookRoutes = require('../src/routes/webhookRoutes');

describe('multipart prescription route', () => {
  test('accepts the lowercase prescription file field and exposes it as req.file', async () => {
    const app = express();
    app.use(webhookRoutes);

    await request(app)
      .post('/whatsapp')
      .field('From', 'whatsapp:+916380365019')
      .field('MessageSid', 'LOCAL-multipart')
      .attach('prescription', Buffer.from([0xff, 0xd8, 0xff, 0xd9]), {
        filename: 'john-smith.jpg',
        contentType: 'image/jpeg'
      })
      .expect(200, { fieldName: 'prescription' });

    expect(mockHandle).toHaveBeenCalledWith(expect.objectContaining({
      file: expect.objectContaining({
        fieldname: 'prescription',
        mimetype: 'image/jpeg'
      })
    }), expect.anything(), expect.anything());
  });
});