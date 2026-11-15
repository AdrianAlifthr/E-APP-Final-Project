/* ===== U11 · Detail Pesanan ===== */
const ST = {
  paid: ['PAID / PEMBAYARAN BERHASIL', 'st-paid'],
  pending: ['PENDING / MENUNGGU PEMBAYARAN', 'st-pending'],
  expired: ['EXPIRED / WAKTU PEMBAYARAN HABIS', 'st-expired'],
  cancelled: ['CANCELLED / PESANAN DIBATALKAN', 'st-cancelled'],
  refunded: ['REFUNDED / DANA DIKEMBALIKAN', 'st-refunded']
};
const wib = ms => new Date(ms).toLocaleTimeString('id-ID', {hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta'}).replace(':', '.');
const tglPendek = ms => new Date(ms).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'});

function primaryAction(o){
  if (o.status === 'paid') return `<a class="btn btn-primary btn-block" data-route="U9" data-param="order" data-id="${esc(o.order_id)}">Lihat E-Ticket →</a>`;
  if (o.status === 'pending') return `<button class="btn btn-primary btn-block" id="resume-btn">Lanjutkan Bayar →</button>`;
  return `<a class="btn btn-primary btn-block" data-route="U4">Pesan Ulang →</a>`;
}

async function initDetail(){
  renderLayout('U10');
  const user = requireLogin(); if (!user) return;
  const id = new URLSearchParams(location.search).get('id');
  if (!id) return go('U10');
  const res = await backend('get_order', [id, user.user_id], null);
  if (!res) return toast('Server belum aktif. Jalankan lewat python main.py.', 'error');
  if (!res.ok){ sessionStorage.setItem('twk_flash', 'Pesanan tidak ditemukan.'); return go('U10'); }
  const o = res.order, [stText, stCls] = ST[o.status] || [o.status.toUpperCase(), ''];

  document.getElementById('o-code').textContent = 'PESANAN #' + o.order_code;
  document.getElementById('o-created').textContent = `Dibuat ${tanggal(o.created_at_ms)} · ${wib(o.created_at_ms)} WIB`;

  const rows = o.items.map(i => `<div class="kv"><span>${esc(i.name)} × ${i.quantity}</span><span style="color:var(--text)">${rupiah(i.subtotal)}</span></div>`).join('');
  const voucher = o.voucher_code ? `${esc(o.voucher_code)} (−${rupiah(o.discount)})` : 'Tidak digunakan';
  const pay = o.payment || {};
  const paidAt = pay.paid_at_ms ? `${tglPendek(pay.paid_at_ms)} · ${wib(pay.paid_at_ms)}` : '—';
  const people = o.holders.map((h, i) => {
    const t = o.tickets[i];
    return `<div class="row-ticket"><p class="nm">${String(i + 1).padStart(2, '0')} / ${esc(h.holder_name)}</p>
      <p class="cd ${t && t.status === 'valid' ? 'ok' : 'muted'}">${t ? esc(t.ticket_code) + ' · ' + (t.status === 'valid' ? 'Valid' : t.status === 'used' ? 'Sudah digunakan' : 'Dibatalkan') : 'Tiket terbit setelah pembayaran'}</p></div>`;
  }).join('');

  document.getElementById('o-body').innerHTML = `
    <section class="card panel">
      <p class="status ${stCls}">${stText}</p>
      <p class="big">THE WEEKND</p>
      <p class="muted" style="font-size:14px">14 Agustus 2027 · Gelora Bung Karno, Jakarta</p>
      <hr class="hr">
      ${rows}
      <div class="kv"><span>Voucher / diskon</span><span style="color:var(--text)">${voucher}</span></div>
      <div class="kv"><span>Biaya layanan</span><span style="color:var(--text)">Termasuk</span></div>
      <div class="kv"><span>Total pembayaran</span><span style="color:var(--text)">${rupiah(o.total)}</span></div>
      <hr class="hr">
      <div class="kv"><span>Metode bayar</span><span style="color:var(--text)">${esc(pay.label || 'Belum dipilih')}</span></div>
      <div class="kv"><span>Waktu pembayaran</span><span style="color:var(--text)">${paidAt}</span></div>
      ${primaryAction(o)}
    </section>
    <section class="card panel">
      <h2>DAFTAR TIKET</h2>
      ${people}
      <a class="btn btn-outline btn-block" data-route="U10">← Kembali ke Pesanan</a>
    </section>`;
  hydrateLinks(document.getElementById('o-body'));
  const r = document.getElementById('resume-btn');
  if (r) r.onclick = () => { Store.set('twk_order', {order_id: o.order_id}); go('U6'); };
}
document.addEventListener('DOMContentLoaded', initDetail);
