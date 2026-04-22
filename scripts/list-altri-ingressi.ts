import "dotenv/config";
import { prisma } from "../lib/prisma";

prisma.altroIngresso
  .findMany({
    orderBy: [{ anno: "asc" }, { mese: "asc" }, { id: "asc" }],
  })
  .then((r) => {
    console.log(`Totale (tutti gli anni): ${r.length}`);
    const byAnno = r.reduce(
      (acc: Record<number, number>, x) => {
        acc[x.anno] = (acc[x.anno] ?? 0) + 1;
        return acc;
      },
      {},
    );
    console.log("Per anno:", byAnno, "\n");
    console.log(JSON.stringify(r, null, 2));
    return prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
