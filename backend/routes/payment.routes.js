const router = require('express').Router();
const HealthRecordModel = require('../models/healthRecord.model');
const PaymentSession = require('../services/paymentSession.service');
const R = require('../utils/response.utils');

router.get('/session/:token', async (req, res, next) => {
  try {
    const session = PaymentSession.get(req.params.token);
    if (!session) return R.notFound(res, 'Phiên thanh toán hết hạn hoặc không hợp lệ');

    const record = await HealthRecordModel.findById(session.recordId);
    if (!record) return R.notFound(res, 'Không tìm thấy hồ sơ');

    if (record.payment_status === 'paid' || session.paid) {
      return R.success(res, {
        paid: true,
        record_id: record.id,
        amount: record.total_amount,
        patient_name: record.patient_name
      });
    }

    return R.success(res, {
      paid: false,
      record_id: record.id,
      amount: parseFloat(record.total_amount) || 0,
      patient_name: record.patient_name,
      description: `THANHTOAN HS${record.id}`.toUpperCase()
    });
  } catch (err) { next(err); }
});

router.post('/session/:token/confirm', async (req, res, next) => {
  try {
    const session = PaymentSession.get(req.params.token);
    if (!session) return R.notFound(res, 'Phiên thanh toán hết hạn');

    const record = await HealthRecordModel.findById(session.recordId);
    if (!record) return R.notFound(res, 'Không tìm thấy hồ sơ');

    if (record.payment_status !== 'paid') {
      await HealthRecordModel.updatePayment(record.id, {
        payment_status: 'paid',
        payment_method: 'qr_code_mobile'
      });
    }
    PaymentSession.markPaid(req.params.token);

    return R.success(res, {
      paid: true,
      record_id: record.id,
      amount: record.total_amount,
      message: 'Thanh toán thành công'
    }, 'Đã xác nhận thanh toán từ thiết bị di động');
  } catch (err) { next(err); }
});

module.exports = router;
