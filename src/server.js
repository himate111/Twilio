const createApp = require('./app');
const env = require('./config/env');

const app = createApp();

app.listen(env.port, () => {
  console.log(`SERVER RUNNING ON ${env.port}`);
});