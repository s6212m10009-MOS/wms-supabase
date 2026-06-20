# วิธีขึ้น GitHub

โปรเจกต์นี้ commit ไว้พร้อม push แล้ว มี 2 วิธี

## วิธีที่ 1 — ใช้ GitHub CLI (`gh`) ง่ายสุด

ติดตั้ง `gh` (https://cli.github.com) แล้วรันในโฟลเดอร์ `wms-supabase`:

```bash
gh auth login
gh repo create wms-supabase --public --source=. --remote=origin --push
```

> ถ้ายังไม่มี git history ในโฟลเดอร์นี้ ให้กู้จาก bundle ก่อน (ดูวิธีที่ 2 ข้อ 1)

## วิธีที่ 2 — สร้าง repo เปล่าบน GitHub เองแล้ว push

1) (ถ้าโฟลเดอร์ยังไม่มี `.git`) กู้ประวัติจากไฟล์ `wms-supabase.bundle`:
```bash
git clone wms-supabase.bundle wms-supabase-repo
cd wms-supabase-repo
```
หรือเริ่มใหม่ในโฟลเดอร์ปัจจุบัน:
```bash
git init && git add -A && git commit -m "WMS บน Supabase"
git branch -M main
```

2) สร้าง repository เปล่าที่ https://github.com/new (ตั้งชื่อ เช่น `wms-supabase`, อย่าติ๊ก add README)

3) เชื่อม remote แล้ว push:
```bash
git remote add origin https://github.com/<ชื่อผู้ใช้>/wms-supabase.git
git push -u origin main
```

## หลังจากขึ้น GitHub แล้ว — deploy ฟรีด้วย Vercel
1. เข้า https://vercel.com → Add New → Project → เลือก repo `wms-supabase`
2. ใส่ Environment Variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy

---
ไฟล์ `wms-supabase.bundle` คือสำเนา git history ทั้งหมด (พกพาได้) — เก็บไว้หรือลบหลัง push ขึ้น GitHub แล้วก็ได้
