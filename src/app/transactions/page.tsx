"use client";

import { useEffect, useState } from "react";
import { Card, PageTitle, Badge } from "@/components/ui";
import { Loading, ErrorBox } from "@/components/states";
import { getTransactions } from "@/lib/db";
import type { Transaction } from "@/lib/types";

export default function TransactionsPage() {
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setTxs(await getTransactions(200));
      } catch (e) {
        setErr(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Loading />;
  if (err) return <ErrorBox msg={err} />;

  return (
    <div>
      <PageTitle title="ประวัติธุรกรรม" sub={`${txs.length} รายการล่าสุด`} />
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">เวลา</th>
                <th className="px-4 py-3 font-medium">ประเภท</th>
                <th className="px-4 py-3 font-medium">สินค้า</th>
                <th className="px-4 py-3 font-medium">ต้นทาง → ปลายทาง</th>
                <th className="px-4 py-3 font-medium text-right">จำนวน</th>
                <th className="px-4 py-3 font-medium">ผู้ทำ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {txs.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                    {fmt(t.timestamp)}
                  </td>
                  <td className="px-4 py-2.5">
                    {t.type === "STOCK_IN" && <Badge tone="green">รับเข้า</Badge>}
                    {t.type === "STOCK_OUT" && <Badge tone="red">เบิกออก</Badge>}
                    {t.type === "TRANSFER" && <Badge tone="blue">โอนย้าย</Badge>}
                  </td>
                  <td className="px-4 py-2.5">{t.productName}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">
                    {(t.sourceLoc ?? "—") + " → " + (t.destLoc ?? "—")}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold">{t.qty}</td>
                  <td className="px-4 py-2.5 text-slate-500">{t.user}</td>
                </tr>
              ))}
              {txs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    ยังไม่มีธุรกรรม
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

function fmt(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}
