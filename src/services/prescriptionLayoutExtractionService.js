const { AzureDocumentIntelligenceLayoutClient } = require('./azureDocumentIntelligenceService');
const { extractMedicationCandidates } = require('./prescriptionLayoutExtractorService');

function resolvePrescriptionExtractionMode(value) {
  return String(value || '').trim().toLowerCase() === 'layout' ? 'layout' : 'legacy';
}

function layoutExtractionErrorCategory(error) {
  const code = String(error?.code || '').toUpperCase();
  if (code.startsWith('AZURE_')) return code;
  return code === 'LAYOUT_EXTRACTION_FAILED' ? code : 'LAYOUT_EXTRACTION_FAILED';
}

function candidateSignals(candidate) {
  return Array.isArray(candidate?.extractionConfidence?.signals)
    ? candidate.extractionConfidence.signals
    : [];
}

function hasValue(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasGeometryEntryStructure(candidate) {
  const signals = candidateSignals(candidate);
  return signals.includes('identitySignal')
    && (signals.includes('alignedSeries') || signals.includes('ordinalMarker'));
}

function isValidatedLayoutCandidate(candidate) {
  if (!candidate || !hasValue(candidate.medicineName)) return false;
  const sourceType = candidate?.sourceEvidence?.sourceType;
  const hasStrength = hasValue(candidate.strength);
  const hasDosageForm = hasValue(candidate.dosageForm);
  const signals = candidateSignals(candidate);

  if (sourceType === 'table') {
    return candidate?.extractionConfidence?.level === 'high'
      && signals.includes('tableRow')
      && signals.includes('headerMapped')
      && (hasStrength || hasDosageForm || signals.includes('tableRow'));
  }

  if (sourceType === 'geometry') {
    return signals.includes('identitySignal')
      && (hasStrength || (hasDosageForm && hasGeometryEntryStructure(candidate)));
  }

  return false;
}

function medicineTextFor(candidate) {
  return [candidate.medicineName, candidate.strength, candidate.dosageForm]
    .filter(hasValue)
    .join(' ')
    .trim();
}

function explicitCount(value) {
  const match = String(value || '').trim().match(/^(\d+)\s*(?:tablets?|capsules?|sachets?|bottles?|packs?|units?)?\.?$/i);
  const count = Number(match?.[1]);
  return Number.isInteger(count) && count > 0 ? count : null;
}

function toFlowCandidate(candidate) {
  const prescriptionQuantity = explicitCount(candidate.quantity);
  return {
    rawText: candidate.rawText || null,
    medicineText: medicineTextFor(candidate),
    prescribedQuantityText: hasValue(candidate.quantity) ? candidate.quantity : null,
    calculatedQuantity: null,
    explicitQuantity: prescriptionQuantity,
    numericQuantity: prescriptionQuantity,
    quantitySource: hasValue(candidate.quantity) ? 'prescription_explicit' : 'manual_input_required',
    sourceEvidence: candidate.sourceEvidence || null,
    fieldEvidence: candidate.fieldEvidence || null,
    extractionConfidence: candidate.extractionConfidence || null
  };
}

function validateLayoutCandidates(candidates) {
  const accepted = (Array.isArray(candidates) ? candidates : [])
    .filter(isValidatedLayoutCandidate)
    .map(toFlowCandidate)
    .filter(candidate => hasValue(candidate.medicineText));
  return {
    candidates: accepted,
    rejectedCount: (Array.isArray(candidates) ? candidates.length : 0) - accepted.length
  };
}

function extractionFailure(error) {
  const failure = new Error('Layout medication extraction failed.');
  failure.code = 'LAYOUT_EXTRACTION_FAILED';
  failure.cause = error;
  return failure;
}

function createLayoutExtractionService(options = {}) {
  const client = options.client || new AzureDocumentIntelligenceLayoutClient({ environment: options.environment || process.env });
  const extractor = options.extractor || extractMedicationCandidates;

  return {
    async extract(imagePath) {
      const evidence = await client.analyze(imagePath);
      let extraction;
      try {
        extraction = extractor(evidence);
      } catch (error) {
        throw extractionFailure(error);
      }
      if (!Array.isArray(extraction?.candidates)) throw extractionFailure();
      return validateLayoutCandidates(extraction.candidates);
    }
  };
}

module.exports = {
  resolvePrescriptionExtractionMode,
  layoutExtractionErrorCategory,
  isValidatedLayoutCandidate,
  validateLayoutCandidates,
  medicineTextFor,
  explicitCount,
  toFlowCandidate,
  createLayoutExtractionService
};
