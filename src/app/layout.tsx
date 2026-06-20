import type { Metadata } from "next";
import "./globals.css";
import AuthGate from "@/components/AuthGate";

export const metadata: Metadata = {
  title: "WMS — ระบบจัดการคลังสินค้า",
  description: "Warehouse Management System (Next.js + Supabase)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>
        {/* กั้นทั้งแอปด้วย Supabase Auth: ต้อง login ก่อนถึงเข้าใช้งานได้ */}
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
