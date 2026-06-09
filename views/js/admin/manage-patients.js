(function () {
  AdminApp.initPage('patients', init);

  const LIMIT = 20;
  let offset = 0;
  let total = 0;
  let timer;

  function init() {
    document.getElementById('searchInput')?.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => { offset = 0; load(); }, 350);
    });
    document.getElementById('filterStatus')?.addEventListener('change', () => { offset = 0; load(); });
    document.getElementById('btnPrev')?.addEventListener('click', () => { offset = Math.max(0, offset - LIMIT); load(); });
    document.getElementById('btnNext')?.addEventListener('click', () => { if (offset + LIMIT < total) { offset += LIMIT; load(); } });
    load();
  }

  async function load() {
    const body = document.getElementById('tableBody');
    const search = document.getElementById('searchInput')?.value.trim();
    const status = document.getElementById('filterStatus')?.value;
    const params = new URLSearchParams({ limit: LIMIT, offset });
    if (search) params.set('search', search);
    if (status) params.set('status', status);

    try {
      const res = await AdminApp.fetch(`/patients?${params}`);
      const list = res.data || [];
      total = res.total || 0;
      document.getElementById('pageInfo').textContent = `Hiển thị ${offset + 1}–${Math.min(offset + LIMIT, total)} / ${total}`;

      if (!list.length) {
        body.innerHTML = '<tr><td colspan="6"><div class="empty-state">Không có bệnh nhân</div></td></tr>';
        return;
      }
      body.innerHTML = list.map((p) => `
        <tr>
          <td><strong>${AdminApp.esc(p.full_name)}</strong></td>
          <td>${AdminApp.esc(p.phone)}</td>
          <td>${AdminApp.esc(p.email || '—')}</td>
          <td>${AdminApp.date(p.created_at)}</td>
          <td>${AdminApp.userBadge(p.status)}</td>
          <td class="actions">
            <select class="form-input" style="width:auto;padding:6px 10px;font-size:0.8rem" data-user="${p.id}">
              <option value="">Đổi trạng thái</option>
              <option value="active">Hoạt động</option>
              <option value="inactive">Ngưng</option>
              <option value="banned">Khóa</option>
            </select>
          </td>
        </tr>`).join('');

      body.querySelectorAll('select[data-user]').forEach((sel) => {
        sel.addEventListener('change', async () => {
          if (!sel.value) return;
          try {
            await AdminApp.fetch(`/admin/users/${sel.dataset.user}/status`, { method: 'PATCH', body: { status: sel.value } });
            AdminApp.toast('Cập nhật trạng thái thành công', 'success');
            load();
          } catch (err) {
            AdminApp.toast(err.message, 'error');
            sel.value = '';
          }
        });
      });
    } catch (err) {
      body.innerHTML = `<tr><td colspan="6">${AdminApp.esc(err.message)}</td></tr>`;
    }
  }
})();
