"""After Hours Til Dawn E-App - Python/Eel + Supabase PostgreSQL.
Semua data konser, tiket, pesanan, pembayaran, e-ticket, dan berita dibaca/disimpan di Supabase.
"""
import re
import secrets
import time
from datetime import datetime, timezone, timedelta
import os
import smtplib
from email.message import EmailMessage
from dotenv import load_dotenv
load_dotenv()

import eel
from database import supabase

eel.init("web")
_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")
_PHONE_RE = re.compile(r"^(\+62|62|0)8\d{7,12}$")
HOLD_MS = 15 *  60 * 1000
MAX_PER_ACCOUNT = 4
METHODS = {
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


def _to_ms(value):
    if not value:
        return _now_ms()
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return int(dt.timestamp() * 1000)
    except Exception:
        return _now_ms()


def _err(exc, prefix="Terjadi kesalahan Supabase"):
    print(f"[{prefix}] {exc!r}")
    return {"ok": False, "message": f"{prefix}: {str(exc)}"}


def _user_by_id(user_id):
    uid = str(user_id or "").strip()
    if not uid:
        return None
    try:
        r = supabase.table("users").select("user_id,full_name,email,phone,role,is_active").eq("user_id", uid).limit(1).execute()
        return r.data[0] if r.data else None
    except Exception as exc:
        print("[AUTH]", repr(exc))
        return None


def _safe_user(user):
    return {k: user.get(k) for k in ("user_id", "full_name", "email", "phone", "role")}


# ---------------- AUTH ----------------
@eel.expose
def register_user(data):
    data = data or {}
    name = (data.get("full_name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    phone = re.sub(r"\s", "", data.get("phone") or "")
    password = data.get("password") or ""
    if len(name) < 3:
        return {"ok": False, "field": "full_name", "message": "Nama lengkap minimal 3 karakter"}
    if not _EMAIL_RE.match(email):
        return {"ok": False, "field": "email", "message": "Format email tidak valid"}
    if not _PHONE_RE.match(phone):
        return {"ok": False, "field": "phone", "message": "Nomor HP tidak valid"}
    if len(password) < 8:
        return {"ok": False, "field": "password", "message": "Password minimal 8 karakter"}
    try:
        res = supabase.auth.sign_up({"email": email, "password": password,
            "options": {"data": {"full_name": name, "phone": phone}}})
        if not res.user:
            return {"ok": False, "message": "Registrasi gagal. Periksa konfigurasi konfirmasi email Supabase."}
        return {"ok": True, "message": "Akun berhasil dibuat. Silakan periksa email jika konfirmasi email diaktifkan."}
    except Exception as exc:
        msg = str(exc)
        if any(x in msg.lower() for x in ("already registered", "already exists", "user already registered")):
            msg = "Email sudah digunakan."
        return {"ok": False, "message": msg}


@eel.expose
def login_user(email, password):
    email = (email or "").strip().lower()
    try:
        res = supabase.auth.sign_in_with_password({"email": email, "password": password or ""})
        if not res.user:
            return {"ok": False, "message": "Email atau password salah"}
        user = _user_by_id(str(res.user.id))
        if not user:
            supabase.auth.sign_out()
            return {"ok": False, "message": "Profil belum tersedia. Pastikan trigger on_auth_user_created aktif di Supabase."}
        if not user.get("is_active", True):
            supabase.auth.sign_out()
            return {"ok": False, "message": "Akun dinonaktifkan, hubungi panitia"}
        return {"ok": True, "user": _safe_user(user)}
    except Exception:
        return {"ok": False, "message": "Email atau password salah, atau akun belum dikonfirmasi."}


# ---------------- CONCERT & CATEGORIES ----------------
@eel.expose
def get_concert_info():
    try:
        r = supabase.table("concerts").select("concert_id,title,description,poster_url,concert_date,gate_open,status,venues(name,city,address,map_url)").order("concert_date").limit(1).execute()
        if not r.data:
            return {"title": "THE WEEKND", "tagline": "AFTER HOURS TIL DAWN", "concert_date": "", "min_price": 0}
        c = r.data[0]
        title = c.get("title") or "THE WEEKND - AFTER HOURS TIL DAWN"
        cats = supabase.table("ticket_categories").select("price").eq("concert_id", c["concert_id"]).execute().data or []
        prices = [float(x["price"]) for x in cats]
        return {"title": title, "tagline": "AFTER HOURS TIL DAWN", "concert_date": c.get("concert_date"),
                "min_price": min(prices) if prices else 0, "description": c.get("description"), "venue": c.get("venues")}
    except Exception as exc:
        print("[CONCERT]", repr(exc))
        return {"title": "THE WEEKND", "tagline": "AFTER HOURS TIL DAWN", "concert_date": "", "min_price": 0}


@eel.expose
def get_ticket_categories():
    try:
        concert = supabase.table("concerts").select("concert_id").order("concert_date").limit(1).execute().data
        if not concert:
            return []
        rows = supabase.table("ticket_categories").select("category_id,concert_id,name,description,price,quota,sold,sale_start,sale_end").eq("concert_id", concert[0]["concert_id"]).order("category_id").execute().data or []
        return [{**x, "price": float(x["price"]), "remaining": max(0, int(x["quota"]) - int(x["sold"]))} for x in rows]
    except Exception as exc:
        print("[CATEGORIES]", repr(exc))
        return []


@eel.expose
def check_quota(items):
    try:
        cats = {int(x["category_id"]): x for x in get_ticket_categories()}
        total = 0
        for item in items or []:
            qty = int(item.get("quantity", 0))
            cid = int(item.get("category_id"))
            total += qty
            if qty < 1 or cid not in cats or cats[cid]["remaining"] < qty:
                return {"ok": False, "message": f"Kuota {cats[cid]['name'] if cid in cats else 'kategori ini'} tidak mencukupi."}
        if total > MAX_PER_ACCOUNT:
            return {"ok": False, "message": "Maksimal 4 tiket per akun."}
        return {"ok": True}
    except Exception as exc:
        return _err(exc, "Gagal memeriksa kuota")


# ---------------- ORDER READ HELPERS ----------------
def _expire_order(order_id, user_id):
    try:
        supabase.rpc("expire_ticket_order", {"p_order_id": str(order_id), "p_user_id": str(user_id)}).execute()
    except Exception as exc:
        print("[EXPIRE]", repr(exc))


def _fetch_order(order_id, user_id):
    _expire_order(order_id, user_id)
    result = supabase.table("orders").select("*").eq("order_id", str(order_id)).eq("user_id", str(user_id)).limit(1).execute()
    if not result.data:
        return None
    o = result.data[0]
    order_id = o["order_id"]
    items_raw = supabase.table("order_items").select("item_id,category_id,quantity,unit_price,subtotal,ticket_categories(name)").eq("order_id", order_id).order("item_id").execute().data or []
    holders = supabase.table("order_holders").select("holder_id,category_id,holder_name,holder_id_no").eq("order_id", order_id).order("holder_id").execute().data or []
    pay_rows = supabase.table("payments").select("payment_id,method,amount,status,paid_at,reference_no").eq("order_id", order_id).order("payment_id", desc=True).limit(1).execute().data or []
    tickets_raw = supabase.table("tickets").select("ticket_id,ticket_code,category_id,holder_id,holder_name,holder_id_no,status,created_at").eq("order_id", order_id).order("holder_id").execute().data or []
    items = [{"category_id": x["category_id"], "name": (x.get("ticket_categories") or {}).get("name", "Tiket"),
              "quantity": int(x["quantity"]), "unit_price": float(x["unit_price"]), "subtotal": float(x["subtotal"])} for x in items_raw]
    tickets = []
    for t in tickets_raw:
        cat = next((i["name"] for i in items if i["category_id"] == t["category_id"]), "")
        tickets.append({"ticket_id": t["ticket_id"], "ticket_code": t["ticket_code"], "category_id": t["category_id"],
                        "category_name": cat, "holder_name": t["holder_name"], "holder_id_no": t.get("holder_id_no"), "status": t["status"]})
    payment = None
    if pay_rows:
        p = pay_rows[0]
        method = p["method"]
        label, kind, prefix = METHODS.get(method, (method, "other", ""))
        user = _user_by_id(user_id) or {}
        digits = re.sub(r"\D", "", user.get("phone") or "")
        if digits.startswith("62"):
            digits = "0" + digits[2:]
        account_no = (prefix + digits) if kind != "card" else None
        grouped = " ".join(digits[i:i+4] for i in range(0, len(digits), 4))
        payment = {"method": method, "label": label, "kind": kind, "account_no": account_no,
                   "account_display": f"{prefix} {grouped}" if account_no else None,
                   "amount": float(p["amount"]), "status": p["status"], "reference_no": p.get("reference_no"),
                   "paid_at_ms": _to_ms(p.get("paid_at")) if p.get("paid_at") else None}
    voucher_code = ""
    if o.get("voucher_id"):
        voucher_rows = supabase.table("vouchers").select("code").eq("voucher_id", o["voucher_id"]).limit(1).execute().data or []
        if voucher_rows:
            voucher_code = voucher_rows[0]["code"]
    created = _to_ms(o.get("created_at"))
    expires = _to_ms(o.get("expires_at"))
    return {"order_id": str(order_id), "order_code": o["order_code"], "items": items, "holders": holders,
            "subtotal": float(o["subtotal"]), "discount": float(o.get("discount") or 0),
            "voucher_code": voucher_code, "total": float(o["total_amount"]), "status": o["status"],
            "created_at_ms": created, "expires_at_ms": expires, "expires_in_ms": max(0, expires - _now_ms()),
            "payment": payment, "tickets": tickets}


# ---------------- ORDERS ----------------
@eel.expose
def create_order(user_id, items, holders):
    user = _user_by_id(user_id)
    if not user:
        return {"ok": False, "message": "Profil akun tidak ditemukan di Supabase. Silakan keluar lalu login kembali."}
    if not user.get("is_active", True):
        return {"ok": False, "message": "Akun kamu sedang nonaktif. Hubungi admin."}
    want = {}
    try:
        for i in items or []:
            cid, qty = int(i["category_id"]), int(i["quantity"])
            if qty < 1:
                return {"ok": False, "message": "Jumlah tiket tidak valid."}
            want[cid] = want.get(cid, 0) + qty
        if not want or sum(want.values()) > MAX_PER_ACCOUNT:
            return {"ok": False, "message": "Pilih tiket terlebih dahulu. Maksimal 4 tiket per akun."}
        count_h = {}
        clean_holders = []
        for h in holders or []:
            name = (h.get("holder_name") or "").strip()
            ident = (h.get("holder_id_no") or "").strip()
            cid = int(h["category_id"])
            if len(name) < 3:
                return {"ok": False, "message": "Nama pemegang tiket minimal 3 karakter."}
            if ident and not re.fullmatch(r"[A-Za-z0-9]{6,20}", ident):
                return {"ok": False, "message": "Nomor identitas tidak valid."}
            count_h[cid] = count_h.get(cid, 0) + 1
            clean_holders.append({"category_id": cid, "holder_name": name, "holder_id_no": ident or None})
        if count_h != want:
            return {"ok": False, "message": "Data pemegang tidak sesuai jumlah tiket."}
        result = supabase.rpc("create_ticket_order", {"p_items": [{"category_id": k, "quantity": v} for k, v in want.items()],
                                                        "p_holders": clean_holders}).execute()
        data = result.data
        oid = data.get("order_id") if isinstance(data, dict) else data
        if isinstance(oid, list) and oid:
            oid = oid[0].get("order_id")
        order = _fetch_order(oid, user_id)
        return {"ok": True, "order": order} if order else {"ok": False, "message": "Pesanan tersimpan tetapi gagal dibaca kembali."}
    except Exception as exc:
        return _err(exc, "Gagal membuat pesanan")


@eel.expose
def get_order(order_id, user_id):
    try:
        order = _fetch_order(order_id, user_id)
        return {"ok": True, "order": order} if order else {"ok": False, "message": "Pesanan tidak ditemukan."}
    except Exception as exc:
        return _err(exc, "Gagal mengambil pesanan")


@eel.expose
def apply_voucher(order_id, user_id, code):
    code = (code or "").strip().upper()
    if not code:
        return {"ok": False, "message": "Masukkan kode voucher."}
    try:
        supabase.rpc("apply_ticket_voucher", {"p_order_id": str(order_id), "p_user_id": str(user_id), "p_code": code}).execute()
        return {"ok": True, "order": _fetch_order(order_id, user_id), "message": f"Voucher {code} berhasil dipakai."}
    except Exception as exc:
        msg = str(exc)
        return {"ok": False, "message": msg}


@eel.expose
def select_payment(order_id, user_id, method):
    if method not in METHODS:
        return {"ok": False, "message": "Metode pembayaran tidak dikenal."}
    try:
        order = _fetch_order(order_id, user_id)
        if not order or order["status"] != "pending":
            return {"ok": False, "message": "Waktu pembayaran habis atau pesanan tidak ditemukan."}
        user = _user_by_id(user_id) or {}
        if method != "card" and not user.get("phone"):
            return {"ok": False, "message": "Lengkapi nomor HP di profil sebelum memilih metode pembayaran."}
        label, kind, _ = METHODS[method]
        reference = "PAY-" + order["order_code"]
        rows = supabase.table("payments").select("payment_id").eq("order_id", str(order_id)).limit(1).execute().data or []
        payload = {"method": method, "amount": order["total"], "status": "pending", "reference_no": reference}
        if rows:
            supabase.table("payments").update(payload).eq("payment_id", rows[0]["payment_id"]).execute()
        else:
            supabase.table("payments").insert({"order_id": str(order_id), **payload}).execute()
        return {"ok": True, "order": _fetch_order(order_id, user_id)}
    except Exception as exc:
        return _err(exc, "Gagal memilih pembayaran")


@eel.expose
def pay_order(order_id, user_id, card=None):
    try:
        order = _fetch_order(order_id, user_id)
        if not order:
            return {"ok": False, "message": "Pesanan tidak ditemukan."}
        if order["status"] == "expired":
            return {"ok": False, "expired": True, "message": "Waktu pembayaran habis."}
        if order["status"] != "pending" or not order["payment"]:
            return {"ok": False, "message": "Pesanan tidak dapat dibayar."}
        if order["payment"]["kind"] == "card":
            number = re.sub(r"\D", "", (card or {}).get("number", ""))
            if not re.fullmatch(r"\d{13,19}", number):
                return {"ok": False, "message": "Nomor kartu tidak valid."}
            if number.endswith("0002"):
                supabase.table("payments").update({"status": "failed"}).eq("order_id", str(order_id)).execute()
                return {"ok": False, "message": "Kartu ditolak oleh bank penerbit."}

        # Perpanjang expires_at jauh ke depan agar tidak auto-expired saat menunggu verifikasi admin
        supabase.table("orders").update({
            "expires_at": "2027-08-14T23:59:59+07:00"
        }).eq("order_id", str(order_id)).execute()

        # Pastikan payment tercatat dengan status pending verifikasi
        supabase.table("payments").update({
            "status": "pending"
        }).eq("order_id", str(order_id)).execute()

        return {
            "ok": True,
            "awaiting_verification": True,
            "order": _fetch_order(order_id, user_id),
            "message": "Pembayaran diterima. Menunggu verifikasi panitia sebelum e-ticket diterbitkan."
        }
    except Exception as exc:
        msg = str(exc)
        return {"ok": False, "expired": "expired" in msg.lower(), "message": msg}

@eel.expose
def cancel_order(order_id, user_id):
    try:
        supabase.rpc("cancel_ticket_order", {"p_order_id": str(order_id), "p_user_id": str(user_id)}).execute()
        return {"ok": True}
    except Exception as exc:
        return _err(exc, "Gagal membatalkan pesanan")


@eel.expose
def list_orders(user_id):
    try:
        rows = supabase.table("orders").select("order_id").eq("user_id", str(user_id)).order("created_at", desc=True).execute().data or []
        orders = []
        for row in rows:
            order = _fetch_order(row["order_id"], user_id)
            if order:
                orders.append(order)
        return {"ok": True, "orders": orders}
    except Exception as exc:
        return _err(exc, "Gagal mengambil daftar pesanan")


@eel.expose
def get_ticket_qr(order_id, user_id, ticket_code):
    try:
        order = _fetch_order(order_id, user_id)
        if not order or order["status"] != "paid" or not any(t["ticket_code"] == ticket_code for t in order["tickets"]):
            return {"ok": False, "message": "Tiket tidak ditemukan."}
        import segno
        qr = segno.make(ticket_code, error="m")
        return {"ok": True, "rows": ["".join("1" if v else "0" for v in row) for row in qr.matrix]}
    except ImportError:
        return {"ok": False, "message": "QR belum tersedia. Jalankan: pip install segno"}
    except Exception as exc:
        return _err(exc, "Gagal membuat QR")


# ---------------- ANNOUNCEMENTS ----------------
def _announcement_card(row):
    content = row.get("content") or ""
    return {"announcement_id": row["announcement_id"], "title": row["title"],
            "category": "PENGUMUMAN", "excerpt": content[:155] + ("…" if len(content) > 155 else ""),
            "published_at": row.get("published_at") or row.get("created_at"), "author": "Panitia",
            "read_minutes": max(1, len(content.split()) // 200 + 1), "is_published": row.get("is_published", False)}


def _published_announcements():
    return supabase.table("announcements").select("announcement_id,concert_id,author_id,title,content,image_url,is_published,published_at,created_at").eq("is_published", True).order("published_at", desc=True).execute().data or []


@eel.expose
def get_announcements(limit=3):
    try:
        return [_announcement_card(x) for x in _published_announcements()[:max(1, min(int(limit), 20))]]
    except Exception as exc:
        print("[ANNOUNCEMENTS]", repr(exc))
        return []


@eel.expose
def get_news_page(page=1, q="", per_page=3):
    try:
        query = (q or "").strip().lower()
        items = [_announcement_card(x) for x in _published_announcements()]
        if query:
            items = [x for x in items if query in x["title"].lower() or query in x["excerpt"].lower()]
        per_page = max(1, min(int(per_page), 12))
        pages = max(1, (len(items) + per_page - 1) // per_page)
        page = min(max(1, int(page)), pages)
        return {"items": items[(page-1)*per_page:page*per_page], "page": page, "pages": pages, "total": len(items)}
    except Exception as exc:
        print("[NEWS]", repr(exc))
        return {"items": [], "page": 1, "pages": 1, "total": 0}


@eel.expose
def get_news_item(article_id):
    try:
        rows = _published_announcements()
        row = next((x for x in rows if int(x["announcement_id"]) == int(article_id)), None)
        if not row:
            return {"ok": False, "message": "Berita tidak ditemukan."}
        item = _announcement_card(row)
        item["content"] = [{"t": "p", "x": row.get("content") or ""}]
        item["image_url"] = row.get("image_url")
        return {"ok": True, "item": item, "others": [_announcement_card(x) for x in rows if x["announcement_id"] != row["announcement_id"]][:3]}
    except Exception as exc:
        return _err(exc, "Gagal mengambil berita")


# ---------------- PROFILE ----------------
@eel.expose
def get_profile(user_id):
    user = _user_by_id(user_id)
    return {"ok": True, "user": _safe_user(user)} if user else {"ok": False, "message": "Akun tidak ditemukan."}


@eel.expose
def update_profile(user_id, data):
    data = data or {}
    name = (data.get("full_name") or "").strip()
    phone = re.sub(r"\s", "", data.get("phone") or "")
    if len(name) < 3:
        return {"ok": False, "field": "full_name", "message": "Nama lengkap minimal 3 karakter"}
    if not _PHONE_RE.match(phone):
        return {"ok": False, "field": "phone", "message": "Nomor HP tidak valid"}
    try:
        result = supabase.table("users").update({"full_name": name, "phone": phone}).eq("user_id", str(user_id)).execute()
        user = result.data[0] if result.data else _user_by_id(user_id)
        return {"ok": True, "user": _safe_user(user)} if user else {"ok": False, "message": "Profil gagal diperbarui."}
    except Exception as exc:
        return _err(exc, "Gagal memperbarui profil")


@eel.expose
def change_password(user_id, old_password, new_password):
    user = _user_by_id(user_id)
    if not user:
        return {"ok": False, "message": "Akun tidak ditemukan atau sesi login sudah berakhir."}
    if len(new_password or "") < 8:
        return {"ok": False, "field": "new", "message": "Password baru minimal 8 karakter"}
    if new_password == old_password:
        return {"ok": False, "field": "new", "message": "Password baru harus berbeda"}
    try:
        supabase.auth.sign_in_with_password({"email": user["email"], "password": old_password or ""})
        supabase.auth.update_user({"password": new_password})
        return {"ok": True}
    except Exception:
        return {"ok": False, "field": "old", "message": "Password lama salah atau password gagal diperbarui."}

def _send_eticket_email(to_email, buyer_name, order_code, tickets):
    smtp_user = os.getenv("SMTP_EMAIL", "").strip()
    smtp_pass = os.getenv("SMTP_APP_PASSWORD", "").replace(" ", "").strip()
    if not smtp_user or not smtp_pass or not to_email:
        print("[EMAIL] Konfigurasi SMTP_EMAIL / SMTP_APP_PASSWORD belum diisi di .env")
        return False, "Konfigurasi SMTP belum diatur di .env"

    ticket_rows = ""
    for t in tickets:
        cat_name = (t.get("ticket_categories") or {}).get("name") or "Tiket"
        ticket_rows += f"""
        <tr>
          <td style="padding:10px;border-bottom:1px solid #262626;font-weight:bold;color:#fff">{t.get('ticket_code')}</td>
          <td style="padding:10px;border-bottom:1px solid #262626;color:#ddd">{t.get('holder_name')}</td>
          <td style="padding:10px;border-bottom:1px solid #262626;color:#aaa">{cat_name}</td>
        </tr>"""

    html_body = f"""
    <div style="font-family:Arial,sans-serif;background:#0d0d0d;color:#f5f5f5;padding:28px;border-radius:12px;max-width:600px;margin:auto">
      <p style="color:#c8102e;font-size:12px;letter-spacing:2px;margin:0">THE WEEKND · AFTER HOURS TIL DAWN</p>
      <h2 style="margin:8px 0 16px;font-size:24px">E-TICKET KAMU SUDAH TERBIT!</h2>
      <p style="color:#ccc;font-size:14px">Halo <strong>{buyer_name}</strong>, pembayaran untuk pesanan <strong>{order_code}</strong> telah diverifikasi oleh panitia.</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;background:#161616;border-radius:8px;overflow:hidden;font-size:13px">
        <thead>
          <tr style="background:#1f1f1f;color:#888;text-align:left">
            <th style="padding:10px">KODE TIKET</th>
            <th style="padding:10px">PEMEGANG</th>
            <th style="padding:10px">KATEGORI</th>
          </tr>
        </thead>
        <tbody>{ticket_rows}</tbody>
      </table>
      <p style="color:#999;font-size:12px">Simpan kode tiket di atas atau buka menu <strong>Pesanan Saya</strong> di aplikasi untuk menampilkan QR Code saat check-in di GBK, Jakarta (14 Agustus 2027).</p>
    </div>
    """

    msg = EmailMessage()
    msg["Subject"] = f"E-Ticket Resmi · {order_code} (The Weeknd Jakarta 2027)"
    msg["From"] = f"Panitia The Weeknd Jakarta <{smtp_user}>"
    msg["To"] = to_email
    msg.set_content(f"Halo {buyer_name}, pembayaran {order_code} telah diverifikasi. Kode tiket: " + ", ".join(t.get("ticket_code", "") for t in tickets))
    msg.add_alternative(html_body, subtype="html")

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
        return True, "Email e-ticket terkirim"
    except Exception as exc:
        print("[EMAIL ERROR]", repr(exc))
        return False, str(exc)

# ---------------- ADMIN PANEL (A1 & A2) ----------------
def _require_admin(user_id):
    user = _user_by_id(user_id)
    if not user or user.get("role") != "admin" or not user.get("is_active", True):
        return None
    return user


def _record_admin_activity(user_id, action, object_label):
    user = _user_by_id(user_id) or {}
    try:
        supabase.table("activity_logs").insert({
            "admin_id": str(user_id),
            "admin_name": user.get("full_name") or "Admin",
            "action": action,
            "object_label": object_label,
        }).execute()
        return ""
    except Exception as exc:
        print("[ADMIN ACTIVITY LOG]", repr(exc))
        return "Log aktivitas gagal disimpan. Jalankan migrasi activity_logs."


@eel.expose
def get_admin_sales_report(user_id):
    if not _require_admin(user_id):
        return {"ok": False, "message": "Akses ditolak."}
    try:
        orders = (
            supabase.table("orders")
            .select("order_id,order_code,subtotal,discount,total_amount,status,created_at")
            .order("created_at", desc=True)
            .execute()
            .data or []
        )
        items = (
            supabase.table("order_items")
            .select("order_id,category_id,quantity,unit_price,subtotal,ticket_categories(name)")
            .execute()
            .data or []
        )
        categories = get_ticket_categories()
        return {"ok": True, "orders": orders, "items": items, "categories": categories}
    except Exception as exc:
        return _err(exc, "Gagal memuat laporan penjualan")


@eel.expose
def get_admin_users(user_id):
    if not _require_admin(user_id):
        return {"ok": False, "message": "Akses ditolak."}
    try:
        users = (
            supabase.table("users")
            .select("user_id,full_name,email,phone,role,is_active,created_at")
            .order("created_at", desc=True)
            .execute()
            .data or []
        )
        orders = supabase.table("orders").select("user_id").execute().data or []
        order_counts = {}
        for order in orders:
            uid = str(order.get("user_id") or "")
            order_counts[uid] = order_counts.get(uid, 0) + 1
        return {
            "ok": True,
            "users": [{
                **user,
                "order_count": order_counts.get(str(user.get("user_id")), 0),
            } for user in users],
        }
    except Exception as exc:
        return _err(exc, "Gagal memuat data pengguna")


@eel.expose
def admin_set_user_active(admin_id, target_user_id, active):
    if not _require_admin(admin_id):
        return {"ok": False, "message": "Akses ditolak."}
    if not isinstance(active, bool):
        return {"ok": False, "message": "Status akun tidak valid."}
    if str(admin_id) == str(target_user_id) and not active:
        return {"ok": False, "message": "Kamu tidak dapat menonaktifkan akun sendiri."}
    try:
        target = _user_by_id(target_user_id)
        if not target:
            return {"ok": False, "message": "Pengguna tidak ditemukan."}
        supabase.table("users").update({"is_active": active}).eq("user_id", str(target_user_id)).execute()
        status = "mengaktifkan" if active else "menonaktifkan"
        warning = _record_admin_activity(
            admin_id, f"{status.capitalize()} akun pengguna", target.get("email") or str(target_user_id)
        )
        return {
            "ok": True,
            "message": f"Akun berhasil {'diaktifkan' if active else 'dinonaktifkan'}.",
            "warning": warning,
        }
    except Exception as exc:
        return _err(exc, "Gagal mengubah status pengguna")


@eel.expose
def get_admin_activity_logs(user_id):
    if not _require_admin(user_id):
        return {"ok": False, "message": "Akses ditolak."}
    try:
        logs = (
            supabase.table("activity_logs")
            .select("log_id,admin_id,admin_name,action,object_label,created_at")
            .order("created_at", desc=True)
            .limit(500)
            .execute()
            .data or []
        )
        return {"ok": True, "logs": logs}
    except Exception as exc:
        return _err(exc, "Gagal memuat log aktivitas")


def _format_idr_short(amount):
    val = float(amount or 0)
    if val >= 1_000_000_000:
        return f"RP{val / 1_000_000_000:,.2f} M".replace(".", ",")
    if val >= 1_000_000:
        return f"RP{val / 1_000_000:,.2f} JT".replace(".", ",")
    return f"RP{int(val):,}".replace(",", ".")


@eel.expose
def admin_login(email, password):
    res = login_user(email, password)
    if not res.get("ok"):
        return res
    user = res.get("user") or {}
    if user.get("role") != "admin":
        try:
            supabase.auth.sign_out()
        except Exception:
            pass
        return {"ok": False, "message": "Akses ditolak. Akun ini bukan Admin Panitia."}
    return {"ok": True, "user": user}


@eel.expose
def admin_logout():
    try:
        supabase.auth.sign_out()
    except Exception:
        pass
    return {"ok": True}


@eel.expose
def get_admin_dashboard(user_id, days=7):
    if not _require_admin(user_id):
        return {"ok": False, "message": "Sesi admin tidak valid atau akses ditolak."}
    try:
        days = 30 if int(days) == 30 else 7
        concert = get_concert_info()
        cats = get_ticket_categories()

        total_quota = sum(int(c.get("quota") or 0) for c in cats)
        total_sold = sum(int(c.get("sold") or 0) for c in cats)
        remaining_total = max(0, total_quota - total_sold)

        orders_raw = (
            supabase.table("orders")
            .select("order_id,order_code,user_id,total_amount,status,created_at,users!user_id(full_name)")
            .order("created_at", desc=True)
            .execute()
            .data or []
        )

        paid_orders = [o for o in orders_raw if o.get("status") == "paid"]
        pending_orders = [o for o in orders_raw if o.get("status") == "pending"]
        total_revenue = sum(float(o.get("total_amount") or 0) for o in paid_orders)

        tickets_raw = supabase.table("tickets").select("ticket_id,status").execute().data or []
        checked_in = sum(1 for t in tickets_raw if t.get("status") == "used")

        from datetime import timedelta
        now_wib = datetime.now(timezone(timedelta(hours=7)))
        date_keys = [(now_wib - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(days - 1, -1, -1)]
        daily_map = {k: 0 for k in date_keys}

        paid_ids = [o["order_id"] for o in paid_orders]
        order_date_map = {}
        for o in paid_orders:
            try:
                dt = datetime.fromisoformat(str(o["created_at"]).replace("Z", "+00:00")).astimezone(timezone(timedelta(hours=7)))
                order_date_map[o["order_id"]] = dt.strftime("%Y-%m-%d")
            except Exception:
                pass

        if paid_ids:
            items_raw = supabase.table("order_items").select("order_id,quantity").in_("order_id", paid_ids).execute().data or []
            for it in items_raw:
                d_key = order_date_map.get(it["order_id"])
                if d_key in daily_map:
                    daily_map[d_key] += int(it.get("quantity") or 0)

        chart = [
            {"date": k, "label": datetime.strptime(k, "%Y-%m-%d").strftime("%d %b"), "sold": daily_map[k]}
            for k in date_keys
        ]

        recent_orders = [
            {
                "order_id": o["order_id"],
                "order_code": o["order_code"],
                "buyer_name": (o.get("users") or {}).get("full_name") or "Pengunjung",
                "total": float(o.get("total_amount") or 0),
                "status": o.get("status", "pending"),
            }
            for o in orders_raw[:5]
        ]

        ann_raw = (
            supabase.table("announcements")
            .select("announcement_id,title,content,is_published,published_at,created_at")
            .order("created_at", desc=True)
            .limit(10)
            .execute()
            .data or []
        )

        return {
            "ok": True,
            "concert": concert,
            "kpi": {
                "total_sold": total_sold,
                "total_quota": total_quota,
                "sold_pct": round((total_sold / total_quota * 100), 2) if total_quota else 0,
                "total_revenue": total_revenue,
                "revenue_short": _format_idr_short(total_revenue),
                "pending_count": len(pending_orders),
                "checked_in": checked_in,
                "remaining_total": remaining_total,
            },
            "categories": cats,
            "chart": chart,
            "chart_total": sum(x["sold"] for x in chart),
            "recent_orders": recent_orders,
            "announcements": ann_raw,
        }
    except Exception as exc:
        return _err(exc, "Gagal memuat dashboard admin")


@eel.expose
def create_announcement(user_id, title, content, is_published=True):
    if not _require_admin(user_id):
        return {"ok": False, "message": "Akses ditolak."}
    title = (title or "").strip()
    content = (content or "").strip()
    if len(title) < 5:
        return {"ok": False, "message": "Judul pengumuman minimal 5 karakter."}
    if len(content) < 10:
        return {"ok": False, "message": "Isi pengumuman minimal 10 karakter."}
    try:
        concert = supabase.table("concerts").select("concert_id").order("concert_date").limit(1).execute().data
        concert_id = concert[0]["concert_id"] if concert else 1
        now_iso = datetime.now(timezone.utc).isoformat()
        payload = {
            "concert_id": concert_id,
            "author_id": str(user_id),
            "title": title,
            "content": content,
            "is_published": bool(is_published),
            "published_at": now_iso if is_published else None,
        }
        res = supabase.table("announcements").insert(payload).execute()
        action = "Menerbitkan pengumuman" if is_published else "Menyimpan draf pengumuman"
        warning = _record_admin_activity(user_id, action, title)
        return {
            "ok": True,
            "item": res.data[0] if res.data else payload,
            "warning": warning,
        }
    except Exception as exc:
        return _err(exc, "Gagal menyimpan pengumuman")

@eel.expose
def get_admin_announcements(user_id):
    if not _require_admin(user_id):
        return {"ok": False, "message": "Akses ditolak."}
    try:
        rows = (
            supabase.table("announcements")
            .select("*, users!announcements_author_id_fkey(full_name)")
            .order("created_at", desc=True)
            .execute()
            .data
            or []
        )
    except Exception:
        try:
            rows = (
                supabase.table("announcements")
                .select("*")
                .order("created_at", desc=True)
                .execute()
                .data
                or []
            )
            users_map = {
                str(u["user_id"]): u.get("full_name") or "Admin Publikasi"
                for u in (supabase.table("users").select("user_id, full_name").execute().data or [])
            }
            for r in rows:
                r["author_name"] = users_map.get(str(r.get("author_id")), "Admin Publikasi")
        except Exception as exc:
            return _err(exc, "Gagal memuat daftar pengumuman")

    for r in rows:
        if "author_name" not in r:
            u = r.get("users") or {}
            r["author_name"] = u.get("full_name") if isinstance(u, dict) else "Admin Publikasi"

    try:
        concerts = (
            supabase.table("concerts")
            .select("concert_id, title")
            .order("concert_date")
            .execute()
            .data
            or []
        )
    except Exception:
        concerts = [{"concert_id": 1, "title": "The Weeknd · Jakarta"}]

    return {"ok": True, "announcements": rows, "concerts": concerts}


@eel.expose
def save_admin_announcement(user_id, payload):
    if not _require_admin(user_id):
        return {"ok": False, "message": "Akses ditolak."}
    data = payload or {}
    ann_id = data.get("announcement_id")
    title = (data.get("title") or "").strip()
    content = (data.get("content") or "").strip()
    is_published = bool(data.get("is_published"))
    concert_id = data.get("concert_id")

    if len(title) < 5:
        return {"ok": False, "message": "Judul pengumuman minimal 5 karakter."}
    if len(content) < 10:
        return {"ok": False, "message": "Isi pengumuman minimal 10 karakter."}

    try:
        if not concert_id:
            c = supabase.table("concerts").select("concert_id").order("concert_date").limit(1).execute().data
            concert_id = c[0]["concert_id"] if c else 1

        now_iso = datetime.now(timezone.utc).isoformat()
        row = {
            "concert_id": int(concert_id),
            "title": title,
            "content": content,
            "is_published": is_published,
            "published_at": now_iso if is_published else None,
        }

        if ann_id:
            res = (
                supabase.table("announcements")
                .update(row)
                .eq("announcement_id", int(ann_id))
                .execute()
            )
            action = "Memperbarui & menerbitkan pengumuman" if is_published else "Menyimpan perubahan draf pengumuman"
        else:
            row["author_id"] = str(user_id)
            res = supabase.table("announcements").insert(row).execute()
            action = "Menerbitkan pengumuman" if is_published else "Menyimpan draf pengumuman"

        warning = _record_admin_activity(user_id, action, f"Pengumuman / {title}")
        return {
            "ok": True,
            "item": res.data[0] if res.data else row,
            "warning": warning,
        }
    except Exception as exc:
        return _err(exc, "Gagal menyimpan pengumuman")


@eel.expose
def delete_admin_announcement(user_id, announcement_id):
    if not _require_admin(user_id):
        return {"ok": False, "message": "Akses ditolak."}
    try:
        existing = (
            supabase.table("announcements")
            .select("title")
            .eq("announcement_id", int(announcement_id))
            .limit(1)
            .execute()
            .data
        )
        title = existing[0]["title"] if existing else f"ID {announcement_id}"
        supabase.table("announcements").delete().eq("announcement_id", int(announcement_id)).execute()
        warning = _record_admin_activity(user_id, "Menghapus pengumuman", f"Pengumuman / {title}")
        return {"ok": True, "warning": warning}
    except Exception as exc:
        return _err(exc, "Gagal menghapus pengumuman")

@eel.expose
def get_admin_profile(user_id):
    admin = _require_admin(user_id)
    if not admin:
        return {"ok": False, "message": "Akses ditolak."}
    try:
        rows = (
            supabase.table("users")
            .select("user_id, full_name, email, phone, role, created_at")
            .eq("user_id", str(user_id))
            .limit(1)
            .execute()
            .data
        )
        if not rows:
            return {"ok": False, "message": "Data profil tidak ditemukan."}
        return {"ok": True, "profile": rows[0]}
    except Exception as exc:
        return _err(exc, "Gagal memuat profil admin")


@eel.expose
def update_admin_profile(user_id, payload):
    admin = _require_admin(user_id)
    if not admin:
        return {"ok": False, "message": "Akses ditolak."}
    data = payload or {}
    full_name = (data.get("full_name") or "").strip()
    phone = (data.get("phone") or "").strip()
    new_password = (data.get("new_password") or "").strip()

    if len(full_name) < 2:
        return {"ok": False, "message": "Nama lengkap minimal 2 karakter."}
    if new_password and len(new_password) < 6:
        return {"ok": False, "message": "Password baru minimal 6 karakter."}

    try:
        update_data = {"full_name": full_name, "phone": phone or None}
        res = (
            supabase.table("users")
            .update(update_data)
            .eq("user_id", str(user_id))
            .execute()
        )
        if new_password:
            try:
                supabase.auth.update_user({"password": new_password})
            except Exception:
                pass

        warning = _record_admin_activity(user_id, "Memperbarui profil admin", full_name)
        updated = res.data[0] if res.data else {**admin, **update_data}
        return {"ok": True, "profile": updated, "warning": warning}
    except Exception as exc:
        return _err(exc, "Gagal memperbarui profil")
    
@eel.expose
def get_admin_concert_detail(user_id):
    if not _require_admin(user_id):
        return {"ok": False, "message": "Akses ditolak."}
    try:
        concert_res = supabase.table("concerts").select("*, venues(*)").order("concert_date").limit(1).execute()
        venues_res = supabase.table("venues").select("*").order("name").execute()
        
        if not concert_res.data:
            return {"ok": False, "message": "Data konser tidak ditemukan."}
            
        return {
            "ok": True,
            "concert": concert_res.data[0],
            "venues": venues_res.data or []
        }
    except Exception as exc:
        return _err(exc, "Gagal memuat detail konser")


@eel.expose
def update_concert_info(user_id, data):
    if not _require_admin(user_id):
        return {"ok": False, "message": "Akses ditolak."}
    data = data or {}
    try:
        concert_id = data.get("concert_id")
        if not concert_id:
            return {"ok": False, "message": "ID Konser tidak valid."}
            
        payload = {
            "title": (data.get("title") or "").strip(),
            "description": (data.get("description") or "").strip(),
            "concert_date": data.get("concert_date"),
            "gate_open": data.get("gate_open"),
            "status": data.get("status"),
            "venue_id": int(data.get("venue_id")) if data.get("venue_id") else None
        }
        
        supabase.table("concerts").update(payload).eq("concert_id", concert_id).execute()
        warning = _record_admin_activity(user_id, "Memperbarui informasi konser", payload["title"])
        return {"ok": True, "message": "Informasi konser berhasil diperbarui.", "warning": warning}
    except Exception as exc:
        return _err(exc, "Gagal memperbarui informasi konser")


@eel.expose
def create_venue(user_id, data):
    if not _require_admin(user_id):
        return {"ok": False, "message": "Akses ditolak."}
    data = data or {}
    name = (data.get("name") or "").strip()
    city = (data.get("city") or "").strip()
    if len(name) < 3:
        return {"ok": False, "message": "Nama venue minimal 3 karakter."}
    try:
        payload = {
            "name": name,
            "city": city or "Jakarta",
            "address": data.get("address"),
            "capacity": int(data.get("capacity") or 15000)
        }
        res = supabase.table("venues").insert(payload).execute()
        warning = _record_admin_activity(user_id, "Menambahkan venue", name)
        return {
            "ok": True,
            "venue": res.data[0] if res.data else payload,
            "warning": warning,
        }
    except Exception as exc:
        return _err(exc, "Gagal menambahkan venue baru")

@eel.expose
def get_admin_ticket_categories(user_id):
    if not _require_admin(user_id):
        return {"ok": False, "message": "Akses ditolak."}
    try:
        cats = get_ticket_categories()
        return {"ok": True, "categories": cats}
    except Exception as exc:
        return _err(exc, "Gagal memuat kategori tiket")


@eel.expose
def save_ticket_category(user_id, data):
    if not _require_admin(user_id):
        return {"ok": False, "message": "Akses ditolak."}
    data = data or {}
    cat_id = data.get("category_id")
    name = (data.get("name") or "").strip()
    description = (data.get("description") or "").strip()
    price = float(data.get("price") or 0)
    quota = int(data.get("quota") or 0)
    sale_start = data.get("sale_start") or None
    sale_end = data.get("sale_end") or None

    if len(name) < 2:
        return {"ok": False, "message": "Nama kategori minimal 2 karakter."}
    if price < 0 or quota < 0:
        return {"ok": False, "message": "Harga dan kuota tidak boleh bernilai negatif."}

    try:
        if cat_id:
            existing = supabase.table("ticket_categories").select("sold").eq("category_id", cat_id).limit(1).execute().data
            if not existing:
                return {"ok": False, "message": "Kategori tiket tidak ditemukan."}
            sold = int(existing[0].get("sold") or 0)
            if quota < sold:
                return {"ok": False, "message": f"Kuota tidak boleh lebih kecil dari jumlah terjual ({sold} tiket)."}

            payload = {
                "name": name,
                "description": description,
                "price": price,
                "quota": quota,
                "sale_start": sale_start,
                "sale_end": sale_end,
            }
            supabase.table("ticket_categories").update(payload).eq("category_id", cat_id).execute()
            warning = _record_admin_activity(user_id, "Memperbarui kategori tiket", name)
            return {"ok": True, "message": "Kategori tiket berhasil diperbarui.", "warning": warning}
        else:
            concert = supabase.table("concerts").select("concert_id").order("concert_date").limit(1).execute().data
            concert_id = concert[0]["concert_id"] if concert else 1
            payload = {
                "concert_id": concert_id,
                "name": name,
                "description": description,
                "price": price,
                "quota": quota,
                "sold": 0,
                "sale_start": sale_start,
                "sale_end": sale_end,
            }
            supabase.table("ticket_categories").insert(payload).execute()
            warning = _record_admin_activity(user_id, "Menambahkan kategori tiket", name)
            return {"ok": True, "message": "Kategori tiket baru berhasil ditambahkan.", "warning": warning}
    except Exception as exc:
        return _err(exc, "Gagal menyimpan kategori tiket")


@eel.expose
def delete_ticket_category(user_id, category_id):
    if not _require_admin(user_id):
        return {"ok": False, "message": "Akses ditolak."}
    try:
        existing = supabase.table("ticket_categories").select("sold,name").eq("category_id", category_id).limit(1).execute().data
        if not existing:
            return {"ok": False, "message": "Kategori tidak ditemukan."}
        sold = int(existing[0].get("sold") or 0)
        if sold > 0:
            return {"ok": False, "message": "Kategori dengan penjualan tidak dapat dihapus."}

        supabase.table("ticket_categories").delete().eq("category_id", category_id).execute()
        warning = _record_admin_activity(user_id, "Menghapus kategori tiket", existing[0].get("name") or str(category_id))
        return {"ok": True, "message": "Kategori tiket berhasil dihapus.", "warning": warning}
    except Exception as exc:
        return _err(exc, "Gagal menghapus kategori tiket")

VCOL = {
    "id":     "voucher_id",
    "code":   "code",
    "type":   "discount_type",    
    "value":  "discount_value",  
    "quota":  "max_usage",
    "end":    "valid_until",      
    "active": "is_active",
}

VTYPE = {"percent": "percent", "fixed": "fixed"}

_VCODE_RE = re.compile(r"^[A-Z0-9]{3,20}$")


def _voucher_out(row, used):
    kind = "percent" if row.get(VCOL["type"]) == VTYPE["percent"] else "fixed"
    return {
        "voucher_id": row[VCOL["id"]],
        "code": row[VCOL["code"]],
        "kind": kind,
        "value": float(row.get(VCOL["value"]) or 0),
        "quota": int(row.get(VCOL["quota"]) or 0),
        "used": used,
        "valid_until": row.get(VCOL["end"]),
        "is_active": bool(row.get(VCOL["active"], True)),
    }


def _voucher_usage():
    """Hitung pemakaian voucher dari pesanan yang sudah dibayar."""
    rows = (
        supabase.table("orders")
        .select("voucher_id,discount")
        .eq("status", "paid")
        .not_.is_("voucher_id", "null")
        .execute()
        .data or []
    )
    used, discount = {}, 0.0
    for r in rows:
        used[r["voucher_id"]] = used.get(r["voucher_id"], 0) + 1
        discount += float(r.get("discount") or 0)
    return used, discount


@eel.expose
# def get_admin_vouchers(user_id):
#     if not _require_admin(user_id):
#         return {"ok": False, "message": "Akses ditolak."}
#     try:
#         rows = supabase.table("vouchers").select("*").order(VCOL["id"]).execute().data or []
#         used, total_discount = _voucher_usage()
#         items = [_voucher_out(r, used.get(r[VCOL["id"]], 0)) for r in rows]
#         return {"ok": True, "vouchers": items, "total_used": sum(used.values()),
#                 "total_discount": total_discount}
#     except Exception as exc:
#         return _err(exc, "Gagal memuat voucher")

def get_admin_vouchers(user_id):
    if not _require_admin(user_id):
        return {"ok": False, "message": "Akses ditolak."}
    try:
        try:
            now_iso = datetime.now(timezone.utc).isoformat()
            supabase.table("vouchers").update({VCOL["active"]: False}) \
                .eq(VCOL["active"], True).lt(VCOL["end"], now_iso).execute()
        except Exception as exc:
            print("[VOUCHER EXPIRE]", repr(exc))

        rows = supabase.table("vouchers").select("*").order(VCOL["id"]).execute().data or []
        used, total_discount = _voucher_usage()
        items = [_voucher_out(r, used.get(r[VCOL["id"]], 0)) for r in rows]
        return {"ok": True, "vouchers": items, "total_used": sum(used.values()),
                "total_discount": total_discount}
    except Exception as exc:
        return _err(exc, "Gagal memuat voucher")


@eel.expose
def save_voucher(user_id, data):
    if not _require_admin(user_id):
        return {"ok": False, "message": "Akses ditolak."}
    data = data or {}
    vid = data.get("voucher_id")
    code = (data.get("code") or "").strip().upper()
    kind = data.get("kind")
    end = (data.get("valid_until") or "").strip()

    if not _VCODE_RE.match(code):
        return {"ok": False, "field": "code", "message": "Kode 3-20 karakter, hanya huruf besar dan angka."}
    if kind not in VTYPE:
        return {"ok": False, "field": "kind", "message": "Jenis voucher tidak valid."}
    try:
        value = float(data.get("value") or 0)
        quota = int(data.get("quota") or 0)
    except (TypeError, ValueError):
        return {"ok": False, "message": "Nilai dan kuota harus berupa angka."}
    if value <= 0:
        return {"ok": False, "field": "value", "message": "Nilai diskon harus lebih dari 0."}
    if kind == "percent" and value > 100:
        return {"ok": False, "field": "value", "message": "Diskon persen maksimal 100%."}
    if quota < 1:
        return {"ok": False, "field": "quota", "message": "Kuota minimal 1."}
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", end):
        return {"ok": False, "field": "valid_until", "message": "Tanggal berlaku sampai wajib diisi."}
    try:
        valid_until_date = datetime.strptime(end, "%Y-%m-%d").date()
    except ValueError:
        return {"ok": False, "field": "valid_until", "message": "Tanggal masa berlaku tidak valid."}
    today_wib = datetime.now(timezone(timedelta(hours=7))).date()
    if valid_until_date < today_wib:
        return {"ok": False, "field": "valid_until", "message": "Tanggal masa berlaku tidak boleh sebelum hari ini."}

    try:
        dup = supabase.table("vouchers").select(VCOL["id"]).eq(VCOL["code"], code).execute().data or []
        if any(str(d[VCOL["id"]]) != str(vid) for d in dup):
            return {"ok": False, "field": "code", "message": f"Kode {code} sudah dipakai."}

        payload = {
            VCOL["code"]: code,
            VCOL["type"]: VTYPE[kind],
            VCOL["value"]: value,
            VCOL["quota"]: quota,
            VCOL["end"]: f"{end}T23:59:59+07:00",
        }
        if vid:
            used, _ = _voucher_usage()
            if quota < used.get(vid, 0):
                return {"ok": False, "field": "quota",
                        "message": f"Kuota tidak boleh lebih kecil dari yang terpakai ({used.get(vid, 0)})."}
            supabase.table("vouchers").update(payload).eq(VCOL["id"], vid).execute()
            warning = _record_admin_activity(user_id, "Memperbarui voucher", code)
            return {"ok": True, "message": "Voucher diperbarui.", "warning": warning}

        payload[VCOL["active"]] = True
        supabase.table("vouchers").insert(payload).execute()
        warning = _record_admin_activity(user_id, "Menambahkan voucher", code)
        return {"ok": True, "message": "Voucher ditambahkan.", "warning": warning}
    except Exception as exc:
        return _err(exc, "Gagal menyimpan voucher")


@eel.expose
def toggle_voucher(user_id, voucher_id, active):
    if not _require_admin(user_id):
        return {"ok": False, "message": "Akses ditolak."}
    try:
        if active:
            rows = (
                supabase.table("vouchers")
                .select(f"{VCOL['quota']},{VCOL['end']}")
                .eq(VCOL["id"], voucher_id)
                .limit(1)
                .execute()
                .data or []
            )
            if not rows:
                return {"ok": False, "message": "Voucher tidak ditemukan."}
            used, _ = _voucher_usage()
            quota = int(rows[0].get(VCOL["quota"]) or 0)
            if used.get(voucher_id, 0) >= quota:
                return {"ok": False, "message": "Kuota voucher sudah habis dan tidak bisa diaktifkan."}
            if rows[0].get(VCOL["end"]) and _to_ms(rows[0][VCOL["end"]]) < _now_ms():
                return {"ok": False, "message": "Voucher sudah kedaluwarsa dan tidak bisa diaktifkan."}
        supabase.table("vouchers").update({VCOL["active"]: bool(active)}).eq(VCOL["id"], voucher_id).execute()
        action = "Mengaktifkan voucher" if active else "Menonaktifkan voucher"
        warning = _record_admin_activity(user_id, action, str(voucher_id))
        return {"ok": True, "message": "Voucher diaktifkan." if active else "Voucher dinonaktifkan.", "warning": warning}
    except Exception as exc:
        return _err(exc, "Gagal mengubah status voucher")


@eel.expose
def delete_voucher(user_id, voucher_id):
    if not _require_admin(user_id):
        return {"ok": False, "message": "Akses ditolak."}
    try:
        rows = (
            supabase.table("vouchers")
            .select(f"{VCOL['active']}")
            .eq(VCOL["id"], voucher_id)
            .limit(1)
            .execute()
            .data or []
        )
        if not rows:
            return {"ok": False, "message": "Voucher tidak ditemukan."}
        if rows[0].get(VCOL["active"], True):
            return {"ok": False, "message": "Nonaktifkan voucher terlebih dahulu sebelum menghapus."}
        used, _ = _voucher_usage()
        if used.get(voucher_id, 0) > 0:
            return {"ok": False, "message": "Voucher yang sudah dipakai tidak bisa dihapus. Nonaktifkan saja."}
        supabase.table("vouchers").delete().eq(VCOL["id"], voucher_id).execute()
        warning = _record_admin_activity(user_id, "Menghapus voucher", str(voucher_id))
        return {"ok": True, "message": "Voucher dihapus.", "warning": warning}
    except Exception as exc:
        return _err(exc, "Gagal menghapus voucher")
@eel.expose
def get_admin_orders(user_id):
    if not _require_admin(user_id):
        return {"ok": False, "message": "Akses ditolak."}
    try:
        orders = (
            supabase.table("orders")
            .select("order_id,order_code,user_id,total_amount,status,created_at,users!user_id(full_name,email,phone)")
            .order("created_at", desc=True)
            .execute()
            .data or []
        )
        items = (
            supabase.table("order_items")
            .select("order_id,quantity,subtotal,category_id,ticket_categories(name)")
            .execute()
            .data or []
        )
        cats = get_ticket_categories()

        item_map = {}
        for it in items:
            oid = it["order_id"]
            item_map.setdefault(oid, []).append(it)

        result = []
        for o in orders:
            oid = o["order_id"]
            o_items = item_map.get(oid, [])
            total_qty = sum(int(x.get("quantity") or 0) for x in o_items)
            cat_names = list({(x.get("ticket_categories") or {}).get("name") for x in o_items if (x.get("ticket_categories") or {}).get("name")})
            u = o.get("users") or {}
            result.append({
                "order_id": oid,
                "order_code": o["order_code"],
                "buyer_name": u.get("full_name") or "Pengunjung",
                "buyer_email": u.get("email") or "-",
                "total_tickets": total_qty,
                "categories": cat_names,
                "total_amount": float(o.get("total_amount") or 0),
                "status": o.get("status", "pending"),
                "created_at": o.get("created_at"),
            })

        return {"ok": True, "orders": result, "categories": cats}
    except Exception as exc:
        return _err(exc, "Gagal memuat daftar pesanan")


@eel.expose
def get_admin_order_detail(user_id, order_id):
    if not _require_admin(user_id):
        return {"ok": False, "message": "Akses ditolak."}
    try:
        o_res = (
            supabase.table("orders")
            .select("*, users!user_id(full_name,email,phone)")
            .eq("order_id", order_id)
            .limit(1)
            .execute()
            .data
        )
        if not o_res:
            return {"ok": False, "message": "Pesanan tidak ditemukan."}
        order = o_res[0]

        items = (
            supabase.table("order_items")
            .select("*, ticket_categories(name,price)")
            .eq("order_id", order_id)
            .execute()
            .data or []
        )
        tickets = (
            supabase.table("tickets")
            .select("*, ticket_categories(name)")
            .eq("order_id", order_id)
            .order("ticket_id")
            .execute()
            .data or []
        )
        payments = (
            supabase.table("payments")
            .select("*")
            .eq("order_id", order_id)
            .order("payment_id", desc=True)
            .execute()
            .data or []
        )

        return {
            "ok": True,
            "order": order,
            "items": items,
            "tickets": tickets,
            "payment": payments[0] if payments else None,
        }
    except Exception as exc:
        return _err(exc, "Gagal memuat detail pesanan")


@eel.expose
def admin_update_order_status(user_id, order_id, new_status):
    if not _require_admin(user_id):
        return {"ok": False, "message": "Akses ditolak."}
    if new_status not in ("pending", "paid", "cancelled", "expired"):
        return {"ok": False, "message": "Status pesanan tidak valid."}
    try:
        o_res = supabase.table("orders").select("*").eq("order_id", order_id).limit(1).execute().data
        if not o_res:
            return {"ok": False, "message": "Pesanan tidak ditemukan."}
        order = o_res[0]
        old_status = order.get("status")
        if old_status == new_status:
            return {"ok": True, "message": "Status pesanan sudah sesuai."}

        now_iso = datetime.now(timezone.utc).isoformat()
        supabase.table("orders").update({"status": new_status}).eq("order_id", order_id).execute()

        # Jika diverifikasi menjadi PAID -> update payment & terbitkan kode tiket
        if new_status == "paid":
            supabase.table("payments").update({"status": "success", "paid_at": now_iso}).eq("order_id", order_id).execute()
            t_list = supabase.table("tickets").select("ticket_id,ticket_code").eq("order_id", order_id).execute().data or []
            for idx, t in enumerate(t_list, start=1):
                code = t.get("ticket_code")
                if not code or "PENDING" in str(code).upper():
                    code = f"TW-C1-{int(order_id):04d}{idx:02d}"
                supabase.table("tickets").update({"ticket_code": code, "status": "valid"}).eq("ticket_id", t["ticket_id"]).execute()

        # Jika dibatalkan / expired dari status aktif -> batalkan tiket & kembalikan kuota terjual
        elif new_status in ("cancelled", "expired") and old_status in ("pending", "paid"):
            supabase.table("tickets").update({"status": "cancelled"}).eq("order_id", order_id).execute()
            if new_status == "cancelled":
                supabase.table("payments").update({"status": "failed"}).eq("order_id", order_id).execute()
            items = supabase.table("order_items").select("category_id,quantity").eq("order_id", order_id).execute().data or []
            for it in items:
                cid = it["category_id"]
                qty = int(it.get("quantity") or 0)
                cat = supabase.table("ticket_categories").select("sold").eq("category_id", cid).limit(1).execute().data
                if cat:
                    new_sold = max(0, int(cat[0].get("sold") or 0) - qty)
                    supabase.table("ticket_categories").update({"sold": new_sold}).eq("category_id", cid).execute()

        action = f"Mengubah status pesanan menjadi {new_status}"
        warning = _record_admin_activity(user_id, action, order.get("order_code") or str(order_id))
        return {
            "ok": True,
            "message": f"Status pesanan berhasil diubah menjadi {new_status}.",
            "warning": warning,
        }
    except Exception as exc:
        return _err(exc, "Gagal memperbarui status pesanan")

@eel.expose
def get_admin_payments(user_id):
    if not _require_admin(user_id):
        return {"ok": False, "message": "Akses ditolak."}
    try:
        payments = (
            supabase.table("payments")
            .select("*, orders(order_id,order_code,total_amount,status,users!user_id(full_name))")
            .order("payment_id", desc=True)
            .execute()
            .data or []
        )

        result = []
        for p in payments:
            ord_obj = p.get("orders") or {}
            usr_obj = ord_obj.get("users") or {}
            pid = p.get("payment_id")
            ref_code = p.get("reference_code") or f"PAY-{int(pid):04d}" if str(pid).isdigit() else f"PAY-{str(pid)[:6].upper()}"
            result.append({
                "payment_id": pid,
                "reference_code": ref_code,
                "order_id": ord_obj.get("order_id") or p.get("order_id"),
                "order_code": ord_obj.get("order_code") or "-",
                "buyer_name": usr_obj.get("full_name") or "Pengunjung",
                "method": p.get("method") or "Transfer Bank",
                "amount": float(p.get("amount") or ord_obj.get("total_amount") or 0),
                "status": p.get("status") or "pending",
                "paid_at": p.get("paid_at"),
                "created_at": p.get("created_at") or p.get("paid_at"),
            })

        return {"ok": True, "payments": result}
    except Exception as exc:
        return _err(exc, "Gagal memuat data pembayaran")


@eel.expose
def admin_verify_payment(user_id, payment_id, decision, reason=""):
    if not _require_admin(user_id):
        return {"ok": False, "message": "Akses ditolak."}
    if decision not in ("approve", "reject"):
        return {"ok": False, "message": "Keputusan verifikasi tidak valid."}

    reason = (reason or "").strip()
    if decision == "reject" and len(reason) < 3:
        return {"ok": False, "message": "Penolakan wajib disertai alasan (minimal 3 karakter)."}

    try:
        p_res = (
            supabase.table("payments")
            .select("*, orders(order_id,order_code,status)")
            .eq("payment_id", payment_id)
            .limit(1)
            .execute()
            .data
        )
        if not p_res:
            return {"ok": False, "message": "Data pembayaran tidak ditemukan."}

        pay = p_res[0]
        ord_obj = pay.get("orders") or {}
        order_id = ord_obj.get("order_id") or pay.get("order_id")
        old_order_status = ord_obj.get("status")
        ref_code = pay.get("reference_code") or f"PAY-{int(payment_id):04d}" if str(payment_id).isdigit() else f"PAY-{str(payment_id)[:6].upper()}"
        now_iso = datetime.now(timezone.utc).isoformat()

        if decision == "approve":
            email_status_msg = ""
            if order_id:
                ord_res = (
                    supabase.table("orders")
                    .select("order_id,order_code,user_id,users!user_id(full_name,email)")
                    .eq("order_id", str(order_id))
                    .limit(1)
                    .execute()
                    .data
                )
                if not ord_res:
                    return {"ok": False, "message": "Data pesanan tidak ditemukan."}

                ord_data = ord_res[0]
                buyer_user_id = str(ord_data["user_id"])
                order_code = ord_data.get("order_code") or ref_code
                u_info = ord_data.get("users") or {}

                try:
                    supabase.rpc("admin_complete_ticket_payment", {
                        "p_order_id": str(order_id),
                        "p_user_id": buyer_user_id
                    }).execute()
                except Exception as rpc_exc:
                    print("[RPC admin_complete_ticket_payment]", repr(rpc_exc))
                    return _err(rpc_exc, "Gagal menerbitkan e-ticket di database")

                supabase.table("payments").update({
                    "status": "success",
                    "paid_at": now_iso,
                }).eq("payment_id", payment_id).execute()

                t_list = (
                    supabase.table("tickets")
                    .select("ticket_id,ticket_code,holder_name,category_id,ticket_categories(name)")
                    .eq("order_id", str(order_id))
                    .execute()
                    .data or []
                )

                sent_ok, sent_info = _send_eticket_email(
                    u_info.get("email"),
                    u_info.get("full_name") or "Pengunjung",
                    order_code,
                    t_list
                )
                email_status_msg = " E-ticket dikirim ke Gmail pembeli." if sent_ok else f" (Email gagal: {sent_info})"

            warning = _record_admin_activity(user_id, "Memverifikasi pembayaran", ref_code)
            return {
                "ok": True,
                "type": "success",
                "message": f"{ref_code} disetujui. Pesanan menjadi Paid dan tiket diterbitkan.{email_status_msg}"
            }
        else:
            supabase.table("payments").update({
                "status": "failed"
            }).eq("payment_id", payment_id).execute()

            if order_id:
                supabase.table("orders").update({"status": "cancelled"}).eq("order_id", str(order_id)).execute()
                supabase.table("tickets").update({"status": "cancelled"}).eq("order_id", str(order_id)).execute()

                if old_order_status in ("pending", "paid"):
                    items = supabase.table("order_items").select("category_id,quantity").eq("order_id", str(order_id)).execute().data or []
                    for it in items:
                        cid = it["category_id"]
                        qty = int(it.get("quantity") or 0)
                        cat = supabase.table("ticket_categories").select("sold").eq("category_id", cid).limit(1).execute().data
                        if cat:
                            new_sold = max(0, int(cat[0].get("sold") or 0) - qty)
                            supabase.table("ticket_categories").update({"sold": new_sold}).eq("category_id", cid).execute()

            warning = _record_admin_activity(user_id, "Menolak pembayaran", ref_code)
            return {
                "ok": True,
                "type": "error",
                "message": f"{ref_code} ditolak: {reason}.",
                "warning": warning,
            }
    except Exception as exc:
        return _err(exc, "Gagal memproses verifikasi pembayaran")


# ---------------- ADMIN CHECK-IN ----------------

def _normalize_ticket_code(ticket_code):
    return re.sub(r"[^A-Z0-9]", "", str(ticket_code or "").upper())

@eel.expose
def get_admin_checkin_data(user_id):
    if not _require_admin(user_id):
        return {"ok": False, "message": "Akses ditolak."}

    try:
        ticket_categories = (
            supabase.table("ticket_categories")
            .select("sold")
            .execute()
            .data or []
        )
        total_ticket_sales = sum(
            int(category.get("sold") or 0)
            for category in ticket_categories
        )

        paid_orders = (
            supabase.table("orders")
            .select("order_id")
            .eq("status", "paid")
            .execute()
            .data or []
        )
        paid_order_ids = [str(o["order_id"]) for o in paid_orders]

        tickets = []
        if paid_order_ids:
            tickets = (
                supabase.table("tickets")
                .select("ticket_id,ticket_code,holder_name,category_id,status,order_id")
                .in_("order_id", paid_order_ids)
                .execute()
                .data or []
            )

        checkin_by_ticket = {}
        ticket_ids = [str(ticket["ticket_id"]) for ticket in tickets]
        if ticket_ids:
            checkin_rows = (
                supabase.table("checkins")
                .select("ticket_id,checkin_time")
                .in_("ticket_id", ticket_ids)
                .order("checkin_time", desc=True)
                .execute()
                .data or []
            )
            checkin_by_ticket = {
                str(row["ticket_id"]): row.get("checkin_time")
                for row in checkin_rows
            }

        checked_in = [t for t in tickets if t["status"] == "used"]
        sample_valid_code = next(
            (str(t["ticket_code"]).strip().upper()
             for t in tickets
             if t["status"] == "valid" and t.get("ticket_code")),
            ""
        )
        sample_used_code = next(
            (str(t["ticket_code"]).strip().upper()
             for t in checked_in
             if t.get("ticket_code")),
            ""
        )
        valid_ticket_list = [
            {
                "ticket_code": str(t["ticket_code"]).strip().upper(),
                "holder_name": t.get("holder_name") or "-",
                "status": t["status"]
            }
            for t in tickets
            if t.get("ticket_code") and t["status"] in ("valid", "used")
        ]

        history = []
        for ticket in checked_in:
            category = (
                supabase.table("ticket_categories")
                .select("name")
                .eq("category_id", ticket["category_id"])
                .limit(1)
                .execute().data or []
            )

            history.append({
                "ticket_code": ticket["ticket_code"],
                "holder_name": ticket["holder_name"],
                "category": category[0]["name"] if category else "-",
                "checked_in_at": checkin_by_ticket.get(str(ticket["ticket_id"]))
            })

        history.sort(
            key=lambda item: item["checked_in_at"] or "",
            reverse=True
        )

        return {
            "ok": True,
            "total_sold": total_ticket_sales,
            "checked_in": len(checked_in),
            "gate": "CAT 1 / PINTU 02",
            "history": history[:10],
            "tickets": valid_ticket_list,
            "sample_valid_code": sample_valid_code,
            "sample_used_code": sample_used_code
        }

    except Exception as exc:
        return _err(exc, "Gagal mengambil data check-in")


@eel.expose
def admin_check_ticket(user_id, ticket_code):
    if not _require_admin(user_id):
        return {"ok": False, "message": "Akses ditolak."}

    ticket_code = (ticket_code or "").strip().upper()
    normalized_code = _normalize_ticket_code(ticket_code)

    if not normalized_code:
        return {"ok": False, "message": "Masukkan kode tiket."}

    try:
        tickets = (
            supabase.table("tickets")
            .select("ticket_id,ticket_code,holder_name,category_id,status,order_id")
            .execute()
            .data or []
        )
        rows = [
            t for t in tickets
            if _normalize_ticket_code(t.get("ticket_code")) == normalized_code
        ]

        if not rows:
            return {"ok": False, "message": "Tiket tidak ditemukan."}

        ticket = rows[0]

        if ticket["status"] == "used":
            return {
                "ok": False,
                "status": "used",
                "message": "Tiket sudah pernah digunakan."
            }

        if ticket["status"] != "valid":
            return {
                "ok": False,
                "status": ticket["status"],
                "message": "Tiket tidak valid atau belum aktif."
            }

        # Pastikan pesanan sudah dibayar
        order = (
            supabase.table("orders")
            .select("status")
            .eq("order_id", ticket["order_id"])
            .limit(1)
            .execute()
            .data or []
        )

        if not order or order[0]["status"] != "paid":
            return {
                "ok": False,
                "message": "Pembayaran tiket belum terverifikasi."
            }

        checkin_time = datetime.now(timezone.utc).isoformat()
        result = (
            supabase.table("tickets")
            .update({
                "status": "used"
            })
            .eq("ticket_id", ticket["ticket_id"])
            .eq("status", "valid")
            .execute()
        )

        if not result.data:
            return {
                "ok": False,
                "message": "Tiket sudah diproses petugas lain."
            }

        try:
            supabase.table("checkins").insert({
                "ticket_id": ticket["ticket_id"],
                "checked_by": str(user_id),
                "checkin_time": checkin_time
            }).execute()
        except Exception:
            rollback = (
                supabase.table("tickets")
                .update({"status": "valid"})
                .eq("ticket_id", ticket["ticket_id"])
                .eq("status", "used")
                .execute()
            )
            if not rollback.data:
                print("[CHECK-IN] Gagal mengembalikan status tiket setelah insert checkins gagal.")
            raise

        category = (
            supabase.table("ticket_categories")
            .select("name")
            .eq("category_id", ticket["category_id"])
            .limit(1)
            .execute()
            .data or []
        )

        return {
            "ok": True,
            "status": "valid",
            "message": "TIKET VALID. Pengunjung boleh masuk.",
            "ticket": {
                "ticket_code": ticket["ticket_code"],
                "holder_name": ticket["holder_name"],
                "category": category[0]["name"] if category else "-"
            }
        }

    except Exception as exc:
        return _err(exc, "Gagal memvalidasi tiket")

if __name__ == "__main__":
    eel.start("index.html", size=(1440, 900))
