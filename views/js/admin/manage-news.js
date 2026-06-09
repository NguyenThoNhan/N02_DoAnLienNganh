(function () {
  AdminApp.initPage('news', init);

  let list = [];
  let timer;

  function init() {
    AdminApp.bindModalClose();
    const cat = document.getElementById('newsCategory');
    cat.innerHTML = Object.entries(AdminApp.NEWS_CATEGORIES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
    document.getElementById('btnAdd')?.addEventListener('click', () => openForm());
    document.getElementById('newsForm')?.addEventListener('submit', onSubmit);
    document.getElementById('searchInput')?.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(load, 350);
    });
    load();
  }

  async function load() {
    const search = document.getElementById('searchInput')?.value.trim();
    const q = search ? `?search=${encodeURIComponent(search)}&limit=50` : '?limit=50';
    try {
      const res = await AdminApp.fetch(`/news${q}`);
      list = res.data || [];
      render();
    } catch (err) {
      document.getElementById('tableBody').innerHTML = `<tr><td colspan="6">${AdminApp.esc(err.message)}</td></tr>`;
    }
  }

  function statusBadge(s) {
    const m = { draft: 'badge-muted', published: 'badge-success', archived: 'badge-warning' };
    const l = { draft: 'Nháp', published: 'Đã xuất bản', archived: 'Lưu trữ' };
    return `<span class="badge ${m[s] || 'badge-muted'}">${l[s] || s}</span>`;
  }

  function render() {
    const body = document.getElementById('tableBody');
    if (!list.length) {
      body.innerHTML = '<tr><td colspan="6"><div class="empty-state">Chưa có bài viết</div></td></tr>';
      return;
    }
    body.innerHTML = list.map((n) => `
      <tr>
        <td>${n.thumbnail ? `<img class="thumb-preview" src="${AdminApp.esc(n.thumbnail)}" alt="" />` : '—'}</td>
        <td><strong>${AdminApp.esc(n.title)}</strong>${n.is_featured ? ' <span class="badge badge-primary">Nổi bật</span>' : ''}</td>
        <td>${AdminApp.esc(AdminApp.NEWS_CATEGORIES[n.category] || n.category)}</td>
        <td>${statusBadge(n.status)}</td>
        <td>${n.view_count ?? 0}</td>
        <td class="actions">
          ${n.status !== 'published' ? `<button type="button" class="btn btn-primary btn-sm" data-pub="${n.id}">Xuất bản</button>` : ''}
          <button type="button" class="btn btn-outline btn-sm" data-edit="${n.id}"><i data-lucide="pencil"></i></button>
          <button type="button" class="btn btn-outline btn-sm" data-del="${n.id}"><i data-lucide="trash-2"></i></button>
        </td>
      </tr>`).join('');
    body.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openForm(list.find((x) => x.id == b.dataset.edit))));
    body.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => removeNews(b.dataset.del)));
    body.querySelectorAll('[data-pub]').forEach((b) => b.addEventListener('click', () => publish(b.dataset.pub)));
    AdminApp.refreshIcons();
  }

  function openForm(item) {
    document.getElementById('modalTitle').textContent = item ? 'Sửa bài viết' : 'Bài viết mới';
    document.getElementById('newsId').value = item?.id || '';
    document.getElementById('newsTitle').value = item?.title || '';
    document.getElementById('newsCategory').value = item?.category || 'news';
    document.getElementById('newsStatus').value = item?.status || 'draft';
    document.getElementById('newsSummary').value = item?.summary || '';
    document.getElementById('newsContent').value = item?.content || '';
    document.getElementById('newsFeatured').checked = !!item?.is_featured;
    document.getElementById('newsThumb').value = '';
    AdminApp.openModal('newsModal');
  }

  async function onSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('newsSubmit');
    const id = document.getElementById('newsId').value;
    const fd = new FormData();
    fd.append('title', document.getElementById('newsTitle').value.trim());
    fd.append('content', document.getElementById('newsContent').value.trim());
    fd.append('summary', document.getElementById('newsSummary').value.trim());
    fd.append('category', document.getElementById('newsCategory').value);
    fd.append('status', document.getElementById('newsStatus').value);
    fd.append('is_featured', document.getElementById('newsFeatured').checked ? 'true' : 'false');
    const thumb = document.getElementById('newsThumb').files[0];
    if (thumb) fd.append('thumbnail', thumb);

    AdminApp.setBtnLoading(btn, true);
    try {
      if (id) await AdminApp.fetch(`/news/${id}`, { method: 'PUT', body: fd });
      else await AdminApp.fetch('/news', { method: 'POST', body: fd });
      AdminApp.toast('Lưu bài viết thành công', 'success');
      AdminApp.closeModal('newsModal');
      load();
    } catch (err) {
      AdminApp.toast(err.message, 'error');
    } finally {
      AdminApp.setBtnLoading(btn, false);
    }
  }

  async function publish(id) {
    try {
      await AdminApp.fetch(`/news/${id}/publish`, { method: 'PATCH' });
      AdminApp.toast('Đã xuất bản', 'success');
      load();
    } catch (err) {
      AdminApp.toast(err.message, 'error');
    }
  }

  async function removeNews(id) {
    if (!confirm('Xóa bài viết này?')) return;
    try {
      await AdminApp.fetch(`/news/${id}`, { method: 'DELETE' });
      AdminApp.toast('Đã xóa', 'success');
      load();
    } catch (err) {
      AdminApp.toast(err.message, 'error');
    }
  }
})();
