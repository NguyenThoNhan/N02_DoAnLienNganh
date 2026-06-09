const router = require('express').Router();
const ctrl   = require('../controllers/chatbot.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { isAdmin }      = require('../middlewares/role.middleware');

// Public — Bệnh nhân gửi tin nhắn (không cần đăng nhập)
router.post('/message', ctrl.getResponse);

// Admin quản lý kịch bản chatbot
router.get   ('/',                 authenticate, isAdmin, ctrl.getAll);
router.get   ('/:id',              authenticate, isAdmin, ctrl.getById);
router.post  ('/',                 authenticate, isAdmin, ctrl.create);
router.put   ('/:id',              authenticate, isAdmin, ctrl.update);
router.delete('/:id',              authenticate, isAdmin, ctrl.remove);
router.patch ('/:id/toggle',       authenticate, isAdmin, ctrl.toggleActive);

module.exports = router;
