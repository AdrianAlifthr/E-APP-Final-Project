# The Weeknd · After Hours Til Dawn — E-App Tiket

## Menjalankan (Mac / VS Code)
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```
Butuh Python 3.10+ dan Google Chrome. Konfigurasi `SUPABASE_URL` dan
`SUPABASE_PUBLISHABLE_KEY` harus tersedia di file `.env` pada folder proyek.

## Modul admin

Panel admin memiliki halaman Dashboard, Konser, Kategori Tiket, Pesanan,
Pembayaran, Laporan, Pengguna, dan Log Aktivitas.

Sebelum membuka Log Aktivitas, jalankan migrasi
`sql/migrations/20261119_activity_logs.sql` pada SQL Editor Supabase.
Migrasi ini membuat tabel log baca-saja untuk admin; perubahan akun pengguna,
informasi konser, venue, pembayaran, pesanan, kategori, voucher, dan pengumuman
akan dicatat.

## Akun demo
- Fans: fan@afterhours.example / fan12345
- Admin: admin@afterhours.example / admin12345
- Voucher: AFTER10 (10%), DAWN5 (5%)
- Kartu uji: nomor berakhiran 0002 ditolak, lainnya berhasil

Data aplikasi disimpan di Supabase.
