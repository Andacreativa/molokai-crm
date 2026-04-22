import "dotenv/config";
import { prisma } from "../lib/prisma";

prisma.spesa
  .findMany({
    select: {
      data: true,
      fornitore: true,
      importo: true,
      mese: true,
      anno: true,
      categoria: true,
    },
    orderBy: [{ anno: "asc" }, { mese: "asc" }, { fornitore: "asc" }],
  })
  .then((r) => {
    console.log(JSON.stringify(r, null, 2));
    console.log(`\nTotale: ${r.length} spese`);
    return prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
