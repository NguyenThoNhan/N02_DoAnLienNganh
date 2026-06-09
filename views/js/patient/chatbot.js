(function () {
  PatientApp.initPage('chatbot', init);

  function init() {

  const chatMessages = document.getElementById('chatMessages');
  const chatInput = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');
  const quickPrompts = document.getElementById('quickPrompts');
  let sending = false;

  const SUGGESTIONS = [
    { label: 'Bạn có thể giúp gì?', prompt: 'Chatbot có thể giúp tôi những gì?' },
    { label: 'Làm sao đặt lịch khám?', prompt: 'Làm sao đặt lịch khám nhanh nhất trên hệ thống?' },
    { label: 'Tôi cần mang giấy tờ gì?', prompt: 'Đi khám lần đầu tôi cần mang giấy tờ gì?' },
    { label: 'Giờ làm việc bệnh viện?', prompt: 'Giờ làm việc của bệnh viện và các khoa là khi nào?' },
    { label: 'Xem hồ sơ khám ở đâu?', prompt: 'Tôi xem lại hồ sơ khám và kết quả xét nghiệm ở đâu?' },
    { label: 'Thanh toán online thế nào?', prompt: 'Hướng dẫn tôi thanh toán viện phí bằng QR.' },
    { label: 'Bao lâu được hủy lịch?', prompt: 'Tôi có thể hủy lịch trước giờ khám bao lâu?' },
    { label: 'Liên hệ hỗ trợ', prompt: 'Nếu gặp lỗi tài khoản hoặc đặt lịch thì liên hệ ai?' }
  ];

  function renderSuggestions() {
    if (!quickPrompts) return;
    quickPrompts.innerHTML = SUGGESTIONS.map((s) => `
      <button type="button" class="ai-suggest-chip" data-prompt="${PatientApp.escapeHtml(s.prompt)}">
        <i data-lucide="message-circle-question"></i>
        <span>${PatientApp.escapeHtml(s.label)}</span>
      </button>`).join('');
  }

  function nowTime() {
    return new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }

  function appendMsg(text, role, actionUrl) {
    const div = document.createElement('div');
    div.className = `chat-msg ${role}`;
    let html = PatientApp.escapeHtml(text).replace(/\n/g, '<br>');
    if (actionUrl && role === 'bot') {
      html += `<br><a href="${PatientApp.escapeHtml(actionUrl)}" class="btn btn-outline btn-sm" style="margin-top:10px">Mở liên kết</a>`;
    }
    div.innerHTML = `${html}<span class="time">${nowTime()}</span>`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function showTyping() {
    const el = document.createElement('div');
    el.className = 'chat-msg bot';
    el.id = 'typingIndicator';
    el.innerHTML = `<div class="typing-dots"><span></span><span></span><span></span></div>`;
    chatMessages.appendChild(el);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function hideTyping() {
    document.getElementById('typingIndicator')?.remove();
  }

  async function sendMessage(text) {
    const msg = (text || chatInput.value).trim();
    if (!msg || sending) return;
    if (msg.length > 500) {
      PatientApp.toast('Tin nhắn tối đa 500 ký tự', 'error');
      return;
    }

    sending = true;
    chatInput.value = '';
    sendBtn.disabled = true;
    appendMsg(msg, 'user');
    showTyping();

    try {
      const res = await fetch(`${PatientApp.API}/chatbot/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg })
      });
      const data = await res.json();
      hideTyping();

      if (!res.ok || !data.success) {
        appendMsg(data.message || 'Không nhận được phản hồi', 'bot');
        return;
      }

      const payload = data.data;
      let url = payload.action_url;
      if (url && url.startsWith('/pages')) url = url;
      appendMsg(payload.message, 'bot', payload.action_type === 'redirect' ? url : null);
    } catch {
      hideTyping();
      appendMsg('Không kết nối được máy chủ. Vui lòng thử lại.', 'bot');
    } finally {
      sending = false;
      sendBtn.disabled = false;
      chatInput.focus();
    }
  }

  sendBtn.addEventListener('click', () => sendMessage());
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  quickPrompts?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-prompt]');
    if (!btn) return;
    sendMessage(btn.dataset.prompt);
  });

  renderSuggestions();
  PatientApp.refreshIcons();
  chatInput.focus();
  }
})();
