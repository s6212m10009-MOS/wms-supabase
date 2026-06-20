-- =====================================================================
-- 0002 — แก้บั๊ก move_stock: transaction id ชนกัน
-- ปัญหาเดิม: v_tx_id สร้างจาก epoch มิลลิวินาที (TX-<epoch_ms>)
--           เมื่อเรียก move_stock หลายครั้งภายในมิลลิวินาทีเดียวกัน
--           (เช่นสแกนรัวๆ / หลายคนพร้อมกัน) id จะซ้ำ → duplicate key (transactions_pkey)
-- วิธีแก้:   ใช้ sequence (เลขเดินไม่ซ้ำตลอด) + วันที่ → TX-YYYYMMDD-<running no.>
--
-- รันไฟล์นี้กับ DB ที่รัน 0001_init.sql ไปแล้ว (idempotent — รันซ้ำได้)
-- =====================================================================

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

grant execute on function public.move_stock(text,text,text,integer,text,text,text,text) to anon, authenticated;
