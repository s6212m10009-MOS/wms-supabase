/** @type {import('next').NextConfig} */
// บน GitHub Pages (project site) เว็บอยู่ที่ subpath /<repo>/ จึงต้องตั้ง basePath
// ค่า PAGES_BASE_PATH ถูกกำหนดใน GitHub Actions workflow ตอน build; local จะว่าง (เสิร์ฟที่ root)
const basePath = process.env.PAGES_BASE_PATH || "";

const nextConfig = {
  reactStrictMode: true,
  output: "export",          // สร้าง static HTML ลงโฟลเดอร์ out/ (host ที่ไหนก็ได้)
  images: { unoptimized: true },
  basePath,
  assetPrefix: basePath || undefined,
};

module.exports = nextConfig;
