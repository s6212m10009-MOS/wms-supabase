"use client";

import { useState, type ReactNode } from "react";
import { AuthProvider, useAuth } from "@/lib/auth";
import Sidebar from "./Sidebar";

/** ครอบทั้งแอป: ยังไม่ login → แสดงหน้า login, login แล้ว → แสดงแอปปกติ */
export default function AuthGate({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <Gate>{children}</Gate>
    </AuthProvider>
  );
}

function Gate({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">
        กำลังโหลด…
      </div>
    );
  }

  if (!session) return <LoginScreen />;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 lg:p-8 max-w-6xl mx-auto w-full">{children}</main>
    </div>
  );
}

function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      // login สำเร็จ → onAuthStateChange จะอัปเดต session เอง
    } catch (e) {
      setErr(e instanceof Error ? e.message : "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-white rounded-xl border border-slate-200 p-7 space-y-5"
      >
        <div className="text-center">
          <div className="text-2xl font-bold text-brand-600">WMS</div>
          <div className="text-xs text-slate-400 mt-1">ระบบจัดการคลังสินค้า</div>
        </div>

        <label className="block">
          <span className="block text-xs font-medium text-slate-500 mb-1">อีเมล</span>
          <input
            type="email"
            autoFocus
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@wms.local"
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
          />
        </label>

        <label className="block">
          <span className="block text-xs font-medium text-slate-500 mb-1">รหัสผ่าน</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
          />
        </label>

        {err && (
          <div className="rounded-lg px-3 py-2 text-sm bg-rose-50 text-rose-700">{err}</div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full py-3 rounded-lg bg-brand-600 text-white font-semibold disabled:opacity-40 hover:bg-brand-700 transition"
        >
          {busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
        </button>
      </form>
    </div>
  );
}
