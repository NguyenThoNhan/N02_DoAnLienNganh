(function () {
  PatientApp.initPage('profile', init);

  function init() {

  const avatarPreview = document.getElementById('avatarPreview');
  const avatarInput = document.getElementById('avatarInput');
  let avatarFile = null;

  avatarInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      PatientApp.toast('Ảnh tối đa 2MB', 'error');
      return;
    }
    avatarFile = file;
    const url = URL.createObjectURL(file);
    avatarPreview.innerHTML = `<img src="${url}" alt="" />`;
  });

  document.getElementById('profileForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('saveBtn');
    btn.classList.add('loading');
    btn.disabled = true;

    const fd = new FormData();
    fd.append('full_name', document.getElementById('full_name').value.trim());
    const idCard = document.getElementById('id_card').value.trim();
    const dob = document.getElementById('dob').value;
    const gender = document.getElementById('gender').value;
    const address = document.getElementById('address').value.trim();
    if (idCard) fd.append('id_card', idCard);
    if (dob) fd.append('dob', dob);
    if (gender) fd.append('gender', gender);
    if (address) fd.append('address', address);
    if (avatarFile) fd.append('avatar', avatarFile);

    try {
      const token = PatientApp.getToken();
      const res = await fetch(`${PatientApp.API}/patients/profile`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: fd
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Lưu thất bại');

      localStorage.setItem('user', JSON.stringify(data.data.user));
      PatientApp.toast('Cập nhật hồ sơ thành công', 'success');
      PatientApp.syncNavUser();
      fillForm(data.data.user);
      avatarFile = null;
    } catch (err) {
      PatientApp.toast(err.message, 'error');
    } finally {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  });

  function fillForm(user) {
    const ids = document.getElementById('profileIds');
    if (ids && user.patient_code) {
      ids.style.display = '';
      document.getElementById('patient_code').value = user.patient_code;
      document.getElementById('subject_label').value = user.subject_label || 'Dịch vụ';
    }
    const alertEl = document.getElementById('profileIncompleteAlert');
    if (alertEl) {
      if (user.profile_complete === false && user.profile_missing?.length) {
        alertEl.style.display = '';
        alertEl.innerHTML = `<i data-lucide="alert-triangle"></i> Hồ sơ chưa đầy đủ để đặt lịch khám. Vui lòng bổ sung: <strong>${user.profile_missing.join(', ')}</strong>.`;
      } else {
        alertEl.style.display = 'none';
      }
    }
    document.getElementById('full_name').value = user.full_name || '';
    document.getElementById('phone').value = user.phone || '';
    document.getElementById('id_card').value = user.id_card || '';
    document.getElementById('dob').value = user.dob ? String(user.dob).slice(0, 10) : '';
    document.getElementById('gender').value = user.gender || '';
    document.getElementById('address').value = user.address || '';

    if (user.avatar) {
      avatarPreview.innerHTML = `<img src="${PatientApp.escapeHtml(user.avatar)}" alt="" />`;
    } else {
      avatarPreview.textContent = PatientApp.getInitials(user.full_name);
    }
  }

  async function load() {
    try {
      const user = await PatientApp.loadProfile();
      fillForm(user);
      PatientApp.refreshIcons();
    } catch (err) {
      PatientApp.toast(err.message, 'error');
    }
  }

  load();
  }
})();
