/**
 * Nhận diện câu hỏi ngoài phạm vi (chẩn đoán, kê thuốc…) và gợi ý hướng dẫn thủ tục.
 * Chạy trước keyword DB để trả lời ổn định, không phụ thuộc seed.
 */

const EMERGENCY_KEYWORDS = [
  'cấp cứu', 'khẩn cấp', 'đau ngực dữ', 'khó thở nặng', 'ngất xỉu',
  'chảy máu nhiều', 'tai nạn', 'bất tỉnh', 'gọi 115', 'cấp cứu 115'
];

const DIAGNOSIS_KEYWORDS = [
  'chẩn đoán', 'bị bệnh gì', 'mắc bệnh gì', 'bệnh gì không', 'ốm gì',
  'triệu chứng này là', 'triệu chứng này do', 'nguyên nhân bệnh', 'có bị bệnh',
  'có phải bệnh', 'có ung thư', 'có tiểu đường', 'có viêm', 'bị sao vậy',
  'tôi bị đau', 'tôi bị sốt', 'tôi bị ho', 'tôi bị ngứa', 'có nguy hiểm không',
  'có sao không khi', 'bệnh nặng không', 'có chết không'
];

const PRESCRIPTION_KEYWORDS = [
  'kê thuốc', 'kê đơn', 'thuốc gì', 'uống thuốc gì', 'uống gì cho',
  'liều lượng', 'liều dùng', 'mua thuốc', 'đơn thuốc cho', 'thuốc đau',
  'thuốc cảm', 'thuốc sốt', 'kháng sinh', 'vitamin gì', 'thuốc đặc trị',
  'dùng thuốc gì', 'có uống', 'ăn thuốc'
];

const TREATMENT_KEYWORDS = [
  'điều trị thế nào', 'điều trị như thế nào', 'chữa bệnh', 'chữa như thế nào',
  'phương pháp điều trị', 'có khỏi không', 'sống được bao lâu', 'phẫu thuật không',
  'cần phẫu thuật', 'có cần nhập viện', 'nên làm gì khi bị', 'cách chữa'
];

const HELP_GUIDE_KEYWORDS = [
  'chưa biết hỏi', 'hỏi gì được', 'hỏi gì đây', 'hỏi sao', 'hỏi như nào',
  'bạn làm được gì', 'bạn có thể giúp', 'chatbot làm gì', 'chatbot giúp gì',
  'chatbot có thể', 'có thể hỏi gì', 'có thể giúp gì', 'giúp gì',
  'hướng dẫn sử dụng chatbot', 'trợ lý làm gì', 'giúp tôi hỏi', 'nên hỏi gì'
];

const OFF_SCOPE_RESPONSES = {
  emergency: {
    intent: 'off_topic_emergency',
    response: [
      '⚠️ Tình huống khẩn cấp cần được xử lý trực tiếp bởi nhân viên y tế.',
      'Vui lòng gọi 115 hoặc đến Khoa Cấp cứu tại bệnh viện ngay.',
      'Trợ lý ảo không thể hỗ trợ cấp cứu qua chat. Nếu không nguy cấp, bạn có thể đặt lịch khám qua hệ thống.'
    ].join('\n'),
    action_type: 'redirect',
    action_url: '/pages/patient/booking.html'
  },
  diagnosis: {
    intent: 'off_topic_diagnosis',
    response: [
      'Mình là trợ lý hướng dẫn thủ tục — không có chức năng chẩn đoán hay tư vấn y khoa.',
      'Triệu chứng và chẩn đoán cần bác sĩ khám trực tiếp. Bạn có thể:',
      '• Đặt lịch khám trên hệ thống TechCare',
      '• Đến quầy tiếp đón / khoa khám khi cần gặp bác sĩ sớm',
      'Bạn cần mình hướng dẫn cách đặt lịch không?'
    ].join('\n'),
    action_type: 'redirect',
    action_url: '/pages/patient/booking.html'
  },
  prescription: {
    intent: 'off_topic_prescription',
    response: [
      'Mình không kê thuốc và không tư vấn liều dùng qua chat.',
      'Đơn thuốc chỉ do bác sĩ kê sau khi khám. Bạn có thể:',
      '• Xem đơn thuốc đã kê trong mục Lịch sử khám bệnh (nếu đã khám)',
      '• Đặt lịch tái khám nếu cần bác sĩ điều chỉnh thuốc',
      'Cần hướng dẫn xem hồ sơ khám hoặc đặt lịch, bạn cứ hỏi nhé.'
    ].join('\n'),
    action_type: 'redirect',
    action_url: '/pages/patient/medical-history.html'
  },
  treatment: {
    intent: 'off_topic_treatment',
    response: [
      'Phương án điều trị phụ thuộc kết quả khám và chỉ bác sĩ mới tư vấn chính xác.',
      'Trợ lý ảo chỉ hỗ trợ: đặt lịch, thanh toán, xem hồ sơ, quy trình bệnh viện.',
      'Bạn muốn mình hướng dẫn đặt lịch khám hoặc xem kết quả / đơn thuốc cũ không?'
    ].join('\n'),
    action_type: 'text',
    action_url: null
  },
  help_guide: {
    intent: 'help_guide',
    response: [
      'Bạn có thể hỏi mình về thủ tục & hệ thống TechCare, ví dụ:',
      '• Cách đặt / hủy lịch khám',
      '• Giấy tờ mang theo khi đi khám',
      '• Thanh toán viện phí (QR)',
      '• Xem hồ sơ khám, kết quả XN, đơn thuốc',
      '• Giờ làm việc, loại dịch vụ khám',
      '',
      '⚠️ Mình không chẩn đoán bệnh, kê thuốc hay tư vấn điều trị.',
      'Nhấn một câu hỏi mẫu bên dưới hoặc gõ câu hỏi của bạn.'
    ].join('\n'),
    action_type: 'text',
    action_url: null
  },
  fallback: {
    intent: 'fallback',
    response: [
      'Mình chưa hiểu rõ câu hỏi, hoặc nội dung nằm ngoài phạm vi hỗ trợ.',
      'Trợ lý ảo chỉ hướng dẫn thủ tục (đặt lịch, thanh toán, hồ sơ…), không chẩn đoán hay kê thuốc.',
      'Bạn thử hỏi: "Làm sao đặt lịch khám?" hoặc nhấn Gợi ý câu hỏi nhanh bên dưới.',
      'Cần hỗ trợ trực tiếp: liên hệ quầy lễ tân bệnh viện.'
    ].join('\n'),
    action_type: 'text',
    action_url: null
  }
};

function _matchAny(text, keywords) {
  return keywords.some((kw) => text.includes(kw));
}

function detectSpecialIntent(normalizedMessage) {
  const m = normalizedMessage.toLowerCase().trim();
  if (!m) return null;

  if (_matchAny(m, EMERGENCY_KEYWORDS)) return OFF_SCOPE_RESPONSES.emergency;
  if (_matchAny(m, DIAGNOSIS_KEYWORDS)) return OFF_SCOPE_RESPONSES.diagnosis;
  if (_matchAny(m, PRESCRIPTION_KEYWORDS)) return OFF_SCOPE_RESPONSES.prescription;
  if (_matchAny(m, TREATMENT_KEYWORDS)) return OFF_SCOPE_RESPONSES.treatment;
  if (_matchAny(m, HELP_GUIDE_KEYWORDS)) return OFF_SCOPE_RESPONSES.help_guide;

  return null;
}

function getImprovedFallback() {
  return OFF_SCOPE_RESPONSES.fallback;
}

module.exports = {
  detectSpecialIntent,
  getImprovedFallback,
  OFF_SCOPE_RESPONSES
};
