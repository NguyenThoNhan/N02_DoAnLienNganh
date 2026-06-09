const ChatbotModel = require('../models/chatbot.model');
const R = require('../utils/response.utils');

// ─── PUBLIC: Bệnh nhân gửi tin nhắn ───────────────────────────────
const getResponse = async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message || message.trim().length === 0)
      return R.badRequest(res, 'Tin nhắn không được để trống');

    if (message.trim().length > 500)
      return R.badRequest(res, 'Tin nhắn quá dài (tối đa 500 ký tự)');

    const result = await ChatbotModel.findResponse(message.trim());
    return R.success(res, {
      message:     result.response,
      intent:      result.intent,
      action_type: result.action_type,
      action_url:  result.action_url,
      timestamp:   new Date().toISOString()
    });
  } catch (err) { next(err); }
};

// ─── ADMIN: Quản lý kịch bản ──────────────────────────────────────
const getAll = async (req, res, next) => {
  try {
    const { active_only } = req.query;
    const intents = await ChatbotModel.findAll(active_only === 'true');
    return R.success(res, { intents });
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const intent = await ChatbotModel.findById(req.params.id);
    if (!intent) return R.notFound(res, 'Không tìm thấy kịch bản chatbot');
    return R.success(res, { intent });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const { intent_name, keywords, response, action_type, action_url, priority, is_active } = req.body;

    if (!intent_name || !response)
      return R.badRequest(res, 'intent_name và response là bắt buộc');

    if (!Array.isArray(keywords))
      return R.badRequest(res, 'keywords phải là mảng chuỗi, ví dụ: ["đặt lịch", "booking"]');

    const validActions = ['text', 'redirect', 'faq'];
    if (action_type && !validActions.includes(action_type))
      return R.badRequest(res, 'action_type phải là text, redirect hoặc faq');

    if (action_type === 'redirect' && !action_url)
      return R.badRequest(res, 'action_url là bắt buộc khi action_type là redirect');

    const intent = await ChatbotModel.create({
      intent_name, keywords, response,
      action_type: action_type || 'text',
      action_url:  action_url  || null,
      priority:    Number(priority) || 0,
      is_active:   is_active !== false
    });
    return R.created(res, { intent }, 'Tạo kịch bản chatbot thành công');
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return R.conflict(res, 'intent_name đã tồn tại');
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await ChatbotModel.findById(id);
    if (!existing) return R.notFound(res, 'Không tìm thấy kịch bản chatbot');

    const { intent_name, keywords, response, action_type, action_url, priority, is_active } = req.body;

    if (keywords !== undefined && !Array.isArray(keywords))
      return R.badRequest(res, 'keywords phải là mảng chuỗi');

    const validActions = ['text', 'redirect', 'faq'];
    if (action_type && !validActions.includes(action_type))
      return R.badRequest(res, 'action_type phải là text, redirect hoặc faq');

    const updated = await ChatbotModel.update(id, {
      intent_name, keywords, response, action_type, action_url,
      ...(priority  !== undefined && { priority:  Number(priority) }),
      ...(is_active !== undefined && { is_active })
    });
    return R.success(res, { intent: updated }, 'Cập nhật kịch bản chatbot thành công');
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return R.conflict(res, 'intent_name đã tồn tại');
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const existing = await ChatbotModel.findById(req.params.id);
    if (!existing) return R.notFound(res, 'Không tìm thấy kịch bản chatbot');
    if (existing.intent_name === 'fallback')
      return R.badRequest(res, 'Không thể xóa kịch bản fallback mặc định');

    await ChatbotModel.remove(req.params.id);
    return R.success(res, null, 'Xóa kịch bản chatbot thành công');
  } catch (err) { next(err); }
};

const toggleActive = async (req, res, next) => {
  try {
    const existing = await ChatbotModel.findById(req.params.id);
    if (!existing) return R.notFound(res, 'Không tìm thấy kịch bản chatbot');
    if (existing.intent_name === 'fallback')
      return R.badRequest(res, 'Không thể tắt kịch bản fallback mặc định');

    const updated = await ChatbotModel.toggleActive(req.params.id);
    const status  = updated.is_active ? 'kích hoạt' : 'tắt';
    return R.success(res, { intent: updated }, `Đã ${status} kịch bản thành công`);
  } catch (err) { next(err); }
};

module.exports = { getResponse, getAll, getById, create, update, remove, toggleActive };