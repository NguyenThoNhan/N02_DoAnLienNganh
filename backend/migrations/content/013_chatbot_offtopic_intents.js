/**
 * Bổ sung kịch bản chatbot: từ chối chẩn đoán/kê thuốc + gợi ý hướng dẫn.
 * Logic chính nằm ở backend/utils/chatbot.utils.js — migration để admin xem/sửa trên DB.
 */
async function up(conn) {
  const rows = [
    [
      'off_topic_emergency',
      '["cấp cứu","khẩn cấp","đau ngực dữ","khó thở nặng","ngất xỉu","gọi 115"]',
      'Tình huống khẩn cấp: gọi 115 hoặc đến Khoa Cấp cứu ngay. Trợ lý ảo không xử lý cấp cứu qua chat.',
      'redirect', '/pages/patient/booking.html', 210
    ],
    [
      'off_topic_diagnosis',
      '["chẩn đoán","bị bệnh gì","triệu chứng","ốm gì","có bị bệnh"]',
      'Trợ lý không chẩn đoán bệnh. Vui lòng đặt lịch khám hoặc đến quầy tiếp đón để gặp bác sĩ.',
      'redirect', '/pages/patient/booking.html', 200
    ],
    [
      'off_topic_prescription',
      '["kê thuốc","thuốc gì","liều lượng","mua thuốc","kháng sinh"]',
      'Trợ lý không kê thuốc. Đơn thuốc do bác sĩ kê sau khám. Xem đơn cũ tại Lịch sử khám bệnh.',
      'redirect', '/pages/patient/medical-history.html', 199
    ],
    [
      'off_topic_treatment',
      '["điều trị","chữa bệnh","phẫu thuật","có khỏi không"]',
      'Phương án điều trị chỉ bác sĩ tư vấn sau khám. Trợ lý hỗ trợ đặt lịch và thủ tục hệ thống.',
      'text', null, 198
    ],
    [
      'help_guide',
      '["chưa biết hỏi","hỏi gì","bạn làm được gì","chatbot giúp gì"]',
      'Bạn có thể hỏi về đặt lịch, thanh toán, hồ sơ khám, giờ làm việc. Không hỏi chẩn đoán hay kê thuốc.',
      'text', null, 95
    ]
  ];

  for (const r of rows) {
    await conn.execute(
      `INSERT INTO chatbot_intents (intent_name, keywords, response, action_type, action_url, priority, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
         keywords = VALUES(keywords),
         response = VALUES(response),
         action_type = VALUES(action_type),
         action_url = VALUES(action_url),
         priority = VALUES(priority),
         is_active = 1`,
      r
    );
  }

  await conn.execute(
    `UPDATE chatbot_intents SET response = ?
     WHERE intent_name = 'fallback'`,
    [`Mình chưa hiểu rõ câu hỏi. Trợ lý chỉ hướng dẫn thủ tục (đặt lịch, thanh toán, hồ sơ), không chẩn đoán hay kê thuốc. Thử hỏi "Làm sao đặt lịch khám?" hoặc dùng gợi ý bên dưới. Liên hệ quầy lễ tân nếu cần hỗ trợ trực tiếp.`]
  );

  await conn.execute(
    `UPDATE chatbot_intents SET response = ?
     WHERE intent_name = 'greeting'`,
    [`Xin chào! Tôi là trợ lý hướng dẫn thủ tục TechCare.

Tôi có thể giúp: đặt lịch, thanh toán, xem hồ sơ khám, giờ làm việc...

⚠️ Tôi không chẩn đoán bệnh, không kê thuốc. Nếu chưa biết hỏi gì, hãy nhấn gợi ý bên dưới hoặc gõ "Bạn có thể giúp gì?".`]
  );
}

async function down(conn) {
  await conn.execute(
    `DELETE FROM chatbot_intents WHERE intent_name IN (
      'off_topic_emergency','off_topic_diagnosis','off_topic_prescription',
      'off_topic_treatment','help_guide'
    )`
  );
}

module.exports = { up, down };
