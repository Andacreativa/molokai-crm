// Imposta matricolaPagata=true e matricolaMesePagamento="Gennaio 2026"
// per tutti i soci esistenti. Idempotente.
//
// Uso: npx tsx scripts/update-matricole.ts

import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  const result = await prisma.socio.updateMany({
    where: {},
    data: {
      matricolaPagata: true,
      matricolaMesePagamento: "Gennaio 2026",
    },
  });
  console.log(`✅  Aggiornati ${result.count} soci (matricolaPagata=true, mese="Gennaio 2026")`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error("❌  Errore:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
