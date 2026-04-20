// Seed spese Molokai 2026 dal foglio Excel.
// Idempotente: skippa se esiste già una spesa con stessi fornitore + importo + mese.
//
// Uso: npx tsx scripts/import-spese.ts

import "dotenv/config";
import { prisma } from "../lib/prisma";

const ANNO = 2026;

interface SpesaSeed {
  mese: number;
  fornitore: string;
  categoria: string;
  importo: number;
  descrizione?: string | null;
  note?: string | null;
}

// Data: usato il 1° del mese per ogni voce in mancanza di data esplicita.
const SPESE: SpesaSeed[] = [
  {
    mese: 3,
    fornitore: "Leroy Merlin",
    categoria: "Scuola",
    importo: 258.5,
    descrizione: "Pavimento",
  },
  {
    mese: 3,
    fornitore: "Rimborso actividad",
    categoria: "Rappresentanza",
    importo: 112.0,
  },
  {
    mese: 3,
    fornitore: "Rimborso clase surf",
    categoria: "Rappresentanza",
    importo: 100.0,
  },
  {
    mese: 2,
    fornitore: "Imprentas",
    categoria: "Scuola",
    importo: 4.9,
  },
  {
    mese: 1,
    fornitore: "Ferreteria Pages",
    categoria: "Scuola",
    importo: 32.2,
  },
  {
    mese: 1,
    fornitore: "Amazon",
    categoria: "Scuola",
    importo: 63.96,
  },
  {
    mese: 1,
    fornitore: "Federacion Catalana de Surf",
    categoria: "Scuola",
    importo: 150.0,
    note: "Cuota 2026",
  },
  {
    mese: 1,
    fornitore: "Ikea",
    categoria: "Scuola",
    importo: 94.11,
  },
];

async function main() {
  console.log(`\n🧾  Import ${SPESE.length} spese Molokai ${ANNO}...\n`);
  let created = 0;
  let skipped = 0;

  for (const s of SPESE) {
    const existing = await prisma.spesa.findFirst({
      where: {
        anno: ANNO,
        mese: s.mese,
        fornitore: s.fornitore,
        importo: s.importo,
      },
    });
    if (existing) {
      console.log(
        `⏭   ${s.fornitore} (mese ${s.mese}, €${s.importo}) già presente`,
      );
      skipped++;
      continue;
    }

    await prisma.spesa.create({
      data: {
        data: new Date(ANNO, s.mese - 1, 1),
        mese: s.mese,
        anno: ANNO,
        fornitore: s.fornitore,
        categoria: s.categoria,
        importo: s.importo,
        descrizione: s.descrizione ?? null,
        note: s.note ?? null,
      },
    });
    console.log(
      `✓  ${s.fornitore} (mese ${s.mese}, ${s.categoria}, €${s.importo})`,
    );
    created++;
  }

  console.log(`\n✅  Fatto. Creati: ${created}, skipped: ${skipped}\n`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error("❌  Errore:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
