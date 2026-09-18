// Categorized patterns for generic clinical and prescription document noise

// Headers, Clinics, Hospitals, Institutions
const HEADER_INSTITUTION = /\b(?:clinic|polyclinic|hospital|health\s*(?:care|centre|center)|medical\s*(?:centre|center|college)|institute|institution|research\s*(?:centre|center)|dispensary|sanatorium|nursing\s*home|trust|foundation|charitable)\b/i;

// Addresses, Locations, Contact details
const ADDRESS_CONTACT = /\b(?:address|street|road|lane|cross|layout|block|sector|nagar|nagara|district|taluk|state|pincode|pin\s*code|postal|po\s*box)\b|\b\d{3}\s*\d{3}\b|\b(?:phone|mobile|tel\b|telephone|fax|email)\s*[:.-]?\s*\d+/i;

// Patient demographics and administrative identifiers
const PATIENT_METADATA = /^\s*(?:name|pt\.?\s*name|patient(?:\s*name)?)\s*[:/.-]|\b(?:uhid|ipd?|opd|mrn|patient\s*id|registration|reg\.?\s*(?:no|number)|bed\s*(?:no|number)|ward\s*(?:no|number)|room\s*(?:no|number))\b|\b(?:age|yrs?|years?|gender|sex|dob|date\s*of\s*birth)\s*[:/.-]|\b\d+\s*(?:yrs?|years?|months?)\s*[/,-]?\s*(?:m|f|male|female)\b|\b(?:date|dated|doa|dod|dt)\s*[:/.-]/i;

// Symptoms, Complaints, Diagnoses, Clinical observations
const CLINICAL_OBSERVATIONS = /^\s*(?:c\/o|complaints?(?:\s*of)?|symptoms?|history(?:\s*of)?|h\/o|chief\s*complaint|diagnos(?:is|ed)?|provisional\s*diagnosis|impression|findings?|o\/e|on\s*examination|general\s*exam|clinical\s*notes?)\b|\b(?:symptoms?|complaints?|diagnos(?:is|ed)?)\b/i;

// Vitals and physical examination values
const VITALS_PATTERNS = /^\s*vitals?\b|\b(?:bp|blood\s*pressure)\s*[:/=-]?\s*\d{2,3}\s*[/]\s*\d{2,3}|\b(?:pulse(?:\s*rate)?|pr\b|heart\s*rate|hr\b)\s*[:/=-]?\s*\d{2,3}|\b(?:temp(?:\.|erature)?)\s*[:/=-]?\s*\d{2,3}(?:\.\d+)?|\bspo2\s*[:/=-]?\s*\d{1,3}%?|\b(?:height|ht|weight|wt|bmi)\s*[:/=-]?\s*\d+/i;

// Clinical advice, diet, non-pharmacological directions
const CLINICAL_ADVICE = /\b(?:adequate\s+fluid\s+intake|plenty\s+of\s+fluids?|fluid\s+intake|drink\s+(?:plenty|more|water)|hydration|diet|dietary|healthy\s+diet|bland\s+diet|soft\s+diet|bed\s*rest|rest\s+well|take\s+rest|avoid\s+(?:spicy|oily|sugar|salt|cold)|regular\s+exercise|walk(?:ing)?|follow[- ]?up|review\s+(?:after|in)|sos\s+only|refer(?:ral)?(?:\s+to)?|bring\s+(?:the\s+)?prescription|consult)\b/i;

// Doctor credentials, signatures, and footer markers
const PRESCRIBER_IDENTITY = /^\s*(?:dr\.?|doctor|physician|prescriber|consultant)\s*[:.-]?\s+[a-z]/i;
const DOCTOR_FOOTER = /\b(?:dr\.?|doctor|physician|surgeon|consultant|specialist|prescriber|general\s+physician|consultant\s+physician|gynecolog\w*|pediatric\w*|cardiolog\w*|mbbs|m\.b\.b\.s\.?|md\b|m\.d\.?|ms\b|m\.s\.?|dnb|frcs|mrcp|bams|bhms|bpt|bds|mds|reg(?:istration)?\s*(?:no|number)?\.?\s*[:.-]?\s*[a-z0-9\s/]+|medical\s+council|sign(?:ature)?|seal|stamp|footer|page\s*\d+\s*(?:of|\/)\s*\d+)\b/i;

const NON_MEDICINE = /\b(?:clinic|polyclinic|hospital|health\s*(?:care|centre|center)|medical\s*(?:centre|center)|doctor|physician|prescriber|consultant|gynecolog|\bdr\.?|mbbs|bams|\bmd\b|registration|reg\.?\s*(?:no|number)|phone|mobile|tel\b|address|street|road|lane|district|pincode|pin\s*code|patient|age|gender|date|consult|follow[- ]?up|next\s+visit|bring\s+(?:the\s+)?prescription|signature|footer|diagnos|advice|notes?|general\s+physician|opd|morning|night|before\s+food|after\s+food|twice\s+daily|once\s+daily|\bph\b|dose|dosage|duration|directions?|frequency|route|instructions?)\b/i;
const FORM_METADATA = /\b(?:do\s+not\s+refill|refill|times|sign|m\.?\s*d\.?|dea\s*(?:number|no\.?|#)?|print\s+last\s+name|last\s+name)\b/i;
const STANDALONE_DOSAGE_FORM = /^\s*\(?\s*(?:tablet|capsule|tab|cap|syrup|suspension|injection|drops?|ointment|cream|gel|inhaler|vial|ampoule|sachet)s?\s*\)?\s*$/i;
const MEDICINE_SIGNAL = /\b\d+(?:\.\d+)?\s*(?:mg|mcg|µg|g|ml|iu|%)(?:\b|\/)|\b(?:tab(?:let)?s?|cap(?:sule)?s?|syrup|suspension|injection|drops?|ointment|cream|gel|inhaler|vial|ampoule|sachets?)\b/i;
const RX_MARKER = /^\s*(?:rx|℞|medicines?|treatment)\b/i;
const SECTION_END_MARKER = /^\s*(?:advice|instructions?|notes?|plan|general\s+instructions?|dietary\s+advice|follow[- ]?up|review(?:\s+after)?|signature|sign|dr\.?|doctor|physician|prescriber|consultant)\s*[:.-]?\b/i;

// Strong footer / prescription termination markers (refill block, signature block, DEA, last name)
const FOOTER_START_MARKER = /^\s*(?:do\s+not\s+refill|refill\b|times\b|\(?sign(?:ature)?\)?\b|m\.?\s*d\.?|d\.?o\.?|dea\s*(?:number|no\.?|#)?|print\s+(?:last\s+)?name|prescriber\s*(?:name|signature)?|doctor'?s?\s*(?:name|signature)?|physician\s*(?:name|signature)?)\b/i;

// Standalone form metadata labels that precede their values on the next line
const METADATA_LABEL_STANDALONE = /^\s*(?:dea\s*(?:number|no\.?|#)?|print\s+(?:last\s+)?name|prescriber\s*(?:signature|name)?|physician\s*(?:signature|name)?|doctor'?s?\s*(?:signature|name)?|dr\.?|\(?sign(?:ature)?\)?|m\.?\s*d\.?|d\.?o\.?|refill\b|do\s+not\s+refill|times\b|uhid|mrn|opd|ipd?|patient\s*id|registration|reg(?:\.|istration)?\s*(?:no|number)?|date|dated)\s*[:.-]?\s*$/i;

const ROUTE_FORM_PREFIX = /^\s*(?:ivf?|inj(?:ection)?|tab(?:let)?s?|cap(?:sule)?s?|syr(?:up)?|oint(?:ment)?|drops?|susp(?:ension)?|infusion)\s*[:.-]\s*/i;

function trimLayoutArtifacts(value) {
  return String(value || '')
    .trim()
    .replace(/^[|:;]+\s*/, '')
    .replace(/\s*[|:;]+$/, '')
    .trim();
}

// Strong unambiguous footer form anchors
const FOOTER_ANCHOR_PATTERNS = [
  /\bdo\s+not\s+refill\b/i,
  /\brefill\b/i,
  /\(?sign(?:ature)?\)?\b/i,
  /\bprescriber\s*(?:signature|name)?\b/i,
  /\bdoctor'?s?\s*(?:signature|name)?\b/i,
  /\bphysician\s*(?:signature|name)?\b/i,
  /\bconsultant\b/i,
  /\bdr\.?\s+[a-z]/i,
  /^\s*dr\.?\s*[:.-]?\s*$/i,
  /\b(?:mbbs|m\.b\.b\.s|dnb|frcs|bams|bhms)\b/i,
  /\bgeneral\s+physician\b/i,
  /\breg(?:istration)?\.?\s*(?:no|number)?\b/i,
  /\bdea\s*(?:number|no\.?|#)?\b/i,
  /\bprint\s+(?:last\s+)?name\b/i
];

function analyzeFooterGeometry(ocrLines) {
  if (!Array.isArray(ocrLines) || !ocrLines.length) return null;

  const boxed = ocrLines.filter(line =>
    line &&
    Array.isArray(line.box) &&
    line.box.length === 4 &&
    line.box.every(n => typeof n === 'number' && !isNaN(n)) &&
    typeof line.text === 'string' &&
    line.text.trim()
  );

  if (!boxed.length) return null;

  const minX = Math.min(...boxed.map(l => l.box[0]));
  const maxX = Math.max(...boxed.map(l => l.box[2]));
  const pageWidth = maxX - minX;
  const midX = minX + pageWidth / 2;

  // Find all boxes that match strong footer anchor patterns
  const footerAnchors = boxed.filter(line => {
    const t = line.text.trim();
    return FOOTER_ANCHOR_PATTERNS.some(p => p.test(t));
  });

  if (!footerAnchors.length) return null;

  const isMedicineOrDirection = (line) => {
    const t = line.text.trim();
    const isNumbered = /^\s*\d+[.)-]\s*/.test(t);
    return isNumbered || MEDICINE_SIGNAL.test(t) || isDirectionOrQuantityLine(t);
  };

  const getCutoffForAnchors = (anchors) => {
    if (!anchors.length) return null;
    const topmostY = Math.min(...anchors.map(a => a.box[1]));
    const nearby = anchors.filter(a => a.box[1] <= topmostY + 50);
    const bandTop = Math.min(...nearby.map(a => a.box[1]));
    const bandBottom = Math.max(...nearby.map(a => a.box[3]));

    const overlapping = boxed.filter(line => {
      if (isMedicineOrDirection(line)) return false;
      const [, y1, , y2] = line.box;
      return Math.max(y1, bandTop) < Math.min(y2, bandBottom);
    });

    return Math.min(bandTop, ...overlapping.map(b => b.box[1]));
  };

  const leftAnchors = footerAnchors.filter(a => (a.box[0] + a.box[2]) / 2 < midX);
  const rightAnchors = footerAnchors.filter(a => (a.box[0] + a.box[2]) / 2 >= midX);
  const wideAnchors = footerAnchors.filter(a => (a.box[2] - a.box[0]) > pageWidth * 0.4);

  const globalCutoff = getCutoffForAnchors(footerAnchors);
  const leftCutoff = getCutoffForAnchors(leftAnchors);
  const rightCutoff = getCutoffForAnchors(rightAnchors);

  return {
    footerAnchors,
    footerCutoffY: globalCutoff,
    isWide: wideAnchors.length > 0,
    midX,
    leftCutoff,
    rightCutoff
  };
}

function detectFooterCutoffY(ocrLines) {
  const analysis = analyzeFooterGeometry(ocrLines);
  return analysis ? analysis.footerCutoffY : null;
}

function clusterOcrLinesIntoRows(ocrLines, footerAnalysis = null) {
  if (!Array.isArray(ocrLines) || !ocrLines.length) return [];

  const valid = ocrLines
    .filter(line => line && typeof line.text === 'string' && line.text.trim())
    .map(line => {
      const text = line.text.trim();
      const box = Array.isArray(line.box) && line.box.length === 4 && line.box.every(n => typeof n === 'number' && !isNaN(n))
        ? line.box
        : null;
      return { text, box, confidence: line.confidence };
    });

  if (!valid.length) return [];

  const boxed = valid.filter(l => l.box);
  if (boxed.length !== valid.length) {
    const cutoffY = typeof footerAnalysis === 'number' ? footerAnalysis : footerAnalysis?.footerCutoffY;
    return valid.map(l => ({
      text: l.text,
      box: l.box,
      isFooter: cutoffY !== null && l.box && l.box[1] >= cutoffY - 2
    }));
  }

  // Calculate tolerance based on median height
  const heights = boxed
    .map(l => Math.max(1, l.box[3] - l.box[1]))
    .sort((a, b) => a - b);
  const medianHeight = heights[Math.floor(heights.length / 2)] || 15;
  const tolerance = Math.max(8, medianHeight * 0.45);

  // Sort by vertical center, then left X
  const sorted = [...boxed].sort((a, b) => {
    const centerA = (a.box[1] + a.box[3]) / 2;
    const centerB = (b.box[1] + b.box[3]) / 2;
    return centerA - centerB || a.box[0] - b.box[0];
  });

  const rows = [];
  for (const item of sorted) {
    const center = (item.box[1] + item.box[3]) / 2;
    const matchingRow = rows.find(r => {
      if (Math.abs(r.center - center) > tolerance) return false;

      // Do not merge if one item is a footer/doctor anchor and the other is a definite medicine or direction
      const isDefiniteMed = (t) => /^\s*\d+[.)-]\s*/.test(t) || MEDICINE_SIGNAL.test(t) || isDirectionOrQuantityLine(t);
      const itemIsFooter = FOOTER_ANCHOR_PATTERNS.some(p => p.test(item.text)) || FOOTER_START_MARKER.test(item.text) || DOCTOR_FOOTER.test(item.text);
      const rowHasDefiniteMed = r.items.some(it => isDefiniteMed(it.text));
      if (itemIsFooter && rowHasDefiniteMed) return false;

      const itemIsDefiniteMed = isDefiniteMed(item.text);
      const rowHasFooter = r.items.some(it => FOOTER_ANCHOR_PATTERNS.some(p => p.test(it.text)) || FOOTER_START_MARKER.test(it.text) || DOCTOR_FOOTER.test(it.text));
      if (itemIsDefiniteMed && rowHasFooter) return false;

      return true;
    });

    if (!matchingRow) {
      rows.push({
        center,
        items: [item]
      });
    } else {
      matchingRow.items.push(item);
      matchingRow.center =
        matchingRow.items.reduce((sum, it) => sum + (it.box[1] + it.box[3]) / 2, 0) /
        matchingRow.items.length;
    }
  }

  rows.sort((a, b) => a.center - b.center);

  return rows.map(row => {
    row.items.sort((a, b) => a.box[0] - b.box[0]);
    const text = row.items.map(it => it.text).join(' | ');
    const x1 = Math.min(...row.items.map(it => it.box[0]));
    const y1 = Math.min(...row.items.map(it => it.box[1]));
    const x2 = Math.max(...row.items.map(it => it.box[2]));
    const y2 = Math.max(...row.items.map(it => it.box[3]));

    const candidate = cleanCandidate(text);
    const isNumbered = /^\s*\d+[.)-]\s*/.test(text);
    const isDefiniteMedOrDir = isNumbered || MEDICINE_SIGNAL.test(text) || isDirectionOrQuantityLine(text);

    let isFooter = false;
    if (!isDefiniteMedOrDir && footerAnalysis) {
      if (typeof footerAnalysis === 'number') {
        isFooter = y1 >= footerAnalysis - 2 || row.center >= footerAnalysis;
      } else if (footerAnalysis.isWide) {
        isFooter = footerAnalysis.footerCutoffY !== null && (y1 >= footerAnalysis.footerCutoffY - 2 || row.center >= footerAnalysis.footerCutoffY);
      } else {
        const rowMidX = (x1 + x2) / 2;
        if (rowMidX < footerAnalysis.midX) {
          isFooter = footerAnalysis.leftCutoff !== null && (y1 >= footerAnalysis.leftCutoff - 2 || row.center >= footerAnalysis.leftCutoff);
        } else {
          isFooter = footerAnalysis.rightCutoff !== null && (y1 >= footerAnalysis.rightCutoff - 2 || row.center >= footerAnalysis.rightCutoff);
        }
      }
    }

    return {
      text,
      box: [x1, y1, x2, y2],
      center: row.center,
      isFooter,
      items: row.items
    };
  });
}

function normaliseLines(text, ocrLines) {
  if (Array.isArray(ocrLines) && ocrLines.length) {
    const footerAnalysis = analyzeFooterGeometry(ocrLines);
    return clusterOcrLinesIntoRows(ocrLines, footerAnalysis);
  }
  return String(text || '').split(/\r?\n/).map(line => ({ text: line.trim() })).filter(line => line.text);
}

function cleanCandidate(line) {
  const withoutDirections = String(line || '')
    .replace(/^\s*(?:rx|℞)\s*[:.-]?\s*/i, '')
    .replace(/^\s*\d+[.)-]\s*/, '')
    .replace(ROUTE_FORM_PREFIX, '')
    .replace(/\s*\(\s*(?:tablet|capsule|tab|cap|syrup|suspension|injection|drops?|ointment|cream|gel|inhaler|vial|ampoule|sachet)s?\s*\)/gi, '')
    .replace(/\b(?:take|sig|directions?)\b.*$/i, '');

  return trimLayoutArtifacts(withoutDirections)
    .replace(/\s+/g, ' ')
    .trim();
}

function isNonMedicineLine(line) {
  if (!line || typeof line !== 'string') return true;
  const clean = line.trim();
  if (!clean || clean.length < 2) return true;

  if (PRESCRIBER_IDENTITY.test(clean)) return true;
  if (HEADER_INSTITUTION.test(clean)) return true;
  if (ADDRESS_CONTACT.test(clean)) return true;
  if (PATIENT_METADATA.test(clean)) return true;
  if (CLINICAL_OBSERVATIONS.test(clean)) return true;
  if (VITALS_PATTERNS.test(clean)) return true;
  if (CLINICAL_ADVICE.test(clean)) return true;
  if (DOCTOR_FOOTER.test(clean)) return true;
  if (FORM_METADATA.test(clean)) return true;
  if (FOOTER_START_MARKER.test(clean)) return true;
  if (METADATA_LABEL_STANDALONE.test(clean)) return true;
  if (NON_MEDICINE.test(clean)) return true;
  if (/\b\d{5,}\b/.test(clean)) return true;
  if (clean.includes('|') && clean.split(/\s*\|\s*/).some(part => FOOTER_START_MARKER.test(part.trim()) || FORM_METADATA.test(part.trim()) || DOCTOR_FOOTER.test(part.trim()) || PRESCRIBER_IDENTITY.test(part.trim()))) return true;

  return false;
}

function isDirectionOrQuantityLine(line) {
  if (!line || typeof line !== 'string') return false;
  const cleaned = trimLayoutArtifacts(line).replace(/[.,;:!]+$/, '').trim();
  if (!cleaned) return false;
  if (/^\s*\(?\s*(?:tablet|capsule|tab|cap)s?\s*\)?\s*$/i.test(cleaned)) return false;
  if (/\b(?:take|sig|directions?)\b/i.test(cleaned)) return true;
  if (/\b(?:once|twice|three\s+times|thrice|four\s+times|\d+\s*times?)\s*(?:daily|a\s+day|per\s+day)\b/i.test(cleaned)) return true;
  if (/\b(?:after|before|with)\s+(?:food|meals?)\b/i.test(cleaned)) return true;
  if (/^\s*(?:qty|quantity|dispense)\s*[:.-]?\s*\d+/i.test(cleaned)) return true;
  if (/^\s*(?:(?:qty|quantity|dispense)\s*[:.-]?\s*)?\d+\s*(?:tablets?|tabs?|capsules?|caps?|sachets?|vials?|ampoules?|bottles?)\s*$/i.test(cleaned)) return true;
  return false;
}

function isPlausibleMedicine(line, inMedicineSection, isNumberedRow) {
  if (!line || line.length < 2 || line.length > 100 || !/[a-z]/i.test(line)) return false;
  if (STANDALONE_DOSAGE_FORM.test(line)) return false;
  if (isNonMedicineLine(line)) return false;
  if (isDirectionOrQuantityLine(line)) return false;

  const words = line.split(/\s+/).filter(Boolean);
  const hasSignal = MEDICINE_SIGNAL.test(line) || isNumberedRow;

  // If outside medicine section and no signal, require numbered row or recognizable dosage form
  if (!inMedicineSection && !hasSignal) {
    if (words.length > 3 || words.length < 2) return false;
    if (!/(?:tablet|tab|capsule|cap|syrup|sachet|injection|inj|cream|gel|drops?|solution)\b/i.test(line)) {
      return false;
    }
  }

  return true;
}

function parseExplicitQuantity(text) {
  const raw = trimLayoutArtifacts(text);
  if (!raw) return null;
  // Remove harmless trailing punctuation: .,;:!
  const cleaned = raw.replace(/[.,;:!]+$/, '').trim();
  if (!cleaned) return null;

  // Do not treat pure dosage strength as quantity (e.g. "500mg", "5mg", "250mg/5ml")
  if (/^\d+(?:\.\d+)?\s*(?:mg|mcg|µg|g|ml|iu|%)(?:\b|\/)/i.test(cleaned)) {
    return null;
  }

  // Check explicit quantity patterns with keyword prefix (e.g. "Qty: 10", "Dispense 10 sachets", "Quantity: 2")
  const qtyPrefixMatch = cleaned.match(/(?:^|\b)(?:quantity|qty|dispense)\s*[:.-]?\s*(\d+)(?:\s*(tablets?|tabs?|capsules?|caps?|units?|vials?|ampoules?|drops?|sachets?|bottles?))?\b/i);
  if (qtyPrefixMatch) {
    const num = parseInt(qtyPrefixMatch[1], 10);
    if (!isNaN(num) && num > 0) {
      return {
        explicitQuantity: num,
        prescribedQuantityText: raw,
        quantitySource: 'explicit_prescription_quantity',
        quantityConfidence: 1.0
      };
    }
  }

  // Count unit match: e.g. "2 sachets", "2sachets", "2sachets.", "10 tabs", "10tabs.", "5 vials", "5vials"
  const unitQuantityMatch = cleaned.match(/^(\d+)\s*(tablets?|tabs?|capsules?|caps?|sachets?|vials?|ampoules?|bottles?)\s*$/i);
  if (unitQuantityMatch) {
    const num = parseInt(unitQuantityMatch[1], 10);
    if (!isNaN(num) && num > 0) {
      return {
        explicitQuantity: num,
        prescribedQuantityText: raw,
        quantitySource: 'explicit_prescription_quantity',
        quantityConfidence: 1.0
      };
    }
  }

  return null;
}

function parseDirections(text) {
  if (!text || typeof text !== 'string') return null;
  const clean = text.trim();

  // Check for PRN / as needed
  if (/\b(?:as\s+needed|prn|when\s+required|sos)\b/i.test(clean)) {
    return {
      dosePerAdministration: null,
      frequency: null,
      duration: null,
      calculatedQuantity: null,
      quantitySource: 'manual_input_required',
      quantityConfidence: null,
      isPrn: true
    };
  }

  // Normalize harmless administration modifiers (e.g. "after food", "before food", "with food", "after meals")
  const normalized = clean
    .replace(/\b(?:after|before|with)\s+(?:food|meals?)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Dose: Support only clear tablet/capsule instructions
  // e.g. "Take 1 tablet", "Take 2 tablets", "Take 1 capsule", "1 tablet"
  const doseMatches = [...normalized.matchAll(/\b(?:take\s+)?(\d+)\s*(tablets?|tabs?|capsules?|caps?)\b/gi)];
  if (doseMatches.length !== 1) {
    return {
      dosePerAdministration: null,
      frequency: null,
      duration: null,
      calculatedQuantity: null,
      quantitySource: 'manual_input_required',
      quantityConfidence: null
    };
  }

  const dose = parseInt(doseMatches[0][1], 10);
  if (isNaN(dose) || dose <= 0) {
    return {
      dosePerAdministration: null,
      frequency: null,
      duration: null,
      calculatedQuantity: null,
      quantitySource: 'manual_input_required',
      quantityConfidence: null
    };
  }

  // Frequency normalization:
  // once daily = 1 time per day
  // twice daily = 2 times per day
  // three times daily / thrice daily = 3 times per day
  // four times daily = 4 times per day
  // numeric variants: 1 time daily, 2 times daily, 3 times daily, etc.
  const freqCandidates = [];
  if (/\bonce\s+(?:daily|a\s+day|per\s+day)\b/i.test(normalized)) freqCandidates.push(1);
  if (/\btwice\s+(?:daily|a\s+day|per\s+day)\b/i.test(normalized)) freqCandidates.push(2);
  if (/\b(?:three\s+times|thrice)\s*(?:daily|a\s+day|per\s+day)\b/i.test(normalized)) freqCandidates.push(3);
  if (/\bfour\s+times\s*(?:daily|a\s+day|per\s+day)\b/i.test(normalized)) freqCandidates.push(4);

  const numericFreqMatches = [...normalized.matchAll(/\b(\d+)\s*times?\s*(?:daily|a\s+day|per\s+day)\b/gi)];
  for (const m of numericFreqMatches) {
    freqCandidates.push(parseInt(m[1], 10));
  }

  // If conflicting frequencies found, or none found
  const uniqueFreqs = [...new Set(freqCandidates)];
  if (uniqueFreqs.length !== 1) {
    return {
      dosePerAdministration: dose,
      frequency: null,
      duration: null,
      calculatedQuantity: null,
      quantitySource: 'manual_input_required',
      quantityConfidence: null
    };
  }
  const frequency = uniqueFreqs[0];
  if (isNaN(frequency) || frequency <= 0) {
    return {
      dosePerAdministration: dose,
      frequency: null,
      duration: null,
      calculatedQuantity: null,
      quantitySource: 'manual_input_required',
      quantityConfidence: null
    };
  }

  // Duration in days:
  // e.g. "for 5 days", "for 7 days", "duration: 5 days", "for 14 days"
  const durationMatch = normalized.match(/\b(?:for|duration\s*[:.-]?)\s*(\d+)\s*days?\b/i);
  if (!durationMatch) {
    // Missing duration -> cannot calculate
    return {
      dosePerAdministration: dose,
      frequency,
      duration: null,
      calculatedQuantity: null,
      quantitySource: 'manual_input_required',
      quantityConfidence: null
    };
  }

  const duration = parseInt(durationMatch[1], 10);
  if (isNaN(duration) || duration <= 0) {
    return {
      dosePerAdministration: dose,
      frequency,
      duration: null,
      calculatedQuantity: null,
      quantitySource: 'manual_input_required',
      quantityConfidence: null
    };
  }

  // Calculate: dose * frequency * duration
  const calculatedQuantity = dose * frequency * duration;
  return {
    dosePerAdministration: dose,
    frequency,
    duration,
    calculatedQuantity,
    quantitySource: 'calculated_from_directions',
    quantityConfidence: 1.0
  };
}

function extractCandidateMedicineText(original) {
  const parts = original.split(/\s*\|\s*/);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1].trim();
    if (parseExplicitQuantity(last) || /\b(?:take|sig|directions?)\b/i.test(last)) {
      return cleanCandidate(parts.slice(0, -1).join(' | '));
    }
  }
  return cleanCandidate(original);
}

function parseCandidateDetails(original, trailingDirectionText = '') {
  const medicineText = extractCandidateMedicineText(original);
  let explicitInfo = null;
  let directionInfo = null;

  // Check inline parts separated by pipe
  const parts = original.split(/\s*\|\s*/);
  if (parts.length >= 2) {
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i].trim();
      if (!part) continue;
      if (/\b(?:take|sig|directions?|once|twice|daily|times)\b/i.test(part)) {
        directionInfo = parseDirections(part);
      } else {
        const explicit = parseExplicitQuantity(part);
        if (explicit) {
          explicitInfo = explicit;
        }
      }
    }
  }

  // Check inline direction if in unpiped line (e.g. "Paracetamol 500mg Take 1 tablet...")
  if (!directionInfo && /\b(?:take|sig|directions?)\b/i.test(original)) {
    const dirMatch = original.match(/\b(?:take|sig|directions?)\b.*$/i);
    if (dirMatch) {
      directionInfo = parseDirections(dirMatch[0]);
    }
  }

  // If no inline quantity/direction, check trailing direction text from subsequent line
  if (!directionInfo && !explicitInfo && trailingDirectionText) {
    directionInfo = parseDirections(trailingDirectionText);
    if (!directionInfo || (directionInfo.calculatedQuantity === null && !directionInfo.isPrn)) {
      const trailingExplicit = parseExplicitQuantity(trailingDirectionText);
      if (trailingExplicit) {
        explicitInfo = trailingExplicit;
      }
    }
  }

  if (explicitInfo) {
    return {
      medicineText,
      prescribedQuantityText: explicitInfo.prescribedQuantityText,
      dosePerAdministration: directionInfo?.dosePerAdministration ?? null,
      frequency: directionInfo?.frequency ?? null,
      duration: directionInfo?.duration ?? null,
      calculatedQuantity: null,
      explicitQuantity: explicitInfo.explicitQuantity,
      numericQuantity: explicitInfo.explicitQuantity,
      quantitySource: 'explicit_prescription_quantity',
      quantityConfidence: explicitInfo.quantityConfidence
    };
  }

  if (directionInfo && directionInfo.calculatedQuantity !== null) {
    return {
      medicineText,
      prescribedQuantityText: null,
      dosePerAdministration: directionInfo.dosePerAdministration,
      frequency: directionInfo.frequency,
      duration: directionInfo.duration,
      calculatedQuantity: directionInfo.calculatedQuantity,
      explicitQuantity: null,
      numericQuantity: directionInfo.calculatedQuantity,
      quantitySource: 'calculated_from_directions',
      quantityConfidence: directionInfo.quantityConfidence
    };
  }

  return {
    medicineText,
    prescribedQuantityText: null,
    dosePerAdministration: directionInfo?.dosePerAdministration ?? null,
    frequency: directionInfo?.frequency ?? null,
    duration: directionInfo?.duration ?? null,
    calculatedQuantity: null,
    explicitQuantity: null,
    numericQuantity: null,
    quantitySource: 'manual_input_required',
    quantityConfidence: null
  };
}

function extractMedicineCandidates(text, ocrLines = []) {
  const medicines = [];
  const lines = normaliseLines(text, ocrLines);
  let inMedicineSection = false;
  let inFooterSection = false;
  const consumedIndices = new Set();

  for (let i = 0; i < lines.length; i++) {
    if (consumedIndices.has(i)) continue;
    const record = lines[i];
    const original = record.text;

    // Region-based footer row: always skip
    if (record.isFooter) {
      continue;
    }

    // Unambiguous footer termination (e.g. "Do Not Refill", Refill block, etc.)
    const hasFooterAnchor = FOOTER_START_MARKER.test(original) ||
      (original.includes('|') && original.split(/\s*\|\s*/).some(part => FOOTER_START_MARKER.test(part.trim())));

    if (hasFooterAnchor) {
      if (medicines.length > 0 || inMedicineSection) {
        inMedicineSection = false;
        inFooterSection = true;
        break;
      }
      continue;
    }

    if (inFooterSection) {
      break;
    }

    // Split metadata label handling: e.g. "DEA Number", "(Sign)", "Print Last Name"
    if (METADATA_LABEL_STANDALONE.test(original)) {
      consumedIndices.add(i);
      // If the following line is the value for this metadata field, consume it as well
      if (i + 1 < lines.length) {
        const nextOriginal = lines[i + 1].text;
        if (!RX_MARKER.test(nextOriginal) && !/^\s*\d+[.)-]\s*/.test(nextOriginal)) {
          consumedIndices.add(i + 1);
        }
      }
      continue;
    }

    if (RX_MARKER.test(original)) {
      inMedicineSection = true;
      continue;
    }

    if (SECTION_END_MARKER.test(original)) {
      inMedicineSection = false;
      continue;
    }

    if (PRESCRIBER_IDENTITY.test(original)) {
      continue;
    }

    const candidate = cleanCandidate(original);
    const isNumberedRow = /^\s*\d+[.)-]\s*/.test(original);
    if (!isPlausibleMedicine(candidate, inMedicineSection, isNumberedRow)) continue;

    // Check if original already has inline directions or explicit quantity
    const hasInlineDirections = /\b(?:take|sig|directions?)\b/i.test(original);
    const hasInlinePiped = original.includes('|') && (
      parseExplicitQuantity(original.split(/\s*\|\s*/).pop()) ||
      /\b(?:take|sig|directions?)\b/i.test(original.split(/\s*\|\s*/).pop())
    );

    let trailingDirectionText = '';
    if (!hasInlineDirections && !hasInlinePiped) {
      for (let j = i + 1; j < lines.length; j++) {
        const nextText = lines[j].text;
        if (STANDALONE_DOSAGE_FORM.test(nextText) || lines[j].isFooter || FOOTER_START_MARKER.test(nextText) || DOCTOR_FOOTER.test(nextText) || PRESCRIBER_IDENTITY.test(nextText)) {
          continue;
        }

        // FIRST check if nextText is a direction or quantity line
        if (isDirectionOrQuantityLine(nextText)) {
          trailingDirectionText = nextText;
          consumedIndices.add(j);
          break;
        }

        // ONLY IF NOT direction/quantity, check if it's another medicine candidate
        const nextCandidate = cleanCandidate(nextText);
        const nextIsNumbered = /^\s*\d+[.)-]\s*/.test(nextText);
        if (isPlausibleMedicine(nextCandidate, inMedicineSection, nextIsNumbered)) {
          break;
        }
        break;
      }
    }

    const parsed = parseCandidateDetails(original, trailingDirectionText);
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
  if (!text || typeof text !== 'string') return null;
  let match = text.match(/(?:Patient\s*Name|Pt\.?\s*Name)\s*[:/.-]?\s*([^\r\n]+)/i);
  if (!match) {
    match = text.match(/(?:^|\n)\s*Name\s*[:/.-]\s*([^\r\n]+)/i);
  }
  if (!match) return null;
  let name = match[1].trim();
  name = name.replace(/(?:[|,]|\s+)(?:Date|Dated|Age|Gender|Sex|UHID|MRN|DOB|Phone|Mobile|OP\s*No)\s*[:/.-]?.*$/i, '');
  const cleaned = trimLayoutArtifacts(name);
  if (!cleaned || cleaned.length < 2 || /^(?:date|age|gender|male|female|\d+)$/i.test(cleaned)) {
    return null;
  }
  return cleaned;
}

module.exports = {
  extractMedicineCandidates,
  extractMedicines,
  extractPatientName,
  parseDirections,
  parseExplicitQuantity,
  isDirectionOrQuantityLine,
  isNonMedicineLine,
  isPlausibleMedicine,
  detectFooterCutoffY,
  clusterOcrLinesIntoRows,
  analyzeFooterGeometry
};
