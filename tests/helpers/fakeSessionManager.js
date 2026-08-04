class FakeSessionManager {
  constructor() {
    this.sessions = new Map();
    this.messages = new Map();
  }

  async getSession(userId) {
    return this.sessions.get(userId) || null;
  }

  async saveSession(userId, session) {
    const payload = {
      ...session,
      userId,
      updatedAt: new Date().toISOString()
    };
    this.sessions.set(userId, payload);
    return payload;
  }

  async clearSession(userId) {
    this.sessions.delete(userId);
  }

  async getCachedMessageResponse(messageSid) {
    return this.messages.get(messageSid) || null;
  }

  async cacheMessageResponse(messageSid, responseText) {
    this.messages.set(messageSid, { responseText });
  }
}

module.exports = FakeSessionManager;
