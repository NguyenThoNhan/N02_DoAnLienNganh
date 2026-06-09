const router = require('express').Router();
const ctrl   = require('../controllers/admin.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { isAdmin }      = require('../middlewares/role.middleware');

// Toàn bộ route admin đều yêu cầu xác thực + quyền admin
router.use(authenticate, isAdmin);

// Dashboard & thống kê
router.get('/stats',              ctrl.getDashboardStats);
router.get('/revenue',            ctrl.getRevenueChart);
router.get('/top-doctors',        ctrl.getTopDoctors);
router.get('/department-stats',   ctrl.getDepartmentStats);

// Quản lý người dùng
router.get ('/users',             ctrl.getUserStats);
router.patch('/users/:id/status', ctrl.updateUserStatus);

module.exports = router;