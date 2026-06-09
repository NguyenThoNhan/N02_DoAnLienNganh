(function () {
  AdminApp.initPage('departments', init);

  let list = [];

  function init() {
    AdminApp.bindModalClose();
    document.getElementById('btnAdd')?.addEventListener('click', () => openForm());
    document.getElementById('deptForm')?.addEventListener('submit', onSubmit);
    document.getElementById('searchInput')?.addEventListener('input', render);
    load();
  }

  async function load() {
    const body = document.getElementById('tableBody');
    try {
      const data = await AdminApp.fetch('/departments');
      list = data.departments || [];
      render();
    } catch (err) {
      body.innerHTML = `<tr><td colspan="5">${AdminApp.esc(err.message)}</td></tr>`;
    }
  }

  function render() {
    const q = (document.getElementById('searchInput')?.value || '').toLowerCase();
    const filtered = list.filter((d) =>
      !q || (d.name || '').toLowerCase().includes(q) || (d.code || '').toLowerCase().includes(q)
    );
    const body = document.getElementById('tableBody');
    if (!filtered.length) {
      body.innerHTML = '<tr><td colspan="5"><div class="empty-state">Không có khoa</div></td></tr>';
      return;
    }
    body.innerHTML = filtered.map((d) => `
      <tr>
        <td><code>${AdminApp.esc(d.code)}</code></td>
        <td><strong>${AdminApp.esc(d.name)}</strong></td>
        <td>${AdminApp.esc(d.description || '—')}</td>
        <td>${d.status === 'active' ? '<span class="badge badge-success">Hoạt động</span>' : '<span class="badge badge-muted">Ngưng</span>'}</td>
        <td class="actions">
          <button type="button" class="btn btn-outline btn-sm" data-edit="${d.id}"><i data-lucide="pencil"></i></button>
          <button type="button" class="btn btn-outline btn-sm" data-del="${d.id}"><i data-lucide="trash-2"></i></button>
        </td>
      </tr>`).join('');
    body.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openForm(list.find((x) => x.id == b.dataset.edit))));
    body.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => removeDept(b.dataset.del)));
    AdminApp.refreshIcons();
  }

  function openForm(item) {
    document.getElementById('modalTitle').textContent = item ? 'Sửa khoa' : 'Thêm khoa';
    document.getElementById('deptId').value = item?.id || '';
    document.getElementById('deptName').value = item?.name || '';
    document.getElementById('deptCode').value = item?.code || '';
    document.getElementById('deptCode').disabled = !!item;
    document.getElementById('deptDesc').value = item?.description || '';
    document.getElementById('statusGroup').hidden = !item;
    if (item) document.getElementById('deptStatus').value = item.status || 'active';
    AdminApp.openModal('deptModal');
  }

  async function onSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('deptSubmit');
    const id = document.getElementById('deptId').value;
    const body = {
      name: document.getElementById('deptName').value.trim(),
      code: document.getElementById('deptCode').value.trim(),
      description: document.getElementById('deptDesc').value.trim() || null
    };
    if (id) body.status = document.getElementById('deptStatus').value;
    AdminApp.setBtnLoading(btn, true);
    try {
      if (id) await AdminApp.fetch(`/departments/${id}`, { method: 'PUT', body });
      else await AdminApp.fetch('/departments', { method: 'POST', body });
      AdminApp.toast('Lưu khoa thành công', 'success');
      AdminApp.closeModal('deptModal');
      load();
    } catch (err) {
      AdminApp.toast(err.message, 'error');
    } finally {
      AdminApp.setBtnLoading(btn, false);
    }
  }

  async function removeDept(id) {
    if (!confirm('Xóa khoa này? Chỉ xóa được khi không còn bác sĩ.')) return;
    try {
      await AdminApp.fetch(`/departments/${id}`, { method: 'DELETE' });
      AdminApp.toast('Đã xóa khoa', 'success');
      load();
    } catch (err) {
      AdminApp.toast(err.message, 'error');
    }
  }
})();
