// Assegna matricole progressive MOL-2026-001..NNN ai soci esistenti
// in ordine alfabetico per cognome (poi nome).
// Sovrascrive la matricola corrente.
//
// Uso: npx tsx scripts/backfill-matricole-soci.ts

import "dotenv/config";
import { prisma } from "../lib/prisma";

const ANNO = 2026;

async function main() {
  const soci = await prisma.socio.findMany({
    orderBy: [{ cognome: "asc" }, { nome: "asc" }],
    select: { id: true, nome: true, cognome: true, matricola: true },
  });

  console.log(`\nAssegno matricole MOL-${ANNO}-NNN a ${soci.length} soci:\n`);

  for (let i = 0; i < soci.length; i++) {
    const s = soci[i];
    const matricola = `MOL-${ANNO}-${String(i + 1).padStart(3, "0")}`;
    await prisma.socio.update({
      where: { id: s.id },
      data: { matricola },
    });
    console.log(
      `  ${matricola}  ${(s.cognome ?? "").padEnd(20)} ${s.nome}  (id=${s.id}, prima: ${s.matricola ?? "—"})`,
    );
  }

  console.log(`\n✅  Aggiornati ${soci.length} soci\n`);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error("❌", e);
    await prisma.$disconnect();
    process.exit(1);
  });
