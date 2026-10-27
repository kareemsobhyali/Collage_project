const path = require('path');
const { PrismaClient } = require(path.resolve(__dirname, '../backend/node_modules/@prisma/client'));
const prisma = new PrismaClient();
(async () => {
  const branches = await prisma.branch.findMany({
    select: { id: true, name: true, slug: true, logoUrl: true, address: true }
  });
  console.log(JSON.stringify(branches, null, 2));
  await prisma.$disconnect();
})();
