async function up(conn) {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS chatbot_intents (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      intent_name VARCHAR(100)  NOT NULL UNIQUE,
      keywords    TEXT          NOT NULL COMMENT 'JSON array of trigger keywords',
      response    TEXT          NOT NULL,
      action_type ENUM('text','redirect','faq') NOT NULL DEFAULT 'text',
      action_url  VARCHAR(255)  DEFAULT NULL COMMENT 'URL for redirect action',
      priority    INT           NOT NULL DEFAULT 0,
      is_active   TINYINT(1)    NOT NULL DEFAULT 1,
      created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
      updated_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_priority  (priority),
      INDEX idx_is_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    INSERT INTO chatbot_intents (intent_name, keywords, response, action_type, action_url, priority) VALUES
    (
      'greeting',
      '["xin chào","hello","chào","hi","hey"]',
      'Xin chào! Tôi là trợ lý ảo của bệnh viện. Tôi có thể giúp bạn tìm hiểu về quy trình đặt lịch, các dịch vụ khám bệnh và hướng dẫn sử dụng hệ thống. Bạn cần hỗ trợ gì ạ?',
      'text', NULL, 100
    ),
    (
      'booking_guide',
      '["đặt lịch","đặt khám","lịch khám","book","hẹn khám"]',
      'Để đặt lịch khám, bạn thực hiện theo các bước: 1) Đăng nhập tài khoản → 2) Vào mục "Đặt lịch khám" → 3) Chọn Bác sĩ hoặc Dịch vụ → 4) Chọn ngày và khung giờ phù hợp → 5) Xác nhận đặt lịch. Bạn có muốn đặt lịch ngay không?',
      'redirect', '/pages/patient/booking.html', 90
    ),
    (
      'payment_guide',
      '["thanh toán","trả tiền","phí khám","chi phí","giá khám","qr"]',
      'Hệ thống hỗ trợ thanh toán qua mã QR sau khi kết thúc ca khám. Bạn vào mục "Lịch sử khám bệnh", chọn ca khám cần thanh toán và quét mã QR hiển thị trên màn hình.',
      'redirect', '/pages/patient/medical-history.html', 80
    ),
    (
      'service_types',
      '["dịch vụ","loại khám","khám theo bác sĩ","khám theo dịch vụ","giáo sư","tiến sĩ","24/7"]',
      'Bệnh viện cung cấp các hình thức khám: (1) Khám theo Bác sĩ - chọn trực tiếp bác sĩ; (2) Khám yêu cầu; (3) Khám theo Phó Giáo sư; (4) Khám theo Thạc sĩ/BS CKI; (5) Khám theo Tiến sĩ/BS CKII; (6) Khám yêu cầu 24/7. Mỗi loại có mức giá khác nhau.',
      'text', NULL, 70
    ),
    (
      'medical_record',
      '["sổ sức khỏe","hồ sơ bệnh","kết quả xét nghiệm","đơn thuốc","lịch sử bệnh"]',
      'Bạn có thể xem Sổ sức khỏe điện tử tại mục "Lịch sử khám bệnh". Mỗi lần khám sẽ được lưu đầy đủ thông tin: triệu chứng, chẩn đoán, kết quả xét nghiệm và đơn thuốc.',
      'redirect', '/pages/patient/medical-history.html', 60
    ),
    (
      'profile_update',
      '["cập nhật thông tin","hồ sơ cá nhân","cccd","địa chỉ","ngày sinh"]',
      'Bạn có thể cập nhật thông tin cá nhân tại mục "Hồ sơ cá nhân" bao gồm: CCCD/Định danh, ngày sinh, giới tính và địa chỉ. Thông tin đầy đủ giúp bác sĩ hỗ trợ bạn tốt hơn.',
      'redirect', '/pages/patient/profile.html', 50
    ),
    (
      'fallback',
      '[]',
      'Xin lỗi, tôi chưa hiểu câu hỏi của bạn. Bạn có thể hỏi tôi về: đặt lịch khám, các dịch vụ khám, thanh toán, hoặc sổ sức khỏe điện tử. Nếu cần hỗ trợ thêm, vui lòng liên hệ quầy lễ tân bệnh viện.',
      'text', NULL, 0
    )
  `);
}

async function down(conn) {
  await conn.execute('DROP TABLE IF EXISTS chatbot_intents');
}

module.exports = { up, down };