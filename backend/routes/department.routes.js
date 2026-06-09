const router = require('express').Router();
const ctrl   = require('../controllers/department.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { isAdmin }      = require('../middlewares/role.middleware');

// Public — Bệnh nhân xem danh sách khoa khi đặt lịch / landing page
router.get ('/',     ctrl.getAll);
router.get ('/:id',  ctrl.getById);

// Admin CRUD danh mục khoa
router.post  ('/',     authenticate, isAdmin, ctrl.create);
router.put   ('/:id',  authenticate, isAdmin, ctrl.update);
router.delete('/:id',  authenticate, isAdmin, ctrl.remove);

module.exports = router;