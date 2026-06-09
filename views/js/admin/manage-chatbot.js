(function () {
  AdminApp.initPage('chatbot', init);

  let list = [];

  function init() {
    AdminApp.bindModalClose();
    document.getElementById('btnAdd')?.addEventListener('click', () => openForm());
    document.getElementById('botForm')?.addEventListener('submit', onSubmit);
    load();
  }

  async function load() {
    try {
      const data = await AdminApp.fetch('/chatbot');
      list = data.intents || [];
      render();
    } catch (err) {
      document.getElementById('tableBody').innerHTML = `<tr><td colspan="6">${AdminApp.esc(err.message)}</td></tr>`;
    }
  }

  function parseKeywords(raw) {
    const trimmed = raw.trim();
    if (trimmed.startsWith('[')) return JSON.parse(trimmed);
    return trimmed.split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  }

  function render() {
    const body = document.getElementById('tableBody');
    if (!list.length) {
      body.innerHTML = '<tr><td colspan="6"><div class="empty-state">Chưa có kịch bản</div></td></tr>';
      return;
    }
    body.innerHTML = list.map((i) => {
      let kw = i.keywords;
      if (typeof kw === 'string') { try { kw = JSON.parse(kw); } catch { kw = [kw]; } }
      const kwStr = Array.isArray(kw) ? kw.slice(0, 4).join(', ') : '—';
      return `<tr>
        <td><code>${AdminApp.esc(i.intent_name)}</code></td>
        <td style="max-width:180px;font-size:0.8rem">${AdminApp.esc(kwStr)}</td>
        <td style="max-width:220px;font-size:0.85rem">${AdminApp.esc((i.response || '').slice(0, 80))}…</td>
        <td>${i.priority ?? 0}</td>
        <td>${i.is_active ? '<span class="badge badge-success">Bật</span>' : '<span class="badge badge-muted">Tắt</span>'}</td>
        <td class="actions">
          <button type="button" class="btn btn-outline btn-sm" data-toggle="${i.id}"><i data-lucide="power"></i></button>
          <button type="button" class="btn btn-outline btn-sm" data-edit="${i.id}"><i data-lucide="pencil"></i></button>
          <button type="button" class="btn btn-outline btn-sm" data-del="${i.id}"><i data-lucide="trash-2"></i></button>
        </td>
      </tr>`;
    }).join('');
    body.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openForm(list.find((x) => x.id == b.dataset.edit))));
    body.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => removeIntent(b.dataset.del)));
    body.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => toggleIntent(b.dataset.toggle)));
    AdminApp.refreshIcons();
  }

  function openForm(item) {
    document.getElementById('modalTitle').textContent = item ? 'Sửa kịch bản' : 'Kịch bản mới';
    document.getElementById('botId').value = item?.id || '';
    document.getElementById('intentName').value = item?.intent_name || '';
    document.getElementById('intentName').disabled = !!item;
    let kw = item?.keywords;
    if (typeof kw === 'string') { try { kw = JSON.parse(kw); } catch { /* keep */ } }
    document.getElementById('keywords').value = Array.isArray(kw) ? JSON.stringify(kw) : '[]';
    document.getElementById('response').value = item?.response || '';
    document.getElementById('actionType').value = item?.action_type || 'text';
    document.getElementById('actionUrl').value = item?.action_url || '';
    document.getElementById('priority').value = item?.priority ?? 0;
    document.getElementById('isActive').checked = item?.is_active !== false && item?.is_active !== 0;
    AdminApp.openModal('botModal');
  }

  async function onSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('botSubmit');
    const id = document.getElementById('botId').value;
    let keywords;
    try {
      keywords = parseKeywords(document.getElementById('keywords').value);
      if (!Array.isArray(keywords) || !keywords.length) throw new Error('Cần ít nhất 1 từ khóa');
    } catch (err) {
      AdminApp.toast(err.message || 'Từ khóa không hợp lệ (dùng JSON mảng)', 'error');
      return;
    }
    const body = {
      intent_name: document.getElementById('intentName').value.trim(),
      keywords,
      response: document.getElementById('response').value.trim(),
      action_type: document.getElementById('actionType').value,
      action_url: document.getElementById('actionUrl').value.trim() || null,
      priority: Number(document.getElementById('priority').value) || 0,
      is_active: document.getElementById('isActive').checked
    };
    AdminApp.setBtnLoading(btn, true);
    try {
      if (id) await AdminApp.fetch(`/chatbot/${id}`, { method: 'PUT', body });
      else await AdminApp.fetch('/chatbot', { method: 'POST', body });
      AdminApp.toast('Lưu kịch bản thành công', 'success');
      AdminApp.closeModal('botModal');
      load();
    } catch (err) {
      AdminApp.toast(err.message, 'error');
    } finally {
      AdminApp.setBtnLoading(btn, false);
    }
  }

  async function toggleIntent(id) {
    try {
      await AdminApp.fetch(`/chatbot/${id}/toggle`, { method: 'PATCH' });
      AdminApp.toast('Đã đổi trạng thái', 'success');
      load();
    } catch (err) {
      AdminApp.toast(err.message, 'error');
    }
  }

  async function removeIntent(id) {
    if (!confirm('Xóa kịch bản này?')) return;
    try {
      await AdminApp.fetch(`/chatbot/${id}`, { method: 'DELETE' });
      AdminApp.toast('Đã xóa', 'success');
      load();
    } catch (err) {
      AdminApp.toast(err.message, 'error');
    }
  }
})();
