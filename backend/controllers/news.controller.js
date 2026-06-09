const NewsModel = require('../models/news.model');
const R = require('../utils/response.utils');

const getAll = async (req, res, next) => {
  try {
    const { category, is_featured, search, limit = 10, offset = 0 } = req.query;
    const isAdmin = req.user?.role === 'admin';

    const result = await NewsModel.findAll({
      status:      isAdmin ? undefined : 'published',
      category,
      is_featured: is_featured !== undefined ? is_featured === 'true' : undefined,
      search,
      limit:       Number(limit),
      offset:      Number(offset)
    });
    return R.success(res, result);
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const news = await NewsModel.findById(req.params.id);
    if (!news) return R.notFound(res, 'Không tìm thấy bài viết');

    const isAdmin = req.user?.role === 'admin';
    if (!isAdmin && news.status !== 'published')
      return R.notFound(res, 'Bài viết không tồn tại hoặc chưa được xuất bản');

    await NewsModel.incrementView(news.id);
    return R.success(res, { news });
  } catch (err) { next(err); }
};

const getBySlug = async (req, res, next) => {
  try {
    const news = await NewsModel.findBySlug(req.params.slug);
    if (!news) return R.notFound(res, 'Không tìm thấy bài viết');
    await NewsModel.incrementView(news.id);
    return R.success(res, { news });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const { title, summary, content, category, is_featured, status } = req.body;

    if (!title || !content) return R.badRequest(res, 'Tiêu đề và nội dung là bắt buộc');

    const validCategories = ['news', 'event', 'announcement', 'health_tips'];
    if (category && !validCategories.includes(category))
      return R.badRequest(res, 'Danh mục không hợp lệ');

    const validStatuses = ['draft', 'published', 'archived'];
    if (status && !validStatuses.includes(status))
      return R.badRequest(res, 'Trạng thái không hợp lệ');

    let slug = NewsModel.generateSlug(title);
    if (await NewsModel.isSlugTaken(slug)) {
      slug = `${slug}-${Date.now()}`;
    }

    const thumbnailPath = req.file ? `/uploads/news/${req.file.filename}` : null;

    const news = await NewsModel.create({
      title, slug, summary, content, category,
      thumbnail:   thumbnailPath,
      author_id:   req.user.id,
      is_featured: is_featured === 'true' || is_featured === true,
      status:      status || 'draft'
    });
    return R.created(res, { news }, 'Tạo bài viết thành công');
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await NewsModel.findById(id);
    if (!existing) return R.notFound(res, 'Không tìm thấy bài viết');

    const { title, summary, content, category, is_featured, status } = req.body;

    const validCategories = ['news', 'event', 'announcement', 'health_tips'];
    if (category && !validCategories.includes(category))
      return R.badRequest(res, 'Danh mục không hợp lệ');

    const validStatuses = ['draft', 'published', 'archived'];
    if (status && !validStatuses.includes(status))
      return R.badRequest(res, 'Trạng thái không hợp lệ');

    let slug;
    if (title && title !== existing.title) {
      slug = NewsModel.generateSlug(title);
      if (await NewsModel.isSlugTaken(slug, id)) {
        slug = `${slug}-${Date.now()}`;
      }
    }

    const thumbnailPath = req.file ? `/uploads/news/${req.file.filename}` : undefined;

    const updated = await NewsModel.update(id, {
      title, slug, summary, content, category, status,
      ...(thumbnailPath    && { thumbnail: thumbnailPath }),
      ...(is_featured !== undefined && { is_featured: is_featured === 'true' || is_featured === true })
    });
    return R.success(res, { news: updated }, 'Cập nhật bài viết thành công');
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const existing = await NewsModel.findById(req.params.id);
    if (!existing) return R.notFound(res, 'Không tìm thấy bài viết');

    await NewsModel.remove(req.params.id);
    return R.success(res, null, 'Xóa bài viết thành công');
  } catch (err) { next(err); }
};

const publish = async (req, res, next) => {
  try {
    const existing = await NewsModel.findById(req.params.id);
    if (!existing) return R.notFound(res, 'Không tìm thấy bài viết');
    if (existing.status === 'published') return R.badRequest(res, 'Bài viết đã được xuất bản');

    const updated = await NewsModel.update(req.params.id, { status: 'published' });
    return R.success(res, { news: updated }, 'Xuất bản bài viết thành công');
  } catch (err) { next(err); }
};

module.exports = { getAll, getById, getBySlug, create, update, remove, publish };