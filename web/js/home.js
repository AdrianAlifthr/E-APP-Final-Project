/* ===== U1 · Beranda ===== */
const FALLBACK = {
  concert: { title:'THE WEEKND', tagline:'AFTER HOURS TIL DAWN', concert_date:'2027-08-14T20:00:00+07:00', min_price:850000 },
  news: [
    {announcement_id:1, title:'Panduan masuk venue & penukaran tiket', published_at:'2027-04-12'},
    {announcement_id:2, title:'Kenali kategori tiket sebelum membeli',  published_at:'2027-04-12'},
    {announcement_id:3, title:'Semua yang perlu kamu bawa',             published_at:'2027-04-12'}
  ]
};

function statusOf(c){
  const left = c.quota - c.sold;
  if (left <= 0) return {label:'SOLD OUT', cls:'', soldOut:true};
  if (left / c.quota <= 0.2) return {label:'HAMPIR HABIS', cls:'warn'};
  return {label:'TERSEDIA', cls:''};
}

function renderCategories(list){
  document.getElementById('categories').innerHTML = list.map(c => {
    const s = statusOf(c);
    return `<article class="card cat ${s.soldOut ? 'sold-out' : ''}">
      <span class="status ${s.cls}">${s.label}</span>
      <h3 class="name">${esc(c.name)}</h3>
      <p class="price">${rupiah(c.price)}</p>
      <p class="desc">${esc(c.description)}</p>
      <a class="btn btn-outline btn-block" data-route="U4" data-param="cat" data-id="${esc(c.category_id)}">Lihat kategori ↗</a>
    </article>`;
  }).join('');
}

function renderNews(list){
  document.getElementById('news').innerHTML = list.slice(0, 3).map((n, i) => `
    <article class="card news">
      <span class="eyebrow">0${i + 1} / CATATAN KONSER</span>
      <h3 class="title">${esc(n.title)}</h3>
      <p class="meta">${tanggal(n.published_at)} · 3 menit baca</p>
      <a class="btn btn-outline btn-block" data-route="U13d" data-id="${esc(n.announcement_id)}">Baca selengkapnya ↗</a>
    </article>`).join('');
}

function startCountdown(dateStr){
  const target = new Date(dateStr).getTime();
  const els = {d:'cd-d', h:'cd-h', m:'cd-m', s:'cd-s'};
  const pad = n => String(n).padStart(2, '0');
  function tick(){
    let diff = Math.max(0, target - Date.now());
    const d = Math.floor(diff / 864e5); diff -= d * 864e5;
    const h = Math.floor(diff / 36e5);  diff -= h * 36e5;
    const m = Math.floor(diff / 6e4);   diff -= m * 6e4;
    const s = Math.floor(diff / 1e3);
    document.getElementById(els.d).textContent = d;
    document.getElementById(els.h).textContent = pad(h);
    document.getElementById(els.m).textContent = pad(m);
    document.getElementById(els.s).textContent = pad(s);
    if (target - Date.now() <= 0){
      clearInterval(timer);
      document.getElementById('sale-note').textContent = 'PENJUALAN DIBUKA';
    }
  }
  tick();
  const timer = setInterval(tick, 1000);
}

async function initHome(){
  renderLayout('U1');
  const skeleton = '<div class="skeleton"></div>'.repeat(4);
  document.getElementById('categories').innerHTML = skeleton;

  const [concert, cats, news] = await Promise.all([
    backend('get_concert_info', [], FALLBACK.concert),
    backend('get_ticket_categories', [], FALLBACK_CATEGORIES),
    backend('get_announcements', [3], FALLBACK.news)
  ]);

  const min = cats.length ? Math.min(...cats.map(c => c.price)) : concert.min_price;
  document.getElementById('sale-note').textContent = 'PENJUALAN DIBUKA · MULAI ' + rupiah(min);
  startCountdown(concert.concert_date);
  renderCategories(cats);
  renderNews(news);
  hydrateLinks(document);
}
document.addEventListener('DOMContentLoaded', initHome);
