const REPORT_LABEL = new Intl.NumberFormat('id-ID');
let reportData = null;
let reportRows = [];

function reportDateKey(value) {
  const date = value instanceof Date ? value : reportDate(value);
  if (!date) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function reportDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function reportRange() {
  const start = document.getElementById('report-start').value;
  const end = document.getElementById('report-end').value;
  if (start && end && start > end) {
    toast('Tanggal mulai tidak boleh melewati tanggal akhir.', 'error');
    return null;
  }
  return {start, end};
}

function buildReport(range, categoryId) {
  const categories = reportData.categories || [];
  const categoryMap = new Map(categories.map(c => [String(c.category_id), c]));
  const orderMap = new Map((reportData.orders || [])
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
    const orderItems = (reportData.items || []).filter(it => String(it.order_id) === orderId);
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

  return {rows, ticketCount, revenue, discount};
}

function renderReport() {
  const range = reportRange();
  if (!range) return;
  const categoryId = document.getElementById('report-category').value;
  const result = buildReport(range, categoryId);
  reportRows = result.rows;

  document.getElementById('report-tickets').textContent = REPORT_LABEL.format(result.ticketCount);
  document.getElementById('report-revenue').textContent = rupiah(Math.round(result.revenue));
  document.getElementById('report-discount').textContent = rupiah(Math.round(result.discount));

  const dateDescription = range.start || range.end
    ? `Periode ${range.start ? tanggal(range.start) : 'awal'} – ${range.end ? tanggal(range.end) : 'terbaru'}`
    : 'Seluruh periode penjualan';
  document.getElementById('report-caption').textContent = `${dateDescription} · hanya pesanan lunas.`;

  const max = Math.max(1, ...reportRows.map(r => r.quantity));
  document.getElementById('report-chart').innerHTML = reportRows.length
    ? reportRows.map(row => {
      const height = row.quantity ? Math.max(4, Math.round(row.quantity / max * 100)) : 0;
      return `<div class="report-bar">
        <span class="report-bar-count">${REPORT_LABEL.format(row.quantity)}</span>
        <div class="report-bar-track"><div class="report-bar-fill" style="height:${height}%"></div></div>
        <span class="report-bar-label">${esc(row.name)}</span>
      </div>`;
    }).join('')
    : '<p class="muted">Tidak ada kategori tiket.</p>';

  const body = document.getElementById('report-table-body');
  body.innerHTML = reportRows.length
    ? reportRows.map(row => `<tr>
        <td>${esc(row.name)}</td>
        <td>${REPORT_LABEL.format(row.quantity)}</td>
        <td>${rupiah(row.unit_price)}</td>
        <td>${rupiah(Math.round(row.discount))}</td>
        <td>${rupiah(Math.round(row.revenue))}</td>
      </tr>`).join('')
    : '<tr><td colspan="5" class="muted">Tidak ada data penjualan.</td></tr>';
}

function exportReportCsv() {
  if (!reportRows.length) return toast('Tidak ada data untuk diekspor.', 'warn');
  const rows = [['Kategori', 'Tiket terjual', 'Harga satuan', 'Diskon', 'Pendapatan']];
  reportRows.forEach(row => rows.push([
    row.name, row.quantity, Math.round(row.unit_price), Math.round(row.discount), Math.round(row.revenue),
  ]));
  const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob(['\ufeff', csv], {type: 'text/csv;charset=utf-8;'});
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `laporan-penjualan-${reportDateKey(new Date())}.csv`;
  const url = link.href;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function initAdminReports() {
  const admin = getAdminSession();
  if (!admin) return window.location.replace('login.html');
  renderAdminLayout('laporan');

  const response = await backend('get_admin_sales_report', [admin.user_id], null);
  if (!response || !response.ok) {
    toast((response && response.message) || 'Gagal memuat laporan penjualan.', 'error');
    document.getElementById('report-table-body').innerHTML =
      '<tr><td colspan="5" class="muted">Laporan tidak dapat dimuat.</td></tr>';
    return;
  }
  reportData = response;
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
    const option = [...select.options].find(item =>
      item.textContent.toLowerCase().includes(event.target.value.trim().toLowerCase()));
    if (event.target.value.trim() && option) select.value = option.value;
    else if (!event.target.value.trim()) select.value = '';
    renderReport();
  };
  document.getElementById('report-export-csv').onclick = exportReportCsv;
  document.getElementById('report-export-pdf').onclick = () => window.print();
  renderReport();
}

document.addEventListener('DOMContentLoaded', initAdminReports);
