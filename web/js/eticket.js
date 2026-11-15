/* ===== U9 · E-Ticket ===== */
let user, order, tickets = [], idx = 0;
const qrCache = {};

const STATUS = {
  valid: {cls: '', text: 'VALID · BELUM DIGUNAKAN'},
  used: {cls: 'used', text: 'SUDAH DIGUNAKAN'},
  cancelled: {cls: 'cancelled', text: 'TIKET DIBATALKAN'}
};

function qrSvg(rows){
  const n = rows.length;
  let d = '';
  rows.forEach((r, y) => { for (let x = 0; x < n; x++) if (r[x] === '1') d += `M${x} ${y}h1v1h-1z`; });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 ${n + 4} ${n + 4}" shape-rendering="crispEdges" role="img" aria-label="Kode QR tiket">
    <rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#fff"/><path d="${d}" fill="#0a0a0a"/></svg>`;
}

async function loadQr(t){
  if (qrCache[t.ticket_code]) return qrCache[t.ticket_code];
  const res = await backend('get_ticket_qr', [order.order_id, user.user_id, t.ticket_code], null);
  qrCache[t.ticket_code] = res && res.ok ? res : {ok: false, message: (res && res.message) || 'QR belum tersedia.'};
  return qrCache[t.ticket_code];
}

function render(){
  const t = tickets[idx];
  const st = STATUS[t.status] || STATUS.valid;
  const tabs = tickets.map((_, i) =>
    `<button class="btn btn-outline ${i === idx ? 'active-tab' : ''}" data-i="${i}">Tiket ${i + 1}</button>`).join('');
  document.getElementById('layout').innerHTML = `
    <article class="ticket ${t.status === 'used' ? 'used' : ''}" id="ticket-card" aria-label="Tiket ${idx + 1}">
      <div><p class="tk-eyebrow">XO / AFTER HOURS TIL DAWN</p>
        <h2 class="tk-title">THE WEEKND</h2>
        <p class="tk-info">14 AGUSTUS 2027 · 20.00 WIB<br>GELORA BUNG KARNO, JAKARTA</p></div>
      <div class="tk-row">
        <div><p class="tk-label">KATEGORI</p><p class="tk-cat">${esc(t.category_name)}</p></div>
        <div><p class="tk-label">NAMA PEMEGANG</p><p>${esc(t.holder_name)}</p></div>
      </div>
      <div class="tk-qr"><div id="qr-slot" class="qr-missing">Memuat QR…</div><p>${esc(t.ticket_code)}</p></div>
      <p class="tk-status ${st.cls}">${st.text}</p>
      <p class="tk-note">QR simulasi akademik · bukan tiket masuk resmi.</p>
    </article>
    <aside class="card side-card">
      <h2>MALAM INI MILIKMU.</h2>
      <div class="tk-tabs">${tabs}</div>
      <button class="btn btn-primary btn-block" id="pdf-btn">Unduh PDF ↓</button>
      <button class="btn btn-outline btn-block" id="img-btn">Simpan Gambar ↓</button>
      <a class="btn btn-outline btn-block" data-route="U10">Kembali ke Pesanan</a>
      <div><p class="eyebrow" style="font-size:12px">DATANG LEBIH AWAL</p>
        <p class="muted" style="font-size:14px;margin-top:8px">Gate dibuka pukul 16.00 WIB. Siapkan e-ticket dan kartu identitas. QR hanya dapat digunakan satu kali.</p></div>
    </aside>`;
  hydrateLinks(document.getElementById('layout'));
  document.querySelectorAll('.tk-tabs [data-i]').forEach(b => b.onclick = () => {
    idx = Number(b.dataset.i);
    history.replaceState(null, '', `?order=${encodeURIComponent(order.order_id)}&t=${idx}`);
    render();
  });
  document.getElementById('pdf-btn').onclick = () => { toast('Pilih "Simpan sebagai PDF" pada dialog cetak.', 'warn'); setTimeout(() => window.print(), 400); };
  document.getElementById('img-btn').onclick = saveImage;

  loadQr(t).then(q => {
    if (tickets[idx] !== t) return;                  // pengguna sudah pindah tab
    const slot = document.getElementById('qr-slot');
    if (!slot) return;
    if (q.ok){ slot.outerHTML = qrSvg(q.rows); }
    else { slot.textContent = q.message; }
  });
}

/* Simpan sebagai PNG: digambar manual di canvas dari matriks QR */
async function saveImage(){
  const t = tickets[idx], q = await loadQr(t);
  if (!q.ok) return toast('QR belum tersedia, tidak bisa menyimpan gambar.', 'error');
  try { await document.fonts.load('100px "Bebas Neue"'); } catch (e) {}
  const W = 900, H = 1230, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const BEBAS = '"Bebas Neue", Impact, sans-serif', INTER = 'Inter, Arial, sans-serif';
  const text = (s, x, y, font, color, align = 'left') => { g.font = font; g.fillStyle = color; g.textAlign = align; g.fillText(s, x, y); };
  g.fillStyle = '#f2eee8'; g.fillRect(0, 0, W, H);
  text('XO / AFTER HOURS TIL DAWN', 60, 100, `22px ${INTER}`, '#c8102e');
  text('THE WEEKND', 60, 220, `130px ${BEBAS}`, '#0a0a0a');
  text('14 AGUSTUS 2027 · 20.00 WIB', 60, 290, `24px ${INTER}`, '#303030');
  text('GELORA BUNG KARNO, JAKARTA', 60, 324, `24px ${INTER}`, '#303030');
  text('KATEGORI', 60, 400, `18px ${INTER}`, '#666');
  text(t.category_name, 60, 450, `58px ${BEBAS}`, '#0a0a0a');
  text('NAMA PEMEGANG', 460, 400, `18px ${INTER}`, '#666');
  let name = t.holder_name;
  g.font = `30px ${INTER}`;
  while (g.measureText(name).width > 380 && name.length > 3) name = name.slice(0, -2);
  text(name === t.holder_name ? name : name + '…', 460, 446, `30px ${INTER}`, '#0a0a0a');
  g.fillStyle = '#fff';
  g.beginPath(); (g.roundRect ? g.roundRect(60, 490, 780, 560, 20) : g.rect(60, 490, 780, 560)); g.fill();
  const n = q.rows.length, size = 400, cell = size / (n + 4), ox = (W - size) / 2, oy = 530;
  g.fillStyle = '#0a0a0a';
  q.rows.forEach((r, y) => { for (let x = 0; x < n; x++) if (r[x] === '1') g.fillRect(ox + (x + 2) * cell, oy + (y + 2) * cell, Math.ceil(cell), Math.ceil(cell)); });
  text(t.ticket_code, W / 2, 985, `28px ${INTER}`, '#0a0a0a', 'center');
  text((STATUS[t.status] || STATUS.valid).text, 60, 1110, `22px ${INTER}`, t.status === 'valid' ? '#16753c' : '#666');
  text('QR simulasi akademik · bukan tiket masuk resmi.', 60, 1160, `20px ${INTER}`, '#666');
  c.toBlob(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `e-ticket-${t.ticket_code}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Gambar tiket disimpan.');
  }, 'image/png');
}

async function initTicket(){
  renderLayout('U10');
  user = requireLogin(); if (!user) return;
  const params = new URLSearchParams(location.search);
  const id = params.get('order') || (Store.get('twk_order') || {}).order_id;
  if (!id) return go('U10');
  const res = await backend('get_order', [id, user.user_id], null);
  if (!res) return toast('Server belum aktif. Jalankan lewat python main.py.', 'error');
  if (!res.ok) return go('U10');
  order = res.order;
  if (order.status !== 'paid' || !order.tickets.length){
    sessionStorage.setItem('twk_flash', 'E-ticket tersedia setelah pembayaran berhasil.');
    return go('U10');
  }
  tickets = order.tickets;
  idx = Math.min(Math.max(0, Number(params.get('t')) || 0), tickets.length - 1);
  render();
}
document.addEventListener('DOMContentLoaded', initTicket);
