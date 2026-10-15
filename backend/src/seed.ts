import prisma from "./prisma.js";
import { seedMockDatabase } from "./services/mockData.service.js";

async function main() {
  console.log("🌱 بدء تشغيل عملية Seed لمنظومة UniFood...");
  const result = await seedMockDatabase();
  console.log(`✅ ${result.message}`);
  console.log("🚀 قاعدة البيانات جاهزة وكاملة بكافة المطاعم والأصناف والبانرات والكوبونات!");
}

main()
  .catch((e) => {
    console.error("❌ فشل تشغيل seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
