/* ===== U2 Registrasi & U3 Login ===== */
const $ = id => document.getElementById(id);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^(\+62|62|0)8\d{7,12}$/;

function setFieldError(name, msg){
  const f = $('f-' + name);
  if (!f) return;
  const help = f.querySelector('.help');
  if (msg){
    f.classList.add('error');
    if (help) help.textContent = msg;
  } else {
    f.classList.remove('error');
    if (help) help.textContent = help.dataset.default || '';
  }
}
function showBanner(msg){ const b = $('form-banner'); b.textContent = msg; b.hidden = !msg; }
function setLoading(on){ const b = $('submit-btn'); b.classList.toggle('is-loading', on); b.disabled = on; }
function bindEyes(){
  document.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.onclick = () => { const i = $(btn.dataset.toggle); i.type = i.type === 'password' ? 'text' : 'password'; };
  });
}
function bindClearOnInput(names){
  names.forEach(n => { const el = $(n); if (el) el.addEventListener('input', () => { setFieldError(n === 'confirm' ? 'confirm' : n); showBanner(''); }); });
}
function safeNext(){
  const n = new URLSearchParams(location.search).get('next');
  return n && ROUTES[n] ? n : 'U1';
}

/* ----- U2 ----- */
function initRegister(){
  renderLayout('U2');
  if (Auth.get()) return go('U1');
  bindEyes();
  bindClearOnInput(['full_name', 'email', 'phone', 'password', 'confirm']);

  $('register-form').addEventListener('submit', async e => {
    e.preventDefault();
    showBanner('');
    const v = { full_name: $('full_name').value.trim(), email: $('email').value.trim().toLowerCase(),
                phone: $('phone').value.trim(), password: $('password').value };
    const confirm = $('confirm').value;
    let ok = true;
    const check = (name, cond, msg) => { setFieldError(name, cond ? null : msg); if (!cond) ok = false; };
    check('full_name', v.full_name.length >= 3, 'Nama lengkap minimal 3 karakter');
    check('email', EMAIL_RE.test(v.email), 'Format email tidak valid');
    check('phone', PHONE_RE.test(v.phone), 'Nomor HP tidak valid (contoh 08123456789)');
    check('password', v.password.length >= 8, 'Password minimal 8 karakter');
    check('confirm', confirm === v.password && confirm.length > 0, 'Konfirmasi password tidak sama');
    $('f-terms').classList.toggle('error', !$('terms').checked);
    if (!$('terms').checked) ok = false;
    if (!ok) return;

    setLoading(true);
    const res = await backend('register_user', [v], null);
    setLoading(false);
    if (!res){ showBanner('Server belum aktif. Jalankan aplikasi lewat python main.py.'); return; }
    if (!res.ok){
      if (res.field) setFieldError(res.field, res.message); else showBanner(res.message);
      return;
    }
    sessionStorage.setItem('twk_flash', 'Akun berhasil dibuat. Silakan masuk.');
    go('U3', {next: 'U4'});
  });
}

/* ----- U3 ----- */
function initLogin(){
  renderLayout('U3');
  if (Auth.get()) return go(safeNext());
  bindEyes();
  bindClearOnInput(['email', 'password']);

  $('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    showBanner('');
    const email = $('email').value.trim().toLowerCase();
    const password = $('password').value;
    let ok = true;
    setFieldError('email', EMAIL_RE.test(email) ? null : 'Format email tidak valid');
    if (!EMAIL_RE.test(email)) ok = false;
    setFieldError('password', password ? null : 'Password wajib diisi');
    if (!password) ok = false;
    if (!ok) return;

    setLoading(true);
    const res = await backend('login_user', [email, password], null);
    setLoading(false);
    if (!res){ showBanner('Server belum aktif. Jalankan aplikasi lewat python main.py.'); return; }
    if (!res.ok){ showBanner(res.message); return; }
    Auth.set(res.user);
    go(res.user.role === 'admin' ? 'A2' : safeNext());
  });
}
