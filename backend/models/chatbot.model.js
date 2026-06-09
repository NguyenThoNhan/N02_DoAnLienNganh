const db = require('../config/db');
const { detectSpecialIntent, getImprovedFallback } = require('../utils/chatbot.utils');

const findAll = async (activeOnly = false) => {
  const where = activeOnly ? 'WHERE is_active = 1' : '';
  const [rows] = await db.execute(
    `SELECT id, intent_name, keywords, response, action_type, action_url, priority, is_active, created_at, updated_at
     FROM chatbot_intents ${where}
     ORDER BY priority DESC, id ASC`
  );
  return rows.map(r => ({ ...r, keywords: safeParseJSON(r.keywords, []) }));
};

const findById = async (id) => {
  const [rows] = await db.execute(
    `SELECT id, intent_name, keywords, response, action_type, action_url, priority, is_active, created_at, updated_at
     FROM chatbot_intents WHERE id = ?`,
    [id]
  );
  if (!rows[0]) return null;
  return { ...rows[0], keywords: safeParseJSON(rows[0].keywords, []) };
};

const findResponse = async (message) => {
  const [intents] = await db.execute(
    `SELECT id, intent_name, keywords, response, action_type, action_url, priority
     FROM chatbot_intents
     WHERE is_active = 1
     ORDER BY priority DESC`
  );

  const normalized = message.toLowerCase().trim();

  const special = detectSpecialIntent(normalized);
  if (special) {
    return {
      intent: special.intent,
      response: special.response,
      action_type: special.action_type,
      action_url: special.action_url
    };
  }

  for (const intent of intents) {
    if (intent.intent_name === 'fallback') continue;
    const keywords = safeParseJSON(intent.keywords, []);
    const matched = keywords.some(kw => normalized.includes(kw.toLowerCase()));
    if (matched) {
      return {
        intent:      intent.intent_name,
        response:    intent.response,
        action_type: intent.action_type,
        action_url:  intent.action_url
      };
    }
  }

  const [fallback] = await db.execute(
    `SELECT response, action_type, action_url FROM chatbot_intents
     WHERE intent_name = 'fallback' AND is_active = 1 LIMIT 1`
  );

  if (fallback.length) {
    return {
      intent:      'fallback',
      response:    fallback[0].response,
      action_type: fallback[0].action_type,
      action_url:  fallback[0].action_url
    };
  }

  const fb = getImprovedFallback();
  return {
    intent: fb.intent,
    response: fb.response,
    action_type: fb.action_type,
    action_url: fb.action_url
  };
};

const create = async ({ intent_name, keywords, response, action_type, action_url, priority, is_active }) => {
  const keywordsJson = Array.isArray(keywords) ? JSON.stringify(keywords) : keywords;
  const [result] = await db.execute(
    `INSERT INTO chatbot_intents (intent_name, keywords, response, action_type, action_url, priority, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [intent_name, keywordsJson, response, action_type || 'text', action_url || null, priority || 0, is_active !== false ? 1 : 0]
  );
  return findById(result.insertId);
};

const update = async (id, { intent_name, keywords, response, action_type, action_url, priority, is_active }) => {
  const fields = [];
  const values = [];

  if (intent_name !== undefined) { fields.push('intent_name = ?'); values.push(intent_name); }
  if (keywords    !== undefined) {
    fields.push('keywords = ?');
    values.push(Array.isArray(keywords) ? JSON.stringify(keywords) : keywords);
  }
  if (response    !== undefined) { fields.push('response = ?');    values.push(response); }
  if (action_type !== undefined) { fields.push('action_type = ?'); values.push(action_type); }
  if (action_url  !== undefined) { fields.push('action_url = ?');  values.push(action_url); }
  if (priority    !== undefined) { fields.push('priority = ?');    values.push(priority); }
  if (is_active   !== undefined) { fields.push('is_active = ?');   values.push(is_active ? 1 : 0); }

  if (fields.length === 0) return findById(id);
  values.push(id);
  await db.execute(`UPDATE chatbot_intents SET ${fields.join(', ')} WHERE id = ?`, values);
  return findById(id);
};

const remove = async (id) => {
  const [result] = await db.execute(`DELETE FROM chatbot_intents WHERE id = ?`, [id]);
  return result.affectedRows > 0;
};

const toggleActive = async (id) => {
  await db.execute(
    `UPDATE chatbot_intents SET is_active = NOT is_active WHERE id = ?`, [id]
  );
  return findById(id);
};

const safeParseJSON = (str, fallback = []) => {
  try { return JSON.parse(str); } catch { return fallback; }
};

module.exports = { findAll, findById, findResponse, create, update, remove, toggleActive };
