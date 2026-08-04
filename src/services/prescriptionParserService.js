function extractMedicines(text) {

  const medicines = [];

  const lines =
    text
      .split('\n')
      .map(x => x.trim())
      .filter(Boolean);

  for (let line of lines) {

    // Skip obvious non-medicine lines
    if (
      /patient|address|date|dea|refill|doctor|sign|print last name|duluth|mn\s+\d+/i
        .test(line)
    ) {
      continue;
    }

    line = line
      .replace(/^Rx\s+/i, '')
      .replace(/^\d+\.\s*/, '')
      .replace(/#\d+/g, '')
      .replace(/\(.*?\)/g, '')
      .replace(/\bTake\b.*$/i, '')
      .replace(/\bDirections\b.*$/i, '')
      .replace(/\bSig\b.*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (line.length < 3) {
      continue;
    }

    // Must contain letters
    if (!/[a-z]/i.test(line)) {
      continue;
    }

    // Reject address-like lines
    if (
      /\d{5}/.test(line) ||
      /avenue|street|road|lane|city|state/i.test(line)
    ) {
      continue;
    }
   


const words =
  line.split(' ')
      .filter(Boolean);

if (words.length < 1) {
  continue;
}

if (
  line.length < 8
) {
  continue;
}

if (
  !/[a-z]{4,}/i.test(line)
) {
  continue;
}


const alphaWords =
  words.filter(
    w => /[a-z]{4,}/i.test(w)
  );

if (
  alphaWords.length === 0
) {
  continue;
}

if (
  /\b(twice|daily|days|food|morning|night|tablet|capsule|ml)\b/i
    .test(line)
) {
  continue;
}

console.log(
  'MEDICINE DETECTED:',
  line
);

    medicines.push(line);
  }

  return [...new Set(medicines)];
}

function extractPatientName(text) {

  const match =
    text.match(
      /Patient Name:\s*(.+?)\s+Date:/i
    );

  if (!match) {
    return null;
  }

  return match[1].trim();
}

module.exports = {
  extractMedicines,
  extractPatientName
};



