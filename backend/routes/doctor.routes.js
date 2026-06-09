const router = require('express').Router();
const ctrl   = require('../controllers/doctor.controller');
const { authenticate }          = require('../middlewares/auth.middleware');
const { isAdmin, isDoctor }     = require('../middlewares/role.middleware');
const { uploadAvatar }          = require('../middlewares/upload.middleware');

// Doctor xem hồ sơ của chính mình — PHẢI đứng trước /:id để tránh conflict
router.get ('/me/profile',              authenticate, isDoctor, ctrl.getMyProfile);
router.put ('/me/profile',              authenticate, isDoctor, uploadAvatar, ctrl.updateMyProfile);

// Public — Bệnh nhân tra cứu bác sĩ khi đặt lịch
router.get ('/',                        ctrl.getAll);
router.get ('/by-title/:title',         ctrl.getByTitle);
router.get ('/by-department/:deptId',   ctrl.getByDepartment);
router.get ('/:id',                     ctrl.getById);
router.get ('/:id/available-slots',     ctrl.getAvailableSlots);

// Admin quản lý bác sĩ
router.post('/',                        authenticate, isAdmin, uploadAvatar, ctrl.create);
router.put ('/:id',                     authenticate, isAdmin, uploadAvatar, ctrl.update);

module.exports = router;