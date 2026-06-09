const formatPatientCode = (userId) => {
  const id = Number(userId) || 0;
  return String(2000000000 + id).slice(0, 10);
};

const formatRecordCode = (recordId) => String(80000000 + Number(recordId || 0)).slice(0, 8);

const SUBJECT_LABELS = {
  doctor: 'Dịch vụ',
  request: 'Dịch vụ',
  pgs: 'Dịch vụ',
  ths_cki: 'Dịch vụ',
  ts_ckii: 'Dịch vụ',
  request_24_7: 'Dịch vụ'
};

const getSubjectLabel = (serviceType) => SUBJECT_LABELS[serviceType] || 'Dịch vụ';

const calcAge = (dob) => {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d)) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
  return age;
};

const PROFILE_REQUIRED = ['full_name', 'id_card', 'dob', 'gender', 'address'];

const getProfileCompleteness = (user) => {
  const missing = [];
  if (!user?.full_name?.trim()) missing.push('họ tên');
  if (!user?.id_card?.trim()) missing.push('CCCD/CMND');
  if (!user?.dob) missing.push('ngày sinh');
  if (!user?.gender) missing.push('giới tính');
  if (!user?.address?.trim()) missing.push('địa chỉ');
  return {
    complete: missing.length === 0,
    missing,
    missing_fields: missing
  };
};

const enrichPatientUser = (user) => {
  if (!user || user.role !== 'patient') return user;
  const { complete, missing, missing_fields } = getProfileCompleteness(user);
  return {
    ...user,
    patient_code: formatPatientCode(user.id),
    subject_label: 'Dịch vụ',
    profile_complete: complete,
    profile_missing: missing,
    profile_missing_fields: missing_fields,
    age: calcAge(user.dob)
  };
};

module.exports = {
  formatPatientCode,
  formatRecordCode,
  getSubjectLabel,
  calcAge,
  getProfileCompleteness,
  enrichPatientUser,
  PROFILE_REQUIRED
};
