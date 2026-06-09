const API = '/api';

const TITLE_LABELS = {
  bs: 'Bác sĩ',
  ths_cki: 'ThS.BS.CKI',
  ts_ckii: 'TS.BS.CKII',
  pgs: 'PGS.TS',
  gs: 'GS.TS'
};

const DEPT_ICONS = [
  { icon: 'heart-pulse', bg: '#dbeafe', color: '#2563eb' },
  { icon: 'brain', bg: '#ede9fe', color: '#7c3aed' },
  { icon: 'baby', bg: '#fce7f3', color: '#db2777' },
  { icon: 'bone', bg: '#ffedd5', color: '#ea580c' },
  { icon: 'wind', bg: '#cffafe', color: '#0891b2' },
  { icon: 'stethoscope', bg: '#dcfce7', color: '#16a34a' },
  { icon: 'eye', bg: '#e0e7ff', color: '#4f46e5' },
  { icon: 'activity', bg: '#fef3c7', color: '#d97706' }
];

const NEWS_CATEGORIES = {
  news: 'Tin tức',
  event: 'Sự kiện',
  announcement: 'Thông báo',
  health_tips: 'Sức khỏe'
};

function formatFee(amount) {
  const n = Number(amount) || 0;
  return n.toLocaleString('vi-VN') + 'đ';
}

function formatDate(str) {
  if (!str) return '';
  return new Date(str).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

async function fetchJSON(url) {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.message || 'Request failed');
  return data.data;
}

function initIcons() {
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function initHeader() {
  const header = document.getElementById('header');
  const menuToggle = document.getElementById('menuToggle');
  const navMobile = document.getElementById('navMobile');

  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 24);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  menuToggle?.addEventListener('click', () => {
    const open = navMobile.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', open);
    menuToggle.innerHTML = open
      ? '<i data-lucide="x"></i>'
      : '<i data-lucide="menu"></i>';
    initIcons();
  });

  navMobile?.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      navMobile.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
      menuToggle.innerHTML = '<i data-lucide="menu"></i>';
      initIcons();
    });
  });
}

function redirectIfLoggedIn() {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  if (!token || !user?.role) return;

  const map = {
    admin: '/pages/admin/dashboard.html',
    doctor: '/pages/doctor/dashboard.html',
    patient: '/pages/patient/dashboard.html'
  };
  const target = map[user.role];
  if (!target) return;

  const params = new URLSearchParams(window.location.search);
  if (params.get('stay') === '1') return;
}

async function loadDepartments() {
  const container = document.getElementById('deptList');
  const trustDepts = document.getElementById('trustDepts');
  if (!container) return;

  try {
    const { departments } = await fetchJSON(`${API}/departments?status=active`);
    const list = departments || [];
    if (trustDepts) trustDepts.textContent = list.length || '8+';
    const statDepts = document.getElementById('statDepts');
    if (statDepts) statDepts.textContent = list.length ? `${list.length}+` : '8+';

    if (!list.length) {
      container.innerHTML = '<p class="empty-state" style="flex:1">Chưa có dữ liệu chuyên khoa.</p>';
      return;
    }

    container.innerHTML = list.map((dept, i) => {
      const style = DEPT_ICONS[i % DEPT_ICONS.length];
      return `
        <article class="dept-card">
          <div class="dept-icon" style="background:${style.bg};color:${style.color}">
            <i data-lucide="${style.icon}"></i>
          </div>
          <h3>${escapeHtml(dept.name)}</h3>
          <p>${escapeHtml(dept.code || '')}</p>
        </article>`;
    }).join('');
    initIcons();
  } catch {
    container.innerHTML = '<p class="empty-state" style="flex:1">Không tải được chuyên khoa.</p>';
    if (trustDepts) trustDepts.textContent = '8+';
  }
}

async function loadDoctors() {
  const grid = document.getElementById('doctorsGrid');
  const trustDoctors = document.getElementById('trustDoctors');
  const heroAppts = document.getElementById('heroAppointments');
  if (!grid) return;

  try {
    const result = await fetchJSON(`${API}/doctors?status=active&limit=4`);
    const doctors = result.data || result.doctors || [];
    const total = result.total ?? doctors.length;

    if (trustDoctors) trustDoctors.textContent = total > 0 ? `${total}+` : '100+';
    const statDoctors = document.getElementById('statDoctors');
    if (statDoctors) statDoctors.textContent = total > 0 ? `${total}+` : '100+';

    if (heroAppts && doctors.length) {
      heroAppts.innerHTML = doctors.slice(0, 3).map((d) => `
        <div class="appt-item">
          <div class="appt-avatar">${d.avatar
            ? `<img src="${escapeHtml(d.avatar)}" alt="" />`
            : escapeHtml(getInitials(d.full_name))}</div>
          <div class="appt-info">
            <strong>${escapeHtml(d.full_name)}</strong>
            <span>${escapeHtml(d.department_name || d.specialization || '')}</span>
          </div>
          <span class="appt-status">${escapeHtml(TITLE_LABELS[d.title] || 'Bác sĩ')}</span>
        </div>`).join('');
    }

    if (!doctors.length) {
      grid.innerHTML = '<p class="empty-state">Chưa có bác sĩ hiển thị.</p>';
      return;
    }

    grid.innerHTML = doctors.map((d) => `
      <article class="doctor-card">
        <div class="doctor-avatar">
          ${d.avatar
            ? `<img src="${escapeHtml(d.avatar)}" alt="${escapeHtml(d.full_name)}" />`
            : escapeHtml(getInitials(d.full_name))}
        </div>
        <h3>${escapeHtml(d.full_name)}</h3>
        <p class="doctor-title">${escapeHtml(TITLE_LABELS[d.title] || d.title)}</p>
        <p class="doctor-dept">${escapeHtml(d.department_name || '')}</p>
        <p class="doctor-fee">Phí khám: ${formatFee(d.consultation_fee)}</p>
        <div class="rating">
          <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          <span>4.9</span>
        </div>
      </article>`).join('');
  } catch {
    grid.innerHTML = '<p class="empty-state">Không tải được danh sách bác sĩ.</p>';
    if (trustDoctors) trustDoctors.textContent = '100+';
    if (heroAppts) {
      heroAppts.innerHTML = `
        <div class="appt-item">
          <div class="appt-avatar">TC</div>
          <div class="appt-info"><strong>TechCare Hospital</strong><span>Đa khoa — Đặt lịch online</span></div>
          <span class="appt-status">Mở cửa</span>
        </div>`;
    }
  }
}

async function loadNews() {
  const grid = document.getElementById('newsGrid');
  if (!grid) return;

  try {
    const result = await fetchJSON(`${API}/news?limit=3`);
    const articles = result.data || [];

    if (!articles.length) {
      grid.innerHTML = '<p class="empty-state">Chưa có bài viết nào.</p>';
      return;
    }

    grid.innerHTML = articles.map((n) => `
      <article class="news-card">
        <div class="news-thumb">
          ${n.thumbnail
            ? `<img src="${escapeHtml(n.thumbnail)}" alt="" loading="lazy" />`
            : '<i data-lucide="newspaper"></i>'}
        </div>
        <div class="news-body">
          <p class="news-cat">${escapeHtml(NEWS_CATEGORIES[n.category] || n.category || 'Tin tức')}</p>
          <h3>${escapeHtml(n.title)}</h3>
          <p>${escapeHtml(n.summary || '')}</p>
          <p class="news-date">${formatDate(n.published_at || n.created_at)}</p>
        </div>
      </article>`).join('');
    initIcons();
  } catch {
    grid.innerHTML = '<p class="empty-state">Không tải được tin tức.</p>';
  }
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

document.addEventListener('DOMContentLoaded', () => {
  initIcons();
  initHeader();
  redirectIfLoggedIn();
  loadDepartments();
  loadDoctors();
  loadNews();
});
