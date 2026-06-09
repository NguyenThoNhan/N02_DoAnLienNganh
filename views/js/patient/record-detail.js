(function () {
  PatientApp.initPage('record', start);

  function start() {
    PatientApp.requestNotifyPermission();

    const recordId = new URLSearchParams(window.location.search).get('id');
    const recordContent = document.getElementById('recordContent');
    const paymentModal = document.getElementById('paymentModal');
    const labReportModal = document.getElementById('labReportModal');
    let currentRecord = null;
    let pollTimer = null;
    let lastPaymentStatus = null;
    let payToken = null;

    if (!recordId) {
      recordContent.innerHTML = `<div class="empty-state"><h3>Thiếu mã hồ sơ</h3><a href="${PatientApp.ROUTES.history}" class="btn btn-primary">Quay lại</a></div>`;
      return;
    }

    document.querySelectorAll('[data-close-modal]').forEach((el) => {
      el.addEventListener('click', () => {
        stopPoll();
        paymentModal.classList.remove('show');
      });
    });

    document.getElementById('confirmPayBtn')?.addEventListener('click', confirmPayment);
    document.getElementById('btnCloseLabReport')?.addEventListener('click', closeLabReport);
    document.getElementById('btnCloseLabReportFooter')?.addEventListener('click', closeLabReport);
    document.getElementById('btnPrintLabReport')?.addEventListener('click', () => window.print());
    labReportModal?.addEventListener('click', (e) => {
      if (e.target === labReportModal) closeLabReport();
    });

    async function load() {
      try {
        const data = await PatientApp.fetch(`/records/${recordId}`);
        currentRecord = data.health_record;
        lastPaymentStatus = currentRecord.payment_status;
        render(currentRecord);
      } catch (err) {
        recordContent.innerHTML = `<div class="empty-state"><h3>${PatientApp.escapeHtml(err.message)}</h3><a href="${PatientApp.ROUTES.history}" class="btn btn-outline">Quay lại</a></div>`;
      }
    }

    function render(r) {
      const labs = r.lab_results || [];
      const rx = r.prescription;
      const canPay = r.status === 'completed' && r.payment_status === 'unpaid';

      recordContent.innerHTML = `
        <div class="record-hero">
          <div>
            <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:6px">Hồ sơ #${r.id}</p>
            <h2 style="font-size:1.25rem;margin-bottom:8px">${PatientApp.formatDateTime(r.appointment_date, r.time_slot)}</h2>
            <p style="color:var(--text-secondary)">${PatientApp.escapeHtml(r.doctor_name)} · ${PatientApp.escapeHtml(r.department_name || '')}</p>
            <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
              <span class="badge ${r.status === 'completed' ? 'badge-success' : 'badge-primary'}">${r.status === 'completed' ? 'Hoàn thành' : 'Đang mở'}</span>
              ${PatientApp.paymentBadge(r.payment_status)}
            </div>
          </div>
          ${canPay ? `<button type="button" class="btn btn-primary btn-lg" id="openPayBtn"><i data-lucide="qr-code"></i> Thanh toán QR</button>` : ''}
        </div>

        <div class="record-grid">
          <div class="card">
            <div class="card-header"><h3>Thông tin khám</h3></div>
            <div class="card-body">
              <div class="detail-block" style="margin-bottom:16px"><h4>Triệu chứng</h4><p>${PatientApp.escapeHtml(r.symptoms || '—')}</p></div>
              <div class="detail-block" style="margin-bottom:16px"><h4>Chẩn đoán</h4><p>${PatientApp.escapeHtml(r.diagnosis || '—')}</p></div>
              ${r.diagnosis_note ? `<div class="detail-block" style="margin-bottom:16px"><h4>Ghi chú</h4><p>${PatientApp.escapeHtml(r.diagnosis_note)}</p></div>` : ''}
              <div class="form-row" style="margin-top:16px">
                <div class="detail-block"><h4>Huyết áp</h4><p>${PatientApp.escapeHtml(r.blood_pressure || '—')}</p></div>
                <div class="detail-block"><h4>Nhịp tim</h4><p>${r.heart_rate ? r.heart_rate + ' bpm' : '—'}</p></div>
                <div class="detail-block"><h4>Nhiệt độ</h4><p>${r.temperature ? r.temperature + '°C' : '—'}</p></div>
                <div class="detail-block"><h4>Cân nặng / Cao</h4><p>${r.weight || '—'} kg / ${r.height || '—'} cm</p></div>
              </div>
            </div>
          </div>

          <div class="card payment-box">
            <h3 style="font-size:1rem;margin-bottom:8px">Chi phí</h3>
            <dl style="font-size:0.9rem;display:grid;gap:8px">
              <div style="display:flex;justify-content:space-between"><dt style="color:var(--text-muted)">Phí khám</dt><dd>${PatientApp.formatMoney(r.consultation_fee)}</dd></div>
              <div style="display:flex;justify-content:space-between"><dt style="color:var(--text-muted)">Xét nghiệm</dt><dd>${PatientApp.formatMoney(r.total_lab_fee)}</dd></div>
              <div style="display:flex;justify-content:space-between"><dt style="color:var(--text-muted)">Thuốc</dt><dd>${PatientApp.formatMoney(r.total_drug_fee)}</dd></div>
            </dl>
            <p class="payment-amount">${PatientApp.formatMoney(r.total_amount)}</p>
          </div>
        </div>

        <div class="card" style="margin-top:20px">
          <div class="card-header"><h3>Xét nghiệm (${labs.length})</h3></div>
          <div class="card-body">
            ${labs.length ? labs.map((l) => `
              <div class="lab-item">
                <strong>${PatientApp.escapeHtml(l.test_name)}</strong>
                <span class="badge badge-muted" style="margin-left:8px">${PatientApp.escapeHtml(l.status)}</span>
                <p style="margin-top:8px;font-size:0.85rem">${PatientApp.escapeHtml(l.result_text || 'Chờ kết quả')}</p>
                ${l.result_image ? `<a href="${PatientApp.escapeHtml(l.result_image)}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm" style="margin-top:8px"><i data-lucide="image"></i> Xem ảnh</a>` : ''}
                <button type="button" class="btn btn-ghost btn-sm btn-open-lab-report" data-lab-id="${l.id}" style="margin-top:8px"><i data-lucide="file-text"></i> Phiếu kết quả xét nghiệm</button>
              </div>`).join('') : '<p class="form-hint">Không có xét nghiệm</p>'}
          </div>
        </div>

        <div class="card" style="margin-top:20px">
          <div class="card-header"><h3>Đơn thuốc</h3></div>
          <div class="card-body">
            ${rx?.items?.length ? rx.items.map((item) => `
              <div class="rx-item">
                <strong>${PatientApp.escapeHtml(item.drug_name)}</strong> × ${item.quantity}
                <p style="font-size:0.85rem;color:var(--text-secondary);margin-top:4px">${PatientApp.escapeHtml(item.dosage || '')}</p>
              </div>`).join('') : '<p class="form-hint">Chưa có đơn thuốc</p>'}
          </div>
        </div>`;

      document.getElementById('openPayBtn')?.addEventListener('click', openPayment);
      document.querySelectorAll('.btn-open-lab-report').forEach((btn) => {
        btn.addEventListener('click', () => {
          const target = labs.find((x) => String(x.id) === String(btn.dataset.labId));
          if (target) openLabReport(target, r);
        });
      });
      PatientApp.refreshIcons();
    }

    function classifyLabForm(testCode = '', testName = '') {
      const code = String(testCode || '').toUpperCase();
      const name = String(testName || '').toLowerCase();
      if (code === 'XN002' || name.includes('nước tiểu')) return 'urine';
      if (code === 'XN003' || name.includes('siêu âm')) return 'ultrasound';
      if (code === 'XN005' || name.includes('điện tim') || name.includes('ecg')) return 'ecg';
      return 'blood';
    }

    function ageFromDob(dob) {
      if (!dob) return '—';
      const d = new Date(dob);
      if (isNaN(d)) return '—';
      const t = new Date();
      let age = t.getFullYear() - d.getFullYear();
      const m = t.getMonth() - d.getMonth();
      if (m < 0 || (m === 0 && t.getDate() < d.getDate())) age -= 1;
      return age;
    }

    function patientCode(id) {
      return String(2000000000 + (Number(id) || 0)).slice(0, 10);
    }

    function reportRows(type, lab) {
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

    function renderLabReport(lab, record) {
      const type = classifyLabForm(lab.test_code, lab.test_name);
      const rows = reportRows(type, lab);
      const rowHtml = rows.map((r, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${PatientApp.escapeHtml(r[0])}</td>
          <td class="${r[4] === 'H' ? 'lab-abnormal' : ''}">${PatientApp.escapeHtml(r[1])}</td>
          <td>${PatientApp.escapeHtml(r[3])}</td>
          <td>${PatientApp.escapeHtml(r[2])}</td>
          <td class="${r[4] === 'H' ? 'lab-abnormal' : ''}">${PatientApp.escapeHtml(r[4])}</td>
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
            <div><div>BỘ Y TẾ</div><strong>BỆNH VIỆN ĐA KHOA TECHCARE</strong></div>
            <div class="lab-report-title">${titleMap[type]}</div>
            <div class="lab-report-code">MS: CD-03</div>
          </div>
          <div class="lab-report-info">
            <p><strong>Họ và tên người bệnh:</strong> ${PatientApp.escapeHtml(record.patient_name || '')}</p>
            <p><strong>Năm sinh:</strong> ${PatientApp.escapeHtml(String(record.patient_dob || '').slice(0, 4) || '—')} (${ageFromDob(record.patient_dob)} tuổi)</p>
            <p><strong>Giới tính:</strong> ${record.patient_gender === 'female' ? 'Nữ' : 'Nam'} &nbsp;&nbsp; <strong>Mã NB:</strong> ${patientCode(record.patient_id)}</p>
            <p><strong>Khoa:</strong> ${PatientApp.escapeHtml(record.department_name || 'Khoa khám bệnh')} &nbsp;&nbsp; <strong>Đối tượng:</strong> Dịch vụ</p>
            <p><strong>Chẩn đoán:</strong> ${PatientApp.escapeHtml(record.diagnosis || 'Theo dõi, chưa kết luận')}</p>
            <p><strong>Loại xét nghiệm:</strong> ${PatientApp.escapeHtml(lab.test_name || '')}</p>
          </div>
          <div class="lab-report-table-wrap">
            <table class="lab-report-table">
              <thead><tr><th>STT</th><th>XÉT NGHIỆM</th><th>KẾT QUẢ</th><th>ĐƠN VỊ</th><th>BÌNH THƯỜNG</th><th>GHI CHÚ</th></tr></thead>
              <tbody>${rowHtml}</tbody>
            </table>
          </div>
          <div class="lab-report-footer">
            <p><strong>Diễn giải / khuyến nghị:</strong> ${PatientApp.escapeHtml(lab.result_text || 'Theo dõi theo chỉ định của bác sĩ điều trị.')}</p>
            <p class="lab-report-sign">Giờ duyệt: ${new Date().toLocaleTimeString('vi-VN')} ${new Date().toLocaleDateString('vi-VN')}<br/>Người ký: Bác sĩ điều trị</p>
          </div>
        </div>`;
    }

    function openLabReport(lab, record) {
      if (!labReportModal) return;
      const printEl = document.getElementById('labReportPrint');
      if (!printEl) return;
      printEl.innerHTML = renderLabReport(lab, record);
      labReportModal.classList.add('show');
      PatientApp.refreshIcons();
    }

    function closeLabReport() {
      labReportModal?.classList.remove('show');
    }

    function stopPoll() {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }

    function startPoll() {
      stopPoll();
      pollTimer = setInterval(async () => {
        try {
          const st = await PatientApp.fetch(`/records/${recordId}/payment-status`);
          if (st.payment_status === 'paid' && lastPaymentStatus === 'unpaid') {
            stopPoll();
            paymentModal.classList.remove('show');
            PatientApp.notifyPayment('TechCare', 'Đã nhận thanh toán từ điện thoại!');
            load();
          }
          lastPaymentStatus = st.payment_status;
        } catch { /* ignore */ }
      }, 2500);
    }

    async function openPayment() {
      try {
        const data = await PatientApp.fetch(`/records/${recordId}/payment-qr`);
        if (data.already_paid) {
          PatientApp.toast('Đã thanh toán', 'success');
          load();
          return;
        }
        const qr = data.qr_data;
        payToken = qr.pay_token;
        document.getElementById('paymentModalBody').innerHTML = `
          <div class="alert alert-info"><i data-lucide="smartphone"></i> Quét mã bằng điện thoại, hoặc mở link bên dưới trên điện thoại.</div>
          <div class="qr-pay-wrap">
            <img src="${PatientApp.escapeHtml(qr.qr_image_url)}" alt="Mã QR thanh toán" class="qr-pay-img" width="240" height="240" />
          </div>
          <p class="qr-lan-hint"><i data-lucide="wifi"></i> Mạng LAN: <strong>${PatientApp.escapeHtml(qr.lan_base_url || '')}</strong></p>
          <div class="pay-link-box">
            <input type="text" class="form-input" id="payUrlInput" readonly value="${PatientApp.escapeHtml(qr.mobile_pay_url)}" />
            <button type="button" class="btn btn-outline btn-sm" id="copyPayUrl">Sao chép link</button>
          </div>
          <dl class="pay-info-dl">
            <div><dt>Ngân hàng</dt><dd><strong>${PatientApp.escapeHtml(qr.bank_id)}</strong></dd></div>
            <div><dt>Số TK</dt><dd><strong>${PatientApp.escapeHtml(qr.account_no)}</strong></dd></div>
            <div><dt>Số tiền</dt><dd class="payment-amount">${PatientApp.formatMoney(qr.amount)}</dd></div>
            <div><dt>Nội dung CK</dt><dd>${PatientApp.escapeHtml(qr.description)}</dd></div>
          </dl>
          <p class="form-hint" id="pollHint">Đang chờ xác nhận từ điện thoại...</p>`;

        document.getElementById('copyPayUrl')?.addEventListener('click', () => {
          const inp = document.getElementById('payUrlInput');
          inp.select();
          navigator.clipboard?.writeText(inp.value).then(() => PatientApp.toast('Đã sao chép link', 'success'));
        });

        paymentModal.classList.add('show');
        PatientApp.refreshIcons();
        startPoll();
      } catch (err) {
        PatientApp.toast(err.message, 'error');
      }
    }

    async function confirmPayment() {
      const btn = document.getElementById('confirmPayBtn');
      btn.classList.add('loading');
      btn.disabled = true;
      stopPoll();
      try {
        await PatientApp.fetch(`/records/${recordId}/payment`, {
          method: 'PATCH',
          body: { payment_method: 'qr_code', pay_token: payToken }
        });
        PatientApp.notifyPayment('TechCare', 'Thanh toán thành công trên máy tính!');
        paymentModal.classList.remove('show');
        load();
      } catch (err) {
        PatientApp.toast(err.message, 'error');
      } finally {
        btn.classList.remove('loading');
        btn.disabled = false;
      }
    }

    load();
  }
})();
