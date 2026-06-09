const router = require('express').Router();
const ctrl   = require('../controllers/record.controller');
const { authenticate }                   = require('../middlewares/auth.middleware');
const { isPatient, isAdmin, isDoctorOrAdmin } = require('../middlewares/role.middleware');

// Bệnh nhân xem lịch sử của chính mình
router.get('/my',                              authenticate, isPatient,       ctrl.getMyHistory);

// Bác sĩ / Admin xem lịch sử của 1 bệnh nhân bất kỳ
router.get('/patient/:patientId',              authenticate, isDoctorOrAdmin, ctrl.getPatientHistory);

// Lấy sổ sức khỏe theo appointment_id (patient chủ | doctor liên quan | admin)
router.get('/by-appointment/:appointmentId',   authenticate,                  ctrl.getRecordByAppointment);

// Chi tiết 1 sổ sức khỏe: chẩn đoán + đơn thuốc + kết quả XN
router.get('/:id',                             authenticate,                  ctrl.getRecordDetail);

// Lấy dữ liệu QR thanh toán
router.get('/:id/payment-qr',                  authenticate,                  ctrl.getPaymentQR);

// Polling trạng thái thanh toán (sau khi quét QR trên điện thoại)
router.get('/:id/payment-status',              authenticate, isPatient,       ctrl.getPaymentStatus);

// Bệnh nhân xác nhận đã thanh toán (giả lập)
router.patch('/:id/payment',                   authenticate, isPatient,       ctrl.updatePayment);

// Admin xác nhận thanh toán thay
router.patch('/:id/payment/admin',             authenticate, isAdmin,         ctrl.updatePayment);

module.exports = router;
