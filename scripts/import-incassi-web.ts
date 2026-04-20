// Seed Incassi Web 2026 dal foglio Excel Molokai.
// Idempotente: upsert per (anno, mese) su ciascun canale.
//
// Uso: npx tsx scripts/import-incassi-web.ts

import "dotenv/config";
import { prisma } from "../lib/prisma";

const ANNO = 2026;
const round2 = (n: number) => Math.round(n * 100) / 100;

// ─── FareHarbor ────────────────────────────────────────────────────────
// totale = sett1+sett2+sett3+sett4 (ricalcolato)
const FH_DATA: Array<{ mese: number; sett1: number; sett2: number; sett3: number; sett4: number }> = [
  { mese: 1, sett1: 0, sett2: 0, sett3: 60, sett4: 20 },
  { mese: 2, sett1: 0, sett2: 0, sett3: 0, sett4: 0 },
  { mese: 3, sett1: 0, sett2: 97.5, sett3: 0, sett4: 55.59 },
  { mese: 4, sett1: 0, sett2: 0, sett3: 0, sett4: 0 },
];

// ─── Stripe ────────────────────────────────────────────────────────────
// netto = lordo - commissioni - rimborsi (commissioni fornite, non derivate)
const STRIPE_DATA: Array<{ mese: number; lordo: number; commissioni: number; rimborsi: number }> = [
  { mese: 1, lordo: 130, commissioni: 2.98, rimborsi: 0 },
  { mese: 2, lordo: 15, commissioni: 0.54, rimborsi: 0 },
  { mese: 3, lordo: 0, commissioni: 0, rimborsi: 0 },
];

// ─── Get Your Guide ────────────────────────────────────────────────────
// commissioni = 25% lordo, netto = 75% lordo (formula standard GYG)
const GYG_DATA: Array<{ mese: number; lordo: number }> = [
  { mese: 1, lordo: 100 },
  { mese: 2, lordo: 150 },
  { mese: 3, lordo: 260 },
  { mese: 4, lordo: 0 },
];

async function main() {
  console.log(`\n🌐  Seed Incassi Web ${ANNO}...\n`);

  // FareHarbor
  console.log("— FareHarbor —");
  for (const r of FH_DATA) {
    const totale = round2(r.sett1 + r.sett2 + r.sett3 + r.sett4);
    await prisma.prenotazioneFareHarbor.upsert({
      where: { anno_mese: { anno: ANNO, mese: r.mese } },
      create: { anno: ANNO, mese: r.mese, ...r, totale },
      update: { ...r, totale },
    });
    console.log(`  Mese ${r.mese}: totale €${totale}`);
  }

  // Stripe
  console.log("\n— Stripe —");
  for (const r of STRIPE_DATA) {
    const netto = round2(r.lordo - r.commissioni - r.rimborsi);
    await prisma.prenotazioneStripe.upsert({
      where: { anno_mese: { anno: ANNO, mese: r.mese } },
      create: { anno: ANNO, mese: r.mese, ...r, netto },
      update: { ...r, netto },
    });
    console.log(
      `  Mese ${r.mese}: lordo €${r.lordo}, commissioni €${r.commissioni}, netto €${netto}`,
    );
  }

  // GYG
  console.log("\n— Get Your Guide —");
  for (const r of GYG_DATA) {
    const commissioni = round2(r.lordo * 0.25);
    const netto = round2(r.lordo - commissioni);
    await prisma.prenotazioneGetYourGuide.upsert({
      where: { anno_mese: { anno: ANNO, mese: r.mese } },
      create: {
        anno: ANNO,
        mese: r.mese,
        lordo: r.lordo,
        commissioni,
        netto,
      },
      update: { lordo: r.lordo, commissioni, netto },
    });
    console.log(
      `  Mese ${r.mese}: lordo €${r.lordo}, commissioni €${commissioni} (25%), netto €${netto}`,
    );
  }

  console.log("\n✅  Fatto.\n");
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
