import "dotenv/config";
import { prisma } from "../lib/prisma";

prisma.altroIngresso
  .deleteMany({
    where: {
      fonte: "Soci",
      descrizione: { contains: "Alexandru Turov" },
    },
  })
  .then((r) => {
    console.log(`✅  Eliminati ${r.count} record (Alexandru Turov)`);
    return prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌", e);
    await prisma.$disconnect();
    process.exit(1);
  });
