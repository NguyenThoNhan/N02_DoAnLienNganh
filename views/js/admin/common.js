const AdminApp = {
  API: '/api',

  ROUTES: {
    login: '/pages/auth/login.html',
    dashboard: '/pages/admin/dashboard.html'
  },

  PAGE_TITLES: {
    dashboard: 'Dashboard', departments: 'Quản lý khoa', doctors: 'Quản lý bác sĩ',
    patients: 'Quản lý bệnh nhân', prices: 'Bảng giá dịch vụ', drugs: 'Kho thuốc',
    news: 'Quản lý tin tức', chatbot: 'Quản lý Chatbot'
  },

  USER_STATUS: {
    active: { label: 'Hoạt động', class: 'badge-success' },
    inactive: { label: 'Ngưng', class: 'badge-muted' },
    banned: { label: 'Khóa', class: 'badge-danger' }
  },

  APPT_STATUS: {
    pending: { label: 'Chờ', class: 'badge-warning' },
    confirmed: { label: 'Xác nhận', class: 'badge-info' },
    in_progress: { label: 'Đang khám', class: 'badge-primary' },
    completed: { label: 'Xong', class: 'badge-success' },
    cancelled: { label: 'Hủy', class: 'badge-muted' }
  },

  SERVICE_TYPES: ['doctor', 'request', 'pgs', 'ths_cki', 'ts_ckii', 'request_24_7'],
  SERVICE_LABELS: {
    doctor: 'Khám BS', request: 'Yêu cầu', pgs: 'PGS.TS', ths_cki: 'ThS.CKI', ts_ckii: 'TS.CKII', request_24_7: '24/7'
  },
  DOCTOR_TITLES: ['bs', 'ths_cki', 'ts_ckii', 'pgs', 'gs'],
  TITLE_LABELS: { bs: 'BS', ths_cki: 'ThS.CKI', ts_ckii: 'TS.CKII', pgs: 'PGS.TS', gs: 'GS.TS' },
  NEWS_CATEGORIES: { news: 'Tin tức', event: 'Sự kiện', announcement: 'Thông báo', health_tips: 'Sức khỏe' },

  requireAuth() {
    const user = this.getUser();
    if (!this.getToken() || !user) { location.href = this.ROUTES.login; return false; }
    if (user.role !== 'admin') {
      const m = { patient: '/pages/patient/dashboard.html', doctor: '/pages/doctor/dashboard.html' };
      location.href = m[user.role] || '/';
      return false;
    }
    return true;
  },

  getUser() { try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; } },
  getToken() { return localStorage.getItem('token'); },

  logout() {
    ['token', 'user', 'doctor', 'doctor_id'].forEach((k) => localStorage.removeItem(k));
    location.href = this.ROUTES.login;
  },

  async fetch(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (this.getToken()) headers.Authorization = `Bearer ${this.getToken()}`;
    if (options.body && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }
    const res = await fetch(`${this.API}${path}`, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) { this.logout(); throw new Error('Phiên đăng nhập hết hạn'); }
    if (!res.ok || data.success === false) throw new Error(data.message || 'Lỗi yêu cầu');
    return data.data;
  },

  async initPage(page, cb) {
    const ok = await AdminNavigation.init(page);
    if (ok && cb) cb();
  },

  syncNavUser() {
    const u = this.getUser();
    const n = document.getElementById('sidebarUserName');
    const a = document.getElementById('sidebarUserAvatar');
    const t = document.getElementById('topUserName');
    if (n && u) n.textContent = u.full_name || 'Admin';
    if (t && u) t.textContent = u.full_name || '';
    if (a && u) {
      a.textContent = this.initials(u.full_name);
      if (u.avatar) a.innerHTML = `<img src="${this.esc(u.avatar)}" alt="" />`;
    }
  },

  setActiveNav(p) {
    document.querySelectorAll('.nav-item[data-nav]').forEach((el) => el.classList.toggle('active', el.dataset.nav === p));
  },

  setPageTitle(p) {
    const el = document.getElementById('pageTitle');
    if (el) el.textContent = this.PAGE_TITLES[p] || 'Admin';
  },

  bindShellEvents() {
    const sb = document.getElementById('sidebar');
    document.getElementById('logoutBtn')?.addEventListener('click', (e) => { e.preventDefault(); this.logout(); });
    document.getElementById('sidebarToggle')?.addEventListener('click', () => {
      sb?.classList.toggle('open');
      document.getElementById('sidebarOverlay')?.classList.toggle('show', sb?.classList.contains('open'));
    });
    document.getElementById('sidebarOverlay')?.addEventListener('click', () => {
      sb?.classList.remove('open');
      document.getElementById('sidebarOverlay')?.classList.remove('show');
    });
  },

  refreshIcons() {
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

  toast(msg, type = 'info') {
    let el = document.getElementById('appToast');
    if (!el) { el = document.createElement('div'); el.id = 'appToast'; document.body.appendChild(el); }
    el.className = `app-toast show toast-${type}`;
    el.innerHTML = `<i data-lucide="${type === 'error' ? 'alert-circle' : type === 'success' ? 'check-circle' : 'info'}"></i><span>${this.esc(msg)}</span>`;
    this.refreshIcons();
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 3500);
  },

  esc(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  initials(n) {
    if (!n) return 'A';
    const p = n.trim().split(/\s+/);
    return p.length === 1 ? p[0][0].toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase();
  },

  money(n) { return (Number(n) || 0).toLocaleString('vi-VN') + 'đ'; },

  date(s) {
    if (!s) return '—';
    const d = new Date(s);
    return isNaN(d) ? s : d.toLocaleDateString('vi-VN');
  },

  dateTime(d, t) { return `${this.date(d)}${t ? ' • ' + t : ''}`; },

  userBadge(st) {
    const x = this.USER_STATUS[st] || { label: st, class: 'badge-muted' };
    return `<span class="badge ${x.class}">${this.esc(x.label)}</span>`;
  },

  apptBadge(st) {
    const x = this.APPT_STATUS[st] || { label: st, class: 'badge-muted' };
    return `<span class="badge ${x.class}">${this.esc(x.label)}</span>`;
  },

  openModal(id) {
    document.getElementById(id)?.classList.add('show');
    this.refreshIcons();
  },

  closeModal(id) {
    document.getElementById(id)?.classList.remove('show');
  },

  bindModalClose() {
    document.querySelectorAll('[data-close-modal]').forEach((b) => {
      b.addEventListener('click', () => b.closest('.modal-overlay')?.classList.remove('show'));
    });
  },

  setBtnLoading(btn, on) {
    if (!btn) return;
    btn.classList.toggle('loading', on);
    btn.disabled = on;
  }
};
