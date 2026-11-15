/* ===== U12 · Profil ===== */
let user;
const PHONE_OK = /^(\+62|62|0)8\d{7,12}$/;
const ferr = (id, msg) => {
  const f = document.getElementById('f-' + id);
  if (!f) return;
  f.classList.toggle('error', !!msg);
  f.querySelector('.help').textContent = msg || '';
};
const val = id => document.getElementById(id).value;
const loading = (btn, on) => { btn.classList.toggle('is-loading', on); btn.disabled = on; };

function fmtPhone(p){ const d = String(p).replace(/\D/g, ''); return d.replace(/(\d{4})(?=\d)/g, '$1 ').trim(); }

function setTab(tab){
  document.getElementById('pcols').dataset.tab = tab;
  document.querySelectorAll('#ptabs .tab').forEach(b => {
    const on = b.dataset.tab === tab;
    b.classList.toggle('active', on); b.setAttribute('aria-selected', on);
  });
  const card = document.getElementById(tab === 'data' ? 'card-data' : 'card-sec');
  if (matchMedia('(min-width:901px)').matches) card.scrollIntoView({behavior: 'smooth', block: 'center'});
}

async function onSaveProfile(e){
  e.preventDefault();
  const name = val('full_name').trim(), phone = val('phone').replace(/\s/g, '');
  ferr('full_name', name.length >= 3 ? null : 'Nama lengkap minimal 3 karakter');
  ferr('phone', PHONE_OK.test(phone) ? null : 'Nomor HP tidak valid (contoh 08123456789)');
  if (name.length < 3 || !PHONE_OK.test(phone)) return;
  const btn = document.getElementById('save-btn'); loading(btn, true);
  const res = await backend('update_profile', [user.user_id, {full_name: name, phone}], null);
  loading(btn, false);
  if (!res) return toast('Server belum aktif.', 'error');
  if (!res.ok){ if (res.field) ferr(res.field, res.message); else toast(res.message, 'error'); return; }
  user = {...user, ...res.user}; Auth.set(user);
  document.getElementById('phone').value = fmtPhone(res.user.phone);
  toast('Perubahan disimpan.');
}

async function onChangePassword(e){
  e.preventDefault();
  const o = val('old'), n = val('new'), c = val('confirm');
  ferr('old', o ? null : 'Password lama wajib diisi');
  ferr('new', n.length >= 8 ? (n !== o ? null : 'Password baru harus berbeda') : 'Password baru minimal 8 karakter');
  ferr('confirm', c === n && c ? null : 'Konfirmasi password tidak sama');
  if (!o || n.length < 8 || n === o || c !== n) return;
  const btn = document.getElementById('pw-btn'); loading(btn, true);
  const res = await backend('change_password', [user.user_id, o, n], null);
  loading(btn, false);
  if (!res) return toast('Server belum aktif.', 'error');
  if (!res.ok){ ferr(res.field || 'old', res.message); return; }
  ['old', 'new', 'confirm'].forEach(id => { document.getElementById(id).value = ''; });
  toast('Password berhasil diganti.');
}

async function initProfile(){
  renderLayout('U12');
  user = requireLogin(); if (!user) return;
  const res = await backend('get_profile', [user.user_id], null);
  const u = res && res.ok ? res.user : user;
  document.getElementById('full_name').value = u.full_name;
  document.getElementById('email').value = u.email;
  document.getElementById('phone').value = fmtPhone(u.phone);
  if (!res) toast('Server belum aktif. Data ditampilkan dari sesi login.', 'warn');

  document.getElementById('ptabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab); });
  document.getElementById('card-data').addEventListener('submit', onSaveProfile);
  document.getElementById('card-sec').addEventListener('submit', onChangePassword);
  ['full_name', 'phone', 'old', 'new', 'confirm'].forEach(id => document.getElementById(id).addEventListener('input', () => ferr(id, null)));
}
document.addEventListener('DOMContentLoaded', initProfile);
