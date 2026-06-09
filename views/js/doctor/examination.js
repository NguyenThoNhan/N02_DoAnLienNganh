(function () {
  DoctorApp.initPage('examination', boot);

  const params = new URLSearchParams(location.search);
  const appointmentId = params.get('appointmentId');
  const recordIdParam = params.get('recordId');

  const STEPS = [
    { id: 'overview', label: 'Hồ sơ BN', icon: 'user' },
    { id: 'intake', label: 'Khám ban đầu', icon: 'stethoscope' },
    { id: 'lab-order', label: 'Chỉ định XN', icon: 'flask-conical' },
    { id: 'lab-results', label: 'Kết quả XN', icon: 'file-text' },
    { id: 'diagnosis', label: 'Chẩn đoán', icon: 'file-search' },
    { id: 'rx', label: 'Đơn thuốc', icon: 'pill' }
  ];

  const SUBJECT_LABELS = {
    doctor: 'Dịch vụ', request: 'Dịch vụ', pgs: 'Dịch vụ',
    ths_cki: 'Dịch vụ', ts_ckii: 'Dịch vụ', request_24_7: 'Dịch vụ'
  };

  let appointment = null;
  let record = null;
  let patientHistory = [];
  let drugs = [];
  let labTests = [];
  let currentStep = 0;
  let locked = true;
  let lastInstructionSlip = null;
  let lastAiInsight = null;

  function patientCode(id) {
    const n = Number(id) || 0;
    return String(2000000000 + n).slice(0, 10);
  }

  function subjectLabel(serviceType) {
    return SUBJECT_LABELS[serviceType] || 'Dịch vụ';
  }

  function calcAge(dob) {
    if (!dob) return '—';
    const d = new Date(dob);
    if (isNaN(d)) return '—';
    const today = new Date();
    let age = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
    return age;
  }

  function boot() {
    bindSlipModal();
    if (!appointmentId && !recordIdParam) {
      document.getElementById('examRoot').innerHTML = `<div class="empty-state"><h3>Chọn ca khám từ Dashboard</h3><a href="${DoctorApp.ROUTES.dashboard}" class="btn btn-primary">Về tổng quan</a></div>`;
      return;
    }
    loadCase();
  }

  async function loadCase() {
    try {
      if (recordIdParam) {
        const data = await DoctorApp.fetch(`/records/${recordIdParam}`);
        record = data.health_record || data;
        if (record?.appointment_id) {
          const ap = await DoctorApp.fetch(`/bookings/${record.appointment_id}`);
          appointment = ap.appointment;
        }
      } else if (appointmentId) {
        const ap = await DoctorApp.fetch(`/bookings/${appointmentId}`);
        appointment = ap.appointment;
        if (appointment?.health_record_id) {
          const rd = await DoctorApp.fetch(`/records/${appointment.health_record_id}`);
          record = rd.health_record;
        } else {
          try {
            const rd = await DoctorApp.fetch(`/records/by-appointment/${appointmentId}`);
            record = rd.health_record;
          } catch { /* chưa có record */ }
        }
      }

      locked = appointment && ['pending', 'confirmed'].includes(appointment.status);
      const pid = record?.patient_id || appointment?.patient_id;
      if (pid) {
        const hist = await DoctorApp.fetch(`/examinations/patients/${pid}/history?limit=8`);
        patientHistory = hist.data || [];
      }
      renderShell();
    } catch (err) {
      document.getElementById('examRoot').innerHTML = `<div class="empty-state">${DoctorApp.escapeHtml(err.message)}</div>`;
    }
  }

  async function reloadRecord() {
    if (!record?.id) return;
    const data = await DoctorApp.fetch(`/records/${record.id}`);
    record = data.health_record || data;
  }

  function completed() {
    return record?.status === 'completed' || appointment?.status === 'completed';
  }

  function renderShell() {
    const root = document.getElementById('examRoot');
    const done = completed();

    root.innerHTML = `
      <div class="exam-header-bar">
        <div class="patient-chip">
          <span class="av">${DoctorApp.getInitials(appointment?.patient_name || record?.patient_name)}</span>
          <div>
            <strong>${DoctorApp.escapeHtml(appointment?.patient_name || record?.patient_name || '')}</strong><br>
            <span style="font-size:0.8rem;color:var(--text-secondary)">${DoctorApp.escapeHtml(appointment?.patient_phone || record?.patient_phone || '')}</span>
          </div>
        </div>
        <div style="text-align:right">
          <p style="font-size:0.85rem;color:var(--text-muted)">${DoctorApp.formatDateTime(appointment?.appointment_date || record?.appointment_date, appointment?.time_slot || record?.time_slot)}</p>
          ${appointment ? DoctorApp.statusBadge(appointment.status) : ''}
          ${locked ? `<button type="button" class="btn btn-primary" id="btnAccept" style="margin-top:10px"><i data-lucide="user-check"></i> Tiếp nhận bệnh nhân</button>` : ''}
        </div>
      </div>

      ${locked ? `<div class="alert alert-info"><i data-lucide="info"></i> Tiếp nhận bệnh nhân để bắt đầu quy trình khám.</div>` : ''}
      ${done ? `<div class="alert alert-success"><i data-lucide="check-circle"></i> Ca khám đã hoàn thành — chỉ xem hồ sơ.</div>` : ''}

      <div class="exam-workflow" id="workflowSteps"></div>
      <div id="workflowPanels"></div>

      ${!done && record && !locked ? `
        <div class="exam-workflow-nav">
          <button type="button" class="btn btn-outline" id="btnPrevStep"><i data-lucide="chevron-left"></i> Quay lại</button>
          <button type="button" class="btn btn-primary" id="btnNextStep">Tiếp theo <i data-lucide="chevron-right"></i></button>
        </div>
        <div style="margin-top:20px;text-align:right">
          <button type="button" class="btn btn-primary btn-lg" id="btnFinish"><i data-lucide="check-circle"></i> Kết thúc ca khám</button>
        </div>` : ''}`;

    renderWorkflowSteps();
    renderPanels();
    renderTopKpis();
    bindShellEvents();
    DoctorApp.refreshIcons();
  }

  function renderTopKpis() {
    const progressEl = document.getElementById('kpiProgress');
    const statusEl = document.getElementById('kpiCaseStatus');
    const amountEl = document.getElementById('kpiAmount');
    if (progressEl) progressEl.textContent = `${currentStep + 1}/${STEPS.length} - ${STEPS[currentStep]?.label || ''}`;
    if (statusEl) {
      if (completed()) statusEl.textContent = 'Hoàn thành';
      else if (locked) statusEl.textContent = 'Chờ tiếp nhận';
      else statusEl.textContent = 'Đang xử lý';
    }
    if (amountEl) amountEl.textContent = DoctorApp.formatMoney(record?.total_amount || 0);
  }

  function renderWorkflowSteps() {
    const el = document.getElementById('workflowSteps');
    el.innerHTML = STEPS.map((s, i) => `
      <button type="button" class="workflow-step ${i === currentStep ? 'active' : ''} ${i < currentStep ? 'done' : ''}" data-step="${i}" ${locked ? 'disabled' : ''}>
        <span class="workflow-step-num">${i + 1}</span>
        <i data-lucide="${s.icon}"></i>
        <span>${s.label}</span>
      </button>`).join('');
    el.querySelectorAll('.workflow-step').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (locked) return;
        goStep(Number(btn.dataset.step));
      });
    });
  }

  function renderPanels() {
    const wrap = document.getElementById('workflowPanels');
    const dis = completed() ? 'disabled' : '';
    const p = appointment || record || {};
    const histHtml = patientHistory.length
      ? patientHistory.map((h) => `
        <div class="history-mini">
          <strong>${DoctorApp.formatDateTime(h.appointment_date, h.time_slot)}</strong>
          <p>${DoctorApp.escapeHtml(h.diagnosis || 'Chưa có chẩn đoán')}</p>
          <span class="badge badge-muted">${DoctorApp.escapeHtml(h.doctor_name || '')}</span>
        </div>`).join('')
      : '<p class="form-hint">Chưa có tiền sử khám tại bệnh viện.</p>';

    wrap.innerHTML = `
      <div class="exam-panel-wf ${currentStep === 0 ? 'active' : ''}" data-panel="0">
        <div class="card"><div class="card-body">
          <h3 style="margin-bottom:16px"><i data-lucide="user"></i> Thông tin bệnh nhân</h3>
          <div class="info-grid">
            <div><span>Mã NB</span><strong>${patientCode(p.patient_id || record?.patient_id)}</strong></div>
            <div><span>Đối tượng</span><strong>${DoctorApp.escapeHtml(subjectLabel(appointment?.service_type))}</strong></div>
            <div><span>Họ tên</span><strong>${DoctorApp.escapeHtml(p.patient_name || record?.patient_name || '—')}</strong></div>
            <div><span>SĐT</span><strong>${DoctorApp.escapeHtml(p.patient_phone || record?.patient_phone || '—')}</strong></div>
            <div><span>Tuổi</span><strong>${calcAge(p.patient_dob || record?.patient_dob)}</strong></div>
            <div><span>Giới tính</span><strong>${p.patient_gender === 'female' ? 'Nữ' : p.patient_gender === 'male' ? 'Nam' : '—'}</strong></div>
            <div class="span-2"><span>Địa chỉ</span><strong>${DoctorApp.escapeHtml(p.patient_address || record?.patient_address || '—')}</strong></div>
            <div class="span-2"><span>Lý do khám</span><strong>${DoctorApp.escapeHtml(appointment?.reason || record?.reason || '—')}</strong></div>
            <div><span>Loại dịch vụ</span><strong>${DoctorApp.escapeHtml(appointment?.service_type || '—')}</strong></div>
            <div><span>Phí khám</span><strong>${DoctorApp.formatMoney(appointment?.consultation_fee || record?.consultation_fee)}</strong></div>
          </div>
          <h4 style="margin:24px 0 12px">Tiền sử khám (gần đây)</h4>
          <div class="history-scroll">${histHtml}</div>
        </div></div>
      </div>

      <div class="exam-panel-wf ${currentStep === 1 ? 'active' : ''}" data-panel="1">
        <div class="card"><div class="card-body">
          <p class="form-hint" style="margin-bottom:14px">Ghi nhận triệu chứng và sinh hiệu trước khi chỉ định xét nghiệm.</p>
          <div class="form-group"><label class="form-label">Triệu chứng lâm sàng *</label>
            <textarea id="symptoms" class="form-textarea" rows="4" ${dis}>${DoctorApp.escapeHtml(record?.symptoms || '')}</textarea></div>
          <div class="vitals-grid">
            <div class="vital-input"><label>Huyết áp</label><input id="blood_pressure" class="form-input" placeholder="120/80" value="${DoctorApp.escapeHtml(record?.blood_pressure || '')}" ${dis} /></div>
            <div class="vital-input"><label>Nhịp tim</label><input id="heart_rate" type="number" class="form-input" value="${record?.heart_rate || ''}" ${dis} /></div>
            <div class="vital-input"><label>Nhiệt độ (°C)</label><input id="temperature" type="number" step="0.1" class="form-input" value="${record?.temperature || ''}" ${dis} /></div>
            <div class="vital-input"><label>Cân nặng (kg)</label><input id="weight" type="number" class="form-input" value="${record?.weight || ''}" ${dis} /></div>
            <div class="vital-input"><label>Chiều cao (cm)</label><input id="height" type="number" class="form-input" value="${record?.height || ''}" ${dis} /></div>
          </div>
          ${!completed() && !locked ? `<button type="button" class="btn btn-primary" id="btnSaveIntake"><i data-lucide="save"></i> Lưu thông tin khám ban đầu</button>` : ''}
        </div></div>
      </div>

      <div class="exam-panel-wf ${currentStep === 2 ? 'active' : ''}" data-panel="2">
        <div class="card"><div class="card-body">
          <p class="form-hint">Chọn xét nghiệm cần làm → hệ thống in <strong>phiếu hướng dẫn</strong> cho bệnh nhân, sau đó sang bước kết quả.</p>
          <div class="lab-check-grid" id="labCheckGrid"></div>
          ${!completed() && !locked ? `
            <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:16px">
              <button type="button" class="btn btn-primary" id="btnOrderLab"><i data-lucide="file-output"></i> Chỉ định &amp; in phiếu HD</button>
              <button type="button" class="btn btn-outline" id="btnReprintSlip" style="display:none"><i data-lucide="printer"></i> Xem lại phiếu HD</button>
            </div>` : ''}
        </div></div>
      </div>

      <div class="exam-panel-wf ${currentStep === 3 ? 'active' : ''}" data-panel="3">
        <div class="card"><div class="card-body">
          <p class="form-hint">Nhận kết quả từ phòng XN (demo tự điền mẫu) hoặc upload ảnh / nhập văn bản từng chỉ định.</p>
          ${!completed() && !locked ? `
            <button type="button" class="btn btn-outline btn-sm" id="btnDemoLab" style="margin-bottom:14px"><i data-lucide="sparkles"></i> Lấy kết quả demo từ phòng XN</button>` : ''}
          <div id="labResultsList"></div>
          <div id="aiInsightPanel" class="ai-insight-panel" hidden></div>
        </div></div>
      </div>

      <div class="exam-panel-wf ${currentStep === 4 ? 'active' : ''}" data-panel="4">
        <div class="card"><div class="card-body">
          <p class="form-hint">Chẩn đoán sau khi có triệu chứng và kết quả cận lâm sàng (nếu có).</p>
          <div class="form-group"><label class="form-label">Chẩn đoán chính *</label>
            <input type="text" id="diagnosis" class="form-input" value="${DoctorApp.escapeHtml(record?.diagnosis || '')}" ${dis} /></div>
          <div class="form-group"><label class="form-label">Ghi chú / mô tả chẩn đoán</label>
            <textarea id="diagnosis_note" class="form-textarea" rows="3" ${dis}>${DoctorApp.escapeHtml(record?.diagnosis_note || '')}</textarea></div>
          <div class="form-group"><label class="form-label">Lời khuyên / hướng dẫn sau khám</label>
            <textarea id="follow_up_note" class="form-textarea" rows="2" placeholder="Tái khám, chế độ ăn uống..." ${dis}>${DoctorApp.escapeHtml(record?.follow_up_date ? '' : '')}</textarea></div>
          ${!completed() && !locked ? `
            <button type="button" class="btn btn-ghost btn-sm" id="btnSuggest" style="margin-right:8px"><i data-lucide="sparkles"></i> Gợi ý thuốc theo chẩn đoán</button>
            <button type="button" class="btn btn-primary" id="btnSaveDiagnosis"><i data-lucide="save"></i> Lưu chẩn đoán</button>` : ''}
        </div></div>
      </div>

      <div class="exam-panel-wf ${currentStep === 5 ? 'active' : ''}" data-panel="5">
        <div class="card"><div class="card-body">
          <div class="rx-picker-layout">
            <div class="rx-picker-side">
              <h4 style="margin-bottom:10px">Tìm &amp; chọn thuốc</h4>
              <input type="search" id="drugSearch" class="form-input" placeholder="Lọc theo tên thuốc..." ${dis} />
              <div id="drugCatalogList" class="drug-catalog-list"></div>
            </div>
            <div class="rx-picker-main">
              <div class="rx-suggest-head">
                <h4>Gợi ý theo chẩn đoán</h4>
                <button type="button" class="btn btn-ghost btn-sm" id="btnRxSuggest" ${dis}><i data-lucide="sparkles"></i> Tải gợi ý</button>
              </div>
              <div id="drugSuggestBox" class="drug-suggest-box"></div>
              <div class="form-group"><label class="form-label">Lời dặn trên đơn</label>
                <textarea id="rxNote" class="form-textarea" rows="2" ${dis}></textarea></div>
              <h4 style="margin:12px 0 8px">Thuốc đã chọn</h4>
              <div id="rxItems"></div>
              ${!completed() && !locked ? `
                <button type="button" class="btn btn-ghost btn-sm" id="btnAddDrug"><i data-lucide="plus"></i> Thêm dòng thuốc</button>
                <button type="button" class="btn btn-primary" id="btnSaveRx" style="margin-top:16px"><i data-lucide="save"></i> Lưu đơn thuốc</button>` : ''}
              <div id="rxSummary" style="margin-top:16px"></div>
            </div>
          </div>
          <div id="feeSummary" class="fee-summary" style="margin-top:16px"></div>
        </div></div>
      </div>`;

    if (record?.id) {
      loadLabOrderPanel();
      loadLabResultsPanel();
      loadRxFromRecord();
      renderFeeSummary();
    } else if (!locked) {
      loadDrugs().then(() => { renderDrugCatalog(); addDrugRow(); });
    }
    bindRxSearchOnce();
    bindLabReportModal();
    DoctorApp.refreshIcons();
  }

  function bindShellEvents() {
    document.getElementById('btnAccept')?.addEventListener('click', acceptPatient);
    document.getElementById('btnPrevStep')?.addEventListener('click', () => goStep(currentStep - 1));
    document.getElementById('btnNextStep')?.addEventListener('click', onNextStep);
    document.getElementById('btnFinish')?.addEventListener('click', finishCase);
    document.getElementById('btnSaveIntake')?.addEventListener('click', () => saveMedical(false));
    document.getElementById('btnSaveDiagnosis')?.addEventListener('click', () => saveMedical(true));
    document.getElementById('btnOrderLab')?.addEventListener('click', orderLab);
    document.getElementById('btnReprintSlip')?.addEventListener('click', () => {
      if (lastInstructionSlip) showInstructionSlip(lastInstructionSlip, false);
    });
    document.getElementById('btnDemoLab')?.addEventListener('click', demoLab);
    document.getElementById('btnAddDrug')?.addEventListener('click', () => addDrugRow());
    document.getElementById('btnSaveRx')?.addEventListener('click', saveRx);
    document.getElementById('btnSuggest')?.addEventListener('click', suggestDrugs);
    document.getElementById('btnRxSuggest')?.addEventListener('click', suggestDrugsForRx);
  }

  function goStep(n) {
    if (locked || n < 0 || n >= STEPS.length) return;
    currentStep = n;
    renderWorkflowSteps();
    document.querySelectorAll('.exam-panel-wf').forEach((p) => {
      p.classList.toggle('active', Number(p.dataset.panel) === currentStep);
    });
    renderTopKpis();
    DoctorApp.refreshIcons();
  }

  async function onNextStep() {
    if (currentStep === 1) {
      const sym = document.getElementById('symptoms')?.value?.trim();
      if (!sym) return DoctorApp.toast('Vui lòng nhập triệu chứng trước khi sang bước xét nghiệm', 'error');
      try {
        await saveMedical(false);
      } catch { return; }
    }
    if (currentStep === 4) {
      const dx = document.getElementById('diagnosis')?.value?.trim();
      if (!dx) return DoctorApp.toast('Vui lòng nhập chẩn đoán trước khi kê đơn', 'error');
      try {
        await saveMedical(true);
        await loadDrugs();
        renderDrugCatalog();
      } catch { return; }
    }
    goStep(currentStep + 1);
  }

  async function acceptPatient() {
    const btn = document.getElementById('btnAccept');
    btn.disabled = true;
    try {
      const data = await DoctorApp.fetch(`/examinations/appointments/${appointment.id}/accept`, { method: 'PATCH' });
      appointment = data.appointment;
      record = data.health_record;
      locked = false;
      currentStep = 0;
      DoctorApp.toast('Đã tiếp nhận — bắt đầu khám', 'success');
      const pid = record?.patient_id || appointment?.patient_id;
      if (pid) {
        const hist = await DoctorApp.fetch(`/examinations/patients/${pid}/history?limit=8`);
        patientHistory = hist.data || [];
      }
      renderShell();
    } catch (err) {
      DoctorApp.toast(err.message, 'error');
      btn.disabled = false;
    }
  }

  async function saveMedical(withDiagnosis) {
    if (!record?.id) throw new Error('Chưa có hồ sơ khám');
    const body = {
      symptoms: document.getElementById('symptoms')?.value,
      blood_pressure: document.getElementById('blood_pressure')?.value,
      heart_rate: document.getElementById('heart_rate')?.value || null,
      temperature: document.getElementById('temperature')?.value || null,
      weight: document.getElementById('weight')?.value || null,
      height: document.getElementById('height')?.value || null
    };
    if (withDiagnosis) {
      body.diagnosis = document.getElementById('diagnosis')?.value;
      body.diagnosis_note = document.getElementById('diagnosis_note')?.value;
      const advice = document.getElementById('follow_up_note')?.value?.trim();
      if (advice) body.diagnosis_note = [body.diagnosis_note, advice].filter(Boolean).join('\n\nLời khuyên: ');
    }
    const data = await DoctorApp.fetch(`/examinations/records/${record.id}`, { method: 'PUT', body });
    record = data.health_record;
    DoctorApp.toast(withDiagnosis ? 'Đã lưu chẩn đoán' : 'Đã lưu thông tin khám ban đầu', 'success');
    return record;
  }

  async function loadLabOrderPanel() {
    try {
      const data = await DoctorApp.fetch(`/examinations/records/${record.id}/lab-tests`);
      labTests = data.available_tests || [];
      const grid = document.getElementById('labCheckGrid');
      if (grid) {
        grid.innerHTML = labTests.length ? labTests.map((t) => `
          <label class="lab-check-item">
            <input type="checkbox" value="${t.id}" />
            <span><strong>${DoctorApp.escapeHtml(t.name)}</strong><br><span style="font-size:0.75rem;color:var(--text-muted)">${DoctorApp.formatMoney(t.price)}</span></span>
          </label>`).join('') : '<p class="form-hint">Đã chỉ định hết hoặc chưa có danh mục XN.</p>';
      }
      const reprint = document.getElementById('btnReprintSlip');
      if (reprint) reprint.style.display = lastInstructionSlip ? '' : 'none';
      await reloadRecord();
      renderFeeSummary();
    } catch (err) {
      DoctorApp.toast(err.message, 'error');
    }
  }

  async function loadLabResultsPanel() {
    try {
      const data = await DoctorApp.fetch(`/examinations/records/${record.id}/lab-tests`);
      renderLabResults(data.lab_results || []);
    } catch (err) {
      DoctorApp.toast(err.message, 'error');
    }
  }

  function labStatusBadge(st) {
    const label = DoctorApp.LAB_STATUS[st] || st;
    const cls = st === 'completed' ? 'badge-success' : 'badge-warning';
    return `<span class="badge ${cls}">${DoctorApp.escapeHtml(label)}</span>`;
  }

  function renderLabResults(list) {
    const el = document.getElementById('labResultsList');
    if (!el) return;
    if (!list.length) {
      el.innerHTML = '<p class="form-hint">Chưa có xét nghiệm nào được chỉ định.</p>';
      return;
    }
    const done = completed();
    el.innerHTML = `<h4 style="margin-bottom:12px">Danh sách xét nghiệm</h4>${list.map((l) => `
      <div class="lab-result-card" data-lab-id="${l.id}">
        <div class="lab-result-head">
          <div>
            <strong>${DoctorApp.escapeHtml(l.test_name)}</strong>
            <span style="margin-left:8px">${labStatusBadge(l.status)}</span>
            <p style="font-size:0.8rem;color:var(--text-muted);margin-top:4px">${DoctorApp.formatMoney(l.fee)}</p>
          </div>
        </div>
        ${l.result_text ? `<p class="lab-result-text">${DoctorApp.escapeHtml(l.result_text)}</p>` : ''}
        ${l.result_image ? `<img src="${DoctorApp.escapeHtml(l.result_image)}" alt="" class="lab-result-img" />` : ''}
        <div style="margin-top:8px">
          <button type="button" class="btn btn-ghost btn-sm btn-open-lab-report" data-lab-id="${l.id}"><i data-lucide="file-text"></i> Phiếu kết quả xét nghiệm</button>
        </div>
        ${!done && l.status !== 'completed' ? `
          <div class="lab-upload-row">
            <input type="text" class="form-input lab-text-input" placeholder="Nhập kết quả văn bản..." />
            <input type="file" class="form-input lab-file-input" accept="image/*" />
            <button type="button" class="btn btn-outline btn-sm btn-upload-lab" data-id="${l.id}"><i data-lucide="upload"></i> Upload</button>
          </div>` : ''}
      </div>`).join('')}`;

    el.querySelectorAll('.btn-upload-lab').forEach((btn) => {
      btn.addEventListener('click', () => uploadLab(btn.dataset.id, btn.closest('.lab-result-card')));
    });
    el.querySelectorAll('.btn-open-lab-report').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = list.find((x) => String(x.id) === String(btn.dataset.labId));
        if (target) showLabReportModal(target);
      });
    });
    DoctorApp.refreshIcons();
  }

  function classifyLabForm(testCode = '', testName = '') {
    const code = String(testCode || '').toUpperCase();
    const name = String(testName || '').toLowerCase();
    if (code === 'XN002' || name.includes('nước tiểu')) return 'urine';
    if (code === 'XN003' || name.includes('siêu âm')) return 'ultrasound';
    if (code === 'XN005' || name.includes('điện tim') || name.includes('ecg')) return 'ecg';
    return 'blood';
  }

  function buildLabRowsByType(type, lab) {
    const text = lab.result_text || '';
    if (type === 'urine') {
      return [
        ['Màu sắc', 'Vàng nhạt', 'Vàng nhạt', '', ''],
        ['Tỉ trọng', '1.018', '1.005 - 1.030', '', ''],
        ['pH', '6.0', '5.0 - 8.0', '', ''],
        ['Protein', text.includes('Protein') ? 'Dương tính nhẹ' : 'Âm tính', 'Âm tính', '', text.includes('Protein') ? 'H' : ''],
        ['Glucose', 'Âm tính', 'Âm tính', '', ''],
        ['Bạch cầu niệu', text.includes('bạch cầu') ? 'Dương tính' : 'Âm tính', 'Âm tính', '', text.includes('bạch cầu') ? 'H' : '']
      ];
    }
    if (type === 'ultrasound') {
      return [
        ['Gan', 'Kích thước bình thường, nhu mô đồng nhất', 'Không bất thường', '', ''],
        ['Túi mật', 'Không sỏi, thành không dày', 'Không bất thường', '', ''],
        ['Tụy', 'Hình dạng bình thường', 'Không bất thường', '', ''],
        ['Lách', 'Kích thước trong giới hạn', 'Không bất thường', '', ''],
        ['Thận', 'Hai thận không ứ nước', 'Không bất thường', '', ''],
        ['Ổ bụng', text || 'Không dịch tự do ổ bụng', 'Không bất thường', '', '']
      ];
    }
    if (type === 'ecg') {
      return [
        ['Nhịp tim', '72 lần/phút', '60 - 100', 'l/p', ''],
        ['Trục điện tim', 'Bình thường', 'Bình thường', '', ''],
        ['Sóng P', 'Không bất thường', 'Bình thường', '', ''],
        ['Khoảng PR', '0.16', '0.12 - 0.20', 's', ''],
        ['Phức bộ QRS', '0.09', '< 0.12', 's', ''],
        ['Kết luận ECG', text || 'Nhịp xoang đều, chưa ghi nhận bất thường cấp', 'Bình thường', '', '']
      ];
    }
    return [
      ['Glucose', '4.89', '3.9 - 5.6', 'mmol/L', ''],
      ['Ure', '4.51', '2.8 - 7.2', 'mmol/L', ''],
      ['Creatinin', '95', '59 - 104', 'umol/L', ''],
      ['Cholesterol', '5.52', '< 5.2', 'mmol/L', 'H'],
      ['Triglycerid', '2.08', '< 2.25', 'mmol/L', ''],
      ['Acid Uric', '614.3', '210 - 420', 'umol/L', 'H'],
      ['GOT', '40.78', '0 - 40', 'U/L', 'H'],
      ['GPT', '86.09', '0 - 40', 'U/L', 'H']
    ];
  }

  function renderLabReportHTML(lab) {
    const type = classifyLabForm(lab.test_code, lab.test_name);
    const p = appointment || record || {};
    const rows = buildLabRowsByType(type, lab);
    const rowHtml = rows.map((r, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${DoctorApp.escapeHtml(r[0])}</td>
          <td class="${r[4] === 'H' ? 'lab-abnormal' : ''}">${DoctorApp.escapeHtml(r[1])}</td>
          <td>${DoctorApp.escapeHtml(r[3])}</td>
          <td>${DoctorApp.escapeHtml(r[2])}</td>
          <td class="${r[4] === 'H' ? 'lab-abnormal' : ''}">${DoctorApp.escapeHtml(r[4])}</td>
        </tr>`).join('');
    const titleMap = {
      blood: 'PHIẾU KẾT QUẢ XÉT NGHIỆM MÁU',
      urine: 'PHIẾU KẾT QUẢ XÉT NGHIỆM NƯỚC TIỂU',
      ultrasound: 'PHIẾU KẾT QUẢ SIÊU ÂM Ổ BỤNG',
      ecg: 'PHIẾU KẾT QUẢ ĐIỆN TIM (ECG)'
    };
    return `
      <div class="lab-report-doc">
        <div class="lab-report-header">
          <div>
            <div>BỘ Y TẾ</div>
            <strong>BỆNH VIỆN ĐA KHOA TECHCARE</strong>
          </div>
          <div class="lab-report-title">${titleMap[type] || 'PHIẾU KẾT QUẢ XÉT NGHIỆM'}</div>
          <div class="lab-report-code">MS: CD-03</div>
        </div>
        <div class="lab-report-info">
          <p><strong>Họ và tên người bệnh:</strong> ${DoctorApp.escapeHtml(p.patient_name || record?.patient_name || '')}</p>
          <p><strong>Năm sinh:</strong> ${DoctorApp.escapeHtml(String(p.patient_dob || '').slice(0, 4) || '—')} (${DoctorApp.escapeHtml(String(calcAge(p.patient_dob || record?.patient_dob)))} tuổi)</p>
          <p><strong>Giới tính:</strong> ${p.patient_gender === 'female' ? 'Nữ' : 'Nam'} &nbsp;&nbsp; <strong>Mã NB:</strong> ${patientCode(p.patient_id || record?.patient_id)}</p>
          <p><strong>Khoa:</strong> ${DoctorApp.escapeHtml(record?.department_name || 'Khoa khám bệnh')} &nbsp;&nbsp; <strong>Đối tượng:</strong> ${DoctorApp.escapeHtml(subjectLabel(appointment?.service_type))}</p>
          <p><strong>Chẩn đoán:</strong> ${DoctorApp.escapeHtml(record?.diagnosis || 'Theo dõi, chưa kết luận')}</p>
          <p><strong>Loại xét nghiệm:</strong> ${DoctorApp.escapeHtml(lab.test_name || '')}</p>
        </div>
        <div class="lab-report-table-wrap">
          <table class="lab-report-table">
            <thead>
              <tr><th>STT</th><th>XÉT NGHIỆM</th><th>KẾT QUẢ</th><th>ĐƠN VỊ</th><th>BÌNH THƯỜNG</th><th>GHI CHÚ</th></tr>
            </thead>
            <tbody>${rowHtml}</tbody>
          </table>
        </div>
        <div class="lab-report-footer">
          <p><strong>Diễn giải / khuyến nghị:</strong> ${DoctorApp.escapeHtml(lab.result_text || 'Theo dõi theo chỉ định của bác sĩ điều trị.')}</p>
          <p class="lab-report-sign">Giờ duyệt: ${new Date().toLocaleTimeString('vi-VN')} ${new Date().toLocaleDateString('vi-VN')}<br/>Người ký: Bác sĩ điều trị</p>
        </div>
      </div>`;
  }

  function showLabReportModal(lab) {
    const modal = document.getElementById('labReportModal');
    const printEl = document.getElementById('labReportPrint');
    if (!modal || !printEl) return;
    printEl.innerHTML = renderLabReportHTML(lab);
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('guide-slip-open');
    DoctorApp.refreshIcons();
  }

  function hideLabReportModal() {
    const modal = document.getElementById('labReportModal');
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('guide-slip-open');
  }

  function bindLabReportModal() {
    const modal = document.getElementById('labReportModal');
    if (!modal || modal._labBound) return;
    modal._labBound = true;
    modal.addEventListener('click', (e) => {
      if (e.target === modal) hideLabReportModal();
    });
  }

  async function uploadLab(labId, card) {
    const text = card.querySelector('.lab-text-input')?.value?.trim();
    const file = card.querySelector('.lab-file-input')?.files?.[0];
    if (!text && !file) return DoctorApp.toast('Nhập kết quả hoặc chọn ảnh', 'error');
    const fd = new FormData();
    if (text) fd.append('result_text', text);
    if (file) fd.append('result_image', file);
    try {
      await DoctorApp.fetch(`/examinations/lab-results/${labId}/upload`, { method: 'PUT', body: fd });
      DoctorApp.toast('Đã cập nhật kết quả XN', 'success');
      loadLabResultsPanel();
    } catch (err) {
      DoctorApp.toast(err.message, 'error');
    }
  }

  async function orderLab() {
    const ids = [...document.querySelectorAll('#labCheckGrid input:checked')].map((c) => Number(c.value));
    if (!ids.length) return DoctorApp.toast('Chọn ít nhất một xét nghiệm', 'error');
    try {
      const data = await DoctorApp.fetch(`/examinations/records/${record.id}/lab-tests`, { method: 'POST', body: { test_ids: ids } });
      lastInstructionSlip = data.instruction_slip;
      DoctorApp.toast('Đã chỉ định xét nghiệm — in phiếu hướng dẫn', 'success');
      const reprint = document.getElementById('btnReprintSlip');
      if (reprint) reprint.style.display = '';
      if (data.instruction_slip) showInstructionSlip(data.instruction_slip, true);
      await loadLabOrderPanel();
      await loadLabResultsPanel();
    } catch (err) {
      DoctorApp.toast(err.message, 'error');
    }
  }

  function renderAiInsightPanel() {
    const panel = document.getElementById('aiInsightPanel');
    if (!panel) return;
    if (!lastAiInsight) {
      panel.hidden = true;
      panel.innerHTML = '';
      return;
    }
    const level = lastAiInsight.risk_level || 'low';
    const levelLabel = level === 'high' ? 'Cao' : (level === 'medium' ? 'Trung bình' : 'Thấp');
    const warnings = (lastAiInsight.warnings || []).map((w) =>
      `<li><i data-lucide="alert-triangle"></i> ${DoctorApp.escapeHtml(w)}</li>`
    ).join('');
    const meta = lastAiInsight.model_meta;
    panel.hidden = false;
    panel.className = `ai-insight-panel ai-level-${level}`;
    panel.innerHTML = `
      <div class="ai-insight-head">
        <h4><i data-lucide="brain"></i> Nhận xét AI (heart.csv)</h4>
        <span class="ai-risk-badge">Nguy cơ: ${DoctorApp.escapeHtml(levelLabel)} (${Math.round((lastAiInsight.risk_score || 0) * 100)}%)</span>
      </div>
      <p class="ai-insight-comment">${DoctorApp.escapeHtml(lastAiInsight.comment || '')}</p>
      ${warnings ? `<ul class="ai-insight-warnings">${warnings}</ul>` : ''}
      ${meta ? `<p class="ai-insight-meta">Mô hình: ${DoctorApp.escapeHtml(meta.model || '—')} · ${meta.samples || '—'} mẫu · độ chính xác demo ${meta.accuracy != null ? Math.round(meta.accuracy * 100) + '%' : '—'}</p>` : ''}`;
    DoctorApp.refreshIcons();
  }

  async function applyDemoLabResults(opts = {}) {
    const { silent = false, reloadFees = true } = opts;
    const btn = document.getElementById('btnDemoLab');
    if (btn && !silent) { btn.disabled = true; btn.textContent = 'Đang lấy kết quả...'; }
    try {
      const data = await DoctorApp.fetch(`/examinations/records/${record.id}/lab-tests/demo`, { method: 'POST' });
      lastAiInsight = data.ai_insight || null;
      renderAiInsightPanel();
      if (!silent) {
        DoctorApp.toast(
          data.demo_results_filled
            ? `Đã nhận ${data.demo_results_filled} kết quả mẫu`
            : 'Không còn XN chờ kết quả',
          data.demo_results_filled ? 'success' : 'info'
        );
      }
      await loadLabResultsPanel();
      if (reloadFees) {
        await reloadRecord();
        renderFeeSummary();
      }
      return data;
    } catch (err) {
      if (!silent) DoctorApp.toast(err.message, 'error');
      throw err;
    } finally {
      if (btn && !silent) {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="sparkles"></i> Lấy kết quả demo từ phòng XN';
        DoctorApp.refreshIcons();
      }
    }
  }

  async function demoLab() {
    await applyDemoLabResults();
  }

  function renderGuideSlipHtml(slip) {
    if (!slip) return '';
    const svcRows = (slip.services || []).map((s) => `
      <tr>
        <td class="gs-tc">${s.stt}</td>
        <td>${DoctorApp.escapeHtml(s.name)}</td>
        <td class="gs-loc"><strong>${DoctorApp.escapeHtml(s.location)}</strong></td>
      </tr>`).join('');
    return `
      <div class="guide-slip-doc">
        <div class="gs-header">
          <div class="gs-header-left">
            <div>${DoctorApp.escapeHtml(slip.ministry_line || 'BỘ Y TẾ')}</div>
            <div><strong>${DoctorApp.escapeHtml(slip.hospital_name || 'CƠ SỞ Y TẾ')}</strong></div>
          </div>
          <div class="gs-barcode-box">
            <div class="gs-barcode-label">Mã Hồ sơ</div>
            <div class="gs-barcode">${'█'.repeat(28)}</div>
            <div class="gs-record-code">${DoctorApp.escapeHtml(slip.record_code)}</div>
          </div>
          <div class="gs-header-right">Mã NB: <strong>${DoctorApp.escapeHtml(slip.patient_code)}</strong></div>
        </div>
        <h1 class="gs-title">PHIẾU HƯỚNG DẪN</h1>
        <div class="gs-meta-row">
          <span>Ngày đăng ký: ${DoctorApp.escapeHtml(slip.registration_date)}</span>
          <span class="gs-stt">STT: <strong>${DoctorApp.escapeHtml(String(slip.queue_number))}</strong></span>
        </div>
        <div class="gs-patient">
          <p><span>Họ và tên:</span> <strong class="gs-name">${DoctorApp.escapeHtml(slip.patient_name)}</strong></p>
          <p><span>Đối tượng:</span> ${DoctorApp.escapeHtml(slip.subject)} &nbsp;|&nbsp;
             <span>Tuổi:</span> ${DoctorApp.escapeHtml(String(slip.age ?? '—'))} &nbsp;|&nbsp;
             <span>Giới tính:</span> ${DoctorApp.escapeHtml(slip.gender)}</p>
          <p><span>Địa chỉ:</span> ${DoctorApp.escapeHtml(slip.address)}</p>
        </div>
        <table class="gs-table">
          <thead><tr><th>STT</th><th>Tên dịch vụ</th><th>Nơi khám</th></tr></thead>
          <tbody>${svcRows}</tbody>
        </table>
        <div class="gs-login">
          <p><span>Tên đăng nhập:</span> <strong>${DoctorApp.escapeHtml(slip.login_username)}</strong></p>
          <p><span>Mật khẩu:</span> <strong>${DoctorApp.escapeHtml(slip.login_password)}</strong></p>
          <p class="gs-login-hint">Dùng để tra cứu kết quả trực tuyến (demo)</p>
        </div>
      </div>`;
  }

  function showInstructionSlip(slip, autoNav) {
    const modal = document.getElementById('guideSlipModal');
    const printEl = document.getElementById('guideSlipPrint');
    if (!modal || !printEl) return;
    printEl.innerHTML = renderGuideSlipHtml(slip);
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('guide-slip-open');
    modal._autoNav = autoNav;
    DoctorApp.refreshIcons();
  }

  function hideInstructionSlip(goResults) {
    const modal = document.getElementById('guideSlipModal');
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('guide-slip-open');
    if (goResults) goStep(3);
  }

  let slipModalBound = false;
  function bindSlipModal() {
    if (slipModalBound) return;
    slipModalBound = true;
    document.addEventListener('click', async (e) => {
      const t = e.target;
      if (t.id === 'btnPrintSlip' || t.closest?.('#btnPrintSlip')) window.print();
      if (t.id === 'btnCloseSlip' || t.closest?.('#btnCloseSlip') || t.classList?.contains('guide-slip-backdrop')) {
        hideInstructionSlip(false);
      }
      if (t.id === 'btnCloseLabReport' || t.closest?.('#btnCloseLabReport') || t.id === 'btnCloseLabReportFooter') {
        hideLabReportModal();
      }
      if (t.id === 'btnPrintLabReport' || t.closest?.('#btnPrintLabReport')) {
        window.print();
      }
      if (t.id === 'btnSlipContinue' || t.closest?.('#btnSlipContinue')) {
        hideInstructionSlip(true);
        if (!record?.id) return;
        try {
          const data = await applyDemoLabResults({ silent: true, reloadFees: false });
          if (data?.demo_results_filled) {
            DoctorApp.toast(`Đã nhận ${data.demo_results_filled} kết quả mẫu`, 'success');
          }
        } catch { /* optional */ }
      }
    });
  }

  async function loadDrugs() {
    if (drugs.length) return drugs;
    const data = await DoctorApp.fetch('/drugs?limit=300');
    drugs = data.data || [];
    return drugs;
  }

  let rxSearchBound = false;
  function bindRxSearchOnce() {
    if (rxSearchBound) return;
    rxSearchBound = true;
    document.addEventListener('input', (e) => {
      if (e.target.id === 'drugSearch') renderDrugCatalog(e.target.value.trim());
    });
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.drug-catalog-item');
      if (!btn || !btn.dataset.drugId) return;
      addDrugRow({
        drug_id: Number(btn.dataset.drugId),
        unit_price: btn.dataset.price,
        quantity: 1,
        drug_name: btn.dataset.name
      });
      DoctorApp.toast(`Đã thêm ${btn.dataset.name}`, 'success');
    });
  }

  function renderDrugCatalog(filter = '') {
    const el = document.getElementById('drugCatalogList');
    if (!el) return;
    const q = filter.toLowerCase();
    const list = drugs.filter((d) => {
      if (!q) return true;
      const hay = `${d.name} ${d.description || ''} ${d.unit || ''}`.toLowerCase();
      return hay.includes(q);
    }).slice(0, 40);
    if (!list.length) {
      el.innerHTML = '<p class="form-hint">Không tìm thấy thuốc. Thử từ khóa khác.</p>';
      return;
    }
    el.innerHTML = list.map((d) => `
      <button type="button" class="drug-catalog-item" data-drug-id="${d.id}" data-price="${d.unit_price}" data-name="${DoctorApp.escapeHtml(d.name)}">
        <strong>${DoctorApp.escapeHtml(d.name)}</strong>
        <span>${DoctorApp.formatMoney(d.unit_price)} · Tồn ${d.stock}</span>
      </button>`).join('');
  }

  function addDrugRow(prefill = {}) {
    const wrap = document.getElementById('rxItems');
    const row = document.createElement('div');
    row.className = 'drug-row';
    const label = prefill.drug_name ? DoctorApp.escapeHtml(prefill.drug_name) : '—';
    row.innerHTML = `
      <div class="form-group drug-row-name" style="margin:0">
        <input type="hidden" class="drug-id-hidden" value="${prefill.drug_id || ''}" />
        <span class="drug-row-label">${label}</span>
        <select class="form-select drug-select" style="margin-top:4px"><option value="">Đổi thuốc...</option></select>
      </div>
      <div class="form-group" style="margin:0"><input type="number" class="form-input rx-qty" min="1" value="${prefill.quantity || 1}" placeholder="SL" /></div>
      <div class="form-group" style="margin:0"><input type="number" class="form-input rx-price" value="${prefill.unit_price || ''}" placeholder="Đơn giá" /></div>
      <div class="form-group" style="margin:0"><input type="text" class="form-input rx-dosage" value="${DoctorApp.escapeHtml(prefill.dosage || '')}" placeholder="Liều / HD" /></div>
      <button type="button" class="btn btn-ghost btn-sm rx-remove"><i data-lucide="trash-2"></i></button>`;
    wrap.appendChild(row);
    row.querySelector('.rx-remove').addEventListener('click', () => row.remove());
    loadDrugs().then((list) => {
      const sel = row.querySelector('.drug-select');
      const hidden = row.querySelector('.drug-id-hidden');
      const nameEl = row.querySelector('.drug-row-label');
      sel.innerHTML = '<option value="">Đổi thuốc...</option>' + list.map((d) =>
        `<option value="${d.id}" data-price="${d.unit_price}" data-name="${DoctorApp.escapeHtml(d.name)}">${DoctorApp.escapeHtml(d.name)} (tồn: ${d.stock})</option>`
      ).join('');
      if (prefill.drug_id) {
        sel.value = prefill.drug_id;
        hidden.value = prefill.drug_id;
        row.querySelector('.rx-price').value = prefill.unit_price || sel.selectedOptions[0]?.dataset.price || '';
        if (!prefill.drug_name && sel.selectedOptions[0]) {
          nameEl.textContent = sel.selectedOptions[0].dataset.name || sel.selectedOptions[0].textContent;
        }
      }
      sel.addEventListener('change', () => {
        const opt = sel.selectedOptions[0];
        if (!opt?.value) return;
        hidden.value = opt.value;
        nameEl.textContent = opt.dataset.name || opt.textContent;
        if (opt.dataset.price) row.querySelector('.rx-price').value = opt.dataset.price;
      });
    });
    DoctorApp.refreshIcons();
  }

  async function loadRxFromRecord() {
    await reloadRecord();
    const detail = await DoctorApp.fetch(`/records/${record.id}`);
    const rx = detail.prescription;
    const noteEl = document.getElementById('rxNote');
    if (noteEl && rx?.note) noteEl.value = rx.note;

    await loadDrugs();
    renderDrugCatalog();
    if (!rx?.items?.length) {
      if (!completed()) addDrugRow();
      return;
    }
    document.getElementById('rxItems').innerHTML = '';
    const list = drugs;
    for (const item of rx.items) {
      const drug = list.find((d) => d.name === item.drug_name || d.id === item.drug_id);
      addDrugRow({
        drug_id: drug?.id,
        drug_name: drug?.name || item.drug_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        dosage: item.dosage || item.instruction
      });
    }
    document.getElementById('rxSummary').innerHTML = `<p><strong>Tổng đơn thuốc:</strong> ${DoctorApp.formatMoney(rx.total_price)}</p>`;
  }

  function renderFeeSummary() {
    const el = document.getElementById('feeSummary');
    if (!el || !record) return;
    el.innerHTML = `
      <h4>Tổng chi phí ca khám</h4>
      <ul class="fee-lines">
        <li><span>Phí khám</span><strong>${DoctorApp.formatMoney(record.consultation_fee)}</strong></li>
        <li><span>Xét nghiệm</span><strong>${DoctorApp.formatMoney(record.total_lab_fee)}</strong></li>
        <li><span>Thuốc</span><strong>${DoctorApp.formatMoney(record.total_drug_fee)}</strong></li>
        <li class="total"><span>Tổng cộng</span><strong>${DoctorApp.formatMoney(record.total_amount)}</strong></li>
      </ul>`;
  }

  async function saveRx() {
    const rows = document.querySelectorAll('#rxItems .drug-row');
    const items = [];
    for (const row of rows) {
      const drugId = row.querySelector('.drug-id-hidden')?.value || row.querySelector('.drug-select')?.value;
      if (!drugId) continue;
      items.push({
        drug_id: Number(drugId),
        quantity: Number(row.querySelector('.rx-qty').value),
        unit_price: Number(row.querySelector('.rx-price').value),
        dosage: row.querySelector('.rx-dosage').value,
        instruction: row.querySelector('.rx-dosage').value
      });
    }
    if (!items.length) return DoctorApp.toast('Thêm ít nhất một thuốc', 'error');
    const note = document.getElementById('rxNote')?.value?.trim() || '';
    try {
      const data = await DoctorApp.fetch(`/examinations/records/${record.id}/prescription`, {
        method: 'POST',
        body: { note, items }
      });
      await reloadRecord();
      renderFeeSummary();
      document.getElementById('rxSummary').innerHTML = `<p><strong>Tổng đơn:</strong> ${DoctorApp.formatMoney(data.totals?.total_amount || data.prescription?.total_price)}</p>`;
      DoctorApp.toast('Đã lưu đơn thuốc', 'success');
    } catch (err) {
      DoctorApp.toast(err.message, 'error');
    }
  }

  async function fetchDrugSuggestions() {
    const name = document.getElementById('diagnosis')?.value?.trim();
    if (!name || name.length < 2) {
      DoctorApp.toast('Nhập chẩn đoán (bước 5) để gợi ý thuốc', 'error');
      return null;
    }
    return DoctorApp.fetch(`/examinations/drug-suggestions?disease_name=${encodeURIComponent(name)}`);
  }

  function renderSuggestBox(data, targetId = 'drugSuggestBox') {
    const box = document.getElementById(targetId);
    if (!box) return;
    if (!data?.drugs?.length) {
      box.innerHTML = '<p class="form-hint">Không có gợi ý trong danh mục bệnh–thuốc. Dùng ô tìm bên trái.</p>';
      return;
    }
    box.innerHTML = data.drugs.map((d) => `
      <button type="button" class="drug-suggest-chip" data-pick="${d.id}" data-price="${d.unit_price}" data-name="${DoctorApp.escapeHtml(d.name)}">
        <strong>${DoctorApp.escapeHtml(d.name)}</strong>
        <span>${DoctorApp.formatMoney(d.unit_price)}</span>
      </button>`).join('');
    box.querySelectorAll('[data-pick]').forEach((btn) => {
      btn.addEventListener('click', () => {
        addDrugRow({
          drug_id: Number(btn.dataset.pick),
          unit_price: btn.dataset.price,
          drug_name: btn.dataset.name,
          quantity: 1
        });
      });
    });
  }

  async function suggestDrugs() {
    try {
      const data = await fetchDrugSuggestions();
      if (!data) return;
      renderSuggestBox(data, 'drugSuggestBox');
      goStep(5);
    } catch (err) {
      DoctorApp.toast(err.message, 'error');
    }
  }

  async function suggestDrugsForRx() {
    try {
      const data = await fetchDrugSuggestions();
      if (!data) return;
      renderSuggestBox(data, 'drugSuggestBox');
      DoctorApp.toast(data.drugs?.length ? 'Chạm thuốc gợi ý để thêm vào đơn' : 'Không có gợi ý', 'info');
    } catch (err) {
      DoctorApp.toast(err.message, 'error');
    }
  }

  async function finishCase() {
    if (!confirm('Kết thúc ca khám? Đảm bảo đã lưu triệu chứng, chẩn đoán và đơn thuốc (nếu cần).')) return;
    try {
      await saveMedical(true);
      const data = await DoctorApp.fetch(`/examinations/records/${record.id}/finish`, { method: 'PATCH' });
      record = data.health_record;
      appointment = { ...appointment, status: 'completed' };
      DoctorApp.toast('Ca khám đã hoàn thành', 'success');
      setTimeout(() => { window.location.href = DoctorApp.ROUTES.dashboard; }, 1000);
    } catch (err) {
      DoctorApp.toast(err.message, 'error');
    }
  }
})();
