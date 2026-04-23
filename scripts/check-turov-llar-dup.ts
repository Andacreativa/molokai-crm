// Verifica duplicati AltroIngresso "Socio annuale" per Alexandru Turov
// e Llar i Salut contro PagamentoSocio nello stesso mese.
// Elimina da AltroIngresso solo se il Socio esiste e ha PagamentoSocio
// nello stesso mese/anno.
//
// Uso: npx tsx scripts/check-turov-llar-dup.ts

import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  const candidates = await prisma.altroIngresso.findMany({
    where: {
      fonte: "Soci",
      descrizione: { contains: "Socio annuale" },
    },
  });

  if (candidates.length === 0) {
    console.log("Nessun record 'Socio annuale' trovato in AltroIngresso.");
    return;
  }

  console.log(`\nTrovati ${candidates.length} AltroIngresso 'Socio annuale':\n`);

  const soci = await prisma.socio.findMany({
    select: {
      id: true,
      nome: true,
      cognome: true,
      pagamentiMensili: { select: { mese: true, anno: true, importo: true } },
    },
  });

  console.log("Tutti i soci attualmente nel DB:");
  for (const s of soci) {
    console.log(
      `   - ${s.nome} ${s.cognome ?? ""} (id=${s.id}) · pagamenti: ${
        s.pagamentiMensili
          .map((p) => `m${p.mese}/${p.anno}=€${p.importo}`)
          .join(", ") || "(nessuno)"
      }`,
    );
  }
  console.log();

  const toDelete: number[] = [];
  for (const r of candidates) {
    console.log(
      `▸ id=${r.id} · ${r.descrizione} · €${r.importo} · mese ${r.mese}/${r.anno}`,
    );

    // Estrai il nome dopo il separatore "— " o "- "
    const match = r.descrizione?.split(/[—-]\s+/);
    const nameCandidate = match && match.length > 1 ? match[1].trim() : "";
    console.log(`   Cerco socio con nome≈"${nameCandidate}"`);

    const matches = soci.filter((s) => {
      const fullName = `${s.nome} ${s.cognome ?? ""}`.toLowerCase();
      const nc = nameCandidate.toLowerCase();
      if (!nc) return false;
      // fuzzy: ogni parola del nameCandidate contenuta in fullName
      return nc
        .split(/\s+/)
        .every((w) => w.length > 2 && fullName.includes(w));
    });

    if (matches.length === 0) {
      console.log(`   ⚠  Nessun Socio corrispondente → NON elimino`);
      continue;
    }
    for (const s of matches) {
      const pagMese = s.pagamentiMensili.filter(
        (p) => p.mese === r.mese && p.anno === r.anno,
      );
      console.log(
        `   ✓ Match: Socio "${s.nome} ${s.cognome ?? ""}" (id=${s.id})`,
      );
      console.log(
        `     PagamentoSocio anno ${r.anno}: ${s.pagamentiMensili
          .map((p) => `m${p.mese}=€${p.importo}`)
          .join(", ") || "(nessuno)"}`,
      );
      if (pagMese.length > 0) {
        console.log(
          `   ⊘  DUPLICATO: PagamentoSocio esiste per mese ${r.mese} → elimino AltroIngresso id=${r.id}`,
        );
        toDelete.push(r.id);
      } else {
        console.log(
          `   ○  PagamentoSocio NON presente per mese ${r.mese} → NON duplicato, mantengo`,
        );
      }
    }
    console.log();
  }

  if (toDelete.length === 0) {
    console.log("\n✅  Nessun duplicato da eliminare.");
    return;
  }

  await prisma.altroIngresso.deleteMany({ where: { id: { in: toDelete } } });
  console.log(`\n✅  Eliminati ${toDelete.length} duplicati: ${toDelete.join(", ")}`);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error("❌", e);
    await prisma.$disconnect();
    process.exit(1);
  });
