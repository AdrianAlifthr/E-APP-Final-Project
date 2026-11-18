/* ===== U8 · Konfirmasi Pembayaran & Menunggu Verifikasi ===== */
async function initSuccess(){
  renderLayout('U4');
  const user = requireLogin(); if (!user) return;
  const saved = Store.get('twk_order');
  if (!saved) return go('U10');
  const res = await backend('get_order', [saved.order_id, user.user_id], null);
  if (!res) return toast('Server belum aktif. Jalankan lewat python main.py.', 'error');
  if (!res.ok) return go('U10');
  const o = res.order;

  // Jika belum ada pembayaran sama sekali, kembalikan ke checkout
  if (o.status !== 'paid' && !(o.status === 'pending' && o.payment)) return go('U6');

  const isVerified = o.status === 'paid';
  const items = o.items.map(i => `${i.quantity} × ${i.name}`).join(', ');

  const titleTxt = isVerified ? 'PEMBAYARAN BERHASIL.' : 'PEMBAYARAN DITERIMA.';
  const descHtml = isVerified
    ? `<p>Malam terbaikmu sudah menunggu.</p><p>E-ticket tersedia di akunmu dan telah dikirim ke <strong>${esc(user.email)}</strong>.</p>`
    : `<p>Bukti pembayaranmu sedang diverifikasi oleh panitia.</p><p>Setelah disetujui, e-ticket akan otomatis dikirim ke <strong>${esc(user.email)}</strong> dan muncul di menu Pesanan Saya.</p>`;
  const primaryBtn = isVerified
    ? `<a class="btn btn-primary btn-block" data-route="U9" data-param="order" data-id="${esc(o.order_id)}">Lihat E-Ticket →</a>`
    : `<a class="btn btn-primary btn-block" data-route="U11" data-param="id" data-id="${esc(o.order_id)}">Lihat Status Pesanan →</a>`;

  document.getElementById('success-card').innerHTML = `
    <p class="ok-mark" aria-hidden="true">✓</p>
    <h1 class="display">${titleTxt}</h1>
    <div class="muted">${descHtml}</div>
    <hr class="hr">
    <div class="kv"><span>Kode pesanan</span><span>#${esc(o.order_code)}</span></div>
    <div class="kv"><span>Konser</span><span>The Weeknd · Jakarta</span></div>
    <div class="kv"><span>Tanggal</span><span>14 Agustus 2027</span></div>
    <div class="kv"><span>Tiket</span><span>${esc(items)}</span></div>
    <div class="kv"><span>Total dibayar</span><span>${rupiah(o.total)}</span></div>
    <div class="kv"><span>Status verifikasi</span><span>${isVerified ? 'Terverifikasi (Paid)' : 'Menunggu Verifikasi Panitia'}</span></div>
    ${primaryBtn}
    <a class="btn btn-outline btn-block" data-route="U1">Kembali ke Beranda</a>
    <p class="muted" style="font-size:12px;text-align:left">Langkah 4 dari 4 · Selesai</p>`;
  hydrateLinks(document.getElementById('success-card'));
  Store.del('twk_order');
}
document.addEventListener('DOMContentLoaded', initSuccess);