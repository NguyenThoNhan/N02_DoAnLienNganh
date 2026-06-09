const API = '/api';
const $ = id => document.getElementById(id);

// ── Elements
const form            = $('registerForm');
const fullNameInput   = $('full_name');
const phoneInput      = $('phone');
const passwordInput   = $('password');
const confirmPwInput  = $('confirmPassword');
const termsCheckbox   = $('terms');
const registerBtn     = $('registerBtn');
const alertError      = $('alertError');
const alertErrorTxt   = $('alertErrorText');
const alertSuccess    = $('alertSuccess');
const alertSuccessTxt = $('alertSuccessText');

// ── Toggle password visibility
function setupToggle(btnId, inputId, eyeId, eyeOffId) {
  $(btnId).addEventListener('click', () => {
    const input  = $(inputId);
    const hidden = input.type === 'password';
    input.type   = hidden ? 'text' : 'password';
    $(eyeId).style.display    = hidden ? 'none' : '';
    $(eyeOffId).style.display = hidden ? '' : 'none';
  });
}
setupToggle('togglePw1', 'password', 'eye1', 'eyeOff1');
setupToggle('togglePw2', 'confirmPassword', 'eye2', 'eyeOff2');

// ── Phone format
phoneInput.addEventListener('input', () => {
  phoneInput.value = phoneInput.value.replace(/\D/g, '').slice(0, 11);
  clearFieldError('phone');
});

// ── Password strength meter
passwordInput.addEventListener('input', () => {
  clearFieldError('password');
  const val = passwordInput.value;
  const el  = $('pwStrength');

  if (!val) { el.style.display = 'none'; return; }
  el.style.display = 'block';

  const checks = [
    val.length >= 6,
    val.length >= 8,
    /[A-Z]/.test(val),
    /[0-9]/.test(val),
    /[^A-Za-z0-9]/.test(val)
  ];
  const score = checks.filter(Boolean).length;

  const configs = [
    { w: '20%', color: '#ef4444', label: 'Rất yếu' },
    { w: '40%', color: '#f97316', label: 'Yếu' },
    { w: '60%', color: '#f59e0b', label: 'Trung bình' },
    { w: '80%', color: '#3b82f6', label: 'Mạnh' },
    { w: '100%',color: '#10b981', label: 'Rất mạnh' }
  ];
  const cfg = configs[Math.max(0, score - 1)];
  $('pwFill').style.width      = cfg.w;
  $('pwFill').style.background = cfg.color;
  $('pwLabel').textContent     = cfg.label;
  $('pwLabel').style.color     = cfg.color;
});

confirmPwInput.addEventListener('input', () => clearFieldError('confirmPassword'));
fullNameInput.addEventListener('input',  () => clearFieldError('full_name'));
termsCheckbox.addEventListener('change', () => clearFieldError('terms'));

// ── Ripple
registerBtn.addEventListener('mousedown', function(e) {
  const ripple = document.createElement('span');
  const rect   = this.getBoundingClientRect();
  const size   = Math.max(rect.width, rect.height);
  ripple.className = 'ripple';
  ripple.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX-rect.left-size/2}px;top:${e.clientY-rect.top-size/2}px`;
  this.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
});

// ── Validation helpers
const validators = {
  full_name: (v) => {
    if (!v.trim()) return 'Họ và tên không được để trống';
    if (v.trim().length < 2) return 'Họ và tên phải có ít nhất 2 ký tự';
    return '';
  },
  phone: (v) => {
    if (!v) return 'Số điện thoại không được để trống';
    if (!/^(0[35789][0-9]{8})$/.test(v)) return 'Số điện thoại không hợp lệ (VD: 0912345678)';
    return '';
  },
  password: (v) => {
    if (!v) return 'Mật khẩu không được để trống';
    if (v.length < 6) return 'Mật khẩu phải có ít nhất 6 ký tự';
    return '';
  },
  confirmPassword: (v, pw) => {
    if (!v) return 'Vui lòng xác nhận mật khẩu';
    if (v !== pw) return 'Mật khẩu xác nhận không khớp';
    return '';
  }
};

function showFieldError(field, msg) {
  $(field).classList.add('error');
  const errEl = $(`${field}Error`);
  errEl.querySelector('span').textContent = msg;
  errEl.classList.add('show');
}

function clearFieldError(field) {
  const el = $(field);
  if (el) el.classList.remove('error');
  const errEl = $(`${field}Error`);
  if (errEl) errEl.classList.remove('show');
}

function showAlert(type, msg) {
  if (type === 'error') {
    alertErrorTxt.textContent = msg;
    alertError.classList.add('show');
    alertSuccess.classList.remove('show');
  } else {
    alertSuccessTxt.textContent = msg;
    alertSuccess.classList.add('show');
    alertError.classList.remove('show');
  }
}

function hideAlerts() {
  alertError.classList.remove('show');
  alertSuccess.classList.remove('show');
}

function setLoading(state) {
  registerBtn.disabled = state;
  registerBtn.classList.toggle('loading', state);
}

// ── Submit
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlerts();

  const full_name       = fullNameInput.value;
  const phone           = phoneInput.value.trim();
  const password        = passwordInput.value;
  const confirmPassword = confirmPwInput.value;

  let valid = true;

  const nameErr    = validators.full_name(full_name);
  const phoneErr   = validators.phone(phone);
  const passErr    = validators.password(password);
  const confirmErr = validators.confirmPassword(confirmPassword, password);

  if (nameErr)    { showFieldError('full_name', nameErr);          valid = false; }
  if (phoneErr)   { showFieldError('phone', phoneErr);             valid = false; }
  if (passErr)    { showFieldError('password', passErr);           valid = false; }
  if (confirmErr) { showFieldError('confirmPassword', confirmErr); valid = false; }

  if (!termsCheckbox.checked) {
    const errEl = $('termsError');
    errEl.querySelector('span').textContent = 'Vui lòng đồng ý với điều khoản dịch vụ';
    errEl.classList.add('show');
    valid = false;
  }

  if (!valid) return;

  setLoading(true);
  try {
    const res  = await fetch(`${API}/auth/register`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ full_name: full_name.trim(), phone, password })
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      showAlert('error', data.message || 'Đăng ký thất bại. Vui lòng thử lại.');
      return;
    }

    // Lưu token & user
    localStorage.setItem('token', data.data.token);
    localStorage.setItem('user', JSON.stringify(data.data.user));
    localStorage.removeItem('doctor');
    localStorage.removeItem('doctor_id');

    showAlert('success', 'Đăng ký thành công! Đang chuyển hướng...');

    setTimeout(() => {
      window.location.href = '/pages/patient/dashboard.html';
    }, 1200);

  } catch (err) {
    showAlert('error', 'Không thể kết nối đến máy chủ. Vui lòng thử lại sau.');
  } finally {
    setLoading(false);
  }
});

// ── Auto redirect nếu đã đăng nhập
(function checkAuth() {
  const token = localStorage.getItem('token');
  const user  = JSON.parse(localStorage.getItem('user') || 'null');
  if (!token || !user) return;
  const map = { admin: '/pages/admin/dashboard.html', doctor: '/pages/doctor/dashboard.html', patient: '/pages/patient/dashboard.html' };
  window.location.href = map[user.role] || '/';
})();