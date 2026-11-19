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

document.addEventListener('DOMContentLoaded', initAdminUsers);
