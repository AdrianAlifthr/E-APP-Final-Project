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
    { id: 'dashboard', label: 'Dashboard', href: 'dashboard.html', icon: icoDash },
    { id: 'konser', label: '— Konser', href: 'concert.html' },
    { id: 'kategori', label: '— Kategori Tiket', href: 'categories.html' },
    { id: 'pesanan', label: '— Pesanan', href: 'orders.html' },
    { id: 'pembayaran', label: '— Pembayaran', href: 'payments.html' },
    { id: 'pengumuman', label: 'Pengumuman', href: 'announcements.html', icon: icoAnn },
    { id: 'voucher', label: '— Voucher', href: 'voucher.html' },
    { id: 'checkin', label: '— Check-in', href:'checkin.html' },
    { id: 'laporan', label: '— Laporan', href: 'reports.html' },
    { id: 'pengguna', label: '— Pengguna', href: 'users.html' },
    { id: 'log', label: '— Log Aktivitas', href: 'activity.html' }
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
      onYes: () => {
        Auth.clear();
        backend("admin_logout", [], null);
        setTimeout(() => {
          window.location.replace("login.html");
        }, 120);
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

  document.getElementById("search-ann").addEventListener("input", (e) => {
    if (_dashData)
      renderAnnouncements(_dashData.announcements || [], e.target.value);
  });

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

  document.getElementById("chart-sub").textContent =
    `${Number(res.chart_total).toLocaleString("id-ID")} tiket / ${_activeDays} hari terakhir`;
  renderSalesChart(res.chart || []);

  document.getElementById("quota-sub").textContent =
    `${Number(k.remaining_total).toLocaleString("id-ID")} tiket masih tersedia`;
  renderQuotaList(res.categories || []);

  renderRecentOrders(res.recent_orders || []);
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

let _checkinStream = null;
let _checkinScanTimer = null;
let _checkinScanning = false;
let _sampleValidCode = "";
let _sampleUsedCode = "";

async function initAdminCheckin() {
  const admin = getAdminSession();
  if (!admin) {
    window.location.href = "login.html";
    return;
  }

  renderAdminLayout("checkin");

  const form = document.getElementById("checkin-form");
  const codeInput = document.getElementById("ticket-code");
  const topSearch = document.getElementById("top-checkin-search");

  topSearch.addEventListener("input", () => {
    codeInput.value = topSearch.value;
  });
  topSearch.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const code = codeInput.value.trim();
    if (!code) {
      showCheckinResult(false, "Masukkan atau pindai kode tiket terlebih dahulu.");
      codeInput.focus();
      return;
    }
    await validateCheckinTicket(admin.user_id, code);
  });

  document.getElementById("valid-demo-btn").onclick = async () => {
    if (!_sampleValidCode) {
      showCheckinResult(false, "Belum ada tiket paid berstatus valid.");
      return;
    }
    setDemoTicket(codeInput, _sampleValidCode);
  };
  document.getElementById("used-demo-btn").onclick = async () => {
    if (!_sampleUsedCode) {
      showCheckinResult(false, "Belum ada tiket paid berstatus sudah digunakan.");
      return;
    }
    setDemoTicket(codeInput, _sampleUsedCode, "used");
    await validateCheckinTicket(admin.user_id, _sampleUsedCode);
  };
  document.getElementById("scan-ticket-btn").onclick = startCheckinScanner;
  document.getElementById("stop-scanner-btn").onclick = stopCheckinScanner;
  window.addEventListener("pagehide", stopCheckinScanner);

  await loadCheckinData(admin.user_id);
}

async function loadCheckinData(userId) {
  const res = await backend("get_admin_checkin_data", [userId], null);
  if (!res || !res.ok) {
    toast((res && res.message) || "Gagal memuat data check-in.", "error");
    return;
  }

  document.getElementById("checkin-count").textContent =
    Number(res.checked_in || 0).toLocaleString("id-ID");
  document.getElementById("ticket-total").textContent =
    Number(res.total_sold || 0).toLocaleString("id-ID");
  document.getElementById("gate-name").textContent =
    res.gate || "CAT 1 / PINTU 02";
  _sampleValidCode = res.sample_valid_code || "";
  _sampleUsedCode = res.sample_used_code || "";

  renderCheckinHistory(res.history || []);
}

function renderCheckinHistory(history) {
  const el = document.getElementById("checkin-history");
  if (!history.length) {
    el.innerHTML =
      '<p class="muted" style="font-size:13px">Belum ada check-in dalam simulasi ini.</p>';
    return;
  }

  const rows = history.map((item) => {
    const at = item.checked_in_at
      ? new Date(item.checked_in_at).toLocaleTimeString("en-GB", {
          timeZone: "Asia/Jakarta",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hourCycle: "h23",
        })
      : "Data lama";
    return `<div class="checkin-history-row">
      <strong>${esc(item.ticket_code)}</strong>
      <span>${esc(item.holder_name || "-")}</span>
      <span>${esc(item.category || "-")}</span>
      <span class="muted">${at}${item.checked_in_at ? " WIB" : ""}</span>
    </div>`;
  }).join("");

  el.innerHTML =
    '<div class="checkin-history-row checkin-history-head"><strong>KODE TIKET</strong><span>NAMA PEMEGANG</span><span>KATEGORI</span><span>WAKTU</span></div>' +
    rows;
}

function setDemoTicket(input, code, mode) {
  input.value = code;
  document.getElementById("ticket-hint").textContent =
    mode === "used"
      ? "Contoh kode yang sudah digunakan oleh simulasi."
      : "Contoh kode tiket valid untuk diuji.";
  input.focus();
}

function showCheckinResult(valid, message, ticket) {
  const el = document.getElementById("checkin-result");
  el.hidden = false;
  el.className = `checkin-result ${valid ? "valid" : "invalid"}`;
  el.innerHTML = valid
    ? `<strong>TIKET VALID. Pengunjung boleh masuk.</strong><br>
       Kode: ${esc(ticket.ticket_code)}<br>
       Pemegang: ${esc(ticket.holder_name)}<br>
       Kategori: ${esc(ticket.category)}`
    : `<strong>${esc(message)}</strong>`;
}

async function validateCheckinTicket(userId, code) {
  const button = document.getElementById("check-ticket-btn");
  button.classList.add("is-loading");
  button.disabled = true;

  const res = await backend("admin_check_ticket", [userId, code], null);

  button.classList.remove("is-loading");
  button.disabled = false;

  if (!res || !res.ok) {
    showCheckinResult(false, (res && res.message) || "Tiket tidak dapat diverifikasi.");
    toast((res && res.message) || "Gagal memvalidasi tiket.", "error");
    return;
  }

  showCheckinResult(true, res.message, res.ticket);
  toast(res.message || "Tiket valid.");
  await loadCheckinData(userId);
  stopCheckinScanner();
}

async function startCheckinScanner() {
  if (!("BarcodeDetector" in window)) {
    toast("Pindai QR tidak didukung browser ini. Gunakan cek kode manual.", "warn");
    document.getElementById("scan-status").innerHTML =
      "<strong>Scanner QR tidak tersedia.</strong><span>Gunakan input kode tiket sebagai pengganti.</span>";
    return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    toast("Kamera tidak tersedia atau aplikasi perlu dibuka lewat localhost/HTTPS.", "warn");
    return;
  }

  const wrap = document.getElementById("scanner-wrap");
  const video = document.getElementById("scanner-video");
  const scannerStatus = document.getElementById("scanner-status");
  document.getElementById("scan-status").innerHTML =
    "<strong>Meminta izin kamera.</strong><span>Izinkan kamera pada notifikasi browser.</span>";
  try {
    _checkinStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });
    video.srcObject = _checkinStream;
    await video.play();
    wrap.hidden = false;
    if (scannerStatus) scannerStatus.textContent = "Kamera aktif. Arahkan QR ke bingkai merah.";
    _checkinScanning = true;
    document.getElementById("scan-status").innerHTML =
      "<strong>Scanner aktif.</strong><span>Arahkan QR tiket ke bingkai merah.</span>";

    const detector = new BarcodeDetector({ formats: ["qr_code"] });
    const scan = async () => {
      if (!_checkinScanning) return;
      try {
        const codes = await detector.detect(video);
        if (codes.length) {
          const value = (codes[0].rawValue || "").trim();
          if (value) {
            document.getElementById("ticket-code").value = value;
            document.getElementById("top-checkin-search").value = value;
            const admin = getAdminSession();
            if (admin) await validateCheckinTicket(admin.user_id, value);
            return;
          }
        }
      } catch (error) {
        console.warn("QR scan error:", error);
      }
      _checkinScanTimer = requestAnimationFrame(scan);
    };
    scan();
  } catch (error) {
    console.warn("Camera error:", error);
    wrap.hidden = true;

    let message = "Akses kamera ditolak atau kamera tidak tersedia.";
    if (error && error.name === "NotAllowedError") {
      message = "Izin kamera ditolak. Aktifkan izin kamera pada browser lalu coba lagi.";
    } else if (error && error.name === "NotFoundError") {
      message = "Tidak ada kamera yang ditemukan pada perangkat ini.";
    } else if (error && error.name === "NotReadableError") {
      message = "Kamera sedang digunakan aplikasi lain.";
    } else if (error && error.name === "SecurityError") {
      message = "Kamera hanya tersedia melalui localhost atau HTTPS.";
    }

    document.getElementById("scan-status").innerHTML =
      `<strong>Scanner tidak aktif.</strong><span>${esc(message)}</span>`;
    toast(message, "error");
  }
}

function stopCheckinScanner() {
  _checkinScanning = false;
  if (_checkinScanTimer) {
    cancelAnimationFrame(_checkinScanTimer);
    _checkinScanTimer = null;
  }
  if (_checkinStream) {
    _checkinStream.getTracks().forEach((track) => track.stop());
    _checkinStream = null;
  }
  const wrap = document.getElementById("scanner-wrap");
  if (wrap) wrap.hidden = true;
  const video = document.getElementById("scanner-video");
  if (video) video.srcObject = null;
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
    toast(res.warning || "Pengumuman berhasil disimpan!", res.warning ? "warn" : "success");
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
      toast(addRes.warning || "Venue baru berhasil ditambahkan dan dipilih!", addRes.warning ? "warn" : "success");
    };

    document.body.appendChild(ov);
    ov.querySelector("#v-name").focus();
  };

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

    toast(updateRes.warning || "Informasi konser berhasil disimpan!", updateRes.warning ? "warn" : "success");
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
          toast(res.warning || "Kategori tiket berhasil dihapus.", res.warning ? "warn" : "success");
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
    toast(res.warning || res.message || "Kategori berhasil disimpan!", res.warning ? "warn" : "success");
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
  if (Number(v.quota) > 0 && Number(v.used) >= Number(v.quota))
    return "exhausted";
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
    exhausted: '<span style="color:#f5a623">Kuota habis</span>',
  };
  const btnStyle =
    "background:none;border:0;color:var(--text);font-size:12px;padding:0;text-align:left;cursor:pointer";

  tbody.innerHTML = slice
    .map((v) => {
      const s = voucherStatus(v);
      const canDelete = Number(v.used) === 0 && !v.is_active;
      const deleteReason = Number(v.used) > 0
        ? "Voucher sudah dipakai dan tidak dapat dihapus agar riwayat pesanan tetap aman."
        : "Nonaktifkan voucher terlebih dahulu sebelum menghapus.";
      const canActivate = Number(v.used) < Number(v.quota) && s !== "expired";
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
            ${v.is_active
              ? `<button type="button" class="v-act-toggle" data-id="${esc(String(v.voucher_id))}" style="${btnStyle}">Nonaktifkan</button>`
              : canActivate
                ? `<button type="button" class="v-act-toggle" data-id="${esc(String(v.voucher_id))}" style="${btnStyle}">Aktifkan</button>`
                : `<span class="muted" title="Kuota habis atau masa berlaku sudah lewat">Aktifkan</span>`}
            <button type="button" class="v-act-edit" data-id="${esc(String(v.voucher_id))}" style="${btnStyle}">Edit</button>
            <button type="button" class="v-act-del" data-id="${esc(String(v.voucher_id))}" style="${btnStyle};${canDelete ? "" : "opacity:0.45;cursor:not-allowed"}" ${canDelete ? "" : `disabled title="${deleteReason}"`}>Hapus</button>
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
      toast(res.warning || res.message, res.warning ? "warn" : "success");
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
          toast(res.warning || res.message, res.warning ? "warn" : "success");
          await loadVouchers(admin);
        },
      });
    };
  });
}

function openVoucherModal(admin, item = null) {
  const todayWib = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Jakarta",
  }).format(new Date());
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
          <input class="input" id="v-end" type="date" min="${todayWib}" value="${endVal}" required>
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" id="v-cancel">Batal</button>
        <button type="submit" class="btn btn-primary" id="v-save">${isEdit ? "Simpan Perubahan" : "Simpan Voucher"}</button>
      </div>
    </form>`;

  const kindEl = ov.querySelector("#v-kind");
  const endEl = ov.querySelector("#v-end");
  const syncLabel = () => {
    ov.querySelector("#v-value-label").textContent =
      kindEl.value === "percent" ? "Nilai diskon (%)" : "Nilai diskon (Rp)";
  };
  kindEl.onchange = syncLabel;
  syncLabel();

  ov.querySelector("#v-code").oninput = (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  };
  endEl.min = todayWib;
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
    if (!payload.valid_until || payload.valid_until < todayWib) {
      toast("Tanggal masa berlaku tidak boleh sebelum hari ini.", "error");
      endEl.focus();
      return;
    }

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
    toast(res.warning || res.message || "Voucher berhasil disimpan!", res.warning ? "warn" : "success");
    await loadVouchers(admin);
  };

  document.body.appendChild(ov);
  ov.querySelector("#v-code").focus();
}

/* ----- A5: Kelola Pesanan ----- */
let _allOrders = [];
let _ordPage = 1;
const ORD_PER_PAGE = 10;

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

  const applyFilter = () => {
    _ordPage = 1;
    renderOrdersTable();
  };
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

  document.getElementById('ord-prev').onclick = () => {
    if (_ordPage > 1) {
      _ordPage--;
      renderOrdersTable();
    }
  };
  document.getElementById('ord-next').onclick = () => {
    _ordPage++;
    renderOrdersTable();
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
  const pages = Math.max(1, Math.ceil(list.length / ORD_PER_PAGE));
  _ordPage = Math.min(Math.max(1, _ordPage), pages);
  const slice = list.slice((_ordPage - 1) * ORD_PER_PAGE, _ordPage * ORD_PER_PAGE);

  const tbody = document.getElementById('ord-table-body');
  document.getElementById('ord-count-info').textContent = `Menampilkan ${list.length} data · Halaman ${_ordPage} dari ${pages}`;

  const pageNoEl = document.getElementById('ord-page-no');
  const prevBtn = document.getElementById('ord-prev');
  const nextBtn = document.getElementById('ord-next');
  if (pageNoEl) pageNoEl.textContent = _ordPage;
  if (prevBtn) {
    prevBtn.disabled = _ordPage <= 1;
    prevBtn.style.opacity = _ordPage <= 1 ? '0.4' : '1';
    prevBtn.style.cursor = _ordPage <= 1 ? 'not-allowed' : 'pointer';
  }
  if (nextBtn) {
    nextBtn.disabled = _ordPage >= pages;
    nextBtn.style.opacity = _ordPage >= pages ? '0.4' : '1';
    nextBtn.style.cursor = _ordPage >= pages ? 'not-allowed' : 'pointer';
  }

  if (!slice.length) {
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

  tbody.innerHTML = slice.map(o => `
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

  const orderId = new URLSearchParams(window.location.search).get('id');
  if (!orderId) { window.location.href = 'orders.html'; return; }

  const loadDetail = async () => {
    const res = await backend('get_admin_order_detail', [admin.user_id, orderId], null);
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
          toast(upRes.warning || upRes.message, upRes.warning ? "warn" : "success");
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
let _payPage = 1;
const PAY_PER_PAGE = 10;

async function initAdminPayments() {
  const admin = getAdminSession();
  if (!admin) { window.location.href = 'login.html'; return; }

  renderAdminLayout('pembayaran');

  const applyPayFilter = () => {
    _payPage = 1;
    renderPaymentsTable();
  };

  document.getElementById('pay-q').addEventListener('input', applyPayFilter);
  document.getElementById('top-search-pay').addEventListener('input', (e) => {
    document.getElementById('pay-q').value = e.target.value;
    applyPayFilter();
  });
  document.getElementById('pay-status').addEventListener('change', applyPayFilter);
  document.getElementById('pay-method').addEventListener('change', applyPayFilter);

  document.getElementById('pay-prev').onclick = () => {
    if (_payPage > 1) {
      _payPage--;
      renderPaymentsTable();
    }
  };
  document.getElementById('pay-next').onclick = () => {
    _payPage++;
    renderPaymentsTable();
  };

  await loadAdminPayments(admin);
}

async function loadAdminPayments(admin) {
  const res = await backend('get_admin_payments', [admin.user_id], null);
  if (!res || !res.ok) {
    toast((res && res.message) || 'Gagal memuat data pembayaran.', 'error');
    return;
  }

  _allPayments = res.payments || [];

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

  const pages = Math.max(1, Math.ceil(filtered.length / PAY_PER_PAGE));
  _payPage = Math.min(Math.max(1, _payPage), pages);
  const slice = filtered.slice((_payPage - 1) * PAY_PER_PAGE, _payPage * PAY_PER_PAGE);

  const tbody = document.getElementById('pay-table-body');
  document.getElementById('pay-count-info').textContent = `Menampilkan ${filtered.length} data · Halaman ${_payPage} dari ${pages}`;

  const pageNoEl = document.getElementById('pay-page-no');
  const prevBtn = document.getElementById('pay-prev');
  const nextBtn = document.getElementById('pay-next');
  if (pageNoEl) pageNoEl.textContent = _payPage;
  if (prevBtn) {
    prevBtn.disabled = _payPage <= 1;
    prevBtn.style.opacity = _payPage <= 1 ? '0.4' : '1';
    prevBtn.style.cursor = _payPage <= 1 ? 'not-allowed' : 'pointer';
  }
  if (nextBtn) {
    nextBtn.disabled = _payPage >= pages;
    nextBtn.style.opacity = _payPage >= pages ? '0.4' : '1';
    nextBtn.style.cursor = _payPage >= pages ? 'not-allowed' : 'pointer';
  }

  if (!slice.length) {
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

  tbody.innerHTML = slice.map(p => {
    const isPending = p.status === 'pending';
    const actionEl = isPending
      ? `<div style="display:flex;gap:12px;align-items:center">
           <a href="order-detail.html?id=${p.order_id}" style="color:var(--text-2);font-size:13px">Detail</a>
           <button type="button" class="pay-act-verify" data-id="${p.payment_id}" style="background:none;border:0;color:var(--text);font-size:13px;padding:0;cursor:pointer;font-weight:500">Verifikasi</button>
         </div>`
      : `<a href="order-detail.html?id=${p.order_id}" style="color:var(--text);font-size:13px">Detail</a>`;

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

    const banner = document.getElementById('pay-feedback-banner');
    if (banner) {
      banner.hidden = false;
      banner.textContent = [res.message, res.warning].filter(Boolean).join(" ");
      if (res.type === 'error') {
        banner.style.color = '#ef4444';
        banner.style.borderColor = 'rgba(239, 68, 68, 0.35)';
      } else {
        banner.style.color = '#22c55e';
        banner.style.borderColor = 'rgba(34, 197, 94, 0.35)';
      }
    }

    toast(res.warning || res.message, res.warning ? 'warn' : res.type === 'error' ? 'error' : 'success');
    await loadAdminPayments(admin);
  };

  document.body.appendChild(ov);
}
/* ----- A11: Laporan Penjualan ----- */
const REPORT_LABEL = new Intl.NumberFormat('id-ID');
let _reportData = null;
let _reportRows = [];

function reportDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function reportDateKey(value) {
  const date = value instanceof Date ? value : reportDate(value);
  if (!date) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function reportRange() {
  const start = document.getElementById('report-start').value;
  const end = document.getElementById('report-end').value;
  if (start && end && start > end) {
    toast('Tanggal mulai tidak boleh melewati tanggal akhir.', 'error');
    return null;
  }
  return { start, end };
}

function buildReport(range, categoryId) {
  const categories = _reportData.categories || [];
  const categoryMap = new Map(categories.map(c => [String(c.category_id), c]));
  const orderMap = new Map((_reportData.orders || [])
    .filter(o => o.status === 'paid')
    .filter(o => {
      const date = reportDate(o.created_at);
      if (!date) return !range.start && !range.end;
      const day = reportDateKey(date);
      return (!range.start || day >= range.start) && (!range.end || day <= range.end);
    })
    .map(o => [String(o.order_id), o]));

  const totals = new Map();
  let ticketCount = 0;
  let revenue = 0;
  let discount = 0;

  for (const [orderId, order] of orderMap) {
    const orderItems = (_reportData.items || []).filter(it => String(it.order_id) === orderId);
    const orderSubtotal = Number(order.subtotal) || orderItems.reduce((sum, it) => sum + (Number(it.subtotal) || 0), 0);
    const orderDiscount = Number(order.discount) || 0;
    const selectedItems = orderItems.filter(it => !categoryId || String(it.category_id) === categoryId);
    const selectedSubtotal = selectedItems.reduce((sum, it) => {
      const lineTotal = Number(it.subtotal) || (Number(it.unit_price) || 0) * (Number(it.quantity) || 0);
      return sum + lineTotal;
    }, 0);
    const selectedDiscount = orderSubtotal > 0 ? orderDiscount * selectedSubtotal / orderSubtotal : 0;

    if (selectedItems.length) {
      discount += selectedDiscount;
      revenue += selectedSubtotal - selectedDiscount;
    }

    for (const item of selectedItems) {
      const key = String(item.category_id);
      const related = item.ticket_categories || {};
      const category = categoryMap.get(key) || {};
      const quantity = Number(item.quantity) || 0;
      const lineTotal = Number(item.subtotal) || (Number(item.unit_price) || Number(category.price) || 0) * quantity;
      const lineDiscount = selectedSubtotal > 0 ? selectedDiscount * lineTotal / selectedSubtotal : 0;
      const row = totals.get(key) || {
        category_id: key,
        name: related.name || category.name || 'Kategori',
        quantity: 0,
        unit_price: Number(category.price) || Number(item.unit_price) || 0,
        discount: 0,
        revenue: 0,
      };
      row.quantity += quantity;
      row.discount += lineDiscount;
      row.revenue += lineTotal - lineDiscount;
      totals.set(key, row);
      ticketCount += quantity;
    }
  }

  const rows = categories
    .filter(c => !categoryId || String(c.category_id) === categoryId)
    .map(c => totals.get(String(c.category_id)) || {
      category_id: String(c.category_id),
      name: c.name,
      quantity: 0,
      unit_price: Number(c.price) || 0,
      discount: 0,
      revenue: 0,
    });

  return { rows, ticketCount, revenue, discount };
}

function renderReport() {
  const range = reportRange();
  if (!range) return;
  const categoryId = document.getElementById('report-category').value;
  const result = buildReport(range, categoryId);
  _reportRows = result.rows;

  document.getElementById('report-tickets').textContent = REPORT_LABEL.format(result.ticketCount);
  document.getElementById('report-revenue').textContent = rupiah(Math.round(result.revenue));
  document.getElementById('report-discount').textContent = rupiah(Math.round(result.discount));

  const dateDescription = range.start || range.end
    ? `Periode ${range.start ? tanggal(range.start) : 'awal'} – ${range.end ? tanggal(range.end) : 'terbaru'}`
    : 'Seluruh periode penjualan';
  document.getElementById('report-caption').textContent = `${dateDescription} · hanya pesanan lunas.`;

  const max = Math.max(1, ..._reportRows.map(r => r.quantity));
  document.getElementById('report-chart').innerHTML = _reportRows.length
    ? _reportRows.map(row => {
        const height = row.quantity ? Math.max(6, Math.round(row.quantity / max * 100)) : 2;
        return `<div class="report-bar">
          <span class="report-bar-count">${REPORT_LABEL.format(row.quantity)}</span>
          <div class="report-bar-track"><div class="report-bar-fill" style="height:${height}%"></div></div>
          <span class="report-bar-label">${esc(row.name)}</span>
        </div>`;
      }).join('')
    : '<p class="muted">Tidak ada kategori tiket.</p>';

  const body = document.getElementById('report-table-body');
  body.innerHTML = _reportRows.length
    ? _reportRows.map(row => `<tr>
        <td style="font-weight:500">${esc(row.name)}</td>
        <td>${REPORT_LABEL.format(row.quantity)}</td>
        <td>${rupiah(row.unit_price)}</td>
        <td>${rupiah(Math.round(row.discount))}</td>
        <td>${rupiah(Math.round(row.revenue))}</td>
      </tr>`).join('')
    : '<tr><td colspan="5" class="muted">Tidak ada data penjualan.</td></tr>';
}

function exportReportCsv() {
  if (!_reportRows.length) return toast('Tidak ada data untuk diekspor.', 'warn');
  const rows = [['Kategori', 'Tiket terjual', 'Harga satuan', 'Diskon', 'Pendapatan']];
  _reportRows.forEach(row => rows.push([
    row.name, row.quantity, Math.round(row.unit_price), Math.round(row.discount), Math.round(row.revenue),
  ]));
  const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `laporan-penjualan-${reportDateKey(new Date())}.csv`;
  const url = link.href;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportReportPdf() {
  if (!_reportRows.length) return toast('Tidak ada data untuk diekspor.', 'warn');

  const admin = getAdminSession() || {};
  const start = document.getElementById('report-start').value;
  const end = document.getElementById('report-end').value;
  const catSel = document.getElementById('report-category');
  const catLabel = catSel.value ? catSel.options[catSel.selectedIndex].text : 'Semua kategori';

  const periodeText = start || end
    ? `${start ? tanggal(start) : 'Awal'} – ${end ? tanggal(end) : 'Terbaru'}`
    : 'Seluruh periode penjualan';

  const totalTickets = document.getElementById('report-tickets').textContent;
  const totalRevenue = document.getElementById('report-revenue').textContent;
  const totalDiscount = document.getElementById('report-discount').textContent;
  const printedAt = new Date().toLocaleString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).replace('.', ':') + ' WIB';

  const maxQty = Math.max(1, ..._reportRows.map(r => r.quantity));
  const barsHtml = _reportRows.map(r => {
    const pct = r.quantity ? Math.max(8, Math.round((r.quantity / maxQty) * 100)) : 3;
    return `
      <div class="bar-col">
        <div class="bar-val">${REPORT_LABEL.format(r.quantity)}</div>
        <div class="bar-track">
          <div class="bar-fill" style="height:${pct}%"></div>
        </div>
        <div class="bar-lbl">${esc(r.name)}</div>
      </div>`;
  }).join('');

  const rowsHtml = _reportRows.map(r => `
    <tr>
      <td class="bold">${esc(r.name)}</td>
      <td class="num">${REPORT_LABEL.format(r.quantity)}</td>
      <td class="num">${rupiah(r.unit_price)}</td>
      <td class="num">${rupiah(Math.round(r.discount))}</td>
      <td class="num bold">${rupiah(Math.round(r.revenue))}</td>
    </tr>`).join('');

  const printWin = window.open('', '_blank', 'width=960,height=800');
  if (!printWin) return toast('Izinkan pop-up browser untuk mencetak PDF.', 'error');

  printWin.document.write(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Laporan Penjualan - The Weeknd Jakarta 2027</title>
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    @page { size: A4 portrait; margin: 14mm 16mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { font-family: 'Inter', Arial, sans-serif; background: #ffffff; color: #111111; font-size: 12px; line-height: 1.45; }

    .header { background: #0d0d0f; color: #ffffff; padding: 22px 26px; border-radius: 10px; display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 4px solid #c8102e; margin-bottom: 18px; }
    .eyebrow { color: #c8102e; font-size: 10px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 4px; }
    .title { font-family: 'Bebas Neue', Impact, sans-serif; font-size: 36px; letter-spacing: 1px; line-height: 1; }
    .subtitle { color: #a1a1aa; font-size: 11px; margin-top: 4px; }
    .meta { text-align: right; font-size: 11px; color: #d4d4d8; }
    .meta strong { color: #ffffff; display: block; font-size: 12px; margin-bottom: 2px; }

    .filter-bar { display: flex; justify-content: space-between; background: #f4f4f5; border: 1px solid #e4e4e7; border-radius: 8px; padding: 10px 16px; margin-bottom: 16px; font-size: 11px; color: #52525b; }
    .filter-bar strong { color: #111111; }

    .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 18px; }
    .kpi-card { background: #fafafa; border: 1px solid #e4e4e7; border-left: 4px solid #c8102e; border-radius: 8px; padding: 14px 16px; }
    .kpi-lbl { font-size: 11px; color: #71717a; display: block; margin-bottom: 4px; }
    .kpi-val { font-family: 'Bebas Neue', Impact, sans-serif; font-size: 28px; letter-spacing: 0.5px; color: #09090b; line-height: 1; }

    .section-box { border: 1px solid #e4e4e7; border-radius: 8px; padding: 16px 18px; margin-bottom: 16px; }
    .section-title { font-family: 'Bebas Neue', Impact, sans-serif; font-size: 20px; letter-spacing: 0.6px; color: #09090b; margin-bottom: 12px; }

    .chart-grid { height: 145px; display: grid; grid-template-columns: repeat(${_reportRows.length}, 1fr); gap: 16px; align-items: end; padding-top: 8px; }
    .bar-col { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 6px; }
    .bar-val { font-size: 11px; font-weight: 600; color: #111111; }
    .bar-track { width: 64%; max-width: 72px; height: 95px; background: #f4f4f5; border-radius: 4px 4px 0 0; display: flex; align-items: flex-end; overflow: hidden; }
    .bar-fill { width: 100%; background: #c8102e; border-radius: 4px 4px 0 0; }
    .bar-lbl { font-size: 10px; font-weight: 500; color: #52525b; text-align: center; }

    table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
    th { background: #18181b; color: #ffffff; text-align: left; font-size: 10px; letter-spacing: 0.06em; padding: 9px 12px; }
    th.num, td.num { text-align: right; }
    td { padding: 10px 12px; border-bottom: 1px solid #e4e4e7; color: #27272a; }
    tr:nth-child(even) td { background: #fafafa; }
    tr:last-child td { border-bottom: 0; }
    .bold { font-weight: 600; color: #09090b; }
    .total-row td { background: #f4f4f5 !important; border-top: 2px solid #18181b; font-weight: 600; color: #09090b; }

    .footer { margin-top: 14px; padding-top: 10px; border-top: 1px solid #e4e4e7; display: flex; justify-content: space-between; font-size: 10px; color: #71717a; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="eyebrow">PANEL PANITIA · ANALITIK PENJUALAN</div>
      <div class="title">LAPORAN PENJUALAN TIKET</div>
      <div class="subtitle">THE WEEKND · AFTER HOURS TIL DAWN — GELORA BUNG KARNO, JAKARTA</div>
    </div>
    <div class="meta">
      <strong>Dicetak oleh: ${esc(admin.full_name || 'Admin Panitia')}</strong>
      <span>${printedAt}</span>
    </div>
  </div>

  <div class="filter-bar">
    <span>Periode: <strong>${esc(periodeText)}</strong></span>
    <span>Kategori: <strong>${esc(catLabel)}</strong></span>
    <span>Status Pesanan: <strong>Lunas (Paid)</strong></span>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card">
      <span class="kpi-lbl">TOTAL TIKET TERJUAL</span>
      <span class="kpi-val">${esc(totalTickets)} TIKET</span>
    </div>
    <div class="kpi-card">
      <span class="kpi-lbl">TOTAL PENDAPATAN BERSIH</span>
      <span class="kpi-val">${esc(totalRevenue)}</span>
    </div>
    <div class="kpi-card">
      <span class="kpi-lbl">TOTAL DISKON VOUCHER</span>
      <span class="kpi-val">${esc(totalDiscount)}</span>
    </div>
  </div>

  <div class="section-box">
    <div class="section-title">GRAFIK PENJUALAN PER KATEGORI</div>
    <div class="chart-grid">${barsHtml}</div>
  </div>

  <div class="section-box" style="padding:0;overflow:hidden">
    <table>
      <thead>
        <tr>
          <th>KATEGORI TIKET</th>
          <th class="num">TERJUAL</th>
          <th class="num">HARGA SATUAN</th>
          <th class="num">DISKON</th>
          <th class="num">PENDAPATAN BERSIH</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        <tr class="total-row">
          <td>TOTAL KESELURUHAN</td>
          <td class="num">${esc(totalTickets)}</td>
          <td class="num">—</td>
          <td class="num">${esc(totalDiscount)}</td>
          <td class="num">${esc(totalRevenue)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="footer">
    <span>PROYEK AKADEMIK · DATA SIMULASI</span>
    <span>TOTAL BERSIH = PENJUALAN TIKET − DISKON</span>
  </div>

  <script>
    window.onload = () => {
      setTimeout(() => { window.print(); window.close(); }, 300);
    };
  </script>
</body>
</html>`);
  printWin.document.close();
}

async function initAdminReports() {
  const admin = getAdminSession();
  if (!admin) { window.location.replace('login.html'); return; }

  renderAdminLayout('laporan');

  const response = await backend('get_admin_sales_report', [admin.user_id], null);
  if (!response || !response.ok) {
    toast((response && response.message) || 'Gagal memuat laporan penjualan.', 'error');
    document.getElementById('report-table-body').innerHTML =
      '<tr><td colspan="5" class="muted">Laporan tidak dapat dimuat.</td></tr>';
    return;
  }

  _reportData = response;
  const select = document.getElementById('report-category');
  (response.categories || []).forEach(category => {
    const option = document.createElement('option');
    option.value = category.category_id;
    option.textContent = category.name;
    select.appendChild(option);
  });

  const paidDates = (response.orders || [])
    .filter(order => order.status === 'paid')
    .map(order => reportDate(order.created_at))
    .filter(Boolean)
    .sort((a, b) => a - b);
  if (paidDates.length) {
    const latest = paidDates[paidDates.length - 1];
    const start = new Date(latest);
    start.setDate(start.getDate() - 3);
    document.getElementById('report-start').value = reportDateKey(start);
    document.getElementById('report-end').value = reportDateKey(latest);
  }

  document.getElementById('report-apply').onclick = renderReport;
  document.getElementById('report-reset').onclick = () => {
    document.getElementById('report-start').value = '';
    document.getElementById('report-end').value = '';
    document.getElementById('report-category').value = '';
    renderReport();
  };
  document.getElementById('report-category').onchange = renderReport;
  document.getElementById('report-top-search').oninput = event => {
    const keyword = event.target.value.trim().toLowerCase();
    const option = [...select.options].find(item => item.textContent.toLowerCase().includes(keyword));
    if (keyword && option) select.value = option.value;
    else if (!keyword) select.value = '';
    renderReport();
  };
  document.getElementById('report-export-csv').onclick = exportReportCsv;
  document.getElementById('report-export-pdf').onclick = exportReportPdf;

  renderReport();
}
const USERS_PER_PAGE = 10;
let adminUsers = [];
let usersPage = 1;

function filteredAdminUsers() {
  const query = document.getElementById('users-query').value.trim().toLowerCase();
  const role = document.getElementById('users-role').value;
  const status = document.getElementById('users-status').value;
  return adminUsers.filter(user => {
    const matchesQuery = !query ||
      String(user.full_name || '').toLowerCase().includes(query) ||
      String(user.email || '').toLowerCase().includes(query);
    const matchesRole = !role || user.role === role;
    const matchesStatus = !status || (user.is_active ? 'active' : 'blocked') === status;
    return matchesQuery && matchesRole && matchesStatus;
  });
}

function formatUserDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('id-ID', {day: '2-digit', month: 'short', year: 'numeric'});
}

function renderAdminUsers() {
  const list = filteredAdminUsers();
  const pages = Math.max(1, Math.ceil(list.length / USERS_PER_PAGE));
  usersPage = Math.min(usersPage, pages);
  const start = (usersPage - 1) * USERS_PER_PAGE;
  const visible = list.slice(start, start + USERS_PER_PAGE);
  const body = document.getElementById('users-table-body');

  document.getElementById('users-count-info').textContent =
    `Menampilkan ${list.length} data · Halaman ${usersPage} dari ${pages}`;
  document.getElementById('users-page-number').textContent = usersPage;
  document.getElementById('users-prev').disabled = usersPage <= 1;
  document.getElementById('users-next').disabled = usersPage >= pages;

  body.innerHTML = visible.length ? visible.map(user => `
    <tr>
      <td><button type="button" class="admin-user-name" data-user-detail="${esc(user.user_id)}">${esc(user.full_name || 'Tanpa nama')}</button></td>
      <td>${esc(user.email || '—')}</td>
      <td>${esc(user.phone || '—')}</td>
      <td>${esc(user.role || 'customer')}</td>
      <td><span class="user-status ${user.is_active ? 'active' : 'blocked'}">${user.is_active ? 'Aktif' : 'Diblokir'}</span></td>
      <td>${formatUserDate(user.created_at)}</td>
      <td>${Number(user.order_count) || 0}</td>
      <td>${user.is_active
        ? `<button type="button" class="admin-row-action" data-user-detail="${esc(user.user_id)}">Detail →</button>`
        : `<button type="button" class="admin-row-action activate" data-user-activate="${esc(user.user_id)}">Aktifkan</button>`}</td>
    </tr>`).join('')
    : '<tr><td colspan="8" class="muted">Tidak ada pengguna yang cocok dengan filter.</td></tr>';
}

function openAdminUserDetail(user) {
  const admin = getAdminSession();
  const isSelf = String(user.user_id) === String(admin.user_id);
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `<section class="modal modal-lg admin-user-modal" role="dialog" aria-modal="true" aria-labelledby="user-detail-title">
    <h3 id="user-detail-title">DETAIL PENGGUNA</h3>
    <div class="admin-detail-list">
      <div class="admin-detail-row"><span>Nama</span><span>${esc(user.full_name || '—')}</span></div>
      <div class="admin-detail-row"><span>Email</span><span>${esc(user.email || '—')}</span></div>
      <div class="admin-detail-row"><span>No. HP</span><span>${esc(user.phone || '—')}</span></div>
      <div class="admin-detail-row"><span>Role</span><span>${esc(user.role || 'customer')}</span></div>
      <div class="admin-detail-row"><span>Status</span><span>${user.is_active ? 'Aktif' : 'Diblokir'}</span></div>
      <div class="admin-detail-row"><span>Terdaftar</span><span>${formatUserDate(user.created_at)}</span></div>
      <div class="admin-detail-row"><span>Pesanan</span><span>${Number(user.order_count) || 0}</span></div>
    </div>
    ${isSelf ? '<p class="admin-user-state">Akun admin yang sedang digunakan tidak dapat dinonaktifkan.</p>' : ''}
    <div class="modal-actions">
      <button type="button" class="btn btn-outline" data-user-close>Tutup</button>
      ${!isSelf ? `<button type="button" class="btn ${user.is_active ? 'btn-outline' : 'btn-primary'}" data-user-toggle>
        ${user.is_active ? 'Nonaktifkan akun' : 'Aktifkan akun'}
      </button>` : ''}
    </div>
  </section>`;
  document.body.appendChild(overlay);
  overlay.querySelector('[data-user-close]').onclick = () => overlay.remove();
  overlay.onclick = event => { if (event.target === overlay) overlay.remove(); };
  const toggle = overlay.querySelector('[data-user-toggle]');
  if (toggle) toggle.onclick = () => changeAdminUserStatus(user, !user.is_active, overlay);
}

async function changeAdminUserStatus(user, active, overlay) {
  if (!active && !overlay) return;
  if (!active) {
    return confirmModal({
      title: 'NONAKTIFKAN AKUN?',
      text: `Akun ${user.full_name || user.email} tidak akan dapat masuk atau memesan tiket sampai diaktifkan kembali.`,
      yes: 'Nonaktifkan',
      onYes: () => saveAdminUserStatus(user, false, overlay),
    });
  }
  return saveAdminUserStatus(user, active, overlay);
}

async function saveAdminUserStatus(user, active, overlay) {
  const admin = getAdminSession();
  const button = overlay ? overlay.querySelector('[data-user-toggle]') : null;
  if (button) { button.disabled = true; button.classList.add('is-loading'); }
  const response = await backend('admin_set_user_active', [admin.user_id, user.user_id, active], null);
  if (!response || !response.ok) {
    if (button) { button.disabled = false; button.classList.remove('is-loading'); }
    return toast((response && response.message) || 'Gagal mengubah status akun.', 'error');
  }
  if (overlay) overlay.remove();
  toast(response.warning || response.message, response.warning ? 'warn' : 'success');
  await loadAdminUsers();
}

async function loadAdminUsers() {
  const admin = getAdminSession();
  const response = await backend('get_admin_users', [admin.user_id], null);
  if (!response || !response.ok) {
    toast((response && response.message) || 'Gagal memuat data pengguna.', 'error');
    document.getElementById('users-table-body').innerHTML =
      '<tr><td colspan="8" class="muted">Data pengguna tidak dapat dimuat.</td></tr>';
    return;
  }
  adminUsers = response.users || [];
  renderAdminUsers();
}

async function initAdminUsers() {
  const admin = getAdminSession();
  if (!admin) return window.location.replace('login.html');
  renderAdminLayout('pengguna');

  const applyFilters = () => { usersPage = 1; renderAdminUsers(); };
  document.getElementById('users-query').addEventListener('input', applyFilters);
  document.getElementById('users-role').addEventListener('change', applyFilters);
  document.getElementById('users-status').addEventListener('change', applyFilters);
  document.getElementById('users-top-search').addEventListener('input', event => {
    document.getElementById('users-query').value = event.target.value;
    applyFilters();
  });
  document.getElementById('users-prev').onclick = () => { usersPage--; renderAdminUsers(); };
  document.getElementById('users-next').onclick = () => { usersPage++; renderAdminUsers(); };
  document.getElementById('users-table-body').addEventListener('click', event => {
    const detail = event.target.closest('[data-user-detail]');
    const activate = event.target.closest('[data-user-activate]');
    if (detail) {
      const user = adminUsers.find(item => String(item.user_id) === detail.dataset.userDetail);
      if (user) openAdminUserDetail(user);
    } else if (activate) {
      const user = adminUsers.find(item => String(item.user_id) === activate.dataset.userActivate);
      if (user) changeAdminUserStatus(user, true, null);
    }
  });
  await loadAdminUsers();
}

const ACTIVITY_PER_PAGE = 10;
let activityLogs = [];
let activityPage = 1;

function activityDateKey(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function filteredActivityLogs() {
  const admin = document.getElementById('activity-admin').value;
  const action = document.getElementById('activity-action').value;
  const date = document.getElementById('activity-date').value;
  const query = document.getElementById('activity-top-search').value.trim().toLowerCase();
  return activityLogs.filter(log => {
    const logDay = activityDateKey(log.created_at);
    const searchable = `${log.admin_name || ''} ${log.action || ''} ${log.object_label || ''}`.toLowerCase();
    return (!admin || log.admin_name === admin) &&
      (!action || log.action === action) &&
      (!date || logDay === date) &&
      (!query || searchable.includes(query));
  });
}

function formatActivityTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.toLocaleDateString('id-ID', {day: '2-digit', month: 'short', timeZone: 'Asia/Jakarta'})} · ${date.toLocaleTimeString('id-ID', {hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta'})}`;
}

function renderActivityLogs() {
  const filtered = filteredActivityLogs();
  const pages = Math.max(1, Math.ceil(filtered.length / ACTIVITY_PER_PAGE));
  activityPage = Math.min(activityPage, pages);
  const start = (activityPage - 1) * ACTIVITY_PER_PAGE;
  const visible = filtered.slice(start, start + ACTIVITY_PER_PAGE);

  document.getElementById('activity-count-info').textContent =
    `Menampilkan ${filtered.length} data · Halaman ${activityPage} dari ${pages}`;
  document.getElementById('activity-page-number').textContent = activityPage;
  document.getElementById('activity-prev').disabled = activityPage <= 1;
  document.getElementById('activity-next').disabled = activityPage >= pages;
  document.getElementById('activity-table-body').innerHTML = visible.length
    ? visible.map(log => `<tr>
        <td>${formatActivityTime(log.created_at)}</td>
        <td>${esc(log.admin_name || 'Admin')}</td>
        <td>${esc(log.action || '—')}</td>
        <td>${esc(log.object_label || '—')}</td>
      </tr>`).join('')
    : '<tr><td colspan="4" class="muted">Tidak ada aktivitas yang cocok dengan filter.</td></tr>';
}

async function initAdminActivity() {
  const admin = getAdminSession();
  if (!admin) return window.location.replace('login.html');
  renderAdminLayout('log');

  const response = await backend('get_admin_activity_logs', [admin.user_id], null);
  if (!response || !response.ok) {
    toast((response && response.message) || 'Gagal memuat log aktivitas.', 'error');
    document.getElementById('activity-table-body').innerHTML =
      '<tr><td colspan="4" class="muted">Log aktivitas tidak dapat dimuat.</td></tr>';
    return;
  }
  activityLogs = response.logs || [];

  const admins = [...new Set(activityLogs.map(log => log.admin_name).filter(Boolean))].sort();
  const actions = [...new Set(activityLogs.map(log => log.action).filter(Boolean))].sort();
  const adminSelect = document.getElementById('activity-admin');
  const actionSelect = document.getElementById('activity-action');
  admins.forEach(name => adminSelect.add(new Option(name, name)));
  actions.forEach(action => actionSelect.add(new Option(action, action)));

  [adminSelect, actionSelect, document.getElementById('activity-date')].forEach(input =>
    input.addEventListener('change', () => { activityPage = 1; renderActivityLogs(); }));
  document.getElementById('activity-top-search').addEventListener('input', () => {
    activityPage = 1;
    renderActivityLogs();
  });
  document.getElementById('activity-reset').onclick = () => {
    adminSelect.value = '';
    actionSelect.value = '';
    document.getElementById('activity-date').value = '';
    document.getElementById('activity-top-search').value = '';
    activityPage = 1;
    renderActivityLogs();
  };
  document.getElementById('activity-prev').onclick = () => { activityPage--; renderActivityLogs(); };
  document.getElementById('activity-next').onclick = () => { activityPage++; renderActivityLogs(); };
  renderActivityLogs();
}
/* ----- A8 / A8d / A8e / A8p: Kelola Pengumuman ----- */
let _annList = [];
let _annConcerts = [];
let _annPage = 1;
let _annEditing = null;
let _lastPublishedAnn = null;
const ANN_PER_PAGE = 5;

async function initAdminAnnouncements() {
  const admin = getAdminSession();
  if (!admin) return window.location.replace('login.html');
  renderAdminLayout('pengumuman');

  document.getElementById('btn-create-ann').onclick = () => openAnnouncementEditor(null);
  document.getElementById('btn-back-ann-list').onclick = closeAnnouncementEditor;
  document.getElementById('btn-ed-cancel').onclick = closeAnnouncementEditor;

  const syncFilter = () => { _annPage = 1; renderAnnouncementsTable(); };
  document.getElementById('ann-search-input').addEventListener('input', syncFilter);
  document.getElementById('ann-top-search').addEventListener('input', e => {
    document.getElementById('ann-search-input').value = e.target.value;
    syncFilter();
  });
  document.getElementById('ann-status-filter').addEventListener('change', syncFilter);
  document.getElementById('ann-reset-filter').onclick = () => {
    document.getElementById('ann-search-input').value = '';
    document.getElementById('ann-top-search').value = '';
    document.getElementById('ann-status-filter').value = '';
    syncFilter();
  };

  document.getElementById('ann-prev').onclick = () => { if (_annPage > 1) { _annPage--; renderAnnouncementsTable(); } };
  document.getElementById('ann-next').onclick = () => { _annPage++; renderAnnouncementsTable(); };

  document.getElementById('ed-content').addEventListener('input', updateEditorWordMeta);
  document.querySelectorAll('.ann-rich-toolbar button').forEach(btn => {
    btn.onclick = () => applyEditorFormat(btn.dataset.fmt);
  });

  document.getElementById('btn-ed-preview').onclick = openAnnouncementPreview;
  document.getElementById('btn-ed-draft').onclick = () => saveAnnouncementEditor(false);
  document.getElementById('btn-ed-publish').onclick = () => saveAnnouncementEditor(true);
  document.getElementById('btn-ed-delete').onclick = deleteCurrentAnnouncement;

  document.getElementById('btn-revert-last-draft').onclick = async () => {
    if (!_lastPublishedAnn) return;
    const res = await backend('save_admin_announcement', [admin.user_id, {
      announcement_id: _lastPublishedAnn.announcement_id,
      concert_id: _lastPublishedAnn.concert_id,
      title: _lastPublishedAnn.title,
      content: _lastPublishedAnn.content,
      is_published: false,
    }], null);
    if (!res || !res.ok) return toast((res && res.message) || 'Gagal mengembalikan ke draft.', 'error');
    showAnnBanner('Pengumuman dikembalikan ke Draft', `${_lastPublishedAnn.title} tidak lagi tampil di sisi pengunjung.`);
    _lastPublishedAnn = null;
    document.getElementById('btn-revert-last-draft').hidden = true;
    await loadAdminAnnouncements();
  };

  await loadAdminAnnouncements();
}

async function loadAdminAnnouncements() {
  const admin = getAdminSession();
  const res = await backend('get_admin_announcements', [admin.user_id], null);
  if (!res || !res.ok) {
    toast((res && res.message) || 'Gagal memuat daftar pengumuman.', 'error');
    return;
  }
  _annList = res.announcements || [];
  _annConcerts = res.concerts || [];

  const total = _annList.length;
  const pub = _annList.filter(a => a.is_published).length;
  const draft = total - pub;
  const pad2 = n => String(n).padStart(2, '0');

  document.getElementById('ann-kpi-total').textContent = pad2(total);
  document.getElementById('ann-kpi-pub').textContent = pad2(pub);
  document.getElementById('ann-kpi-draft').textContent = pad2(draft);

  const cSel = document.getElementById('ed-concert');
  cSel.innerHTML = _annConcerts.map(c => `<option value="${c.concert_id}">${esc(c.title)}</option>`).join('');

  renderAnnouncementsTable();
}

function renderAnnouncementsTable() {
  const q = document.getElementById('ann-search-input').value.trim().toLowerCase();
  const st = document.getElementById('ann-status-filter').value;
  const filtered = _annList.filter(a => {
    const matchQ = !q || (a.title || '').toLowerCase().includes(q);
    const matchSt = !st || (st === 'published' ? a.is_published : !a.is_published);
    return matchQ && matchSt;
  });

  const pages = Math.max(1, Math.ceil(filtered.length / ANN_PER_PAGE));
  _annPage = Math.min(Math.max(1, _annPage), pages);
  const start = (_annPage - 1) * ANN_PER_PAGE;
  const slice = filtered.slice(start, start + ANN_PER_PAGE);

  document.getElementById('ann-count-info').textContent = filtered.length
    ? `Menampilkan ${start + 1}–${start + slice.length} dari ${filtered.length} pengumuman`
    : 'Menampilkan 0 pengumuman';
  document.getElementById('ann-page-no').textContent = _annPage;
  document.getElementById('ann-prev').disabled = _annPage <= 1;
  document.getElementById('ann-next').disabled = _annPage >= pages;

  const tbody = document.getElementById('ann-table-body');
  if (!slice.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="muted">Belum ada pengumuman yang cocok.</td></tr>';
    return;
  }

  tbody.innerHTML = slice.map(a => {
    const dt = a.published_at || a.created_at;
    const dStr = dt
      ? `${new Date(dt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })} · ${new Date(dt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).replace('.', ':')}`
      : '—';
    const stHtml = a.is_published
      ? '<span style="color:#22c55e">Published</span>'
      : '<span style="color:#f59e0b">Draft</span>';
    return `<tr>
      <td>
        <div style="font-weight:500">${esc(a.title)}</div>
        <div class="muted" style="font-size:11px">The Weeknd · Jakarta 2027</div>
      </td>
      <td>${esc(a.author_name || 'Admin Publikasi')}</td>
      <td>${stHtml}</td>
      <td class="muted">${dStr}</td>
      <td><button type="button" class="admin-row-action" data-edit-ann="${a.announcement_id}">${a.is_published ? 'Lihat ↗' : 'Edit →'}</button></td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-edit-ann]').forEach(btn => {
    btn.onclick = () => {
      const item = _annList.find(x => String(x.announcement_id) === btn.dataset.editAnn);
      if (item) openAnnouncementEditor(item);
    };
  });
}

function showAnnBanner(title, desc) {
  const el = document.getElementById('ann-status-banner');
  el.hidden = false;
  el.innerHTML = `<span class="ann-feedback-ico">✓</span><div><strong style="display:block;margin-bottom:2px">${esc(title)}</strong><span class="muted">${esc(desc)}</span></div>`;
}

function openAnnouncementEditor(item) {
  _annEditing = item;
  const admin = getAdminSession() || {};
  document.getElementById('ann-list-view').hidden = true;
  document.getElementById('ann-editor-view').hidden = false;

  document.getElementById('ed-title').value = item ? item.title : '';
  document.getElementById('ed-content').value = item ? item.content : '';
  if (item && item.concert_id) document.getElementById('ed-concert').value = String(item.concert_id);

  const isPub = Boolean(item && item.is_published);
  const badge = document.getElementById('ed-state-label');
  badge.textContent = isPub ? 'Published' : 'Draft';
  badge.className = `ann-badge-state ${isPub ? 'published' : ''}`;
  document.getElementById('ed-vis-title').textContent = isPub
    ? 'Published / Tampil di pengunjung'
    : 'Draft / Belum dipublikasikan';
  document.getElementById('ed-author-name').textContent = (item && item.author_name) || admin.full_name || 'Admin Publikasi';
  document.getElementById('btn-ed-delete').hidden = !item;

  updateEditorWordMeta();
}

function closeAnnouncementEditor() {
  _annEditing = null;
  document.getElementById('ann-editor-view').hidden = true;
  document.getElementById('ann-list-view').hidden = false;
}

function updateEditorWordMeta() {
  const txt = document.getElementById('ed-content').value.trim();
  const words = txt ? txt.split(/\s+/).length : 0;
  const dt = _annEditing && (_annEditing.published_at || _annEditing.created_at);
  const stamp = dt
    ? `Terakhir diubah ${new Date(dt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}, ${new Date(dt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).replace('.', ':')} WIB`
    : 'Belum disimpan';
  document.getElementById('ed-word-meta').textContent = `${words} kata · ${stamp}`;
}

function applyEditorFormat(fmt) {
  const ta = document.getElementById('ed-content');
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const sel = ta.value.slice(start, end) || 'teks';
  const map = {
    bold: `**${sel}**`,
    italic: `_${sel}_`,
    bullet: `\n• ${sel}`,
    number: `\n1. ${sel}`,
    link: `${sel} (https://)`,
  };
  const rep = map[fmt] || sel;
  ta.setRangeText(rep, start, end, 'end');
  ta.focus();
  updateEditorWordMeta();
}

function openAnnouncementPreview() {
  const title = document.getElementById('ed-title').value.trim() || 'JUDUL PENGUMUMAN';
  const content = document.getElementById('ed-content').value.trim() || 'Belum ada isi pengumuman.';
  const admin = getAdminSession() || {};
  const words = content.split(/\s+/).length;
  const readMin = Math.max(1, Math.ceil(words / 120));
  const todayStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const isPub = Boolean(_annEditing && _annEditing.is_published);

  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `
    <div class="ann-preview-modal" role="dialog" aria-modal="true">
      <div class="ann-preview-head">
        <span style="font-size:11px;letter-spacing:0.08em;color:${isPub ? '#22c55e' : '#f59e0b'}">
          PRATINJAU PENGUMUMAN / ${isPub ? 'PUBLISHED' : 'BELUM TAYANG'}
        </span>
        <button type="button" class="btn btn-outline" id="pv-close" style="height:36px;padding:0 16px">Tutup ×</button>
      </div>

      <div class="ann-visual-banner">
        <small>AFTER HOURS / JAKARTA 2027</small>
        <div class="ann-visual-heading">THE NIGHT<br>STARTS HERE.</div>
        <span class="ann-visual-foot">VISUAL KONSEP · TANPA FOTO ASLI ARTIS</span>
      </div>

      <h2 class="ann-preview-title">${esc(title.toUpperCase())}</h2>
      <p class="muted" style="font-size:12px">Oleh ${esc(admin.full_name || 'Admin Publikasi')} · ${todayStr} · ${readMin} menit baca</p>
      <div class="ann-preview-body">${esc(content)}</div>

      <div class="ann-preview-actions">
        <button type="button" class="btn btn-outline" id="pv-back">Kembali ke Editor</button>
        <button type="button" class="btn btn-primary" id="pv-publish">Publikasikan →</button>
      </div>
      <p class="muted" style="font-size:11px">Tampilan simulasi sisi pengunjung. Tidak ada publikasi ke layanan eksternal.</p>
    </div>`;

  ov.querySelector('#pv-close').onclick = () => ov.remove();
  ov.querySelector('#pv-back').onclick = () => ov.remove();
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
  ov.querySelector('#pv-publish').onclick = async () => {
    ov.remove();
    await saveAnnouncementEditor(true);
  };
  document.body.appendChild(ov);
}

async function saveAnnouncementEditor(publish) {
  const admin = getAdminSession();
  const title = document.getElementById('ed-title').value.trim();
  const content = document.getElementById('ed-content').value.trim();
  const concertId = Number(document.getElementById('ed-concert').value) || 1;

  const btn = document.getElementById(publish ? 'btn-ed-publish' : 'btn-ed-draft');
  btn.classList.add('is-loading');
  btn.disabled = true;

  const res = await backend('save_admin_announcement', [admin.user_id, {
    announcement_id: _annEditing ? _annEditing.announcement_id : null,
    concert_id: concertId,
    title,
    content,
    is_published: publish,
  }], null);

  btn.classList.remove('is-loading');
  btn.disabled = false;

  if (!res || !res.ok) {
    toast((res && res.message) || 'Gagal menyimpan pengumuman.', 'error');
    return;
  }

  closeAnnouncementEditor();
  await loadAdminAnnouncements();

  if (publish) {
    _lastPublishedAnn = res.item || null;
    document.getElementById('btn-revert-last-draft').hidden = !_lastPublishedAnn;
    showAnnBanner('Pengumuman berhasil dipublikasikan', `${title} kini tampil di sisi pengunjung.`);
  } else {
    showAnnBanner('Draft pengumuman tersimpan', `${title} disimpan sebagai draft.`);
  }
  if (res.warning) toast(res.warning, 'warn');
}

function deleteCurrentAnnouncement() {
  if (!_annEditing) return;
  const admin = getAdminSession();
  confirmModal({
    title: 'HAPUS PENGUMUMAN?',
    text: `Pengumuman "${_annEditing.title}" akan dihapus permanen.`,
    yes: 'Hapus',
    onYes: async () => {
      const res = await backend('delete_admin_announcement', [admin.user_id, _annEditing.announcement_id], null);
      if (!res || !res.ok) return toast((res && res.message) || 'Gagal menghapus pengumuman.', 'error');
      closeAnnouncementEditor();
      toast(res.warning || 'Pengumuman berhasil dihapus.', res.warning ? 'warn' : 'success');
      await loadAdminAnnouncements();
    },
  });
}
/* ===== OVERRIDE PROFIL TOPBAR, SIDEBAR BAWAH & HALAMAN PROFIL ===== */
function setupAdminProfileTriggers(displayName) {
  const icoProfile = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
  const icoLogout = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>`;

  const triggerLogout = () => {
    const logoutBtn = document.getElementById("admin-logout");
    if (logoutBtn) logoutBtn.click();
  };

  // 1. Klik kartu profil di pojok kiri bawah sidebar -> buka profile.html
  const sideUser = document.querySelector(".adm-side-bot .adm-user");
  if (sideUser) {
    sideUser.classList.add("adm-user-link");
    sideUser.title = "Buka halaman profil";
    sideUser.onclick = () => {
      window.location.href = "profile.html";
    };
  }

  // 2. Ubah ikon lonceng kanan atas menjadi tombol Profil + dropdown card
  const bellBtn = document.querySelector(".adm-top-actions .adm-bell");
  const topName = document.getElementById("top-admin-name");
  if (!bellBtn) return;

  const wrap = document.createElement("div");
  wrap.className = "adm-profile-menu-wrap";
  wrap.innerHTML = `
    <button type="button" class="adm-profile-trigger" id="adm-profile-btn" aria-expanded="false" title="Menu Profil">
      <span class="adm-bell">${icoProfile}</span>
      <span style="font-size:13px">${esc(displayName)}</span>
    </button>
    <div class="adm-profile-dropdown" id="adm-profile-dropdown" hidden>
      <div class="adm-drop-head">
        <strong>${esc(displayName)}</strong>
        <span>Tim publikasi</span>
      </div>
      <a href="profile.html" class="adm-drop-item">${icoProfile}<span>Profil</span></a>
      <button type="button" class="adm-drop-item danger" id="adm-drop-logout">${icoLogout}<span>Keluar</span></button>
    </div>`;

  bellBtn.replaceWith(wrap);
  if (topName) topName.remove();

  const btn = wrap.querySelector("#adm-profile-btn");
  const menu = wrap.querySelector("#adm-profile-dropdown");

  btn.onclick = (e) => {
    e.stopPropagation();
    const open = menu.hidden;
    menu.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
  };

  wrap.querySelector("#adm-drop-logout").onclick = () => {
    menu.hidden = true;
    triggerLogout();
  };

  document.addEventListener("click", (e) => {
    if (!wrap.contains(e.target)) {
      menu.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    }
  });
}

const _origRenderAdminLayout = renderAdminLayout;
renderAdminLayout = function (activeMenu) {
  _origRenderAdminLayout(activeMenu);
  const admin = getAdminSession();
  const displayName = (admin && admin.full_name) || "Admin Publikasi";
  setupAdminProfileTriggers(displayName);
};

async function initAdminProfile() {
  const admin = getAdminSession();
  if (!admin) return window.location.replace("login.html");
  renderAdminLayout("profil");

  const res = await backend("get_admin_profile", [admin.user_id], null);
  const p = (res && res.ok && res.profile) ? res.profile : admin;

  document.getElementById("prof-card-name").textContent = p.full_name || "Admin Publikasi";
  document.getElementById("prof-card-email").textContent = p.email || "-";
  document.getElementById("prof-card-role").textContent = (p.role || "admin").toUpperCase();
  document.getElementById("prof-card-joined").textContent = p.created_at
    ? new Date(p.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
    : "-";

  document.getElementById("prof-name").value = p.full_name || "";
  document.getElementById("prof-email").value = p.email || "";
  document.getElementById("prof-phone").value = p.phone || "";

  document.getElementById("adm-profile-form").onsubmit = async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById("btn-save-profile");
    saveBtn.classList.add("is-loading");
    saveBtn.disabled = true;

    const upRes = await backend("update_admin_profile", [admin.user_id, {
      full_name: document.getElementById("prof-name").value.trim(),
      phone: document.getElementById("prof-phone").value.trim(),
      new_password: document.getElementById("prof-pass").value,
    }], null);

    saveBtn.classList.remove("is-loading");
    saveBtn.disabled = false;

    if (!upRes || !upRes.ok) {
      toast((upRes && upRes.message) || "Gagal menyimpan profil.", "error");
      return;
    }

    const updatedUser = { ...admin, ...upRes.profile };
    Auth.set(updatedUser);
    document.getElementById("prof-pass").value = "";
    toast(upRes.warning || "Profil admin berhasil diperbarui!", upRes.warning ? "warn" : "success");
    initAdminProfile();
  };
}