# WMS — ระบบจัดการคลังสินค้า (Next.js + Supabase)

ระบบจัดการคลังสินค้า (Warehouse Management System) สแกนบาร์โค้ดเพื่อ **รับเข้า / เบิกออก / โอนย้าย** สต็อก
พร้อมแดชบอร์ด สต็อกคงเหลือ รายการสินค้า และประวัติธุรกรรม

เวอร์ชันนี้ย้ายฐานข้อมูลจาก Firebase Firestore มาเป็น **Supabase (PostgreSQL)**

## Stack

- **Next.js 14** (App Router) + TypeScript + Tailwind CSS
- **Supabase** — PostgreSQL, Row Level Security, RPC (stored function)
- การเคลื่อนไหวสต็อกทำแบบ **atomic** ผ่าน stored function `move_stock()`

## โครงสร้างโปรเจกต์

```
wms-supabase/
├── supabase/
│   ├── migrations/0001_init.sql   # สร้างตารางทั้งหมด + ฟังก์ชัน move_stock + RLS
│   └── seed.sql                   # ข้อมูลเริ่มต้น: warehouses, locations, app_users
├── scripts/
│   ├── import-products.ts         # นำเข้าสินค้าจาก CSV เข้า Supabase
│   └── products_import.csv        # ข้อมูลสินค้า
├── src/
│   ├── app/                       # หน้า: แดชบอร์ด, สแกน, สต็อก, สินค้า, ธุรกรรม
│   ├── components/                # UI ส่วนกลาง + Sidebar
│   └── lib/
│       ├── supabase.ts            # Supabase client
│       ├── db.ts                  # ชั้นข้อมูล (แมป snake_case ↔ camelCase)
│       └── types.ts               # โมเดลข้อมูล
└── .env.local.example
```

## ตารางในฐานข้อมูล

| ตาราง | คำอธิบาย |
|------|----------|
| `warehouses` | คลัง/อาคาร (WH-01, WH-02) |
| `locations` | ตำแหน่งจัดเก็บ (LOC-A1-01 …) อ้างอิง warehouse |
| `products` | สินค้า/SKU พร้อมบาร์โค้ด หน่วย หมวดหมู่ ขั้นต่ำ |
| `inventory` | สต็อกคงเหลือ ราย (สินค้า × ตำแหน่ง) |
| `transactions` | ประวัติการเคลื่อนไหว STOCK_IN / STOCK_OUT / TRANSFER |
| `app_users` | ผู้ใช้งานระบบ (admin / staff) |

## วิธีติดตั้ง

### 1) สร้างโปรเจกต์ Supabase
ไปที่ https://supabase.com → New project → จดค่า **Project URL** และ **anon key**
(Project Settings → API)

### 2) สร้างตารางและฟังก์ชัน
เปิด **SQL Editor** ใน Supabase Dashboard แล้วรันทีละไฟล์:
1. คัดลอกเนื้อหา `supabase/migrations/0001_init.sql` → Run
2. คัดลอกเนื้อหา `supabase/seed.sql` → Run

> หรือถ้าใช้ Supabase CLI: `supabase db push` แล้ว `supabase db execute -f supabase/seed.sql`

### 3) ตั้งค่า environment
```bash
cp .env.local.example .env.local
```
แก้ `.env.local` ใส่ค่า:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (เฉพาะตอน import — ห้าม commit)

### 4) ติดตั้ง dependencies และนำเข้าสินค้า
```bash
npm install
npm run import      # นำเข้าสินค้าจาก scripts/products_import.csv
```

### 5) รันแอป
```bash
npm run dev
```
เปิด http://localhost:3000

## การใช้งาน

- **สแกน รับ/จ่าย/โอน** — เลือกโหมด สแกนบาร์โค้ดสินค้า ระบุตำแหน่งและจำนวน ระบบจะปรับสต็อกและบันทึก log แบบ atomic
- **สต็อกคงเหลือ** — ดูสต็อกราย (สินค้า × ตำแหน่ง) ค้นหาได้
- **สินค้า** — รายการสินค้า พร้อมยอดคงเหลือและแจ้งเตือนต่ำกว่าขั้นต่ำ
- **ประวัติธุรกรรม** — ดูการเคลื่อนไหวล่าสุด

## หมายเหตุด้านความปลอดภัย (production)

migration `0001_init.sql` เปิด RLS แบบ **DEV** (อนุญาต anon อ่าน/เขียน) เพื่อให้ทดสอบง่าย
ก่อนขึ้นใช้งานจริง ควร:
1. ต่อ **Supabase Auth** แล้วเปลี่ยน policy ให้จำกัดสิทธิ์ตามผู้ใช้ (มีตัวอย่างคอมเมนต์ไว้ท้ายไฟล์ migration)
2. ปิดสิทธิ์เขียน `transactions` โดยตรง ให้สร้างได้ผ่าน RPC `move_stock` เท่านั้น
3. ห้าม commit `service_role` key

## Deploy

แนะนำ **Vercel**: import repo จาก GitHub แล้วตั้ง Environment Variables
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Deploy
