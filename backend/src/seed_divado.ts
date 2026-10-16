import prisma from "./prisma.js";
import { seedDivadoBranchAndMenu } from "./services/divadoSeed.service.js";

async function main() {
  console.log("🚀 تشغيل سكريبت استيراد منيو ديفادو لقاعدة البيانات...");
  const result = await seedDivadoBranchAndMenu();
  console.log("🎉 النتيجة:", result.message);
}

main()
  .catch((e) => {
    console.error("❌ خطأ أثناء استيراد منيو ديفادو:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
