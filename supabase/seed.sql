-- =====================================================================
-- WMS — ข้อมูลเริ่มต้น (warehouses, locations, app_users)
-- รันหลังจาก 0001_init.sql
-- สินค้า (products) นำเข้าด้วยสคริปต์: npm run import  (อ่านจาก CSV)
-- =====================================================================

insert into public.warehouses (id, name) values
  ('WH-01', 'อาคาร 1 (คลังสินค้าหลัก)'),
  ('WH-02', 'อาคาร 2 (คลังสินค้าสำรอง)')
on conflict (id) do update set name = excluded.name;

insert into public.locations (barcode, warehouse_id, zone, bay, level, capacity) values
  ('LOC-A1-01', 'WH-01', 'Zone A (ความหนาแน่นสูง)', 'Bay 1', 'ชั้น 1', 100),
  ('LOC-A1-02', 'WH-01', 'Zone A (ความหนาแน่นสูง)', 'Bay 1', 'ชั้น 2', 80),
  ('LOC-A2-01', 'WH-01', 'Zone A (ความหนาแน่นสูง)', 'Bay 2', 'ชั้น 1', 100),
  ('LOC-B1-01', 'WH-01', 'Zone B (ทั่วไป)', 'Bay 1', 'ชั้น 1', 150),
  ('LOC-B1-02', 'WH-01', 'Zone B (ทั่วไป)', 'Bay 1', 'ชั้น 2', 150),
  ('LOC-C1-01', 'WH-02', 'Zone C (ห้องเย็น)', 'Bay 1', 'ชั้น 1', 50),
  ('LOC-C1-02', 'WH-02', 'Zone C (ห้องเย็น)', 'Bay 1', 'ชั้น 2', 50),
  ('LOC-D1-01', 'WH-02', 'Zone D (สินค้าชิ้นใหญ่)', 'Bay 1', 'ชั้น 1', 40),
  ('LOC-D2-01', 'WH-02', 'Zone D (สินค้าชิ้นใหญ่)', 'Bay 2', 'ชั้น 1', 40)
on conflict (barcode) do update
  set warehouse_id = excluded.warehouse_id, zone = excluded.zone,
      bay = excluded.bay, level = excluded.level, capacity = excluded.capacity;

insert into public.app_users (username, name, role) values
  ('admin', 'สมชาย ใจดี', 'admin'),
  ('staff', 'สมศักดิ์ รักงาน', 'staff')
on conflict (username) do update set name = excluded.name, role = excluded.role;
