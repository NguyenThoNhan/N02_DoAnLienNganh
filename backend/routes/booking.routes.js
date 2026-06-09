const router = require('express').Router();
const ctrl   = require('../controllers/booking.controller');
const { authenticate }                        = require('../middlewares/auth.middleware');
const { isPatient, isAdmin, isDoctor } = require('../middlewares/role.middleware');

// Bệnh nhân đặt lịch & xem lịch của mình
router.post('/',                    authenticate, isPatient,        ctrl.createBooking);
router.get ('/my',                  authenticate, isPatient,        ctrl.getMyAppointments);
router.get ('/doctor',              authenticate, isDoctor,         ctrl.getDoctorAppointments);

router.get ('/',                    authenticate, isAdmin,          ctrl.getAdminList);

// Chi tiết 1 lịch hẹn (patient chủ lịch | doctor liên quan | admin)
router.get ('/:id',                 authenticate,                   ctrl.getAppointmentDetail);

// Hủy lịch (patient chủ lịch | admin)
router.patch('/:id/cancel',         authenticate,                   ctrl.cancelAppointment);

// Admin xác nhận lịch
router.patch('/:id/confirm',        authenticate, isAdmin,          ctrl.confirmAppointment);

module.exports = router;
