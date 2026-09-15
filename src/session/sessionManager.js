const env = require('../config/env');
const { getRedisClient } = require('../config/redis');

class SessionManager {
  constructor(options = {}) {
    this.redis = options.redis === undefined ? getRedisClient() : options.redis;
    this.ttlSeconds = options.ttlSeconds || env.sessionTtlSeconds;
    this.prefix = options.prefix || 'drug-supply:session';
    this.messagePrefix = options.messagePrefix || 'drug-supply:message';
    this.memorySessions = new Map();
    this.memoryMessages = new Map();
  }

  sessionKey(userId) {
    return `${this.prefix}:${userId}`;
  }

  messageKey(messageSid) {
    return `${this.messagePrefix}:${messageSid}`;
  }

  getMemoryValue(map, key) {
    const value = map.get(key);
    if (!value) {
      return null;
    }

    if (value.expiresAt <= Date.now()) {
      map.delete(key);
      return null;
    }

    return value.payload;
  }

  setMemoryValue(map, key, payload, ttlSeconds = this.ttlSeconds) {
    map.set(key, {
      payload,
      expiresAt: Date.now() + ttlSeconds * 1000
    });
  }

  async getSession(userId) {
    const key = this.sessionKey(userId);

    if (this.redis) {
      const raw = await this.redis.get(key);
      return raw ? JSON.parse(raw) : null;
    }

    return this.getMemoryValue(this.memorySessions, key);
  }

  async saveSession(userId, session) {
    const payload = {
      ...session,
      userId,
      updatedAt: new Date().toISOString()
    };
    const key = this.sessionKey(userId);

    if (this.redis) {
      await this.redis.set(key, JSON.stringify(payload), 'EX', this.ttlSeconds);
      return payload;
    }

    this.setMemoryValue(this.memorySessions, key, payload);
    return payload;
  }

  async clearSession(userId) {
    const key = this.sessionKey(userId);

    if (this.redis) {
      await this.redis.del(key);
      return;
    }

    this.memorySessions.delete(key);
  }

  async getCachedMessageResponse(messageSid) {
    if (!messageSid) {
      return null;
    }

    const key = this.messageKey(messageSid);

    if (this.redis) {
      const raw = await this.redis.get(key);
      return raw ? JSON.parse(raw) : null;
    }

    return this.getMemoryValue(this.memoryMessages, key);
  }

  async cacheMessageResponse(messageSid, responseText) {
    if (!messageSid) {
      return;
    }

    const key = this.messageKey(messageSid);
    const payload = {
      responseText,
      processedAt: new Date().toISOString()
    };

    if (this.redis) {
      await this.redis.set(key, JSON.stringify(payload), 'EX', this.ttlSeconds);
      return;
    }

    this.setMemoryValue(this.memoryMessages, key, payload);
  }

  async acquireMessageProcessing(messageSid) {
    if (!messageSid) {
      return true;
    }

    const key = this.messageKey(messageSid);
    const payload = JSON.stringify({
      state: 'processing',
      startedAt: new Date().toISOString()
    });

    if (this.redis) {
      const result = await this.redis.set(key, payload, 'EX', this.ttlSeconds, 'NX');
      return result === 'OK';
    }

    if (this.getMemoryValue(this.memoryMessages, key)) {
      return false;
    }

    this.setMemoryValue(this.memoryMessages, key, JSON.parse(payload));
    return true;
  }

  async completeMessageProcessing(messageSid, responseText) {
    if (!messageSid) {
      return;
    }

    const key = this.messageKey(messageSid);
    const payload = {
      state: 'completed',
      responseText,
      processedAt: new Date().toISOString()
    };

    if (this.redis) {
      await this.redis.set(key, JSON.stringify(payload), 'EX', this.ttlSeconds);
      return;
    }

    this.setMemoryValue(this.memoryMessages, key, payload);
  }
}

module.exports = SessionManager;
