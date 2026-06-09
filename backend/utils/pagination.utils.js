const clampLimit = (limit, max = 200, def = 20) => {
  const n = parseInt(limit, 10);
  if (!Number.isFinite(n) || n < 1) return def;
  return Math.min(n, max);
};

const clampOffset = (offset) => {
  const n = parseInt(offset, 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
};

/** Inline LIMIT/OFFSET — tránh lỗi mysqld_stmt_execute với placeholder LIMIT trên một số bản MySQL */
const sqlLimitOffset = (limit, offset, { max = 200, def = 20 } = {}) => {
  const lim = clampLimit(limit, max, def);
  const off = clampOffset(offset);
  return { clause: `LIMIT ${lim} OFFSET ${off}`, limit: lim, offset: off };
};

module.exports = { clampLimit, clampOffset, sqlLimitOffset };
