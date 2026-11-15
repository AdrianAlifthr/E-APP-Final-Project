/* ===== U14 · FAQ & Ketentuan ===== */
const FAQ = [
  ['Berapa batas pembelian tiket?', 'Maksimal 4 tiket per akun. Pastikan nama setiap pemegang sesuai identitas.'],
  ['Apa saja barang yang dilarang?', 'Senjata, benda tajam, narkotika, kamera profesional, serta makanan dan minuman dari luar tidak diperbolehkan.'],
  ['Apakah tiket bisa direfund?', 'Tiket yang sudah dibayar tidak dapat dikembalikan, kecuali konser dibatalkan oleh penyelenggara.'],
  ['Berapa batas usia penonton?', 'Minimal 16 tahun. Penonton di bawah 18 tahun wajib didampingi orang dewasa.'],
  ['Bagaimana cara memakai e-ticket?', 'Buka menu Pesanan Saya, pilih Lihat E-Ticket, lalu tunjukkan QR dan identitas saat check-in.'],
  ['Pukul berapa gate dibuka?', 'Gate dibuka pukul 16.00 WIB. Pertunjukan dimulai pukul 20.00 WIB.']
];
const TERMS = [
  'Tiket hanya berlaku untuk satu orang pada tanggal acara yang tercantum.',
  'QR hanya dapat digunakan sekali. Jangan membagikan kode tiket kepada orang lain.',
  'Bawa identitas asli sesuai nama pada tiket. Harga termasuk pajak dan biaya layanan.',
  'Ikuti arahan petugas, aturan keamanan, dan ketentuan venue.',
  'Informasi dalam proyek ini adalah simulasi akademik, bukan pengumuman konser resmi.'
];

function renderFaq(openIdx){
  document.getElementById('faq-list').innerHTML = FAQ.map(([q, a], i) => `
    <button class="faq-item" aria-expanded="${i === openIdx}" aria-controls="faq-a-${i}" data-i="${i}">
      <span class="faq-q">${esc(q)} <span aria-hidden="true">${i === openIdx ? '−' : '+'}</span></span>
      <span class="faq-a" id="faq-a-${i}" ${i === openIdx ? '' : 'hidden'}>${esc(a)}</span>
    </button>`).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  renderLayout('U14');
  let open = 0;                                   // satu terbuka pada satu waktu
  renderFaq(open);
  document.getElementById('faq-list').addEventListener('click', e => {
    const b = e.target.closest('[data-i]'); if (!b) return;
    const i = Number(b.dataset.i);
    open = open === i ? -1 : i;
    renderFaq(open);
    const again = document.querySelector(`[data-i="${i}"]`); if (again) again.focus();
  });
  document.getElementById('terms').insertAdjacentHTML('beforeend',
    TERMS.map((t, i) => `<p><span>0${i + 1}</span>${esc(t)}</p>`).join(''));
});
