import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // ช่วยให้ดีบักง่ายเมื่อยังไม่ได้ตั้งค่า .env.local
  console.warn(
    "[supabase] ยังไม่ได้ตั้งค่า NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (ดู .env.local.example)",
  );
}

export const supabase = createClient(url ?? "", anonKey ?? "", {
  auth: {
    // เก็บ session ไว้ใน localStorage เพื่อให้ยัง login อยู่หลังรีเฟรช + ต่ออายุ token อัตโนมัติ
    persistSession: true,
    autoRefreshToken: true,
  },
});
