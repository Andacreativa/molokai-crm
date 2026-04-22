import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  const [stripe, gyg, fh, scuola] = await Promise.all([
    prisma.prenotazioneStripe.findMany({
      where: { anno: 2026 },
      orderBy: { mese: "asc" },
    }),
    prisma.prenotazioneGetYourGuide.findMany({
      where: { anno: 2026 },
      orderBy: { mese: "asc" },
    }),
    prisma.prenotazioneFareHarbor.findMany({
      where: { anno: 2026 },
      orderBy: { mese: "asc" },
    }),
    prisma.pagamentoInScuola.findMany({
      where: { anno: 2026 },
      orderBy: { data: "asc" },
    }),
  ]);

  console.log("\n=== PrenotazioneStripe (2026) ===");
  console.log(JSON.stringify(stripe, null, 2));
  console.log(`Totale: ${stripe.length} righe`);

  console.log("\n=== PrenotazioneGetYourGuide (2026) ===");
  console.log(JSON.stringify(gyg, null, 2));
  console.log(`Totale: ${gyg.length} righe`);

  console.log("\n=== PrenotazioneFareHarbor (2026) ===");
  console.log(JSON.stringify(fh, null, 2));
  console.log(`Totale: ${fh.length} righe`);

  console.log("\n=== PagamentoInScuola (2026) ===");
  console.log(JSON.stringify(scuola, null, 2));
  console.log(`Totale: ${scuola.length} righe`);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error("❌", e);
    await prisma.$disconnect();
    process.exit(1);
  });
