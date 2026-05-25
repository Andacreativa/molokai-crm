import "dotenv/config";
import { prisma } from "../lib/prisma";

const PACK_NOMI = [
  "SUP Board Pack - 4 or 8 Sessions",
  "SUP Training Program - 4 Lessons",
  "SURF Training Program - 4 Lessons",
  "CLUB MEMBER - Monthly",
];

async function main() {
  // Imposta "pack" sui 4 nomi specifici, "singolo" su tutti gli altri.
  const all = await prisma.prodotto.findMany({
    select: { id: true, nome: true },
  });
  let pack = 0;
  let singolo = 0;
  for (const p of all) {
    const isPack = PACK_NOMI.some(
      (n) => n.trim().toLowerCase() === p.nome.trim().toLowerCase(),
    );
    const cat = isPack ? "pack" : "singolo";
    await prisma.prodotto.update({
      where: { id: p.id },
      data: { categoria: cat },
    });
    console.log(`${cat === "pack" ? "📦" : "🛒"} ${p.nome} → ${cat}`);
    if (isPack) pack++;
    else singolo++;
  }
  console.log(`\nFatto. Singoli: ${singolo} · Pack: ${pack}`);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
