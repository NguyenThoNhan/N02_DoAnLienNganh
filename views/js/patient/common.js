const PatientApp = {
  API: '/api',

  ROUTES: {
    login: '/pages/auth/login.html',
    dashboard: '/pages/patient/dashboard.html',
    booking: '/pages/patient/booking.html',
    history: '/pages/patient/medical-history.html',
    record: '/pages/patient/record-detail.html',
    profile: '/pages/patient/profile.html',
    chatbot: '/pages/patient/chatbot.html',
    hospital_map: '/pages/patient/hospital-map.html'
  },

  TITLE_LABELS: {
    bs: 'Bác sĩ', ths_cki: 'ThS.BS.CKI', ts_ckii: 'TS.BS.CKII', pgs: 'PGS.TS', gs: 'GS.TS'
  },

  SERVICE_LABELS: {
    doctor: 'Khám theo bác sĩ', request: 'Yêu cầu khám', pgs: 'Khám PGS.TS',
    ths_cki: 'Khám ThS.BS.CKI', ts_ckii: 'Khám TS.BS.CKII', request_24_7: 'Khám 24/7'
  },

  APPT_STATUS: {
    pending: { label: 'Chờ xác nhận', class: 'badge-warning' },
    confirmed: { label: 'Đã xác nhận', class: 'badge-info' },
    in_progress: { label: 'Đang khám', class: 'badge-primary' },
    completed: { label: 'Hoàn thành', class: 'badge-success' },
    cancelled: { label: 'Đã hủy', class: 'badge-muted' }
  },

  PAYMENT_STATUS: {
    unpaid: { label: 'Chưa thanh toán', class: 'badge-warning' },
    paid: { label: 'Đã thanh toán', class: 'badge-success' }
  },

  PAGE_TITLES: {
    dashboard: 'Tổng quan', booking: 'Đặt lịch khám', history: 'Hồ sơ khám bệnh',
    profile: 'Hồ sơ cá nhân', chatbot: 'Trợ lý AI', record: 'Chi tiết hồ sơ khám',
    hospital_map: 'Sơ đồ bệnh viện'
  },

  requireAuth() {
    const token = localStorage.getItem('token');
    const user = this.getUser();
    if (!token || !user) { window.location.href = this.ROUTES.login; return false; }
    const isHospitalMapPage = window.location.pathname.endsWith('/pages/patient/hospital-map.html');
    if (isHospitalMapPage && ['patient', 'doctor', 'admin'].includes(user.role)) return true;
    if (user.role !== 'patient') {
      const map = { admin: '/pages/admin/dashboard.html', doctor: '/pages/doctor/dashboard.html' };
      window.location.href = map[user.role] || '/';
      return false;
    }
    return true;
  },

  getUser() {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
  },

  getToken() { return localStorage.getItem('token'); },

  logout() {
    ['token', 'user', 'doctor', 'doctor_id'].forEach((k) => localStorage.removeItem(k));
    window.location.href = this.ROUTES.login;
  },

  async fetch(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    const token = this.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (options.body && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }
    const res = await fetch(`${this.API}${path}`, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) { this.logout(); throw new Error('Phiên đăng nhập đã hết hạn'); }
    if (!res.ok || data.success === false) throw new Error(data.message || 'Yêu cầu thất bại');
    return data.data;
  },

  syncNavUser() {
    const user = this.getUser();
    const name = document.getElementById('sidebarUserName');
    const phone = document.getElementById('sidebarUserPhone');
    const avatar = document.getElementById('sidebarUserAvatar');
    const topName = document.getElementById('topUserName');

    if (name && user) name.textContent = user.full_name || 'Bệnh nhân';
    if (phone && user) phone.textContent = user.phone || '';
    if (topName && user) topName.textContent = user.full_name || '';
    if (avatar && user) {
      avatar.textContent = this.getInitials(user.full_name);
      if (user.avatar) avatar.innerHTML = `<img src="${this.escapeHtml(user.avatar)}" alt="" />`;
    }
  },

  setActiveNav(activePage) {
    document.querySelectorAll('.nav-item[data-nav]').forEach((el) => {
      el.classList.toggle('active', el.dataset.nav === activePage);
    });
  },

  setPageTitle(activePage) {
    const el = document.getElementById('pageTitle');
    if (el) el.textContent = this.PAGE_TITLES[activePage] || 'TechCare';
  },

  bindShellEvents() {
    const sidebar = document.getElementById('sidebar');
    document.getElementById('logoutBtn')?.addEventListener('click', (e) => { e.preventDefault(); this.logout(); });
    document.getElementById('sidebarToggle')?.addEventListener('click', () => {
      sidebar?.classList.toggle('open');
      document.getElementById('sidebarOverlay')?.classList.toggle('show', sidebar?.classList.contains('open'));
    });
    document.getElementById('sidebarOverlay')?.addEventListener('click', () => {
      sidebar?.classList.remove('open');
      document.getElementById('sidebarOverlay')?.classList.remove('show');
    });
  },

  async initPage(activePage, callback) {
    const ok = await PatientNavigation.init(activePage);
    if (ok && typeof callback === 'function') callback();
  },

  notifyPayment(title, body) {
    this.toast(body || 'Thanh toán thành công', 'success');
    if ('Notification' in window && Notification.permission === 'granted') {
      try { new Notification(title || 'TechCare', { body, icon: '/favicon.ico' }); } catch { /* ignore */ }
    }
  },

  requestNotifyPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  },

  refreshIcons(root) {
    const run = () => {
      if (typeof lucide === 'undefined') return;
      lucide.createIcons({ attrs: { 'stroke-width': 2 } });
    };
    if (typeof lucide !== 'undefined') requestAnimationFrame(run);
    else {
      let n = 0;
      const t = setInterval(() => {
        n += 1;
        if (typeof lucide !== 'undefined') { clearInterval(t); requestAnimationFrame(run); }
        if (n > 100) clearInterval(t);
      }, 40);
    }
  },

  toast(message, type = 'info') {
    let el = document.getElementById('appToast');
    if (!el) { el = document.createElement('div'); el.id = 'appToast'; document.body.appendChild(el); }
    el.className = `app-toast show toast-${type}`;
    el.innerHTML = `<i data-lucide="${type === 'error' ? 'alert-circle' : type === 'success' ? 'check-circle' : 'info'}"></i><span>${this.escapeHtml(message)}</span>`;
    this.refreshIcons();
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), 3500);
  },

  getInitials(name) {
    if (!name) return '?';
    const p = name.trim().split(/\s+/);
    return p.length === 1 ? p[0].charAt(0).toUpperCase() : (p[0].charAt(0) + p[p.length - 1].charAt(0)).toUpperCase();
  },

  escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  formatDate(str) {
    if (!str) return '—';
    const d = new Date(str);
    return isNaN(d) ? str : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  },

  formatDateTime(dateStr, timeStr) {
    if (!dateStr) return '—';
    return `${this.formatDate(dateStr)}${timeStr ? ' • ' + timeStr : ''}`;
  },

  formatMoney(amount) { return (Number(amount) || 0).toLocaleString('vi-VN') + 'đ'; },

  apptStatusBadge(status) {
    const s = this.APPT_STATUS[status] || { label: status, class: 'badge-muted' };
    return `<span class="badge ${s.class}">${this.escapeHtml(s.label)}</span>`;
  },

  paymentBadge(status) {
    const s = this.PAYMENT_STATUS[status] || { label: status, class: 'badge-muted' };
    return `<span class="badge ${s.class}">${this.escapeHtml(s.label)}</span>`;
  },

  toDateInputValue(date) {
    const d = date instanceof Date ? date : new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  isSunday(dateStr) { return new Date(`${dateStr}T00:00:00`).getDay() === 0; },

  async loadProfile() {
    const data = await this.fetch('/patients/profile');
    if (data?.user) localStorage.setItem('user', JSON.stringify(data.user));
    return data?.user;
  }
};
