const router = require('express').Router();
const ctrl   = require('../controllers/examination.controller');
const { authenticate }       = require('../middlewares/auth.middleware');
const { isDoctor }           = require('../middlewares/role.middleware');
const { uploadLabResult }    = require('../middlewares/upload.middleware');

// Tất cả route đều yêu cầu authenticate + isDoctor
router.use(authenticate, isDoctor);

// Hàng chờ bệnh nhân
router.get ('/queue/today',                         ctrl.getTodayQueue);
router.get ('/queue',                               ctrl.getQueueByDate);

// Gợi ý thuốc theo chẩn đoán (dùng ở trang examination)
router.get ('/drug-suggestions',                    ctrl.getDrugSuggestions);

// Lịch sử bệnh lý của bệnh nhân (bác sĩ tra cứu)
router.get ('/patients/:patientId/history',         ctrl.getPatientHistory);

// Tiếp nhận ca khám
router.patch('/appointments/:appointmentId/accept', ctrl.acceptPatient);

// Cập nhật thông tin khám (triệu chứng, sinh hiệu, chẩn đoán)
router.put  ('/records/:recordId',                  ctrl.updateExamination);

// Chỉ định xét nghiệm
router.post ('/records/:recordId/lab-tests',        ctrl.orderLabTests);

// Xem danh sách xét nghiệm của ca khám
router.get  ('/records/:recordId/lab-tests',        ctrl.getLabResults);

// Demo điền kết quả mẫu
router.post ('/records/:recordId/lab-tests/demo',   ctrl.fillDemoLabResults);

// Upload ảnh kết quả xét nghiệm
router.put  ('/lab-results/:labResultId/upload',    uploadLabResult, ctrl.uploadLabResult);

// Kê đơn thuốc
router.post ('/records/:recordId/prescription',     ctrl.savePrescription);

// Kết thúc ca khám
router.patch('/records/:recordId/finish',           ctrl.finishExamination);

module.exports = router;