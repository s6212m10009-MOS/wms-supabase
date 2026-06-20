// โมเดลข้อมูลฝั่งแอป (camelCase) — แมปกับตาราง Supabase (snake_case) ใน db.ts

export interface Product {
  id: string;          // รหัสสินค้า/SKU (PK)
  name: string;        // ชื่อสินค้า
  barcode: string;     // บาร์โค้ด
  unit: string;        // หน่วย
  category: string;    // หมวดหมู่
  minStock: number;    // สต็อกขั้นต่ำ
}

export interface Warehouse {
  id: string;          // WH-01
  name: string;
}

export interface Location {
  barcode: string;     // LOC-A1-01 (PK)
  warehouseId: string;
  zone: string;
  bay: string;
  level: string;
  capacity: number;
}

// inventory id = `${productId}::${locationBarcode}`
export interface InventoryItem {
  id: string;
  productId: string;
  locationBarcode: string;
  qty: number;
}

export type TxType = "STOCK_IN" | "STOCK_OUT" | "TRANSFER";

export interface Transaction {
  id: string;          // TX-YYYYMMDD-NNNNNN เช่น TX-20260620-000008
  timestamp: string;   // ISO string
  type: TxType;
  productId: string;
  productName: string;
  sourceLoc: string | null;
  destLoc: string | null;
  qty: number;
  user: string;
  reference?: string;
}

export interface AppUser {
  username: string;
  name: string;
  role: "admin" | "staff";
}
