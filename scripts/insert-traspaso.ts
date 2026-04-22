import "dotenv/config";
import { prisma } from "../lib/prisma";

prisma.altroIngresso
  .create({
    data: {
      fonte: "Prestito Soci",
      descrizione: "Traspaso cuenta - Maurizio Bogliolo",
      importo: 2830.0,
      mese: 2,
      anno: 2026,
      incassato: true,
      dataIncasso: new Date("2026-02-04"),
    },
  })
  .then((r) => {
    console.log(`✅  Inserito id=${r.id}`);
    return prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌", e);
    await prisma.$disconnect();
    process.exit(1);
  });
