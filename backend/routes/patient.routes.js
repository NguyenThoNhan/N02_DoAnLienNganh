const router = require('express').Router();
const ctrl   = require('../controllers/patient.controller');
const { authenticate }          = require('../middlewares/auth.middleware');
const { isPatient, isAdmin } = require('../middlewares/role.middleware');
const { uploadAvatar }          = require('../middlewares/upload.middleware');

// Bệnh nhân tự xem/cập nhật hồ sơ của mình
router.get ('/profile',          authenticate, isPatient,        ctrl.getProfile);
router.put ('/profile',          authenticate, isPatient, uploadAvatar, ctrl.updateProfile);

// Admin xem danh sách bệnh nhân
router.get ('/',                 authenticate, isAdmin,          ctrl.getAllPatients);

// Bác sĩ / Admin xem chi tiết 1 bệnh nhân (controller tự kiểm tra quyền owner)
router.get ('/:id',              authenticate,  ctrl.getPatientById);

module.exports = router;