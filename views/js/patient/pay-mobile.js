(function () {
  const params = new URLSearchParams(location.search);
  const token = params.get('token');
  const app = document.getElementById('app');

  if (!token) {
    app.innerHTML = '<p class="err">Link thanh toán không hợp lệ</p>';
    return;
  }

  async function load() {
    try {
      const res = await fetch(`/api/payment/session/${token}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Lỗi');

      const d = json.data;
      if (d.paid) {
        showPaid(d);
        notifySuccess();
        return;
      }

      const money = (Number(d.amount) || 0).toLocaleString('vi-VN') + 'đ';
      app.innerHTML = `
        <p class="logo">TechCare</p>
        <h1>Thanh toán viện phí</h1>
        <p style="font-size:0.9rem;color:#64748b">${escapeHtml(d.patient_name || 'Bệnh nhân')}</p>
        <p class="amount">${money}</p>
        <p class="desc">${escapeHtml(d.description || '')}</p>
        <p style="font-size:0.8rem;color:#94a3b8;margin-bottom:16px">Mô phỏng: bấm xác nhận sau khi quét QR trên laptop</p>
        <button type="button" class="btn btn-primary" id="confirmBtn">Xác nhận đã chuyển khoản</button>
        <p class="status" id="status"></p>`;

      document.getElementById('confirmBtn').addEventListener('click', confirmPay);
    } catch (err) {
      app.innerHTML = `<p class="err">${escapeHtml(err.message)}</p>`;
    }
  }

  async function confirmPay() {
    const btn = document.getElementById('confirmBtn');
    const st = document.getElementById('status');
    btn.disabled = true;
    st.textContent = 'Đang xử lý...';
    try {
      const res = await fetch(`/api/payment/session/${token}/confirm`, { method: 'POST' });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      showPaid(json.data);
      notifySuccess();
    } catch (err) {
      st.className = 'status err';
      st.textContent = err.message;
      btn.disabled = false;
    }
  }

  function showPaid(d) {
    const money = (Number(d.amount) || 0).toLocaleString('vi-VN') + 'đ';
    app.innerHTML = `
      <p class="logo">TechCare</p>
      <h1 class="ok">✓ Thanh toán thành công</h1>
      <p class="amount">${money}</p>
      <p style="font-size:0.9rem;color:#64748b;margin-top:12px">Màn hình laptop sẽ tự cập nhật.</p>`;
  }

  function notifySuccess() {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('TechCare', { body: 'Thanh toán viện phí thành công!' });
      } catch { /* ignore */ }
    }
    if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  load();
})();
