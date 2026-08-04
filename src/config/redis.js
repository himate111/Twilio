const Redis = require('ioredis');
const env = require('./env');

let redisClient;

function getRedisClient() {
  if (!env.redisUrl) {
    return null;
  }

  if (!redisClient) {
    redisClient = new Redis(env.redisUrl, {
      lazyConnect: false,
      maxRetriesPerRequest: 2,
      enableReadyCheck: true
    });
  }

  return redisClient;
}

async function closeRedisClient() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = undefined;
  }
}

module.exports = {
  getRedisClient,
  closeRedisClient
};
