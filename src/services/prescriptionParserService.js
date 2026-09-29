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
const STANDALONE_DOSAGE_FORM = /^\s*\(?\s*(?:tablet|capsule|tab|cap|syrup|suspension|injection|drops?|ointment|cream|gel|inhaler|spray|solution|vial|ampoule|sachet)s?\s*\)?\s*$/i;
const MEDICINE_SIGNAL = /\b\d+(?:\.\d+)?\s*(?:mg|mcg|µg|g|ml|iu|%)(?:\b|\/)|\b(?:tab(?:let)?s?|cap(?:sule)?s?|syrup|suspension|injection|drops?|ointment|cream|gel|inhaler|spray|solution|vial|ampoule|sachets?)\b/i;
const RX_MARKER = /^\s*(?:rx|℞|medicines?|treatment)\b/i;
const SECTION_END_MARKER = /^\s*(?:advice|instructions?|notes?|plan|general\s+instructions?|dietary\s+advice|follow[- ]?up|review(?:\s+after)?|signature|sign|dr\.?|doctor|physician|prescriber|consultant)\s*[:.-]?\b/i;

// Strong footer / prescription termination markers (refill block, signature block, DEA, last name)
const FOOTER_START_MARKER = /^\s*(?:do\s+not\s+refill|refill\b|times\b|\(?sign(?:ature)?\)?\b|m\.?\s*d\.?|d\.?o\.?|dea\s*(?:number|no\.?|#)?|print\s+(?:last\s+)?name|prescriber\s*(?:name|signature)?|doctor'?s?\s*(?:name|signature)?|physician\s*(?:name|signature)?)\b/i;

// Standalone form metadata labels that precede their values on the next line
const METADATA_LABEL_STANDALONE = /^\s*(?:dea\s*(?:number|no\.?|#)?|print\s+(?:last\s+)?name|prescriber\s*(?:signature|name)?|physician\s*(?:signature|name)?|doctor'?s?\s*(?:signature|name)?|dr\.?|\(?sign(?:ature)?\)?|m\.?\s*d\.?|d\.?o\.?|refill\b|do\s+not\s+refill|times\b|uhid|mrn|opd|ipd?|patient\s*id|registration|reg(?:\.|istration)?\s*(?:no|number)?|date|dated)\s*[:.-]?\s*$/i;

const ROUTE_FORM_PREFIX = /^\s*(?:ivf?|oint(?:ment)?|drops?|susp(?:ension)?|infusion)\s*[:.-]\s*/i;
const LIST_SERIAL_PREFIX = /^\s*(?:[①-⑳]|\(\s*\d{1,3}\s*\)|\d{1,3}\s*[.)])\s*(?:\|\s*)?|^\s*\d{1,3}\s*\|\s*/;
const SCHEDULE_TOKEN = /^\s*(\d)\s*\.?\s*-\s*(\d)\s*\.?\s*-\s*(\d)\s*$/;
const SCHEDULE_INLINE = /(?:^|\s)(\d)\s*\.?\s*-\s*(\d)\s*\.?\s*-\s*(\d)(?=\s|$)/g;
const STOP_MARKER = /^\s*(?:stop|discontinue|d\s*\/\s*c|hold)\b/i;
const INSTRUCTION_FRAGMENT = /^(?:after|before|with)\s+(?:food|meals?|breakfast|lunch|dinner)$|^(?:empty\s+stomach|morning|night|hs|sos|prn|as\s+needed)$/i;
const INSTRUCTION_START = /^\s*(?:dissolve|take|give|apply|instill|inhale|inject|use|mix|swallow|chew|gargle|spray)\b/i;
const COMPACT_DOSAGE_INSTRUCTION = /^\s*(?:(?:\d\s*-\s*\d\s*-\s*\d)|(?:\d+(?:\.\d+)?\s*(?:ml|tablets?|tabs?|capsules?|caps?|puffs?|sprays?|drops?)\s*(?:od|bd|tid|qid|sos|prn)))(?:\s*(?:x|×)\s*\d+\s*(?:days?|weeks?))?\s*$/i;
const TREATMENT_DURATION_SUFFIX = /^\s*(?:x|×)\s*(\d+)\s*(days?|weeks?)\s*$/i;
const PACKAGE_FORM_CONTINUATION = /^\s*(?:\(\s*\d+(?:\.\d+)?\s*(?:mcg|mg|µg|g|ml|iu|units?)\s*\)\s*)?(?:tablet|capsule|syrup|suspension|inhaler|spray|drops?|solution|injection|ointment|cream|gel|vial|ampoule|sachet)s?(?:\s*\(\s*\d+(?:\.\d+)?\s*(?:mcg|mg|µg|g|ml|iu|units?)\s*\))?\s*$/i;

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

function stripListSerial(value) {
  return String(value || '').replace(LIST_SERIAL_PREFIX, '').trim();
}

function canonicalDosageForm(value) {
  const token = String(value || '').toLowerCase().replace(/\.$/, '');
  if (/^tab(?:let)?s?$/.test(token)) return 'tablet';
  if (/^cap(?:sule)?s?$/.test(token)) return 'capsule';
  if (/^(?:syp|syr|syrup)$/.test(token)) return 'syrup';
  if (/^susp(?:ension)?s?$/.test(token)) return 'suspension';
  if (/^inhalers?$/.test(token)) return 'inhaler';
  if (/^sprays?$/.test(token)) return 'spray';
  if (/^solutions?$/.test(token)) return 'solution';
  if (/^(?:inj|injection)$/.test(token)) return 'injection';
  return null;
}

function extractDosageFormPrefix(value) {
  const source = String(value || '');
  const match = source.match(/^\s*(?:(?:[a-z]{1,3}\.)\s+)?(tab(?:let)?s?|cap(?:sule)?s?|syp|syr(?:up)?|susp(?:ension)?s?|inhalers?|sprays?|solutions?|inj(?:ection)?)\.?\s*(?:\|\s*)?/i);
  if (!match) return { text: source.trim(), dosageForm: null };
  return { text: source.slice(match[0].length).trim(), dosageForm: canonicalDosageForm(match[1]) };
}

function cleanCandidate(line) {
  const withoutDirections = stripListSerial(String(line || '')
    .replace(/^\s*(?:rx|℞)\s*[:.-]?\s*/i, '')
    .replace(ROUTE_FORM_PREFIX, '')
    .replace(/\s*\(\s*(?:tablet|capsule|tab|cap|syrup|suspension|injection|drops?|ointment|cream|gel|inhaler|vial|ampoule|sachet)s?\s*\)/gi, '')
    .replace(/\b(?:take|sig|directions?)\b.*$/i, ''));

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

function treatmentDurationSuffix(value) {
  const cleaned = trimLayoutArtifacts(value).replace(/[.,;:!]+$/, '').trim();
  const match = cleaned.match(TREATMENT_DURATION_SUFFIX);
  if (!match) return null;
  return {
    instruction: cleaned,
    duration: /^days?$/i.test(match[2]) ? parseInt(match[1], 10) : null,
    durationText: `${match[1]} ${match[2].toLowerCase()}`
  };
}

function splitTrailingTreatmentDuration(value) {
  const text = String(value || '').trim();
  const match = text.match(/^(.*?)\s+((?:x|×)\s*\d+\s*(?:days?|weeks?))\s*$/i);
  if (!match) return null;
  const metadata = treatmentDurationSuffix(match[2]);
  return metadata ? { identity: match[1].trim(), metadata } : null;
}

function compactDosageInstruction(value) {
  const cleaned = trimLayoutArtifacts(value).replace(/[.,;:!]+$/, '').trim();
  return COMPACT_DOSAGE_INSTRUCTION.test(cleaned) ? cleaned : null;
}

function compactInstructionMetadata(value) {
  const instruction = compactDosageInstruction(value);
  if (!instruction) return null;
  const scheduleMatch = instruction.match(/^(\d)\s*-\s*(\d)\s*-\s*(\d)/);
  const durationMatch = instruction.match(/(?:x|×)\s*(\d+)\s*(days?|weeks?)$/i);
  return {
    instruction,
    schedule: scheduleMatch ? `${scheduleMatch[1]}-${scheduleMatch[2]}-${scheduleMatch[3]}` : null,
    duration: durationMatch && /^days?$/i.test(durationMatch[2]) ? parseInt(durationMatch[1], 10) : null,
    durationText: durationMatch ? `${durationMatch[1]} ${durationMatch[2].toLowerCase()}` : null,
    isDescriptiveInstruction: Boolean(durationMatch) || !scheduleMatch
  };
}

function splitTrailingCompactInstruction(value) {
  const text = String(value || '').trim();
  const match = text.match(/^(.*?)\s+((?:(?:\d\s*-\s*\d\s*-\s*\d)|(?:\d+(?:\.\d+)?\s*(?:ml|tablets?|tabs?|capsules?|caps?|puffs?|sprays?|drops?)\s*(?:od|bd|tid|qid|sos|prn)))(?:\s*(?:x|×)\s*\d+\s*(?:days?|weeks?))?)\s*$/i);
  if (!match || !compactDosageInstruction(match[2])) return null;
  return { identity: match[1].trim(), metadata: compactInstructionMetadata(match[2]) };
}

function isPackageFormContinuation(value) {
  return PACKAGE_FORM_CONTINUATION.test(trimLayoutArtifacts(value));
}

function isInstructionFragment(value) {
  const text = String(value || '').trim();
  return INSTRUCTION_FRAGMENT.test(text) || INSTRUCTION_START.test(text) || Boolean(compactDosageInstruction(text)) || Boolean(treatmentDurationSuffix(text));
}

function isSchedule(value) {
  return SCHEDULE_TOKEN.test(String(value || ''));
}

function isCompactTabletQuantity(value, dosageForm) {
  const match = String(value || '').trim().match(/^(\d+)\s*t$/i);
  if (!match || dosageForm !== 'tablet') return null;
  const explicitQuantity = parseInt(match[1], 10);
  if (!explicitQuantity) return null;
  return {
    explicitQuantity,
    prescribedQuantityText: String(value || '').trim(),
    quantityUnit: 'tablet',
    quantitySource: 'explicit_prescription_quantity',
    quantityConfidence: 1.0
  };
}

function isMetadataOnlyRow(line) {
  const parts = stripListSerial(line).split(/\s*\|\s*/).map(part => part.trim()).filter(Boolean);
  if (!parts.length) return true;
  return parts.every(part =>
    isSchedule(part) ||
    isInstructionFragment(part) ||
    /^(?:for\s+)?\d+\s*(?:days?|weeks?)$/i.test(part) ||
    Boolean(parseExplicitQuantity(part)) ||
    /^\d+\s*t$/i.test(part) ||
    /^\d+\s*ml$/i.test(part) ||
    /^\d\s*-\s*\d(?:\s*-\s*\d)?$/.test(part)
  );
}

function isDirectionOrQuantityLine(line) {
  if (!line || typeof line !== 'string') return false;
  const cleaned = trimLayoutArtifacts(line).replace(/[.,;:!]+$/, '').trim();
  if (!cleaned) return false;
  if (/^\s*\(?\s*(?:tablet|capsule|tab|cap)s?\s*\)?\s*$/i.test(cleaned)) return false;
  if (isSchedule(cleaned) || isInstructionFragment(cleaned) || Boolean(compactDosageInstruction(cleaned)) || INSTRUCTION_START.test(cleaned) || /^(?:for\s+)?\d+\s*(?:days?|weeks?)$/i.test(cleaned)) return true;
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
  if (isPackageFormContinuation(line)) return false;
  if (isMetadataOnlyRow(line)) return false;
  if (isNonMedicineLine(line)) return false;
  if (isDirectionOrQuantityLine(line)) return false;

  const words = line.split(/\s+/).filter(Boolean);
  const hasSignal = MEDICINE_SIGNAL.test(line) || isNumberedRow;
  if (!inMedicineSection && !hasSignal) {
    const hasRecognizedForm = Boolean(extractDosageFormPrefix(stripListSerial(line)).dosageForm);
    if ((words.length > 3 || words.length < 2) && !hasRecognizedForm) return false;
    if (!hasRecognizedForm && !/(?:tablet|tab|capsule|cap|syrup|syp|sachet|injection|inj|cream|gel|drops?|solution)\b/i.test(line)) return false;
  }
  return true;
}

function parseExplicitQuantity(text) {
  const raw = trimLayoutArtifacts(text);
  if (!raw) return null;
  // OCR row separators may precede an otherwise unambiguous count, e.g. "| - 60 tablets".
  const cleaned = raw.replace(/[.,;:!]+$/, '').replace(/^(?:[|]|[-—–])+\s*/, '').trim();
  if (!cleaned) return null;

  // Do not treat pure dosage strength as quantity (e.g. "500mg", "5mg", "250mg/5ml")
  if (/^\d+(?:\.\d+)?\s*(?:mg|mcg|µg|g|ml|iu|%)(?:\b|\/)/i.test(cleaned)) return null;

  const qtyPrefixMatch = cleaned.match(/(?:^|\b)(?:quantity|qty|dispense)\s*[:.-]?\s*(\d+)(?:\s*(tablets?|tabs?|capsules?|caps?|units?|vials?|ampoules?|drops?|sachets?|bottles?))?\b/i);
  if (qtyPrefixMatch) {
    const num = parseInt(qtyPrefixMatch[1], 10);
    if (!isNaN(num) && num > 0) return { explicitQuantity: num, prescribedQuantityText: raw, quantityUnit: null, quantitySource: 'explicit_prescription_quantity', quantityConfidence: 1.0 };
  }

  // Count units are strong evidence and keep dosage-strength numbers out of dispense quantity.
  const unitQuantityMatch = cleaned.match(/^(\d+)\s*(tablets?|tabs?|capsules?|caps?|sachets?|vials?|ampoules?|bottles?)\s*$/i);
  if (unitQuantityMatch) {
    const num = parseInt(unitQuantityMatch[1], 10);
    if (!isNaN(num) && num > 0) return { explicitQuantity: num, prescribedQuantityText: raw, quantityUnit: null, quantitySource: 'explicit_prescription_quantity', quantityConfidence: 1.0 };
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

function normaliseMedicineIdentityText(value) {
  return cleanCandidate(value)
    .replace(/\btabs?\b/gi, 'tablet')
    .replace(/\bcaps?\b/gi, 'capsule')
    .replace(/\(\s*(\d+(?:\.\d+)?\s*(?:mcg|mg|µg|g|ml|iu|units?))\s*\)\s+(tablet|capsule|syrup|suspension|inhaler|spray|drops?|solution|injection|ointment|cream|gel|vial|ampoule|sachet)s?\b$/i, ' $2 ($1)')
    .replace(/\s+(?:x|×)\s*\d+\s*(?:days?|weeks?)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normaliseStrengthText(value) {
  return value
    .toLowerCase()
    .replace(/(\d)\s*(k\s*)?(mcg|mg|µg|g|ml|iu|units?)/gi, (_, number, kilo, unit) => `${number}${kilo ? 'k ' : ' '}${unit}`)
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractMedicineIdentity(medicineText, prefixDosageForm = null) {
  const normalized = normaliseMedicineIdentityText(medicineText);
  const formMatch = normalized.match(/\s+(tablet|capsule|syrup|suspension|inhaler|spray|drops?|solution|injection|ointment|cream|gel|vial|ampoule)s?(?:\s+\(\s*\d+(?:\.\d+)?\s*(?:mcg|mg|µg|g|ml|iu|units?)\s*\))?$/i);
  const suffixForm = formMatch ? canonicalDosageForm(formMatch[1]) || formMatch[1].toLowerCase() : null;
  const dosageForm = prefixDosageForm || suffixForm;
  const withoutForm = formMatch ? normalized.slice(0, formMatch.index).trim() : normalized;
  const strengthMatch = withoutForm.match(/(?:^|\s)(\d+(?:\.\d+)?\s*(?:k\s*)?(?:mcg|mg|µg|g|ml|iu|units?)(?:\s*\/\s*\d+(?:\.\d+)?\s*(?:mcg|mg|µg|g|ml|iu|units?))?)$/i);
  const strength = strengthMatch ? normaliseStrengthText(strengthMatch[1]) : null;
  const medicineName = strengthMatch ? withoutForm.slice(0, strengthMatch.index).trim() : withoutForm;
  return { medicineText: normalized, medicineName, strength, dosageForm };
}

function quantityUnitFromText(value) {
  const match = String(value || '').match(/\b(tablets?|tabs?|capsules?|caps?|sachets?|vials?|ampoules?|bottles?)\b/i);
  if (!match) return null;
  return canonicalDosageForm(match[1]) || match[1].toLowerCase().replace(/s$/, '');
}

function trailingExplicitQuantity(text) {
  const match = String(text || '').match(/(?:\s|^)(?:[|]|[-—–])\s*(?:[-—–]\s*)?((?:(?:qty|quantity|dispense)\s*[:.-]?\s*)?\d+\s*(?:tablets?|tabs?|capsules?|caps?|sachets?|vials?|ampoules?|bottles?))\s*$/i);
  return match ? parseExplicitQuantity(match[1]) : null;
}

function parsePrescriptionRow(original) {
  const serialFree = stripListSerial(original);
  const trailingQuantity = trailingExplicitQuantity(serialFree);
  const identitySource = trailingQuantity
    ? serialFree.replace(/\s*(?:[|]|[-—–])\s*(?:[-—–]\s*)?(?:(?:qty|quantity|dispense)\s*[:.-]?\s*)?\d+\s*(?:tablets?|tabs?|capsules?|caps?|sachets?|vials?|ampoules?|bottles?)\s*$/i, '')
    : serialFree;
  const parts = identitySource.split(/\s*\|\s*/).map(part => part.trim()).filter(Boolean);
  if (!parts.length) return null;

  const first = extractDosageFormPrefix(parts[0]);
  let dosageForm = first.dosageForm;
  parts[0] = first.text;
  let schedule = null;
  let duration = null;
  let durationText = null;
  let explicitInfo = trailingQuantity;
  let directionText = null;
  let dispenseVolumeText = null;
  const instructions = [];
  const identityParts = [];
  const recordCompactInstruction = (metadata) => {
    if (!metadata) return;
    if (metadata.isDescriptiveInstruction && !instructions.includes(metadata.instruction)) instructions.push(metadata.instruction);
    schedule = schedule || metadata.schedule;
    if (duration === null && metadata.duration !== null) duration = metadata.duration;
    if (!durationText && metadata.durationText) durationText = metadata.durationText;
  };
  const recordTreatmentDuration = (metadata) => {
    if (!metadata) return;
    if (!instructions.includes(metadata.instruction)) instructions.push(metadata.instruction);
    if (duration === null && metadata.duration !== null) duration = metadata.duration;
    if (!durationText && metadata.durationText) durationText = metadata.durationText;
  };

  for (const [index, source] of parts.entries()) {
    let part = source.trim();
    if (!part) continue;
    if (index > 0 && !dosageForm) {
      const prefixed = extractDosageFormPrefix(part);
      if (prefixed.dosageForm) {
        dosageForm = prefixed.dosageForm;
        part = prefixed.text;
      }
    }
    if (/\b(?:take|sig|directions?)\b/i.test(part)) {
      directionText = part;
      continue;
    }
    const compactInstruction = compactInstructionMetadata(part);
    if (compactInstruction) {
      recordCompactInstruction(compactInstruction);
      continue;
    }
    const trailingCompact = splitTrailingCompactInstruction(part);
    if (trailingCompact) {
      part = trailingCompact.identity;
      recordCompactInstruction(trailingCompact.metadata);
    }
    const trailingDuration = splitTrailingTreatmentDuration(part);
    if (trailingDuration) {
      part = trailingDuration.identity;
      recordTreatmentDuration(trailingDuration.metadata);
    }
    const durationSuffix = treatmentDurationSuffix(part);
    if (durationSuffix) {
      recordTreatmentDuration(durationSuffix);
      continue;
    }
    part = part.replace(SCHEDULE_INLINE, (match, morning, noon, night) => {
      schedule = schedule || `${morning}-${noon}-${night}`;
      return ' ';
    }).replace(/(?:^|\s)[+}\]]*\s*(?:\d\s*)?-\s*\d\s*-\s*(?:\d|[+}\]])(?=\s|$)/g, ' ')
      .replace(/\s+/g, ' ').trim();
    if (!part) continue;
    // A detached digit without a reliable semantic role is not instruction, quantity, or dose.
    if (/^\d+$/.test(part)) continue;
    const normalizedInstruction = part.replace(/^[\d\s]+/, '').replace(/[)\]}.;,]+$/, '');
    if (isInstructionFragment(normalizedInstruction)) {
      instructions.push(normalizedInstruction.toLowerCase());
      continue;
    }
    // OCR punctuation can join a schedule/duration/PRN note into one right-hand fragment.
    if (/^[+}\]]\s*[\d.-]*for\b/i.test(part) || /^(?:if\b|sos\.?$|hs\.?$)/i.test(part) || /^\d+[+.-]*$/.test(part)) {
      instructions.push(part.toLowerCase().replace(/[)\]}.;,]+$/, ''));
      continue;
    }
    if (dosageForm === 'capsule' && index > 0 && /^[^\s]*cap$/i.test(part)) {
      continue;
    }

    // Right-hand handwritten columns often arrive as one fragment (for example,
    // "30T empty stomach"). With an established tablet form, retain the count
    // and keep every following fragment out of the matching identity.
    const compactLeading = dosageForm === 'tablet' && part.match(/^(\d+)\s*t\s*(.*)$/i);
    if (compactLeading) {
      explicitInfo = isCompactTabletQuantity(`${compactLeading[1]}T`, dosageForm);
      const remainder = compactLeading[2].trim().replace(/[)\]}.;,]+$/, '');
      if (remainder) instructions.push(remainder.toLowerCase());
      continue;
    }
    const compactTrailing = dosageForm === 'tablet' && part.match(/^(.*?)\s+(\d+)\s*t\s*(.*)$/i);
    if (compactTrailing) {
      explicitInfo = isCompactTabletQuantity(`${compactTrailing[2]}T`, dosageForm);
      const remainder = compactTrailing[3].trim().replace(/[)\]}.;,]+$/, '');
      if (remainder) instructions.push(remainder.toLowerCase());
      part = compactTrailing[1].trim();
      if (!part) continue;
    }
    if (dosageForm === 'syrup') {
      const volumeLeading = part.match(/^(\d+(?:\.\d+)?\s*ml)\b\s*(.*)$/i);
      if (volumeLeading && index > 0) {
        dispenseVolumeText = volumeLeading[1];
        const remainder = volumeLeading[2].trim().replace(/[)\]}.;,]+$/, '');
        if (remainder) instructions.push(remainder.toLowerCase());
        continue;
      }
    }
    const durationMatch = part.replace(/[)\]}.;,]+$/, '').match(/^(?:for\s+)?(\d+)\s*(days?|weeks?)$/i);
    if (durationMatch) {
      durationText = `${durationMatch[1]} ${durationMatch[2].toLowerCase()}`;
      if (/^days?$/i.test(durationMatch[2])) duration = parseInt(durationMatch[1], 10);
      continue;
    }
    if (isInstructionFragment(part)) {
      instructions.push(part.toLowerCase().replace(/\s+/g, ' '));
      continue;
    }
    const quantity = parseExplicitQuantity(part) || isCompactTabletQuantity(part, dosageForm);
    if (quantity) {
      explicitInfo = quantity;
      continue;
    }
    // Keep a syrup dispense volume as ambiguous metadata; do not infer quantity from it.
    if (dosageForm === 'syrup' && index > 0 && /^\d+(?:\.\d+)?\s*ml$/i.test(part)) {
      dispenseVolumeText = part;
      continue;
    }
    identityParts.push(part);
  }
  return { identityText: identityParts.join(' '), dosageForm, schedule, duration, durationText, instructions, explicitInfo, directionText, dispenseVolumeText };
}

function parseCandidateDetails(original, trailingDirectionText = '') {
  const row = parsePrescriptionRow(original) || {};
  const identityText = row.dosageForm && !new RegExp(`\\s${row.dosageForm}s?$`, 'i').test(row.identityText || '')
    ? `${row.identityText} ${row.dosageForm}`.trim()
    : row.identityText;
  const identity = extractMedicineIdentity(identityText, row.dosageForm);
  const medicineText = identity.medicineText;
  let explicitInfo = row.explicitInfo || null;
  let directionInfo = null;
  const directionText = row.directionText || trailingDirectionText;
  if (directionText) directionInfo = parseDirections(directionText);
  if (!directionInfo && /\b(?:take|sig|directions?)\b/i.test(original)) {
    const dirMatch = original.match(/\b(?:take|sig|directions?)\b.*$/i);
    if (dirMatch) directionInfo = parseDirections(dirMatch[0]);
  }
  if (!explicitInfo) explicitInfo = trailingExplicitQuantity(original);
  if (!explicitInfo && trailingDirectionText) explicitInfo = parseExplicitQuantity(trailingDirectionText);

  const continuationInstructions = String(trailingDirectionText || '').split(/\r?\n/).map(value => value.trim()).filter(value => INSTRUCTION_START.test(value) || Boolean(compactInstructionMetadata(value)?.isDescriptiveInstruction) || Boolean(treatmentDurationSuffix(value)));
  const instructions = [...(row.instructions || []), ...continuationInstructions];
  const base = {
    medicineText, medicineName: identity.medicineName, strength: identity.strength, dosageForm: identity.dosageForm,
    schedule: row.schedule || null, quantityUnit: explicitInfo?.quantityUnit || quantityUnitFromText(explicitInfo?.prescribedQuantityText),
    durationText: row.durationText || null, instructions: instructions.length ? instructions.join('; ') : null,
    dispenseVolumeText: row.dispenseVolumeText || null,
    dosePerAdministration: directionInfo?.dosePerAdministration ?? null,
    frequency: directionInfo?.frequency ?? null,
    duration: directionInfo?.duration ?? row.duration ?? null
  };
  if (explicitInfo) {
    return { ...base, prescribedQuantityText: explicitInfo.prescribedQuantityText, calculatedQuantity: null,
      explicitQuantity: explicitInfo.explicitQuantity, numericQuantity: explicitInfo.explicitQuantity,
      quantitySource: 'explicit_prescription_quantity', quantityConfidence: explicitInfo.quantityConfidence };
  }
  if (directionInfo && directionInfo.calculatedQuantity !== null) {
    return { ...base, prescribedQuantityText: null, calculatedQuantity: directionInfo.calculatedQuantity,
      explicitQuantity: null, numericQuantity: directionInfo.calculatedQuantity,
      quantitySource: 'calculated_from_directions', quantityConfidence: directionInfo.quantityConfidence };
  }
  return { ...base, prescribedQuantityText: null, calculatedQuantity: null, explicitQuantity: null,
    numericQuantity: null, quantitySource: 'manual_input_required', quantityConfidence: null };
}
function detachedMetadataType(text, dosageForm) {
  const value = trimLayoutArtifacts(text).replace(/[)\]}.;,]+$/, '').trim();
  if (!value || /^\d+$/.test(value)) return null;
  if (isSchedule(value)) return { type: 'schedule', value };
  const explicit = parseExplicitQuantity(value) || isCompactTabletQuantity(value, dosageForm);
  if (explicit) return { type: 'quantity', value, explicit };
  const duration = value.match(/^(?:for\s+)?(\d+)\s*(days?|weeks?)$/i);
  if (duration) return { type: 'duration', value: `${duration[1]} ${duration[2].toLowerCase()}`, days: /^days?$/i.test(duration[2]) ? parseInt(duration[1], 10) : null };
  if (isInstructionFragment(value) || compactDosageInstruction(value) || treatmentDurationSuffix(value)) return { type: 'instruction', value };
  return null;
}

function associationCrossesBoundary(lines, fromIndex, toIndex) {
  const start = Math.min(fromIndex, toIndex) + 1;
  const end = Math.max(fromIndex, toIndex);
  return lines.slice(start, end).some(record => {
    const value = record.text || '';
    return SECTION_END_MARKER.test(value) || FOOTER_START_MARKER.test(value) || STOP_MARKER.test(value);
  });
}

function verticalQuantityAlignment(candidate, fragment) {
  const [, candidateTop, , candidateBottom] = candidate._box;
  const [, fragmentTop, , fragmentBottom] = fragment.box;
  const candidateCenter = (candidateTop + candidateBottom) / 2;
  const fragmentCenter = (fragmentTop + fragmentBottom) / 2;
  return {
    centerDistance: Math.abs(candidateCenter - fragmentCenter),
    verticalOverlap: Math.max(0, Math.min(candidateBottom, fragmentBottom) - Math.max(candidateTop, fragmentTop)),
    candidateHeight: candidateBottom - candidateTop,
    fragmentHeight: fragmentBottom - fragmentTop
  };
}

function hasDecisiveVerticalQuantityAlignment(best, alternative) {
  const sharedHeight = Math.max(1, Math.min(best.candidateHeight, alternative.candidateHeight, best.fragmentHeight));
  const centerMargin = Math.max(8, sharedHeight * 0.2);
  const overlapMargin = Math.max(4, best.fragmentHeight * 0.2);
  const clearlyCloser = best.centerDistance + centerMargin <= alternative.centerDistance &&
    best.verticalOverlap >= alternative.verticalOverlap;
  const clearlyMoreOverlapping = best.verticalOverlap >= alternative.verticalOverlap + overlapMargin &&
    best.centerDistance <= alternative.centerDistance;
  return clearlyCloser || clearlyMoreOverlapping;
}

function selectDecisiveQuantityMatch(matches, fragment) {
  const attachable = matches.filter(({ candidate }) => candidate.explicitQuantity === null);
  if (attachable.length === 1) return attachable[0];
  if (attachable.length < 2) return null;
  const ranked = attachable
    .map(match => ({ ...match, alignment: verticalQuantityAlignment(match.candidate, fragment) }))
    .sort((left, right) => right.alignment.verticalOverlap - left.alignment.verticalOverlap || left.alignment.centerDistance - right.alignment.centerDistance);
  const [best, ...alternatives] = ranked;
  return alternatives.every(alternative => hasDecisiveVerticalQuantityAlignment(best.alignment, alternative.alignment)) ? best : null;
}
function attachDetachedMetadata(candidates, lines) {
  const matchesByFragment = new Map();
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const row = lines[lineIndex];
    if (row.isFooter) continue;
    const fragments = Array.isArray(row.items) && row.items.length ? row.items : [row];
    for (const [itemIndex, fragment] of fragments.entries()) {
      if (!fragment.box) continue;
      const fragmentId = `${lineIndex}:${itemIndex}`;
      for (const candidate of candidates) {
        if (!candidate._box || candidate._lineIndex === lineIndex || associationCrossesBoundary(lines, candidate._lineIndex, lineIndex)) continue;
        const metadata = detachedMetadataType(fragment.text, candidate.dosageForm);
        if (!metadata) continue;
        const [, top, right, bottom] = candidate._box;
        const [fragmentLeft, fragmentTop, , fragmentBottom] = fragment.box;
        const verticalDistance = Math.abs((top + bottom) / 2 - (fragmentTop + fragmentBottom) / 2);
        const horizontalGap = fragmentLeft - right;
        const height = Math.max(bottom - top, fragmentBottom - fragmentTop);
        if (verticalDistance > Math.max(28, height * 0.8) || horizontalGap < -12 || horizontalGap > 220) continue;
        const matches = matchesByFragment.get(fragmentId) || [];
        matches.push({ candidate, metadata, fragment });
        matchesByFragment.set(fragmentId, matches);
      }
    }
  }

  for (const matches of matchesByFragment.values()) {
    // Non-quantity metadata still requires exactly one eligible row. Quantities may
    // resolve a tie only when their vertical alignment is decisively stronger.
    let selected = matches.length === 1 ? matches[0] : null;
    if (!selected && matches[0]?.metadata.type === 'quantity') {
      selected = selectDecisiveQuantityMatch(matches, matches[0].fragment);
    }
    if (!selected) continue;
    const { candidate, metadata } = selected;
    if (metadata.type === 'schedule' && !candidate.schedule) candidate.schedule = metadata.value;
    if (metadata.type === 'quantity' && candidate.explicitQuantity === null) {
      candidate.explicitQuantity = metadata.explicit.explicitQuantity;
      candidate.numericQuantity = metadata.explicit.explicitQuantity;
      candidate.prescribedQuantityText = metadata.explicit.prescribedQuantityText;
      candidate.quantityUnit = metadata.explicit.quantityUnit || quantityUnitFromText(metadata.explicit.prescribedQuantityText);
      candidate.quantitySource = 'explicit_prescription_quantity';
      candidate.quantityConfidence = metadata.explicit.quantityConfidence;
    }
    if (metadata.type === 'duration' && candidate.duration === null) {
      candidate.duration = metadata.days;
      candidate.durationText = metadata.value;
    }
    if (metadata.type === 'instruction') {
      const instructions = candidate.instructions ? candidate.instructions.split('; ').filter(Boolean) : [];
      if (!instructions.includes(metadata.value)) instructions.push(metadata.value);
      candidate.instructions = instructions.length ? instructions.join('; ') : null;
    }
  }
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

    // A stop/discontinue annotation terminates the active medicine list conservatively.
    if (STOP_MARKER.test(original)) {
      if (medicines.length > 0 || inMedicineSection) break;
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
    const isNumberedRow = LIST_SERIAL_PREFIX.test(original);
    if (!isPlausibleMedicine(candidate, inMedicineSection, isNumberedRow)) continue;

    // Check if original already has inline directions or explicit quantity
    const hasInlineDirections = /\b(?:take|sig|directions?)\b/i.test(original);
    const inlineRow = parsePrescriptionRow(original);
    const hasInlineExplicitQuantity = Boolean(inlineRow?.explicitInfo || trailingExplicitQuantity(original));
    const trailingDirectionTexts = [];
    const packageContinuations = [];
    if (!hasInlineDirections) {
      for (let j = i + 1; j < lines.length; j++) {
        const nextText = lines[j].text;
        if (isPackageFormContinuation(nextText)) {
          packageContinuations.push(nextText);
          consumedIndices.add(j);
          continue;
        }
        if (STANDALONE_DOSAGE_FORM.test(nextText) || lines[j].isFooter || FOOTER_START_MARKER.test(nextText) || DOCTOR_FOOTER.test(nextText) || PRESCRIBER_IDENTITY.test(nextText)) {
          continue;
        }

        // An explicit-count row may only consume a direct instruction line, not later generic Dose metadata.
        if (hasInlineExplicitQuantity && !INSTRUCTION_START.test(nextText) && !/^\s*(?:sig|directions?)\b/i.test(nextText)) break;

        // FIRST check if nextText is a direction or quantity line
        if (isDirectionOrQuantityLine(nextText)) {
          trailingDirectionTexts.push(nextText);
          consumedIndices.add(j);
          continue;
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

    const reconstructedOriginal = [original, ...packageContinuations].join(' | ');
    const parsed = parseCandidateDetails(reconstructedOriginal, trailingDirectionTexts.join('\n'));
    if (!parsed.medicineText) continue;

    medicines.push({ rawText: candidate, ...parsed, _lineIndex: i, _box: record.box || null });
  }

  attachDetachedMetadata(medicines, lines);
  const seen = new Set();
  return medicines.filter(candidate => {
    if (seen.has(candidate.medicineText)) return false;
    seen.add(candidate.medicineText);
    return true;
  }).map(({ _lineIndex, _box, _metadataMatches, ...candidate }) => candidate);
}

function extractMedicines(text, ocrLines = []) {
  return extractMedicineCandidates(text, ocrLines).map(candidate => candidate.medicineText);
}

function patientNameFromValue(value) {
  let name = trimLayoutArtifacts(value);
  name = name.replace(/(?:\s*[|,]\s*|\s+)(?:Date|Dated|Age|Gender|Sex|UHID|MRN|DOB|Phone|Mobile|OP\s*No|ID|BP|Weight)\b\s*[:/.-]?.*$/i, '');
  name = name.replace(/\s*[|,]\s*$/, '').trim();
  if (!name || name.length < 2 || /^(?:date|age|gender|male|female|\d+)$/i.test(name)) return null;
  return name;
}

function extractPatientName(text, ocrLines = []) {
  if (!text || typeof text !== 'string') return null;
  const label = '(?:Patient\\s*Name|Pt\\.?\\s*Name|Patient|Name)';
  const direct = new RegExp(`(?:^|\\n)\\s*${label}\\s*(?::|/|\\.|-|\\|)\\s*([^\\r\\n]+)`, 'i').exec(text);
  if (direct) return patientNameFromValue(direct[1]);

  const adjacentText = new RegExp(`(?:^|\\n)\\s*${label}\\s*\\n\\s*([^\\r\\n]+)`, 'i').exec(text);
  if (adjacentText) return patientNameFromValue(adjacentText[1]);

  const boxed = Array.isArray(ocrLines) ? ocrLines.filter(line => line && typeof line.text === 'string' && Array.isArray(line.box) && line.box.length === 4) : [];
  const labels = boxed.filter(line => new RegExp(`^\\s*${label}\\s*[:/.-]?\\s*$`, 'i').test(line.text));
  for (const labelLine of labels) {
    const [, top, right, bottom] = labelLine.box;
    const center = (top + bottom) / 2;
    const values = boxed.filter(line => {
      if (line === labelLine || /^(?:UHID|ID|Age|Sex|Gender|DOB|Date|BP|Weight)\b/i.test(line.text)) return false;
      const [left, valueTop, , valueBottom] = line.box;
      return left >= right - 5 && Math.abs((valueTop + valueBottom) / 2 - center) <= Math.max(28, (bottom - top) * 1.2);
    }).sort((a, b) => a.box[0] - b.box[0]);
    if (values.length === 1) {
      const name = patientNameFromValue(values[0].text);
      if (name) return name;
    }
  }
  return null;
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
