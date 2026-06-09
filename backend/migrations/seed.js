require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

const DB_CONFIG = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  timezone: '+07:00',
  charset: 'utf8mb4'
};

const SALT_ROUNDS = 10;

async function seed() {
  const conn = await mysql.createConnection(DB_CONFIG);
  console.log('✅ Connected to database. Starting seed...\n');

  try {
    await conn.beginTransaction();

    // ────────────────────────────────────────────────
    // 1. ADMIN
    // ────────────────────────────────────────────────
    console.log('👤 Seeding admin...');
    const adminPassword = await bcrypt.hash('admin123', SALT_ROUNDS);
    const [adminResult] = await conn.execute(`
      INSERT INTO users (full_name, phone, password, role, id_card, dob, gender, address, status)
      VALUES (?, ?, ?, 'admin', ?, ?, 'male', ?, 'active')
      ON DUPLICATE KEY UPDATE
        full_name = VALUES(full_name),
        phone = VALUES(phone),
        password = VALUES(password),
        address = VALUES(address),
        status = 'active',
        id = LAST_INSERT_ID(id)
    `, ['Nguyễn Văn Quản Lý', '0528551918', adminPassword, '079000000001', '1980-05-15', 'Bệnh viện Đa khoa TechCare, Q.1, TP.HCM']);
    const adminId = adminResult.insertId;
    console.log(`   ✅ Admin ID: ${adminId} | Phone: 0528551918 | Pass: admin123`);

    // ────────────────────────────────────────────────
    // 2. DEPARTMENTS
    // ────────────────────────────────────────────────
    console.log('\n🏥 Seeding departments...');
    const departments = [
      ['Khoa Nội Tổng hợp',    'NOI',   'Khám và điều trị các bệnh nội khoa tổng hợp'],
      ['Khoa Tim mạch',        'TIM',   'Chuyên khoa tim mạch và huyết áp'],
      ['Khoa Tiêu hóa',        'TIEU',  'Khám bệnh lý đường tiêu hóa'],
      ['Khoa Thần kinh',       'THAN',  'Chuyên khoa thần kinh và đột quỵ'],
      ['Khoa Cơ xương khớp',   'XUONG', 'Điều trị bệnh lý xương khớp'],
      ['Khoa Hô hấp',          'HOHA',  'Chuyên khoa phổi và hô hấp'],
      ['Khoa Nhi',             'NHI',   'Khám và điều trị bệnh nhi'],
      ['Khoa Da liễu',         'DALIE', 'Chuyên khoa bệnh da liễu']
    ];
    const deptIds = {};
    for (const [name, code, desc] of departments) {
      const [r] = await conn.execute(`
        INSERT INTO departments (name, code, description, status)
        VALUES (?, ?, ?, 'active')
        ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)
      `, [name, code, desc]);
      deptIds[code] = r.insertId;
      console.log(`   ✅ ${code}: ${name}`);
    }

    // ────────────────────────────────────────────────
    // 3. DOCTOR USERS + DOCTORS
    // ────────────────────────────────────────────────
    console.log('\n👨‍⚕️ Seeding doctors...');
    const doctorPassword = await bcrypt.hash('Doctor@123', SALT_ROUNDS);

    const doctorUsers = [
      { full_name: 'GS.TS. Trần Văn Minh',      phone: '0900000011', id_card: '079000000011', dob: '1965-03-20', gender: 'male',   title: 'gs',      dept: 'TIM',   spec: 'Tim mạch can thiệp',       fee: 500000, exp: 30 },
      { full_name: 'PGS.TS. Lê Thị Hương',      phone: '0900000012', id_card: '079000000012', dob: '1970-07-15', gender: 'female', title: 'pgs',     dept: 'NOI',   spec: 'Nội tiết tổng hợp',        fee: 350000, exp: 25 },
      { full_name: 'TS.BS.CKII. Phạm Quốc Hùng',phone: '0900000013', id_card: '079000000013', dob: '1972-11-08', gender: 'male',   title: 'ts_ckii', dept: 'THAN',  spec: 'Thần kinh mạch máu',       fee: 280000, exp: 22 },
      { full_name: 'ThS.BS.CKI. Nguyễn Thị Lan', phone: '0900000014', id_card: '079000000014', dob: '1980-04-22', gender: 'female', title: 'ths_cki', dept: 'TIEU',  spec: 'Tiêu hóa - Gan mật',       fee: 180000, exp: 15 },
      { full_name: 'BS. Hoàng Văn Đức',          phone: '0900000015', id_card: '079000000015', dob: '1985-09-30', gender: 'male',   title: 'bs',      dept: 'HOHA',  spec: 'Hô hấp - Dị ứng',          fee: 150000, exp: 10 },
      { full_name: 'PGS.TS. Vũ Thị Mai',         phone: '0900000016', id_card: '079000000016', dob: '1968-12-01', gender: 'female', title: 'pgs',     dept: 'NHI',   spec: 'Nhi khoa tổng quát',        fee: 350000, exp: 28 },
      { full_name: 'TS.BS.CKII. Đỗ Minh Tuấn',  phone: '0900000017', id_card: '079000000017', dob: '1975-06-14', gender: 'male',   title: 'ts_ckii', dept: 'XUONG', spec: 'Chấn thương chỉnh hình',    fee: 260000, exp: 20 },
      { full_name: 'ThS.BS.CKI. Trịnh Thị Nga',  phone: '0900000018', id_card: '079000000018', dob: '1983-02-28', gender: 'female', title: 'ths_cki', dept: 'DALIE', spec: 'Da liễu thẩm mỹ',           fee: 180000, exp: 12 },
      { full_name: 'BS. Cao Văn Bình',            phone: '0900000019', id_card: '079000000019', dob: '1988-08-17', gender: 'male',   title: 'bs',      dept: 'TIM',   spec: 'Tim mạch cơ bản',           fee: 150000, exp: 7  },
      { full_name: 'GS.TS. Đinh Thị Thu',         phone: '0900000020', id_card: '079000000020', dob: '1960-01-05', gender: 'female', title: 'gs',      dept: 'NOI',   spec: 'Nội khoa lão khoa',         fee: 500000, exp: 35 }
    ];

    for (const d of doctorUsers) {
      const [uResult] = await conn.execute(`
        INSERT INTO users (full_name, phone, password, role, id_card, dob, gender, status)
        VALUES (?, ?, ?, 'doctor', ?, ?, ?, 'active')
        ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)
      `, [d.full_name, d.phone, doctorPassword, d.id_card, d.dob, d.gender]);

      const userId = uResult.insertId;
      const deptId = deptIds[d.dept];

      await conn.execute(`
        INSERT INTO doctors (user_id, department_id, title, specialization, experience_years, consultation_fee, status)
        VALUES (?, ?, ?, ?, ?, ?, 'active')
        ON DUPLICATE KEY UPDATE department_id = VALUES(department_id)
      `, [userId, deptId, d.title, d.spec, d.exp, d.fee]);

      console.log(`   ✅ ${d.full_name} | ${d.title} | ${d.dept} | ${d.fee.toLocaleString()}đ`);
    }

    // ────────────────────────────────────────────────
    // 4. PATIENT SAMPLES
    // ────────────────────────────────────────────────
    console.log('\n🧑 Seeding sample patients...');
    const patientPassword = await bcrypt.hash('Patient@123', SALT_ROUNDS);
    const patients = [
      { full_name: 'Nguyễn Thị Bích Ngọc', phone: '0911000001', id_card: '001000000001', dob: '1990-06-15', gender: 'female', address: '123 Lê Lợi, Q.1, TP.HCM' },
      { full_name: 'Trần Văn Khoa',         phone: '0911000002', id_card: '001000000002', dob: '1985-03-22', gender: 'male',   address: '456 Nguyễn Huệ, Q.1, TP.HCM' },
      { full_name: 'Lê Thị Thanh Hà',       phone: '0911000003', id_card: '001000000003', dob: '1995-11-08', gender: 'female', address: '789 Đinh Tiên Hoàng, Q.3, TP.HCM' }
    ];
    for (const p of patients) {
      await conn.execute(`
        INSERT INTO users (full_name, phone, password, role, id_card, dob, gender, address, status)
        VALUES (?, ?, ?, 'patient', ?, ?, ?, ?, 'active')
        ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)
      `, [p.full_name, p.phone, patientPassword, p.id_card, p.dob, p.gender, p.address]);
      console.log(`   ✅ ${p.full_name} | ${p.phone} | Pass: Patient@123`);
    }

    // ────────────────────────────────────────────────
    // 5. DRUGS
    // ────────────────────────────────────────────────
    console.log('\n💊 Seeding drugs...');
    const drugs = [
      ['Amisea 500mg',      'DRUG001', 'Thuốc bổ gan',           'viên',   8000,  500, 'Mediplantex'],
      ['Myzozo 100mg',      'DRUG002', 'Thuốc bổ gan',           'viên',  12000,  300, 'Myzobel'],
      ['Metformin 500mg',   'DRUG003', 'Thuốc tiểu đường',       'viên',   3500, 1000, 'Stada'],
      ['Amlodipine 5mg',    'DRUG004', 'Thuốc huyết áp',         'viên',   2500, 1200, 'Domesco'],
      ['Aspirin 81mg',      'DRUG005', 'Thuốc tim mạch',         'viên',   1500, 2000, 'Bayer'],
      ['Omeprazole 20mg',   'DRUG006', 'Thuốc dạ dày',           'viên',   4000,  800, 'Stada'],
      ['Paracetamol 500mg', 'DRUG007', 'Thuốc giảm đau hạ sốt', 'viên',   1000, 3000, 'DHG Pharma'],
      ['Amoxicillin 500mg', 'DRUG008', 'Kháng sinh',             'viên',   5000,  600, 'Mekophar'],
      ['Loratadine 10mg',   'DRUG009', 'Thuốc dị ứng',           'viên',   3000,  900, 'Stada'],
      ['Atorvastatin 20mg', 'DRUG010', 'Thuốc mỡ máu',           'viên',   8500,  700, 'Pfizer'],
      ['Gabapentin 300mg',  'DRUG011', 'Thuốc thần kinh',        'viên',  15000,  400, 'Pfizer'],
      ['Prednisolone 5mg',  'DRUG012', 'Thuốc kháng viêm',       'viên',   2000,  600, 'Roussel'],
      ['Salbutamol 4mg',    'DRUG013', 'Thuốc giãn phế quản',    'viên',   3500,  500, 'GSK'],
      ['Montelukast 10mg',  'DRUG014', 'Thuốc hen suyễn',        'viên',  25000,  300, 'MSD'],
      ['Ibuprofen 400mg',   'DRUG015', 'Thuốc giảm đau kháng viêm','viên', 4000,  800, 'DHG Pharma'],
      ['Vitamin D3 1000IU', 'DRUG016', 'Vitamin bổ sung',        'viên',   5000, 1000, 'Centrum'],
      ['Calcium 500mg',     'DRUG017', 'Thuốc bổ xương',         'viên',   6000,  700, 'Ostelin'],
      ['Cetirizine 10mg',   'DRUG018', 'Thuốc dị ứng da',        'viên',   3500,  600, 'UCB'],
      ['Clarithromycin 500mg','DRUG019','Kháng sinh mạnh',       'viên',  18000,  200, 'Abbott'],
      ['Esomeprazole 40mg', 'DRUG020', 'Thuốc trào ngược',       'viên',  12000,  400, 'AstraZeneca']
    ];
    const drugIds = {};
    for (const [name, code, cat, unit, price, stock, mfr] of drugs) {
      const [r] = await conn.execute(`
        INSERT INTO drugs (name, code, category, unit, unit_price, stock, manufacturer, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
        ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)
      `, [name, code, cat, unit, price, stock, mfr]);
      drugIds[code] = r.insertId;
      console.log(`   ✅ ${code}: ${name} | ${price.toLocaleString()}đ/${unit}`);
    }

    // ────────────────────────────────────────────────
    // 6. DISEASES + MAPPINGS
    // ────────────────────────────────────────────────
    console.log('\n🦠 Seeding diseases & drug mappings...');
    const diseaseDrugMap = [
      { name: 'Bệnh gan',              icd: 'K76', drugs: [['DRUG001',1],['DRUG002',1],['DRUG007',2]] },
      { name: 'Đái tháo đường type 2', icd: 'E11', drugs: [['DRUG003',1],['DRUG010',2],['DRUG016',3]] },
      { name: 'Tăng huyết áp',         icd: 'I10', drugs: [['DRUG004',1],['DRUG005',2],['DRUG010',2]] },
      { name: 'Bệnh tim mạch',         icd: 'I25', drugs: [['DRUG005',1],['DRUG004',1],['DRUG010',1]] },
      { name: 'Viêm loét dạ dày',      icd: 'K25', drugs: [['DRUG006',1],['DRUG020',1],['DRUG008',2]] },
      { name: 'Đau đầu - Đau nửa đầu', icd: 'G43', drugs: [['DRUG007',1],['DRUG015',1],['DRUG011',2]] },
      { name: 'Viêm phổi - Nhiễm khuẩn hô hấp', icd: 'J18', drugs: [['DRUG008',1],['DRUG019',1],['DRUG013',2]] },
      { name: 'Dị ứng - Mề đay',       icd: 'L50', drugs: [['DRUG009',1],['DRUG018',1],['DRUG012',2]] },
      { name: 'Rối loạn lipid máu',    icd: 'E78', drugs: [['DRUG010',1],['DRUG005',2]] },
      { name: 'Đau thần kinh',         icd: 'M79', drugs: [['DRUG011',1],['DRUG015',1],['DRUG007',2]] },
      { name: 'Viêm khớp',             icd: 'M05', drugs: [['DRUG012',1],['DRUG015',1],['DRUG017',2]] },
      { name: 'Hen suyễn - COPD',      icd: 'J45', drugs: [['DRUG013',1],['DRUG014',1],['DRUG012',2]] },
      { name: 'Loãng xương',           icd: 'M81', drugs: [['DRUG017',1],['DRUG016',1]] },
      { name: 'Bệnh da liễu - Viêm da',icd: 'L30', drugs: [['DRUG018',1],['DRUG009',2],['DRUG012',2]] },
      { name: 'Nhiễm khuẩn nặng',      icd: 'A49', drugs: [['DRUG019',1],['DRUG008',2],['DRUG012',2]] }
    ];

    for (const disease of diseaseDrugMap) {
      const [dr] = await conn.execute(`
        INSERT INTO diseases (name, icd_code) VALUES (?, ?)
        ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)
      `, [disease.name, disease.icd]);
      const diseaseId = dr.insertId;

      for (const [drugCode, priority] of disease.drugs) {
        const drugId = drugIds[drugCode];
        if (!drugId) continue;
        await conn.execute(`
          INSERT INTO disease_drug_mappings (disease_id, drug_id, priority)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE priority = VALUES(priority)
        `, [diseaseId, drugId, priority]);
      }
      console.log(`   ✅ ${disease.name} (${disease.icd}) → ${disease.drugs.length} thuốc`);
    }

    // ────────────────────────────────────────────────
    // 7. SAMPLE APPOINTMENTS (NO NEWS SEED)
    // ────────────────────────────────────────────────
    console.log('\n📅 Seeding sample appointments...');
    const [[doctorRow]] = await conn.execute(
      `SELECT d.id, d.consultation_fee
       FROM doctors d
       INNER JOIN users u ON u.id = d.user_id
       WHERE u.phone = ?
       LIMIT 1`,
      ['0900000011']
    );
    const [patientRows] = await conn.execute(
      `SELECT id, full_name FROM users WHERE role = 'patient' ORDER BY id ASC LIMIT 3`
    );

    if (doctorRow && patientRows.length) {
      const slots = ['08:00', '09:00', '10:00'];
      for (let i = 0; i < patientRows.length; i += 1) {
        const patient = patientRows[i];
        const date = new Date();
        date.setDate(date.getDate() + i + 1);
        const isoDate = date.toISOString().slice(0, 10);
        await conn.execute(
          `INSERT INTO appointments (patient_id, doctor_id, service_type, appointment_date, time_slot, reason, status, consultation_fee)
           VALUES (?, ?, 'doctor', ?, ?, ?, 'confirmed', ?)
           ON DUPLICATE KEY UPDATE reason = VALUES(reason), status = VALUES(status), consultation_fee = VALUES(consultation_fee)`,
          [
            patient.id,
            doctorRow.id,
            isoDate,
            slots[i % slots.length],
            `Khám tổng quát định kỳ cho ${patient.full_name}`,
            doctorRow.consultation_fee || 0
          ]
        );
      }
      console.log(`   ✅ Added ${patientRows.length} lịch hẹn mẫu`);
    } else {
      console.log('   ⚠️ Bỏ qua lịch hẹn mẫu vì thiếu bác sĩ hoặc bệnh nhân');
    }

    await conn.commit();

    console.log('\n' + '═'.repeat(60));
    console.log('🎉 SEED COMPLETED SUCCESSFULLY!');
    console.log('═'.repeat(60));
    console.log('\n📋 TÀI KHOẢN MẪU:');
    console.log('┌─────────────────────────────────────────────────────┐');
    console.log('│  ADMIN    │ Phone: 0528551918 │ Pass: admin123      │');
    console.log('│  DOCTOR   │ Phone: 0900000011 │ Pass: Doctor@123    │');
    console.log('│           │ (011→020 cho 10 bác sĩ)                  │');
    console.log('│  PATIENT  │ Phone: 0911000001 │ Pass: Patient@123   │');
    console.log('└─────────────────────────────────────────────────────┘');

  } catch (err) {
    await conn.rollback();
    console.error('\n❌ Seed failed, rolled back:', err.message);
    throw err;
  } finally {
    await conn.end();
  }
}

seed().catch(err => { console.error(err); process.exit(1); });