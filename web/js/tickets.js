/* ===== U4 · Pilih Tiket ===== */
const MAX_TICKETS = 4;
let categories = [];
let qty = {};   // { category_id: jumlah }

const remaining = c => Math.max(0, c.quota - c.sold);
const totalQty = () => Object.values(qty).reduce((a, b) => a + b, 0);
const shortDate = (d, withYear) => new Date(d).toLocaleDateString('id-ID',
  withYear ? {day:'2-digit', month:'short', year:'numeric'} : {day:'2-digit', month:'short'});

function statusOf(c){
  const left = remaining(c);
  if (left <= 0) return {key:'out', label:'SOLD OUT'};
  if (left / c.quota <= 0.2) return {key:'low', label:'Hampir habis'};
  return {key:'ok', label:'Tersedia'};
}

function renderList(){
  const full = totalQty() >= MAX_TICKETS;
  document.getElementById('picker-list').innerHTML = categories.map(c => {
    const s = statusOf(c), left = remaining(c), q = qty[c.category_id] || 0;
    const pct = left <= 0 ? 0 : Math.max(2, Math.round(left / c.quota * 100));
    const controls = s.key === 'out'
      ? `<span class="qty-label">HABIS</span>`
      : `<div class="qty">
           <button type="button" data-act="dec" data-id="${c.category_id}" ${q === 0 ? 'disabled' : ''} aria-label="Kurangi ${esc(c.name)}">−</button>
           <output aria-live="polite">${q}</output>
           <button type="button" data-act="inc" data-id="${c.category_id}" ${(full || q >= left) ? 'disabled' : ''}
             title="${full ? 'Maksimal 4 tiket' : ''}" aria-label="Tambah ${esc(c.name)}">+</button>
         </div>`;
    const meta = (s.key === 'out' ? 'Tidak tersedia' : `${left.toLocaleString('id-ID')} tiket tersisa`)
      + ` · Penjualan ${shortDate(c.sale_start)} – ${shortDate(c.sale_end, true)}`;
    return `<article class="card tcat ${q > 0 ? 'selected' : ''} ${s.key === 'out' ? 'sold-out' : ''}">
      <div class="tcat-head"><h2 class="tcat-name">${esc(c.name)}</h2><span class="tcat-status ${s.key}">${s.label}</span></div>
      <p class="tcat-desc">${esc(c.description)}</p>
      <div class="tcat-row"><span class="tcat-price">${rupiah(c.price)}</span>${controls}</div>
      <div class="bar-track"><div class="bar-fill ${s.key === 'low' ? 'low' : ''}" style="width:${pct}%"></div></div>
      <p class="tcat-meta">${meta}</p>
    </article>`;
  }).join('');
}

function renderSummary(){
  const lines = categories.filter(c => qty[c.category_id] > 0);
  const total = lines.reduce((a, c) => a + c.price * qty[c.category_id], 0);
  document.getElementById('sum-lines').innerHTML = lines.length
    ? lines.map(c => `<div class="sum-row" style="margin-bottom:12px"><span>${esc(c.name)} × ${qty[c.category_id]}</span><span style="color:var(--text)">${rupiah(c.price * qty[c.category_id])}</span></div>`).join('')
    : `<p class="sum-note">Belum ada tiket dipilih.</p>`;
  document.getElementById('sum-total').textContent = rupiah(total);
  document.getElementById('continue-btn').disabled = lines.length === 0;
  sessionStorage.setItem('twk_cart', JSON.stringify({items: qty}));
}
const refresh = () => { renderList(); renderSummary(); };

function onPick(e){
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  const id = Number(b.dataset.id), c = categories.find(x => x.category_id === id);
  const cur = qty[id] || 0;
  if (b.dataset.act === 'inc' && totalQty() < MAX_TICKETS && cur < remaining(c)) qty[id] = cur + 1;
  if (b.dataset.act === 'dec' && cur > 0){ qty[id] = cur - 1; if (!qty[id]) delete qty[id]; }
  refresh();
}

async function onContinue(){
  const user = Auth.get();
  if (!user){
    return modal({
      title: 'MASUK DULU YUK', text: 'Kamu perlu masuk atau membuat akun untuk melanjutkan pemesanan.',
      actions: [
        {label:'Daftar', onClick:() => go('U2')},
        {label:'Masuk', primary:true, onClick:() => go('U3', {next:'U4'})}
      ]
    });
  }
  const btn = document.getElementById('continue-btn');
  btn.classList.add('is-loading'); btn.disabled = true;
  const items = Object.entries(qty).map(([category_id, quantity]) => ({category_id:Number(category_id), quantity}));
  const res = await backend('check_quota', [items], () => ({ok:true}));
  btn.classList.remove('is-loading'); btn.disabled = false;
  if (!res.ok){
    return modal({title:'KUOTA TIDAK MENCUKUPI', text: res.message || 'Jumlah tiket melebihi sisa kuota.',
      actions:[{label:'Ubah Jumlah', primary:true}]});
  }
  go('U5');
}

async function initTickets(){
  renderLayout('U4');
  document.getElementById('stepper').innerHTML = renderStepper(1);
  categories = await backend('get_ticket_categories', [], FALLBACK_CATEGORIES);

  const saved = JSON.parse(sessionStorage.getItem('twk_cart') || '{"items":{}}').items || {};
  Object.entries(saved).forEach(([id, n]) => {
    const c = categories.find(x => x.category_id === Number(id));
    if (c && remaining(c) > 0) qty[id] = Math.min(n, remaining(c));
  });
  const pre = Number(new URLSearchParams(location.search).get('cat'));
  const pc = categories.find(c => c.category_id === pre);
  if (pc && remaining(pc) > 0 && !totalQty()) qty[pre] = 1;

  document.getElementById('picker-list').addEventListener('click', onPick);
  document.getElementById('continue-btn').addEventListener('click', onContinue);
  refresh();
}
document.addEventListener('DOMContentLoaded', initTickets);
