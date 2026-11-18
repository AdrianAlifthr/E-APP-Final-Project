/* ===== U10 · Pesanan Saya ===== */
let user, orders = [], filter = 'all';
const FILTERS = [['all', 'Semua'], ['pending', 'Pending'], ['paid', 'Paid'], ['expired', 'Expired'], ['cancelled', 'Cancelled']];

const jam = ms => new Date(ms).toLocaleTimeString('id-ID', {hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta'}).replace(':', '.') + ' WIB';

const isAwaitingVerification = o => o.status === 'pending' && o.payment && o.expires_in_ms > 86400000;

function actionsFor(o){
  const detail = `<a class="btn btn-outline" data-route="U11" data-param="id" data-id="${esc(o.order_id)}">Detail Pesanan</a>`;
  if (o.status === 'paid')
    return `<a class="btn btn-primary" data-route="U9" data-param="order" data-id="${esc(o.order_id)}">Lihat E-Ticket →</a>${detail}`;
  if (isAwaitingVerification(o))
    return detail;
  if (o.status === 'pending')
    return `<button class="btn btn-primary" data-resume="${esc(o.order_id)}">Lanjutkan Bayar →</button>${detail}`;
  return `<a class="btn btn-primary" data-route="U4">Pesan Ulang →</a>${detail}`;
}

function renderTabs(){
  document.getElementById('tabs').innerHTML = FILTERS.map(([k, label]) =>
    `<button class="tab ${k === filter ? 'active' : ''}" role="tab" aria-selected="${k === filter}" data-f="${k}">${label}</button>`).join('');
}

function renderList(){
  const list = orders.filter(o => filter === 'all' || o.status === filter);
  const box = document.getElementById('order-list');
  if (!list.length){
    box.innerHTML = `<div class="card empty">
      <h2 class="sec-title">${filter === 'all' ? 'BELUM ADA PESANAN' : 'TIDAK ADA PESANAN ' + filter.toUpperCase()}</h2>
      <p class="muted" style="font-size:14px">${filter === 'all' ? 'Yuk amankan tiket konser The Weeknd sebelum kehabisan.' : 'Coba pilih filter lain.'}</p>
      ${filter === 'all' ? '<a class="btn btn-primary" data-route="U4">Beli Tiket →</a>' : ''}</div>`;
  } else {
    box.innerHTML = list.map(o => {
      const badgeLabel = isAwaitingVerification(o) ? 'Menunggu Verifikasi' : o.status;
      return `
      <article class="card order-card">
        <div class="order-top"><span>#${esc(o.order_code)}</span><span class="order-status st-${esc(o.status)}">${esc(badgeLabel)}</span></div>
        <h2 class="order-title">THE WEEKND / AFTER HOURS TIL DAWN</h2>
        <div class="order-mid">
          <div class="detail"><p>${esc(o.items.map(i => `${i.quantity} × ${i.name}`).join(', '))}</p>
            <p>${tanggal(o.created_at_ms)} · ${jam(o.created_at_ms)}</p></div>
          <p class="amount">${rupiah(o.total)}</p>
        </div>
        <div class="order-actions">${actionsFor(o)}</div>
      </article>`;
    }).join('');
  }
  hydrateLinks(box);
}

function setFilter(f){
  filter = f;
  history.replaceState(null, '', f === 'all' ? location.pathname : `?status=${f}`);
  renderTabs(); renderList();
}

async function initOrders(){
  renderLayout('U10');
  user = requireLogin(); if (!user) return;
  const res = await backend('list_orders', [user.user_id], null);
  if (!res) { document.getElementById('order-list').innerHTML = ''; return toast('Server belum aktif. Jalankan lewat python main.py.', 'error'); }
  orders = res.orders;
  const q = new URLSearchParams(location.search).get('status');
  if (FILTERS.some(([k]) => k === q)) filter = q;
  renderTabs(); renderList();

  document.getElementById('tabs').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) setFilter(b.dataset.f); });
  document.getElementById('order-list').addEventListener('click', e => {
    const b = e.target.closest('[data-resume]');
    if (!b) return;
    Store.set('twk_order', {order_id: b.dataset.resume});
    go('U6');
  });
}
document.addEventListener('DOMContentLoaded', initOrders);
