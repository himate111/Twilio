const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { normaliseAzureLayoutEvidence } = require('./documentEvidenceService');

const AZURE_API_VERSION = '2024-11-30';
const AZURE_MODEL_ID = 'prebuilt-read';
const AZURE_LAYOUT_MODEL_ID = 'prebuilt-layout';
const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_POLL_INTERVAL_MS = 1_000;

class AzureOcrError extends Error {
  constructor(code, message, status) { super(message); this.name = 'AzureOcrError'; this.code = code; this.status = status; }
}
function number(value) { const result = Number(value); return Number.isFinite(result) ? result : null; }
function polygonToBox(polygon) {
  if (!Array.isArray(polygon) || polygon.length < 8 || polygon.length % 2) return null;
  const points = polygon.map(number); if (points.some(point => point === null)) return null;
  const x = points.filter((_point, index) => index % 2 === 0); const y = points.filter((_point, index) => index % 2);
  return [Math.min(...x), Math.min(...y), Math.max(...x), Math.max(...y)];
}
function normalisePolygon(polygon) { const points = Array.isArray(polygon) ? polygon.map(number) : null; return points?.some(point => point === null) ? null : points; }
function normaliseWord(word) {
  const polygon = normalisePolygon(word?.polygon);
  return { text: String(word?.content || '').trim(), confidence: number(word?.confidence), polygon, box: polygonToBox(polygon) };
}
function normaliseAzureAnalyzeResult(analyzeResult) {
  if (!analyzeResult || !Array.isArray(analyzeResult.pages)) throw new AzureOcrError('AZURE_MALFORMED_RESPONSE', 'Azure OCR returned a malformed response.');
  const pages = analyzeResult.pages.map((page, pageIndex) => {
    const pageNumber = Number.isInteger(page?.pageNumber) ? page.pageNumber : pageIndex + 1;
    const lines = (page?.lines || []).map((line, lineIndex) => {
      const polygon = normalisePolygon(line?.polygon); const words = (line?.words || []).map(normaliseWord);
      const values = words.map(word => word.confidence).filter(value => value !== null);
      return { text: String(line?.content || '').trim(), confidence: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null, box: polygonToBox(polygon), polygon, words, pageNumber, readingOrder: lineIndex };
    }).filter(line => line.text);
    return { pageNumber, width: number(page?.width), height: number(page?.height), unit: typeof page?.unit === 'string' ? page.unit : null, lines };
  });
  const lines = pages.flatMap(page => page.lines); const fullText = String(analyzeResult.content || '').trim();
  const text = lines.map(line => line.text).join('\n') || fullText;
  if (!text) throw new AzureOcrError('AZURE_EMPTY_RESPONSE', 'Azure OCR returned no recognized text.');
  const values = lines.map(line => line.confidence).filter(value => value !== null);
  return { engine: 'azure-document-intelligence-prebuilt-read', modelId: AZURE_MODEL_ID, apiVersion: AZURE_API_VERSION, text, fullText, confidence: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null, lines, pages, warnings: [] };
}
function endpointFor(value) {
  const text = String(value || '').trim().replace(/\/+$/, '');
  if (!text) throw new AzureOcrError('AZURE_ENDPOINT_MISSING', 'Azure Document Intelligence endpoint is not configured.');
  try { const url = new URL(text); if (!['https:', 'http:'].includes(url.protocol)) throw new Error(); return url.toString().replace(/\/$/, ''); }
  catch { throw new AzureOcrError('AZURE_ENDPOINT_INVALID', 'Azure Document Intelligence endpoint is invalid.'); }
}
function sanitiseAzureError(error) {
  if (error instanceof AzureOcrError) return error;
  const status = error?.response?.status; const code = error?.response?.data?.error?.code;
  if (status === 401 || status === 403) return new AzureOcrError(`AZURE_HTTP_${status}`, `Azure Document Intelligence authentication failed (${status}${code ? `: ${code}` : ''}).`, status);
  if (status === 429) return new AzureOcrError('AZURE_HTTP_429', 'Azure Document Intelligence rate limit reached (429).', status);
  if (status) return new AzureOcrError(`AZURE_HTTP_${status}`, `Azure Document Intelligence request failed (${status}${code ? `: ${code}` : ''}).`, status);
  if (error?.code === 'ECONNABORTED' || /timeout/i.test(String(error?.message || ''))) return new AzureOcrError('AZURE_TIMEOUT', 'Azure Document Intelligence request timed out.');
  return new AzureOcrError('AZURE_NETWORK_ERROR', 'Azure Document Intelligence request failed.');
}
class AzureDocumentIntelligenceClient {
  constructor(options = {}) {
    this.environment = options.environment || process.env; this.http = options.http || axios; this.readFile = options.readFile || fs.promises.readFile;
    this.sleep = options.sleep || (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
    this.timeoutMs = Number(options.timeoutMs || this.environment.AZURE_OCR_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
    this.pollIntervalMs = Number(options.pollIntervalMs || this.environment.AZURE_OCR_POLL_INTERVAL_MS || DEFAULT_POLL_INTERVAL_MS);
  }
  getConfiguration() {
    const endpoint = endpointFor(this.environment.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT); const key = String(this.environment.AZURE_DOCUMENT_INTELLIGENCE_KEY || '').trim();
    if (!key) throw new AzureOcrError('AZURE_KEY_MISSING', 'Azure Document Intelligence key is not configured.'); return { endpoint, key };
  }
  operationUrl(endpoint, location) {
    if (!location) throw new AzureOcrError('AZURE_MALFORMED_RESPONSE', 'Azure OCR did not return an operation location.');
    try { const operation = new URL(location); if (operation.origin !== new URL(endpoint).origin) throw new Error(); return operation.toString(); }
    catch { throw new AzureOcrError('AZURE_MALFORMED_RESPONSE', 'Azure OCR returned an untrusted operation location.'); }
  }
  async recognize(imagePath) {
    const { endpoint, key } = this.getConfiguration(); const deadline = Date.now() + Math.max(1, this.timeoutMs); const remaining = () => Math.max(0, deadline - Date.now());
    const request = async config => { if (remaining() <= 0) throw new AzureOcrError('AZURE_TIMEOUT', 'Azure Document Intelligence request timed out.'); try { return await this.http({ ...config, timeout: Math.max(1, remaining()) }); } catch (error) { throw sanitiseAzureError(error); } };
    let image; try { image = await this.readFile(imagePath); } catch { throw new AzureOcrError('AZURE_IMAGE_READ_FAILED', 'Unable to read the prescription image for Azure OCR.'); }
    const contentType = path.extname(imagePath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
    const submitted = await request({ method: 'POST', url: `${endpoint}/documentintelligence/documentModels/${AZURE_MODEL_ID}:analyze?api-version=${AZURE_API_VERSION}`, data: image, headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Type': contentType }, validateStatus: status => status === 202 });
    const operationUrl = this.operationUrl(endpoint, submitted?.headers?.['operation-location'] || submitted?.headers?.['Operation-Location']);
    while (remaining() > 0) {
      const result = await request({ method: 'GET', url: operationUrl, headers: { 'Ocp-Apim-Subscription-Key': key }, validateStatus: status => status >= 200 && status < 300 }); const body = result?.data;
      if (body?.status === 'succeeded') return normaliseAzureAnalyzeResult(body.analyzeResult);
      if (body?.status === 'failed') throw new AzureOcrError('AZURE_ANALYSIS_FAILED', `Azure Document Intelligence analysis failed${body?.error?.code ? `: ${body.error.code}` : ''}.`);
      await this.sleep(Math.min(Math.max(1, this.pollIntervalMs), remaining()));
    }
    throw new AzureOcrError('AZURE_TIMEOUT', 'Azure Document Intelligence analysis timed out.');
  }
}
function normaliseAzureLayoutAnalyzeResult(analyzeResult) {
  try {
    return normaliseAzureLayoutEvidence(analyzeResult);
  } catch {
    throw new AzureOcrError('AZURE_LAYOUT_MALFORMED_RESPONSE', 'Azure Layout returned a malformed response.');
  }
}

class AzureDocumentIntelligenceLayoutClient extends AzureDocumentIntelligenceClient {
  async analyze(imagePath) {
    const { endpoint, key } = this.getConfiguration();
    const deadline = Date.now() + Math.max(1, this.timeoutMs);
    const remaining = () => Math.max(0, deadline - Date.now());
    const request = async config => {
      if (remaining() <= 0) throw new AzureOcrError('AZURE_TIMEOUT', 'Azure Layout request timed out.');
      try {
        return await this.http({ ...config, timeout: Math.max(1, remaining()) });
      } catch (error) {
        throw sanitiseAzureError(error);
      }
    };

    let image;
    try {
      image = await this.readFile(imagePath);
    } catch {
      throw new AzureOcrError('AZURE_IMAGE_READ_FAILED', 'Unable to read the prescription image for Azure Layout.');
    }

    const contentType = path.extname(imagePath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
    const layoutUrl = endpoint + '/documentintelligence/documentModels/' + AZURE_LAYOUT_MODEL_ID + ':analyze?api-version=' + AZURE_API_VERSION;
    const submitted = await request({
      method: 'POST',
      url: layoutUrl,
      data: image,
      headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Type': contentType },
      validateStatus: status => status === 202
    });
    const operationUrl = this.operationUrl(endpoint, submitted?.headers?.['operation-location'] || submitted?.headers?.['Operation-Location']);

    while (remaining() > 0) {
      const result = await request({
        method: 'GET',
        url: operationUrl,
        headers: { 'Ocp-Apim-Subscription-Key': key },
        validateStatus: status => status >= 200 && status < 300
      });
      const body = result?.data;
      if (body?.status === 'succeeded') return normaliseAzureLayoutAnalyzeResult(body.analyzeResult);
      if (body?.status === 'failed') throw new AzureOcrError('AZURE_LAYOUT_ANALYSIS_FAILED', 'Azure Layout analysis failed.');
      await this.sleep(Math.min(Math.max(1, this.pollIntervalMs), remaining()));
    }

    throw new AzureOcrError('AZURE_TIMEOUT', 'Azure Layout request timed out.');
  }
}

module.exports = {
  AZURE_API_VERSION,
  AZURE_MODEL_ID,
  AZURE_LAYOUT_MODEL_ID,
  AzureDocumentIntelligenceClient,
  AzureDocumentIntelligenceLayoutClient,
  AzureOcrError,
  normaliseAzureAnalyzeResult,
  normaliseAzureLayoutAnalyzeResult,
  polygonToBox,
  sanitiseAzureError
};
