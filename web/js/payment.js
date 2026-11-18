/* ===== U7 · Instruksi Pembayaran (simulasi) ===== */
let user, order;

const HOWTO = {
  bank: n => [`Buka ${n} mobile dan pilih m-Transfer / Transfer.`, `Pilih ${n} Virtual Account.`, 'Masukkan nomor VA dan periksa nominal.', 'Konfirmasi pembayaran dengan PIN kamu.'],
  ewallet: n => [`Buka aplikasi ${n}.`, 'Pilih menu Bayar dan masukkan kode pembayaran di atas.', 'Periksa nominal dan nama merchant.', 'Konfirmasi dengan PIN kamu.']
};
const bankName = label => label.replace(' Virtual Account', '');

function howto(p){
  if (p.kind === 'va') return HOWTO.bank(bankName(p.label));
  if (p.kind === 'ewallet') return HOWTO.ewallet(p.label);
  return ['Masukkan data kartu pada formulir di atas.', 'Periksa nominal pembayaran.', 'Tekan Bayar untuk memproses.'];
}

function renderCard(){
  const p = order.payment;
  const isCard = p.kind === 'card';
  const display = isCard
    ? `<div class="card-form">
         <div class="field full" id="f-cardno"><label for="cardno">Nomor kartu (simulasi)</label>
           <input class="input" id="cardno" inputmode="numeric" maxlength="19" placeholder="4111 1111 1111 1111" autocomplete="off"><p class="help"></p></div>
         <div class="field" id="f-exp"><label for="exp">Masa berlaku</label>
           <input class="input" id="exp" placeholder="MM/YY" maxlength="5" autocomplete="off"><p class="help"></p></div>
         <div class="field" id="f-cvv"><label for="cvv">CVV</label>
           <input class="input" id="cvv" type="password" inputmode="numeric" maxlength="4" placeholder="•••" autocomplete="off"><p class="help"></p></div>
         <div class="field full" id="f-cname"><label for="cname">Nama di kartu</label>
           <input class="input" id="cname" placeholder="Nama pemegang kartu" autocomplete="off"><p class="help"></p></div>
         <p class="help full">Ini simulasi. Jangan masukkan nomor kartu asli.</p>
       </div>`
    : `<p class="va-number" id="va-number">${esc(p.account_display)}</p>
       <button class="btn btn-outline btn-block" id="copy-btn">${p.kind === 'va' ? 'Salin nomor virtual account' : 'Salin kode pembayaran'}</button>`;
  document.getElementById('pay-card').innerHTML = `
    <p class="pay-status">MENUNGGU PEMBAYARAN</p>
    <div class="sum-row"><span>Waktu tersisa</span><span class="v" id="timer">--:--</span></div>
    <h2 class="sec-title">${esc(p.label.toUpperCase())}</h2>
    <div id="pay-error" class="banner" hidden></div>
    ${display}
    <div class="sum-row"><span>Nominal pembayaran</span><span class="v">${rupiah(order.total)}</span></div>
    <hr style="border:0;border-top:1px solid var(--border)">
    <h3 class="holder-title">CARA MEMBAYAR</h3>
    <div class="cara">${howto(p).map((t, i) => `<p><span>0${i + 1}</span>${esc(t)}</p>`).join('')}</div>
    <button class="btn btn-primary btn-block" id="paid-btn">${isCard ? 'Bayar →' : 'Saya Sudah Bayar →'}</button>
    <a class="btn btn-outline btn-block" data-route="U6">← Ganti Metode</a>`;
  hydrateLinks(document.getElementById('pay-card'));
  document.getElementById('paid-btn').onclick = onPaid;
  const copy = document.getElementById('copy-btn');
  if (copy) copy.onclick = onCopy;
}

function renderSummary(){
  document.getElementById('summary').innerHTML = renderSummaryCard({
    lines: orderLines(order), discount: order.discount, voucher: order.voucher_code, total: order.total,
    action: `<a class="btn btn-primary btn-block" data-route="U10">Lihat pesanan</a>`
  });
  hydrateLinks(document.getElementById('summary'));
}

async function onCopy(){
  const raw = order.payment.account_no;
  try { await navigator.clipboard.writeText(raw); }
  catch (e) {
    const t = document.createElement('textarea'); t.value = raw; document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); } catch (_) {} t.remove();
  }
  toast('Nomor disalin');
}

function showError(msg){ const b = document.getElementById('pay-error'); b.textContent = msg; b.hidden = !msg; }
function readCard(){
  const get = id => document.getElementById(id).value.trim();
  const card = {number: get('cardno').replace(/\s/g, ''), exp: get('exp'), cvv: get('cvv'), name: get('cname')};
  const errs = {cardno: /^\d{13,19}$/.test(card.number) ? null : 'Nomor kartu 13–19 digit',
                exp: /^(0[1-9]|1[0-2])\/\d{2}$/.test(card.exp) ? null : 'Format MM/YY',
                cvv: /^\d{3,4}$/.test(card.cvv) ? null : '3–4 digit',
                cname: card.name.length >= 3 ? null : 'Nama wajib diisi'};
  let ok = true;
  Object.entries(errs).forEach(([k, m]) => { const f = document.getElementById('f-' + k); f.classList.toggle('error', !!m); f.querySelector('.help').textContent = m || ''; if (m) ok = false; });
  return ok ? card : null;
}

async function onPaid(){
  showError('');
  let card = null;
  if (order.payment.kind === 'card'){ card = readCard(); if (!card) return; }
  const btn = document.getElementById('paid-btn');
  const label = btn.textContent;
  btn.classList.add('is-loading'); btn.disabled = true; btn.textContent = 'Memverifikasi pembayaran';
  await new Promise(r => setTimeout(r, 1200));   // simulasi proses verifikasi
  const res = await backend('pay_order', [order.order_id, user.user_id, card], null);
  btn.classList.remove('is-loading'); btn.disabled = false; btn.textContent = label;
  if (!res) return showError('Server belum aktif. Jalankan lewat python main.py.');
  if (!res.ok){
    if (res.expired) return showExpiredModal();
    return showError(res.message + ' Silakan coba lagi atau ganti metode.');
  }
  ['twk_cart', 'twk_holders', 'twk_method'].forEach(k => Store.del(k));
  go('U8');
}

async function initPayment(){
  renderLayout('U4');
  user = requireLogin(); if (!user) return;
  const saved = Store.get('twk_order');
  if (!saved) return go('U4');
  const res = await backend('get_order', [saved.order_id, user.user_id], null);
  if (!res) return toast('Server belum aktif. Jalankan lewat python main.py.', 'error');
  if (!res.ok){ clearBooking(); return go('U4'); }
  order = res.order;
  if (order.status === 'paid') return go('U8');
  if (order.status !== 'pending') return showExpiredModal();
  if (!order.payment) return go('U6');

  // Jika user sudah klik bayar dan sedang menunggu verifikasi panitia (expires_in_ms > 24 jam)
  if (order.expires_in_ms > 86400000) {
    Store.del('twk_order');
    return go('U11', {id: order.order_id});
  }

  document.getElementById('order-code').textContent = 'PESANAN #' + order.order_code;
  renderCard(); renderSummary();
  startOrderTimer(Date.now() + order.expires_in_ms,
    left => { const t = document.getElementById('timer'); if (t) t.textContent = fmtMMSS(left); },
    async () => { await backend('get_order', [order.order_id, user.user_id], null); showExpiredModal(); });
}
document.addEventListener('DOMContentLoaded', initPayment);
