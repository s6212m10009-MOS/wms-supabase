"use client";

import { useEffect, useRef, useState } from "react";
import { PageTitle } from "@/components/ui";
import { findProduct, getLocation, moveStock } from "@/lib/db";
import { useAuth } from "@/lib/auth";
import type { Location, Product, TxType } from "@/lib/types";

type Mode = "STOCK_IN" | "STOCK_OUT" | "TRANSFER";

const TABS: { key: Mode; label: string; tone: string }[] = [
  { key: "STOCK_IN", label: "+ รับเข้า", tone: "emerald" },
  { key: "STOCK_OUT", label: "- ตัดออก", tone: "rose" },
  { key: "TRANSFER", label: "ย้ายคลัง", tone: "sky" },
];

const OUT_REASONS = ["ขาย", "เบิกใช้", "เสีย/ชำรุด", "ปรับปรุงสต็อก"];

interface CartItem {
  uid: string;
  product: Product;
  qty: number;
  fromLoc: string;
  toLoc: string;
}

const uid = () => "c_" + Math.random().toString(36).slice(2, 9);

// เสียงตอบรับสั้นๆ (ยิงติด/ไม่ติด)
let audioCtx: AudioContext | null = null;
function beep(ok: boolean) {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = audioCtx || new AC();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = ok ? "sine" : "square";
    o.frequency.value = ok ? 880 : 220;
    o.connect(g);
    g.connect(audioCtx.destination);
    const t = audioCtx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (ok ? 0.12 : 0.2));
    o.start(t);
    o.stop(t + 0.25);
  } catch {
    /* ไม่มีเสียงก็ไม่เป็นไร */
  }
}

export default function ScanPage() {
  const { user: authUser, displayName } = useAuth();
  const actor = authUser?.email ?? displayName;

  const [mode, setMode] = useState<Mode>("STOCK_IN");
  const [fromLoc, setFromLoc] = useState<Location | null>(null);
  const [toLoc, setToLoc] = useState<Location | null>(null);
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");
  const [reason, setReason] = useState(OUT_REASONS[0]);
  const [docNo, setDocNo] = useState("");

  const [prodInput, setProdInput] = useState("");
  const [qty, setQty] = useState(1);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [resolved, setResolved] = useState<{ ok: boolean; text: string } | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; title: string; det?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const prodRef = useRef<HTMLInputElement>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showFlash(ok: boolean, title: string, det?: string) {
    beep(ok);
    if (navigator.vibrate) navigator.vibrate(ok ? 40 : [60, 40, 60]);
    setFlash({ ok, title, det });
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), ok ? 1600 : 2800);
  }

  // เปลี่ยนโหมด → ล้างทุกอย่าง
  function switchMode(m: Mode) {
    setMode(m);
    setFromLoc(null);
    setToLoc(null);
    setFromInput("");
    setToInput("");
    setDocNo("");
    setCart([]);
    setResolved(null);
  }

  const needFrom = mode === "STOCK_OUT" || mode === "TRANSFER";
  const needTo = mode === "STOCK_IN" || mode === "TRANSFER";

  async function setLoc(which: "from" | "to") {
    const code = (which === "from" ? fromInput : toInput).trim();
    if (!code) return;
    try {
      const loc = await getLocation(code);
      if (!loc) {
        showFlash(false, "ไม่พบตำแหน่ง", code);
        return;
      }
      if (which === "from") setFromLoc(loc);
      else setToLoc(loc);
      beep(true);
      // โฟกัสช่องถัดไป
      setTimeout(() => prodRef.current?.focus(), 50);
    } catch (e) {
      showFlash(false, "ผิดพลาด", e instanceof Error ? e.message : "");
    }
  }

  async function scanAdd() {
    const code = prodInput.trim();
    if (!code) return;
    // ต้องตั้ง location ก่อน
    if ((needFrom && !fromLoc) || (needTo && !toLoc)) {
      setResolved({ ok: false, text: "ยังไม่ได้ตั้ง Location" });
      showFlash(false, "ตั้ง Location ก่อน");
      return;
    }
    const q = qty > 0 ? qty : 1;
    try {
      const p = await findProduct(code);
      if (!p) {
        setResolved({ ok: false, text: `ไม่พบสินค้า: ${code}` });
        showFlash(false, "ไม่พบสินค้า", code);
        setProdInput("");
        return;
      }
      const fromId = fromLoc?.barcode ?? "";
      const toId = toLoc?.barcode ?? "";
      setCart((prev) => {
        const ex = prev.find(
          (it) => it.product.id === p.id && it.fromLoc === fromId && it.toLoc === toId,
        );
        if (ex) return prev.map((it) => (it === ex ? { ...it, qty: it.qty + q } : it));
        return [...prev, { uid: uid(), product: p, qty: q, fromLoc: fromId, toLoc: toId }];
      });
      const sign = mode === "STOCK_IN" ? "+" : mode === "STOCK_OUT" ? "-" : "";
      setResolved({ ok: true, text: `${sign}${q} ${p.id} ${p.name} → เพิ่มในรายการ` });
      showFlash(true, "เพิ่มในรายการ", `${p.id} ${p.name}`);
      setProdInput("");
      prodRef.current?.focus();
    } catch (e) {
      showFlash(false, "ผิดพลาด", e instanceof Error ? e.message : "");
    }
  }

  function editQty(u: string, v: number) {
    setCart((prev) => prev.map((it) => (it.uid === u ? { ...it, qty: v > 0 ? v : 1 } : it)));
  }
  function delItem(u: string) {
    setCart((prev) => prev.filter((it) => it.uid !== u));
  }
  function clearCart() {
    if (cart.length && !confirm("ล้างรายการทั้งหมด?")) return;
    setCart([]);
  }

  async function confirmCart() {
    if (!cart.length) return showFlash(false, "ไม่มีรายการ");
    if (mode === "STOCK_OUT" && !docNo.trim())
      return showFlash(false, "ต้องระบุเลขที่ใบเบิก/PO ก่อนยืนยัน");

    setBusy(true);
    const ref = mode === "STOCK_OUT" ? `${reason}: ${docNo.trim()}` : undefined;
    let done = 0;
    try {
      // ทำทีละรายการผ่าน RPC move_stock (atomic ต่อรายการ)
      for (const it of cart) {
        await moveStock({
          type: mode as TxType,
          product: it.product,
          qty: it.qty,
          sourceLoc: mode === "STOCK_IN" ? null : it.fromLoc,
          destLoc: mode === "STOCK_OUT" ? null : it.toLoc,
          user: actor,
          reference: ref,
        });
        done++;
      }
      showFlash(true, "บันทึกสำเร็จ", `${done} รายการ`);
      setCart([]);
      setResolved(null);
    } catch (e) {
      showFlash(
        false,
        `บันทึกได้ ${done}/${cart.length} แล้วหยุด`,
        e instanceof Error ? e.message : "",
      );
      // ลบเฉพาะรายการที่สำเร็จออกจากตะกร้า เหลือที่ยังไม่ผ่าน
      setCart((prev) => prev.slice(done));
    } finally {
      setBusy(false);
    }
  }

  // เปิดหน้า/เปลี่ยนโหมด → โฟกัสช่องแรก
  useEffect(() => {
    setTimeout(() => {
      const firstLoc = document.getElementById(needFrom ? "loc-from" : needTo ? "loc-to" : "");
      (firstLoc as HTMLInputElement | null)?.focus();
    }, 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const totalQ = cart.reduce((a, b) => a + b.qty, 0);

  return (
    <div className="max-w-2xl">
      <PageTitle title="สแกน รับ/จ่าย/โอน" sub="ยิงบาร์โค้ด USB หรือพิมพ์แล้วกด Enter — ยิงรัวเข้ารายการแล้วยืนยันทีเดียว" />

      {/* แจ้งเตือนลอย */}
      {flash && (
        <div
          className={`fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-xl px-5 py-3 text-center font-semibold text-white shadow-xl ${
            flash.ok ? "bg-emerald-600" : "bg-rose-600"
          }`}
        >
          <div>{flash.ok ? "✓ " : "✕ "}{flash.title}</div>
          {flash.det && <div className="text-xs font-normal opacity-90">{flash.det}</div>}
        </div>
      )}

      {/* tabs */}
      <div className="mb-5 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => switchMode(t.key)}
            className={`flex-1 rounded-lg border py-2.5 text-sm font-medium transition ${
              mode === t.key
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        {/* ===== ขั้นที่ 1: ตั้ง Location ครั้งเดียว ===== */}
        {needFrom && (
          <LocField
            id="loc-from"
            no={1}
            label="ตำแหน่งต้นทาง (ตั้งครั้งเดียว)"
            value={fromInput}
            onChange={setFromInput}
            onEnter={() => setLoc("from")}
            resolved={fromLoc ? `${fromLoc.barcode} · ${fromLoc.warehouseId}` : null}
          />
        )}
        {needTo && (
          <LocField
            id="loc-to"
            no={needFrom ? 2 : 1}
            label="ตำแหน่งปลายทาง (ตั้งครั้งเดียว)"
            value={toInput}
            onChange={setToInput}
            onEnter={() => setLoc("to")}
            resolved={toLoc ? `${toLoc.barcode} · ${toLoc.warehouseId}` : null}
          />
        )}

        {/* เหตุผล + เลขใบเบิก (เฉพาะตัดออก) */}
        {mode === "STOCK_OUT" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="เหตุผล">
              <select value={reason} onChange={(e) => setReason(e.target.value)} className="input">
                {OUT_REASONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </Field>
            <Field label="เลขที่ใบเบิก/PO * (บังคับ)">
              <input
                value={docNo}
                onChange={(e) => setDocNo(e.target.value)}
                placeholder="REQ-2026-001"
                className="input"
                style={{ borderColor: docNo.trim() ? undefined : "#f43f5e" }}
              />
            </Field>
          </div>
        )}

        {/* ===== ขั้นที่ 2: ยิงสินค้า ===== */}
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
              {needFrom && needTo ? 3 : 2}
            </span>
            <span className="text-sm font-medium text-slate-700">
              ยิง/พิมพ์ บาร์โค้ดสินค้า แล้วกด Enter — ยิงรัวได้เลย
            </span>
          </div>
          <div className="flex gap-2">
            <input
              ref={prodRef}
              value={prodInput}
              onChange={(e) => setProdInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  scanAdd();
                }
              }}
              placeholder="ยิงบาร์โค้ดสินค้า แล้วกด Enter"
              className="input flex-1 font-mono"
              autoComplete="off"
            />
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(parseInt(e.target.value) || 0)}
              title="จำนวนต่อการยิง"
              className="input w-20 text-center"
            />
          </div>
          {resolved && (
            <div
              className={`mt-2 rounded-lg px-3 py-2 text-sm ${
                resolved.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
              }`}
            >
              {resolved.ok ? "✓ " : "✕ "}{resolved.text}
            </div>
          )}
        </div>

        {/* ===== ขั้นที่ 3: ตะกร้า ===== */}
        {cart.length === 0 ? (
          <div className="text-sm text-slate-400">ยังไม่มีรายการ — ยิงสินค้าเพื่อเพิ่มเข้ารายการ</div>
        ) : (
          <div className="rounded-lg border border-slate-200">
            <div className="border-b border-slate-100 px-4 py-2 text-sm font-semibold">
              รายการรอยืนยัน ({cart.length} สินค้า · รวม {totalQ} หน่วย)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">สินค้า</th>
                    <th className="px-3 py-2">ตำแหน่ง</th>
                    <th className="px-3 py-2 text-right">จำนวน</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((it, i) => (
                    <tr key={it.uid} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                      <td className="px-3 py-2">
                        <span className="font-mono text-xs text-slate-500">{it.product.id}</span>{" "}
                        {it.product.name}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {mode === "STOCK_IN"
                          ? it.toLoc
                          : mode === "STOCK_OUT"
                            ? it.fromLoc
                            : `${it.fromLoc} → ${it.toLoc}`}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min={1}
                          value={it.qty}
                          onChange={(e) => editQty(it.uid, parseInt(e.target.value) || 0)}
                          className="w-16 rounded border border-slate-200 px-2 py-1 text-center"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => delItem(it.uid)}
                          className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-rose-100 hover:text-rose-600"
                        >
                          ลบ
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 p-3">
              <button
                onClick={confirmCart}
                disabled={busy}
                className={`flex-1 rounded-lg py-3 font-semibold text-white disabled:opacity-40 ${
                  mode === "STOCK_IN"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : mode === "STOCK_OUT"
                      ? "bg-rose-600 hover:bg-rose-700"
                      : "bg-sky-600 hover:bg-sky-700"
                }`}
              >
                {busy ? "กำลังบันทึก…" : `ยืนยันทั้งหมด (${cart.length} รายการ)`}
              </button>
              <button
                onClick={clearCart}
                disabled={busy}
                className="rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                ล้างรายการ
              </button>
            </div>
          </div>
        )}

        <div className="text-right text-xs text-slate-400">ผู้ทำรายการ: {actor}</div>
      </div>

      <style jsx global>{`
        .input {
          padding: 0.7rem 0.75rem;
          border: 1px solid #cbd5e1;
          border-radius: 0.5rem;
          font-size: 0.9rem;
          outline: none;
          background: #f1f5f9;
          width: 100%;
        }
        .input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px #dbeafe;
        }
      `}</style>
    </div>
  );
}

function LocField({
  id,
  no,
  label,
  value,
  onChange,
  onEnter,
  resolved,
}: {
  id: string;
  no: number;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onEnter: () => void;
  resolved: string | null;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
          {no}
        </span>
        <span className="text-sm font-medium text-slate-700">{label}</span>
      </div>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onEnter();
          }
        }}
        placeholder="ยิง/พิมพ์ Location แล้วกด Enter"
        className="input font-mono"
        autoComplete="off"
      />
      {resolved && (
        <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          ✓ {resolved}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}
