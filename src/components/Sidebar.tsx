"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/", label: "แดชบอร์ด", icon: "📊" },
  { href: "/scan", label: "สแกน รับ/จ่าย/โอน", icon: "📷" },
  { href: "/inventory", label: "สต็อกคงเหลือ", icon: "📦" },
  { href: "/products", label: "สินค้า", icon: "🏷️" },
  { href: "/transactions", label: "ประวัติธุรกรรม", icon: "🧾" },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside className="w-60 shrink-0 bg-white border-r border-slate-200 hidden md:flex flex-col">
      <div className="px-5 py-5 border-b border-slate-100">
        <div className="text-lg font-bold text-brand-600">WMS</div>
        <div className="text-xs text-slate-400">ระบบจัดการคลังสินค้า</div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {nav.map((n) => {
          const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                active
                  ? "bg-brand-50 text-brand-700 font-semibold"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span>{n.icon}</span>
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 text-[11px] text-slate-400 border-t border-slate-100">
        Next.js + Supabase
      </div>
    </aside>
  );
}
