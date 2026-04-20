// Seed collaboratori Molokai. Idempotente: skippa se nome+cognome esiste.
//
// Uso: npx tsx scripts/import-collaboratori.ts

import "dotenv/config";
import { prisma } from "../lib/prisma";

const round2 = (n: number) => Math.round(n * 100) / 100;

interface SeedSessione {
  data: string; // YYYY-MM-DD
  tipoAttivita: string;
  ore: number;
}

interface SeedAnticipo {
  mese: string;
  importo: number;
  restituito: boolean;
}

interface SeedColl {
  nome: string;
  cognome?: string;
  ruolo: string;
  tariffe: Array<{ tipoAttivita: string; tariffaOraria: number }>;
  sessioni: SeedSessione[];
  // Pagamenti aggregati per mese (somma di sessioni di quel mese)
  pagamenti: Array<{ anno: number; mese: number }>;
  anticipi: SeedAnticipo[];
}

const SEED: SeedColl[] = [
  {
    nome: "Marc",
    ruolo: "Istruttore Surf",
    tariffe: [
      { tipoAttivita: "Classe Gruppo", tariffaOraria: 30 },
      { tipoAttivita: "Classe Singola", tariffaOraria: 15 },
    ],
    sessioni: [
      // Gennaio (data interpretata da Excel serial 46047 = 2026-01-08)
      { data: "2026-01-08", tipoAttivita: "Classe Singola", ore: 1 },
      { data: "2026-01-08", tipoAttivita: "Classe Gruppo", ore: 1 },
      // Febbraio
      { data: "2026-02-07", tipoAttivita: "Classe Singola", ore: 2 },
      { data: "2026-02-14", tipoAttivita: "Classe Singola", ore: 1 },
      { data: "2026-02-22", tipoAttivita: "Classe Singola", ore: 2 },
      // Marzo
      { data: "2026-03-07", tipoAttivita: "Classe Singola", ore: 2 },
      { data: "2026-03-28", tipoAttivita: "Classe Gruppo", ore: 2 },
      // Aprile
      { data: "2026-04-06", tipoAttivita: "Classe Gruppo", ore: 2 },
    ],
    pagamenti: [
      { anno: 2026, mese: 1 },
      { anno: 2026, mese: 2 },
      { anno: 2026, mese: 3 },
      { anno: 2026, mese: 4 },
    ],
    anticipi: [
      { mese: "Febbraio 2026", importo: 45, restituito: true },
      { mese: "Febbraio 2026", importo: 45, restituito: true },
      { mese: "Marzo 2026", importo: 30, restituito: true },
      { mese: "Marzo 2026", importo: 60, restituito: true },
      { mese: "Aprile 2026", importo: 60, restituito: true },
    ],
  },
];

async function main() {
  console.log(`\n💼  Import ${SEED.length} collaboratore(i) Molokai...\n`);
  let createdC = 0;
  let skippedC = 0;
  let createdS = 0;
  let createdP = 0;
  let createdA = 0;

  for (const c of SEED) {
    const existing = await prisma.collaboratore.findFirst({
      where: { nome: c.nome, cognome: c.cognome ?? null },
    });
    if (existing) {
      console.log(`⏭   ${c.nome} ${c.cognome ?? ""} già presente, skip`);
      skippedC++;
      continue;
    }

    // 1. Collaboratore + tariffe
    const collab = await prisma.collaboratore.create({
      data: {
        nome: c.nome,
        cognome: c.cognome ?? null,
        ruolo: c.ruolo,
        attivo: true,
        tariffe: {
          create: c.tariffe.map((t) => ({
            tipoAttivita: t.tipoAttivita,
            tariffaOraria: t.tariffaOraria,
          })),
        },
      },
    });
    createdC++;
    console.log(`✓  ${c.nome} (${c.ruolo}) — ${c.tariffe.length} tariffe`);

    const tariffaMap = new Map(
      c.tariffe.map((t) => [t.tipoAttivita, t.tariffaOraria]),
    );

    // 2. Sessioni
    for (const s of c.sessioni) {
      const d = new Date(s.data);
      const tariffa = tariffaMap.get(s.tipoAttivita) ?? 0;
      const costo = round2(s.ore * tariffa);
      await prisma.sessioneCollaboratore.create({
        data: {
          collaboratoreId: collab.id,
          data: d,
          mese: d.getMonth() + 1,
          anno: d.getFullYear(),
          tipoAttivita: s.tipoAttivita,
          ore: s.ore,
          costo,
        },
      });
      createdS++;
      console.log(
        `    ${s.data}: ${s.tipoAttivita} ${s.ore}h × €${tariffa}/h = €${costo}`,
      );
    }

    // 3. Pagamenti (dovuto = somma sessioni del mese, pagato = stesso valore)
    for (const p of c.pagamenti) {
      const sessioniMese = c.sessioni.filter((s) => {
        const d = new Date(s.data);
        return d.getFullYear() === p.anno && d.getMonth() + 1 === p.mese;
      });
      const dovuto = round2(
        sessioniMese.reduce(
          (acc, x) => acc + (tariffaMap.get(x.tipoAttivita) ?? 0) * x.ore,
          0,
        ),
      );
      await prisma.pagamentoCollaboratore.create({
        data: {
          collaboratoreId: collab.id,
          anno: p.anno,
          mese: p.mese,
          dovuto,
          pagato: dovuto,
          data: new Date(p.anno, p.mese - 1, 28),
        },
      });
      createdP++;
      console.log(
        `    Pagamento ${p.anno}-${p.mese.toString().padStart(2, "0")}: €${dovuto}`,
      );
    }

    // 4. Anticipi
    for (const a of c.anticipi) {
      await prisma.anticipoColl.create({
        data: {
          collaboratoreId: collab.id,
          mese: a.mese,
          importo: a.importo,
          restituito: a.restituito,
        },
      });
      createdA++;
      console.log(
        `    Anticipo ${a.mese}: €${a.importo} ${a.restituito ? "✓" : "○"}`,
      );
    }
  }

  console.log(
    `\n✅  Collaboratori: ${createdC} creati, ${skippedC} skipped. Sessioni: ${createdS}, Pagamenti: ${createdP}, Anticipi: ${createdA}\n`,
  );
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error("❌ ", e);
    await prisma.$disconnect();
    process.exit(1);
  });
