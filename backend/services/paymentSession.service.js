const crypto = require('crypto');

const sessions = new Map();
const TTL_MS = 30 * 60 * 1000;

const prune = () => {
  const now = Date.now();
  for (const [token, s] of sessions) {
    if (now - s.created > TTL_MS) sessions.delete(token);
  }
};

const create = (recordId, patientId) => {
  prune();
  const token = crypto.randomBytes(16).toString('hex');
  sessions.set(token, {
    recordId: Number(recordId),
    patientId: Number(patientId),
    created: Date.now(),
    paid: false
  });
  return token;
};

const get = (token) => {
  prune();
  const s = sessions.get(token);
  if (!s) return null;
  if (Date.now() - s.created > TTL_MS) {
    sessions.delete(token);
    return null;
  }
  return s;
};

const markPaid = (token) => {
  const s = get(token);
  if (!s) return null;
  s.paid = true;
  sessions.set(token, s);
  return s;
};

const isPaid = (recordId) => {
  prune();
  for (const s of sessions.values()) {
    if (s.recordId === Number(recordId) && s.paid) return true;
  }
  return false;
};

module.exports = { create, get, markPaid, isPaid };
