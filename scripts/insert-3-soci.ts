import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  const result = await prisma.altroIngresso.createMany({
    data: [
      {
        fonte: "Soci",
        descrizione: "Socio annuale - Llar i Salut",
        importo: 648.0,
        mese: 4,
        anno: 2026,
        incassato: true,
        dataIncasso: new Date("2026-04-07"),
      },
      {
        fonte: "Soci",
        descrizione: "Socio annuale - Alexandru Turov",
        importo: 648.0,
        mese: 3,
        anno: 2026,
        incassato: true,
        dataIncasso: new Date("2026-03-11"),
      },
      {
        fonte: "Soci",
        descrizione: "Quote mensili Marzo - Remesa adeudos",
        importo: 575.0,
        mese: 3,
        anno: 2026,
        incassato: true,
        dataIncasso: new Date("2026-03-09"),
      },
    ],
  });
  console.log(`✅  Inseriti ${result.count} record`);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error("❌", e);
    await prisma.$disconnect();
    process.exit(1);
  });
