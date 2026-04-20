// Seed gruppi + sessioni Molokai. Idempotente: skippa per nome gruppo.
//
// Uso: npx tsx scripts/import-gruppi.ts

import "dotenv/config";
import { prisma } from "../lib/prisma";

const ANNO = 2026;

interface SessioneSeed {
  data: string; // ISO yyyy-mm-dd
  partecipanti: number;
  prezzoPP: number;
  note?: string;
}

interface GruppoSeed {
  nome: string;
  tipo: string;
  contatto?: string;
  email?: string;
  telefono?: string;
  note?: string;
  sessioni: SessioneSeed[];
}

const SEED: GruppoSeed[] = [
  {
    nome: "Colegio La Salle Barceloneta",
    tipo: "scuola",
    sessioni: [
      { data: "2026-04-07", partecipanti: 14, prezzoPP: 14 },
      { data: "2026-04-14", partecipanti: 12, prezzoPP: 14 },
      { data: "2026-04-21", partecipanti: 10, prezzoPP: 14 },
      { data: "2026-04-28", partecipanti: 12, prezzoPP: 14 },
      { data: "2026-04-30", partecipanti: 11, prezzoPP: 14 },
    ],
  },
];

const round2 = (n: number) => Math.round(n * 100) / 100;

async function main() {
  console.log(`\n👥  Import ${SEED.length} gruppi Molokai ${ANNO}...\n`);
  let createdGroups = 0;
  let skippedGroups = 0;
  let createdSessions = 0;

  for (const g of SEED) {
    const existing = await prisma.gruppo.findFirst({ where: { nome: g.nome } });
    if (existing) {
      console.log(`⏭   ${g.nome} già presente, skip`);
      skippedGroups++;
      continue;
    }
    const gruppo = await prisma.gruppo.create({
      data: {
        nome: g.nome,
        tipo: g.tipo,
        contatto: g.contatto ?? null,
        email: g.email ?? null,
        telefono: g.telefono ?? null,
        note: g.note ?? null,
      },
    });
    createdGroups++;
    console.log(`✓  ${g.nome} (${g.tipo})`);

    for (const s of g.sessioni) {
      const d = new Date(s.data);
      const totale = round2(s.partecipanti * s.prezzoPP);
      await prisma.sessioneGruppo.create({
        data: {
          gruppoId: gruppo.id,
          data: d,
          mese: d.getMonth() + 1,
          anno: d.getFullYear(),
          partecipanti: s.partecipanti,
          prezzoPP: s.prezzoPP,
          totale,
          note: s.note ?? null,
        },
      });
      createdSessions++;
      console.log(
        `    ${s.data}: ${s.partecipanti} partecipanti × €${s.prezzoPP} = €${totale}`,
      );
    }
  }

  console.log(
    `\n✅  Fatto. Gruppi: ${createdGroups} creati, ${skippedGroups} skipped. Sessioni: ${createdSessions}\n`,
  );
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error("❌ ", e);
    await prisma.$disconnect();
    process.exit(1);
  });
