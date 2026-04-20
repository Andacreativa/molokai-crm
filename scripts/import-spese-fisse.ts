// Seed spese fisse Molokai. Idempotente: skippa per `tipo`.
//
// Uso: npx tsx scripts/import-spese-fisse.ts

import "dotenv/config";
import { prisma } from "../lib/prisma";

interface SpesaFissaSeed {
  tipo: string;
  categoria: string;
  cadenza: string;
  dataPagamento: string;
  costo: number;
  ordine: number;
}

const SEED: SpesaFissaSeed[] = [
  {
    tipo: "Affitto",
    categoria: "Affitto",
    cadenza: "mensile",
    dataPagamento: "1° del mese",
    costo: 969,
    ordine: 1,
  },
  {
    tipo: "Digi",
    categoria: "Utenze",
    cadenza: "mensile",
    dataPagamento: "mensile",
    costo: 13,
    ordine: 2,
  },
  {
    tipo: "Ionos Hosting",
    categoria: "Utenze",
    cadenza: "mensile",
    dataPagamento: "mensile",
    costo: 10.89,
    ordine: 3,
  },
];

const round2 = (n: number) => Math.round(n * 100) / 100;
function computeCostoMensile(costo: number, cadenza: string): number {
  const c = cadenza.toLowerCase();
  if (c === "annuale") return round2(costo / 12);
  if (c === "trimestrale") return round2(costo / 3);
  return round2(costo);
}

async function main() {
  console.log(`\n💸  Import ${SEED.length} spese fisse...\n`);
  let created = 0;
  let skipped = 0;
  for (const s of SEED) {
    const existing = await prisma.spesaFissa.findFirst({
      where: { tipo: s.tipo },
    });
    if (existing) {
      console.log(`⏭   ${s.tipo} già presente`);
      skipped++;
      continue;
    }
    await prisma.spesaFissa.create({
      data: {
        ...s,
        costoMensile: computeCostoMensile(s.costo, s.cadenza),
        attiva: true,
      },
    });
    console.log(
      `✓  ${s.tipo} (${s.categoria}, ${s.cadenza}, €${s.costo}/mese)`,
    );
    created++;
  }
  console.log(`\n✅  Fatto. Creati: ${created}, skipped: ${skipped}\n`);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error("❌  Errore:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
