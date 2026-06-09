const db = require('../config/db');
const { sqlLimitOffset } = require('../utils/pagination.utils');

const NEWS_BASE_SELECT = `
  n.id, n.title, n.slug, n.summary, n.thumbnail, n.category,
  n.is_featured, n.view_count, n.status, n.published_at, n.created_at, n.updated_at,
  u.full_name AS author_name
`;

const findAll = async ({ status, category, is_featured, search, limit = 10, offset = 0 } = {}) => {
  const conditions = [];
  const values = [];

  if (status)      { conditions.push('n.status = ?');      values.push(status); }
  if (category)    { conditions.push('n.category = ?');    values.push(category); }
  if (is_featured !== undefined) { conditions.push('n.is_featured = ?'); values.push(is_featured ? 1 : 0); }
  if (search) {
    conditions.push('(n.title LIKE ? OR n.summary LIKE ?)');
    const like = `%${search}%`;
    values.push(like, like);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { clause } = sqlLimitOffset(limit, offset);
  const [rows] = await db.execute(
    `SELECT ${NEWS_BASE_SELECT}
     FROM news n
     INNER JOIN users u ON u.id = n.author_id
     ${where}
     ORDER BY n.published_at DESC, n.created_at DESC
     ${clause}`,
    values
  );
  const [[{ total }]] = await db.execute(
    `SELECT COUNT(*) as total FROM news n ${where}`, values
  );
  return { data: rows, total };
};

const findById = async (id) => {
  const [rows] = await db.execute(
    `SELECT ${NEWS_BASE_SELECT}, n.content
     FROM news n
     INNER JOIN users u ON u.id = n.author_id
     WHERE n.id = ?`,
    [id]
  );
  return rows[0] || null;
};

const findBySlug = async (slug) => {
  const [rows] = await db.execute(
    `SELECT ${NEWS_BASE_SELECT}, n.content
     FROM news n
     INNER JOIN users u ON u.id = n.author_id
     WHERE n.slug = ? AND n.status = 'published'`,
    [slug]
  );
  return rows[0] || null;
};

const create = async ({ title, slug, summary, content, thumbnail, category, author_id, is_featured, status }) => {
  const published_at = status === 'published' ? new Date() : null;
  const [result] = await db.execute(
    `INSERT INTO news (title, slug, summary, content, thumbnail, category, author_id, is_featured, status, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [title, slug, summary || null, content, thumbnail || null, category || 'news',
     author_id, is_featured ? 1 : 0, status || 'draft', published_at]
  );
  return findById(result.insertId);
};

const update = async (id, { title, slug, summary, content, thumbnail, category, is_featured, status }) => {
  const fields = [];
  const values = [];

  if (title       !== undefined) { fields.push('title = ?');       values.push(title); }
  if (slug        !== undefined) { fields.push('slug = ?');        values.push(slug); }
  if (summary     !== undefined) { fields.push('summary = ?');     values.push(summary); }
  if (content     !== undefined) { fields.push('content = ?');     values.push(content); }
  if (thumbnail   !== undefined) { fields.push('thumbnail = ?');   values.push(thumbnail); }
  if (category    !== undefined) { fields.push('category = ?');    values.push(category); }
  if (is_featured !== undefined) { fields.push('is_featured = ?'); values.push(is_featured ? 1 : 0); }
  if (status      !== undefined) {
    fields.push('status = ?');
    values.push(status);
    if (status === 'published') {
      fields.push('published_at = COALESCE(published_at, NOW())');
    }
  }

  if (fields.length === 0) return findById(id);
  values.push(id);
  await db.execute(`UPDATE news SET ${fields.join(', ')} WHERE id = ?`, values);
  return findById(id);
};

const remove = async (id) => {
  const [result] = await db.execute(`DELETE FROM news WHERE id = ?`, [id]);
  return result.affectedRows > 0;
};

const incrementView = async (id) => {
  await db.execute(`UPDATE news SET view_count = view_count + 1 WHERE id = ?`, [id]);
};

const isSlugTaken = async (slug, excludeId = null) => {
  const sql = excludeId
    ? `SELECT id FROM news WHERE slug = ? AND id != ?`
    : `SELECT id FROM news WHERE slug = ?`;
  const [rows] = await db.execute(sql, excludeId ? [slug, excludeId] : [slug]);
  return rows.length > 0;
};

const generateSlug = (title) => {
  const map = { à:'a',á:'a',ả:'a',ã:'a',ạ:'a',ă:'a',ắ:'a',ằ:'a',ẳ:'a',ẵ:'a',ặ:'a',â:'a',ấ:'a',ầ:'a',ẩ:'a',ẫ:'a',ậ:'a',đ:'d',è:'e',é:'e',ẻ:'e',ẽ:'e',ẹ:'e',ê:'e',ế:'e',ề:'e',ể:'e',ễ:'e',ệ:'e',ì:'i',í:'i',ỉ:'i',ĩ:'i',ị:'i',ò:'o',ó:'o',ỏ:'o',õ:'o',ọ:'o',ô:'o',ố:'o',ồ:'o',ổ:'o',ỗ:'o',ộ:'o',ơ:'o',ớ:'o',ờ:'o',ở:'o',ỡ:'o',ợ:'o',ù:'u',ú:'u',ủ:'u',ũ:'u',ụ:'u',ư:'u',ứ:'u',ừ:'u',ử:'u',ữ:'u',ự:'u',ỳ:'y',ý:'y',ỷ:'y',ỹ:'y',ỵ:'y' };
  return title.toLowerCase()
    .split('').map(c => map[c] || c).join('')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim().replace(/\s+/g, '-').replace(/-+/g, '-');
};

module.exports = { findAll, findById, findBySlug, create, update, remove, incrementView, isSlugTaken, generateSlug };