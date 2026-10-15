import { PrismaClient } from '@prisma/client';

async function test(port, user, pass, db) {
  const url = `postgresql://${user}:${pass}@localhost:${port}/${db}?schema=public`;
  console.log(`Testing ${url}...`);
  const prisma = new PrismaClient({
    datasources: { db: { url } }
  });
  try {
    await prisma.$connect();
    console.log(`SUCCESS with ${url}`);
    const tables = await prisma.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public'`;
    console.log("Tables:", tables);
    await prisma.$disconnect();
    return true;
  } catch (err) {
    console.log(`FAILED with ${url}:`, err.message);
    await prisma.$disconnect();
    return false;
  }
}

async function main() {
  await test(5432, "postgres", "postgres", "unifood_db");
  await test(5432, "postgres", "root", "unifood_db");
  await test(5432, "postgres", "123456", "unifood_db");
  await test(5432, "postgres", "admin", "unifood_db");
  await test(5432, "postgres", "123", "unifood_db");
  await test(5432, "postgres", "", "unifood_db");
}

main();
