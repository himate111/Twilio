const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { cleanupTemporaryImage, validateImageFile } = require('../src/services/imageDownloadService');

describe('prescription image safety', () => {
  test('validates a JPEG signature and removes only the temporary uploads file', async () => {
    const filePath = path.join(process.cwd(), 'uploads', `ocr-test-${randomUUID()}.jpg`);
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    await expect(validateImageFile(filePath, 'image/jpeg')).resolves.toBeUndefined();
    await cleanupTemporaryImage(filePath);
    await expect(fs.promises.access(filePath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('rejects unsupported prescription media before OCR', async () => {
    await expect(validateImageFile('missing.pdf', 'application/pdf')).rejects.toThrow('Unsupported prescription image type');
  });
});