(function () {
  PatientApp.initPage('booking', init);

  function init() {

  let profileComplete = true;
  let profileMissing = [];
  let profileUser = null;

  const state = {
    deptId: null,
    deptName: '',
    doctorId: null,
    doctor: null,
    serviceType: 'doctor',
    date: '',
    timeSlot: '',
    reason: '',
    priceMap: {},
    fee: 0
  };

  let departments = [];
  let doctors = [];

  const deptGrid = document.getElementById('deptGrid');
  const doctorGrid = document.getElementById('doctorGrid');
  const serviceType = document.getElementById('serviceType');
  const apptDate = document.getElementById('apptDate');
  const slotGrid = document.getElementById('slotGrid');

  apptDate.min = PatientApp.toDateInputValue(new Date());
  apptDate.addEventListener('change', loadSlots);
  serviceType.addEventListener('change', updateFee);
  document.getElementById('toStep2').addEventListener('click', () => goStep(2));
  document.getElementById('toStep3').addEventListener('click', () => goStep(3));
  document.getElementById('toStep4').addEventListener('click', () => { buildSummary(); goStep(4); });
  document.getElementById('submitBooking').addEventListener('click', submitBooking);
  document.querySelectorAll('[data-back]').forEach((b) => {
    b.addEventListener('click', () => goStep(Number(b.dataset.back)));
  });
  document.getElementById('btnCloseBookingSlip')?.addEventListener('click', closeBookingSlip);
  document.getElementById('btnBookingSlipDone')?.addEventListener('click', closeBookingSlip);
  document.getElementById('btnPrintBookingSlip')?.addEventListener('click', () => window.print());
  document.getElementById('bookingSlipModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'bookingSlipModal') closeBookingSlip();
  });

  function showProfileGate() {
    const alert = document.getElementById('profileGateAlert');
    const text = document.getElementById('profileGateText');
    if (!alert || !text) return;
    if (profileComplete) {
      alert.style.display = 'none';
      return;
    }
    alert.style.display = '';
    text.textContent = `Vui lòng cập nhật đầy đủ hồ sơ trước khi đặt lịch (thiếu: ${profileMissing.join(', ')}).`;
    document.querySelectorAll('.wizard-panel button.btn-primary, #submitBooking').forEach((btn) => {
      btn.disabled = true;
    });
    PatientApp.refreshIcons();
  }

  async function checkProfile() {
    try {
      const data = await PatientApp.fetch('/patients/profile');
      const user = data.user;
      profileUser = user;
      profileComplete = data.profile_complete !== false && user?.profile_complete !== false;
      profileMissing = data.profile_missing || user?.profile_missing || [];
      if (user) localStorage.setItem('user', JSON.stringify(user));
      showProfileGate();
    } catch (err) {
      PatientApp.toast(err.message, 'error');
    }
  }

  async function loadBookingData() {
    try {
      await checkProfile();
      const [deptRes, priceRes] = await Promise.all([
        PatientApp.fetch('/departments?status=active'),
        PatientApp.fetch('/services/price-map')
      ]);
      departments = deptRes.departments || [];
      state.priceMap = priceRes.price_map || {};
      renderDepartments();
      renderServiceOptions();
    } catch (err) {
      PatientApp.toast(err.message, 'error');
    }
  }

  function renderServiceOptions() {
    const types = ['doctor', 'request', 'ths_cki', 'ts_ckii', 'pgs', 'request_24_7'];
    serviceType.innerHTML = types.map((t) => {
      const entry = state.priceMap[t];
      const price = entry?.price ?? entry;
      const label = PatientApp.SERVICE_LABELS[t] || t;
      const feeText = t === 'doctor' ? ' — Theo phí bác sĩ' : (price != null ? ` — ${PatientApp.formatMoney(price)}` : '');
      return `<option value="${t}">${label}${feeText}</option>`;
    }).join('');
  }

  function renderDepartments() {
    if (!departments.length) {
      deptGrid.innerHTML = '<p class="empty-state">Chưa có chuyên khoa</p>';
      return;
    }
    deptGrid.innerHTML = departments.map((d) => `
      <div class="select-card" data-dept-id="${d.id}">
        <h4>${PatientApp.escapeHtml(d.name)}</h4>
        <p>${PatientApp.escapeHtml(d.code || '')}</p>
      </div>`).join('');

    deptGrid.querySelectorAll('.select-card').forEach((card) => {
      card.addEventListener('click', () => {
        deptGrid.querySelectorAll('.select-card').forEach((c) => c.classList.remove('selected'));
        card.classList.add('selected');
        state.deptId = Number(card.dataset.deptId);
        state.deptName = departments.find((x) => x.id === state.deptId)?.name || '';
        document.getElementById('toStep2').disabled = false;
      });
    });
  }

  async function loadDoctors() {
    doctorGrid.innerHTML = '<div class="skeleton" style="height:80px;grid-column:1/-1"></div>';
    document.getElementById('selectedDeptLabel').textContent = state.deptName;
    try {
      const res = await PatientApp.fetch(`/doctors/by-department/${state.deptId}`);
      doctors = res.doctors || [];
      if (!doctors.length) {
        doctorGrid.innerHTML = '<p class="empty-state">Khoa này chưa có bác sĩ</p>';
        return;
      }
      doctorGrid.innerHTML = doctors.map((d) => `
        <div class="select-card doctor-select-card" data-doctor-id="${d.id}">
          <div class="av">${PatientApp.getInitials(d.full_name)}</div>
          <div>
            <h4>${PatientApp.escapeHtml(d.full_name)}</h4>
            <p>${PatientApp.escapeHtml(PatientApp.TITLE_LABELS[d.title] || d.title)} · ${PatientApp.formatMoney(d.consultation_fee)}</p>
          </div>
        </div>`).join('');

      doctorGrid.querySelectorAll('.select-card').forEach((card) => {
        card.addEventListener('click', () => {
          doctorGrid.querySelectorAll('.select-card').forEach((c) => c.classList.remove('selected'));
          card.classList.add('selected');
          state.doctorId = Number(card.dataset.doctorId);
          state.doctor = doctors.find((x) => x.id === state.doctorId);
          document.getElementById('toStep3').disabled = false;
          updateFee();
        });
      });
    } catch (err) {
      PatientApp.toast(err.message, 'error');
    }
  }

  function updateFee() {
    state.serviceType = serviceType.value;
    if (state.serviceType === 'doctor' && state.doctor) {
      state.fee = Number(state.doctor.consultation_fee) || 0;
    } else {
      const entry = state.priceMap[state.serviceType];
      state.fee = Number(entry?.price ?? entry) || 0;
    }
  }

  async function loadSlots() {
    state.date = apptDate.value;
    state.timeSlot = '';
    document.getElementById('toStep4').disabled = true;

    if (!state.date || !state.doctorId) return;

    if (PatientApp.isSunday(state.date)) {
      slotGrid.innerHTML = '<p class="alert alert-warning" style="margin:0"><i data-lucide="info"></i> Chủ nhật bệnh viện không làm việc</p>';
      PatientApp.refreshIcons();
      return;
    }

    slotGrid.innerHTML = '<div class="skeleton" style="height:40px;width:100%"></div>';
    try {
      const res = await PatientApp.fetch(`/doctors/${state.doctorId}/available-slots?date=${state.date}`);
      const slots = res.slots || [];
      if (!slots.length) {
        slotGrid.innerHTML = '<p class="form-hint">Không có khung giờ</p>';
        return;
      }
      slotGrid.innerHTML = slots.map((s) => `
        <button type="button" class="slot-btn" data-slot="${s.time}" ${s.available ? '' : 'disabled'}>${s.time}</button>`).join('');

      slotGrid.querySelectorAll('.slot-btn:not(:disabled)').forEach((btn) => {
        btn.addEventListener('click', () => {
          slotGrid.querySelectorAll('.slot-btn').forEach((b) => b.classList.remove('selected'));
          btn.classList.add('selected');
          state.timeSlot = btn.dataset.slot;
          document.getElementById('toStep4').disabled = false;
        });
      });
    } catch (err) {
      PatientApp.toast(err.message, 'error');
      slotGrid.innerHTML = '<p class="form-hint">Không tải được khung giờ</p>';
    }
  }

  function buildSummary() {
    state.reason = document.getElementById('apptReason').value.trim();
    updateFee();
    document.getElementById('bookingSummary').innerHTML = `
      <dl>
        <dt>Chuyên khoa</dt><dd>${PatientApp.escapeHtml(state.deptName)}</dd>
        <dt>Bác sĩ</dt><dd>${PatientApp.escapeHtml(state.doctor?.full_name || '')}</dd>
        <dt>Dịch vụ</dt><dd>${PatientApp.escapeHtml(PatientApp.SERVICE_LABELS[state.serviceType])}</dd>
        <dt>Ngày giờ</dt><dd>${PatientApp.formatDateTime(state.date, state.timeSlot)}</dd>
        ${state.reason ? `<dt>Lý do</dt><dd>${PatientApp.escapeHtml(state.reason)}</dd>` : ''}
        <div class="total"><span>Tổng phí khám</span><span>${PatientApp.formatMoney(state.fee)}</span></div>
      </dl>`;
  }

  async function submitBooking() {
    if (!profileComplete) {
      PatientApp.toast('Vui lòng cập nhật hồ sơ cá nhân trước khi đặt lịch', 'error');
      window.location.href = PatientApp.ROUTES.profile;
      return;
    }
    const btn = document.getElementById('submitBooking');
    btn.classList.add('loading');
    btn.disabled = true;
    try {
      const data = await PatientApp.fetch('/bookings', {
        method: 'POST',
        body: {
          doctor_id: state.doctorId,
          service_type: state.serviceType,
          appointment_date: state.date,
          time_slot: state.timeSlot,
          reason: state.reason || undefined
        }
      });
      PatientApp.toast('Đặt lịch thành công!', 'success');
      if (data.booking_slip) {
        try {
          localStorage.setItem('booking_slip_last', JSON.stringify(data.booking_slip));
        } catch { /* ignore quota errors */ }
        openBookingSlip(data.booking_slip);
      } else {
        setTimeout(() => {
          window.location.href = PatientApp.ROUTES.dashboard;
        }, 1200);
      }
    } catch (err) {
      PatientApp.toast(err.message, 'error');
    } finally {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  }

  function goStep(n) {
    if (!profileComplete && n > 1) {
      PatientApp.toast('Cập nhật hồ sơ cá nhân trước khi tiếp tục đặt lịch', 'error');
      return;
    }
    if (n === 2 && state.deptId) loadDoctors();
    if (n === 3) {
      document.getElementById('selectedDoctorLabel').textContent =
        state.doctor ? `${state.doctor.full_name} — ${state.deptName}` : '—';
      updateFee();
    }

    document.querySelectorAll('.wizard-panel').forEach((p) => p.classList.remove('active'));
    document.getElementById(`step${n}`)?.classList.add('active');

    document.querySelectorAll('.wizard-step').forEach((s) => {
      const sn = Number(s.dataset.step);
      s.classList.toggle('active', sn === n);
      s.classList.toggle('done', sn < n);
    });

    PatientApp.refreshIcons();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  loadBookingData();

  function formatPatientCode(id) {
    return String(2000000000 + (Number(id) || 0)).slice(0, 10);
  }

  function calcAge(dob) {
    if (!dob) return '—';
    const d = new Date(dob);
    if (isNaN(d)) return '—';
    const t = new Date();
    let age = t.getFullYear() - d.getFullYear();
    const m = t.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && t.getDate() < d.getDate())) age -= 1;
    return age;
  }

  function renderBookingSlip(slip) {
    const genderLabel = slip.patient_gender === 'female' ? 'Nữ' : slip.patient_gender === 'male' ? 'Nam' : '—';
    return `
      <div class="guide-slip-doc">
        <div class="gs-header">
          <div class="gs-header-left">
            <div>BỘ Y TẾ</div>
            <div><strong>${PatientApp.escapeHtml(slip.hospital_name || 'BỆNH VIỆN ĐA KHOA TECHCARE')}</strong></div>
          </div>
          <div class="gs-barcode-box">
            <div class="gs-barcode-label">Mã bệnh nhân</div>
            <div class="gs-barcode">${'█'.repeat(26)}</div>
            <div class="gs-record-code">${PatientApp.escapeHtml(slip.patient_code || formatPatientCode(profileUser?.id))}</div>
          </div>
          <div class="gs-header-right">Khoa: <strong>${PatientApp.escapeHtml(slip.department_name || state.deptName)}</strong></div>
        </div>
        <h1 class="gs-title">PHIẾU HƯỚNG DẪN KHÁM</h1>
        <div class="gs-meta-row">
          <span>Ngày khám: ${PatientApp.formatDate(slip.appointment_date || state.date)} ${PatientApp.escapeHtml(slip.time_slot || state.timeSlot || '')}</span>
          <span class="gs-stt">STT: <strong>${PatientApp.escapeHtml(String(slip.queue_number || ''))}</strong></span>
        </div>
        <div class="gs-patient">
          <p><span>Họ và tên:</span> <strong class="gs-name">${PatientApp.escapeHtml(slip.patient_name || profileUser?.full_name || '')}</strong></p>
          <p><span>Đối tượng:</span> ${PatientApp.escapeHtml(slip.subject || 'Dịch vụ')} &nbsp;|&nbsp; <span>Tuổi:</span> ${PatientApp.escapeHtml(String(slip.patient_age ?? calcAge(profileUser?.dob)))} &nbsp;|&nbsp; <span>Giới tính:</span> ${genderLabel}</p>
          <p><span>CCCD/CMND:</span> ${PatientApp.escapeHtml(slip.patient_id_card || profileUser?.id_card || '—')}</p>
          <p><span>Địa chỉ:</span> ${PatientApp.escapeHtml(slip.patient_address || profileUser?.address || '—')}</p>
        </div>
        <table class="gs-table">
          <thead><tr><th>Mã BN</th><th>Bác sĩ khám</th><th>Phòng khám</th><th>Tầng / Khu</th></tr></thead>
          <tbody>
            <tr>
              <td class="gs-tc">${PatientApp.escapeHtml(slip.patient_code || formatPatientCode(profileUser?.id))}</td>
              <td>${PatientApp.escapeHtml(slip.doctor_name || state.doctor?.full_name || '')}</td>
              <td>${PatientApp.escapeHtml(slip.room || 'Phòng tiếp đón')}</td>
              <td>${PatientApp.escapeHtml(slip.floor || 'Tầng 1 - Nhà A1')}</td>
            </tr>
          </tbody>
        </table>
      </div>`;
  }

  function openBookingSlip(slip) {
    const modal = document.getElementById('bookingSlipModal');
    const printEl = document.getElementById('bookingSlipPrint');
    if (!modal || !printEl) return;
    printEl.innerHTML = renderBookingSlip(slip);
    modal.classList.add('show');
    PatientApp.refreshIcons();
  }

  function closeBookingSlip() {
    document.getElementById('bookingSlipModal')?.classList.remove('show');
    window.location.href = PatientApp.ROUTES.dashboard;
  }
  }
})();
