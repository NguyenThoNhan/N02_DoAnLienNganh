(function () {
  AdminApp.initPage('drugs', init);

  let list = [];
  let timer;

  function init() {
    AdminApp.bindModalClose();
    document.getElementById('btnAdd')?.addEventListener('click', () => openForm());
    document.getElementById('drugForm')?.addEventListener('submit', onSubmit);
    document.getElementById('stockForm')?.addEventListener('submit', onStock);
    document.getElementById('searchInput')?.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(load, 350);
    });
    load();
  }

  async function load() {
    const search = document.getElementById('searchInput')?.value.trim();
    const q = search ? `?search=${encodeURIComponent(search)}&limit=80` : '?limit=80';
    try {
      const res = await AdminApp.fetch(`/drugs${q}`);
      list = res.data || [];
      render();
    } catch (err) {
      document.getElementById('tableBody').innerHTML = `<tr><td colspan="7">${AdminApp.esc(err.message)}</td></tr>`;
    }
  }

  function render() {
    const body = document.getElementById('tableBody');
    if (!list.length) {
      body.innerHTML = '<tr><td colspan="7"><div class="empty-state">Không có thuốc</div></td></tr>';
      return;
    }
    body.innerHTML = list.map((d) => `
      <tr>
        <td><code>${AdminApp.esc(d.code)}</code></td>
        <td><strong>${AdminApp.esc(d.name)}</strong></td>
        <td>${AdminApp.money(d.unit_price)}</td>
        <td><span class="${Number(d.stock) < 20 ? 'badge badge-warning' : ''}">${d.stock ?? 0}</span></td>
        <td>${AdminApp.esc(d.unit || '—')}</td>
        <td>${d.status === 'active' ? '<span class="badge badge-success">Đang KD</span>' : '<span class="badge badge-muted">Ngưng</span>'}</td>
        <td class="actions">
          <button type="button" class="btn btn-outline btn-sm" data-stock="${d.id}" data-name="${AdminApp.esc(d.name)}"><i data-lucide="package"></i></button>
          <button type="button" class="btn btn-outline btn-sm" data-edit="${d.id}"><i data-lucide="pencil"></i></button>
          <button type="button" class="btn btn-outline btn-sm" data-del="${d.id}"><i data-lucide="trash-2"></i></button>
        </td>
      </tr>`).join('');
    body.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openForm(list.find((x) => x.id == b.dataset.edit))));
    body.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => removeDrug(b.dataset.del)));
    body.querySelectorAll('[data-stock]').forEach((b) => {
      b.addEventListener('click', () => {
        document.getElementById('stockDrugId').value = b.dataset.stock;
        document.getElementById('stockDrugName').textContent = b.dataset.name;
        document.getElementById('stockQty').value = '';
        AdminApp.openModal('stockModal');
      });
    });
    AdminApp.refreshIcons();
  }

  function openForm(item) {
    document.getElementById('modalTitle').textContent = item ? 'Sửa thuốc' : 'Thêm thuốc';
    document.getElementById('drugId').value = item?.id || '';
    document.getElementById('drugName').value = item?.name || '';
    document.getElementById('drugCode').value = item?.code || '';
    document.getElementById('drugCode').disabled = !!item;
    document.getElementById('unitPrice').value = item?.unit_price ?? '';
    document.getElementById('stock').value = item?.stock ?? 0;
    document.getElementById('unit').value = item?.unit || '';
    document.getElementById('category').value = item?.category || '';
    document.getElementById('manufacturer').value = item?.manufacturer || '';
    document.getElementById('drugDesc').value = item?.description || '';
    document.getElementById('drugStatusGroup').hidden = !item;
    if (item) document.getElementById('drugStatus').value = item.status || 'active';
    AdminApp.openModal('drugModal');
  }

  async function onSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('drugSubmit');
    const id = document.getElementById('drugId').value;
    const body = {
      name: document.getElementById('drugName').value.trim(),
      code: document.getElementById('drugCode').value.trim(),
      unit_price: Number(document.getElementById('unitPrice').value),
      stock: Number(document.getElementById('stock').value) || 0,
      unit: document.getElementById('unit').value.trim() || null,
      category: document.getElementById('category').value.trim() || null,
      manufacturer: document.getElementById('manufacturer').value.trim() || null,
      description: document.getElementById('drugDesc').value.trim() || null
    };
    if (id) body.status = document.getElementById('drugStatus').value;
    AdminApp.setBtnLoading(btn, true);
    try {
      if (id) await AdminApp.fetch(`/drugs/${id}`, { method: 'PUT', body });
      else await AdminApp.fetch('/drugs', { method: 'POST', body });
      AdminApp.toast('Lưu thuốc thành công', 'success');
      AdminApp.closeModal('drugModal');
      load();
    } catch (err) {
      AdminApp.toast(err.message, 'error');
    } finally {
      AdminApp.setBtnLoading(btn, false);
    }
  }

  async function onStock(e) {
    e.preventDefault();
    const id = document.getElementById('stockDrugId').value;
    try {
      await AdminApp.fetch(`/drugs/${id}/stock`, {
        method: 'PATCH',
        body: {
          quantity: Number(document.getElementById('stockQty').value),
          note: document.getElementById('stockNote').value.trim() || null
        }
      });
      AdminApp.toast('Cập nhật tồn kho thành công', 'success');
      AdminApp.closeModal('stockModal');
      load();
    } catch (err) {
      AdminApp.toast(err.message, 'error');
    }
  }

  async function removeDrug(id) {
    if (!confirm('Xóa / ngưng kinh doanh thuốc này?')) return;
    try {
      await AdminApp.fetch(`/drugs/${id}`, { method: 'DELETE' });
      AdminApp.toast('Đã xử lý', 'success');
      load();
    } catch (err) {
      AdminApp.toast(err.message, 'error');
    }
  }
})();
