"use client";

import { useEffect, useState } from "react";
import { Card, PageTitle } from "@/components/ui";
import {
  getProductByBarcode,
  getLocation,
  moveStock,
} from "@/lib/db";
import type { Product, TxType } from "@/lib/types";

type Mode = "STOCK_IN" | "STOCK_OUT" | "TRANSFER";

const TABS: { key: Mode; label: string; color: string }[] = [
  { key: "STOCK_IN", label: "รับเข้า (IN)", color: "emerald" },
  { key: "STOCK_OUT", label: "เบิกออก (OUT)", color: "rose" },
  { key: "TRANSFER", label: "โอนย้าย (TRANSFER)", color: "sky" },
];

export default function ScanPage() {
  const [mode, setMode] = useState<Mode>("STOCK_IN");
  const [productBarcode, setProductBarcode] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [sourceLoc, setSourceLoc] = useState("");
  const [destLoc, setDestLoc] = useState("");
  const [qty, setQty] = useState(1);
  const [reference, setReference] = useState("");
  const [user, setUser] = useState("staff");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // ค้นหาสินค้าเมื่อกรอกบาร์โค้ดครบ (debounce เล็กน้อย)
  useEffect(() => {
    const code = productBarcode.trim();
    if (!code) {
      setProduct(null);
      return;
    }
    const t = setTimeout(async () => {
      const p = await getProductByBarcode(code);
      setProduct(p);
      if (!p) setMsg({ ok: false, text: `ไม่พบสินค้าบาร์โค้ด ${code}` });
      else setMsg(null);
    }, 350);
    return () => clearTimeout(t);
  }, [productBarcode]);

  function reset() {
    setProductBarcode("");
    setProduct(null);
    setSourceLoc("");
    setDestLoc("");
    setQty(1);
    setReference("");
  }

  async function submit() {
    setMsg(null);
    if (!product) return setMsg({ ok: false, text: "กรุณาสแกน/กรอกบาร์โค้ดสินค้า" });
    if (qty <= 0) return setMsg({ ok: false, text: "จำนวนต้องมากกว่า 0" });

    setBusy(true);
    try {
      // ตรวจสอบตำแหน่งมีอยู่จริง
      if (mode !== "STOCK_IN" && sourceLoc) {
        if (!(await getLocation(sourceLoc.trim())))
          throw new Error(`ไม่พบตำแหน่งต้นทาง ${sourceLoc}`);
      }
      if (mode !== "STOCK_OUT" && destLoc) {
        if (!(await getLocation(destLoc.trim())))
          throw new Error(`ไม่พบตำแหน่งปลายทาง ${destLoc}`);
      }

      const tx = await moveStock({
        type: mode as TxType,
        product,
        qty,
        sourceLoc: mode === "STOCK_IN" ? null : sourceLoc.trim(),
        destLoc: mode === "STOCK_OUT" ? null : destLoc.trim(),
        user,
        reference: reference.trim() || undefined,
      });
      setMsg({ ok: true, text: `สำเร็จ! ${tx.id} — ${product.name} จำนวน ${qty}` });
      reset();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "ทำรายการไม่สำเร็จ" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl">
      <PageTitle title="สแกน รับ/จ่าย/โอน" sub="กรอกหรือสแกนบาร์โค้ดเพื่อบันทึกการเคลื่อนไหวสต็อก" />

      {/* tabs */}
      <div className="flex gap-2 mb-5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setMode(t.key);
              setMsg(null);
            }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition ${
              mode === t.key
                ? "bg-brand-600 text-white border-brand-600"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card className="p-5 space-y-4">
        <Field label="บาร์โค้ดสินค้า">
          <input
            autoFocus
            value={productBarcode}
            onChange={(e) => setProductBarcode(e.target.value)}
            placeholder="สแกน / พิมพ์บาร์โค้ด…"
            className="input font-mono"
          />
        </Field>

        {product && (
          <div className="bg-brand-50 text-brand-700 rounded-lg px-3 py-2 text-sm">
            ✓ {product.name} <span className="text-brand-400">({product.id})</span>
          </div>
        )}

        {mode !== "STOCK_IN" && (
          <Field label="ตำแหน่งต้นทาง (Source)">
            <input
              value={sourceLoc}
              onChange={(e) => setSourceLoc(e.target.value)}
              placeholder="เช่น LOC-A1-01"
              className="input font-mono"
            />
          </Field>
        )}

        {mode !== "STOCK_OUT" && (
          <Field label="ตำแหน่งปลายทาง (Destination)">
            <input
              value={destLoc}
              onChange={(e) => setDestLoc(e.target.value)}
              placeholder="เช่น LOC-B1-01"
              className="input font-mono"
            />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label="จำนวน">
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(parseInt(e.target.value) || 0)}
              className="input"
            />
          </Field>
          <Field label="ผู้ทำรายการ">
            <select value={user} onChange={(e) => setUser(e.target.value)} className="input">
              <option value="staff">สมศักดิ์ รักงาน (staff)</option>
              <option value="admin">สมชาย ใจดี (admin)</option>
            </select>
          </Field>
        </div>

        <Field label="อ้างอิง (เลข PO / หมายเหตุ)">
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="ไม่บังคับ"
            className="input"
          />
        </Field>

        {msg && (
          <div
            className={`rounded-lg px-3 py-2 text-sm ${
              msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
            }`}
          >
            {msg.text}
          </div>
        )}

        <button
          onClick={submit}
          disabled={busy || !product}
          className="w-full py-3 rounded-lg bg-brand-600 text-white font-semibold disabled:opacity-40 hover:bg-brand-700 transition"
        >
          {busy ? "กำลังบันทึก…" : "บันทึกรายการ"}
        </button>
      </Card>

      <style jsx global>{`
        .input {
          width: 100%;
          padding: 0.55rem 0.75rem;
          border: 1px solid #cbd5e1;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          outline: none;
        }
        .input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px #dbeafe;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-500 mb-1">{label}</span>
      {children}
    </label>
  );
}
