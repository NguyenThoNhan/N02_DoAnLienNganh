const { getSubjectLabel, formatPatientCode, formatRecordCode, calcAge } = require('./patient.utils');

const LAB_LOCATIONS = {
  XN001: 'Khoa Xét nghiệm — Phòng X101 — Tầng 1 — Nhà A1',
  XN002: 'Khoa Xét nghiệm — Phòng X102 — Tầng 1 — Nhà A1',
  XN003: 'Khoa Chẩn đoán hình ảnh — Phòng C205 — Tầng 2 — Nhà B1',
  XN004: 'Khoa Chẩn đoán hình ảnh — Phòng C108 — Tầng 1 — Nhà B1',
  XN005: 'Khoa Tim mạch — Phòng T201 — Tầng 2 — Nhà A2',
  XN006: 'Khoa Xét nghiệm — Phòng X103 — Tầng 1 — Nhà A1',
  XN007: 'Khoa Xét nghiệm — Phòng X104 — Tầng 1 — Nhà A1',
  XN008: 'Khoa Nội tiết — Phòng N110 — Tầng 1 — Nhà A2',
  XN009: 'Khoa Chẩn đoán hình ảnh — CT — Tầng 3 — Nhà B2',
  XN010: 'Khoa Xét nghiệm — Phòng X105 — Tầng 1 — Nhà A1'
};

const DEPT_DEFAULT_LOCATION = {
  TIM: 'Khoa Tim mạch — Phòng T101 — Tầng 1 — Nhà A2',
  NOI: 'Khoa Nội tổng quát — Phòng N201 — Tầng 2 — Nhà A2',
  THAN: 'Khoa Thần kinh — Phòng TH110 — Tầng 1 — Nhà A3',
  TIEU: 'Khoa Tiêu hóa — Phòng TI205 — Tầng 2 — Nhà A2',
  HOHA: 'Khoa Hô hấp — Phòng HH108 — Tầng 1 — Nhà A2',
  NHI: 'Khoa Nhi — Phòng NH301 — Tầng 3 — Nhà A2',
  XUONG: 'Khoa Chấn thương — Phòng XU102 — Tầng 1 — Nhà A3',
  DALIE: 'Khoa Da liễu — Phòng DL110 — Tầng 1 — Nhà A2'
};

const getLabLocation = (testCode, departmentCode) => {
  if (testCode && LAB_LOCATIONS[testCode]) return LAB_LOCATIONS[testCode];
  if (departmentCode && DEPT_DEFAULT_LOCATION[departmentCode]) return DEPT_DEFAULT_LOCATION[departmentCode];
  return 'Khoa Xét nghiệm — Phòng tiếp nhận — Tầng 1 — Nhà A1';
};

const buildInstructionSlip = ({
  record,
  appointment,
  orderedTests,
  doctor,
  queueNumber
}) => {
  const patientId = record?.patient_id || appointment?.patient_id;
  const regDate = appointment?.created_at || record?.created_at || new Date();
  const d = new Date(regDate);

  return {
    hospital_name: 'BỆNH VIỆN ĐA KHOA TECHCARE',
    ministry_line: 'BỘ Y TẾ',
    record_code: formatRecordCode(record?.id),
    patient_code: formatPatientCode(patientId),
    registration_date: d.toLocaleDateString('vi-VN'),
    queue_number: queueNumber || record?.id || 1,
    patient_name: (record?.patient_name || appointment?.patient_name || '').toUpperCase(),
    subject: getSubjectLabel(appointment?.service_type),
    age: calcAge(record?.patient_dob || appointment?.patient_dob),
    gender: (record?.patient_gender || appointment?.patient_gender) === 'female' ? 'Nữ' : 'Nam',
    address: record?.patient_address || appointment?.patient_address || '—',
    services: (orderedTests || []).map((t, i) => ({
      stt: i + 1,
      name: t.name || t.test_name,
      location: getLabLocation(t.code || t.test_code, doctor?.department_code)
    })),
    login_username: `bn${patientId}`,
    login_password: String(100000 + Number(patientId)).slice(-6)
  };
};

module.exports = { getLabLocation, buildInstructionSlip, LAB_LOCATIONS };
