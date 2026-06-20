import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "csv-parse/sync";

const csv = readFileSync(resolve("scripts/products_import.csv"), "utf8");
const rows = parse(csv, { columns: true, skip_empty_lines: true, bom: true, trim: true });

const q = (s) => "'" + String(s ?? "").replace(/'/g, "''") + "'";

const values = rows
  .filter((r) => r["รหัสสินค้า"])
  .map((r) => {
    const id = r["รหัสสินค้า"];
    const name = r["ชื่อสินค้า"] ?? "";
    const barcode = r["บาร์โค้ด"] ?? "";
    const unit = r["หน่วย"] || "ชิ้น";
    const category = r["หมวดหมู่"] ?? "";
    const min = Number(r["ขั้นต่ำ"] ?? 0) || 0;
    return `  (${q(id)}, ${q(name)}, ${q(barcode)}, ${q(unit)}, ${q(category)}, ${min})`;
  });

const sql =
  "insert into public.products (id, name, barcode, unit, category, min_stock) values\n" +
  values.join(",\n") +
  "\non conflict (id) do update set\n" +
  "  name = excluded.name, barcode = excluded.barcode, unit = excluded.unit,\n" +
  "  category = excluded.category, min_stock = excluded.min_stock;\n";

writeFileSync(resolve("scripts/_products.sql"), sql, "utf8");
console.log("rows:", values.length);
