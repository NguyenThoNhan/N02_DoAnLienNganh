const router = require('express').Router();
const ctrl = require('../controllers/ai.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { isDoctorOrAdmin } = require('../middlewares/role.middleware');

router.get('/status', authenticate, ctrl.getStatus);
router.post('/train', authenticate, isDoctorOrAdmin, ctrl.train);

module.exports = router;
