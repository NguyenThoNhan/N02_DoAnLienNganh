const router = require('express').Router();
const ctrl   = require('../controllers/drug.controller');
const { authenticate }            = require('../middlewares/auth.middleware');
const { isAdmin, isDoctorOrAdmin } = require('../middlewares/role.middleware');

// ─── DANH MỤC BỆNH ────────────────────────────────────────────────

// Bác sĩ tra gợi ý thuốc theo tên bệnh (query: ?disease_name=...)
router.get ('/suggestions',                authenticate, isDoctorOrAdmin, ctrl.getSuggestionsByDisease);

// Admin & Doctor đều cần xem danh sách bệnh
router.get ('/diseases',                   authenticate, isDoctorOrAdmin, ctrl.getAllDiseases);
router.get ('/diseases/:id',               authenticate, isDoctorOrAdmin, ctrl.getDiseaseDetail);

// Admin tạo bệnh & cấu hình gợi ý bệnh - thuốc
router.post('/diseases',                   authenticate, isAdmin,         ctrl.createDisease);
router.put ('/diseases/:id/drug-mappings', authenticate, isAdmin,         ctrl.linkDiseaseDrug);

// ─── KHO THUỐC ────────────────────────────────────────────────────

// Admin & Doctor xem danh sách thuốc (khi kê đơn)
router.get ('/',        authenticate, isDoctorOrAdmin, ctrl.getAllDrugs);
router.get ('/:id',     authenticate, isDoctorOrAdmin, ctrl.getDrugById);

// Admin CRUD thuốc
router.post  ('/',           authenticate, isAdmin, ctrl.createDrug);
router.put   ('/:id',        authenticate, isAdmin, ctrl.updateDrug);
router.delete('/:id',        authenticate, isAdmin, ctrl.removeDrug);
router.patch ('/:id/stock',  authenticate, isAdmin, ctrl.adjustStock);

module.exports = router;