/* ===== U5 · Data Pemegang Tiket ===== */
let user, cats = [], cartLines = [], holders = [];

const fieldError = (id, msg) => {
  const f = document.getElementById('f-' + id);
  if (!f) return;
  f.classList.toggle('error', !!msg);
  f.querySelector('.help').textContent = msg || '';
};

function buildHolders(cart){
  const saved = Store.get('twk_holders');
  const list = [];
  cats.forEach(c => { for (let i = 0; i < (cart[c.category_id] || 0); i++) list.push({category_id: c.category_id, cat_name: c.name, name: '', nik: '', same: false}); });
  if (saved && saved.length === list.length && saved.every((h, i) => h.category_id === list[i].category_id)) return saved;
  if (list.length){ list[0].same = true; list[0].name = user.full_name; }   // default: tiket 1 = pemilik akun
  return list;
}

function renderForms(){
  document.getElementById('holder-forms').innerHTML = holders.map((h, i) => `
    <section class="card holder" style="margin-bottom:24px">
      <h2 class="holder-title">TIKET ${String(i + 1).padStart(2, '0')} / ${esc(h.cat_name)}</h2>
      ${i === 0 ? `<label class="check check-lg"><input type="checkbox" id="same-0" ${h.same ? 'checked' : ''}> <span>Sama dengan data akun</span></label>` : ''}
      <div class="field" id="f-name-${i}">
        <label for="name-${i}">Nama sesuai identitas</label>
        <input class="input" id="name-${i}" data-i="${i}" data-k="name" value="${esc(h.name)}" placeholder="Nama sesuai KTP / paspor" autocomplete="off" ${h.same ? 'readonly' : ''}>
        <p class="help"></p>
      </div>
      <div class="field" id="f-nik-${i}">
        <label for="nik-${i}">Nomor identitas (opsional)</label>
        <input class="input" id="nik-${i}" data-i="${i}" data-k="nik" value="${esc(h.nik)}" placeholder="Masukkan NIK / nomor paspor" autocomplete="off">
        <p class="help"></p>
      </div>
    </section>`).join('');
}

function renderSummary(){
  const total = cartLines.reduce((a, l) => a + l.amount, 0);
  document.getElementById('summary').innerHTML = renderSummaryCard({
    lines: cartLines, total,
    action: `<button class="btn btn-primary btn-block" id="next-btn">Lanjut ke Pembayaran →</button>`
  });
  document.getElementById('next-btn').onclick = onNext;
}

function onInput(e){
  const el = e.target.closest('input[data-i]');
  if (!el) return;
  const i = Number(el.dataset.i);
  holders[i][el.dataset.k] = el.value;
  fieldError(el.id, null);
}
function onSame(e){
  if (e.target.id !== 'same-0') return;
  const h = holders[0], input = document.getElementById('name-0');
  h.same = e.target.checked;
  input.readOnly = h.same;
  if (h.same){ h.name = user.full_name; input.value = user.full_name; fieldError('name-0', null); }
  else { input.focus(); }
}

async function onNext(){
  let ok = true, firstBad = null;
  holders.forEach((h, i) => {
    const nameOk = h.name.trim().length >= 3;
    fieldError('name-' + i, nameOk ? null : 'Nama minimal 3 karakter');
    const nikOk = !h.nik.trim() || /^[A-Za-z0-9]{6,20}$/.test(h.nik.trim());
    fieldError('nik-' + i, nikOk ? null : 'Nomor identitas 6–20 huruf/angka');
    if (!nameOk && !firstBad) firstBad = 'name-' + i;
    if (!nikOk && !firstBad) firstBad = 'nik-' + i;
    if (!nameOk || !nikOk) ok = false;
  });
  if (!ok){ document.getElementById(firstBad).focus(); return; }

  Store.set('twk_holders', holders);
  const btn = document.getElementById('next-btn');
  btn.classList.add('is-loading'); btn.disabled = true;

  // Jika user kembali dari U6, lepas dulu tahanan kuota pesanan lama
  const prev = Store.get('twk_order');
  if (prev) await backend('cancel_order', [prev.order_id, user.user_id], null);

  const items = cartLines.map(l => ({category_id: l.category_id, quantity: l.qty}));
  const people = holders.map(h => ({category_id: h.category_id, holder_name: h.name.trim(), holder_id_no: h.nik.trim()}));
  const res = await backend('create_order', [user.user_id, items, people], null);
  btn.classList.remove('is-loading'); btn.disabled = false;

  if (!res) return toast('Server belum aktif. Jalankan lewat python main.py.', 'error');
  if (!res.ok){
    Store.del('twk_order');
    return modal({title: 'PESANAN GAGAL DIBUAT', text: res.message, actions: [{label: 'Ubah Pesanan', primary: true, onClick: () => go('U4')}]});
  }
  Store.set('twk_order', {order_id: res.order.order_id});
  go('U6');
}

async function initHolders(){
  renderLayout('U4');
  user = requireLogin(); if (!user) return;
  const cart = (Store.get('twk_cart') || {}).items || {};
  if (!Object.keys(cart).length) return go('U4');

  document.getElementById('stepper').innerHTML = renderStepper(2);
  cats = await backend('get_ticket_categories', [], FALLBACK_CATEGORIES);
  cartLines = cats.filter(c => cart[c.category_id] > 0).map(c => ({
    category_id: c.category_id, qty: cart[c.category_id], label: `${c.name} × ${cart[c.category_id]}`, amount: c.price * cart[c.category_id]
  }));
  holders = buildHolders(cart);
  renderForms(); renderSummary();
  const box = document.getElementById('holder-forms');
  box.addEventListener('input', onInput);
  box.addEventListener('change', onSame);
}
document.addEventListener('DOMContentLoaded', initHolders);
