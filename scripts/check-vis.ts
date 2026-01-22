import { prisma } from '../src/lib/db';

async function main() {
  const league = await prisma.league.findUnique({
    where: { slug: 'cool-cats-and-kittens' },
    select: { id: true, slug: true, visibility: true }
  });
  console.log('Current league visibility:', JSON.stringify(league, null, 2));
  
  // Update to public
  const updated = await prisma.league.update({
    where: { slug: 'cool-cats-and-kittens' },
    data: { visibility: 'public' }
  });
  console.log('Updated visibility:', updated.visibility);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
