-- =====================================================================
-- 0003 — ล็อกความปลอดภัย: anon อ่านได้อย่างเดียว, เขียนได้เฉพาะผู้ที่ login (authenticated)
-- ใช้แทน DEV policy ใน 0001 ก่อนเปิดใช้งานจริง / ก่อน deploy เป็น public
-- =====================================================================

-- ลบ DEV policy ที่เปิดกว้าง (anon เขียนได้)
drop policy if exists "dev all warehouses"    on public.warehouses;
drop policy if exists "dev all locations"     on public.locations;
drop policy if exists "dev all products"      on public.products;
drop policy if exists "dev all inventory"     on public.inventory;
drop policy if exists "dev all app_users"     on public.app_users;
drop policy if exists "dev read transactions" on public.transactions;

-- อ่านได้อย่างเดียว (anon + authenticated)
create policy "read warehouses"   on public.warehouses   for select using (true);
create policy "read locations"    on public.locations    for select using (true);
create policy "read products"     on public.products     for select using (true);
create policy "read inventory"    on public.inventory    for select using (true);
create policy "read transactions" on public.transactions for select using (true);
create policy "read app_users"    on public.app_users    for select using (true);

-- การเขียนสต็อกทำผ่าน move_stock เท่านั้น และเฉพาะผู้ที่ login แล้ว
-- หมายเหตุ: Postgres ให้ EXECUTE แก่ PUBLIC โดยปริยาย จึงต้อง revoke จาก public ด้วย
revoke execute on function public.move_stock(text,text,text,integer,text,text,text,text) from public;
revoke execute on function public.move_stock(text,text,text,integer,text,text,text,text) from anon;
grant  execute on function public.move_stock(text,text,text,integer,text,text,text,text) to authenticated;
