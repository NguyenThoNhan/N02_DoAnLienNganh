const db = require('../config/db');

const LAB_BASE_SELECT = `
  lr.id,
  lr.health_record_id,
  lr.lab_test_id,
  lr.ordered_by,
  lr.result_text,
  lr.result_image,
  lr.fee,
  lr.status,
  lr.completed_at,
  lr.created_at,
  lr.updated_at,
  lt.name  AS test_name,
  lt.code  AS test_code,
  lt.price AS test_price,
  u.full_name AS ordered_by_name
`;

const getAllTests = async (status = 'active') => {
  const [rows] = await db.execute(
    `SELECT id, name, code, price, description, status FROM lab_tests WHERE status = ? ORDER BY name ASC`,
    [status]
  );
  return rows;
};

const getByRecordId = async (healthRecordId) => {
  const [rows] = await db.execute(
    `SELECT ${LAB_BASE_SELECT}
     FROM lab_results lr
     INNER JOIN lab_tests lt ON lt.id = lr.lab_test_id
     INNER JOIN users u      ON u.id  = lr.ordered_by
     WHERE lr.health_record_id = ?
     ORDER BY lr.created_at ASC`,
    [healthRecordId]
  );
  return rows;
};

const findById = async (id) => {
  const [rows] = await db.execute(
    `SELECT ${LAB_BASE_SELECT}
     FROM lab_results lr
     INNER JOIN lab_tests lt ON lt.id = lr.lab_test_id
     INNER JOIN users u      ON u.id  = lr.ordered_by
     WHERE lr.id = ?`,
    [id]
  );
  return rows[0] || null;
};

const orderTests = async (healthRecordId, orderedBy, testIds) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const inserted = [];
    for (const testId of testIds) {
      const [[test]] = await conn.execute(
        `SELECT id, name, code, price FROM lab_tests WHERE id = ? AND status = 'active'`, [testId]
      );
      if (!test) continue;

      const [result] = await conn.execute(
        `INSERT INTO lab_results (health_record_id, lab_test_id, ordered_by, fee, status)
         VALUES (?, ?, ?, ?, 'ordered')`,
        [healthRecordId, test.id, orderedBy, test.price]
      );
      inserted.push({
        lab_result_id: result.insertId,
        id: test.id,
        name: test.name,
        code: test.code,
        price: test.price
      });
    }

    const [[{ total_lab }]] = await conn.execute(
      `SELECT COALESCE(SUM(fee), 0) AS total_lab FROM lab_results WHERE health_record_id = ?`,
      [healthRecordId]
    );
    await conn.execute(
      `UPDATE health_records hr
       INNER JOIN appointments a ON a.id = hr.appointment_id
       SET hr.total_lab_fee = ?,
           hr.total_amount  = a.consultation_fee + ? + hr.total_drug_fee
       WHERE hr.id = ?`,
      [total_lab, total_lab, healthRecordId]
    );

    await conn.commit();
    return inserted;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const DEMO_BY_TEST_CODE = {
  XN001: 'Công thức máu: Hồng cầu 4.6 triệu/µL, Hemoglobin 14.2 g/dL, Bạch cầu 7.1 nghìn/µL — trong giới hạn bình thường.',
  XN002: 'Nước tiểu: Protein âm tính, Glucose âm tính, không bạch cầu niệu — bình thường.',
  XN003: 'Siêu âm ổ bụng: Gan, lách, thận không hình ảnh bất thường. Không dịch tự do.',
  XN004: 'X-quang ngực: Tim phổi trong giới hạn bình thường, không thâm nhiễm phổi.',
  XN005: 'ECG: Nhịp xoang đều ~72 l/p, không ST chênh, không loạn nhịp thấy rõ.',
  XN006: 'Chức năng gan: AST 28 U/L, ALT 32 U/L, Bilirubin toàn phần 0.9 mg/dL — bình thường.',
  XN007: 'Chức năng thận: Creatinin 0.85 mg/dL, Ure 28 mg/dL — bình thường.',
  XN008: 'Đường huyết lúc đói: 92 mg/dL — bình thường.',
  XN009: 'CT scan: Không khối u, không hạch bất thường đáng kể (mô phỏng demo).',
  XN010: 'Lipid máu: Cholesterol toàn phần 4.8 mmol/L, LDL 2.9, HDL 1.3 — chấp nhận được.'
};

const DEMO_BY_DEPT = {
  TIM: 'Phòng Tim mạch — Kết quả không ghi nhận bất thường nặng trên hồ sơ demo.',
  NOI: 'Phòng Nội tổng quát — Các chỉ số cơ bản trong giới hạn tham chiếu (demo).',
  THAN: 'Phòng Thần kinh — Không dấu hiệu cấp cứu thần kinh trên hồ sơ demo.',
  TIEU: 'Phòng Tiêu hóa — Gan mật, tiêu hóa ổn định trên hồ sơ demo.',
  HOHA: 'Phòng Hô hấp — Phổi trong, không suy hô hấp (demo).',
  NHI: 'Phòng Nhi — Phù hợp chỉ số theo tuổi, không cảnh báo đỏ (demo).',
  XUONG: 'Phòng Chấn thương chỉnh hình — Xương khớp không gãy rõ (demo).',
  DALIE: 'Phòng Da liễu — Tổn thương da không nghi ngờ ác tính (demo).'
};

const _demoTextForTest = (testCode, testName, departmentCode) => {
  if (testCode && DEMO_BY_TEST_CODE[testCode]) return DEMO_BY_TEST_CODE[testCode];
  const deptNote = departmentCode && DEMO_BY_DEPT[departmentCode] ? ` ${DEMO_BY_DEPT[departmentCode]}` : '';
  return `Kết quả mẫu — ${testName}: các chỉ số trong giới hạn tham chiếu (hệ thống demo).${deptNote}`;
};

/** Tự điền kết quả mẫu cho các XN đang chờ (demo phòng xét nghiệm) */
const applyDemoResults = async (healthRecordId, departmentCode = null, buildTextFn = null) => {
  const [rows] = await db.execute(
    `SELECT lr.id, lr.status, lt.code AS test_code, lt.name AS test_name
     FROM lab_results lr
     INNER JOIN lab_tests lt ON lt.id = lr.lab_test_id
     WHERE lr.health_record_id = ? AND lr.status != 'completed'`,
    [healthRecordId]
  );

  for (const row of rows) {
    const text = typeof buildTextFn === 'function'
      ? buildTextFn(row)
      : _demoTextForTest(row.test_code, row.test_name, departmentCode);
    await db.execute(
      `UPDATE lab_results SET status = 'completed', result_text = ?, completed_at = NOW() WHERE id = ?`,
      [text, row.id]
    );
  }
  return rows.length;
};

const uploadResult = async (id, { result_text, result_image }) => {
  const fields = ['status = ?'];
  const values = ['completed'];

  if (result_text  !== undefined) { fields.push('result_text = ?');  values.push(result_text); }
  if (result_image !== undefined) { fields.push('result_image = ?'); values.push(result_image); }
  fields.push('completed_at = NOW()');
  values.push(id);

  await db.execute(`UPDATE lab_results SET ${fields.join(', ')} WHERE id = ?`, values);
  return findById(id);
};

const updateStatus = async (id, status) => {
  await db.execute(`UPDATE lab_results SET status = ? WHERE id = ?`, [status, id]);
  return findById(id);
};

const remove = async (id) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[lr]] = await conn.execute(
      `SELECT health_record_id, fee FROM lab_results WHERE id = ?`, [id]
    );
    if (!lr) throw new Error('Lab result not found');

    await conn.execute(`DELETE FROM lab_results WHERE id = ?`, [id]);

    const [[{ total_lab }]] = await conn.execute(
      `SELECT COALESCE(SUM(fee), 0) AS total_lab FROM lab_results WHERE health_record_id = ?`,
      [lr.health_record_id]
    );
    await conn.execute(
      `UPDATE health_records hr
       INNER JOIN appointments a ON a.id = hr.appointment_id
       SET hr.total_lab_fee = ?,
           hr.total_amount  = a.consultation_fee + ? + hr.total_drug_fee
       WHERE hr.id = ?`,
      [total_lab, total_lab, lr.health_record_id]
    );

    await conn.commit();
    return true;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

module.exports = {
  getAllTests, getByRecordId, findById, orderTests,
  applyDemoResults, uploadResult, updateStatus, remove
};