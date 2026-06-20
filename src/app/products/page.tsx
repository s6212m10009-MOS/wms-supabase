"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, PageTitle } from "@/components/ui";
import { Loading, ErrorBox } from "@/components/states";
import { getProducts, getInventory } from "@/lib/db";
import type { Product, InventoryItem } from "@/lib/types";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [inv, setInv] = useState<InventoryItem[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [p, i] = await Promise.all([getProducts(), getInventory()]);
        setProducts(p);
        setInv(i);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const stockBy = useMemo(() => {
    const m = new Map<string, number>();
    inv.forEach((i) => m.set(i.productId, (m.get(i.productId) ?? 0) + i.qty));
    return m;
  }, [inv]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(s) ||
        p.id.toLowerCase().includes(s) ||
        p.barcode.includes(s),
    );
  }, [products, q]);

  if (loading) return <Loading />;
  if (err) return <ErrorBox msg={err} />;

  return (
    <div>
      <PageTitle title="สินค้า" sub={`ทั้งหมด ${products.length} รายการ`} />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="ค้นหาชื่อ / รหัส / บาร์โค้ด…"
        className="w-full mb-4 px-4 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-100"
      />
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">รหัส</th>
                <th className="px-4 py-3 font-medium">ชื่อสินค้า</th>
                <th className="px-4 py-3 font-medium">บาร์โค้ด</th>
                <th className="px-4 py-3 font-medium">หน่วย</th>
                <th className="px-4 py-3 font-medium text-right">คงเหลือ</th>
                <th className="px-4 py-3 font-medium text-right">ขั้นต่ำ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((p) => {
                const stock = stockBy.get(p.id) ?? 0;
                const low = p.minStock > 0 && stock < p.minStock;
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{p.id}</td>
                    <td className="px-4 py-2.5">{p.name}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{p.barcode}</td>
                    <td className="px-4 py-2.5">{p.unit}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${low ? "text-amber-600" : ""}`}>
                      {stock}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-400">{p.minStock}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    ไม่พบสินค้า
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
