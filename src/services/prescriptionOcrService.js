const Tesseract = require('tesseract.js');

async function extractText(imagePath) {

const result =
  await Tesseract.recognize(
    imagePath,
    'eng',
    {
      logger: m => console.log(m)
    }
  );

console.log('====================');
console.log('OCR TEXT');
console.log(result.data.text);
console.log('====================');

return result.data.text;}

module.exports = {
  extractText
};