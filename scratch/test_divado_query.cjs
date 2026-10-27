const path = require('path');
const { PrismaClient } = require(path.resolve(__dirname, '../backend/node_modules/@prisma/client'));
const prisma = new PrismaClient();

async function test() {
  const slug = 'divado-campus';
  const branch = await prisma.branch.findFirst({
    where: {
      OR: [
        { slug: slug.toLowerCase() },
        { slug: slug },
        { id: slug },
        { name: { contains: slug, mode: 'insensitive' } }
      ]
    }
  });
  console.log('Search for divado-campus:', branch ? { id: branch.id, name: branch.name, slug: branch.slug } : 'NOT FOUND');

  const divadoByName = await prisma.branch.findFirst({
    where: { name: { contains: 'ديفادو' } }
  });
  console.log('Search for ديفادو:', divadoByName ? { id: divadoByName.id, name: divadoByName.name, slug: divadoByName.slug } : 'NOT FOUND');

  await prisma.$disconnect();
}
test();
