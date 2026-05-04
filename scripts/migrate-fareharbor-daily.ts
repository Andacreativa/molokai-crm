// Migrazione PrenotazioneFareHarbor (mese × 4 settimane) → IncassoFareHarbor
// (riga per data). Per ogni record con sett1..sett4, crea fino a 4 righe
// con data = primo giorno della settimana del mese (1, 8, 15, 22) e
// importo = settX. Salta valori 0.
//
// Idempotente: usa upsert per data → rieseguibile senza creare doppioni.
//
// Uso: npx tsx scripts/migrate-fareharbor-daily.ts

import "dotenv/config";
import { prisma } from "../lib/prisma";

const DAYS = [1, 8, 15, 22] as const; // primo giorno di ogni settimana

async function main() {
  const sources = await prisma.prenotazioneFareHarbor.findMany({
    orderBy: [{ anno: "asc" }, { mese: "asc" }],
  });
  console.log(
    `\n🔄  Migro ${sources.length} record PrenotazioneFareHarbor → IncassoFareHarbor\n`,
  );

  let created = 0;
  let updated = 0;
  let zeroSkipped = 0;

  for (const r of sources) {
    const valori = [r.sett1, r.sett2, r.sett3, r.sett4] as const;
    for (let i = 0; i < 4; i++) {
      const importo = valori[i];
      if (importo === 0) {
        zeroSkipped++;
        continue;
      }
      const data = new Date(Date.UTC(r.anno, r.mese - 1, DAYS[i]));
      const existing = await prisma.incassoFareHarbor.findUnique({
        where: { data },
      });
      await prisma.incassoFareHarbor.upsert({
        where: { data },
        create: {
          data,
          mese: r.mese,
          anno: r.anno,
          importo,
          note: `Da migrazione settimana ${i + 1}/${r.mese}/${r.anno}`,
        },
        update: { importo, mese: r.mese, anno: r.anno },
      });
      const dStr = data.toISOString().slice(0, 10);
      if (existing) {
        console.log(`  ↻  ${dStr}  €${importo.toFixed(2)} (aggiornato)`);
        updated++;
      } else {
        console.log(`  +  ${dStr}  €${importo.toFixed(2)}`);
        created++;
      }
    }
  }

  console.log(`\n✅  Migrazione completata`);
  console.log(`   Creati:  ${created}`);
  console.log(`   Aggiornati: ${updated}`);
  console.log(`   Skippati (importo=0): ${zeroSkipped}\n`);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error("❌", e);
    await prisma.$disconnect();
    process.exit(1);
  });
