(function () {
  DoctorApp.initPage('dashboard', init);

  function init() {
    const user = DoctorApp.getUser();
    const doctor = DoctorApp.getDoctor();
    document.getElementById('todayDate').textContent = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' });
    if (user) {
      document.getElementById('heroGreeting').textContent = `Chào ${user.full_name?.split(' ').pop() || 'bác sĩ'}!`;
    }
    if (doctor) {
      document.getElementById('heroSub').textContent = `${DoctorApp.TITLE_LABELS[doctor.title] || ''} · ${doctor.department_name || ''}`;
    }

    const queueDate = document.getElementById('queueDate');
    queueDate.value = DoctorApp.toDateInput(new Date());
    queueDate.addEventListener('change', () => loadSchedule(queueDate.value));

    document.getElementById('quickSearch')?.addEventListener('input', filterQueue);

    loadToday();
    loadSchedule(queueDate.value);
  }

  let queueData = [];
  let queueFilter = 'all';

  async function loadToday() {
    try {
      const data = await DoctorApp.fetch('/examinations/queue/today');
      queueData = data.appointments || [];
      applyQueueView();
    } catch (err) {
      DoctorApp.toast(err.message, 'error');
    }
  }

  async function loadSchedule(date) {
    const body = document.getElementById('scheduleBody');
    try {
      const data = await DoctorApp.fetch(`/examinations/queue?date=${date}`);
      const list = data.appointments || [];
      if (!list.length) {
        body.innerHTML = `<tr><td colspan="4"><div class="empty-state">Không có lịch</div></td></tr>`;
        return;
      }
      body.innerHTML = list.map((a) => rowHtml(a)).join('');
      bindRowActions(body);
    } catch (err) {
      body.innerHTML = `<tr><td colspan="4">${DoctorApp.escapeHtml(err.message)}</td></tr>`;
    }
  }

  function statusMatch(item, filter) {
    if (filter === 'all') return true;
    return item.status === filter;
  }

  function applyQueueView() {
    const q = (document.getElementById('quickSearch')?.value || '').toLowerCase().trim();
    const filtered = queueData
      .filter((a) => statusMatch(a, queueFilter))
      .filter((a) => {
        if (!q) return true;
        return (a.patient_name || '').toLowerCase().includes(q) || (a.patient_phone || '').includes(q);
      });
    renderStats(filtered, queueData.length);
    renderQueue(filtered);
  }

  function renderStats(list, totalBase) {
    const pending = list.filter((a) => ['pending', 'confirmed'].includes(a.status)).length;
    const active = list.filter((a) => a.status === 'in_progress').length;
    const done = list.filter((a) => a.status === 'completed').length;

    document.getElementById('statPills').innerHTML = `
      <div class="stat-pill">
        <span class="stat-pill-icon amber"><i data-lucide="clock"></i></span>
        <div><strong>${pending}</strong><span>Chờ khám</span></div>
      </div>
      <div class="stat-pill">
        <span class="stat-pill-icon blue"><i data-lucide="activity"></i></span>
        <div><strong>${active}</strong><span>Đang khám</span></div>
      </div>
      <div class="stat-pill">
        <span class="stat-pill-icon teal"><i data-lucide="check-circle"></i></span>
        <div><strong>${done}</strong><span>Hoàn thành</span></div>
      </div>
      <div class="stat-pill">
        <span class="stat-pill-icon violet"><i data-lucide="users"></i></span>
        <div><strong>${list.length}</strong><span>Hiển thị / ${totalBase ?? list.length} ca</span></div>
      </div>`;
    DoctorApp.refreshIcons();
  }

  function renderQueue(list) {
    const el = document.getElementById('queueList');
    const active = list.filter((a) => ['pending', 'confirmed', 'in_progress'].includes(a.status));
    if (!active.length) {
      el.innerHTML = `<div class="empty-state"><i data-lucide="coffee"></i><h3>Hàng chờ trống</h3><p>Chưa có bệnh nhân chờ khám hôm nay.</p></div>`;
      DoctorApp.refreshIcons();
      return;
    }
    el.innerHTML = active.map((a, i) => queueCardHtml(a, i)).join('');
    bindQueueActions(el);
    DoctorApp.refreshIcons();
  }

  function filterQueue() {
    applyQueueView();
  }

  function queueCardHtml(a, i) {
    const pri = a.status === 'in_progress' ? 'priority' : '';
    return `
      <div class="queue-card ${pri}" data-id="${a.id}" style="animation-delay:${i * 0.05}s">
        <div class="queue-av">${DoctorApp.getInitials(a.patient_name)}</div>
        <div class="queue-body">
          <h4>${DoctorApp.escapeHtml(a.patient_name)}</h4>
          <p>${a.time_slot} · ${DoctorApp.escapeHtml(a.reason || 'Khám bệnh')} · ${DoctorApp.escapeHtml(a.patient_phone || '')}</p>
          <div style="margin-top:8px">${DoctorApp.statusBadge(a.status)}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${a.status === 'in_progress'
            ? `<a href="${DoctorApp.ROUTES.examination}?appointmentId=${a.id}" class="btn btn-primary btn-sm"><i data-lucide="stethoscope"></i> Tiếp tục</a>`
            : `<button type="button" class="btn btn-primary btn-sm" data-accept="${a.id}"><i data-lucide="user-check"></i> Tiếp nhận</button>`}
          <a href="${DoctorApp.ROUTES.examination}?appointmentId=${a.id}&view=1" class="btn btn-ghost btn-sm">Chi tiết</a>
        </div>
      </div>`;
  }

  function rowHtml(a) {
    return `
      <tr data-name="${DoctorApp.escapeHtml((a.patient_name || '').toLowerCase())}">
        <td><strong>${a.time_slot}</strong></td>
        <td>${DoctorApp.escapeHtml(a.patient_name)}<br><span style="font-size:0.78rem;color:var(--text-muted)">${DoctorApp.escapeHtml(a.patient_phone || '')}</span></td>
        <td>${DoctorApp.statusBadge(a.status)}</td>
        <td style="text-align:right">
          <a href="${DoctorApp.ROUTES.examination}?appointmentId=${a.id}" class="btn btn-outline btn-sm">Mở</a>
        </td>
      </tr>`;
  }

  function bindQueueActions(el) {
    el.querySelectorAll('[data-accept]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.accept;
        btn.disabled = true;
        try {
          await DoctorApp.fetch(`/examinations/appointments/${id}/accept`, { method: 'PATCH' });
          DoctorApp.toast('Đã tiếp nhận bệnh nhân', 'success');
          window.location.href = `${DoctorApp.ROUTES.examination}?appointmentId=${id}`;
        } catch (err) {
          DoctorApp.toast(err.message, 'error');
          btn.disabled = false;
        }
      });
    });
  }

  function bindRowActions(el) {
    DoctorApp.refreshIcons();
  }

  document.getElementById('queueFilterRow')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-queue-filter]');
    if (!btn) return;
    queueFilter = btn.dataset.queueFilter || 'all';
    document.querySelectorAll('#queueFilterRow [data-queue-filter]').forEach((x) => {
      x.classList.toggle('active', x === btn);
    });
    applyQueueView();
  });
})();
