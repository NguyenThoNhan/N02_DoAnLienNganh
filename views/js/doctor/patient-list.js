(function () {
  DoctorApp.initPage('patients', init);

  let allAppts = [];

  function init() {
    const dateEl = document.getElementById('filterDate');
    dateEl.value = DoctorApp.toDateInput(new Date());
    dateEl.addEventListener('change', load);
    document.getElementById('filterStatus').addEventListener('change', render);
    document.getElementById('searchInput').addEventListener('input', render);
    load();
  }

  async function load() {
    const date = document.getElementById('filterDate').value;
    const tbody = document.getElementById('patientTable');
    tbody.innerHTML = `<tr><td colspan="6"><div class="skeleton" style="height:48px"></div></td></tr>`;
    try {
      const data = await DoctorApp.fetch(`/examinations/queue?date=${date}`);
      allAppts = data.appointments || [];
      render();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6">${DoctorApp.escapeHtml(err.message)}</td></tr>`;
    }
  }

  function render() {
    const q = document.getElementById('searchInput').value.toLowerCase();
    const st = document.getElementById('filterStatus').value;
    let list = [...allAppts];
    if (st) list = list.filter((a) => a.status === st);
    if (q) {
      list = list.filter((a) =>
        (a.patient_name || '').toLowerCase().includes(q) ||
        (a.patient_phone || '').includes(q)
      );
    }

    const tbody = document.getElementById('patientTable');
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">Không có dữ liệu</div></td></tr>`;
      return;
    }

    tbody.innerHTML = list.map((a) => `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            <span class="queue-av" style="width:40px;height:40px;font-size:0.8rem">${DoctorApp.getInitials(a.patient_name)}</span>
            <div>
              <strong>${DoctorApp.escapeHtml(a.patient_name)}</strong><br>
              <span style="font-size:0.78rem;color:var(--text-muted)">${DoctorApp.escapeHtml(a.patient_phone || '')}</span>
            </div>
          </div>
        </td>
        <td>${DoctorApp.formatDateTime(a.appointment_date, a.time_slot)}</td>
        <td>${DoctorApp.escapeHtml(a.reason || '—')}</td>
        <td>${DoctorApp.statusBadge(a.status)}</td>
        <td>${a.health_record_id ? `#${a.health_record_id}` : '—'}</td>
        <td style="text-align:right">
          <a href="${DoctorApp.ROUTES.examination}?appointmentId=${a.id}" class="btn btn-primary btn-sm">
            <i data-lucide="stethoscope"></i> Khám
          </a>
        </td>
      </tr>`).join('');
    DoctorApp.refreshIcons();
  }
})();
