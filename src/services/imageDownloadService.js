const axios = require('axios');
const fs = require('fs');

async function downloadImage(
  url,
  filePath
) {

 const response = await axios({
  url,
  method: 'GET',
  responseType: 'stream',
  auth: {
    username: process.env.TWILIO_ACCOUNT_SID,
    password: process.env.TWILIO_AUTH_TOKEN
  }
});

  await new Promise(
    (resolve, reject) => {

      const writer =
        fs.createWriteStream(
          filePath
        );

      response.data.pipe(writer);

      writer.on(
        'finish',
        resolve
      );

      writer.on(
        'error',
        reject
      );
    }
  );

  return filePath;
}

module.exports = {
  downloadImage
};