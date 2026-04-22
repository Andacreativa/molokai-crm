// Import spese da estratto conto BBVA. Dedup contro DB per
// (fornitore, importo, mese). Anno fisso = 2026.
//
// Uso: npx tsx scripts/import-bbva.ts

import "dotenv/config";
import { prisma } from "../lib/prisma";

interface NuovaSpesa {
  data: string;
  fornitore: string;
  categoria: string;
  importo: number;
  mese: number;
  note?: string;
}

const ANNO = 2026;

const nuove: NuovaSpesa[] = [
  { data: "2026-04-22", fornitore: "Branka Tres S.L.", categoria: "Scuola", importo: 216.59, mese: 4 },
  { data: "2026-04-20", fornitore: "Agencia Tributaria", categoria: "Tasse", importo: 59.47, mese: 4 },
  { data: "2026-04-20", fornitore: "Agencia Tributaria", categoria: "Tasse", importo: 541.50, mese: 4 },
  { data: "2026-04-20", fornitore: "Octopus Energy", categoria: "Utenze", importo: 10.21, mese: 4 },
  { data: "2026-04-17", fornitore: "Aigues de Barcelona", categoria: "Utenze", importo: 78.36, mese: 4 },
  { data: "2026-04-17", fornitore: "PayPal", categoria: "Scuola", importo: 31.00, mese: 4 },
  { data: "2026-04-14", fornitore: "Maurizio Bogliolo", categoria: "Rimborsi Soci", importo: 86.66, mese: 4 },
  { data: "2026-04-14", fornitore: "Banca BBVA", categoria: "Ritiro Contante", importo: 250.00, mese: 4 },
  { data: "2026-04-13", fornitore: "Maurizio Bogliolo", categoria: "Rimborsi Soci", importo: 60.00, mese: 4 },
  { data: "2026-04-06", fornitore: "Fernandez Pereda CB", categoria: "Affitto", importo: 969.00, mese: 4, note: "Affitto Marzo 2026" },
  { data: "2026-04-06", fornitore: "BBVA Tarjeta", categoria: "Scuola", importo: 4.45, mese: 4 },
  { data: "2026-04-02", fornitore: "Agencia Tributaria", categoria: "Tasse", importo: 22.80, mese: 4 },
  { data: "2026-04-02", fornitore: "Maurizio Bogliolo", categoria: "Rimborsi Soci", importo: 275.00, mese: 4 },
  { data: "2026-04-01", fornitore: "Fernandez Pereda CB", categoria: "Affitto", importo: 969.00, mese: 4, note: "Affitto Aprile 2026" },
  { data: "2026-04-01", fornitore: "PayPal", categoria: "Scuola", importo: 1.44, mese: 4 },
  { data: "2026-03-31", fornitore: "Finn Kalbhenn", categoria: "Rimborsi Soci", importo: 81.60, mese: 3 },
  { data: "2026-03-31", fornitore: "PayPal", categoria: "Scuola", importo: 27.49, mese: 3 },
  { data: "2026-03-31", fornitore: "TGSS Seguridad Social", categoria: "Tasse", importo: 367.51, mese: 3 },
  { data: "2026-03-30", fornitore: "Digi Spain Telecom", categoria: "Utenze", importo: 13.00, mese: 3 },
  { data: "2026-03-26", fornitore: "Maurizio Bogliolo", categoria: "Rimborsi Soci", importo: 258.50, mese: 3 },
  { data: "2026-03-09", fornitore: "Boards More GmbH", categoria: "Materiale Sportivo", importo: 137.56, mese: 3 },
  { data: "2026-03-09", fornitore: "Boards More GmbH", categoria: "Materiale Sportivo", importo: 3000.00, mese: 3 },
  { data: "2026-03-09", fornitore: "Octopus Energy", categoria: "Utenze", importo: 117.65, mese: 3 },
  { data: "2026-03-03", fornitore: "Fernandez Pereda CB", categoria: "Affitto", importo: 969.00, mese: 3, note: "Affitto Maggio 2026 anticipato" },
  { data: "2026-03-02", fornitore: "Maurizio Bogliolo", categoria: "Rimborsi Soci", importo: 45.00, mese: 3 },
  { data: "2026-02-26", fornitore: "Digi Spain Telecom", categoria: "Utenze", importo: 13.00, mese: 2 },
  { data: "2026-02-23", fornitore: "BBVA Allianz Seguros", categoria: "Assicurazione", importo: 397.02, mese: 2 },
  { data: "2026-02-23", fornitore: "BBVA Allianz Seguros", categoria: "Assicurazione", importo: 358.28, mese: 2 },
  { data: "2026-02-18", fornitore: "Occident GCO Seguros", categoria: "Assicurazione", importo: 1155.21, mese: 2 },
  { data: "2026-02-13", fornitore: "Aigues de Barcelona", categoria: "Utenze", importo: 74.93, mese: 2 },
];

const key = (fornitore: string, importo: number, mese: number) =>
  `${fornitore.toLowerCase().trim()}|${importo.toFixed(2)}|${mese}`;

async function main() {
  console.log(`\n💶  Import ${nuove.length} spese da BBVA (anno ${ANNO})...\n`);

  const existing = await prisma.spesa.findMany({
    where: { anno: ANNO },
    select: { fornitore: true, importo: true, mese: true },
  });
  const existingKeys = new Set(
    existing.map((s) => key(s.fornitore, s.importo, s.mese)),
  );

  const toImport: NuovaSpesa[] = [];
  const skipped: NuovaSpesa[] = [];

  for (const n of nuove) {
    if (existingKeys.has(key(n.fornitore, n.importo, n.mese))) {
      skipped.push(n);
    } else {
      toImport.push(n);
    }
  }

  if (skipped.length) {
    console.log(`⏭   ${skipped.length} già presenti, skippate:`);
    for (const s of skipped) {
      console.log(
        `   - ${s.fornitore.padEnd(30)} €${s.importo.toFixed(2).padStart(8)} · mese ${s.mese}`,
      );
    }
    console.log();
  }

  if (toImport.length === 0) {
    console.log("✅  Niente da importare, tutto già presente.\n");
    return;
  }

  const result = await prisma.spesa.createMany({
    data: toImport.map((n) => ({
      data: new Date(n.data),
      fornitore: n.fornitore,
      categoria: n.categoria,
      importo: n.importo,
      mese: n.mese,
      anno: ANNO,
      note: n.note ?? null,
    })),
  });

  console.log(`✅  Importate ${result.count} spese nuove`);
  for (const n of toImport) {
    console.log(
      `   + ${n.data} · ${n.fornitore.padEnd(30)} €${n.importo.toFixed(2).padStart(8)} · ${n.categoria}`,
    );
  }
  console.log();
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error("❌ ", e);
    await prisma.$disconnect();
    process.exit(1);
  });
