import { prisma } from "../lib/prisma";

const SCADENZE: [string, string][] = [
  ["F202640", "20/05/2026"],
  ["F202639", "20/05/2026"],
  ["F202638", "20/05/2026"],
  ["F202637", "20/05/2026"],
  ["F202636", "20/05/2026"],
  ["F202635", "20/05/2026"],
  ["F202634", "14/05/2026"],
  ["F202633", "14/05/2026"],
  ["F202632", "02/05/2026"],
  ["F202631", "30/04/2026"],
  ["F202630", "26/04/2026"],
  ["F202629", "25/04/2026"],
  ["F202628", "25/04/2026"],
  ["F202627", "21/04/2026"],
  ["F202626", "21/04/2026"],
  ["F202625", "21/04/2026"],
  ["F202624", "21/04/2026"],
  ["F202623", "21/04/2026"],
  ["F202622", "11/04/2026"],
  ["F202621", "05/04/2026"],
  ["F202620", "28/03/2026"],
  ["F202619", "20/03/2026"],
  ["F202617", "09/03/2026"],
  ["F202616", "08/03/2026"],
  ["F202615", "08/03/2026"],
  ["F202614", "06/03/2026"],
  ["F202611", "28/02/2026"],
  ["F202610", "27/02/2026"],
  ["F20269", "27/02/2026"],
  ["F20268", "27/02/2026"],
  ["F20267", "27/02/2026"],
  ["F20266", "27/02/2026"],
  ["F20264", "15/02/2026"],
  ["F20263", "12/02/2026"],
  ["F20262", "12/02/2026"],
  ["F20261", "12/02/2026"],
  ["F202548", "06/02/2026"],
  ["F202613", "29/04/2026"],
  ["F202612", "29/04/2026"],
  ["F20265", "26/04/2026"],
  ["F202618", "11/05/2026"],
];

const parseDmy = (s: string): Date => {
  const [dd, mm, yyyy] = s.split("/").map(Number);
  return new Date(yyyy, mm - 1, dd);
};

async function main() {
  const updated: string[] = [];
  const notFound: string[] = [];

  for (const [numero, dmy] of SCADENZE) {
    const scadenza = parseDmy(dmy);
    const res = await prisma.fattura.updateMany({
      where: { numero },
      data: { scadenza },
    });
    if (res.count > 0) {
      updated.push(`${numero} → ${dmy} (${res.count})`);
    } else {
      notFound.push(numero);
    }
  }

  console.log(`✓ Aggiornate ${updated.length} fatture:`);
  updated.forEach((u) => console.log("  " + u));
  if (notFound.length > 0) {
    console.log(`\n✗ Non trovate (${notFound.length}):`);
    notFound.forEach((n) => console.log("  " + n));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
