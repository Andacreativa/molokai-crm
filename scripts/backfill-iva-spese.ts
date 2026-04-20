// One-off: ricalcola ivaRecuperabile per tutte le spese che ce l'hanno a 0
// e ivaDeducibile=true (cioè i record creati prima dell'introduzione IVA).
//
// Uso: npx tsx scripts/backfill-iva-spese.ts

import "dotenv/config";
import { prisma } from "../lib/prisma";

const round2 = (n: number) => Math.round(n * 100) / 100;
function compute(importo: number, aliq: number, deducibile: boolean): number {
  if (!deducibile || aliq <= 0) return 0;
  const rate = aliq / 100;
  return round2((importo / (1 + rate)) * rate);
}

async function main() {
  const all = await prisma.spesa.findMany({});
  let updated = 0;
  for (const s of all) {
    if (!s.ivaDeducibile) continue;
    if (s.ivaRecuperabile > 0) continue;
    const v = compute(s.importo, s.aliquotaIva, s.ivaDeducibile);
    if (v <= 0) continue;
    await prisma.spesa.update({
      where: { id: s.id },
      data: { ivaRecuperabile: v },
    });
    console.log(
      `✓  ${s.fornitore} (€${s.importo}) → IVA €${v.toFixed(2)}`,
    );
    updated++;
  }
  console.log(`\n✅  Backfill completato: ${updated}/${all.length} spese aggiornate\n`);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error("❌ ", e);
    await prisma.$disconnect();
    process.exit(1);
  });
