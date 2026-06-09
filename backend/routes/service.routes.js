const router = require('express').Router();
const ctrl   = require('../controllers/service.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { isAdmin }      = require('../middlewares/role.middleware');

// Public — Bệnh nhân tra cứu giá dịch vụ trước khi đặt lịch
router.get('/price-map',      ctrl.getPriceMap);
router.get('/type/:type',     ctrl.getByType);
router.get('/',               ctrl.getAll);
router.get('/:id',            ctrl.getById);

// Admin CRUD bảng giá
router.post  ('/',     authenticate, isAdmin, ctrl.create);
router.put   ('/:id',  authenticate, isAdmin, ctrl.update);
router.delete('/:id',  authenticate, isAdmin, ctrl.remove);

module.exports = router;