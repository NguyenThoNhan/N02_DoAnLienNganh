(function () {
  PatientApp.initPage('dashboard', init);

  function init() {

  let cancelApptId = null;

  const welcomeTitle = document.getElementById('welcomeTitle');
  const inlineMetrics = document.getElementById('inlineMetrics');
  const upcomingAppt = document.getElementById('upcomingAppt');
  const apptTableBody = document.getElementById('apptTableBody');
  const recentVisits = document.getElementById('recentVisits');
  const careAlerts = document.getElementById('careAlerts');
  const cancelModal = document.getElementById('cancelModal');

  const user = PatientApp.getUser();
  if (welcomeTitle && user) {
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Buổi sáng' : hour < 18 ? 'Buổi chiều' : 'Buổi tối';
    welcomeTitle.textContent = `${greet}, ${user.full_name?.split(' ').pop() || 'bạn'}!`;
  }
  const welcomeMeta = document.getElementById('welcomeMeta');
  if (welcomeMeta && user?.patient_code) {
    welcomeMeta.textContent = `Mã NB: ${user.patient_code} · Đối tượng: ${user.subject_label || 'Dịch vụ'}`;
  }
  if (user?.profile_complete === false) {
    PatientApp.loadProfile().then((u) => {
      if (u?.profile_complete === false && welcomeMeta) {
        welcomeMeta.innerHTML = `Hồ sơ chưa đầy đủ — <a href="${PatientApp.ROUTES.profile}">cập nhật ngay</a> trước khi đặt lịch.`;
      }
    }).catch(() => {});
  }

  document.querySelectorAll('[data-close-modal]').forEach((el) => {
    el.addEventListener('click', () => cancelModal?.classList.remove('show'));
  });

  document.getElementById('confirmCancelBtn')?.addEventListener('click', confirmCancel);

  const NEWS_CATEGORIES = {
    news: 'Tin tức',
    event: 'Sự kiện',
    announcement: 'Thông báo',
    health_tips: 'Sức khỏe'
  };

  async function load() {
    try {
      const [apptData, recordData, newsData] = await Promise.all([
        PatientApp.fetch('/bookings/my?limit=20'),
        PatientApp.fetch('/records/my?limit=5'),
        PatientApp.fetch('/news?limit=4').catch(() => ({ data: [] }))
      ]);

      const appointments = apptData.appointments || [];
      const records = recordData.data || [];

      renderMetrics(appointments, records);
      renderCareAlerts(appointments, records, user);
      renderUpcoming(appointments);
      renderApptTable(appointments);
      renderRecentVisits(records);
      renderNews(newsData.data || []);
    } catch (err) {
      PatientApp.toast(err.message, 'error');
    }
  }

  function renderNews(articles) {
    const grid = document.getElementById('newsGrid');
    if (!grid) return;
    if (!articles.length) {
      grid.innerHTML = '<p class="empty-state news-empty">Chưa có tin tức. Hãy quay lại sau.</p>';
      return;
    }
    const featured = articles[0];
    const rest = articles.slice(1, 4);
    grid.innerHTML = `
      <a href="/#news" class="news-featured">
        <div class="news-featured-media">
          ${featured.thumbnail
            ? `<img src="${PatientApp.escapeHtml(featured.thumbnail)}" alt="" loading="lazy" />`
            : '<div class="news-featured-placeholder"><i data-lucide="newspaper"></i></div>'}
          ${featured.is_featured ? '<span class="news-badge">Nổi bật</span>' : ''}
        </div>
        <div class="news-featured-body">
          <span class="news-cat">${PatientApp.escapeHtml(NEWS_CATEGORIES[featured.category] || 'Tin tức')}</span>
          <h3>${PatientApp.escapeHtml(featured.title)}</h3>
          <p>${PatientApp.escapeHtml((featured.summary || '').slice(0, 140))}</p>
          <time>${PatientApp.formatDate(featured.published_at || featured.created_at)}</time>
        </div>
      </a>
      <div class="news-side-stack">
        ${rest.map((n) => `
          <a href="/#news" class="news-side-card">
            <div class="news-side-thumb">
              ${n.thumbnail ? `<img src="${PatientApp.escapeHtml(n.thumbnail)}" alt="" />` : '<i data-lucide="file-text"></i>'}
            </div>
            <div>
              <span class="news-cat">${PatientApp.escapeHtml(NEWS_CATEGORIES[n.category] || 'Tin tức')}</span>
              <h4>${PatientApp.escapeHtml(n.title)}</h4>
              <time>${PatientApp.formatDate(n.published_at || n.created_at)}</time>
            </div>
          </a>`).join('')}
      </div>`;
    PatientApp.refreshIcons();
  }

  function renderMetrics(appointments, records) {
    const upcoming = appointments.filter((a) => ['pending', 'confirmed', 'in_progress'].includes(a.status)).length;
    const completed = appointments.filter((a) => a.status === 'completed').length;
    const unpaid = records.filter((r) => r.payment_status === 'unpaid' && r.status === 'completed').length;

    inlineMetrics.innerHTML = `
      <div class="metric-chip"><i data-lucide="calendar-clock"></i> <strong>${upcoming}</strong> lịch sắp tới</div>
      <div class="metric-chip"><i data-lucide="check-circle"></i> <strong>${completed}</strong> đã hoàn thành</div>
      <div class="metric-chip"><i data-lucide="wallet"></i> <strong>${unpaid}</strong> chờ thanh toán</div>`;
    PatientApp.refreshIcons();
  }

  function renderCareAlerts(appointments, records, currentUser) {
    if (!careAlerts) return;
    const alerts = [];
    const unpaid = records.filter((r) => r.payment_status === 'unpaid' && r.status === 'completed').length;
    const next = appointments
      .filter((a) => ['pending', 'confirmed', 'in_progress'].includes(a.status))
      .sort((a, b) => new Date(`${a.appointment_date}T${a.time_slot || '00:00'}:00`) - new Date(`${b.appointment_date}T${b.time_slot || '00:00'}:00`))[0];

    if (currentUser?.profile_complete === false) {
      alerts.push(`<a href="${PatientApp.ROUTES.profile}" class="care-alert-item warn"><i data-lucide="alert-triangle"></i><span>Hồ sơ chưa đầy đủ, cần cập nhật trước khi đặt lịch tiếp.</span></a>`);
    }
    if (next) {
      alerts.push(`<a href="${PatientApp.ROUTES.booking}" class="care-alert-item info"><i data-lucide="calendar-clock"></i><span>Lịch gần nhất: ${PatientApp.formatDateTime(next.appointment_date, next.time_slot)} với ${PatientApp.escapeHtml(next.doctor_name || 'bác sĩ')}.</span></a>`);
    }
    if (unpaid > 0) {
      alerts.push(`<a href="${PatientApp.ROUTES.history}" class="care-alert-item danger"><i data-lucide="wallet"></i><span>Có ${unpaid} hồ sơ chưa thanh toán, nên xử lý sớm để thuận tiện tái khám.</span></a>`);
    }
    if (!alerts.length) {
      alerts.push('<div class="care-alert-item ok"><i data-lucide="shield-check"></i><span>Hồ sơ và lịch khám đang ở trạng thái tốt. Không có cảnh báo ưu tiên.</span></div>');
    }
    careAlerts.innerHTML = alerts.join('');
    PatientApp.refreshIcons();
  }

  function renderUpcoming(list) {
    const now = new Date();
    const upcoming = list
      .filter((a) => !['cancelled', 'completed'].includes(a.status))
      .filter((a) => {
        const d = new Date(`${String(a.appointment_date).slice(0, 10)}T${a.time_slot || '00:00'}:00`);
        return d >= now || a.status === 'in_progress';
      })
      .sort((a, b) => new Date(a.appointment_date) - new Date(b.appointment_date))[0];

    if (!upcoming) {
      upcomingAppt.innerHTML = `
        <div class="empty-state" style="padding:24px">
          <i data-lucide="calendar-x"></i>
          <h3>Chưa có lịch sắp tới</h3>
          <p>Đặt lịch khám để được bác sĩ phục vụ.</p>
          <a href="/pages/patient/booking.html" class="btn btn-primary" style="margin-top:16px">Đặt lịch ngay</a>
        </div>`;
      PatientApp.refreshIcons();
      return;
    }

    upcomingAppt.innerHTML = `
      <div class="appt-card-lg">
        <div class="doctor-av">${PatientApp.getInitials(upcoming.doctor_name)}</div>
        <div class="appt-meta">
          <h3>${PatientApp.escapeHtml(upcoming.doctor_name)}</h3>
          <p class="sub">${PatientApp.escapeHtml(upcoming.department_name || '')}${upcoming.doctor_specialization ? ' · ' + PatientApp.escapeHtml(upcoming.doctor_specialization) : ''}</p>
          ${PatientApp.apptStatusBadge(upcoming.status)}
          <div class="appt-detail-row" style="margin-top:14px">
            <span><i data-lucide="calendar"></i> ${PatientApp.formatDateTime(upcoming.appointment_date, upcoming.time_slot)}</span>
            <span><i data-lucide="banknote"></i> ${PatientApp.formatMoney(upcoming.consultation_fee)}</span>
          </div>
          <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
            ${canCancel(upcoming) ? `<button type="button" class="btn btn-danger btn-sm" data-cancel="${upcoming.id}"><i data-lucide="x-circle"></i> Hủy lịch</button>` : ''}
            ${upcoming.health_record_id ? `<a href="${PatientApp.ROUTES.record}?id=${upcoming.health_record_id}" class="btn btn-outline btn-sm"><i data-lucide="file-text"></i> Hồ sơ</a>` : ''}
          </div>
        </div>
      </div>`;

    upcomingAppt.querySelector('[data-cancel]')?.addEventListener('click', (e) => openCancel(Number(e.currentTarget.dataset.cancel)));
    PatientApp.refreshIcons();
  }

  function renderApptTable(list) {
    if (!list.length) {
      apptTableBody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><p>Chưa có lịch hẹn nào</p></div></td></tr>`;
      return;
    }

    apptTableBody.innerHTML = list.slice(0, 8).map((a) => `
      <tr>
        <td><strong>${PatientApp.escapeHtml(a.doctor_name)}</strong><br><span style="font-size:0.78rem;color:var(--text-muted)">${PatientApp.escapeHtml(a.department_name || '')}</span></td>
        <td>${PatientApp.formatDateTime(a.appointment_date, a.time_slot)}</td>
        <td>${PatientApp.apptStatusBadge(a.status)}</td>
        <td>${PatientApp.formatMoney(a.consultation_fee)}</td>
        <td style="text-align:right">
          ${canCancel(a) ? `<button type="button" class="btn btn-ghost btn-sm" data-cancel="${a.id}">Hủy</button>` : ''}
        </td>
      </tr>`).join('');

    apptTableBody.querySelectorAll('[data-cancel]').forEach((btn) => {
      btn.addEventListener('click', () => openCancel(Number(btn.dataset.cancel)));
    });
  }

  function renderRecentVisits(records) {
    if (!records.length) {
      recentVisits.innerHTML = `<div class="empty-state" style="padding:24px"><p>Chưa có hồ sơ khám</p></div>`;
      return;
    }

    recentVisits.innerHTML = `<div class="visit-list">${records.map((r) => `
      <a href="${PatientApp.ROUTES.record}?id=${r.id}" class="visit-item">
        <div class="visit-item-left">
          <span class="icon-box blue"><i data-lucide="stethoscope"></i></span>
          <div>
            <strong>${PatientApp.escapeHtml(r.doctor_name || 'Ca khám')}</strong>
            <span>${PatientApp.formatDateTime(r.appointment_date, r.time_slot)} · ${PatientApp.escapeHtml(r.diagnosis || 'Đang cập nhật')}</span>
          </div>
        </div>
        ${PatientApp.paymentBadge(r.payment_status)}
      </a>`).join('')}</div>`;
    PatientApp.refreshIcons();
  }

  function canCancel(a) {
    if (!['pending', 'confirmed'].includes(a.status)) return false;
    const dt = new Date(`${String(a.appointment_date).slice(0, 10)}T${a.time_slot}:00`);
    return (dt - new Date()) / (1000 * 60 * 60) >= 2;
  }

  function openCancel(id) {
    cancelApptId = id;
    document.getElementById('cancelReason').value = '';
    cancelModal?.classList.add('show');
    PatientApp.refreshIcons();
  }

  async function confirmCancel() {
    if (!cancelApptId) return;
    const btn = document.getElementById('confirmCancelBtn');
    btn.classList.add('loading');
    btn.disabled = true;
    try {
      await PatientApp.fetch(`/bookings/${cancelApptId}/cancel`, {
        method: 'PATCH',
        body: { reason: document.getElementById('cancelReason').value.trim() || null }
      });
      PatientApp.toast('Đã hủy lịch hẹn', 'success');
      cancelModal.classList.remove('show');
      cancelApptId = null;
      load();
    } catch (err) {
      PatientApp.toast(err.message, 'error');
    } finally {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  }

  load();
  }
})();
