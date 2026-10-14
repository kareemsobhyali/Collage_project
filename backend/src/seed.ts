import bcrypt from "bcryptjs";
import prisma from "./prisma.js";

async function main() {
  console.log("🌱 Initializing UniFood Production Environment...");

  // إنشاء أو تحديث حساب مدير المنظومة (Super Admin) الرئيسي
  const adminPassword = await bcrypt.hash("123", 10);
  const admin = await prisma.user.upsert({
    where: { phone: "admin" },
    update: {
      name: "مدير المنظومة (Admin)",
      role: "SUPERADMIN",
    },
    create: {

      name: "مدير المنظومة (Admin)",
      phone: "admin",
      password: adminPassword,
      role: "SUPERADMIN",
    },
  });

  console.log(`✅ SuperAdmin account active: ${admin.name} (username: ${admin.phone})`);
  console.log("🚀 Database is clean and ready for real operations!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
