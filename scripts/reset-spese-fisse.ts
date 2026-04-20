// Reset distruttivo: elimina TUTTE le spese fisse esistenti e reinserisce
// solo le 3 spese fisse Molokai. Usato per ripulire i residui Anda.
//
// Uso: npx tsx scripts/reset-spese-fisse.ts

import "dotenv/config";
import { prisma } from "../lib/prisma";

const SEED = [
  {
    tipo: "Affitto",
    categoria: "Affitto",
    cadenza: "mensile",
    dataPagamento: "1° del mese",
    costo: 969,
    costoMensile: 969,
    ordine: 1,
    attiva: true,
  },
  {
    tipo: "Digi",
    categoria: "Utenze",
    cadenza: "mensile",
    dataPagamento: "mensile",
    costo: 13,
    costoMensile: 13,
    ordine: 2,
    attiva: true,
  },
  {
    tipo: "Ionos Hosting",
    categoria: "Utenze",
    cadenza: "mensile",
    dataPagamento: "mensile",
    costo: 10.89,
    costoMensile: 10.89,
    ordine: 3,
    attiva: true,
  },
];

async function main() {
  const before = await prisma.spesaFissa.count();
  const del = await prisma.spesaFissa.deleteMany({});
  console.log(`🗑   Eliminati ${del.count} record (era ${before} totali)`);

  for (const s of SEED) {
    await prisma.spesaFissa.create({ data: s });
    console.log(`✓  ${s.tipo} (${s.categoria}, €${s.costo}/mese)`);
  }

  const totaleMensile = SEED.reduce((acc, x) => acc + x.costoMensile, 0);
  console.log(
    `\n✅  Totale mensile: €${totaleMensile.toFixed(2)} → annuo €${(totaleMensile * 12).toFixed(2)}\n`,
  );
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error("❌ ", e);
    await prisma.$disconnect();
    process.exit(1);
  });
