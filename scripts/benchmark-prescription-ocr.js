#!/usr/bin/env node
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const parser = require('../src/services/prescriptionParserService');
const { PaddleOcrWorker } = require('../src/services/prescriptionOcrService');
const { AzureDocumentIntelligenceClient } = require('../src/services/azureDocumentIntelligenceService');
const { MAX_IMAGE_BYTES, validateImageFile } = require('../src/services/imageDownloadService');

function contentTypeFor(filePath) {
  return path.extname(filePath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
}

function diagnostic(recognition, durationMs) {
  const candidates = parser.extractMedicineCandidates(recognition.text, recognition.lines);
  return {
    durationMs,
    rawText: recognition.fullText || recognition.text,
    normalizedLines: recognition.lines,
    patientName: parser.extractPatientName(recognition.text),
    candidates: candidates.map(candidate => ({
      medicine: candidate.medicineText,
      strength: candidate.strength || null,
      quantity: candidate.numericQuantity ?? candidate.calculatedQuantity ?? null,
      quantitySource: candidate.quantitySource || null,
      directions: candidate.directions || null,
      frequency: candidate.frequency || null,
      duration: candidate.duration || null
    }))
  };
}

function printProvider(name, result) {
  console.log(`\n==================================================\n${name}\n==================================================`);
  if (result.error) { console.log(`OCR ERROR: ${result.error}`); return; }
  console.log(`OCR duration: ${result.value.durationMs}ms`);
  console.log(`RAW OCR TEXT:\n${result.value.rawText}`);
  console.log(`NORMALIZED LINES:\n${JSON.stringify(result.value.normalizedLines, null, 2)}`);
  console.log(`PARSER MEDICINE CANDIDATES:\n${JSON.stringify(result.value.candidates, null, 2)}`);
  console.log(`PATIENT NAME EXTRACTED:\n${result.value.patientName || '(none)'}`);
  console.log(`MEDICINES / STRENGTHS:\n${JSON.stringify(result.value.candidates.map(c => ({ medicine: c.medicine, strength: c.strength })), null, 2)}`);
  console.log(`QUANTITY EXTRACTION:\n${JSON.stringify(result.value.candidates.map(c => ({ medicine: c.medicine, quantity: c.quantity, quantitySource: c.quantitySource })), null, 2)}`);
}

function comparisonValue(result, selector) {
  return result.error ? `(unavailable: ${result.error})` : selector(result.value);
}

async function runProvider(provider) {
  const startedAt = Date.now();
  try { return { value: diagnostic(await provider(), Date.now() - startedAt) }; }
  catch (error) { return { error: error.message }; }
}

async function main() {
  const imagePath = process.argv[2] && path.resolve(process.argv[2]);
  if (!imagePath) throw new Error('Usage: node scripts/benchmark-prescription-ocr.js <image-path>');
  const stats = await fs.promises.stat(imagePath);
  if (!stats.isFile() || stats.size > MAX_IMAGE_BYTES) throw new Error('Benchmark image must be a JPEG or PNG image no larger than 10 MB.');
  await validateImageFile(imagePath, contentTypeFor(imagePath));

  const paddleWorker = new PaddleOcrWorker();
  const azure = new AzureDocumentIntelligenceClient();
  try {
    // These direct OCR calls deliberately avoid dispensing, database, stock, and notification services.
    const azureResult = await runProvider(() => azure.recognize(imagePath));
    const paddleResult = await runProvider(() => paddleWorker.recognize(imagePath));
    printProvider('AZURE', azureResult);
    printProvider('PADDLE', paddleResult);
    console.log('\n==================================================\nCOMPARISON\n==================================================');
    console.log(`Azure recognized:\n${comparisonValue(azureResult, value => value.rawText)}`);
    console.log(`\nPaddle recognized:\n${comparisonValue(paddleResult, value => value.rawText)}`);
    console.log(`\nAzure medicines:\n${JSON.stringify(comparisonValue(azureResult, value => value.candidates.map(c => ({ medicine: c.medicine, strength: c.strength, quantity: c.quantity }))), null, 2)}`);
    console.log(`\nPaddle medicines:\n${JSON.stringify(comparisonValue(paddleResult, value => value.candidates.map(c => ({ medicine: c.medicine, strength: c.strength, quantity: c.quantity }))), null, 2)}`);
  } finally {
    paddleWorker.shutdown();
  }
}

main().catch(error => { console.error(`Benchmark failed: ${error.message}`); process.exitCode = 1; });
