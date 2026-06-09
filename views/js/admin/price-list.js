(function () {
  AdminApp.initPage('prices', init);

  let list = [];

  function init() {
    AdminApp.bindModalClose();
    const sel = document.getElementById('serviceType');
    sel.innerHTML = AdminApp.SERVICE_TYPES.map((t) =>
      `<option value="${t}">${AdminApp.SERVICE_LABELS[t] || t}</option>`
    ).join('');
    document.getElementById('btnAdd')?.addEventListener('click', () => openForm());
    document.getElementById('svcForm')?.addEventListener('submit', onSubmit);
    load();
  }

  async function load() {
    try {
      const data = await AdminApp.fetch('/services');
      list = data.services || [];
      render();
    } catch (err) {
      document.getElementById('tableBody').innerHTML = `<tr><td colspan="6">${AdminApp.esc(err.message)}</td></tr>`;
    }
  }

  function render() {
    const body = document.getElementById('tableBody');
    if (!list.length) {
      body.innerHTML = '<tr><td colspan="6"><div class="empty-state">Chưa có dịch vụ</div></td></tr>';
      return;
    }
    body.innerHTML = list.map((s) => `
      <tr>
        <td><code>${AdminApp.esc(s.service_type)}</code></td>
        <td><strong>${AdminApp.esc(s.name)}</strong></td>
        <td>${AdminApp.money(s.price)}</td>
        <td>${AdminApp.esc(s.description || '—')}</td>
        <td>${s.status === 'active' ? '<span class="badge badge-success">Hoạt động</span>' : '<span class="badge badge-muted">Ngưng</span>'}</td>
        <td class="actions">
          <button type="button" class="btn btn-outline btn-sm" data-edit="${s.id}"><i data-lucide="pencil"></i></button>
          <button type="button" class="btn btn-outline btn-sm" data-del="${s.id}"><i data-lucide="trash-2"></i></button>
        </td>
      </tr>`).join('');
    body.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openForm(list.find((x) => x.id == b.dataset.edit))));
    body.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => removeSvc(b.dataset.del)));
    AdminApp.refreshIcons();
  }

  function openForm(item) {
    document.getElementById('modalTitle').textContent = item ? 'Sửa dịch vụ' : 'Thêm dịch vụ';
    document.getElementById('svcId').value = item?.id || '';
    document.getElementById('serviceType').value = item?.service_type || AdminApp.SERVICE_TYPES[0];
    document.getElementById('serviceType').disabled = !!item;
    document.getElementById('svcName').value = item?.name || '';
    document.getElementById('svcPrice').value = item?.price ?? '';
    document.getElementById('svcDesc').value = item?.description || '';
    AdminApp.openModal('svcModal');
  }

  async function onSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('svcSubmit');
    const id = document.getElementById('svcId').value;
    const body = {
      service_type: document.getElementById('serviceType').value,
      name: document.getElementById('svcName').value.trim(),
      price: Number(document.getElementById('svcPrice').value),
      description: document.getElementById('svcDesc').value.trim() || null
    };
    AdminApp.setBtnLoading(btn, true);
    try {
      if (id) await AdminApp.fetch(`/services/${id}`, { method: 'PUT', body });
      else await AdminApp.fetch('/services', { method: 'POST', body });
      AdminApp.toast('Lưu dịch vụ thành công', 'success');
      AdminApp.closeModal('svcModal');
      load();
    } catch (err) {
      AdminApp.toast(err.message, 'error');
    } finally {
      AdminApp.setBtnLoading(btn, false);
    }
  }

  async function removeSvc(id) {
    if (!confirm('Xóa dịch vụ này?')) return;
    try {
      await AdminApp.fetch(`/services/${id}`, { method: 'DELETE' });
      AdminApp.toast('Đã xóa', 'success');
      load();
    } catch (err) {
      AdminApp.toast(err.message, 'error');
    }
  }
})();
