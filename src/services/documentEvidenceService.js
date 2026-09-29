function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalisePolygon(polygon) {
  if (!Array.isArray(polygon)) return null;
  const values = polygon.map(finiteNumber);
  return values.some(value => value === null) ? null : values;
}

function normaliseSpans(spans) {
  if (!Array.isArray(spans)) return [];
  return spans.map(span => ({
    offset: finiteNumber(span?.offset),
    length: finiteNumber(span?.length)
  }));
}

function normaliseBoundingRegions(regions) {
  if (!Array.isArray(regions)) return [];
  return regions.map(region => ({
    pageNumber: Number.isInteger(region?.pageNumber) ? region.pageNumber : null,
    polygon: normalisePolygon(region?.polygon)
  }));
}

function normaliseWord(word) {
  return {
    text: String(word?.content || '').trim(),
    polygon: normalisePolygon(word?.polygon),
    confidence: finiteNumber(word?.confidence),
    spans: normaliseSpans(word?.spans)
  };
}

function normaliseLine(line, readingOrder) {
  return {
    text: String(line?.content || '').trim(),
    polygon: normalisePolygon(line?.polygon),
    confidence: finiteNumber(line?.confidence),
    spans: normaliseSpans(line?.spans),
    readingOrder
  };
}

function normaliseParagraph(paragraph) {
  return {
    text: String(paragraph?.content || '').trim(),
    role: typeof paragraph?.role === 'string' ? paragraph.role : null,
    spans: normaliseSpans(paragraph?.spans),
    boundingRegions: normaliseBoundingRegions(paragraph?.boundingRegions)
  };
}

function normaliseTableCell(cell) {
  return {
    text: String(cell?.content || '').trim(),
    rowIndex: finiteNumber(cell?.rowIndex),
    columnIndex: finiteNumber(cell?.columnIndex),
    rowSpan: finiteNumber(cell?.rowSpan),
    columnSpan: finiteNumber(cell?.columnSpan),
    kind: typeof cell?.kind === 'string' ? cell.kind : null,
    spans: normaliseSpans(cell?.spans),
    boundingRegions: normaliseBoundingRegions(cell?.boundingRegions)
  };
}

function normaliseTable(table) {
  return {
    rowCount: finiteNumber(table?.rowCount),
    columnCount: finiteNumber(table?.columnCount),
    spans: normaliseSpans(table?.spans),
    boundingRegions: normaliseBoundingRegions(table?.boundingRegions),
    cells: Array.isArray(table?.cells) ? table.cells.map(normaliseTableCell) : []
  };
}

function normaliseAzureLayoutEvidence(analyzeResult) {
  if (!analyzeResult || !Array.isArray(analyzeResult.pages)) {
    throw new Error('Azure Layout returned a malformed response.');
  }

  return {
    source: 'azure-document-intelligence-prebuilt-layout',
    pages: analyzeResult.pages.map((page, pageIndex) => ({
      pageNumber: Number.isInteger(page?.pageNumber) ? page.pageNumber : pageIndex + 1,
      width: finiteNumber(page?.width),
      height: finiteNumber(page?.height),
      unit: typeof page?.unit === 'string' ? page.unit : null,
      angle: finiteNumber(page?.angle),
      words: Array.isArray(page?.words)
        ? page.words.map(normaliseWord)
        : [],
      lines: Array.isArray(page?.lines)
        ? page.lines.map((line, lineIndex) => normaliseLine(line, lineIndex))
        : []
    })),
    paragraphs: Array.isArray(analyzeResult.paragraphs)
      ? analyzeResult.paragraphs.map(normaliseParagraph)
      : [],
    tables: Array.isArray(analyzeResult.tables)
      ? analyzeResult.tables.map(normaliseTable)
      : []
  };
}

function structuralMetrics(evidence) {
  const pages = Array.isArray(evidence?.pages) ? evidence.pages : [];
  const lines = pages.reduce((count, page) => count + (page.lines?.length || 0), 0);
  const words = pages.reduce((count, page) => count + (page.words?.length || 0), 0);
  return {
    pages: pages.length,
    lines,
    words,
    tables: Array.isArray(evidence?.tables) ? evidence.tables.length : 0,
    paragraphs: Array.isArray(evidence?.paragraphs) ? evidence.paragraphs.length : 0
  };
}

module.exports = {
  normaliseAzureLayoutEvidence,
  structuralMetrics
};
