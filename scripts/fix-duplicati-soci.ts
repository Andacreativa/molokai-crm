// Merge inverso dei 6 soci duplicati creati dall'import Google Form:
// per ogni coppia (originale, duplicato) copia email/cellulare/iban
// dal duplicato (id alto) al socio originale (id basso) solo se il
// campo originale è vuoto, poi elimina il duplicato.
//
// Idempotente: se i duplicati non esistono più, non fa nulla.
//
// Uso: npx tsx scripts/fix-duplicati-soci.ts

import "dotenv/config";
import { prisma } from "../lib/prisma";

interface Pair {
  keepId: number;
  dropId: number;
  label: string;
}

const PAIRS: Pair[] = [
  { keepId: 16, dropId: 30, label: "Melanie Asmann" },
  { keepId: 20, dropId: 31, label: "Augusto Castroagudin" },
  { keepId: 15, dropId: 29, label: "Benjamin Cavallini" },
  { keepId: 22, dropId: 34, label: "Victor Morilla" },
  { keepId: 18, dropId: 33, label: "Alberto Parras" },
  { keepId: 19, dropId: 32, label: "Pere Torrents" },
];

async function main() {
  console.log(`\n🔧  Merge inverso di ${PAIRS.length} coppie di soci duplicati\n`);

  let merged = 0;
  let deleted = 0;
  let skipped = 0;

  for (const p of PAIRS) {
    const [keep, drop] = await Promise.all([
      prisma.socio.findUnique({ where: { id: p.keepId } }),
      prisma.socio.findUnique({ where: { id: p.dropId } }),
    ]);

    if (!keep) {
      console.log(`  ⚠  ${p.label}: socio originale id=${p.keepId} non trovato, skip`);
      skipped++;
      continue;
    }
    if (!drop) {
      console.log(`  ⏭  ${p.label}: duplicato id=${p.dropId} già rimosso, skip`);
      skipped++;
      continue;
    }

    // Aggiorna i campi del socio originale solo se vuoti
    const data: { email?: string; cellulare?: string; iban?: string } = {};
    if (!keep.email && drop.email) data.email = drop.email;
    if (!keep.cellulare && drop.cellulare) data.cellulare = drop.cellulare;
    if (!keep.iban && drop.iban) data.iban = drop.iban;

    if (Object.keys(data).length > 0) {
      await prisma.socio.update({ where: { id: p.keepId }, data });
      console.log(
        `  ✓  ${p.label}: id=${p.keepId} aggiornato con { ${Object.entries(data).map(([k, v]) => `${k}=${(v as string).slice(0, 25)}`).join(", ")} }`,
      );
      merged++;
    } else {
      console.log(
        `  ○  ${p.label}: id=${p.keepId} aveva già tutti i campi, niente da copiare`,
      );
    }

    // Elimina il duplicato
    await prisma.socio.delete({ where: { id: p.dropId } });
    console.log(`     ⊗  Eliminato duplicato id=${p.dropId}`);
    deleted++;
  }

  console.log(
    `\n✅  Riepilogo: ${merged} merge, ${deleted} record eliminati, ${skipped} skippati\n`,
  );

  // Lista finale dei soci
  const all = await prisma.socio.findMany({
    select: {
      id: true,
      nome: true,
      cognome: true,
      email: true,
      matricola: true,
    },
    orderBy: [{ cognome: "asc" }, { nome: "asc" }],
  });
  console.log(`Soci totali ora: ${all.length}\n`);
  for (const s of all) {
    console.log(
      `  id=${String(s.id).padStart(3)}  ${(s.matricola ?? "—").padEnd(13)}  ${(s.nome ?? "").padEnd(12)} ${(s.cognome ?? "").padEnd(15)}  ${s.email ?? "—"}`,
    );
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error("❌", e);
    await prisma.$disconnect();
    process.exit(1);
  });
