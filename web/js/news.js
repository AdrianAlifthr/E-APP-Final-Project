/* ===== U13 · Berita & Pengumuman ===== */
const PER_PAGE = 3;
let page = 1, query = '', timer = null;

function card(a, n){
  return `<article class="card news-card">
    <div class="news-visual"><small>AFTER HOURS / FIELD NOTES</small>
      <span class="num">${String(n).padStart(2, '0')}</span><span class="loc">THE WEEKND · JAKARTA</span></div>
    <p class="news-meta">${esc(tanggal(a.published_at).toUpperCase())} / ${esc(a.category)}</p>
    <h2 class="title">${esc(a.title)}</h2>
    <p class="muted" style="font-size:14px">${esc(a.excerpt)}</p>
    <a class="btn btn-outline btn-block" data-route="U13d" data-id="${esc(a.announcement_id)}">Baca selengkapnya ↗</a>
  </article>`;
}

async function load(){
  const res = await backend('get_news_page', [page, query, PER_PAGE], null);
  const list = document.getElementById('news-list'), pager = document.getElementById('pager');
  if (!res){ list.innerHTML = ''; return toast('Server belum aktif. Jalankan lewat python main.py.', 'error'); }
  page = res.page;
  if (!res.items.length){
    list.innerHTML = `<div class="card empty" style="grid-column:1/-1"><h2 class="sec-title">TIDAK ADA BERITA</h2>
      <p class="muted" style="font-size:14px">${query ? 'Coba kata kunci lain.' : 'Belum ada pengumuman yang dipublikasikan.'}</p></div>`;
    pager.innerHTML = '';
    return;
  }
  list.innerHTML = res.items.map((a, i) => card(a, (res.page - 1) * PER_PAGE + i + 1)).join('');
  hydrateLinks(list);
  pager.innerHTML = `<button class="btn" id="prev" ${res.page <= 1 ? 'disabled' : ''}>← Sebelumnya</button>
    <span class="btn" aria-live="polite">${res.page} / ${res.pages}</span>
    <button class="btn" id="next" ${res.page >= res.pages ? 'disabled' : ''}>Berikutnya →</button>`;
  document.getElementById('prev').onclick = () => { page--; load(); window.scrollTo({top: 0, behavior: 'smooth'}); };
  document.getElementById('next').onclick = () => { page++; load(); window.scrollTo({top: 0, behavior: 'smooth'}); };
}

document.addEventListener('DOMContentLoaded', () => {
  renderLayout('U13');
  document.getElementById('q').addEventListener('input', e => {
    clearTimeout(timer);
    timer = setTimeout(() => { query = e.target.value.trim(); page = 1; load(); }, 250);
  });
  load();
});
