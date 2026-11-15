/* ===== Shared untuk semua halaman user ===== */
const ROUTES = {
  U1:'index.html', U2:'register.html', U3:'login.html', U4:'tickets.html',
  U5:'holders.html', U6:'checkout.html', U7:'payment.html', U8:'success.html',
  U9:'eticket.html', U10:'orders.html', U11:'order-detail.html', U12:'profile.html',
  U13:'news.html', U13d:'news-detail.html', U14:'faq.html',
  A2:'admin/dashboard.html'
};

/* Data cadangan bila Python (Eel) tidak aktif. Ganti dengan Supabase di main.py */
const FALLBACK_CATEGORIES = [
  {category_id:1, name:'VIP',      price:2500000, quota:500,  sold:180,  description:'Akses prioritas · area premium',       sale_start:'2027-04-09', sale_end:'2027-08-13'},
  {category_id:2, name:'CAT 1',    price:1500000, quota:2000, sold:1916, description:'Tribune dengan pandangan terbaik',     sale_start:'2027-04-09', sale_end:'2027-08-13'},
  {category_id:3, name:'CAT 2',    price:1000000, quota:5000, sold:3800, description:'Tribune reguler · tempat duduk',       sale_start:'2027-04-09', sale_end:'2027-08-13'},
  {category_id:4, name:'FESTIVAL', price:850000,  quota:8000, sold:8000, description:'Area berdiri dekat panggung',          sale_start:'2027-04-09', sale_end:'2027-08-13'}
];

const Auth = {
  get(){ try { return JSON.parse(localStorage.getItem('twk_user')); } catch(e){ return null; } },
  set(u){ localStorage.setItem('twk_user', JSON.stringify(u)); },
  clear(){ localStorage.removeItem('twk_user'); }
};

function esc(s){
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
const rupiah = n => 'Rp' + Number(n).toLocaleString('id-ID');
const tanggal = d => new Date(d).toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'});

function linkParams(el){
  return el.dataset.id ? {[el.dataset.param || 'id']: el.dataset.id} : {};
}
function routeUrl(route, params){
  const q = new URLSearchParams(params || {}).toString();
  return (ROUTES[route] || ROUTES.U1) + (q ? '?' + q : '');
}
function go(route, params){ window.location.href = routeUrl(route, params); }

/* Panggil fungsi Python (Eel). Jika Eel tidak ada, pakai data cadangan. */
async function backend(fn, args = [], fallback = null){
  try {
    if (window.eel && typeof eel[fn] === 'function') return await eel[fn](...args)();
  } catch (e) { console.warn('Eel error:', fn, e); }
  return typeof fallback === 'function' ? fallback() : fallback;
}

/* ----- Toast & modal ----- */
function toast(msg, type = 'success'){
  let wrap = document.querySelector('.toast-wrap');
  if (!wrap){ wrap = document.createElement('div'); wrap.className = 'toast-wrap'; document.body.appendChild(wrap); }
  const t = document.createElement('div');
  t.className = 'toast ' + (type === 'success' ? '' : type);
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}
/* actions: [{label, primary, onClick}] */
function modal({title, text, actions, persist = false}){
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal" role="dialog" aria-modal="true">
    <h3>${esc(title)}</h3><p class="muted">${esc(text)}</p><div class="modal-actions"></div></div>`;
  const box = ov.querySelector('.modal-actions');
  actions.forEach(a => {
    const b = document.createElement('button');
    b.className = 'btn ' + (a.primary ? 'btn-primary' : 'btn-outline');
    b.textContent = a.label;
    b.onclick = () => { ov.remove(); a.onClick && a.onClick(); };
    box.appendChild(b);
  });
  ov.onclick = e => { if (!persist && e.target === ov) ov.remove(); };
  document.body.appendChild(ov);
}
function confirmModal({title, text, yes = 'Ya', no = 'Batal', onYes}){
  modal({title, text, actions:[{label:no}, {label:yes, primary:true, onClick:onYes}]});
}

/* ----- Navbar & footer ----- */
function renderLayout(active){
  const user = Auth.get();
  const nav = document.getElementById('site-nav');
  if (nav){
    const link = (r, label) => `<a data-route="${r}" class="${active === r ? 'active' : ''}">${label}</a>`;
    const account = user
      ? `<a data-route="U10">Pesanan saya</a>
         <a data-route="U12" class="btn btn-outline btn-profile">Profil ↗</a>
         <a id="logout-btn" class="muted">Keluar</a>`
      : `<a data-route="U3">Masuk</a><a data-route="U2" class="btn btn-outline btn-sm">Daftar</a>`;
    nav.className = 'nav';
    nav.innerHTML = `<a class="logo" data-route="U1">THE WEEKND</a>
      <nav class="nav-menu">${link('U1','Beranda')}${link('U4','Tiket')}${link('U13','Berita')}${link('U14','FAQ')}</nav>
      <div class="nav-account">${account}</div>
      <button class="nav-toggle" aria-label="Buka menu" id="nav-toggle">&#9776;</button>`;
    document.getElementById('nav-toggle').onclick = () => nav.classList.toggle('open');
    const lo = document.getElementById('logout-btn');
    if (lo) lo.onclick = () => confirmModal({
      title: 'KELUAR DARI AKUN?', text: 'Kamu perlu masuk lagi untuk membeli tiket.', yes: 'Keluar',
      onYes: () => { Auth.clear(); sessionStorage.setItem('twk_flash', 'Berhasil keluar'); go('U1'); }
    });
  }
  const foot = document.getElementById('site-footer');
  if (foot){
    foot.className = 'footer';
    foot.innerHTML = `<div class="footer-row">
        <span class="logo">THE WEEKND</span>
        <a data-route="U14">Syarat &amp; Ketentuan</a><a data-route="U14">FAQ</a>
        <span class="muted" style="font-size:12px">panitia@afterhours.example</span></div>
      <small>PROYEK AKADEMIK · DATA KONSER &amp; TRANSAKSI SIMULASI</small>`;
  }
  hydrateLinks(document);
  const flash = sessionStorage.getItem('twk_flash');
  if (flash){ sessionStorage.removeItem('twk_flash'); toast(flash); }
}

/* Stepper pemesanan (U4–U8). active = 1..4 */
function renderStepper(active){
  const labels = ['Pilih tiket', 'Data pemegang', 'Pembayaran', 'Selesai'];
  return `<div class="steps" aria-label="Tahapan pemesanan">` + labels.map((l, i) =>
    `<div class="step ${i + 1 === active ? 'active' : ''} ${i + 1 < active ? 'done' : ''}"><span class="num">0${i + 1}</span><span class="lbl">${l}</span><span class="bar"></span></div>`
  ).join('') + `</div>`;
}

/* Semua [data-route] jadi link; [data-action="buy"] = tombol Beli Tiket */
function hydrateLinks(root){
  root.querySelectorAll('a[data-route]').forEach(el => el.setAttribute('href', routeUrl(el.dataset.route, linkParams(el))));
}
document.addEventListener('click', e => {
  const buy = e.target.closest('[data-action="buy"]');
  if (buy){
    e.preventDefault();
    if (!Auth.get()){ sessionStorage.setItem('twk_flash', 'Masuk untuk membeli tiket'); go('U3', {next: 'U4'}); }
    else go('U4');
    return;
  }
  const r = e.target.closest('[data-route]');
  if (r && r.tagName !== 'A'){ e.preventDefault(); go(r.dataset.route, linkParams(r)); }
});


/* ===== Alur pemesanan (U4–U8) ===== */
const Store = {
  get(k){ try { return JSON.parse(sessionStorage.getItem(k)); } catch(e){ return null; } },
  set(k, v){ sessionStorage.setItem(k, JSON.stringify(v)); },
  del(k){ sessionStorage.removeItem(k); }
};
function clearBooking(){ ['twk_cart', 'twk_holders', 'twk_order', 'twk_method'].forEach(k => Store.del(k)); }
function requireLogin(){
  const u = Auth.get();
  if (!u){ sessionStorage.setItem('twk_flash', 'Masuk untuk membeli tiket'); go('U3', {next: 'U4'}); return null; }
  return u;
}
const fmtMMSS = ms => {
  const t = Math.max(0, Math.ceil(ms / 1000));
  return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
};
/* Hitung mundur batas bayar. onTick(msTersisa) tiap detik, onExpire() sekali saat habis. */
function startOrderTimer(expiresMs, onTick, onExpire){
  let id = null;
  const tick = () => {
    const left = expiresMs - Date.now();
    onTick(Math.max(0, left));
    if (left <= 0){ clearInterval(id); onExpire(); }
  };
  id = setInterval(tick, 1000);
  tick();
  return id;
}
function showExpiredModal(){
  modal({
    title: 'WAKTU PEMBAYARAN HABIS',
    text: 'Pesananmu otomatis dibatalkan dan kuota dikembalikan. Silakan pesan ulang.',
    persist: true,
    actions: [{label: 'Pesan Ulang', primary: true, onClick: () => { clearBooking(); go('U4'); }}]
  });
}
const PAY_GROUPS = [
  {title: 'TRANSFER BANK', items: [['bca', 'BCA Virtual Account'], ['mandiri', 'Mandiri Virtual Account'], ['bni', 'BNI Virtual Account']]},
  {title: 'E-WALLET',      items: [['gopay', 'GoPay'], ['ovo', 'OVO'], ['dana', 'DANA']]},
  {title: 'KARTU KREDIT',  items: [['card', 'Visa / Mastercard']]}
];
/* Kartu ringkasan pesanan (U5–U7). action/extra = HTML tombol */
function renderSummaryCard({lines, discount = 0, voucher = '', total, action = '', extra = ''}){
  const rows = lines.map(l => `<div class="sum-row"><span>${esc(l.label)}</span><span class="v">${rupiah(l.amount)}</span></div>`).join('');
  const disc = discount > 0
    ? `<div class="sum-row"><span>Voucher ${esc(voucher)}</span><span class="v ok">−${rupiah(discount)}</span></div>` : '';
  return `<aside class="card summary summary-static" aria-label="Ringkasan pesanan">
    <h2>RINGKASAN PESANAN</h2>
    <div><p>THE WEEKND</p><p>After Hours Til Dawn · Jakarta</p></div>
    <p class="sum-note">14 Agustus 2027 · GBK, Jakarta</p>
    <hr>${rows}${disc}
    <div class="sum-row"><span>Biaya layanan</span><span class="v">Termasuk</span></div>
    <hr>
    <div><p class="muted" style="font-size:11px">TOTAL PEMBAYARAN</p><p class="sum-total">${rupiah(total)}</p></div>
    ${action}
    <p class="sum-note">Maks. 4 tiket per akun. Harga termasuk pajak dan biaya layanan.</p>
    ${extra}
  </aside>`;
}
const orderLines = o => o.items.map(i => ({label: `${i.name} × ${i.quantity}`, amount: i.subtotal}));
