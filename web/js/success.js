/* ===== U8 · Pembayaran Berhasil ===== */
async function initSuccess(){
  renderLayout('U4');
  const user = requireLogin(); if (!user) return;
  const saved = Store.get('twk_order');
  if (!saved) return go('U10');
  const res = await backend('get_order', [saved.order_id, user.user_id], null);
  if (!res) return toast('Server belum aktif. Jalankan lewat python main.py.', 'error');
  if (!res.ok) return go('U10');
  const o = res.order;
  if (o.status !== 'paid') return go('U6');           // belum lunas -> kembali ke checkout

  const items = o.items.map(i => `${i.quantity} × ${i.name}`).join(', ');
  document.getElementById('success-card').innerHTML = `
    <p class="ok-mark" aria-hidden="true">✓</p>
    <h1 class="display">PEMBAYARAN BERHASIL.</h1>
    <div class="muted"><p>Malam terbaikmu sudah menunggu.</p>
      <p>E-ticket tersedia di akunmu (${esc(user.email)}).</p></div>
    <hr class="hr">
    <div class="kv"><span>Kode pesanan</span><span>#${esc(o.order_code)}</span></div>
    <div class="kv"><span>Konser</span><span>The Weeknd · Jakarta</span></div>
    <div class="kv"><span>Tanggal</span><span>14 Agustus 2027</span></div>
    <div class="kv"><span>Tiket</span><span>${esc(items)}</span></div>
    <div class="kv"><span>Total dibayar</span><span>${rupiah(o.total)}</span></div>
    <a class="btn btn-primary btn-block" data-route="U9" data-param="order" data-id="${esc(o.order_id)}">Lihat E-Ticket →</a>
    <a class="btn btn-outline btn-block" data-route="U1">Kembali ke Beranda</a>
    <p class="muted" style="font-size:12px;text-align:left">Langkah 4 dari 4 · Selesai</p>`;
  hydrateLinks(document.getElementById('success-card'));
  Store.del('twk_order');   // alur pembelian selesai; pesanan tetap bisa dibuka dari "Pesanan saya"
}
document.addEventListener('DOMContentLoaded', initSuccess);
