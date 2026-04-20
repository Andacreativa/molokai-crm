// Seed dipendenti Molokai. Idempotente: skippa per nome+cognome.
//
// Uso: npx tsx scripts/import-dipendenti.ts

import "dotenv/config";
import { prisma } from "../lib/prisma";

interface DipSeed {
  nome: string;
  cognome: string;
  ruolo?: string;
  email?: string;
  telefono?: string;
  paese?: string;
}

const SEED: DipSeed[] = [
  {
    nome: "Maurizio",
    cognome: "Bogliolo",
    ruolo: "Proprietario",
    paese: "Spagna",
  },
];

async function main() {
  console.log(`\n👤  Import ${SEED.length} dipendente Molokai...\n`);
  let created = 0;
  let skipped = 0;
  for (const d of SEED) {
    const existing = await prisma.dipendente.findFirst({
      where: { nome: d.nome, cognome: d.cognome },
    });
    if (existing) {
      console.log(`⏭   ${d.nome} ${d.cognome} già presente`);
      skipped++;
      continue;
    }
    await prisma.dipendente.create({
      data: {
        nome: d.nome,
        cognome: d.cognome,
        ruolo: d.ruolo ?? null,
        email: d.email ?? null,
        telefono: d.telefono ?? null,
        paese: d.paese ?? "Spagna",
      },
    });
    console.log(`✓  ${d.nome} ${d.cognome} (${d.ruolo ?? "—"})`);
    created++;
  }
  console.log(`\n✅  Fatto. Creati: ${created}, skipped: ${skipped}\n`);
  console.log(
    `Nota: dati anagrafica completi (DNI/IBAN/indirizzo/buste paga) da aggiungere via UI.\n`,
  );
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error("❌ ", e);
    await prisma.$disconnect();
    process.exit(1);
  });
