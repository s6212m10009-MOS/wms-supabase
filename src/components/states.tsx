import { Card } from "./ui";

export function Loading() {
  return <div className="text-slate-400 text-sm py-20 text-center">กำลังโหลด…</div>;
}

export function ErrorBox({ msg }: { msg: string }) {
  return (
    <Card className="p-5 border-rose-200 bg-rose-50 text-rose-700 text-sm">
      เกิดข้อผิดพลาด: {msg}
      <div className="text-xs text-rose-500 mt-2">
        ตรวจสอบว่าตั้งค่า .env.local และรัน migration/seed บน Supabase แล้ว (ดู README)
      </div>
    </Card>
  );
}
