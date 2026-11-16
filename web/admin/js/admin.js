/* ===== Admin Panel Logic (A1 Login & A2 Dashboard) ===== */
let _adminUser = null;
let _dashData = null;
let _activeDays = 7;

function getAdminSession() {
  const u = Auth.get();
  return u && u.role === 'admin' ? u : null;
}

/* ----- A1: Login Admin ----- */
function initAdminLogin() {
  if (getAdminSession()) {
    window.location.href = 'dashboard.html';
    return;
  }

  const form = document.getElementById('admin-login-form');
  const emailEl = document.getElementById('email');
  const passEl = document.getElementById('password');
  const banner = document.getElementById('admin-banner');
  const btn = document.getElementById('admin-submit');

  document.getElementById('toggle-pw').onclick = () => {
    passEl.type = passEl.type === 'password' ? 'text' : 'password';
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    banner.hidden = true;

    const email = emailEl.value.trim().toLowerCase();
    const password = passEl.value;

    if (!email || !password) {
      banner.textContent = 'Email dan password admin wajib diisi.';
      banner.hidden = false;
      return;
    }

    btn.classList.add('is-loading');
    btn.disabled = true;

    const res = await backend('admin_login', [email, password], null);

    btn.classList.remove('is-loading');
    btn.disabled = false;

    if (!res) {
      banner.textContent = 'Server Python (Eel) belum aktif. Jalankan python main.py.';
      banner.hidden = false;
      return;
    }
    if (!res.ok) {
      banner.textContent = res.message || 'Gagal masuk ke Panel Panitia.';
      banner.hidden = false;
      return;
    }

    Auth.set(res.user);
    window.location.href = 'dashboard.html';
  });
}

/* ----- A2: Dashboard Publikasi ----- */
async function initAdminDashboard() {
  _adminUser = getAdminSession();
  if (!_adminUser) {
    window.location.href = 'login.html';
    return;
  }

  const displayName = _adminUser.full_name || 'Admin Publikasi';
  document.getElementById('side-admin-name').textContent = displayName;
  document.getElementById('top-admin-name').textContent = displayName;

  document.getElementById('admin-logout').onclick = () => {
    confirmModal({
      title: 'KELUAR PANEL PANITIA?',
      text: 'Sesi admin akan diakhiri dan kamu akan kembali ke halaman login admin.',
      yes: 'Keluar',
      onYes: () => {
        Auth.clear();
        window.location.href = 'login.html';
      }
    });
  };

  // Menu tahap berikutnya
  document.querySelectorAll('.adm-nav-item.locked').forEach((btn) => {
    btn.onclick = () => toast('Menu ini dijadwalkan pada tahap pengembangan berikutnya.', 'warn');
  });

  // Filter 7 hari / 30 hari
  document.querySelectorAll('#chart-range button').forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll('#chart-range button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      _activeDays = Number(btn.dataset.days) || 7;
      loadDashboardData();
    };
  });

  // Pencarian pengumuman
  document.getElementById('search-ann').addEventListener('input', (e) => {
    if (_dashData) renderAnnouncements(_dashData.announcements || [], e.target.value);
  });

  // Modal buat pengumuman
  document.getElementById('btn-new-ann').onclick = openAnnouncementModal;
  document.getElementById('nav-open-ann').onclick = openAnnouncementModal;
  document.getElementById('btn-manage-ann').onclick = openAnnouncementModal;

  await loadDashboardData();
}

async function loadDashboardData() {
  const res = await backend('get_admin_dashboard', [_adminUser.user_id, _activeDays], null);
  if (!res || !res.ok) {
    toast((res && res.message) || 'Gagal memuat data dashboard dari Supabase.', 'error');
    return;
  }

  _dashData = res;
  const now = new Date();
  const tgl = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const jam = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
  document.getElementById('dash-timestamp').textContent = `Ringkasan per ${tgl} · ${jam} WIB`;

  // KPI
  const k = res.kpi;
  document.getElementById('kpi-sold').textContent = Number(k.total_sold).toLocaleString('id-ID');
  document.getElementById('kpi-sold-sub').textContent =
    `dari ${Number(k.total_quota).toLocaleString('id-ID')} tiket · ${String(k.sold_pct).replace('.', ',')}%`;
  document.getElementById('kpi-rev').textContent = k.revenue_short;
  document.getElementById('kpi-rev-sub').textContent = `${rupiah(k.total_revenue)} · Lunas`;
  document.getElementById('kpi-pending').textContent = Number(k.pending_count).toLocaleString('id-ID');
  document.getElementById('kpi-checkin').textContent = Number(k.checked_in).toLocaleString('id-ID');

  // Chart
  document.getElementById('chart-sub').textContent =
    `${Number(res.chart_total).toLocaleString('id-ID')} tiket / ${_activeDays} hari terakhir`;
  renderSalesChart(res.chart || []);

  // Quota
  document.getElementById('quota-sub').textContent =
    `${Number(k.remaining_total).toLocaleString('id-ID')} tiket masih tersedia`;
  renderQuotaList(res.categories || []);

  // Orders
  renderRecentOrders(res.recent_orders || []);

  // Announcements
  renderAnnouncements(res.announcements || [], document.getElementById('search-ann').value);
}

function renderSalesChart(points) {
  const svg = document.getElementById('sales-chart');
  if (!points.length) {
    svg.innerHTML = '';
    return;
  }
  const W = 640, H = 210, padL = 16, padR = 16, padT = 20, padB = 34;
  const maxVal = Math.max(5, ...points.map((p) => p.sold));
  const stepX = points.length > 1 ? (W - padL - padR) / (points.length - 1) : 0;

  const coords = points.map((p, idx) => {
    const x = padL + idx * stepX;
    const ratio = p.sold / maxVal;
    const y = padT + (1 - ratio) * (H - padT - padB);
    return { x, y, label: p.label, sold: p.sold };
  });

  const gridLines = [0.25, 0.5, 0.75, 1].map((r) => {
    const gy = padT + (1 - r) * (H - padT - padB);
    return `<line x1="${padL}" y1="${gy}" x2="${W - padR}" y2="${gy}" stroke="#262626" stroke-width="1"/>`;
  }).join('');

  const poly = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const dots = coords.map((c) => `
    <circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="4" fill="#c8102e">
      <title>${esc(c.label)}: ${c.sold} tiket</title>
    </circle>`).join('');

  const stepLabel = points.length > 10 ? 5 : 1;
  const labels = coords.map((c, i) => (i % stepLabel === 0 || i === coords.length - 1)
    ? `<text x="${c.x.toFixed(1)}" y="${H - 8}" fill="#888" font-size="10" text-anchor="middle">${esc(c.label)}</text>`
    : ''
  ).join('');

  svg.innerHTML = `${gridLines}
    <polyline fill="none" stroke="#c8102e" stroke-width="2.5" points="${poly}" />
    ${dots}${labels}`;
}

function renderQuotaList(cats) {
  const el = document.getElementById('quota-list');
  el.innerHTML = cats.map((c) => {
    const rem = Math.max(0, Number(c.quota) - Number(c.sold));
    const soldPct = c.quota > 0 ? Math.min(100, (c.sold / c.quota) * 100) : 100;
    const isSoldOut = rem === 0;
    const isLow = !isSoldOut && rem / c.quota <= 0.15;
    const rightTxt = isSoldOut
      ? `<span class="out">Sold out</span>`
      : `<span class="${isLow ? 'low' : 'muted'}">${rem.toLocaleString('id-ID')} / ${Number(c.quota).toLocaleString('id-ID')}</span>`;

    return `<div class="q-item">
      <div class="q-row"><span>${esc(c.name)}</span>${rightTxt}</div>
      <div class="bar-track"><div class="bar-fill ${isLow ? 'low' : ''}" style="width:${soldPct}%"></div></div>
    </div>`;
  }).join('');
}

function renderRecentOrders(orders) {
  const tbody = document.getElementById('recent-orders-body');
  if (!orders.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="muted">Belum ada transaksi masuk.</td></tr>`;
    return;
  }
  tbody.innerHTML = orders.map((o) => `
    <tr>
      <td>${esc(o.order_code)}</td>
      <td>${esc(o.buyer_name)}</td>
      <td>${rupiah(o.total)}</td>
      <td><span class="st-badge ${esc(o.status)}">${esc(o.status)}</span></td>
    </tr>`).join('');
}

function renderAnnouncements(list, keyword = '') {
  const q = (keyword || '').trim().toLowerCase();
  const filtered = q ? list.filter((a) => a.title.toLowerCase().includes(q)) : list;
  const el = document.getElementById('ann-list');

  if (!filtered.length) {
    el.innerHTML = `<p class="muted" style="font-size:13px">Tidak ada pengumuman yang cocok.</p>`;
    return;
  }

  el.innerHTML = filtered.slice(0, 4).map((a) => {
    const dt = a.published_at || a.created_at;
    const dateStr = dt ? new Date(dt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
    const st = a.is_published ? 'Published' : 'Draft';
    return `<div class="ann-item">
      <div class="ann-title">${esc(a.title)}</div>
      <div class="ann-meta">${dateStr} · ${st}</div>
    </div>`;
  }).join('');
}

function openAnnouncementModal() {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `
    <form class="modal modal-lg" id="ann-form">
      <h3>BUAT PENGUMUMAN BARU</h3>
      <div class="field">
        <label for="ann-title">Judul pengumuman</label>
        <input class="input" id="ann-title" placeholder="Contoh: Panduan masuk venue & penukaran tiket" required>
      </div>
      <div class="field">
        <label for="ann-content">Isi pengumuman</label>
        <textarea class="textarea" id="ann-content" placeholder="Tulis detail informasi untuk pengunjung konser..." required></textarea>
      </div>
      <label class="check">
        <input type="checkbox" id="ann-pub" checked>
        <span>Langsung terbitkan ke halaman Berita pengunjung</span>
      </label>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" id="ann-cancel">Batal</button>
        <button type="submit" class="btn btn-primary" id="ann-save">Simpan &amp; Terbitkan</button>
      </div>
    </form>`;

  ov.querySelector('#ann-cancel').onclick = () => ov.remove();
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };

  ov.querySelector('#ann-form').onsubmit = async (e) => {
    e.preventDefault();
    const title = ov.querySelector('#ann-title').value.trim();
    const content = ov.querySelector('#ann-content').value.trim();
    const isPub = ov.querySelector('#ann-pub').checked;
    const saveBtn = ov.querySelector('#ann-save');

    saveBtn.classList.add('is-loading');
    saveBtn.disabled = true;

    const res = await backend('create_announcement', [_adminUser.user_id, title, content, isPub], null);

    saveBtn.classList.remove('is-loading');
    saveBtn.disabled = false;

    if (!res || !res.ok) {
      toast((res && res.message) || 'Gagal menyimpan pengumuman.', 'error');
      return;
    }

    ov.remove();
    toast('Pengumuman berhasil disimpan!');
    await loadDashboardData();
  };

  document.body.appendChild(ov);
}