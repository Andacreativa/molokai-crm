// Seed categorie default Inventario Molokai. Idempotente (upsert su nome).
//
// Uso: npx tsx scripts/seed-inventario-categorie.ts

import "dotenv/config";
import { prisma } from "../lib/prisma";

const CATEGORIE = [
  "SUP Board",
  "Tavole Surf",
  "Mute",
  "Lycra",
  "Remi SUP",
  "Giubbotti",
  "Zaini Tavola",
  "Skateboard",
  "Protezioni",
];

async function main() {
  let i = 0;
  for (const nome of CATEGORIE) {
    await prisma.categoriaInventario.upsert({
      where: { nome },
      create: { nome, ordine: i },
      update: { ordine: i },
    });
    console.log(`✓  ${nome}`);
    i++;
  }
  console.log(`\n✅  ${CATEGORIE.length} categorie pronte\n`);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error("❌", e);
    await prisma.$disconnect();
    process.exit(1);
  });
