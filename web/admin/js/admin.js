/* ----- Komponen Sidebar Terpusat ----- */
function renderAdminLayout(activeMenu) {
  const side = document.getElementById("admin-sidebar");
  if (!side) return;

  const admin = getAdminSession();
  const displayName = (admin && admin.full_name) || "Admin Publikasi";

  const icoDash = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect></svg>`;
  const icoAnn = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l18-5v12L3 13v-2z"></path><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"></path></svg>`;
  const icoUser = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;

  const menus = [
    {
      id: "dashboard",
      label: "Dashboard",
      href: "dashboard.html",
      icon: icoDash,
    },
    { id: "konser", label: "— Konser", href: "concert.html" },
    { id: "kategori", label: "— Kategori Tiket", href: "categories.html" },
    { id: "pesanan", label: "— Pesanan", locked: true },
    { id: "pembayaran", label: "— Pembayaran", locked: true },
    { id: "pengumuman", label: "Pengumuman", action: "ann", icon: icoAnn },
    {
      id: "voucher",
      label: "— Voucher",
      href: "voucher.html",
    },
    { id: "checkin", label: "— Check-in", locked: true },
    { id: "laporan", label: "— Laporan", locked: true },
    { id: "pengguna", label: "— Pengguna", locked: true },
    { id: "log", label: "— Log Aktivitas", locked: true },
  ];

  const navHtml = menus
    .map((m) => {
      const cls = [
        "adm-nav-item",
        activeMenu === m.id ? "active" : "",
        m.locked ? "locked" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const attrs = m.href
        ? `data-href="${m.href}"`
        : m.action
          ? `data-action="${m.action}"`
          : "";
      return `<button type="button" class="${cls}" ${attrs}>${m.icon || ""}<span>${m.label}</span></button>`;
    })
    .join("");

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
  side.querySelectorAll("[data-href]").forEach((btn) => {
    btn.onclick = () => {
      window.location.href = btn.dataset.href;
    };
  });
  side.querySelectorAll(".locked").forEach((btn) => {
    btn.onclick = () =>
      toast("Modul ini dijadwalkan pada tahap berikutnya.", "warn");
  });
  const annBtn = side.querySelector('[data-action="ann"]');
  if (annBtn) {
    annBtn.onclick = () => {
      if (
        typeof openAnnouncementModal === "function" &&
        activeMenu === "dashboard"
      ) {
        openAnnouncementModal();
      } else {
        window.location.href = "dashboard.html";
      }
    };
  }
  const topName = document.getElementById("top-admin-name");
  if (topName) topName.textContent = displayName;

  document.getElementById("admin-logout").onclick = () =>
    confirmModal({
      title: "KELUAR PANEL PANITIA?",
      text: "Sesi admin akan diakhiri.",
      yes: "Keluar",
      onYes: async () => {
        await backend("admin_logout", [], null);
        Auth.clear();
        window.location.href = "login.html";
      },
    });
}
/* ===== Admin Panel Logic (A1 Login & A2 Dashboard) ===== */
let _adminUser = null;
let _dashData = null;
let _activeDays = 7;

function getAdminSession() {
  const u = Auth.get();
  return u && u.role === "admin" ? u : null;
}

/* ----- A1: Login Admin ----- */
function initAdminLogin() {
  if (getAdminSession()) {
    window.location.href = "dashboard.html";
    return;
  }

  const form = document.getElementById("admin-login-form");
  const emailEl = document.getElementById("email");
  const passEl = document.getElementById("password");
  const banner = document.getElementById("admin-banner");
  const btn = document.getElementById("admin-submit");

  document.getElementById("toggle-pw").onclick = () => {
    passEl.type = passEl.type === "password" ? "text" : "password";
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    banner.hidden = true;

    const email = emailEl.value.trim().toLowerCase();
    const password = passEl.value;

    if (!email || !password) {
      banner.textContent = "Email dan password admin wajib diisi.";
      banner.hidden = false;
      return;
    }

    btn.classList.add("is-loading");
    btn.disabled = true;

    const res = await backend("admin_login", [email, password], null);

    btn.classList.remove("is-loading");
    btn.disabled = false;

    if (!res) {
      banner.textContent =
        "Server Python (Eel) belum aktif. Jalankan python main.py.";
      banner.hidden = false;
      return;
    }
    if (!res.ok) {
      banner.textContent = res.message || "Gagal masuk ke Panel Panitia.";
      banner.hidden = false;
      return;
    }

    Auth.set(res.user);
    window.location.href = "dashboard.html";
  });
}

/* ----- A2: Dashboard Publikasi ----- */
async function initAdminDashboard() {
  _adminUser = getAdminSession();
  if (!_adminUser) {
    window.location.href = "login.html";
    return;
  }

  renderAdminLayout("dashboard");

  // Filter 7 hari / 30 hari
  document.querySelectorAll("#chart-range button").forEach((btn) => {
    btn.onclick = () => {
      document
        .querySelectorAll("#chart-range button")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      _activeDays = Number(btn.dataset.days) || 7;
      loadDashboardData();
    };
  });

  // Pencarian pengumuman
  document.getElementById("search-ann").addEventListener("input", (e) => {
    if (_dashData)
      renderAnnouncements(_dashData.announcements || [], e.target.value);
  });

  // Modal buat pengumuman
  document.getElementById("btn-new-ann").onclick = openAnnouncementModal;
  document.getElementById("btn-manage-ann").onclick = openAnnouncementModal;

  await loadDashboardData();
}

async function loadDashboardData() {
  const res = await backend(
    "get_admin_dashboard",
    [_adminUser.user_id, _activeDays],
    null,
  );
  if (!res || !res.ok) {
    toast(
      (res && res.message) || "Gagal memuat data dashboard dari Supabase.",
      "error",
    );
    return;
  }

  _dashData = res;
  const now = new Date();
  const tgl = now.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const jam = now
    .toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
    .replace(".", ":");
  document.getElementById("dash-timestamp").textContent =
    `Ringkasan per ${tgl} · ${jam} WIB`;

  // KPI
  const k = res.kpi;
  document.getElementById("kpi-sold").textContent = Number(
    k.total_sold,
  ).toLocaleString("id-ID");
  document.getElementById("kpi-sold-sub").textContent =
    `dari ${Number(k.total_quota).toLocaleString("id-ID")} tiket · ${String(k.sold_pct).replace(".", ",")}%`;
  document.getElementById("kpi-rev").textContent = k.revenue_short;
  document.getElementById("kpi-rev-sub").textContent =
    `${rupiah(k.total_revenue)} · Lunas`;
  document.getElementById("kpi-pending").textContent = Number(
    k.pending_count,
  ).toLocaleString("id-ID");
  document.getElementById("kpi-checkin").textContent = Number(
    k.checked_in,
  ).toLocaleString("id-ID");

  // Chart
  document.getElementById("chart-sub").textContent =
    `${Number(res.chart_total).toLocaleString("id-ID")} tiket / ${_activeDays} hari terakhir`;
  renderSalesChart(res.chart || []);

  // Quota
  document.getElementById("quota-sub").textContent =
    `${Number(k.remaining_total).toLocaleString("id-ID")} tiket masih tersedia`;
  renderQuotaList(res.categories || []);

  // Orders
  renderRecentOrders(res.recent_orders || []);

  // Announcements
  renderAnnouncements(
    res.announcements || [],
    document.getElementById("search-ann").value,
  );
}

function renderSalesChart(points) {
  const svg = document.getElementById("sales-chart");
  if (!points.length) {
    svg.innerHTML = "";
    return;
  }
  const W = 640,
    H = 210,
    padL = 16,
    padR = 16,
    padT = 20,
    padB = 34;
  const maxVal = Math.max(5, ...points.map((p) => p.sold));
  const stepX = points.length > 1 ? (W - padL - padR) / (points.length - 1) : 0;

  const coords = points.map((p, idx) => {
    const x = padL + idx * stepX;
    const ratio = p.sold / maxVal;
    const y = padT + (1 - ratio) * (H - padT - padB);
    return { x, y, label: p.label, sold: p.sold };
  });

  const gridLines = [0.25, 0.5, 0.75, 1]
    .map((r) => {
      const gy = padT + (1 - r) * (H - padT - padB);
      return `<line x1="${padL}" y1="${gy}" x2="${W - padR}" y2="${gy}" stroke="#262626" stroke-width="1"/>`;
    })
    .join("");

  const poly = coords
    .map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(" ");
  const dots = coords
    .map(
      (c) => `
    <circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="4" fill="#c8102e">
      <title>${esc(c.label)}: ${c.sold} tiket</title>
    </circle>`,
    )
    .join("");

  const stepLabel = points.length > 10 ? 5 : 1;
  const labels = coords
    .map((c, i) =>
      i % stepLabel === 0 || i === coords.length - 1
        ? `<text x="${c.x.toFixed(1)}" y="${H - 8}" fill="#888" font-size="10" text-anchor="middle">${esc(c.label)}</text>`
        : "",
    )
    .join("");

  svg.innerHTML = `${gridLines}
    <polyline fill="none" stroke="#c8102e" stroke-width="2.5" points="${poly}" />
    ${dots}${labels}`;
}

function renderQuotaList(cats) {
  const el = document.getElementById("quota-list");
  el.innerHTML = cats
    .map((c) => {
      const rem = Math.max(0, Number(c.quota) - Number(c.sold));
      const soldPct =
        c.quota > 0 ? Math.min(100, (c.sold / c.quota) * 100) : 100;
      const isSoldOut = rem === 0;
      const isLow = !isSoldOut && rem / c.quota <= 0.15;
      const rightTxt = isSoldOut
        ? `<span class="out">Sold out</span>`
        : `<span class="${isLow ? "low" : "muted"}">${rem.toLocaleString("id-ID")} / ${Number(c.quota).toLocaleString("id-ID")}</span>`;

      return `<div class="q-item">
      <div class="q-row"><span>${esc(c.name)}</span>${rightTxt}</div>
      <div class="bar-track"><div class="bar-fill ${isLow ? "low" : ""}" style="width:${soldPct}%"></div></div>
    </div>`;
    })
    .join("");
}

function renderRecentOrders(orders) {
  const tbody = document.getElementById("recent-orders-body");
  if (!orders.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="muted">Belum ada transaksi masuk.</td></tr>`;
    return;
  }
  tbody.innerHTML = orders
    .map(
      (o) => `
    <tr>
      <td>${esc(o.order_code)}</td>
      <td>${esc(o.buyer_name)}</td>
      <td>${rupiah(o.total)}</td>
      <td><span class="st-badge ${esc(o.status)}">${esc(o.status)}</span></td>
    </tr>`,
    )
    .join("");
}

function renderAnnouncements(list, keyword = "") {
  const q = (keyword || "").trim().toLowerCase();
  const filtered = q
    ? list.filter((a) => a.title.toLowerCase().includes(q))
    : list;
  const el = document.getElementById("ann-list");

  if (!filtered.length) {
    el.innerHTML = `<p class="muted" style="font-size:13px">Tidak ada pengumuman yang cocok.</p>`;
    return;
  }

  el.innerHTML = filtered
    .slice(0, 4)
    .map((a) => {
      const dt = a.published_at || a.created_at;
      const dateStr = dt
        ? new Date(dt).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "-";
      const st = a.is_published ? "Published" : "Draft";
      return `<div class="ann-item">
      <div class="ann-title">${esc(a.title)}</div>
      <div class="ann-meta">${dateStr} · ${st}</div>
    </div>`;
    })
    .join("");
}

function openAnnouncementModal() {
  const ov = document.createElement("div");
  ov.className = "overlay";
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

  ov.querySelector("#ann-cancel").onclick = () => ov.remove();
  ov.onclick = (e) => {
    if (e.target === ov) ov.remove();
  };

  ov.querySelector("#ann-form").onsubmit = async (e) => {
    e.preventDefault();
    const title = ov.querySelector("#ann-title").value.trim();
    const content = ov.querySelector("#ann-content").value.trim();
    const isPub = ov.querySelector("#ann-pub").checked;
    const saveBtn = ov.querySelector("#ann-save");

    saveBtn.classList.add("is-loading");
    saveBtn.disabled = true;

    const res = await backend(
      "create_announcement",
      [_adminUser.user_id, title, content, isPub],
      null,
    );

    saveBtn.classList.remove("is-loading");
    saveBtn.disabled = false;

    if (!res || !res.ok) {
      toast((res && res.message) || "Gagal menyimpan pengumuman.", "error");
      return;
    }

    ov.remove();
    toast("Pengumuman berhasil disimpan!");
    await loadDashboardData();
  };

  document.body.appendChild(ov);
}
/* ----- A3: Kelola Konser ----- */
async function initAdminConcert() {
  const admin = getAdminSession();
  if (!admin) {
    window.location.href = "login.html";
    return;
  }

  renderAdminLayout("konser");
  const res = await backend("get_admin_concert_detail", [admin.user_id], null);
  if (!res || !res.ok) {
    toast("Gagal memuat detail konser", "error");
    return;
  }

  const c = res.concert;
  const v = c.venues || {};

  document.getElementById("concert-title").textContent =
    c.title || "THE WEEKND";
  document.getElementById("concert-desc").textContent = c.description || "-";
  document.getElementById("lbl-status").textContent = (
    c.status || "on_sale"
  ).replace("_", " ");
  document.getElementById("val-date").textContent = c.concert_date
    ? new Date(c.concert_date).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "-";
  document.getElementById("val-gate").textContent =
    `${c.gate_open || "17:00"} / 20:00 WIB`;
  document.getElementById("val-venue").textContent =
    `${v.name || "Venue"} · ${v.city || "Jakarta"}`;
  document.getElementById("val-capacity").textContent = v.capacity
    ? `${Number(v.capacity).toLocaleString("id-ID")} penonton`
    : "15.500 penonton";

  document.getElementById("btn-go-edit").onclick = () =>
    (window.location.href = "concert-edit.html");
  document.getElementById("btn-go-edit-2").onclick = () =>
    (window.location.href = "concert-edit.html");
}

/* ----- A3e: Edit Konser ----- */
async function initAdminConcertEdit() {
  const admin = getAdminSession();
  if (!admin) {
    window.location.href = "login.html";
    return;
  }

  renderAdminLayout("konser");
  const res = await backend("get_admin_concert_detail", [admin.user_id], null);
  if (!res || !res.ok) {
    toast("Gagal memuat data edit konser", "error");
    return;
  }

  const c = res.concert;
  const venues = res.venues || [];

  document.getElementById("f-title").value = c.title || "";
  document.getElementById("f-desc").value = c.description || "";
  document.getElementById("f-date").value = c.concert_date
    ? c.concert_date.substring(0, 10)
    : "";
  document.getElementById("f-gate").value = c.gate_open || "";
  document.getElementById("f-status").value = c.status || "on_sale";

  const venueSelect = document.getElementById("f-venue");
  venueSelect.innerHTML = venues
    .map(
      (v) =>
        `<option value="${v.venue_id}" ${v.venue_id === c.venue_id ? "selected" : ""}>${esc(v.name)} · ${esc(v.city)}</option>`,
    )
    .join("");

  // Tombol Venue Baru
  // Tombol Venue Baru (Modal Form HTML Lengkap)
  document.getElementById("btn-new-venue").onclick = () => {
    const ov = document.createElement("div");
    ov.className = "overlay";
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

    ov.querySelector("#v-cancel").onclick = () => ov.remove();
    ov.onclick = (e) => {
      if (e.target === ov) ov.remove();
    };

    ov.querySelector("#venue-form").onsubmit = async (e) => {
      e.preventDefault();
      const name = ov.querySelector("#v-name").value.trim();
      const city = ov.querySelector("#v-city").value.trim() || "Jakarta";
      const capacity = Number(ov.querySelector("#v-cap").value) || 15000;
      const address = ov.querySelector("#v-addr").value.trim();
      const saveBtn = ov.querySelector("#v-save");

      if (name.length < 3) {
        toast("Nama venue minimal 3 karakter.", "error");
        return;
      }

      saveBtn.classList.add("is-loading");
      saveBtn.disabled = true;

      const addRes = await backend(
        "create_venue",
        [admin.user_id, { name, city, capacity, address }],
        null,
      );

      saveBtn.classList.remove("is-loading");
      saveBtn.disabled = false;

      if (!addRes || !addRes.ok) {
        toast(
          (addRes && addRes.message) || "Gagal menambah venue baru.",
          "error",
        );
        return;
      }

      // Masukkan venue baru langsung ke dropdown dan otomatis pilih
      const newVenue = addRes.venue || {};
      if (newVenue.venue_id) {
        const opt = document.createElement("option");
        opt.value = newVenue.venue_id;
        opt.textContent = `${newVenue.name} · ${newVenue.city}`;
        opt.selected = true;
        venueSelect.appendChild(opt);
        venueSelect.value = String(newVenue.venue_id);
      }

      ov.remove();
      toast("Venue baru berhasil ditambahkan dan dipilih!");
    };

    document.body.appendChild(ov);
    ov.querySelector("#v-name").focus();
  };
  // Submit form edit
  document.getElementById("concert-form").onsubmit = async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById("btn-save");
    saveBtn.classList.add("is-loading");
    saveBtn.disabled = true;

    const payload = {
      concert_id: c.concert_id,
      title: document.getElementById("f-title").value,
      description: document.getElementById("f-desc").value,
      concert_date: document.getElementById("f-date").value + "T20:00:00+07",
      gate_open: document.getElementById("f-gate").value,
      venue_id: Number(venueSelect.value),
      status: document.getElementById("f-status").value,
    };

    const updateRes = await backend(
      "update_concert_info",
      [admin.user_id, payload],
      null,
    );
    saveBtn.classList.remove("is-loading");
    saveBtn.disabled = false;

    if (!updateRes || !updateRes.ok) {
      toast(
        (updateRes && updateRes.message) || "Gagal menyimpan perubahan.",
        "error",
      );
      return;
    }

    toast("Informasi konser berhasil disimpan!");
    setTimeout(() => (window.location.href = "concert.html"), 1000);
  };
}
/* ----- A4: Kategori Tiket ----- */
let _catList = [];

async function initAdminCategories() {
  const admin = getAdminSession();
  if (!admin) {
    window.location.href = "login.html";
    return;
  }

  renderAdminLayout("kategori");

  document.getElementById("btn-add-cat").onclick = () =>
    openCategoryModal(admin, null);
  document.getElementById("search-cat").addEventListener("input", (e) => {
    renderCategoryTable(admin, _catList, e.target.value);
  });

  await loadAdminCategories(admin);
}

async function loadAdminCategories(admin) {
  const res = await backend(
    "get_admin_ticket_categories",
    [admin.user_id],
    null,
  );
  if (!res || !res.ok) {
    toast((res && res.message) || "Gagal memuat kategori tiket.", "error");
    return;
  }
  _catList = res.categories || [];

  const totalQuota = _catList.reduce((acc, c) => acc + Number(c.quota || 0), 0);
  const totalSold = _catList.reduce((acc, c) => acc + Number(c.sold || 0), 0);
  const totalRem = Math.max(0, totalQuota - totalSold);

  document.getElementById("cat-total-quota").textContent =
    totalQuota.toLocaleString("id-ID");
  document.getElementById("cat-total-sold").textContent =
    totalSold.toLocaleString("id-ID");
  document.getElementById("cat-total-rem").textContent =
    totalRem.toLocaleString("id-ID");

  renderCategoryTable(
    admin,
    _catList,
    document.getElementById("search-cat").value,
  );
}

function renderCategoryTable(admin, list, keyword = "") {
  const q = (keyword || "").trim().toLowerCase();
  const filtered = q
    ? list.filter((c) => (c.name || "").toLowerCase().includes(q))
    : list;
  const tbody = document.getElementById("cat-table-body");
  document.getElementById("cat-count-info").textContent =
    `Menampilkan ${filtered.length} data · Halaman 1 dari 1`;

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="muted">Tidak ada kategori tiket ditemukan.</td></tr>`;
    return;
  }

  const fmtRange = (s, e) => {
    if (!s && !e) return "Belum dijadwalkan";
    const opts = { day: "2-digit", month: "short", year: "numeric" };
    const d1 = s
      ? new Date(s).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "short",
        })
      : "?";
    const d2 = e ? new Date(e).toLocaleDateString("id-ID", opts) : "?";
    return `${d1} – ${d2}`;
  };

  tbody.innerHTML = filtered
    .map((c) => {
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
        ? "background:none;border:0;color:var(--text-2);font-size:12px;padding:0;text-align:left;cursor:pointer"
        : "background:none;border:0;color:var(--text-2);opacity:0.45;font-size:12px;padding:0;text-align:left;cursor:not-allowed";

      return `
      <tr>
        <td style="font-weight:500">${esc(c.name)}</td>
        <td>${rupiah(c.price)}</td>
        <td>${quota.toLocaleString("id-ID")}</td>
        <td>${sold.toLocaleString("id-ID")}</td>
        <td>${rem.toLocaleString("id-ID")}</td>
        <td class="muted">${fmtRange(c.sale_start, c.sale_end)}</td>
        <td>${statusHtml}</td>
        <td>
          <div style="display:flex;flex-direction:column;gap:4px">
            <button type="button" class="cat-act-edit" data-id="${c.category_id}" style="background:none;border:0;color:var(--text);font-size:12px;padding:0;text-align:left;cursor:pointer">Edit</button>
            <button type="button" class="cat-act-del" data-id="${c.category_id}" data-name="${esc(c.name)}" data-sold="${sold}" style="${delStyle}">Hapus</button>
          </div>
        </td>
      </tr>`;
    })
    .join("");

  tbody.querySelectorAll(".cat-act-edit").forEach((btn) => {
    btn.onclick = () => {
      const item = _catList.find(
        (x) => String(x.category_id) === btn.dataset.id,
      );
      if (item) openCategoryModal(admin, item);
    };
  });

  tbody.querySelectorAll(".cat-act-del").forEach((btn) => {
    btn.onclick = () => {
      const soldCount = Number(btn.dataset.sold || 0);
      if (soldCount > 0) {
        toast(
          `Kategori "${btn.dataset.name}" tidak dapat dihapus karena sudah terjual ${soldCount.toLocaleString("id-ID")} tiket.`,
          "error",
        );
        return;
      }
      confirmModal({
        title: `HAPUS KATEGORI ${btn.dataset.name.toUpperCase()}?`,
        text: "Kategori ini belum memiliki penjualan dan akan dihapus permanen.",
        yes: "Hapus",
        onYes: async () => {
          const res = await backend(
            "delete_ticket_category",
            [admin.user_id, Number(btn.dataset.id)],
            null,
          );
          if (!res || !res.ok) {
            toast((res && res.message) || "Gagal menghapus kategori.", "error");
            return;
          }
          toast("Kategori tiket berhasil dihapus.");
          await loadAdminCategories(admin);
        },
      });
    };
  });
}

function openCategoryModal(admin, item = null) {
  const isEdit = Boolean(item);
  const ov = document.createElement("div");
  ov.className = "overlay";
  ov.innerHTML = `
    <form class="modal modal-lg" id="cat-form" novalidate>
      <h3>${isEdit ? "EDIT KATEGORI TIKET" : "TAMBAH KATEGORI BARU"}</h3>
      <div class="field">
        <label for="c-name">Nama kategori</label>
        <input class="input" id="c-name" value="${esc(item ? item.name : "")}" placeholder="Contoh: Early Access / VIP" required>
      </div>
      <div class="field">
        <label for="c-desc">Deskripsi area / fasilitas</label>
        <input class="input" id="c-desc" value="${esc(item ? item.description || "" : "")}" placeholder="Contoh: Akses masuk lebih awal · area berdiri">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div class="field">
          <label for="c-price">Harga tiket (Rp)</label>
          <input class="input" id="c-price" type="number" min="0" step="1000" value="${item ? Number(item.price) : 750000}" required>
        </div>
        <div class="field">
          <label for="c-quota">Kuota tiket ${isEdit ? `(min. ${item.sold} terjual)` : ""}</label>
          <input class="input" id="c-quota" type="number" min="${isEdit ? item.sold : 0}" value="${item ? Number(item.quota) : 0}" required>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div class="field">
          <label for="c-start">Mulai penjualan (opsional)</label>
          <input class="input" id="c-start" type="date" value="${item && item.sale_start ? String(item.sale_start).substring(0, 10) : ""}">
        </div>
        <div class="field">
          <label for="c-end">Akhir penjualan (opsional)</label>
          <input class="input" id="c-end" type="date" value="${item && item.sale_end ? String(item.sale_end).substring(0, 10) : ""}">
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" id="c-cancel">Batal</button>
        <button type="submit" class="btn btn-primary" id="c-save">${isEdit ? "Simpan Perubahan" : "Simpan Kategori"}</button>
      </div>
    </form>`;

  ov.querySelector("#c-cancel").onclick = () => ov.remove();
  ov.onclick = (e) => {
    if (e.target === ov) ov.remove();
  };

  ov.querySelector("#cat-form").onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
      category_id: item ? item.category_id : null,
      name: ov.querySelector("#c-name").value.trim(),
      description: ov.querySelector("#c-desc").value.trim(),
      price: Number(ov.querySelector("#c-price").value),
      quota: Number(ov.querySelector("#c-quota").value),
      sale_start: ov.querySelector("#c-start").value || null,
      sale_end: ov.querySelector("#c-end").value || null,
    };

    const saveBtn = ov.querySelector("#c-save");
    saveBtn.classList.add("is-loading");
    saveBtn.disabled = true;

    const res = await backend(
      "save_ticket_category",
      [admin.user_id, payload],
      null,
    );

    saveBtn.classList.remove("is-loading");
    saveBtn.disabled = false;

    if (!res || !res.ok) {
      toast((res && res.message) || "Gagal menyimpan kategori.", "error");
      return;
    }

    ov.remove();
    toast(res.message || "Kategori berhasil disimpan!");
    await loadAdminCategories(admin);
  };

  document.body.appendChild(ov);
  ov.querySelector("#c-name").focus();
}

/* ----- A9: Kelola Voucher ----- */
let _vouchers = [];
let _vPage = 1;
const V_PER_PAGE = 5;

function voucherStatus(v) {
  if (!v.is_active) return "inactive";
  if (v.valid_until && new Date(v.valid_until) < new Date()) return "expired";
  return "active";
}

async function initAdminVoucher() {
  const admin = getAdminSession();
  if (!admin) {
    window.location.href = "login.html";
    return;
  }

  renderAdminLayout("voucher");

  document.getElementById("btn-add-voucher").onclick = () =>
    openVoucherModal(admin, null);
  document.getElementById("search-voucher").addEventListener("input", () => {
    _vPage = 1;
    renderVoucherTable(admin);
  });
  document
    .getElementById("filter-voucher-status")
    .addEventListener("change", () => {
      _vPage = 1;
      renderVoucherTable(admin);
    });
  document.getElementById("v-prev").onclick = () => {
    _vPage--;
    renderVoucherTable(admin);
  };
  document.getElementById("v-next").onclick = () => {
    _vPage++;
    renderVoucherTable(admin);
  };

  await loadVouchers(admin);
}

async function loadVouchers(admin) {
  const res = await backend("get_admin_vouchers", [admin.user_id], null);
  if (!res || !res.ok) {
    toast((res && res.message) || "Gagal memuat voucher.", "error");
    return;
  }
  _vouchers = res.vouchers || [];

  document.getElementById("voucher-note").textContent =
    Number(res.total_used) === 0
      ? "Belum ada voucher yang digunakan. Total diskon pada laporan: Rp0."
      : `${Number(res.total_used).toLocaleString("id-ID")} pesanan memakai voucher. Total diskon pada laporan: ${rupiah(res.total_discount)}.`;

  renderVoucherTable(admin);
}

function renderVoucherTable(admin) {
  const q = document
    .getElementById("search-voucher")
    .value.trim()
    .toUpperCase();
  const st = document.getElementById("filter-voucher-status").value;
  const list = _vouchers.filter(
    (v) =>
      (!q || String(v.code).toUpperCase().includes(q)) &&
      (!st || voucherStatus(v) === st),
  );

  const pages = Math.max(1, Math.ceil(list.length / V_PER_PAGE));
  _vPage = Math.min(Math.max(1, _vPage), pages);
  const slice = list.slice((_vPage - 1) * V_PER_PAGE, _vPage * V_PER_PAGE);

  document.getElementById("voucher-count-info").textContent =
    `Menampilkan ${list.length} data · Halaman ${_vPage} dari ${pages}`;
  document.getElementById("v-page-no").textContent = _vPage;
  document.getElementById("v-prev").disabled = _vPage <= 1;
  document.getElementById("v-next").disabled = _vPage >= pages;

  const tbody = document.getElementById("voucher-table-body");
  if (!slice.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="muted">${_vouchers.length ? "Tidak ada voucher yang cocok." : "Belum ada voucher. Klik “Tambah Voucher” untuk membuat yang pertama."}</td></tr>`;
    return;
  }

  const fmtDate = (d) =>
    d
      ? new Date(d).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "Asia/Jakarta",
        })
      : "-";
  const STATUS = {
    active: '<span style="color:#22c55e">Aktif</span>',
    inactive: '<span class="muted">Nonaktif</span>',
    expired: '<span class="muted">Kedaluwarsa</span>',
  };
  const btnStyle =
    "background:none;border:0;color:var(--text);font-size:12px;padding:0;text-align:left;cursor:pointer";

  tbody.innerHTML = slice
    .map((v) => {
      const s = voucherStatus(v);
      const canDelete = Number(v.used) === 0 && !v.is_active;
      return `
      <tr>
        <td style="font-weight:500">${esc(v.code)}</td>
        <td class="muted">${v.kind === "percent" ? "Persen" : "Nominal"}</td>
        <td>${v.kind === "percent" ? esc(String(v.value)) + "%" : rupiah(v.value)}</td>
        <td>${Number(v.quota).toLocaleString("id-ID")}</td>
        <td>${Number(v.used).toLocaleString("id-ID")}</td>
        <td class="muted">${fmtDate(v.valid_until)}</td>
        <td>${STATUS[s]}</td>
        <td>
          <div style="display:flex;flex-direction:column;gap:4px">
            <button type="button" class="v-act-toggle" data-id="${esc(String(v.voucher_id))}" style="${btnStyle}">${v.is_active ? "Nonaktifkan" : "Aktifkan"}</button>
            <button type="button" class="v-act-edit" data-id="${esc(String(v.voucher_id))}" style="${btnStyle}">Edit</button>
            ${canDelete ? `<button type="button" class="v-act-del" data-id="${esc(String(v.voucher_id))}" style="${btnStyle}">Hapus</button>` : ""}
          </div>
        </td>
      </tr>`;
    })
    .join("");

  const find = (btn) =>
    _vouchers.find((x) => String(x.voucher_id) === btn.dataset.id);

  tbody.querySelectorAll(".v-act-toggle").forEach((btn) => {
    btn.onclick = async () => {
      const v = find(btn);
      if (!v) return;
      const res = await backend(
        "toggle_voucher",
        [admin.user_id, v.voucher_id, !v.is_active],
        null,
      );
      if (!res || !res.ok) {
        toast((res && res.message) || "Gagal mengubah status.", "error");
        return;
      }
      toast(res.message);
      await loadVouchers(admin);
    };
  });

  tbody.querySelectorAll(".v-act-edit").forEach((btn) => {
    btn.onclick = () => {
      const v = find(btn);
      if (v) openVoucherModal(admin, v);
    };
  });

  tbody.querySelectorAll(".v-act-del").forEach((btn) => {
    btn.onclick = () => {
      const v = find(btn);
      if (!v) return;
      confirmModal({
        title: `HAPUS VOUCHER ${String(v.code).toUpperCase()}?`,
        text: "Voucher ini belum pernah dipakai dan akan dihapus permanen.",
        yes: "Hapus",
        onYes: async () => {
          const res = await backend(
            "delete_voucher",
            [admin.user_id, v.voucher_id],
            null,
          );
          if (!res || !res.ok) {
            toast((res && res.message) || "Gagal menghapus voucher.", "error");
            return;
          }
          toast(res.message);
          await loadVouchers(admin);
        },
      });
    };
  });
}

function openVoucherModal(admin, item = null) {
  const isEdit = Boolean(item);
  const endVal =
    item && item.valid_until
      ? new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Jakarta" }).format(
          new Date(item.valid_until),
        )
      : "";

  const ov = document.createElement("div");
  ov.className = "overlay";
  ov.innerHTML = `
    <form class="modal modal-lg" id="voucher-form" novalidate>
      <h3>${isEdit ? "EDIT VOUCHER" : "TAMBAH VOUCHER BARU"}</h3>
      <div class="field">
        <label for="v-code">Kode voucher</label>
        <input class="input" id="v-code" maxlength="20" value="${esc(item ? item.code : "")}" placeholder="Contoh: AFTER10" required>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div class="field">
          <label for="v-kind">Jenis diskon</label>
          <select class="input" id="v-kind">
            <option value="percent" ${!item || item.kind === "percent" ? "selected" : ""}>Persen (%)</option>
            <option value="fixed" ${item && item.kind === "fixed" ? "selected" : ""}>Nominal (Rp)</option>
          </select>
        </div>
        <div class="field">
          <label for="v-value" id="v-value-label">Nilai</label>
          <input class="input" id="v-value" type="number" min="1" step="1" value="${item ? Number(item.value) : ""}" required>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div class="field">
          <label for="v-quota">Kuota ${isEdit ? `(min. ${Number(item.used)} terpakai)` : ""}</label>
          <input class="input" id="v-quota" type="number" min="${isEdit ? Math.max(1, Number(item.used)) : 1}" value="${item ? Number(item.quota) : ""}" required>
        </div>
        <div class="field">
          <label for="v-end">Berlaku sampai</label>
          <input class="input" id="v-end" type="date" value="${endVal}" required>
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" id="v-cancel">Batal</button>
        <button type="submit" class="btn btn-primary" id="v-save">${isEdit ? "Simpan Perubahan" : "Simpan Voucher"}</button>
      </div>
    </form>`;

  const kindEl = ov.querySelector("#v-kind");
  const syncLabel = () => {
    ov.querySelector("#v-value-label").textContent =
      kindEl.value === "percent" ? "Nilai diskon (%)" : "Nilai diskon (Rp)";
  };
  kindEl.onchange = syncLabel;
  syncLabel();

  ov.querySelector("#v-code").oninput = (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  };
  ov.querySelector("#v-cancel").onclick = () => ov.remove();
  ov.onclick = (e) => {
    if (e.target === ov) ov.remove();
  };

  ov.querySelector("#voucher-form").onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
      voucher_id: item ? item.voucher_id : null,
      code: ov.querySelector("#v-code").value.trim(),
      kind: kindEl.value,
      value: ov.querySelector("#v-value").value,
      quota: ov.querySelector("#v-quota").value,
      valid_until: ov.querySelector("#v-end").value,
    };

    const saveBtn = ov.querySelector("#v-save");
    saveBtn.classList.add("is-loading");
    saveBtn.disabled = true;

    const res = await backend("save_voucher", [admin.user_id, payload], null);

    saveBtn.classList.remove("is-loading");
    saveBtn.disabled = false;

    if (!res || !res.ok) {
      toast((res && res.message) || "Gagal menyimpan voucher.", "error");
      return;
    }

    ov.remove();
    toast(res.message || "Voucher berhasil disimpan!");
    await loadVouchers(admin);
  };

  document.body.appendChild(ov);
  ov.querySelector("#v-code").focus();
}
