(function () {
  PatientApp.initPage('history', init);

  function init() {

  const historyBody = document.getElementById('historyBody');
  const filterPayment = document.getElementById('filterPayment');
  const filterStatus = document.getElementById('filterStatus');
  const historySearch = document.getElementById('historySearch');
  const historyStats = document.getElementById('historyStats');
  let allRecords = [];

  filterPayment.addEventListener('change', render);
  filterStatus.addEventListener('change', render);
  historySearch?.addEventListener('input', render);

  async function load() {
    try {
      const data = await PatientApp.fetch('/records/my?limit=50');
      allRecords = data.data || [];
      render();
    } catch (err) {
      PatientApp.toast(err.message, 'error');
      historyBody.innerHTML = `<tr><td colspan="6"><div class="empty-state">${PatientApp.escapeHtml(err.message)}</div></td></tr>`;
    }
  }

  function render() {
    const pay = filterPayment.value;
    const st = filterStatus.value;
    const q = (historySearch?.value || '').trim().toLowerCase();
    let list = [...allRecords];
    if (pay) list = list.filter((r) => r.payment_status === pay);
    if (st) list = list.filter((r) => r.status === st);
    if (q) {
      list = list.filter((r) => {
        const hay = `${r.doctor_name || ''} ${r.department_name || ''} ${r.diagnosis || ''}`.toLowerCase();
        return hay.includes(q);
      });
    }

    renderStats(list);

    if (!list.length) {
      historyBody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i data-lucide="folder-open"></i><h3>Chưa có hồ sơ</h3><p>Lịch sử khám sẽ hiển thị tại đây sau khi bạn khám.</p></div></td></tr>`;
      PatientApp.refreshIcons();
      return;
    }

    historyBody.innerHTML = list.map((r) => `
      <tr>
        <td>${PatientApp.formatDateTime(r.appointment_date, r.time_slot)}</td>
        <td><strong>${PatientApp.escapeHtml(r.doctor_name || '—')}</strong><br><span style="font-size:0.78rem;color:var(--text-muted)">${PatientApp.escapeHtml(r.department_name || '')}</span></td>
        <td>${PatientApp.escapeHtml(r.diagnosis || '—')}</td>
        <td>${PatientApp.formatMoney(r.total_amount)}</td>
        <td>${PatientApp.paymentBadge(r.payment_status)}</td>
        <td><a href="${PatientApp.ROUTES.record}?id=${r.id}" class="btn btn-outline btn-sm"><i data-lucide="eye"></i> Chi tiết</a></td>
      </tr>`).join('');
    PatientApp.refreshIcons();
  }

  function renderStats(list) {
    if (!historyStats) return;
    const total = list.length;
    const completed = list.filter((x) => x.status === 'completed').length;
    const unpaid = list.filter((x) => x.payment_status === 'unpaid').length;
    const paid = list.filter((x) => x.payment_status === 'paid').length;
    historyStats.innerHTML = `
      <div class="history-stat-card"><span>Tổng hồ sơ</span><strong>${total}</strong></div>
      <div class="history-stat-card"><span>Hoàn thành</span><strong>${completed}</strong></div>
      <div class="history-stat-card"><span>Đã thanh toán</span><strong>${paid}</strong></div>
      <div class="history-stat-card"><span>Chưa thanh toán</span><strong>${unpaid}</strong></div>`;
  }

  load();
  }
})();
