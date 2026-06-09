(function () {
  DoctorApp.initPage('profile', init);

  let doctor = null;

  function init() {
    document.getElementById('profileForm')?.addEventListener('submit', onSave);
    document.getElementById('avatarInput')?.addEventListener('change', onAvatarPick);
    load();
  }

  async function load() {
    try {
      const data = await DoctorApp.fetch('/doctors/me/profile');
      doctor = data.doctor;
      if (doctor) {
        localStorage.setItem('doctor', JSON.stringify(doctor));
        localStorage.setItem('doctor_id', String(doctor.id));
      }
      fillForm();
      DoctorApp.syncNavUser();
    } catch (err) {
      DoctorApp.toast(err.message, 'error');
    }
  }

  function fillForm() {
    if (!doctor) return;
    document.getElementById('full_name').value = doctor.full_name || '';
    document.getElementById('phone').value = doctor.phone || '';
    document.getElementById('title_label').value = DoctorApp.TITLE_LABELS[doctor.title] || doctor.title || '';
    document.getElementById('consultation_fee').value = doctor.consultation_fee ?? '';
    document.getElementById('specialization').value = doctor.specialization || '';
    document.getElementById('experience_years').value = doctor.experience_years ?? 0;
    document.getElementById('bio').value = doctor.bio || '';
    document.getElementById('deptReadonly').textContent = `${doctor.department_name || ''} (${doctor.department_code || ''})`;

    const av = document.getElementById('avatarPreview');
    const src = doctor.avatar;
    if (src) av.innerHTML = `<img src="${DoctorApp.escapeHtml(src)}" alt="" />`;
    else av.textContent = DoctorApp.getInitials(doctor.full_name);
  }

  function onAvatarPick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const av = document.getElementById('avatarPreview');
    av.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="" />`;
  }

  async function onSave(e) {
    e.preventDefault();
    const btn = document.getElementById('saveBtn');
    btn.disabled = true;
    const fd = new FormData();
    fd.append('full_name', document.getElementById('full_name').value.trim());
    fd.append('specialization', document.getElementById('specialization').value.trim());
    fd.append('experience_years', document.getElementById('experience_years').value || 0);
    fd.append('consultation_fee', document.getElementById('consultation_fee').value || 0);
    fd.append('bio', document.getElementById('bio').value.trim());
    const file = document.getElementById('avatarInput').files?.[0];
    if (file) fd.append('avatar', file);

    try {
      const data = await DoctorApp.fetch('/doctors/me/profile', { method: 'PUT', body: fd });
      doctor = data.doctor;
      localStorage.setItem('doctor', JSON.stringify(doctor));
      DoctorApp.syncNavUser();
      DoctorApp.toast('Đã lưu hồ sơ', 'success');
      fillForm();
    } catch (err) {
      DoctorApp.toast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  }
})();
