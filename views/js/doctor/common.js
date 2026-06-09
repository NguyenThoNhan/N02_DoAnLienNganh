const DoctorApp = {
  API: '/api',

  ROUTES: {
    login: '/pages/auth/login.html',
    dashboard: '/pages/doctor/dashboard.html',
    patients: '/pages/doctor/patient-list.html',
    examination: '/pages/doctor/examination.html',
    profile: '/pages/doctor/profile.html'
  },

  TITLE_LABELS: { bs: 'Bác sĩ', ths_cki: 'ThS.BS.CKI', ts_ckii: 'TS.BS.CKII', pgs: 'PGS.TS', gs: 'GS.TS' },

  APPT_STATUS: {
    pending: { label: 'Chờ', class: 'badge-warning' },
    confirmed: { label: 'Xác nhận', class: 'badge-info' },
    in_progress: { label: 'Đang khám', class: 'badge-primary' },
    completed: { label: 'Xong', class: 'badge-success' },
    cancelled: { label: 'Hủy', class: 'badge-muted' }
  },

  PAGE_TITLES: {
    dashboard: 'Tổng quan bác sĩ', patients: 'Danh sách bệnh nhân', examination: 'Phòng khám', profile: 'Hồ sơ bác sĩ'
  },

  LAB_STATUS: {
    ordered: 'Đã chỉ định',
    sample_collected: 'Đã lấy mẫu',
    processing: 'Đang xử lý',
    completed: 'Hoàn thành'
  },

  requireAuth() {
    const token = localStorage.getItem('token');
    const user = this.getUser();
    if (!token || !user) { window.location.href = this.ROUTES.login; return false; }
    if (user.role !== 'doctor') {
      const map = { admin: '/pages/admin/dashboard.html', patient: '/pages/patient/dashboard.html' };
      window.location.href = map[user.role] || '/';
      return false;
    }
    return true;
  },

  getUser() {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
  },

  getDoctor() {
    try { return JSON.parse(localStorage.getItem('doctor') || 'null'); } catch { return null; }
  },

  getToken() { return localStorage.getItem('token'); },

  getDoctorId() {
    const d = this.getDoctor();
    if (d?.id) return d.id;
    return localStorage.getItem('doctor_id') ? Number(localStorage.getItem('doctor_id')) : null;
  },

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
    if (res.status === 401) { this.logout(); throw new Error('Phiên đăng nhập hết hạn'); }
    if (!res.ok || data.success === false) throw new Error(data.message || 'Yêu cầu thất bại');
    return data.data;
  },

  async ensureDoctorProfile() {
    let doctor = this.getDoctor();
    if (doctor?.id) return doctor;
    const data = await this.fetch('/doctors/me/profile');
    doctor = data.doctor;
    if (doctor) {
      localStorage.setItem('doctor', JSON.stringify(doctor));
      localStorage.setItem('doctor_id', String(doctor.id));
    }
    return doctor;
  },

  syncNavUser() {
    const user = this.getUser();
    const doctor = this.getDoctor();
    const name = document.getElementById('sidebarUserName');
    const meta = document.getElementById('sidebarUserMeta');
    const avatar = document.getElementById('sidebarUserAvatar');
    const topName = document.getElementById('topUserName');

    if (name && user) name.textContent = user.full_name || 'Bác sĩ';
    if (topName && user) topName.textContent = user.full_name || '';
    if (meta && doctor) {
      meta.textContent = `${this.TITLE_LABELS[doctor.title] || doctor.title || ''} · ${doctor.department_name || ''}`;
    }
    if (avatar && user) {
      avatar.textContent = this.getInitials(user.full_name);
      const av = user.avatar || doctor?.avatar;
      if (av) avatar.innerHTML = `<img src="${this.escapeHtml(av)}" alt="" />`;
    }
  },

  setActiveNav(page) {
    document.querySelectorAll('.nav-item[data-nav]').forEach((el) => {
      el.classList.toggle('active', el.dataset.nav === page);
    });
  },

  setPageTitle(page) {
    const el = document.getElementById('pageTitle');
    if (el) el.textContent = this.PAGE_TITLES[page] || 'TechCare Bác sĩ';
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

  async initPage(page, cb) {
    await this.ensureDoctorProfile();
    const ok = await DoctorNavigation.init(page);
    if (ok && cb) cb();
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
    el.innerHTML = `<i data-lucide="${type === 'error' ? 'alert-circle' : type === 'success' ? 'check-circle' : 'info'}"></i><span>${this.escapeHtml(msg)}</span>`;
    this.refreshIcons();
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 3500);
  },

  getInitials(n) {
    if (!n) return 'BS';
    const p = n.trim().split(/\s+/);
    return p.length === 1 ? p[0].charAt(0) : (p[0].charAt(0) + p[p.length - 1].charAt(0)).toUpperCase();
  },

  escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  formatDate(s) {
    if (!s) return '—';
    const d = new Date(s);
    return isNaN(d) ? s : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  },

  formatDateTime(d, t) {
    return `${this.formatDate(d)}${t ? ' • ' + t : ''}`;
  },

  formatMoney(n) { return (Number(n) || 0).toLocaleString('vi-VN') + 'đ'; },

  statusBadge(st) {
    const x = this.APPT_STATUS[st] || { label: st, class: 'badge-muted' };
    return `<span class="badge ${x.class}">${this.escapeHtml(x.label)}</span>`;
  },

  toDateInput(d) {
    const x = d instanceof Date ? d : new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  }
};
