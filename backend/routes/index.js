const router = require('express').Router();

router.get('/health', (req, res) => {
  res.json({ success: true, message: 'Hospital API is running', timestamp: new Date().toISOString() });
});

router.use('/auth',         require('./auth.routes'));
router.use('/patients',     require('./patient.routes'));
router.use('/bookings',     require('./booking.routes'));
router.use('/doctors',      require('./doctor.routes'));
router.use('/departments',  require('./department.routes'));
router.use('/examinations', require('./examination.routes'));
router.use('/records',      require('./record.routes'));
router.use('/admin',        require('./admin.routes'));
router.use('/services',     require('./service.routes'));
router.use('/drugs',        require('./drug.routes'));
router.use('/news',         require('./news.routes'));
router.use('/chatbot',      require('./chatbot.routes'));
router.use('/payment',      require('./payment.routes'));
router.use('/ai',           require('./ai.routes'));

module.exports = router;