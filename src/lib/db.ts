import { supabase } from "./supabase";
import type {
  Product,
  Warehouse,
  Location,
  InventoryItem,
  Transaction,
  TxType,
} from "./types";

// ---------- ตัวช่วย ----------
export function invId(productId: string, locationBarcode: string) {
  return `${productId}::${locationBarcode}`;
}

export function bangkokISOString(d = new Date()) {
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const bkk = new Date(utc + 3600000 * 7);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${bkk.getFullYear()}-${pad(bkk.getMonth() + 1)}-${pad(bkk.getDate())}` +
    `T${pad(bkk.getHours())}:${pad(bkk.getMinutes())}:${pad(bkk.getSeconds())}+07:00`
  );
}

// ---------- ตัวแมป snake_case (DB) → camelCase (แอป) ----------
/* eslint-disable @typescript-eslint/no-explicit-any */
function toProduct(r: any): Product {
  return {
    id: r.id,
    name: r.name ?? "",
    barcode: r.barcode ?? "",
    unit: r.unit ?? "",
    category: r.category ?? "",
    minStock: r.min_stock ?? 0,
  };
}
function toLocation(r: any): Location {
  return {
    barcode: r.barcode,
    warehouseId: r.warehouse_id ?? "",
    zone: r.zone ?? "",
    bay: r.bay ?? "",
    level: r.level ?? "",
    capacity: r.capacity ?? 0,
  };
}
function toInventory(r: any): InventoryItem {
  return {
    id: r.id,
    productId: r.product_id,
    locationBarcode: r.location_barcode,
    qty: r.qty ?? 0,
  };
}
function toTransaction(r: any): Transaction {
  return {
    id: r.id,
    timestamp: r.ts,
    type: r.type as TxType,
    productId: r.product_id,
    productName: r.product_name,
    sourceLoc: r.source_loc ?? null,
    destLoc: r.dest_loc ?? null,
    qty: r.qty ?? 0,
    user: r.user,
    reference: r.reference ?? undefined,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function check<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  return data as T;
}

// ---------- Products ----------
export async function getProducts(): Promise<Product[]> {
  const { data, error } = await supabase.from("products").select("*").order("id");
  return check(data, error).map(toProduct);
}

export async function getProduct(id: string): Promise<Product | null> {
  const { data, error } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toProduct(data) : null;
}

export async function getProductByBarcode(barcode: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("barcode", barcode)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toProduct(data) : null;
}

/** ค้นหาสินค้าจากบาร์โค้ด หรือรหัสสินค้า (id) — สำหรับการยิงสแกน */
export async function findProduct(q: string): Promise<Product | null> {
  const code = q.trim();
  if (!code) return null;
  const byBarcode = await getProductByBarcode(code);
  if (byBarcode) return byBarcode;
  return getProduct(code);
}

export async function saveProduct(p: Product): Promise<void> {
  const { error } = await supabase.from("products").upsert({
    id: p.id,
    name: p.name,
    barcode: p.barcode,
    unit: p.unit,
    category: p.category,
    min_stock: p.minStock,
  });
  if (error) throw new Error(error.message);
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------- Warehouses / Locations ----------
export async function getWarehouses(): Promise<Warehouse[]> {
  const { data, error } = await supabase.from("warehouses").select("*").order("id");
  return check(data, error).map((r) => ({ id: r.id, name: r.name }));
}

export async function getLocations(): Promise<Location[]> {
  const { data, error } = await supabase.from("locations").select("*").order("barcode");
  return check(data, error).map(toLocation);
}

export async function getLocation(barcode: string): Promise<Location | null> {
  const { data, error } = await supabase
    .from("locations")
    .select("*")
    .eq("barcode", barcode)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toLocation(data) : null;
}

// ---------- Inventory ----------
export async function getInventory(): Promise<InventoryItem[]> {
  const { data, error } = await supabase.from("inventory").select("*").gt("qty", 0);
  return check(data, error).map(toInventory);
}

export async function getStockOf(productId: string): Promise<number> {
  const { data, error } = await supabase
    .from("inventory")
    .select("qty")
    .eq("product_id", productId);
  return check(data, error).reduce((sum: number, r: { qty: number }) => sum + (r.qty ?? 0), 0);
}

// ---------- Transactions ----------
export async function getTransactions(max = 100): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .order("ts", { ascending: false })
    .limit(max);
  return check(data, error).map(toTransaction);
}

// ---------- การเคลื่อนไหวสต็อก (atomic ด้วย RPC move_stock) ----------
interface MoveArgs {
  type: TxType;
  product: Product;
  qty: number;
  sourceLoc?: string | null; // จำเป็นสำหรับ OUT / TRANSFER
  destLoc?: string | null;   // จำเป็นสำหรับ IN / TRANSFER
  user: string;
  reference?: string;
}

/**
 * เรียก stored function move_stock บน Postgres ซึ่งทำงานแบบ atomic:
 * - STOCK_IN: +qty ที่ destLoc
 * - STOCK_OUT: -qty ที่ sourceLoc (ตรวจสต็อกพอ)
 * - TRANSFER: -qty ที่ sourceLoc, +qty ที่ destLoc
 * พร้อมบันทึก transaction log ในธุรกรรมเดียว
 */
export async function moveStock(args: MoveArgs): Promise<Transaction> {
  const { type, product, qty, sourceLoc, destLoc, user, reference } = args;
  if (qty <= 0) throw new Error("จำนวนต้องมากกว่า 0");

  const { data, error } = await supabase.rpc("move_stock", {
    p_type: type,
    p_product_id: product.id,
    p_product_name: product.name,
    p_qty: qty,
    p_source_loc: sourceLoc ?? null,
    p_dest_loc: destLoc ?? null,
    p_user: user,
    p_reference: reference ?? null,
  });

  if (error) throw new Error(error.message);
  // rpc ที่ return setof/row จะได้ array หรือ object — รองรับทั้งสอง
  const row = Array.isArray(data) ? data[0] : data;
  return toTransaction(row);
}
