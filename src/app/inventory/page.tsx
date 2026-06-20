"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, PageTitle, Badge } from "@/components/ui";
import { Loading, ErrorBox } from "@/components/states";
import { getInventory, getProducts, getLocations } from "@/lib/db";
import type { InventoryItem, Product, Location } from "@/lib/types";

export default function InventoryPage() {
  const [inv, setInv] = useState<InventoryItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [locs, setLocs] = useState<Location[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [i, p, l] = await Promise.all([getInventory(), getProducts(), getLocations()]);
        setInv(i);
        setProducts(p);
        setLocs(l);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const pMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const lMap = useMemo(() => new Map(locs.map((l) => [l.barcode, l])), [locs]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return inv
      .map((i) => ({ ...i, product: pMap.get(i.productId), loc: lMap.get(i.locationBarcode) }))
      .filter((r) => {
        if (!s) return true;
        return (
          r.product?.name.toLowerCase().includes(s) ||
          r.productId.toLowerCase().includes(s) ||
          r.locationBarcode.toLowerCase().includes(s)
        );
      })
      .sort((a, b) => a.locationBarcode.localeCompare(b.locationBarcode));
  }, [inv, q, pMap, lMap]);

  if (loading) return <Loading />;
  if (err) return <ErrorBox msg={err} />;

  return (
    <div>
      <PageTitle title="สต็อกคงเหลือ" sub={`${rows.length} แถว (สินค้า × ตำแหน่ง)`} />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="ค้นหาสินค้า หรือ ตำแหน่ง…"
        className="w-full mb-4 px-4 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-100"
      />
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">ตำแหน่ง</th>
                <th className="px-4 py-3 font-medium">โซน</th>
                <th className="px-4 py-3 font-medium">สินค้า</th>
                <th className="px-4 py-3 font-medium text-right">จำนวน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-mono text-xs">
                    <Badge tone="slate">{r.locationBarcode}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{r.loc?.zone ?? "-"}</td>
                  <td className="px-4 py-2.5">{r.product?.name ?? r.productId}</td>
                  <td className="px-4 py-2.5 text-right font-semibold">{r.qty}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                    ไม่มีสต็อก
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
