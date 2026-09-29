const { structuralMetrics } = require('./documentEvidenceService');
const { extractMedicationCandidates } = require('./prescriptionLayoutExtractorService');

function isLayoutShadowEnabled(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function isLayoutDebugEnabled(environment = process.env) {
  return environment.NODE_ENV !== 'production' && String(environment.PRESCRIPTION_LAYOUT_DEBUG || '').trim().toLowerCase() === 'true';
}

function logDebugCandidates(logger, candidates) {
  candidates.forEach((candidate, index) => {
    logger.log([
      '[PRESCRIPTION SHADOW EXTRACTOR] Candidate ' + (index + 1),
      'Source: ' + (candidate.sourceEvidence?.sourceType || 'null'),
      'Confidence: ' + (candidate.extractionConfidence?.level || 'null'),
      'Score: ' + (candidate.extractionConfidence?.score ?? 'null'),
      'Medicine name: ' + (candidate.medicineName || 'null'),
      'Strength: ' + (candidate.strength || 'null'),
      'Dosage form: ' + (candidate.dosageForm || 'null'),
      'Quantity: ' + (candidate.quantity || 'null'),
      'Instructions: ' + (candidate.instructions || 'null'),
      'Raw text: ' + (candidate.rawText || 'null'),
      'Signals: ' + ((candidate.extractionConfidence?.signals || []).join(', ') || 'none')
    ].join('\n'));
  });
}

function layoutErrorCategory(error) {
  const code = String(error?.code || '').toUpperCase();
  return code.startsWith('AZURE_') ? code : 'LAYOUT_FAILED';
}

function createLayoutShadowRunner(options = {}) {
  const enabled = Boolean(options.enabled);
  const client = options.client;
  const logger = options.logger || console;
  const extractor = options.extractor || extractMedicationCandidates;
  const debugEnabled = Boolean(options.debugEnabled);

  return async function runLayoutShadow(imagePath) {
    if (!enabled || !client) return null;

    const startedAt = Date.now();
    logger.log('[PRESCRIPTION SHADOW] layout started');
    try {
      const evidence = await client.analyze(imagePath);
      const metrics = structuralMetrics(evidence);
      logger.log('[PRESCRIPTION SHADOW] layout succeeded');
      logger.log(`[PRESCRIPTION SHADOW] duration: ${Date.now() - startedAt}ms`);
      logger.log(`[PRESCRIPTION SHADOW] pages: ${metrics.pages}`);
      logger.log(`[PRESCRIPTION SHADOW] lines: ${metrics.lines}`);
      logger.log(`[PRESCRIPTION SHADOW] words: ${metrics.words}`);
      logger.log(`[PRESCRIPTION SHADOW] tables: ${metrics.tables}`);
      logger.log(`[PRESCRIPTION SHADOW] paragraphs: ${metrics.paragraphs}`);
      logger.log('[PRESCRIPTION SHADOW EXTRACTOR] started');
      try {
        const extractionStartedAt = Date.now();
        const extraction = extractor(evidence);
        const extractionMetrics = extraction.metrics;
        logger.log('[PRESCRIPTION SHADOW EXTRACTOR] candidates: ' + extractionMetrics.candidates);
        logger.log('[PRESCRIPTION SHADOW EXTRACTOR] highConfidence: ' + extractionMetrics.highConfidence);
        logger.log('[PRESCRIPTION SHADOW EXTRACTOR] mediumConfidence: ' + extractionMetrics.mediumConfidence);
        logger.log('[PRESCRIPTION SHADOW EXTRACTOR] lowConfidence: ' + extractionMetrics.lowConfidence);
        logger.log('[PRESCRIPTION SHADOW EXTRACTOR] tableDerived: ' + extractionMetrics.tableDerived);
        logger.log('[PRESCRIPTION SHADOW EXTRACTOR] geometryDerived: ' + extractionMetrics.geometryDerived);
        logger.log('[PRESCRIPTION SHADOW EXTRACTOR] duration: ' + (Date.now() - extractionStartedAt) + 'ms');
        if (debugEnabled) logDebugCandidates(logger, extraction.candidates || []);
      } catch {
        logger.error('[PRESCRIPTION SHADOW EXTRACTOR] failed category=EXTRACTION_FAILED');
      }
      return evidence;
    } catch (error) {
      logger.error(`[PRESCRIPTION SHADOW] layout failed category=${layoutErrorCategory(error)} durationMs=${Date.now() - startedAt}`);
      return null;
    }
  };
}

module.exports = {
  isLayoutShadowEnabled,
  isLayoutDebugEnabled,
  layoutErrorCategory,
  createLayoutShadowRunner
};
