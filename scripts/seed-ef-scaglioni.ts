import "dotenv/config";
import { prisma } from "../lib/prisma";

const SCAGLIONI = [
  { da: 1, a: 5, prezzo: 35 },
  { da: 6, a: 8, prezzo: 34 },
  { da: 9, a: 17, prezzo: 23 },
  { da: 18, a: 26, prezzo: 21 },
  { da: 27, a: 49, prezzo: 18 },
];

async function main() {
  // Match case-insensitive su "EF Education First" (varianti possibili).
  const candidates = await prisma.gruppo.findMany({
    where: {
      OR: [
        { nome: { contains: "EF Education First", mode: "insensitive" } },
        { nome: { contains: "EF Education", mode: "insensitive" } },
        { nome: { equals: "EF", mode: "insensitive" } },
      ],
    },
  });
  if (candidates.length === 0) {
    console.log("Nessun gruppo 'EF Education First' trovato. Skip.");
    return;
  }
  for (const g of candidates) {
    await prisma.gruppo.update({
      where: { id: g.id },
      data: { prezziScaglioni: SCAGLIONI },
    });
    console.log(`✓ Aggiornato gruppo id=${g.id} "${g.nome}" con ${SCAGLIONI.length} scaglioni`);
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
