const NON_MEDICINE = /\b(?:clinic|polyclinic|hospital|health\s*(?:care|centre|center)|medical\s*(?:centre|center)|doctor|physician|gynecolog|\bdr\.?|mbbs|bams|\bmd\b|registration|reg\.?\s*(?:no|number)|phone|mobile|tel\b|address|street|road|lane|district|pincode|pin\s*code|patient|age|gender|date|consult|follow[- ]?up|next\s+visit|bring\s+(?:the\s+)?prescription|signature|footer|diagnos|advice|notes?|general\s+physician|opd|morning|night|before\s+food|after\s+food|twice\s+daily|once\s+daily|\bph\b|dose|dosage|duration|directions?|frequency|route|instructions?)\b/i;
const FORM_METADATA = /\b(?:do\s+not\s+refill|refill|times|sign|m\.?\s*d\.?|dea\s*(?:number|no\.?|#)?|print\s+last\s+name|last\s+name)\b/i;
const STANDALONE_DOSAGE_FORM = /^\s*\(?\s*(?:tablet|capsule|tab|cap|syrup|suspension|injection|drops?|ointment|cream|gel|inhaler|vial|ampoule)s?\s*\)?\s*$/i;
const MEDICINE_SIGNAL = /\b\d+(?:\.\d+)?\s*(?:mg|mcg|µg|g|ml|iu|%)(?:\b|\/)|\b(?:tab(?:let)?s?|cap(?:sule)?s?|syrup|suspension|injection|drops?|ointment|cream|gel|inhaler|vial|ampoule)\b/i;
const RX_MARKER = /^\s*(?:rx|℞|medicines?|treatment)\b/i;

function trimLayoutArtifacts(value) {
  return String(value || '')
    .trim()
    .replace(/^[|:;]+\s*/, '')
    .replace(/\s*[|:;]+$/, '')
    .trim();
}

function normaliseLines(text, ocrLines) {
  if (Array.isArray(ocrLines) && ocrLines.length) {
    return ocrLines
      .filter(line => line && typeof line.text === 'string')
      .map(line => ({ text: line.text.trim(), box: line.box }))
      .filter(line => line.text)
      .sort((left, right) => {
        const leftY = Array.isArray(left.box) ? left.box[1] : Number.MAX_SAFE_INTEGER;
        const rightY = Array.isArray(right.box) ? right.box[1] : Number.MAX_SAFE_INTEGER;
        const leftX = Array.isArray(left.box) ? left.box[0] : 0;
        const rightX = Array.isArray(right.box) ? right.box[0] : 0;
        return leftY - rightY || leftX - rightX;
      });
  }
  return String(text || '').split(/\r?\n/).map(line => ({ text: line.trim() })).filter(line => line.text);
}

function cleanCandidate(line) {
  const withoutDirections = String(line || '')
    .replace(/^\s*(?:rx|℞)\s*[:.-]?\s*/i, '')
    .replace(/^\s*\d+[.)-]\s*/, '')
    .replace(/\b(?:take|sig|directions?)\b.*$/i, '');

  return trimLayoutArtifacts(withoutDirections)
    .replace(/\s+/g, ' ')
    .trim();
}

function isPlausibleMedicine(line, inMedicineSection, isNumberedRow) {
  if (!line || line.length < 3 || line.length > 100 || !/[a-z]/i.test(line)) return false;
  if (STANDALONE_DOSAGE_FORM.test(line) || FORM_METADATA.test(line)) return false;
  if (NON_MEDICINE.test(line) || /\b\d{5,}\b/.test(line)) return false;
  const words = line.split(/\s+/).filter(Boolean);
  const hasSignal = MEDICINE_SIGNAL.test(line) || isNumberedRow;
  // A row below an Rx marker may be a handwritten medicine without strength;
  // elsewhere require a dosage/form signal or a short, medicine-like row.
  if (!inMedicineSection && !hasSignal && words.length > 4) return false;
  if (!inMedicineSection && !hasSignal && words.length < 2) return false;
  return true;
}

function splitPrescribedQuantity(rawText) {
  const parts = rawText.split(/\s*\|\s*/);
  if (parts.length < 2) return { medicineText: trimLayoutArtifacts(rawText), prescribedQuantityText: null };
  const last = parts[parts.length - 1].trim();
  if (!/^\d+(?:\.\d+)?\s*(?:tablets?|tabs?|capsules?|caps?|ml|vials?|ampoules?|drops?|sachets?|units?)\b/i.test(last)) {
    return { medicineText: trimLayoutArtifacts(rawText), prescribedQuantityText: null };
  }
  return { medicineText: trimLayoutArtifacts(parts.slice(0, -1).join(' | ')), prescribedQuantityText: last };
}

function extractMedicineCandidates(text, ocrLines = []) {
  const medicines = [];
  const lines = normaliseLines(text, ocrLines);
  let inMedicineSection = false;

  for (const record of lines) {
    const original = record.text;
    if (RX_MARKER.test(original)) {
      inMedicineSection = true;
      continue;
    }
    const candidate = cleanCandidate(original);
    const isNumberedRow = /^\s*\d+[.)-]\s*/.test(original);
    if (!isPlausibleMedicine(candidate, inMedicineSection, isNumberedRow)) continue;
    const parsed = splitPrescribedQuantity(candidate);
    if (!parsed.medicineText) continue;
    medicines.push({ rawText: candidate, ...parsed });
  }
  const seen = new Set();
  return medicines.filter(candidate => {
    if (seen.has(candidate.medicineText)) return false;
    seen.add(candidate.medicineText);
    return true;
  });
}

function extractMedicines(text, ocrLines = []) {
  return extractMedicineCandidates(text, ocrLines).map(candidate => candidate.medicineText);
}

function extractPatientName(text) {
  const match = String(text || '').match(/Patient Name:\s*(.+?)\s+Date:/i);
  return match ? trimLayoutArtifacts(match[1]) : null;
}

module.exports = { extractMedicineCandidates, extractMedicines, extractPatientName };
