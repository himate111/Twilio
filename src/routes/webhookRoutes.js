const express = require('express');
const multer = require('multer');
const webhookController = require('../controllers/webhookController');
const webhookValidator = require('../middleware/webhookValidator');

const router = express.Router();

const upload = multer({
  dest: 'uploads/'
});

router.post(
  '/whatsapp',
  upload.single('prescription'),
  webhookValidator,
  webhookController.handleWhatsappWebhook
);

module.exports = router;