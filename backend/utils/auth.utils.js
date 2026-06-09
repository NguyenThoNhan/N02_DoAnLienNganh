const DoctorModel = require('../models/doctor.model');

const resolveDoctorId = async (user) => {
  if (!user || user.role !== 'doctor') return null;
  if (user.doctor_id) return user.doctor_id;
  const doctor = await DoctorModel.findByUserId(user.id);
  return doctor?.id ?? null;
};

module.exports = { resolveDoctorId };
