/* ===== U6 · Checkout ===== */
let user, order, method = 'bca', voucherText = '', voucherMsg = null;

function renderMethods(){
  document.getElementById('methods').innerHTML = PAY_GROUPS.map(g => `
    <section class="card method-group">
      <p class="eyebrow">${g.title}</p>
      ${g.items.map(([key, label]) => `
        <label class="method ${key === method ? 'selected' : ''}">
          <input type="radio" name="method" value="${key}" ${key === method ? 'checked' : ''}>
          <span>${label}</span><span class="dot"></span>
        </label>`).join('')}
    </section>`).join('');
}

function renderSummary(){
  const msg = voucherMsg ? `<p class="voucher-msg ${voucherMsg.ok ? 'ok' : 'err'}">${esc(voucherMsg.text)}</p>` : '';
  document.getElementById('summary').innerHTML = renderSummaryCard({
    lines: orderLines(order), discount: order.discount, voucher: order.voucher_code, total: order.total,
    action: `<button class="btn btn-primary btn-block" id="pay-btn" ${method ? '' : 'disabled'}>Bayar Sekarang →</button>`,
    extra: `<div class="voucher">
        <div class="field"><label for="voucher">Punya kode voucher?</label>
          <input class="input" id="voucher" placeholder="Masukkan kode voucher" value="${esc(voucherText)}" autocomplete="off" style="text-transform:uppercase"></div>
        ${msg}
        <button class="btn btn-outline btn-block" id="voucher-btn">Pakai</button>
      </div>
      <button class="btn btn-outline btn-block" id="cancel-btn">Batalkan Pesanan</button>`
  });
  document.getElementById('pay-btn').onclick = onPay;
  document.getElementById('voucher-btn').onclick = onVoucher;
  document.getElementById('cancel-btn').onclick = onCancel;
  const v = document.getElementById('voucher');
  v.oninput = () => { voucherText = v.value; };
  v.onkeydown = e => { if (e.key === 'Enter') onVoucher(); };
}

async function onVoucher(){
  const btn = document.getElementById('voucher-btn');
  btn.classList.add('is-loading'); btn.disabled = true;
  const res = await backend('apply_voucher', [order.order_id, user.user_id, voucherText.trim()], null);
  if (!res){ voucherMsg = {ok: false, text: 'Server belum aktif.'}; }
  else if (res.ok){ order = res.order; voucherMsg = {ok: true, text: res.message}; toast(res.message); }
  else { voucherMsg = {ok: false, text: res.message}; }
  renderSummary();
}

async function onPay(){
  if (!method) return;
  const btn = document.getElementById('pay-btn');
  btn.classList.add('is-loading'); btn.disabled = true;
  const res = await backend('select_payment', [order.order_id, user.user_id, method], null);
  btn.classList.remove('is-loading'); btn.disabled = false;
  if (!res) return toast('Server belum aktif.', 'error');
  if (!res.ok) return modal({title: 'GAGAL', text: res.message, actions: [{label: 'Tutup', primary: true}]});
  Store.set('twk_method', method);
  go('U7');
}

function onCancel(){
  confirmModal({
    title: 'BATALKAN PESANAN?', text: 'Tiket yang kamu tahan akan dilepas dan dikembalikan ke kuota.',
    yes: 'Ya, batalkan', no: 'Tidak',
    onYes: async () => {
      await backend('cancel_order', [order.order_id, user.user_id], null);
      clearBooking();
      sessionStorage.setItem('twk_flash', 'Pesanan dibatalkan. Kuota dikembalikan.');
      go('U4');
    }
  });
}

async function initCheckout(){
  renderLayout('U4');
  user = requireLogin(); if (!user) return;
  const saved = Store.get('twk_order');
  if (!saved) return go('U4');
  const res = await backend('get_order', [saved.order_id, user.user_id], null);
  if (!res) return toast('Server belum aktif. Jalankan lewat python main.py.', 'error');
  if (!res.ok){ clearBooking(); return go('U4'); }
  order = res.order;
  if (order.status === 'paid') return go('U8');
  if (order.status !== 'pending'){ return showExpiredModal(); }

  document.getElementById('stepper').innerHTML = renderStepper(3);
  method = Store.get('twk_method') || 'bca';
  renderMethods(); renderSummary();
  document.getElementById('methods').addEventListener('change', e => {
    if (e.target.name !== 'method') return;
    method = e.target.value;
    document.querySelectorAll('.method').forEach(l => l.classList.toggle('selected', l.querySelector('input').checked));
    document.getElementById('pay-btn').disabled = false;
  });
  startOrderTimer(Date.now() + order.expires_in_ms,
    left => { document.getElementById('timer').textContent = fmtMMSS(left); },
    async () => { await backend('get_order', [order.order_id, user.user_id], null); showExpiredModal(); });
}
document.addEventListener('DOMContentLoaded', initCheckout);
