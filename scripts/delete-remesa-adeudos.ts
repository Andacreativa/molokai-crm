// One-off: elimina le 2 AltroIngresso "Quote mensili ... Remesa adeudos"
// che duplicano i PagamentoSocio già registrati nel Club.
//
// Uso: npx tsx scripts/delete-remesa-adeudos.ts

import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  // Cerca match su descrizione (tollerante a trattino - o em dash — )
  const target = await prisma.altroIngresso.findMany({
    where: {
      fonte: "Soci",
      descrizione: { contains: "Remesa adeudos" },
    },
    select: {
      id: true,
      descrizione: true,
      importo: true,
      mese: true,
      anno: true,
    },
  });

  if (target.length === 0) {
    console.log("Nessun record Remesa adeudos trovato.");
    return;
  }

  console.log(`Trovati ${target.length} record da eliminare:`);
  for (const r of target) {
    console.log(
      `  id=${r.id} · mese ${r.mese}/${r.anno} · €${r.importo.toFixed(2)} · ${r.descrizione}`,
    );
  }

  const result = await prisma.altroIngresso.deleteMany({
    where: {
      fonte: "Soci",
      descrizione: { contains: "Remesa adeudos" },
    },
  });
  console.log(`\n✅  Eliminati ${result.count} record`);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error("❌", e);
    await prisma.$disconnect();
    process.exit(1);
  });
