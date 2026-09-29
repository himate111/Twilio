const FORM_TERMS = [
  'tablet', 'capsule', 'syrup', 'suspension', 'solution', 'drops', 'spray',
  'inhaler', 'cream', 'ointment', 'gel', 'powder', 'sachet', 'injection'
];

const STRENGTH_PATTERN = /\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|kg|iu|units?|%)(?:\s*\/\s*\d+(?:\.\d+)?\s*(?:ml|l))?\b/i;
const PACKAGE_PATTERN = /\(\s*\d+(?:\.\d+)?\s*(?:ml|l|g|mg|mcg|tablets?|capsules?|sachets?)\s*\)/i;
const QUANTITY_PATTERN = /\b(?:qty|quantity|no\.?|#)\s*[:=-]?\s*(\d+(?:\.\d+)?\s*(?:tablets?|capsules?|bottles?|sachets?|packs?|ml|g|mg)?)/i;

function normaliseText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function polygonBounds(polygon) {
  if (!Array.isArray(polygon) || polygon.length < 8) return null;
  const xs = polygon.filter((_, index) => index % 2 === 0).map(Number);
  const ys = polygon.filter((_, index) => index % 2 === 1).map(Number);
  if (!xs.every(Number.isFinite) || !ys.every(Number.isFinite)) return null;
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
}

function sourceLine(page, line, lineIndex) {
  return {
    kind: 'line', pageNumber: page.pageNumber, lineIndex,
    spans: Array.isArray(line.spans) ? line.spans : [], polygon: line.polygon || null
  };
}

function sourceCell(table, tableIndex, cell, cellIndex) {
  return {
    kind: 'tableCell', tableIndex, cellIndex, rowIndex: cell.rowIndex, columnIndex: cell.columnIndex,
    spans: Array.isArray(cell.spans) ? cell.spans : [], boundingRegions: Array.isArray(cell.boundingRegions) ? cell.boundingRegions : []
  };
}

function emptyFieldEvidence() {
  return { medicineName: [], strength: [], dosageForm: [], quantity: [], instructions: [] };
}

function hasForm(text) {
  const lower = normaliseText(text).toLowerCase();
  return FORM_TERMS.find(term => new RegExp(`\\b${term}s?\\b`, 'i').test(lower)) || null;
}

function extractTextMatch(text, pattern) {
  const match = normaliseText(text).match(pattern);
  return match ? normaliseText(match[0]) : null;
}

function hasOrdinalMarker(text) {
  return /^\s*\d+\s*[.)]\s*/.test(normaliseText(text));
}

function stripOrdinalMarker(text) {
  return normaliseText(text).replace(/^\s*\d+\s*[.)]\s*/, '');
}

function hasDosePrefix(text) {
  return /^\s*\d+(?:\.\d+)?\s*(?:tablets?|capsules?|ml|l|puffs?|drops?|sprays?|sachets?)\b/i.test(normaliseText(text));
}

function hasAdministrationDose(text) {
  return /^\s*(?:\d+(?:\.\d+)?|one|an?|i)\s*(?:tablets?|tabs?|capsules?|caps?|ml|l|puffs?|drops?|sprays?|sachets?)\b/i.test(normaliseText(text));
}

function hasAdministrationContext(text) {
  return /\b(?:once|twice|thrice|daily|every|times?\s+(?:a|per)?\s*day|morning|afternoon|evening|night|bedtime|before|after|with|as\s+needed|when\s+required|prn|sos|tid|bid|od|bd|q\d+h)\b/i.test(normaliseText(text));
}

function isInstructionLike(text) {
  const value = normaliseText(text);
  if (!value) return false;
  const digitCount = (value.match(/\d/g) || []).length;
  const schedule = /\d+\s*[-/]\s*\d+(?:\s*[-/]\s*\d+){1,}/.test(value);
  const duration = /(?:\bx\b|×)\s*\d+\s*(?:day|days|week|weeks|month|months)\b/i.test(value);
  const administrationSyntax = hasAdministrationDose(value) && hasAdministrationContext(value);
  return administrationSyntax || (digitCount > 0 && (schedule || duration || (hasDosePrefix(value) && !STRENGTH_PATTERN.test(value))));
}

function hasGeometryIdentitySignal(text) {
  const value = stripOrdinalMarker(text);
  if (!value || isInstructionLike(value)) return false;
  if (extractTextMatch(value, STRENGTH_PATTERN) || PACKAGE_PATTERN.test(value)) return true;
  if (!hasForm(value)) return false;
  const withoutForm = FORM_TERMS.reduce((current, term) => current.replace(new RegExp('\\b' + term + 's?\\b', 'ig'), ' '), value);
  return Boolean(normaliseText(withoutForm.replace(/[|,;]+/g, ' ')));
}

function isFormPackageContinuation(text) {
  const value = stripOrdinalMarker(text);
  if (STRENGTH_PATTERN.test(value)) return false;
  const withoutPackage = value.replace(PACKAGE_PATTERN, ' ');
  const withoutForm = FORM_TERMS.reduce((current, term) => current.replace(new RegExp('\\b' + term + 's?\\b', 'ig'), ' '), withoutPackage);
  return Boolean(hasForm(value) || PACKAGE_PATTERN.test(value)) && !normaliseText(withoutForm.replace(/[|,;]+/g, ' '));
}

function deriveMedicineName(identityText) {
  const withoutStrength = stripOrdinalMarker(identityText).replace(STRENGTH_PATTERN, ' ');
  const withoutPackage = withoutStrength.replace(PACKAGE_PATTERN, ' ');
  const withoutQuantity = withoutPackage.replace(QUANTITY_PATTERN, ' ');
  const withoutForm = FORM_TERMS.reduce((text, term) => text.replace(new RegExp(`\\b${term}s?\\b`, 'ig'), ' '), withoutQuantity);
  const result = normaliseText(withoutForm.replace(/[|,;]+/g, ' '));
  return result || null;
}

function formValue(text) {
  const form = hasForm(text);
  return form ? form.charAt(0).toUpperCase() + form.slice(1).toLowerCase() : null;
}

function quantityValue(text) {
  const explicit = extractTextMatch(text, QUANTITY_PATTERN);
  if (explicit) return normaliseText(explicit.replace(/^(?:qty|quantity|no\.?|#)\s*[:=-]?\s*/i, ''));
  return extractTextMatch(text, PACKAGE_PATTERN);
}

function makeCandidate(parts, sourceType, confidence) {
  const allText = parts.map(part => part.text).filter(Boolean).join(' ');
  const identityParts = parts.filter(part => !part.instruction);
  const instructionParts = parts.filter(part => part.instruction);
  const identityText = identityParts.map(part => part.text).join(' ');
  const rawText = normaliseText(allText) || null;
  if (!rawText || !identityText) return null;

  const fieldEvidence = emptyFieldEvidence();
  identityParts.forEach(part => {
    fieldEvidence.medicineName.push(part.source);
    if (extractTextMatch(part.text, STRENGTH_PATTERN)) fieldEvidence.strength.push(part.source);
    if (formValue(part.text)) fieldEvidence.dosageForm.push(part.source);
    if (quantityValue(part.text)) fieldEvidence.quantity.push(part.source);
  });
  instructionParts.forEach(part => fieldEvidence.instructions.push(part.source));

  return {
    rawText,
    sourceEvidence: { sourceType, references: parts.map(part => part.source) },
    fieldEvidence,
    medicineName: deriveMedicineName(identityText),
    strength: identityParts.map(part => extractTextMatch(part.text, STRENGTH_PATTERN)).find(Boolean) || null,
    dosageForm: identityParts.map(part => formValue(part.text)).find(Boolean) || null,
    quantity: identityParts.map(part => quantityValue(part.text)).find(Boolean) || null,
    instructions: instructionParts.length ? normaliseText(instructionParts.map(part => part.text).join(' ')) : null,
    extractionConfidence: confidence
  };
}

function confidence(score, signals) {
  const bounded = Math.max(0, Math.min(1, Number(score.toFixed(2))));
  return { score: bounded, level: bounded >= 0.8 ? 'high' : bounded >= 0.6 ? 'medium' : 'low', signals };
}

function tableHeaderSemantic(text) {
  const value = normaliseText(text).toLowerCase();
  if (!value) return null;
  const matches = [];
  if (/^(?:s(?:erial)?\.?\s*(?:no\.?)?|sr\.?\s*(?:no\.?)?|#)$/.test(value)) matches.push('ordinal');
  if (/\b(?:medicine|medication|drug|item)(?:\s+name)?\b/.test(value)) matches.push('medicineName');
  if (/\b(?:strength|potency|concentration)\b/.test(value)) matches.push('strength');
  if (/\b(?:dosage\s*form|form|presentation)\b/.test(value)) matches.push('dosageForm');
  if (/\b(?:quantity|qty|pack(?:age)?(?:\s*size)?|no\.?\s+of)\b/.test(value)) matches.push('quantity');
  if (/\b(?:instructions?|directions?|frequency|schedule|administration|usage)\b/.test(value)) matches.push('instructions');
  return matches.length === 1 ? matches[0] : null;
}

function inferTableColumns(populatedRows) {
  let best = null;
  populatedRows.forEach(([rowIndex, cells]) => {
    const mappings = cells.map(cell => ({ columnIndex: cell.columnIndex, semantic: tableHeaderSemantic(cell.text) })).filter(mapping => mapping.semantic);
    const uniqueSemantics = new Set(mappings.map(mapping => mapping.semantic));
    if (uniqueSemantics.size < 2) return;
    if (!best || uniqueSemantics.size > best.mappings.length) best = { rowIndex, mappings };
  });
  if (!best) return null;

  const duplicateSemantics = best.mappings.reduce((counts, mapping) => counts.set(mapping.semantic, (counts.get(mapping.semantic) || 0) + 1), new Map());
  const columns = {};
  best.mappings.forEach(mapping => {
    if (duplicateSemantics.get(mapping.semantic) === 1) columns[mapping.semantic] = mapping.columnIndex;
  });
  return { headerRowIndex: best.rowIndex, columns };
}

function cellForColumn(cells, columnIndex) {
  return Number.isInteger(columnIndex) ? cells.find(cell => cell.columnIndex === columnIndex) || null : null;
}

function directCellValue(cell) {
  return cell ? normaliseText(cell.text) || null : null;
}

function mappedTableCandidate(ordered, tableMapping, tableIndex, hasIdentitySignal, repeatedStructure) {
  const rawText = normaliseText(ordered.map(cell => cell.text).join(' ')) || null;
  if (!rawText) return null;
  const medicineCell = cellForColumn(ordered, tableMapping.columns.medicineName);
  const strengthCell = cellForColumn(ordered, tableMapping.columns.strength);
  const formCell = cellForColumn(ordered, tableMapping.columns.dosageForm);
  const quantityCell = cellForColumn(ordered, tableMapping.columns.quantity);
  const instructionsCell = cellForColumn(ordered, tableMapping.columns.instructions);
  const medicineName = directCellValue(medicineCell);
  if (!medicineName && !hasIdentitySignal) return null;

  const fieldEvidence = emptyFieldEvidence();
  if (medicineCell) fieldEvidence.medicineName.push(medicineCell.source);
  if (strengthCell) fieldEvidence.strength.push(strengthCell.source);
  if (formCell) fieldEvidence.dosageForm.push(formCell.source);
  if (quantityCell) fieldEvidence.quantity.push(quantityCell.source);
  if (instructionsCell) fieldEvidence.instructions.push(instructionsCell.source);

  return {
    rawText,
    sourceEvidence: { sourceType: 'table', references: ordered.map(cell => cell.source) },
    fieldEvidence,
    medicineName,
    strength: directCellValue(strengthCell),
    dosageForm: directCellValue(formCell),
    quantity: directCellValue(quantityCell),
    instructions: directCellValue(instructionsCell),
    extractionConfidence: confidence(
      0.55 + (hasIdentitySignal ? 0.2 : 0) + (ordered.length >= 2 ? 0.1 : 0) + (repeatedStructure ? 0.1 : 0),
      ['tableRow', 'headerMapped', ...(hasIdentitySignal ? ['identitySignal'] : []), ...(repeatedStructure ? ['repeatedStructure'] : [])]
    )
  };
}

function extractTableCandidates(evidence) {
  const candidates = [];
  (evidence.tables || []).forEach((table, tableIndex) => {
    const rows = new Map();
    (table.cells || []).forEach((cell, cellIndex) => {
      if (!Number.isInteger(cell.rowIndex)) return;
      const text = normaliseText(cell.text);
      if (!text) return;
      const row = rows.get(cell.rowIndex) || [];
      row.push({ text, columnIndex: Number.isInteger(cell.columnIndex) ? cell.columnIndex : cellIndex, source: sourceCell(table, tableIndex, cell, cellIndex) });
      rows.set(cell.rowIndex, row);
    });
    const populatedRows = [...rows.entries()].sort(([a], [b]) => a - b);
    const repeatedStructure = populatedRows.filter(([, cells]) => cells.length >= 2).length >= 2;
    const tableMapping = inferTableColumns(populatedRows);

    populatedRows.forEach(([rowIndex, cells]) => {
      if (tableMapping && rowIndex === tableMapping.headerRowIndex) return;
      const ordered = cells.sort((a, b) => a.columnIndex - b.columnIndex);
      const rowText = ordered.map(cell => cell.text).join(' ');
      const hasIdentitySignal = Boolean(extractTextMatch(rowText, STRENGTH_PATTERN) || hasForm(rowText) || PACKAGE_PATTERN.test(rowText));
      if (tableMapping) {
        const candidate = mappedTableCandidate(ordered, tableMapping, tableIndex, hasIdentitySignal, repeatedStructure);
        if (candidate) candidates.push(candidate);
        return;
      }

      if (!hasIdentitySignal) return;
      const parts = ordered.map(cell => ({ ...cell, instruction: isInstructionLike(cell.text) }));
      const nonInstructions = parts.filter(part => !part.instruction);
      if (!nonInstructions.length) return;
      const candidate = makeCandidate(parts, 'table', confidence(
        0.55 + (hasIdentitySignal ? 0.2 : 0) + (ordered.length >= 2 ? 0.1 : 0) + (repeatedStructure ? 0.1 : 0),
        ['tableRow', ...(hasIdentitySignal ? ['identitySignal'] : []), ...(repeatedStructure ? ['repeatedStructure'] : [])]
      ));
      if (candidate) candidates.push(candidate);
    });
  });
  return candidates;
}

function isWithinTable(bounds, pageNumber, tables) {
  if (!bounds) return false;
  return tables.some(table => (table.boundingRegions || []).some(region => {
    const tableBounds = polygonBounds(region.polygon);
    if (!tableBounds || region.pageNumber === null || region.pageNumber !== pageNumber) return false;
    const centerX = (bounds.left + bounds.right) / 2;
    const centerY = (bounds.top + bounds.bottom) / 2;
    return centerX >= tableBounds.left && centerX <= tableBounds.right && centerY >= tableBounds.top && centerY <= tableBounds.bottom;
  }));
}

function visualRows(page, tables) {
  const lines = (page.lines || []).map((line, lineIndex) => ({
    text: normaliseText(line.text), source: sourceLine(page, line, lineIndex), bounds: polygonBounds(line.polygon), confidence: Number(line.confidence)
  })).filter(line => line.text && line.bounds && !isWithinTable(line.bounds, page.pageNumber, tables));
  const body = lines.filter(line => {
    if (!Number.isFinite(page.height) || page.height <= 0) return true;
    const center = (line.bounds.top + line.bounds.bottom) / 2;
    return center >= page.height * 0.08 && center <= page.height * 0.92;
  }).sort((a, b) => a.bounds.top - b.bounds.top || a.bounds.left - b.bounds.left);
  const rows = [];
  body.forEach(line => {
    const center = (line.bounds.top + line.bounds.bottom) / 2;
    const height = Math.max(1, line.bounds.bottom - line.bounds.top);
    const previous = rows[rows.length - 1];
    if (previous && Math.abs(previous.center - center) <= Math.max(previous.height, height) * 0.7) {
      previous.lines.push(line); previous.center = (previous.center * (previous.lines.length - 1) + center) / previous.lines.length; previous.height = Math.max(previous.height, height);
    } else rows.push({ center, height, lines: [line] });
  });
  return rows.map(row => ({ ...row, lines: row.lines.sort((a, b) => a.bounds.left - b.bounds.left) }));
}

function areNearbyEntryRows(open, row) {
  return Boolean(open) && row.center - open.lastCenter <= Math.max(row.height, open.height) * 6;
}

function extractGeometryCandidates(evidence) {
  const candidates = [];
  (evidence.pages || []).forEach(page => {
    const rows = visualRows(page, evidence.tables || []);
    const anchors = rows.flatMap(row => row.lines
      .filter(line => !isInstructionLike(line.text))
      .map(line => Math.round((line.bounds.left / Math.max(1, page.width || 1)) * 10)));
    const anchorCounts = anchors.reduce((counts, anchor) => counts.set(anchor, (counts.get(anchor) || 0) + 1), new Map());
    const repeatedAnchors = new Set([...anchorCounts.entries()].filter(([, count]) => count >= 2).map(([anchor]) => anchor));
    let open = null;
    let confirmedIdentitySeen = false;

    const flushOpen = () => {
      if (!open) return;
      const candidate = makeCandidate(open.parts, 'geometry', confidence(open.score, open.signals));
      if (candidate) candidates.push(candidate);
      open = null;
    };

    rows.forEach(row => {
      const parts = row.lines.map(line => ({ ...line, instruction: isInstructionLike(line.text) }));
      const identity = parts.filter(part => !part.instruction);
      const instruction = parts.filter(part => part.instruction);
      const left = identity[0] || parts[0];
      const anchor = left ? Math.round((left.bounds.left / Math.max(1, page.width || 1)) * 10) : null;
      const identityText = identity.map(part => part.text).join(' ');
      const hasIdentitySignal = hasGeometryIdentitySignal(identityText);
      const ordinal = identity.some(part => hasOrdinalMarker(part.text));
      const nearby = areNearbyEntryRows(open, row);

      if (identity.length === 0) {
        if (open && instruction.length && nearby) {
          open.parts.push(...instruction);
          open.lastCenter = row.center;
          open.height = Math.max(open.height, row.height);
          open.lastWasInstruction = true;
          open.lastInstructionLeft = instruction[0].bounds.left;
        } else if (open) {
          flushOpen();
        }
        return;
      }

      const formContinuation = identity.length === 1 && isFormPackageContinuation(identityText) && open && nearby;
      if (formContinuation) {
        open.parts.push(...parts);
        open.lastCenter = row.center;
        open.height = Math.max(open.height, row.height);
        open.lastWasInstruction = instruction.length > 0;
        if (instruction.length) open.lastInstructionLeft = instruction[0].bounds.left;
        return;
      }

      if (!hasIdentitySignal && !ordinal && (!repeatedAnchors.has(anchor) || !confirmedIdentitySeen)) {
        const continuationOffset = open && open.lastWasInstruction && nearby && Math.abs(left.bounds.left - open.lastInstructionLeft) <= Math.max(row.height, open.height) * 4;
        if (continuationOffset) {
          open.parts.push(...parts.map(part => ({ ...part, instruction: true })));
          open.lastCenter = row.center;
          open.height = Math.max(open.height, row.height);
          return;
        }
        flushOpen();
        return;
      }

      flushOpen();
      if (hasIdentitySignal || ordinal) confirmedIdentitySeen = true;
      const averageConfidence = identity.reduce((sum, part) => sum + (Number.isFinite(part.confidence) ? part.confidence : 0.5), 0) / identity.length;
      open = {
        parts,
        lastCenter: row.center,
        height: row.height,
        lastWasInstruction: instruction.length > 0,
        lastInstructionLeft: instruction.length ? instruction[0].bounds.left : null,
        score: 0.4 + (hasIdentitySignal ? 0.2 : 0) + (repeatedAnchors.has(anchor) ? 0.12 : 0) + (instruction.length ? 0.08 : 0) + (ordinal ? 0.1 : 0) + ((averageConfidence - 0.5) * 0.2),
        signals: [
          'geometryRow',
          ...(hasIdentitySignal ? ['identitySignal'] : []),
          ...(repeatedAnchors.has(anchor) ? ['alignedSeries'] : []),
          ...(instruction.length ? ['sameRowInstruction'] : []),
          ...(ordinal ? ['ordinalMarker'] : [])
        ]
      };
    });
    flushOpen();
  });
  return candidates;
}

function extractMedicationCandidates(evidence) {
  if (!evidence || !Array.isArray(evidence.pages)) throw new Error('Canonical Layout evidence is required.');
  const tableCandidates = extractTableCandidates(evidence);
  const geometryCandidates = extractGeometryCandidates(evidence);
  const candidates = [...tableCandidates, ...geometryCandidates];
  return { candidates, metrics: summariseExtraction(candidates) };
}

function summariseExtraction(candidates) {
  const list = Array.isArray(candidates) ? candidates : [];
  return {
    candidates: list.length,
    highConfidence: list.filter(candidate => candidate.extractionConfidence?.level === 'high').length,
    mediumConfidence: list.filter(candidate => candidate.extractionConfidence?.level === 'medium').length,
    lowConfidence: list.filter(candidate => candidate.extractionConfidence?.level === 'low').length,
    tableDerived: list.filter(candidate => candidate.sourceEvidence?.sourceType === 'table').length,
    geometryDerived: list.filter(candidate => candidate.sourceEvidence?.sourceType === 'geometry').length
  };
}

function compareCandidateCounts(existingParserCandidates, layoutExtraction) {
  const parserCount = Array.isArray(existingParserCandidates) ? existingParserCandidates.length : Number.isInteger(existingParserCandidates) ? existingParserCandidates : null;
  const layoutCount = Array.isArray(layoutExtraction?.candidates) ? layoutExtraction.candidates.length : Number.isInteger(layoutExtraction) ? layoutExtraction : null;
  return { existingParserCandidates: parserCount, layoutExtractorCandidates: layoutCount };
}

module.exports = { extractMedicationCandidates, summariseExtraction, compareCandidateCounts };
