"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Stat, Card, PageTitle, Badge } from "@/components/ui";
import { Loading, ErrorBox } from "@/components/states";
import { getProducts, getInventory, getTransactions } from "@/lib/db";
import type { Product, InventoryItem, Transaction } from "@/lib/types";

export default function Dashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [inv, setInv] = useState<InventoryItem[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [p, i, t] = await Promise.all([
          getProducts(),
          getInventory(),
          getTransactions(10),
        ]);
        setProducts(p);
        setInv(i);
        setTxs(t);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalQty = inv.reduce((s, i) => s + i.qty, 0);
  const stockByProduct = new Map<string, number>();
  inv.forEach((i) => stockByProduct.set(i.productId, (stockByProduct.get(i.productId) ?? 0) + i.qty));
  const lowStock = products.filter(
    (p) => p.minStock > 0 && (stockByProduct.get(p.id) ?? 0) < p.minStock,
  );

  if (loading) return <Loading />;
  if (err) return <ErrorBox msg={err} />;

  return (
    <div>
      <PageTitle title="แดชบอร์ด" sub="ภาพรวมคลังสินค้า" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="รายการสินค้า" value={products.length} hint="SKU ทั้งหมด" />
        <Stat label="จำนวนสต็อกรวม" value={totalQty.toLocaleString()} hint="ทุกตำแหน่ง" />
        <Stat label="ตำแหน่งที่มีของ" value={inv.length} hint="location ที่ qty > 0" />
        <Stat
          label="สินค้าต่ำกว่าขั้นต่ำ"
          value={lowStock.length}
          tone={lowStock.length ? "warn" : "good"}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-6">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">⚠️ สินค้าต่ำกว่าขั้นต่ำ</h2>
            <Link href="/inventory" className="text-xs text-brand-600">
              ดูสต็อกทั้งหมด →
            </Link>
          </div>
          {lowStock.length === 0 ? (
            <p className="text-sm text-slate-400">ไม่มีสินค้าต่ำกว่าขั้นต่ำ 🎉</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {lowStock.slice(0, 6).map((p) => (
                <li key={p.id} className="py-2 flex items-center justify-between text-sm">
                  <span className="truncate pr-2">{p.name}</span>
                  <Badge tone="amber">
                    {stockByProduct.get(p.id) ?? 0}/{p.minStock}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">🧾 ธุรกรรมล่าสุด</h2>
            <Link href="/transactions" className="text-xs text-brand-600">
              ดูทั้งหมด →
            </Link>
          </div>
          {txs.length === 0 ? (
            <p className="text-sm text-slate-400">ยังไม่มีธุรกรรม</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {txs.map((t) => (
                <li key={t.id} className="py-2 text-sm flex items-center justify-between gap-2">
                  <span className="truncate">{t.productName}</span>
                  <TxBadge type={t.type} qty={t.qty} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function TxBadge({ type, qty }: { type: string; qty: number }) {
  if (type === "STOCK_IN") return <Badge tone="green">+{qty} รับเข้า</Badge>;
  if (type === "STOCK_OUT") return <Badge tone="red">-{qty} เบิกออก</Badge>;
  return <Badge tone="blue">{qty} โอนย้าย</Badge>;
}
