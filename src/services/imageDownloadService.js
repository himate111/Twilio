const axios = require('axios');
const fs = require('fs');
const path = require('path');

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 30_000;
const SUPPORTED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png']);
const UPLOADS_DIRECTORY = path.resolve(process.cwd(), 'uploads');

function normaliseMimeType(value) {
  return String(value || '').split(';')[0].trim().toLowerCase();
}

function isSupportedImageMimeType(value) {
  return SUPPORTED_IMAGE_MIME_TYPES.has(normaliseMimeType(value));
}

function assertSupportedImageMimeType(value) {
  if (!isSupportedImageMimeType(value)) throw new Error('Unsupported prescription image type. Upload a JPEG or PNG image.');
}

function hasValidImageSignature(buffer, contentType) {
  const mime = normaliseMimeType(contentType);
  const jpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const png = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return (mime === 'image/jpeg' && jpeg) || (mime === 'image/png' && png);
}

async function validateImageFile(filePath, contentType) {
  assertSupportedImageMimeType(contentType);
  const image = await fs.promises.readFile(filePath);
  if (image.length > MAX_IMAGE_BYTES || !hasValidImageSignature(image, contentType)) {
    throw new Error('The uploaded file content is not a valid JPEG or PNG image.');
  }
}

async function cleanupTemporaryImage(filePath) {
  if (!filePath) return;
  const resolved = path.resolve(filePath);
  const relative = path.relative(UPLOADS_DIRECTORY, resolved);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return;
  try { await fs.promises.unlink(resolved); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}

async function downloadImage(url, filePath, options = {}) {
  const expectedMime = options.contentType;
  assertSupportedImageMimeType(expectedMime);
  try {
    const response = await axios({
      url, method: 'GET', responseType: 'arraybuffer', timeout: options.timeoutMs || DOWNLOAD_TIMEOUT_MS,
      maxContentLength: options.maxBytes || MAX_IMAGE_BYTES, maxBodyLength: options.maxBytes || MAX_IMAGE_BYTES,
      validateStatus: status => status >= 200 && status < 300,
      auth: { username: process.env.TWILIO_ACCOUNT_SID, password: process.env.TWILIO_AUTH_TOKEN }
    });
    const actualMime = normaliseMimeType(response.headers['content-type']);
    if (actualMime && !isSupportedImageMimeType(actualMime)) throw new Error('Twilio returned an unsupported prescription image type.');
    const image = Buffer.from(response.data);
    if (image.length > (options.maxBytes || MAX_IMAGE_BYTES) || !hasValidImageSignature(image, expectedMime)) {
      throw new Error('The downloaded file content is not a valid JPEG or PNG image.');
    }
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, image);
    return filePath;
  } catch (error) {
    await cleanupTemporaryImage(filePath);
    throw error;
  }
}

module.exports = { DOWNLOAD_TIMEOUT_MS, MAX_IMAGE_BYTES, SUPPORTED_IMAGE_MIME_TYPES, cleanupTemporaryImage, downloadImage, isSupportedImageMimeType, validateImageFile };