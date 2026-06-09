const API = '/api';

const $ = id => document.getElementById(id);
const phoneInput    = $('phone');
const passwordInput = $('password');
const loginBtn      = $('loginBtn');
const alertError    = $('alertError');
const alertErrorTxt = $('alertErrorText');
const togglePw      = $('togglePw');
const eyeIcon       = $('eyeIcon');
const eyeOffIcon    = $('eyeOffIcon');

// ── Toggle password visibility
togglePw.addEventListener('click', () => {
  const isHidden = passwordInput.type === 'password';
  passwordInput.type = isHidden ? 'text' : 'password';
  eyeIcon.style.display    = isHidden ? 'none'  : '';
  eyeOffIcon.style.display = isHidden ? ''      : 'none';
});

// ── Format phone on input
phoneInput.addEventListener('input', () => {
  phoneInput.value = phoneInput.value.replace(/\D/g, '').slice(0, 11);
  clearFieldError('phone');
});

passwordInput.addEventListener('input', () => clearFieldError('password'));

// ── Ripple effect on button
loginBtn.addEventListener('mousedown', function (e) {
  const ripple = document.createElement('span');
  const rect   = this.getBoundingClientRect();
  const size   = Math.max(rect.width, rect.height);
  ripple.className = 'ripple';
  ripple.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX-rect.left-size/2}px;top:${e.clientY-rect.top-size/2}px`;
  this.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
});

// ── Validation
function validatePhone(val) {
  if (!val) return 'Số điện thoại không được để trống';
  if (!/^(0[35789][0-9]{8})$/.test(val)) return 'Số điện thoại không hợp lệ';
  return '';
}

function validatePassword(val) {
  if (!val) return 'Mật khẩu không được để trống';
  if (val.length < 6) return 'Mật khẩu phải có ít nhất 6 ký tự';
  return '';
}

function showFieldError(field, msg) {
  const input = $(field);
  const errEl = $(`${field}Error`);
  input.classList.add('error');
  errEl.querySelector('span').textContent = msg;
  errEl.classList.add('show');
}

function clearFieldError(field) {
  const input = $(field);
  const errEl = $(`${field}Error`);
  input.classList.remove('error');
  errEl.classList.remove('show');
}

function showAlert(msg) {
  alertErrorTxt.textContent = msg;
  alertError.classList.add('show');
}

function hideAlert() {
  alertError.classList.remove('show');
}

function setLoading(state) {
  loginBtn.disabled = state;
  loginBtn.classList.toggle('loading', state);
}

// ── Submit
$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert();

  const phone    = phoneInput.value.trim();
  const password = passwordInput.value;

  let valid = true;
  const phoneErr = validatePhone(phone);
  const passErr  = validatePassword(password);

  if (phoneErr)  { showFieldError('phone', phoneErr);    valid = false; }
  if (passErr)   { showFieldError('password', passErr);  valid = false; }
  if (!valid) return;

  setLoading(true);
  try {
    const res  = await fetch(`${API}/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ phone, password })
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      showAlert(data.message || 'Đăng nhập thất bại. Vui lòng thử lại.');
      return;
    }

    // Lưu token và thông tin user
    localStorage.setItem('token', data.data.token);
    localStorage.setItem('user',  JSON.stringify(data.data.user));
    if (data.data.doctor) {
      localStorage.setItem('doctor', JSON.stringify(data.data.doctor));
      localStorage.setItem('doctor_id', String(data.data.doctor.id));
    } else {
      localStorage.removeItem('doctor');
      localStorage.removeItem('doctor_id');
    }

    // Redirect theo role
    const role = data.data.user.role;
    const redirectMap = {
      admin:   '/pages/admin/dashboard.html',
      doctor:  '/pages/doctor/dashboard.html',
      patient: '/pages/patient/dashboard.html'
    };

    window.location.href = redirectMap[role] || '/';
  } catch (err) {
    showAlert('Không thể kết nối đến máy chủ. Vui lòng thử lại sau.');
  } finally {
    setLoading(false);
  }
});

// ── Auto redirect nếu đã đăng nhập
(function checkAuth() {
  const token = localStorage.getItem('token');
  const user  = JSON.parse(localStorage.getItem('user') || 'null');
  if (!token || !user) return;

  const redirectMap = {
    admin:   '/pages/admin/dashboard.html',
    doctor:  '/pages/doctor/dashboard.html',
    patient: '/pages/patient/dashboard.html'
  };
  window.location.href = redirectMap[user.role] || '/';
})();