-- =====================================================================
-- WMS (ระบบจัดการคลังสินค้า) — Supabase / PostgreSQL schema
-- Migration: 0001_init
-- รันไฟล์นี้ใน Supabase Dashboard > SQL Editor (หรือ supabase db push)
-- =====================================================================

-- ---------- ตาราง: warehouses (คลัง/อาคาร) ----------
create table if not exists public.warehouses (
  id          text primary key,           -- เช่น WH-01
  name        text not null,
  created_at  timestamptz not null default now()
);

-- ---------- ตาราง: locations (ตำแหน่งจัดเก็บ) ----------
create table if not exists public.locations (
  barcode       text primary key,         -- เช่น LOC-A1-01
  warehouse_id  text references public.warehouses(id) on delete set null,
  zone          text,
  bay           text,
  level         text,
  capacity      integer not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists idx_locations_warehouse on public.locations(warehouse_id);

-- ---------- ตาราง: products (สินค้า / SKU) ----------
create table if not exists public.products (
  id          text primary key,           -- รหัสสินค้า/SKU
  name        text not null,
  barcode     text,
  unit        text not null default 'ชิ้น',
  category    text,
  min_stock   integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists idx_products_barcode on public.products(barcode);

-- ---------- ตาราง: inventory (สต็อก สินค้า × ตำแหน่ง) ----------
create table if not exists public.inventory (
  id                text primary key,      -- `${product_id}::${location_barcode}`
  product_id        text not null references public.products(id) on delete cascade,
  location_barcode  text not null references public.locations(barcode) on delete cascade,
  qty               integer not null default 0,
  updated_at        timestamptz not null default now(),
  unique (product_id, location_barcode)
);
create index if not exists idx_inventory_product on public.inventory(product_id);
create index if not exists idx_inventory_location on public.inventory(location_barcode);

-- ---------- ตาราง: transactions (ประวัติการเคลื่อนไหวสต็อก) ----------
create table if not exists public.transactions (
  id            text primary key,          -- เช่น TX-1718800000000
  ts            timestamptz not null default now(),  -- เวลาทำรายการ
  type          text not null check (type in ('STOCK_IN','STOCK_OUT','TRANSFER')),
  product_id    text not null,
  product_name  text not null,
  source_loc    text,
  dest_loc      text,
  qty           integer not null check (qty > 0),
  "user"        text not null,
  reference     text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_tx_ts on public.transactions(ts desc);
create index if not exists idx_tx_product on public.transactions(product_id);

-- ---------- ตาราง: app_users (ผู้ใช้งานระบบ) ----------
-- หมายเหตุ: production ควรใช้ Supabase Auth แทนการเก็บผู้ใช้ในตารางนี้
create table if not exists public.app_users (
  username    text primary key,
  name        text not null,
  role        text not null default 'staff' check (role in ('admin','staff')),
  created_at  timestamptz not null default now()
);

-- =====================================================================
-- ฟังก์ชัน: move_stock — ทำรายการ รับเข้า/เบิกออก/โอนย้าย แบบ atomic
-- บันทึก transaction log + ปรับ inventory ในธุรกรรมเดียว
-- เรียกผ่าน supabase.rpc('move_stock', {...})
-- =====================================================================
-- sequence สำหรับสร้างเลขที่ transaction ที่ไม่ซ้ำ (กันชนเมื่อเรียกถี่ๆ)
create sequence if not exists public.tx_id_seq;

create or replace function public.move_stock(
  p_type          text,
  p_product_id    text,
  p_product_name  text,
  p_qty           integer,
  p_source_loc    text default null,
  p_dest_loc      text default null,
  p_user          text default 'staff',
  p_reference     text default null
)
returns public.transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx   public.transactions;
  v_tx_id text;
  v_src_qty integer;
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'จำนวนต้องมากกว่า 0';
  end if;
  if p_type not in ('STOCK_IN','STOCK_OUT','TRANSFER') then
    raise exception 'ประเภทไม่ถูกต้อง: %', p_type;
  end if;
  if p_type in ('STOCK_OUT','TRANSFER') and (p_source_loc is null or p_source_loc = '') then
    raise exception 'ต้องระบุตำแหน่งต้นทาง';
  end if;
  if p_type in ('STOCK_IN','TRANSFER') and (p_dest_loc is null or p_dest_loc = '') then
    raise exception 'ต้องระบุตำแหน่งปลายทาง';
  end if;

  -- เบิกออกจากต้นทาง (STOCK_OUT, TRANSFER)
  if p_type in ('STOCK_OUT','TRANSFER') then
    select qty into v_src_qty
      from public.inventory
      where id = p_product_id || '::' || p_source_loc
      for update;

    if v_src_qty is null then v_src_qty := 0; end if;
    if v_src_qty < p_qty then
      raise exception 'สต็อกไม่พอที่ % (มี %, ต้องการ %)', p_source_loc, v_src_qty, p_qty;
    end if;

    insert into public.inventory (id, product_id, location_barcode, qty, updated_at)
    values (p_product_id || '::' || p_source_loc, p_product_id, p_source_loc, v_src_qty - p_qty, now())
    on conflict (id) do update set qty = excluded.qty, updated_at = now();
  end if;

  -- รับเข้าที่ปลายทาง (STOCK_IN, TRANSFER)
  if p_type in ('STOCK_IN','TRANSFER') then
    insert into public.inventory (id, product_id, location_barcode, qty, updated_at)
    values (p_product_id || '::' || p_dest_loc, p_product_id, p_dest_loc, p_qty, now())
    on conflict (id) do update
      set qty = public.inventory.qty + excluded.qty, updated_at = now();
  end if;

  -- บันทึก transaction log
  -- id ไม่ซ้ำเด็ดขาด: TX-YYYYMMDD-<running no.> เช่น TX-20260620-000008
  v_tx_id := 'TX-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('public.tx_id_seq')::text, 6, '0');
  insert into public.transactions
    (id, ts, type, product_id, product_name, source_loc, dest_loc, qty, "user", reference)
  values
    (v_tx_id, now(), p_type, p_product_id, p_product_name,
     nullif(p_source_loc, ''), nullif(p_dest_loc, ''), p_qty, p_user, nullif(p_reference, ''))
  returning * into v_tx;

  return v_tx;
end;
$$;

-- =====================================================================
-- Row Level Security (RLS)
-- โหมดพัฒนา: อนุญาต anon อ่าน/เขียนได้ (สะดวกตอนทดสอบ)
-- ⚠️ ก่อนขึ้น production ให้ลบ policy ด้านล่างแล้วใช้ Supabase Auth
-- =====================================================================
alter table public.warehouses   enable row level security;
alter table public.locations    enable row level security;
alter table public.products     enable row level security;
alter table public.inventory    enable row level security;
alter table public.transactions enable row level security;
alter table public.app_users    enable row level security;

-- DEV policies (เปิดกว้าง) — ใช้ตอนพัฒนาเท่านั้น
create policy "dev all warehouses"   on public.warehouses   for all using (true) with check (true);
create policy "dev all locations"    on public.locations    for all using (true) with check (true);
create policy "dev all products"     on public.products     for all using (true) with check (true);
create policy "dev all inventory"    on public.inventory    for all using (true) with check (true);
create policy "dev read transactions" on public.transactions for select using (true);
create policy "dev all app_users"    on public.app_users    for all using (true) with check (true);

-- ให้ anon/authenticated เรียกฟังก์ชัน move_stock ได้ (เขียน log ผ่าน SECURITY DEFINER)
grant execute on function public.move_stock(text,text,text,integer,text,text,text,text) to anon, authenticated;

-- =====================================================================
-- ตัวอย่าง policy สำหรับ production (เปิดใช้เมื่อต่อ Supabase Auth)
-- =====================================================================
-- drop policy if exists "dev all products" on public.products;  -- ฯลฯ
-- create policy "auth read products" on public.products
--   for select to authenticated using (true);
-- create policy "auth write products" on public.products
--   for all to authenticated using (true) with check (true);
-- -- transactions: อ่านได้, สร้างผ่าน RPC เท่านั้น, ห้ามแก้/ลบย้อนหลัง
-- create policy "auth read tx" on public.transactions
--   for select to authenticated using (true);
