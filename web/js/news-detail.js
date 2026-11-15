/* ===== U13d · Detail Berita ===== */
function block(b){
  const x = esc(b.x);
  return b.t === 'h2' ? `<h2>${x}</h2>` : b.t === 'h3' ? `<h3>${x}</h3>` : `<p>${x}</p>`;
}

async function initArticle(){
  renderLayout('U13');
  const id = new URLSearchParams(location.search).get('id');
  const res = await backend('get_news_item', [Number(id)], null);
  const wrap = document.getElementById('article-wrap');
  if (!res){ wrap.innerHTML = ''; return toast('Server belum aktif. Jalankan lewat python main.py.', 'error'); }
  if (!res.ok){ sessionStorage.setItem('twk_flash', 'Berita tidak ditemukan.'); return go('U13'); }
  const a = res.item;
  document.title = a.title + ' · The Weeknd';
  const cta = a.cta ? `<a class="btn btn-outline btn-block" data-route="${esc(a.cta.route)}">${esc(a.cta.label)}</a>` : '';
  const others = res.others.map(o => `<a class="btn btn-outline btn-block" data-route="U13d" data-id="${esc(o.announcement_id)}">${esc(o.title)} ↗</a>`).join('');
  wrap.innerHTML = `
    <p class="eyebrow">${esc(a.category)} / ${esc(tanggal(a.published_at).toUpperCase())}</p>
    <h1 class="display page-title">${esc(a.title.toUpperCase())}.</h1>
    <p class="muted" style="font-size:14px">Oleh ${esc(a.author)} · ${a.read_minutes} menit baca</p>
    <div class="news-visual wide"><small>AFTER HOURS / FIELD NOTES</small>
      <span class="num">FIELD NOTES / ${String(a.announcement_id).padStart(2, '0')}</span><span class="loc">THE WEEKND · JAKARTA</span></div>
    <div class="article">${a.content.map(block).join('')}${cta}</div>
    ${others ? `<h2 class="sec-title" style="font-size:32px">BERITA LAINNYA</h2>${others}` : ''}`;
  hydrateLinks(wrap);
}
document.addEventListener('DOMContentLoaded', initArticle);
