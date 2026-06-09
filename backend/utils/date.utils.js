const toVNDate = (date) => {
  if (!date) return null;
  return new Date(date).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
};

const toVNDateTime = (date) => {
  if (!date) return null;
  return new Date(date).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
};

const toMySQLDate = (date) => {
  if (!date) return null;
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const toMySQLDateTime = (date) => {
  if (!date) return null;
  const d = new Date(date);
  return d.toISOString().slice(0, 19).replace('T', ' ');
};

const isValidDate = (str) => {
  const d = new Date(str);
  return !isNaN(d.getTime());
};

const isValidTimeSlot = (slot) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(slot);

const isFutureDate = (dateStr) => {
  const d = new Date(`${String(dateStr).slice(0, 10)}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d >= today;
};

const diffDays = (date1, date2) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
};

module.exports = { toVNDate, toVNDateTime, toMySQLDate, toMySQLDateTime, isValidDate, isValidTimeSlot, isFutureDate, diffDays };