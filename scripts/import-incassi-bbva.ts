// Import incassi 2026 da estratto BBVA. Dedup sulle chiavi naturali:
//   - Stripe/FareHarbor: @@unique(anno, mese)  → upsert
//   - PagamentoInScuola: data unique           → upsert
//   - AltroIngresso: nessun unique → dedup in-memory su
//                    (fonte|descrizione|importo|mese|anno)
//
// Uso: npx tsx scripts/import-incassi-bbva.ts

import "dotenv/config";
import { prisma } from "../lib/prisma";

const ANNO = 2026;
const round2 = (n: number) => Math.round(n * 100) / 100;

async function main() {
  console.log(`\n🌊  Import incassi BBVA ${ANNO}\n`);

  // ── Stripe ──────────────────────────────────────────────────
  const stripeRows = [
    { mese: 3, lordo: 58.38, commissioni: 0, rimborsi: 0, netto: 58.38 },
    { mese: 4, lordo: 55.59, commissioni: 0, rimborsi: 0, netto: 55.59 },
  ];
  let stripeNew = 0;
  for (const r of stripeRows) {
    const existing = await prisma.prenotazioneStripe.findUnique({
      where: { anno_mese: { anno: ANNO, mese: r.mese } },
    });
    await prisma.prenotazioneStripe.upsert({
      where: { anno_mese: { anno: ANNO, mese: r.mese } },
      create: { anno: ANNO, ...r },
      update: r,
    });
    if (existing) {
      console.log(`  ⏭  Stripe mese ${r.mese} già presente (aggiornato)`);
    } else {
      console.log(`  ✓  Stripe mese ${r.mese}: €${r.netto.toFixed(2)} netto`);
      stripeNew++;
    }
  }

  // ── FareHarbor ──────────────────────────────────────────────
  const fhRows = [
    { mese: 1, sett1: 0, sett2: 0, sett3: 60, sett4: 20, totale: 80 },
    { mese: 2, sett1: 0, sett2: 0, sett3: 0, sett4: 0, totale: 0 },
  ];
  let fhNew = 0;
  for (const r of fhRows) {
    const existing = await prisma.prenotazioneFareHarbor.findUnique({
      where: { anno_mese: { anno: ANNO, mese: r.mese } },
    });
    await prisma.prenotazioneFareHarbor.upsert({
      where: { anno_mese: { anno: ANNO, mese: r.mese } },
      create: { anno: ANNO, ...r },
      update: r,
    });
    if (existing) {
      console.log(
        `  ⏭  FareHarbor mese ${r.mese} già presente (aggiornato)`,
      );
    } else {
      console.log(
        `  ✓  FareHarbor mese ${r.mese}: €${r.totale.toFixed(2)} totale`,
      );
      fhNew++;
    }
  }

  // ── PagamentoInScuola ───────────────────────────────────────
  const scuolaRows = [
    { data: "2026-02-04", totaleGiorno: 10, totVendite: 1, rimborsi: 0 },
    { data: "2026-02-23", totaleGiorno: 1, totVendite: 1, rimborsi: 0 },
  ];
  let scuolaNew = 0;
  for (const r of scuolaRows) {
    const d = new Date(r.data);
    const existing = await prisma.pagamentoInScuola.findUnique({
      where: { data: d },
    });
    await prisma.pagamentoInScuola.upsert({
      where: { data: d },
      create: {
        data: d,
        mese: d.getMonth() + 1,
        anno: d.getFullYear(),
        totaleGiorno: r.totaleGiorno,
        totVendite: r.totVendite,
        rimborsi: r.rimborsi,
      },
      update: {
        totaleGiorno: r.totaleGiorno,
        totVendite: r.totVendite,
        rimborsi: r.rimborsi,
      },
    });
    if (existing) {
      console.log(`  ⏭  PagamentoInScuola ${r.data} già presente`);
    } else {
      console.log(
        `  ✓  PagamentoInScuola ${r.data}: €${r.totaleGiorno.toFixed(2)}`,
      );
      scuolaNew++;
    }
  }

  // ── AltriIngressi ───────────────────────────────────────────
  interface AltroSeed {
    data: string;
    fonte: string;
    descrizione: string;
    importo: number;
    mese: number;
  }
  const altri: AltroSeed[] = [
    { data: "2026-03-09", fonte: "Prestito Soci", descrizione: "Bogliolo Maurizio", importo: 1000, mese: 3 },
    { data: "2026-03-09", fonte: "Prestito Soci", descrizione: "Finn Kalbhenn", importo: 1000, mese: 3 },
    { data: "2026-03-09", fonte: "Prestito Soci", descrizione: "Lorenzo Vanghetti", importo: 1000, mese: 3 },
    { data: "2026-02-17", fonte: "Rimborso Assicurazione", descrizione: "Maurizio Bogliolo", importo: 797.5, mese: 2 },
    { data: "2026-02-09", fonte: "Ingresso Socio", descrizione: "Maurizio Bogliolo", importo: 75, mese: 2 },
    { data: "2026-04-07", fonte: "Soci", descrizione: "Socio annuale — Llar i Salut", importo: 648, mese: 4 },
    { data: "2026-03-11", fonte: "Soci", descrizione: "Socio annuale — Alexandru Turov", importo: 648, mese: 3 },
    { data: "2026-04-08", fonte: "Soci", descrizione: "Quote mensili Aprile — Remesa adeudos", importo: 490, mese: 4 },
    { data: "2026-03-09", fonte: "Soci", descrizione: "Quote mensili Marzo — Remesa adeudos", importo: 575, mese: 3 },
  ];

  const existing = await prisma.altroIngresso.findMany({
    where: { anno: ANNO },
    select: { fonte: true, descrizione: true, importo: true, mese: true },
  });
  const key = (
    fonte: string,
    descrizione: string | null,
    importo: number,
    mese: number,
  ) =>
    `${fonte.toLowerCase().trim()}|${(descrizione ?? "").toLowerCase().trim()}|${round2(importo).toFixed(2)}|${mese}`;
  const existingKeys = new Set(
    existing.map((a) => key(a.fonte, a.descrizione, a.importo, a.mese)),
  );

  let altriNew = 0;
  let altriSkip = 0;
  for (const a of altri) {
    if (existingKeys.has(key(a.fonte, a.descrizione, a.importo, a.mese))) {
      console.log(
        `  ⏭  AltroIngresso già presente: ${a.fonte} / ${a.descrizione} / €${a.importo}`,
      );
      altriSkip++;
      continue;
    }
    await prisma.altroIngresso.create({
      data: {
        fonte: a.fonte,
        descrizione: a.descrizione,
        mese: a.mese,
        anno: ANNO,
        importo: a.importo,
        incassato: true,
        dataIncasso: new Date(a.data),
      },
    });
    console.log(
      `  ✓  AltroIngresso: ${a.fonte} / ${a.descrizione} / €${a.importo.toFixed(2)}`,
    );
    altriNew++;
    // Aggiungi al set locale così righe identiche nella stessa esecuzione
    // (se mai arrivassero) non duplicherebbero
    existingKeys.add(key(a.fonte, a.descrizione, a.importo, a.mese));
  }

  console.log(`\n✅  Riepilogo:`);
  console.log(`   Stripe       : ${stripeNew} nuovi, ${stripeRows.length - stripeNew} aggiornati/già presenti`);
  console.log(`   FareHarbor   : ${fhNew} nuovi, ${fhRows.length - fhNew} aggiornati/già presenti`);
  console.log(`   Pag. Scuola  : ${scuolaNew} nuovi, ${scuolaRows.length - scuolaNew} già presenti`);
  console.log(`   Altri Ingr.  : ${altriNew} nuovi, ${altriSkip} skippati`);
  console.log();
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error("❌ ", e);
    await prisma.$disconnect();
    process.exit(1);
  });
