(function () {
  AdminApp.initPage('doctors', init);

  let doctors = [];
  let departments = [];

  function init() {
    AdminApp.bindModalClose();
    fillTitleSelect();
    document.getElementById('btnAdd')?.addEventListener('click', () => openForm());
    document.getElementById('docForm')?.addEventListener('submit', onSubmit);
    document.getElementById('searchInput')?.addEventListener('input', render);
    document.getElementById('filterDept')?.addEventListener('change', load);
    document.getElementById('filterStatus')?.addEventListener('change', load);
    loadDepts().then(load);
  }

  function fillTitleSelect() {
    const sel = document.getElementById('title');
    sel.innerHTML = AdminApp.DOCTOR_TITLES.map((t) =>
      `<option value="${t}">${AdminApp.TITLE_LABELS[t] || t}</option>`
    ).join('');
  }

  async function loadDepts() {
    const data = await AdminApp.fetch('/departments');
    departments = data.departments || [];
    const filter = document.getElementById('filterDept');
    const deptSel = document.getElementById('departmentId');
    const opts = departments.map((d) => `<option value="${d.id}">${AdminApp.esc(d.name)}</option>`).join('');
    filter.innerHTML = '<option value="">Tất cả khoa</option>' + opts;
    deptSel.innerHTML = opts;
  }

  async function load() {
    const dept = document.getElementById('filterDept')?.value;
    const st = document.getElementById('filterStatus')?.value || 'all';
    const params = new URLSearchParams({ limit: 100, status: st });
    if (dept) params.set('department_id', dept);
    const q = `?${params}`;
    try {
      const res = await AdminApp.fetch(`/doctors${q}`);
      doctors = res.data || [];
      render();
    } catch (err) {
      document.getElementById('tableBody').innerHTML = `<tr><td colspan="6">${AdminApp.esc(err.message)}</td></tr>`;
    }
  }

  function render() {
    const q = (document.getElementById('searchInput')?.value || '').toLowerCase();
    const filtered = doctors.filter((d) =>
      !q || (d.full_name || '').toLowerCase().includes(q) || (d.phone || '').includes(q)
    );
    const body = document.getElementById('tableBody');
    if (!filtered.length) {
      body.innerHTML = '<tr><td colspan="6"><div class="empty-state">Không có bác sĩ</div></td></tr>';
      return;
    }
    body.innerHTML = filtered.map((d) => `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            <div class="sidebar-user-avatar" style="width:36px;height:36px;font-size:0.7rem">
              ${d.avatar ? `<img src="${AdminApp.esc(d.avatar)}" alt="" />` : AdminApp.initials(d.full_name)}
            </div>
            <div><strong>${AdminApp.esc(d.full_name)}</strong><br><small>${AdminApp.esc(d.phone)}</small></div>
          </div>
        </td>
        <td>${AdminApp.esc(d.department_name)}</td>
        <td>${AdminApp.esc(AdminApp.TITLE_LABELS[d.title] || d.title)}</td>
        <td>${AdminApp.money(d.consultation_fee)}</td>
        <td>${d.status === 'active' ? '<span class="badge badge-success">Hoạt động</span>' : '<span class="badge badge-muted">Ngưng</span>'}</td>
        <td class="actions">
          <button type="button" class="btn btn-outline btn-sm" data-edit="${d.id}"><i data-lucide="pencil"></i></button>
        </td>
      </tr>`).join('');
    body.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openForm(doctors.find((x) => x.id == b.dataset.edit))));
    AdminApp.refreshIcons();
  }

  function openForm(item) {
    const isEdit = !!item;
    document.getElementById('modalTitle').textContent = isEdit ? 'Sửa bác sĩ' : 'Thêm bác sĩ';
    document.getElementById('docId').value = item?.id || '';
    document.getElementById('fullName').value = item?.full_name || '';
    document.getElementById('phone').value = item?.phone || '';
    document.getElementById('password').value = '';
    document.getElementById('departmentId').value = item?.department_id || '';
    document.getElementById('title').value = item?.title || 'bs';
    document.getElementById('consultationFee').value = item?.consultation_fee ?? 200000;
    document.getElementById('specialization').value = item?.specialization || '';
    document.getElementById('experienceYears').value = item?.experience_years ?? 0;
    document.getElementById('bio').value = item?.bio || '';
    document.getElementById('phoneGroup').hidden = isEdit;
    document.getElementById('passGroup').hidden = isEdit;
    document.getElementById('statusGroup').hidden = !isEdit;
    if (isEdit) document.getElementById('docStatus').value = item.status || 'active';
    document.getElementById('avatar').value = '';
    AdminApp.openModal('docModal');
  }

  async function onSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('docSubmit');
    const id = document.getElementById('docId').value;
    const fd = new FormData();
    fd.append('full_name', document.getElementById('fullName').value.trim());
    fd.append('department_id', document.getElementById('departmentId').value);
    fd.append('title', document.getElementById('title').value);
    fd.append('consultation_fee', document.getElementById('consultationFee').value || 0);
    fd.append('specialization', document.getElementById('specialization').value.trim());
    fd.append('experience_years', document.getElementById('experienceYears').value || 0);
    fd.append('bio', document.getElementById('bio').value.trim());
    const avatar = document.getElementById('avatar').files[0];
    if (avatar) fd.append('avatar', avatar);

    if (id) {
      fd.append('status', document.getElementById('docStatus').value);
    } else {
      fd.append('phone', document.getElementById('phone').value.trim());
      fd.append('password', document.getElementById('password').value);
    }

    AdminApp.setBtnLoading(btn, true);
    try {
      if (id) await AdminApp.fetch(`/doctors/${id}`, { method: 'PUT', body: fd });
      else await AdminApp.fetch('/doctors', { method: 'POST', body: fd });
      AdminApp.toast('Lưu bác sĩ thành công', 'success');
      AdminApp.closeModal('docModal');
      load();
    } catch (err) {
      AdminApp.toast(err.message, 'error');
    } finally {
      AdminApp.setBtnLoading(btn, false);
    }
  }
})();
