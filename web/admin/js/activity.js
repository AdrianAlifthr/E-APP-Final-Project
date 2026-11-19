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

document.addEventListener('DOMContentLoaded', initAdminActivity);
