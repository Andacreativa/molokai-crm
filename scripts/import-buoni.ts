// Import buoni Molokai dal foglio Excel "Soci".
// Idempotente: skippa se già presente un buono con stesso nome+cognome+tipo.
//
// Uso: npx tsx scripts/import-buoni.ts

import "dotenv/config";
import { prisma } from "../lib/prisma";

interface BuonoSeed {
  nome: string;
  cognome: string;
  cellulare?: string | null;
  email?: string | null;
  tipoBuono: string;
  prezzoBuono: number;
  pagato: boolean;
  mesePagamento: string;
  stato: string;
  sessioniTotali: number | null;
}

const BUONI: BuonoSeed[] = [
  {
    nome: "Luisa",
    cognome: "Callegari",
    tipoBuono: "BONO CLASE",
    prezzoBuono: 100,
    pagato: true,
    mesePagamento: "Gennaio 2026",
    stato: "Attivo",
    sessioniTotali: 1,
  },
  {
    nome: "Carlos",
    cognome: "Merizalde",
    cellulare: "34637576240",
    email: "cfmr50@hotmail.com",
    tipoBuono: "PACK 8 SUP",
    prezzoBuono: 100,
    pagato: true,
    mesePagamento: "Gennaio 2026",
    stato: "Attivo",
    sessioniTotali: 8,
  },
];

async function main() {
  console.log(`\n🎟   Import ${BUONI.length} buoni...\n`);
  let created = 0;
  let skipped = 0;

  for (const b of BUONI) {
    const existing = await prisma.buono.findFirst({
      where: {
        nome: b.nome,
        cognome: b.cognome,
        tipoBuono: b.tipoBuono,
      },
    });
    if (existing) {
      console.log(`⏭   ${b.nome} ${b.cognome} (${b.tipoBuono}) già presente`);
      skipped++;
      continue;
    }

    await prisma.buono.create({
      data: {
        nome: b.nome,
        cognome: b.cognome,
        cellulare: b.cellulare ?? null,
        email: b.email ?? null,
        tipoBuono: b.tipoBuono,
        prezzoBuono: b.prezzoBuono,
        pagato: b.pagato,
        mesePagamento: b.mesePagamento,
        stato: b.stato,
        sessioniTotali: b.sessioniTotali,
        sessioniUsate: 0,
      },
    });
    console.log(
      `✓  ${b.nome} ${b.cognome} (${b.tipoBuono}, €${b.prezzoBuono}, ${b.mesePagamento})`,
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
