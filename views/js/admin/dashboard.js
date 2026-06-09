(function () {
  AdminApp.initPage('dashboard', init);

  function init() {
    const u = AdminApp.getUser();
    document.getElementById('todayLabel').textContent = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (u) document.getElementById('heroTitle').textContent = `Xin chào, ${u.full_name?.split(' ').pop() || 'Admin'}!`;

    document.getElementById('revenueGroup')?.addEventListener('change', (e) => loadRevenue(e.target.value));
    loadAll();
  }

  async function loadAll() {
    await Promise.all([loadStats(), loadRevenue('month'), loadTopDoctors(), loadDeptStats(), loadPending()]);
  }

  async function loadStats() {
    const grid = document.getElementById('metricGrid');
    try {
      const { stats: s } = await AdminApp.fetch('/admin/stats');
      const items = [
        { icon: 'users', cls: 'violet', val: s.total_patients, lbl: 'Bệnh nhân', sub: `+${s.new_patients_30days || 0} trong 30 ngày` },
        { icon: 'stethoscope', cls: 'blue', val: s.total_doctors, lbl: 'Bác sĩ', sub: `${s.total_departments || 0} khoa` },
        { icon: 'calendar-check', cls: 'teal', val: s.today_appointments, lbl: 'Lịch hôm nay', sub: `${s.pending_appointments || 0} chờ xác nhận` },
        { icon: 'activity', cls: 'amber', val: s.completed_appointments, lbl: 'Ca đã khám', sub: `Tổng ${s.total_appointments || 0} lịch` },
        { icon: 'wallet', cls: 'green', val: AdminApp.money(s.monthly_revenue), lbl: 'Doanh thu tháng', sub: `Hôm nay: ${AdminApp.money(s.today_revenue)}` },
        { icon: 'trending-up', cls: 'rose', val: AdminApp.money(s.total_revenue), lbl: 'Doanh thu tích lũy', sub: 'Đã thanh toán' }
      ];
      grid.innerHTML = items.map((m, i) => `
        <div class="metric-card" style="animation-delay:${i * 0.06}s">
          <div class="m-icon ${m.cls}"><i data-lucide="${m.icon}"></i></div>
          <div>
            <div class="m-val">${AdminApp.esc(String(m.val))}</div>
            <div class="m-lbl">${AdminApp.esc(m.lbl)}</div>
            <div class="m-sub">${AdminApp.esc(m.sub)}</div>
          </div>
        </div>`).join('');
      AdminApp.refreshIcons();
    } catch (err) {
      grid.innerHTML = `<p class="text-muted">${AdminApp.esc(err.message)}</p>`;
    }
  }

  async function loadRevenue(groupBy) {
    const el = document.getElementById('revenueChart');
    try {
      const { chart } = await AdminApp.fetch(`/admin/revenue?group_by=${groupBy}`);
      const rows = chart || [];
      if (!rows.length) {
        el.innerHTML = '<p class="empty-state">Chưa có dữ liệu doanh thu</p>';
        return;
      }
      const max = Math.max(...rows.map((r) => Number(r.total_revenue) || 0), 1);
      el.innerHTML = rows.slice(-12).map((r) => {
        const h = Math.round(((Number(r.total_revenue) || 0) / max) * 160);
        const label = (r.period || '').slice(5) || r.period;
        return `<div class="chart-bar-wrap" title="${AdminApp.money(r.total_revenue)}">
          <div class="chart-bar" style="height:${Math.max(h, 6)}px"></div>
          <span>${AdminApp.esc(label)}</span>
        </div>`;
      }).join('');
    } catch (err) {
      el.innerHTML = `<p class="text-muted">${AdminApp.esc(err.message)}</p>`;
    }
  }

  async function loadTopDoctors() {
    const el = document.getElementById('topDoctorsList');
    try {
      const { top_doctors: list } = await AdminApp.fetch('/admin/top-doctors?limit=5');
      if (!list?.length) {
        el.innerHTML = '<div class="empty-state">Chưa có dữ liệu</div>';
        return;
      }
      el.innerHTML = `<ul class="rank-list">${list.map((d, i) => `
        <li class="rank-item">
          <span class="rank-num">${i + 1}</span>
          <div class="rank-body">
            <strong>${AdminApp.esc(d.doctor_name)}</strong>
            <span>${AdminApp.esc(d.department_name)} · ${AdminApp.TITLE_LABELS[d.title] || d.title}</span>
          </div>
          <div class="rank-meta">
            <span>${d.total_appointments} ca</span>
            <small>${AdminApp.money(d.total_revenue)}</small>
          </div>
        </li>`).join('')}</ul>`;
    } catch (err) {
      el.innerHTML = `<p class="text-muted">${AdminApp.esc(err.message)}</p>`;
    }
  }

  async function loadDeptStats() {
    const el = document.getElementById('deptStats');
    try {
      const { departments: list } = await AdminApp.fetch('/admin/department-stats');
      if (!list?.length) {
        el.innerHTML = '<div class="empty-state">Chưa có khoa</div>';
        return;
      }
      const max = Math.max(...list.map((d) => Number(d.revenue) || 0), 1);
      el.innerHTML = list.slice(0, 8).map((d) => {
        const pct = Math.round(((Number(d.revenue) || 0) / max) * 100);
        return `<div class="dept-bar-row">
          <label>${AdminApp.esc(d.name)}</label>
          <div class="dept-bar-track"><div class="dept-bar-fill" style="width:${pct}%"></div></div>
          <span style="font-size:0.75rem;color:var(--text-muted);width:72px;text-align:right">${AdminApp.money(d.revenue)}</span>
        </div>`;
      }).join('');
    } catch (err) {
      el.innerHTML = `<p class="text-muted">${AdminApp.esc(err.message)}</p>`;
    }
  }

  async function loadPending() {
    const body = document.getElementById('pendingBookings');
    try {
      const { data: list } = await AdminApp.fetch('/bookings?status=pending&limit=15');
      if (!list?.length) {
        body.innerHTML = '<tr><td colspan="6"><div class="empty-state">Không có lịch chờ</div></td></tr>';
        return;
      }
      body.innerHTML = list.map((a) => row(a)).join('');
      body.querySelectorAll('[data-confirm]').forEach((btn) => {
        btn.addEventListener('click', () => confirmBooking(btn.dataset.confirm));
      });
    } catch (err) {
      body.innerHTML = `<tr><td colspan="6">${AdminApp.esc(err.message)}</td></tr>`;
    }
  }

  function row(a) {
    const d = a.appointment_date?.toString?.().slice(0, 10) || a.appointment_date;
    return `<tr>
      <td>${AdminApp.dateTime(d, a.time_slot)}</td>
      <td>${AdminApp.esc(a.patient_name)}</td>
      <td>${AdminApp.esc(a.doctor_name)}</td>
      <td>${AdminApp.esc(a.department_name)}</td>
      <td>${AdminApp.apptBadge(a.status)}</td>
      <td class="actions"><button type="button" class="btn btn-primary btn-sm" data-confirm="${a.id}"><i data-lucide="check"></i> Xác nhận</button></td>
    </tr>`;
  }

  async function confirmBooking(id) {
    try {
      await AdminApp.fetch(`/bookings/${id}/confirm`, { method: 'PATCH' });
      AdminApp.toast('Đã xác nhận lịch hẹn', 'success');
      loadPending();
      loadStats();
    } catch (err) {
      AdminApp.toast(err.message, 'error');
    }
  }
})();
