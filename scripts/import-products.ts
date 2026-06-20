/**
 * นำเข้าสินค้าจาก scripts/products_import.csv เข้าตาราง products บน Supabase
 *
 * วิธีรัน:
 *   1) ตั้งค่า .env.local: NEXT_PUBLIC_SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY
 *   2) npm run import
 *
 * ใช้ service_role key (ฝั่ง server) เพื่อข้าม RLS ตอน import จำนวนมาก
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "csv-parse/sync";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("❌ ต้องตั้งค่า NEXT_PUBLIC_SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY ใน .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

interface ProductRow {
  id: string;
  name: string;
  barcode: string;
  unit: string;
  category: string;
  min_stock: number;
}

function loadProducts(): ProductRow[] {
  const csv = readFileSync(resolve("scripts/products_import.csv"), "utf8");
  const records: Record<string, string>[] = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    trim: true,
  });
  return records
    .map((r) => {
      const id = r["รหัสสินค้า"];
      if (!id) return null;
      return {
        id,
        name: r["ชื่อสินค้า"] ?? "",
        barcode: r["บาร์โค้ด"] ?? "",
        unit: r["หน่วย"] ?? "ชิ้น",
        category: r["หมวดหมู่"] ?? "",
        min_stock: Number(r["ขั้นต่ำ"] ?? 0) || 0,
      };
    })
    .filter((p): p is ProductRow => p !== null);
}

async function main() {
  console.log("🌱 เริ่มนำเข้าสินค้าเข้า Supabase…");
  const products = loadProducts();
  const chunkSize = 500;
  let done = 0;

  for (let i = 0; i < products.length; i += chunkSize) {
    const chunk = products.slice(i, i + chunkSize);
    const { error } = await supabase.from("products").upsert(chunk, { onConflict: "id" });
    if (error) {
      console.error("❌ upsert ล้มเหลว:", error.message);
      process.exit(1);
    }
    done += chunk.length;
    console.log(`  ✓ นำเข้าแล้ว ${done}/${products.length}`);
  }

  console.log(`✅ เสร็จสิ้น! นำเข้าสินค้า ${products.length} รายการ`);
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ import ล้มเหลว:", e);
  process.exit(1);
});
