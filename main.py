"""Entry point aplikasi (Python + Eel).
Jalankan:  pip install eel   lalu   python main.py
Data di bawah masih MOCK (disimpan di memori). Ganti isi fungsi dengan query Supabase.
Akun demo:  fan@afterhours.example / fan12345   |   admin@afterhours.example / admin12345
"""
import hashlib
import hmac
import os
import re
import secrets
import threading
import time
from datetime import datetime

import eel

eel.init("web")

# TODO (Supabase): from database import supabase
# contoh: supabase.table("ticket_categories").select("*").eq("concert_id", 1).execute().data


# ---------- util password (PBKDF2; di produksi pakai bcrypt / Supabase Auth) ----------
def _hash(password: str, salt: bytes | None = None) -> str:
    salt = salt or os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100_000)
    return salt.hex() + ":" + digest.hex()


def _verify(password: str, stored: str) -> bool:
    salt_hex, digest_hex = stored.split(":")
    candidate = _hash(password, bytes.fromhex(salt_hex)).split(":")[1]
    return hmac.compare_digest(candidate, digest_hex)


_USERS = {
    "fan@afterhours.example": {"user_id": "u-001", "full_name": "Demo Fans", "email": "fan@afterhours.example",
                               "phone": "081234567890", "role": "customer", "is_active": True,
                               "password_hash": _hash("fan12345")},
    "admin@afterhours.example": {"user_id": "u-002", "full_name": "Admin Publikasi", "email": "admin@afterhours.example",
                                 "phone": "081200000000", "role": "admin", "is_active": True,
                                 "password_hash": _hash("admin12345")},
}

_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")
_PHONE_RE = re.compile(r"^(\+62|62|0)8\d{7,12}$")


# ---------- Auth ----------
@eel.expose
def register_user(data):
    full_name = (data.get("full_name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    phone = (data.get("phone") or "").strip()
    password = data.get("password") or ""
    # validasi ulang di server (jangan percaya front-end)
    if len(full_name) < 3:
        return {"ok": False, "field": "full_name", "message": "Nama lengkap minimal 3 karakter"}
    if not _EMAIL_RE.match(email):
        return {"ok": False, "field": "email", "message": "Format email tidak valid"}
    if not _PHONE_RE.match(phone):
        return {"ok": False, "field": "phone", "message": "Nomor HP tidak valid"}
    if len(password) < 8:
        return {"ok": False, "field": "password", "message": "Password minimal 8 karakter"}
    if email in _USERS:
        return {"ok": False, "field": "email", "message": "Email sudah digunakan"}
    _USERS[email] = {"user_id": f"u-{len(_USERS) + 1:03d}", "full_name": full_name, "email": email,
                     "phone": phone, "role": "customer", "is_active": True, "password_hash": _hash(password)}
    return {"ok": True}


@eel.expose
def login_user(email, password):
    user = _USERS.get((email or "").strip().lower())
    if not user or not _verify(password or "", user["password_hash"]):
        return {"ok": False, "message": "Email atau password salah"}
    if not user["is_active"]:
        return {"ok": False, "message": "Akun dinonaktifkan, hubungi panitia"}
    return {"ok": True, "user": {k: user[k] for k in ("user_id", "full_name", "email", "phone", "role")}}


# ---------- Konser & tiket ----------
_CATEGORIES = [
    {"category_id": 1, "name": "VIP", "price": 2500000, "quota": 500, "sold": 180,
     "description": "Akses prioritas · area premium"},
    {"category_id": 2, "name": "CAT 1", "price": 1500000, "quota": 2000, "sold": 1916,
     "description": "Tribune dengan pandangan terbaik"},
    {"category_id": 3, "name": "CAT 2", "price": 1000000, "quota": 5000, "sold": 3800,
     "description": "Tribune reguler · tempat duduk"},
    {"category_id": 4, "name": "FESTIVAL", "price": 850000, "quota": 8000, "sold": 8000,
     "description": "Area berdiri dekat panggung"},
]
for _c in _CATEGORIES:
    _c.update(sale_start="2027-04-09", sale_end="2027-08-13")


@eel.expose
def get_concert_info():
    return {"title": "THE WEEKND", "tagline": "AFTER HOURS TIL DAWN",
            "concert_date": "2027-08-14T20:00:00+07:00", "min_price": 850000}


@eel.expose
def get_ticket_categories():
    with _LOCK:
        _expire_overdue()
        return [dict(c) for c in _CATEGORIES]


@eel.expose
def check_quota(items):
    """Cek cepat dari halaman U4 (belum menahan kuota). Validasi final ada di create_order."""
    with _LOCK:
        _expire_overdue()
        if sum(i["quantity"] for i in items) > MAX_PER_ACCOUNT:
            return {"ok": False, "message": "Maksimal 4 tiket per akun."}
        for i in items:
            cat = _cat(i["category_id"])
            if not cat or cat["quota"] - cat["sold"] < i["quantity"]:
                return {"ok": False, "message": f"Kuota {cat['name'] if cat else 'kategori ini'} tidak mencukupi."}
    return {"ok": True}



# =====================================================================
# PESANAN (U5–U7). Mock di memori; di Supabase ini = tabel orders, order_items,
# payments, tickets. Penahanan kuota HARUS atomic (UPDATE ... WHERE sold + qty <= quota
# atau fungsi RPC) agar tidak oversell saat banyak pembeli bersamaan.
# =====================================================================
_LOCK = threading.RLock()
_ORDERS = {}
_ORDER_SEQ = [127]
HOLD_MS = 15 * 60 * 1000          # batas bayar 15 menit
MAX_PER_ACCOUNT = 4
_VOUCHERS = {
    "AFTER10": {"type": "percent", "value": 10, "max_usage": 100, "used": 0, "active": True},
    "DAWN5": {"type": "percent", "value": 5, "max_usage": 50, "used": 0, "active": True},
}
# kode: (label, jenis, prefix nomor)
_METHODS = {
    "bca": ("BCA Virtual Account", "va", "80777"),
    "mandiri": ("Mandiri Virtual Account", "va", "88608"),
    "bni": ("BNI Virtual Account", "va", "8808"),
    "gopay": ("GoPay", "ewallet", "70001"),
    "ovo": ("OVO", "ewallet", "70002"),
    "dana": ("DANA", "ewallet", "70003"),
    "card": ("Visa / Mastercard", "card", ""),
}


def _now_ms():
    return int(time.time() * 1000)


def _cat(category_id):
    return next((c for c in _CATEGORIES if c["category_id"] == category_id), None)


def _user_by_id(user_id):
    return next((u for u in _USERS.values() if u["user_id"] == user_id), None)


def _release(order):
    for it in order["items"]:
        cat = _cat(it["category_id"])
        if cat:
            cat["sold"] = max(0, cat["sold"] - it["quantity"])


def _expire_overdue():
    """Pesanan pending yang lewat batas waktu -> expired, kuota dikembalikan. (panggil dalam _LOCK)"""
    now = _now_ms()
    for o in _ORDERS.values():
        if o["status"] == "pending" and now >= o["expires_at_ms"]:
            o["status"] = "expired"
            _release(o)


def _public(o):
    out = {k: v for k, v in o.items() if k != "user_id"}
    out["expires_in_ms"] = max(0, o["expires_at_ms"] - _now_ms())
    return out


def _mine(order_id, user_id):
    o = _ORDERS.get(order_id)
    return o if o and o["user_id"] == user_id else None


def _recalc(o):
    v = _VOUCHERS.get(o["voucher_code"]) if o["voucher_code"] else None
    disc = 0
    if v:
        disc = round(o["subtotal"] * v["value"] / 100) if v["type"] == "percent" else v["value"]
    o["discount"] = min(disc, o["subtotal"])
    o["total"] = o["subtotal"] - o["discount"]


@eel.expose
def create_order(user_id, items, holders):
    with _LOCK:
        _expire_overdue()
        user = _user_by_id(user_id)
        if not user or not user["is_active"]:
            return {"ok": False, "message": "Sesi tidak valid. Silakan masuk lagi."}
        want = {}
        for i in items:
            if not isinstance(i.get("quantity"), int) or i["quantity"] < 1:
                return {"ok": False, "message": "Jumlah tiket tidak valid."}
            want[i["category_id"]] = want.get(i["category_id"], 0) + i["quantity"]
        total_qty = sum(want.values())
        if total_qty < 1:
            return {"ok": False, "message": "Belum ada tiket dipilih."}
        owned = sum(it["quantity"] for o in _ORDERS.values()
                    if o["user_id"] == user_id and o["status"] in ("pending", "paid") for it in o["items"])
        if owned + total_qty > MAX_PER_ACCOUNT:
            return {"ok": False, "message": f"Batas {MAX_PER_ACCOUNT} tiket per akun. Kamu sudah memiliki {owned} tiket."}
        # data pemegang harus pas 1 per tiket
        count_h = {}
        for h in holders:
            if len((h.get("holder_name") or "").strip()) < 3:
                return {"ok": False, "message": "Nama pemegang tiket minimal 3 karakter."}
            if h.get("holder_id_no") and not re.fullmatch(r"[A-Za-z0-9]{6,20}", h["holder_id_no"]):
                return {"ok": False, "message": "Nomor identitas tidak valid."}
            count_h[h["category_id"]] = count_h.get(h["category_id"], 0) + 1
        if count_h != want:
            return {"ok": False, "message": "Data pemegang tidak sesuai jumlah tiket."}
        for cid, qty in want.items():
            cat = _cat(cid)
            if not cat or cat["quota"] - cat["sold"] < qty:
                return {"ok": False, "message": f"Kuota {cat['name'] if cat else 'kategori'} tidak mencukupi."}
        # tahan kuota
        order_items, subtotal = [], 0
        for cid, qty in want.items():
            cat = _cat(cid)
            cat["sold"] += qty
            line = cat["price"] * qty
            subtotal += line
            order_items.append({"category_id": cid, "name": cat["name"], "quantity": qty,
                                "unit_price": cat["price"], "subtotal": line})
        _ORDER_SEQ[0] += 1
        order_id = secrets.token_hex(8)
        now = _now_ms()
        o = {
            "order_id": order_id,
            "order_code": f"TW-{datetime.now():%y%m%d}-{_ORDER_SEQ[0]:04d}",
            "user_id": user_id, "items": order_items,
            "holders": [{"category_id": h["category_id"], "holder_name": h["holder_name"].strip(),
                         "holder_id_no": (h.get("holder_id_no") or "").strip()} for h in holders],
            "subtotal": subtotal, "discount": 0, "voucher_code": "", "total": subtotal,
            "status": "pending", "created_at_ms": now, "expires_at_ms": now + HOLD_MS,
            "payment": None, "tickets": [],
        }
        _ORDERS[order_id] = o
        return {"ok": True, "order": _public(o)}


@eel.expose
def get_order(order_id, user_id):
    with _LOCK:
        _expire_overdue()
        o = _mine(order_id, user_id)
        return {"ok": True, "order": _public(o)} if o else {"ok": False, "message": "Pesanan tidak ditemukan."}


@eel.expose
def apply_voucher(order_id, user_id, code):
    with _LOCK:
        _expire_overdue()
        o = _mine(order_id, user_id)
        if not o or o["status"] != "pending":
            return {"ok": False, "message": "Pesanan tidak dapat diubah."}
        code = (code or "").strip().upper()
        if not code:
            return {"ok": False, "message": "Masukkan kode voucher."}
        v = _VOUCHERS.get(code)
        if not v or not v["active"] or v["used"] >= v["max_usage"]:
            return {"ok": False, "message": "Kode voucher tidak valid atau sudah tidak berlaku."}
        o["voucher_code"] = code
        _recalc(o)
        if o["payment"]:
            o["payment"]["amount"] = o["total"]
        return {"ok": True, "order": _public(o), "message": f"Voucher {code} berhasil dipakai."}


@eel.expose
def select_payment(order_id, user_id, method):
    with _LOCK:
        _expire_overdue()
        o = _mine(order_id, user_id)
        if not o or o["status"] != "pending":
            return {"ok": False, "message": "Waktu pembayaran habis atau pesanan tidak ditemukan."}
        if method not in _METHODS:
            return {"ok": False, "message": "Metode pembayaran tidak dikenal."}
        label, kind, prefix = _METHODS[method]
        account_no = account_display = None
        if kind != "card":
            digits = re.sub(r"\D", "", _user_by_id(user_id)["phone"])
            if digits.startswith("62"):
                digits = "0" + digits[2:]
            account_no = prefix + digits
            groups = " ".join(digits[i:i + 4] for i in range(0, len(digits), 4))
            account_display = f"{prefix} {groups}"
        o["payment"] = {"method": method, "label": label, "kind": kind, "account_no": account_no,
                        "account_display": account_display, "amount": o["total"], "status": "pending",
                        "reference_no": "PAY-" + o["order_code"]}
        return {"ok": True, "order": _public(o)}


@eel.expose
def pay_order(order_id, user_id, card=None):
    """SIMULASI. Di produksi, status 'paid' berasal dari notifikasi (webhook) payment gateway, bukan dari klien."""
    with _LOCK:
        _expire_overdue()
        o = _mine(order_id, user_id)
        if not o:
            return {"ok": False, "message": "Pesanan tidak ditemukan."}
        if o["status"] == "expired":
            return {"ok": False, "expired": True, "message": "Waktu pembayaran habis."}
        if o["status"] != "pending" or not o["payment"]:
            return {"ok": False, "message": "Pesanan tidak dapat dibayar."}
        if o["payment"]["kind"] == "card":
            number = re.sub(r"\D", "", (card or {}).get("number", ""))
            if not re.fullmatch(r"\d{13,19}", number):
                return {"ok": False, "message": "Nomor kartu tidak valid."}
            if number.endswith("0002"):                       # kartu uji: selalu ditolak
                o["payment"]["status"] = "failed"
                return {"ok": False, "message": "Kartu ditolak oleh bank penerbit."}
        v = _VOUCHERS.get(o["voucher_code"]) if o["voucher_code"] else None
        if v:
            if v["used"] >= v["max_usage"]:
                return {"ok": False, "message": "Kuota voucher sudah habis."}
            v["used"] += 1
        o["status"] = "paid"
        o["payment"]["status"] = "success"
        o["payment"]["paid_at_ms"] = _now_ms()
        o["tickets"] = [{"ticket_code": "TWK-" + secrets.token_hex(4).upper(), "category_id": h["category_id"],
                         "holder_name": h["holder_name"], "status": "valid",
                         "category_name": (_cat(h["category_id"]) or {}).get("name", "")} for h in o["holders"]]
        return {"ok": True, "order": _public(o)}


@eel.expose
def cancel_order(order_id, user_id):
    with _LOCK:
        _expire_overdue()
        o = _mine(order_id, user_id)
        if not o:
            return {"ok": True}
        if o["status"] == "paid":
            return {"ok": False, "message": "Pesanan sudah dibayar dan tidak dapat dibatalkan di sini."}
        if o["status"] == "pending":
            o["status"] = "cancelled"
            _release(o)
        return {"ok": True}



@eel.expose
def list_orders(user_id):
    with _LOCK:
        _expire_overdue()
        mine = [_public(o) for o in _ORDERS.values() if o["user_id"] == user_id]
    mine.sort(key=lambda o: o["created_at_ms"], reverse=True)
    return {"ok": True, "orders": mine}


@eel.expose
def get_ticket_qr(order_id, user_id, ticket_code):
    """Matriks QR (baris '0'/'1'). Isi QR = ticket_code, yang nanti dipindai petugas check-in.
    Butuh:  pip install segno"""
    with _LOCK:
        o = _mine(order_id, user_id)
        if not o or o["status"] != "paid" or not any(t["ticket_code"] == ticket_code for t in o["tickets"]):
            return {"ok": False, "message": "Tiket tidak ditemukan."}
    try:
        import segno
        qr = segno.make(ticket_code, error="m")
        rows = ["".join("1" if v else "0" for v in row) for row in qr.matrix]
        return {"ok": True, "rows": rows}
    except ImportError:
        return {"ok": False, "message": "QR belum tersedia. Jalankan: pip install segno"}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "message": f"Gagal membuat QR: {e}"}


# ---------- Berita / pengumuman (nanti dikelola admin di A8) ----------
_ANNOUNCEMENTS = [
    {"announcement_id": 1, "title": "Panduan masuk venue & penukaran tiket", "category": "PANDUAN",
     "excerpt": "Semua yang perlu kamu tahu untuk masuk venue dengan nyaman.",
     "published_at": "2027-04-12", "author": "Tim Publikasi", "read_minutes": 3, "is_published": True,
     "cta": {"label": "Lihat FAQ dan ketentuan →", "route": "U14"},
     "content": [
         {"t": "h2", "x": "Malam besar dimulai dengan persiapan kecil."},
         {"t": "p", "x": "Sebelum menikmati After Hours Til Dawn di Jakarta, pastikan e-ticket sudah tersimpan di perangkatmu. Gate dibuka pukul 16.00 WIB dan pertunjukan dimulai pukul 20.00 WIB."},
         {"t": "h3", "x": "01 / Siapkan e-ticket dan identitas"},
         {"t": "p", "x": "Buka Pesanan Saya lalu pilih Lihat E-Ticket. Tunjukkan QR kepada petugas bersama identitas yang sesuai dengan nama pemegang. Setiap QR hanya berlaku untuk satu kali masuk."},
         {"t": "h3", "x": "02 / Datang lebih awal"},
         {"t": "p", "x": "Gunakan transportasi umum menuju area Senayan untuk menghindari kepadatan. Ikuti penanda pintu masuk sesuai kategori tiket dan arahan petugas keamanan."},
         {"t": "h3", "x": "03 / Jaga barang dan sesama penonton"},
         {"t": "p", "x": "Bawa barang seperlunya. Periksa daftar barang terlarang di halaman FAQ, dan segera hubungi petugas jika membutuhkan bantuan."}]},
    {"announcement_id": 2, "title": "Kenali kategori tiket sebelum membeli", "category": "PANDUAN",
     "excerpt": "Temukan area menonton yang paling sesuai untukmu.",
     "published_at": "2027-04-12", "author": "Tim Publikasi", "read_minutes": 2, "is_published": True,
     "cta": {"label": "Pilih tiketmu →", "route": "U4"},
     "content": [
         {"t": "h2", "x": "Pilih area yang paling cocok untukmu."},
         {"t": "p", "x": "Setiap kategori menawarkan pengalaman yang berbeda. Bandingkan sebelum memutuskan, dan ingat batas pembelian maksimal 4 tiket per akun."},
         {"t": "h3", "x": "01 / VIP"},
         {"t": "p", "x": "Akses prioritas dan area premium untuk pengalaman terdekat."},
         {"t": "h3", "x": "02 / CAT 1 dan CAT 2"},
         {"t": "p", "x": "Tribune bertempat duduk. CAT 1 menawarkan pandangan terbaik, CAT 2 adalah pilihan tribune reguler."},
         {"t": "h3", "x": "03 / Festival"},
         {"t": "p", "x": "Area berdiri dekat panggung untuk kamu yang ingin merasakan energi penonton."}]},
    {"announcement_id": 3, "title": "Semua yang perlu kamu bawa", "category": "PANDUAN",
     "excerpt": "Persiapkan kebutuhanmu sebelum berangkat ke konser.",
     "published_at": "2027-04-12", "author": "Tim Publikasi", "read_minutes": 2, "is_published": True,
     "cta": {"label": "Lihat FAQ dan ketentuan →", "route": "U14"},
     "content": [
         {"t": "h2", "x": "Bawa seperlunya, nikmati sepenuhnya."},
         {"t": "p", "x": "Persiapan yang ringkas membuat antrean masuk lebih cepat dan malam lebih nyaman."},
         {"t": "h3", "x": "01 / Wajib dibawa"},
         {"t": "p", "x": "E-ticket yang sudah tersimpan di ponsel dan kartu identitas asli sesuai nama pemegang tiket."},
         {"t": "h3", "x": "02 / Tidak diperbolehkan"},
         {"t": "p", "x": "Senjata, benda tajam, narkotika, kamera profesional, serta makanan dan minuman dari luar. Daftar lengkap ada di halaman FAQ."}]},
]


def _published():
    items = [a for a in _ANNOUNCEMENTS if a["is_published"]]
    return sorted(items, key=lambda a: (a["published_at"], a["announcement_id"]), reverse=True)


def _card(a):
    return {k: a[k] for k in ("announcement_id", "title", "category", "excerpt", "published_at", "read_minutes")}


@eel.expose
def get_announcements(limit=3):
    return [_card(a) for a in _published()[:limit]]


@eel.expose
def get_news_page(page=1, q="", per_page=3):
    q = (q or "").strip().lower()
    items = [a for a in _published() if not q or q in a["title"].lower() or q in a["excerpt"].lower()]
    per_page = max(1, min(int(per_page), 12))
    pages = max(1, -(-len(items) // per_page))
    page = min(max(1, int(page)), pages)
    return {"items": [_card(a) for a in items[(page - 1) * per_page: page * per_page]],
            "page": page, "pages": pages, "total": len(items)}


@eel.expose
def get_news_item(article_id):
    pub = _published()
    item = next((a for a in pub if a["announcement_id"] == article_id), None)
    if not item:
        return {"ok": False, "message": "Berita tidak ditemukan."}
    return {"ok": True, "item": item,
            "others": [_card(a) for a in pub if a["announcement_id"] != article_id][:3]}


# ---------- Profil ----------
def _safe_user(u):
    return {k: u[k] for k in ("user_id", "full_name", "email", "phone", "role")}


@eel.expose
def get_profile(user_id):
    u = _user_by_id(user_id)
    return {"ok": True, "user": _safe_user(u)} if u else {"ok": False, "message": "Akun tidak ditemukan."}


@eel.expose
def update_profile(user_id, data):
    u = _user_by_id(user_id)
    if not u:
        return {"ok": False, "message": "Akun tidak ditemukan."}
    name = (data.get("full_name") or "").strip()
    phone = re.sub(r"\s", "", data.get("phone") or "")
    if len(name) < 3:
        return {"ok": False, "field": "full_name", "message": "Nama lengkap minimal 3 karakter"}
    if not _PHONE_RE.match(phone):
        return {"ok": False, "field": "phone", "message": "Nomor HP tidak valid"}
    u["full_name"], u["phone"] = name, phone      # email sengaja tidak dapat diubah
    return {"ok": True, "user": _safe_user(u)}


@eel.expose
def change_password(user_id, old_password, new_password):
    u = _user_by_id(user_id)
    if not u:
        return {"ok": False, "message": "Akun tidak ditemukan."}
    if not _verify(old_password or "", u["password_hash"]):
        return {"ok": False, "field": "old", "message": "Password lama salah"}
    if len(new_password or "") < 8:
        return {"ok": False, "field": "new", "message": "Password baru minimal 8 karakter"}
    if new_password == old_password:
        return {"ok": False, "field": "new", "message": "Password baru harus berbeda"}
    u["password_hash"] = _hash(new_password)
    return {"ok": True}


if __name__ == "__main__":
    eel.start("index.html", size=(1440, 900))
