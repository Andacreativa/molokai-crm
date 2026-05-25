import "dotenv/config";
import { prisma } from "../lib/prisma";

// Assegna ordine = sequenza basata su id ascendente ai prodotti che hanno
// ancora ordine=0 (default post-migration). Salta quelli già ordinati.
async function main() {
  const tutti = await prisma.prodotto.findMany({
    orderBy: { id: "asc" },
    select: { id: true, nome: true, ordine: true },
  });
  // Se almeno uno ha ordine != 0 → assumi che siano già stati ordinati, skip.
  const giaOrdinati = tutti.some((p) => p.ordine !== 0);
  if (giaOrdinati) {
    console.log("Almeno un prodotto ha già ordine != 0 — skip per non sovrascrivere.");
    return;
  }
  let n = 1;
  for (const p of tutti) {
    await prisma.prodotto.update({
      where: { id: p.id },
      data: { ordine: n },
    });
    console.log(`✓ id=${p.id} "${p.nome}" → ordine=${n}`);
    n++;
  }
  console.log(`\nFatto. Ordinati ${tutti.length} prodotti.`);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
