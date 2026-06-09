const router = require('express').Router();
const ctrl   = require('../controllers/news.controller');
const { authenticate, optionalAuth } = require('../middlewares/auth.middleware');
const { isAdmin }       = require('../middlewares/role.middleware');
const { uploadNewsImage } = require('../middlewares/upload.middleware');

// Public — Landing page & Dashboard patient hiển thị tin tức
// Dùng optionalAuth để phân biệt admin (xem draft) vs guest (chỉ published)
router.get('/slug/:slug',  ctrl.getBySlug);
router.get('/',            optionalAuth, ctrl.getAll);
router.get('/:id',         optionalAuth, ctrl.getById);

// Admin quản lý bài viết
router.post  ('/',              authenticate, isAdmin, uploadNewsImage, ctrl.create);
router.put   ('/:id',           authenticate, isAdmin, uploadNewsImage, ctrl.update);
router.delete('/:id',           authenticate, isAdmin,                  ctrl.remove);
router.patch ('/:id/publish',   authenticate, isAdmin,                  ctrl.publish);

module.exports = router;