/* ----- Komponen Sidebar Terpusat ----- */
function renderAdminLayout(activeMenu) {
  const side = document.getElementById('admin-sidebar');
  if (!side) return;

  const admin = getAdminSession();
  const displayName = (admin && admin.full_name) || 'Admin Publikasi';

  const icoDash = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect></svg>`;
  const icoAnn = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l18-5v12L3 13v-2z"></path><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"></path></svg>`;
  const icoUser = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;

  const menus = [
    { id: 'dashboard', label: 'Dashboard', href: 'dashboard.html', icon: icoDash },
    { id: 'konser', label: '— Konser', href: 'concert.html' },
    { id: 'kategori', label: '— Kategori Tiket', href: 'categories.html' },
    { id: 'pesanan', label: '— Pesanan', href: 'orders.html' },
    { id: 'pembayaran', label: '— Pembayaran', href: 'payments.html' },
    { id: 'pengumuman', label: 'Pengumuman', action: 'ann', icon: icoAnn },
    { id: 'voucher', label: '— Voucher', locked: true },
    { id: 'checkin', label: '— Check-in', locked: true },
    { id: 'laporan', label: '— Laporan', locked: true },
    { id: 'pengguna', label: '— Pengguna', locked: true },
    { id: 'log', label: '— Log Aktivitas', locked: true }
  ];

  const navHtml = menus.map(m => {
    const cls = [
      'adm-nav-item',
      activeMenu === m.id ? 'active' : '',
      m.locked ? 'locked' : ''
    ].filter(Boolean).join(' ');
    const attrs = m.href ? `data-href="${m.href}"` : (m.action ? `data-action="${m.action}"` : '');
    return `<button type="button" class="${cls}" ${attrs}>${m.icon || ''}<span>${m.label}</span></button>`;
  }).join('');

  side.innerHTML = `
    <div class="adm-side-top">
      <div class="adm-logo-box">
        <div class="adm-logo">THE WEEKND</div>
        <div class="adm-sublogo">PANEL PANITIA / JAKARTA 2027</div>
      </div>

      <div class="adm-concert-pill">
        <div class="t" id="side-concert-title">AFTER HOURS TIL DAWN</div>
        <div class="d" id="side-concert-meta">14 Agu 2027 · On sale</div>
      </div>

      <nav class="adm-nav" aria-label="Menu Admin">${navHtml}</nav>
    </div>

    <div class="adm-side-bot">
      <p class="adm-hint">Seluruh modul admin · Prototype simulasi</p>
      <div class="adm-user">
        <div class="adm-user-ico">${icoUser}</div>
        <div>
          <div class="adm-user-name" id="side-admin-name">${esc(displayName)}</div>
          <div class="adm-user-role">Tim publikasi</div>
        </div>
      </div>
      <button type="button" class="adm-logout" id="admin-logout">Keluar</button>
    </div>`;

  // Pasang event navigasi & logout
  side.querySelectorAll('[data-href]').forEach(btn => {
    btn.onclick = () => { window.location.href = btn.dataset.href; };
  });
  side.querySelectorAll('.locked').forEach(btn => {
    btn.onclick = () => toast('Modul ini dijadwalkan pada tahap berikutnya.', 'warn');
  });
  const annBtn = side.querySelector('[data-action="ann"]');
  if (annBtn) {
    annBtn.onclick = () => {
      if (typeof openAnnouncementModal === 'function' && activeMenu === 'dashboard') {
        openAnnouncementModal();
      } else {
        window.location.href = 'dashboard.html';
      }
    };
  }
  const topName = document.getElementById('top-admin-name');
  if (topName) topName.textContent = displayName;

  document.getElementById('admin-logout').onclick = () => confirmModal({
    title: 'KELUAR PANEL PANITIA?',
    text: 'Sesi admin akan diakhiri.',
    yes: 'Keluar',
    onYes: async () => {
      await backend('admin_logout', [], null);
      Auth.clear();
      window.location.href = 'login.html';
    }
  });
}
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

  renderAdminLayout('dashboard');

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
/* ----- A3: Kelola Konser ----- */
async function initAdminConcert() {
  const admin = getAdminSession();
  if (!admin) { window.location.href = 'login.html'; return; }
  
 renderAdminLayout('konser');
  const res = await backend('get_admin_concert_detail', [admin.user_id], null);
  if (!res || !res.ok) { toast('Gagal memuat detail konser', 'error'); return; }

  const c = res.concert;
  const v = c.venues || {};
  
  document.getElementById('concert-title').textContent = c.title || 'THE WEEKND';
  document.getElementById('concert-desc').textContent = c.description || '-';
  document.getElementById('lbl-status').textContent = (c.status || 'on_sale').replace('_', ' ');
  document.getElementById('val-date').textContent = c.concert_date ? new Date(c.concert_date).toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'}) : '-';
  document.getElementById('val-gate').textContent = `${c.gate_open || '17:00'} / 20:00 WIB`;
  document.getElementById('val-venue').textContent = `${v.name || 'Venue'} · ${v.city || 'Jakarta'}`;
  document.getElementById('val-capacity').textContent = v.capacity ? `${Number(v.capacity).toLocaleString('id-ID')} penonton` : '15.500 penonton';

  document.getElementById('btn-go-edit').onclick = () => window.location.href = 'concert-edit.html';
  document.getElementById('btn-go-edit-2').onclick = () => window.location.href = 'concert-edit.html';
}

/* ----- A3e: Edit Konser ----- */
async function initAdminConcertEdit() {
  const admin = getAdminSession();
  if (!admin) { window.location.href = 'login.html'; return; }

renderAdminLayout('konser');
  const res = await backend('get_admin_concert_detail', [admin.user_id], null);
  if (!res || !res.ok) { toast('Gagal memuat data edit konser', 'error'); return; }

  const c = res.concert;
  const venues = res.venues || [];

  document.getElementById('f-title').value = c.title || '';
  document.getElementById('f-desc').value = c.description || '';
  document.getElementById('f-date').value = c.concert_date ? c.concert_date.substring(0, 10) : '';
  document.getElementById('f-gate').value = c.gate_open || '';
  document.getElementById('f-status').value = c.status || 'on_sale';

  const venueSelect = document.getElementById('f-venue');
  venueSelect.innerHTML = venues.map(v => `<option value="${v.venue_id}" ${v.venue_id === c.venue_id ? 'selected' : ''}>${esc(v.name)} · ${esc(v.city)}</option>`).join('');

  // Tombol Venue Baru
  // Tombol Venue Baru (Modal Form HTML Lengkap)
  document.getElementById('btn-new-venue').onclick = () => {
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `
      <form class="modal modal-lg" id="venue-form" novalidate>
        <h3>TAMBAH VENUE BARU</h3>
        <div class="field">
          <label for="v-name">Nama venue</label>
          <input class="input" id="v-name" placeholder="Contoh: Stadion Utama Gelora Bung Karno" required>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <div class="field">
            <label for="v-city">Kota</label>
            <input class="input" id="v-city" value="Jakarta" placeholder="Jakarta" required>
          </div>
          <div class="field">
            <label for="v-cap">Kapasitas penonton</label>
            <input class="input" id="v-cap" type="number" min="100" value="15000" required>
          </div>
        </div>
        <div class="field">
          <label for="v-addr">Alamat lengkap (opsional)</label>
          <input class="input" id="v-addr" placeholder="Jl. Pintu Satu Senayan, Jakarta Pusat">
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" id="v-cancel">Batal</button>
          <button type="submit" class="btn btn-primary" id="v-save">Simpan Venue</button>
        </div>
      </form>`;

    ov.querySelector('#v-cancel').onclick = () => ov.remove();
    ov.onclick = (e) => { if (e.target === ov) ov.remove(); };

    ov.querySelector('#venue-form').onsubmit = async (e) => {
      e.preventDefault();
      const name = ov.querySelector('#v-name').value.trim();
      const city = ov.querySelector('#v-city').value.trim() || 'Jakarta';
      const capacity = Number(ov.querySelector('#v-cap').value) || 15000;
      const address = ov.querySelector('#v-addr').value.trim();
      const saveBtn = ov.querySelector('#v-save');

      if (name.length < 3) {
        toast('Nama venue minimal 3 karakter.', 'error');
        return;
      }

      saveBtn.classList.add('is-loading');
      saveBtn.disabled = true;

      const addRes = await backend('create_venue', [admin.user_id, { name, city, capacity, address }], null);

      saveBtn.classList.remove('is-loading');
      saveBtn.disabled = false;

      if (!addRes || !addRes.ok) {
        toast((addRes && addRes.message) || 'Gagal menambah venue baru.', 'error');
        return;
      }

      // Masukkan venue baru langsung ke dropdown dan otomatis pilih
      const newVenue = addRes.venue || {};
      if (newVenue.venue_id) {
        const opt = document.createElement('option');
        opt.value = newVenue.venue_id;
        opt.textContent = `${newVenue.name} · ${newVenue.city}`;
        opt.selected = true;
        venueSelect.appendChild(opt);
        venueSelect.value = String(newVenue.venue_id);
      }

      ov.remove();
      toast('Venue baru berhasil ditambahkan dan dipilih!');
    };

    document.body.appendChild(ov);
    ov.querySelector('#v-name').focus();
  };
  // Submit form edit
  document.getElementById('concert-form').onsubmit = async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('btn-save');
    saveBtn.classList.add('is-loading');
    saveBtn.disabled = true;

    const payload = {
      concert_id: c.concert_id,
      title: document.getElementById('f-title').value,
      description: document.getElementById('f-desc').value,
      concert_date: document.getElementById('f-date').value + 'T20:00:00+07',
      gate_open: document.getElementById('f-gate').value,
      venue_id: Number(venueSelect.value),
      status: document.getElementById('f-status').value
    };

    const updateRes = await backend('update_concert_info', [admin.user_id, payload], null);
    saveBtn.classList.remove('is-loading');
    saveBtn.disabled = false;

    if (!updateRes || !updateRes.ok) {
      toast((updateRes && updateRes.message) || 'Gagal menyimpan perubahan.', 'error');
      return;
    }

    toast('Informasi konser berhasil disimpan!');
    setTimeout(() => window.location.href = 'concert.html', 1000);
  };
}
/* ----- A4: Kategori Tiket ----- */
let _catList = [];

async function initAdminCategories() {
  const admin = getAdminSession();
  if (!admin) { window.location.href = 'login.html'; return; }

  renderAdminLayout('kategori');

  document.getElementById('btn-add-cat').onclick = () => openCategoryModal(admin, null);
  document.getElementById('search-cat').addEventListener('input', (e) => {
    renderCategoryTable(admin, _catList, e.target.value);
  });

  await loadAdminCategories(admin);
}

async function loadAdminCategories(admin) {
  const res = await backend('get_admin_ticket_categories', [admin.user_id], null);
  if (!res || !res.ok) {
    toast((res && res.message) || 'Gagal memuat kategori tiket.', 'error');
    return;
  }
  _catList = res.categories || [];

  const totalQuota = _catList.reduce((acc, c) => acc + Number(c.quota || 0), 0);
  const totalSold = _catList.reduce((acc, c) => acc + Number(c.sold || 0), 0);
  const totalRem = Math.max(0, totalQuota - totalSold);

  document.getElementById('cat-total-quota').textContent = totalQuota.toLocaleString('id-ID');
  document.getElementById('cat-total-sold').textContent = totalSold.toLocaleString('id-ID');
  document.getElementById('cat-total-rem').textContent = totalRem.toLocaleString('id-ID');

  renderCategoryTable(admin, _catList, document.getElementById('search-cat').value);
}

function renderCategoryTable(admin, list, keyword = '') {
  const q = (keyword || '').trim().toLowerCase();
  const filtered = q ? list.filter(c => (c.name || '').toLowerCase().includes(q)) : list;
  const tbody = document.getElementById('cat-table-body');
  document.getElementById('cat-count-info').textContent = `Menampilkan ${filtered.length} data · Halaman 1 dari 1`;

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="muted">Tidak ada kategori tiket ditemukan.</td></tr>`;
    return;
  }

  const fmtRange = (s, e) => {
    if (!s && !e) return 'Belum dijadwalkan';
    const opts = { day: '2-digit', month: 'short', year: 'numeric' };
    const d1 = s ? new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) : '?';
    const d2 = e ? new Date(e).toLocaleDateString('id-ID', opts) : '?';
    return `${d1} – ${d2}`;
  };

  tbody.innerHTML = filtered.map(c => {
    const quota = Number(c.quota || 0);
    const sold = Number(c.sold || 0);
    const rem = Math.max(0, quota - sold);

    let statusHtml = '<span style="color:#22c55e">Tersedia</span>';
    if (quota === 0 && !c.sale_start) {
      statusHtml = '<span style="color:#f59e0b">Draft</span>';
    } else if (rem === 0) {
      statusHtml = '<span class="muted">Sold out</span>';
    } else if (quota > 0 && rem / quota <= 0.15) {
      statusHtml = '<span style="color:#f59e0b">Hampir habis</span>';
    }

    const canDelete = sold === 0;
    const delStyle = canDelete
      ? 'background:none;border:0;color:var(--text-2);font-size:12px;padding:0;text-align:left;cursor:pointer'
      : 'background:none;border:0;color:var(--text-2);opacity:0.45;font-size:12px;padding:0;text-align:left;cursor:not-allowed';

    return `
      <tr>
        <td style="font-weight:500">${esc(c.name)}</td>
        <td>${rupiah(c.price)}</td>
        <td>${quota.toLocaleString('id-ID')}</td>
        <td>${sold.toLocaleString('id-ID')}</td>
        <td>${rem.toLocaleString('id-ID')}</td>
        <td class="muted">${fmtRange(c.sale_start, c.sale_end)}</td>
        <td>${statusHtml}</td>
        <td>
          <div style="display:flex;flex-direction:column;gap:4px">
            <button type="button" class="cat-act-edit" data-id="${c.category_id}" style="background:none;border:0;color:var(--text);font-size:12px;padding:0;text-align:left;cursor:pointer">Edit</button>
            <button type="button" class="cat-act-del" data-id="${c.category_id}" data-name="${esc(c.name)}" data-sold="${sold}" style="${delStyle}">Hapus</button>
          </div>
        </td>
      </tr>`;
  }).join('');

  tbody.querySelectorAll('.cat-act-edit').forEach(btn => {
    btn.onclick = () => {
      const item = _catList.find(x => String(x.category_id) === btn.dataset.id);
      if (item) openCategoryModal(admin, item);
    };
  });

  tbody.querySelectorAll('.cat-act-del').forEach(btn => {
    btn.onclick = () => {
      const soldCount = Number(btn.dataset.sold || 0);
      if (soldCount > 0) {
        toast(`Kategori "${btn.dataset.name}" tidak dapat dihapus karena sudah terjual ${soldCount.toLocaleString('id-ID')} tiket.`, 'error');
        return;
      }
      confirmModal({
        title: `HAPUS KATEGORI ${btn.dataset.name.toUpperCase()}?`,
        text: 'Kategori ini belum memiliki penjualan dan akan dihapus permanen.',
        yes: 'Hapus',
        onYes: async () => {
          const res = await backend('delete_ticket_category', [admin.user_id, Number(btn.dataset.id)], null);
          if (!res || !res.ok) {
            toast((res && res.message) || 'Gagal menghapus kategori.', 'error');
            return;
          }
          toast('Kategori tiket berhasil dihapus.');
          await loadAdminCategories(admin);
        }
      });
    };
  });
}

function openCategoryModal(admin, item = null) {
  const isEdit = Boolean(item);
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `
    <form class="modal modal-lg" id="cat-form" novalidate>
      <h3>${isEdit ? 'EDIT KATEGORI TIKET' : 'TAMBAH KATEGORI BARU'}</h3>
      <div class="field">
        <label for="c-name">Nama kategori</label>
        <input class="input" id="c-name" value="${esc(item ? item.name : '')}" placeholder="Contoh: Early Access / VIP" required>
      </div>
      <div class="field">
        <label for="c-desc">Deskripsi area / fasilitas</label>
        <input class="input" id="c-desc" value="${esc(item ? (item.description || '') : '')}" placeholder="Contoh: Akses masuk lebih awal · area berdiri">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div class="field">
          <label for="c-price">Harga tiket (Rp)</label>
          <input class="input" id="c-price" type="number" min="0" step="1000" value="${item ? Number(item.price) : 750000}" required>
        </div>
        <div class="field">
          <label for="c-quota">Kuota tiket ${isEdit ? `(min. ${item.sold} terjual)` : ''}</label>
          <input class="input" id="c-quota" type="number" min="${isEdit ? item.sold : 0}" value="${item ? Number(item.quota) : 0}" required>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div class="field">
          <label for="c-start">Mulai penjualan (opsional)</label>
          <input class="input" id="c-start" type="date" value="${item && item.sale_start ? String(item.sale_start).substring(0, 10) : ''}">
        </div>
        <div class="field">
          <label for="c-end">Akhir penjualan (opsional)</label>
          <input class="input" id="c-end" type="date" value="${item && item.sale_end ? String(item.sale_end).substring(0, 10) : ''}">
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" id="c-cancel">Batal</button>
        <button type="submit" class="btn btn-primary" id="c-save">${isEdit ? 'Simpan Perubahan' : 'Simpan Kategori'}</button>
      </div>
    </form>`;

  ov.querySelector('#c-cancel').onclick = () => ov.remove();
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };

  ov.querySelector('#cat-form').onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
      category_id: item ? item.category_id : null,
      name: ov.querySelector('#c-name').value.trim(),
      description: ov.querySelector('#c-desc').value.trim(),
      price: Number(ov.querySelector('#c-price').value),
      quota: Number(ov.querySelector('#c-quota').value),
      sale_start: ov.querySelector('#c-start').value || null,
      sale_end: ov.querySelector('#c-end').value || null
    };

    const saveBtn = ov.querySelector('#c-save');
    saveBtn.classList.add('is-loading');
    saveBtn.disabled = true;

    const res = await backend('save_ticket_category', [admin.user_id, payload], null);

    saveBtn.classList.remove('is-loading');
    saveBtn.disabled = false;

    if (!res || !res.ok) {
      toast((res && res.message) || 'Gagal menyimpan kategori.', 'error');
      return;
    }

    ov.remove();
    toast(res.message || 'Kategori berhasil disimpan!');
    await loadAdminCategories(admin);
  };

  document.body.appendChild(ov);
  ov.querySelector('#c-name').focus();
}
/* ----- A5: Kelola Pesanan ----- */
let _allOrders = [];

async function initAdminOrders() {
  const admin = getAdminSession();
  if (!admin) { window.location.href = 'login.html'; return; }

  renderAdminLayout('pesanan');

  const res = await backend('get_admin_orders', [admin.user_id], null);
  if (!res || !res.ok) {
    toast((res && res.message) || 'Gagal memuat daftar pesanan.', 'error');
    return;
  }

  _allOrders = res.orders || [];
  const catSel = document.getElementById('ord-cat');
  (res.categories || []).forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.name;
    opt.textContent = c.name;
    catSel.appendChild(opt);
  });

  const applyFilter = () => renderOrdersTable();
  document.getElementById('ord-q').addEventListener('input', applyFilter);
  document.getElementById('top-search-ord').addEventListener('input', (e) => {
    document.getElementById('ord-q').value = e.target.value;
    applyFilter();
  });
  document.getElementById('ord-status').addEventListener('change', applyFilter);
  document.getElementById('ord-range').addEventListener('change', applyFilter);
  document.getElementById('ord-cat').addEventListener('change', applyFilter);

  document.getElementById('ord-reset').onclick = () => {
    document.getElementById('ord-q').value = '';
    document.getElementById('top-search-ord').value = '';
    document.getElementById('ord-status').value = '';
    document.getElementById('ord-range').value = 'all';
    document.getElementById('ord-cat').value = '';
    applyFilter();
  };

  document.getElementById('btn-export-csv').onclick = () => exportOrdersCsv(getFilteredOrders());

  renderOrdersTable();
}

function getFilteredOrders() {
  const q = document.getElementById('ord-q').value.trim().toLowerCase();
  const st = document.getElementById('ord-status').value;
  const rng = document.getElementById('ord-range').value;
  const cat = document.getElementById('ord-cat').value;
  const now = Date.now();

  return _allOrders.filter(o => {
    if (q && !o.order_code.toLowerCase().includes(q) && !o.buyer_name.toLowerCase().includes(q)) return false;
    if (st && o.status !== st) return false;
    if (cat && !(o.categories || []).includes(cat)) return false;
    if (rng !== 'all' && o.created_at) {
      const diffDays = (now - new Date(o.created_at).getTime()) / 86400000;
      if (diffDays > Number(rng)) return false;
    }
    return true;
  });
}

function renderOrdersTable() {
  const list = getFilteredOrders();
  const tbody = document.getElementById('ord-table-body');
  document.getElementById('ord-count-info').textContent = `Menampilkan ${list.length} data · Halaman 1 dari 1`;

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">Tidak ada pesanan yang cocok dengan filter.</td></tr>`;
    return;
  }

  const badge = (s) => {
    const map = {
      paid: '<span style="color:#22c55e">Paid</span>',
      pending: '<span style="color:#f59e0b">Pending</span>',
      expired: '<span class="muted">Expired</span>',
      cancelled: '<span style="color:#ef4444">Cancelled</span>'
    };
    return map[s] || esc(s);
  };

  tbody.innerHTML = list.map(o => `
    <tr>
      <td style="font-weight:500">${esc(o.order_code)}</td>
      <td>${esc(o.buyer_name)}</td>
      <td>${Number(o.total_tickets)}</td>
      <td>${rupiah(o.total_amount)}</td>
      <td>${badge(o.status)}</td>
      <td><a href="order-detail.html?id=${o.order_id}" style="color:var(--text);font-size:13px">Detail →</a></td>
    </tr>`).join('');
}

function exportOrdersCsv(list) {
  if (!list.length) { toast('Tidak ada data untuk diexport.', 'warn'); return; }
  const rows = [['Kode Pesanan', 'Pembeli', 'Email', 'Jumlah Tiket', 'Total', 'Status', 'Tanggal']];
  list.forEach(o => rows.push([o.order_code, o.buyer_name, o.buyer_email, o.total_tickets, o.total_amount, o.status, o.created_at || '']));
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `pesanan-the-weeknd-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  toast('File CSV pesanan berhasil diunduh.');
}

/* ----- A6 & A6p: Detail Pesanan ----- */
async function initAdminOrderDetail() {
  const admin = getAdminSession();
  if (!admin) { window.location.href = 'login.html'; return; }

  renderAdminLayout('pesanan');

  // 👇 JANGAN dibungkus Number(), biarkan string agar mendukung UUID maupun integer
  const orderId = new URLSearchParams(window.location.search).get('id');
  if (!orderId) { window.location.href = 'orders.html'; return; }

  const loadDetail = async () => {
    const res = await backend('get_admin_order_detail', [admin.user_id, orderId], null);
    // ... sisa kode berikutnya sama ...
    if (!res || !res.ok) {
      toast((res && res.message) || 'Gagal memuat detail pesanan.', 'error');
      return;
    }

    const o = res.order;
    const u = o.users || {};
    const items = res.items || [];
    const tickets = res.tickets || [];
    const pay = res.payment;

    document.getElementById('det-code').textContent = o.order_code;
    const dt = o.created_at ? new Date(o.created_at) : new Date();
    document.getElementById('det-created').textContent = `Dibuat ${dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} · ${dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':')} WIB`;

    const stColors = { paid: '#22c55e', pending: '#f59e0b', cancelled: '#ef4444', expired: '#888' };
    const stEl = document.getElementById('det-status-badge');
    stEl.textContent = o.status.charAt(0).toUpperCase() + o.status.slice(1);
    stEl.style.color = stColors[o.status] || '#fff';

    // Rincian item pesanan
    const firstItem = items[0] || {};
    const catName = (firstItem.ticket_categories || {}).name || 'Tiket';
    const qtySum = items.reduce((a, b) => a + Number(b.quantity || 0), 0);
    const unitPrice = Number((firstItem.ticket_categories || {}).price || 0);
    const subtotal = items.reduce((a, b) => a + Number(b.subtotal || 0), 0);
    const disc = Number(o.discount_amount || 0);

    document.getElementById('det-items-summary').innerHTML = `
      <div style="display:flex;justify-content:space-between"><span class="muted">Kategori / jumlah</span><strong>${esc(catName)} × ${qtySum}</strong></div>
      <div style="display:flex;justify-content:space-between"><span class="muted">Harga satuan</span><strong>${rupiah(unitPrice)}</strong></div>
      <div style="display:flex;justify-content:space-between"><span class="muted">Subtotal</span><strong>${rupiah(subtotal)}</strong></div>
      <div style="display:flex;justify-content:space-between"><span class="muted">Voucher / diskon</span><strong>${disc > 0 ? '−' + rupiah(disc) : '— / Rp0'}</strong></div>`;
    document.getElementById('det-total').textContent = rupiah(o.total_amount);

    // Pembeli & Aksi Status
    document.getElementById('det-buyer-name').textContent = u.full_name || 'Pengunjung';
    document.getElementById('det-buyer-email').textContent = u.email || '-';
    document.getElementById('det-buyer-phone').textContent = u.phone || '-';

    const sel = document.getElementById('det-status-select');
    const mainBtn = document.getElementById('det-main-action');
    const hintEl = document.getElementById('det-action-hint');

    const updateStatus = async (targetStatus, title, text) => {
      confirmModal({
        title,
        text,
        yes: 'Ya, Lanjutkan',
        onYes: async () => {
          mainBtn.classList.add('is-loading');
          mainBtn.disabled = true;
          const upRes = await backend('admin_update_order_status', [admin.user_id, orderId, targetStatus], null);
          mainBtn.classList.remove('is-loading');
          mainBtn.disabled = false;
          if (!upRes || !upRes.ok) {
            toast((upRes && upRes.message) || 'Gagal mengubah status.', 'error');
            return;
          }
          toast(upRes.message);
          await loadDetail();
        }
      });
    };

    if (o.status === 'pending') {
      mainBtn.textContent = 'Verifikasi Pembayaran';
      hintEl.textContent = 'Menyetujui pembayaran akan otomatis menerbitkan e-ticket.';
      mainBtn.onclick = () => {
        const chosen = sel.value || 'paid';
        updateStatus(chosen, `UBAH STATUS KE ${chosen.toUpperCase()}?`, 'Perubahan status akan memperbarui tiket dan kuota secara otomatis.');
      };
    } else if (o.status === 'paid') {
      mainBtn.textContent = 'Batalkan Tiket';
      hintEl.textContent = 'Pembatalan memerlukan konfirmasi dan mengembalikan kuota.';
      mainBtn.onclick = () => {
        const chosen = sel.value || 'cancelled';
        updateStatus(chosen, `UBAH STATUS KE ${chosen.toUpperCase()}?`, 'Pembatalan akan menonaktifkan e-ticket dan mengembalikan kuota ke kategori.');
      };
    } else {
      mainBtn.textContent = 'Simpan Perubahan Status';
      hintEl.textContent = 'Pilih status baru pada dropdown di atas bila diperlukan.';
      mainBtn.onclick = () => {
        if (!sel.value) { toast('Pilih status baru terlebih dahulu.', 'warn'); return; }
        updateStatus(sel.value, `UBAH STATUS KE ${sel.value.toUpperCase()}?`, 'Status pesanan akan diperbarui di database.');
      };
    }

    // Tabel Tiket / Pemegang
    document.getElementById('det-ticket-count').textContent = `Menampilkan ${tickets.length} data · Halaman 1 dari 1`;
    const tBody = document.getElementById('det-tickets-body');
    if (!tickets.length) {
      tBody.innerHTML = `<tr><td colspan="4" class="muted">Belum ada data pemegang tiket.</td></tr>`;
    } else {
      tBody.innerHTML = tickets.map(t => {
        const isPendingTicket = o.status === 'pending' || !t.ticket_code || String(t.ticket_code).includes('PENDING');
        const codeLabel = isPendingTicket ? 'Belum diterbitkan' : esc(t.ticket_code);
        const stLabel = o.status === 'pending'
          ? '<span style="color:#f59e0b">Pending</span>'
          : (t.status === 'valid' ? '<span style="color:#22c55e">Valid</span>' : `<span class="muted">${esc(t.status)}</span>`);
        return `
          <tr>
            <td style="font-weight:500">${codeLabel}</td>
            <td>${esc(t.holder_name || u.full_name || '-')}</td>
            <td>${esc((t.ticket_categories || {}).name || catName)}</td>
            <td>${stLabel}</td>
          </tr>`;
      }).join('');
    }

    // Riwayat Pembayaran
    if (pay) {
      document.getElementById('det-pay-ref').textContent = `${pay.reference_code || 'PAY-' + orderId} / ${pay.method || 'Virtual Account'}`;
      if (o.status === 'paid' || pay.status === 'success') {
        const pDate = pay.paid_at ? new Date(pay.paid_at).toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' WIB' : '';
        document.getElementById('det-pay-status').textContent = `Success${pDate ? ' · ' + pDate : ''}`;
        document.getElementById('det-pay-note').textContent = `${tickets.length} e-ticket sudah diterbitkan untuk pemegang di atas.`;
      } else {
        document.getElementById('det-pay-status').textContent = 'Pending · Menunggu verifikasi';
        document.getElementById('det-pay-note').textContent = 'Tiket dibuat setelah pembayaran disetujui.';
      }
    } else {
      document.getElementById('det-pay-ref').textContent = `PAY-${String(orderId).padStart(4, '0')} / Transfer`;
      document.getElementById('det-pay-status').textContent = o.status === 'paid' ? 'Success' : 'Pending · Menunggu verifikasi';
      document.getElementById('det-pay-note').textContent = o.status === 'paid' ? 'E-ticket telah diterbitkan.' : 'Tiket dibuat setelah pembayaran disetujui.';
    }
  };

  await loadDetail();
}
/* ----- A7: Pembayaran & Verifikasi ----- */
let _allPayments = [];

async function initAdminPayments() {
  const admin = getAdminSession();
  if (!admin) { window.location.href = 'login.html'; return; }

  renderAdminLayout('pembayaran');

  document.getElementById('pay-q').addEventListener('input', renderPaymentsTable);
  document.getElementById('top-search-pay').addEventListener('input', (e) => {
    document.getElementById('pay-q').value = e.target.value;
    renderPaymentsTable();
  });
  document.getElementById('pay-status').addEventListener('change', renderPaymentsTable);
  document.getElementById('pay-method').addEventListener('change', renderPaymentsTable);

  await loadAdminPayments(admin);
}

async function loadAdminPayments(admin) {
  const res = await backend('get_admin_payments', [admin.user_id], null);
  if (!res || !res.ok) {
    toast((res && res.message) || 'Gagal memuat data pembayaran.', 'error');
    return;
  }

  _allPayments = res.payments || [];

  // Isi opsi metode pembayaran unik ke dropdown
  const methodSel = document.getElementById('pay-method');
  const currentVal = methodSel.value;
  const methods = [...new Set(_allPayments.map(p => p.method).filter(Boolean))];
  methodSel.innerHTML = `<option value="">Semua metode</option>` +
    methods.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('');
  methodSel.value = currentVal;

  renderPaymentsTable();
}

function renderPaymentsTable() {
  const admin = getAdminSession();
  const q = document.getElementById('pay-q').value.trim().toLowerCase();
  const st = document.getElementById('pay-status').value;
  const mtd = document.getElementById('pay-method').value;

  const filtered = _allPayments.filter(p => {
    if (
      q &&
      !p.reference_code.toLowerCase().includes(q) &&
      !p.order_code.toLowerCase().includes(q) &&
      !(p.buyer_name || '').toLowerCase().includes(q)
    ) return false;
    if (st && p.status !== st) return false;
    if (mtd && p.method !== mtd) return false;
    return true;
  });

  const tbody = document.getElementById('pay-table-body');
  document.getElementById('pay-count-info').textContent = `Menampilkan ${filtered.length} data · Halaman 1 dari 1`;

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="muted">Tidak ada transaksi pembayaran yang cocok.</td></tr>`;
    return;
  }

  const formatTime = (iso) => {
    if (!iso) return '-';
    const d = new Date(iso);
    const tgl = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
    const jam = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
    return `${tgl} · ${jam}`;
  };

  const statusHtml = (s) => {
    if (s === 'success') return `<span style="color:#22c55e">success</span>`;
    if (s === 'failed') return `<span style="color:#ef4444">failed</span>`;
    return `<span style="color:#f59e0b">${esc(s)}</span>`;
  };

  tbody.innerHTML = filtered.map(p => {
    const isPending = p.status === 'pending';
    const actionEl = isPending
      ? `<button type="button" class="pay-act-verify" data-id="${p.payment_id}" style="background:none;border:0;color:var(--text);font-size:13px;padding:0;cursor:pointer;font-weight:500">Verifikasi</button>`
      : `<div style="display:flex;gap:12px;align-items:center">
           <a href="order-detail.html?id=${p.order_id}" style="color:var(--text);font-size:13px">Detail</a>
           <button type="button" class="pay-act-verify" data-id="${p.payment_id}" style="background:none;border:0;color:var(--text-2);font-size:12px;padding:0;cursor:pointer">Verifikasi</button>
         </div>`;

    return `
      <tr>
        <td style="font-weight:500">${esc(p.reference_code)}</td>
        <td style="font-weight:500">${esc(p.order_code)}</td>
        <td>${esc(p.buyer_name)}</td>
        <td class="muted">${esc(p.method)}</td>
        <td>${rupiah(p.amount)}</td>
        <td>${statusHtml(p.status)}</td>
        <td class="muted">${formatTime(p.created_at)}</td>
        <td>${actionEl}</td>
      </tr>`;
  }).join('');

  tbody.querySelectorAll('.pay-act-verify').forEach(btn => {
    btn.onclick = () => {
      const item = _allPayments.find(x => String(x.payment_id) === btn.dataset.id);
      if (item) openVerifyPaymentModal(admin, item);
    };
  });
}

function openVerifyPaymentModal(admin, pay) {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `
    <form class="modal modal-lg" id="verify-pay-form" novalidate>
      <h3>VERIFIKASI PEMBAYARAN · ${esc(pay.reference_code)}</h3>
      <div style="display:flex;flex-direction:column;gap:8px;font-size:13px;padding:12px;border-radius:8px;background:var(--raised);border:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between"><span class="muted">Kode Pesanan</span><strong>${esc(pay.order_code)}</strong></div>
        <div style="display:flex;justify-content:space-between"><span class="muted">Pembeli</span><strong>${esc(pay.buyer_name)}</strong></div>
        <div style="display:flex;justify-content:space-between"><span class="muted">Metode</span><strong>${esc(pay.method)}</strong></div>
        <div style="display:flex;justify-content:space-between"><span class="muted">Nominal</span><strong>${rupiah(pay.amount)}</strong></div>
      </div>

      <div class="field">
        <label for="v-decision">Keputusan verifikasi</label>
        <select class="input" id="v-decision" style="background:var(--raised);cursor:pointer">
          <option value="approve">Setujui Pembayaran (Terbitkan E-Ticket)</option>
          <option value="reject">Tolak Pembayaran (Wajib Isi Alasan)</option>
        </select>
      </div>

      <div class="field" id="v-reason-wrap" hidden>
        <label for="v-reason">Alasan penolakan</label>
        <input class="input" id="v-reason" placeholder="Contoh: nominal pembayaran tidak sesuai">
      </div>

      <div class="modal-actions">
        <button type="button" class="btn btn-outline" id="v-cancel">Batal</button>
        <button type="submit" class="btn btn-primary" id="v-submit">Simpan Keputusan</button>
      </div>
    </form>`;

  const decSel = ov.querySelector('#v-decision');
  const reasonWrap = ov.querySelector('#v-reason-wrap');
  const reasonInput = ov.querySelector('#v-reason');

  decSel.onchange = () => {
    reasonWrap.hidden = decSel.value !== 'reject';
    if (!reasonWrap.hidden) reasonInput.focus();
  };

  ov.querySelector('#v-cancel').onclick = () => ov.remove();
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };

  ov.querySelector('#verify-pay-form').onsubmit = async (e) => {
    e.preventDefault();
    const decision = decSel.value;
    const reason = reasonInput.value.trim();

    if (decision === 'reject' && reason.length < 3) {
      toast('Penolakan wajib disertai alasan.', 'error');
      reasonInput.focus();
      return;
    }

    const submitBtn = ov.querySelector('#v-submit');
    submitBtn.classList.add('is-loading');
    submitBtn.disabled = true;

    const res = await backend('admin_verify_payment', [admin.user_id, pay.payment_id, decision, reason], null);

    submitBtn.classList.remove('is-loading');
    submitBtn.disabled = false;

    if (!res || !res.ok) {
      toast((res && res.message) || 'Gagal memproses verifikasi.', 'error');
      return;
    }

    ov.remove();

    // Tampilkan banner notifikasi di atas judul halaman sesuai desain A7
    const banner = document.getElementById('pay-feedback-banner');
    if (banner) {
      banner.hidden = false;
      banner.textContent = res.message;
      if (res.type === 'error') {
        banner.style.color = '#ef4444';
        banner.style.borderColor = 'rgba(239, 68, 68, 0.35)';
      } else {
        banner.style.color = '#22c55e';
        banner.style.borderColor = 'rgba(34, 197, 94, 0.35)';
      }
    }

    toast(res.message, res.type === 'error' ? 'error' : 'success');
    await loadAdminPayments(admin);
  };

  document.body.appendChild(ov);
}