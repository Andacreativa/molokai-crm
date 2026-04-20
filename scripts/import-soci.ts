// Import soci Molokai da Excel "Contabilita__Molokai_2026.xlsx" foglio "Soci".
// I dati sono hardcoded qui (Excel non accessibile: path /mnt/user-data/uploads
// è una sandbox Claude.ai non presente localmente — l'utente ha fornito i dati
// inline nel messaggio).
//
// Uso: npx tsx scripts/import-soci.ts

import "dotenv/config";
import { prisma } from "../lib/prisma";

interface PagamentoSeed {
  mese: number; // 1..12
  importo: number;
}

interface SocioSeed {
  nome: string;
  cognome: string;
  piano: string;
  pianoDescrizione?: string | null;
  prezzoPiano: number;
  pagamento: "MENSILE" | "ANNUALE";
  stato: "ATTIVO" | "SOSPESO" | "CANCELLATO";
  iban: string | null;
  pagamenti2026: PagamentoSeed[];
  matricolaPagata?: boolean;
  matricolaMesePagamento?: string | null;
}

const ANNO = 2026;

// Helper: crea lista pagamenti mensili con importo=prezzoPiano per i mesi specificati
const mensili = (mesi: number[], prezzo: number): PagamentoSeed[] =>
  mesi.map((m) => ({ mese: m, importo: prezzo }));

const SOCI: SocioSeed[] = [
  {
    nome: "Benjamin",
    cognome: "Cavallini",
    piano: "PLAN VARADA",
    prezzoPiano: 60,
    pagamento: "MENSILE",
    stato: "ATTIVO",
    iban: "ES36 3025 0002 4814 3328 3907",
    pagamenti2026: mensili([1, 2, 3, 4], 60),
  },
  {
    nome: "Melanie",
    cognome: "Asmann",
    piano: "PLAN VARADA",
    prezzoPiano: 60,
    pagamento: "MENSILE",
    stato: "ATTIVO",
    iban: "ES72 0182 8606 2902 0006 3159",
    pagamenti2026: mensili([1, 2, 3, 4], 60),
  },
  {
    nome: "Franco",
    cognome: "Kenneth",
    piano: "ALTRO",
    pianoDescrizione: "Nuotatore - materiale ridotto",
    prezzoPiano: 20,
    pagamento: "MENSILE",
    stato: "ATTIVO",
    iban: "ES53 0081 1685 1100 0104 5611",
    pagamenti2026: mensili([1, 2, 3, 4], 20),
  },
  {
    nome: "Alberto",
    cognome: "Parras",
    piano: "PLAN VARADA",
    prezzoPiano: 60,
    pagamento: "MENSILE",
    stato: "ATTIVO",
    iban: "ES61 2100 1925 8701 0021 0158",
    pagamenti2026: mensili([1, 2, 3, 4], 60),
  },
  {
    nome: "Pere",
    cognome: "Torrents",
    piano: "PLAN VARADA",
    prezzoPiano: 60,
    pagamento: "MENSILE",
    stato: "ATTIVO",
    iban: "ES98 0049 0249 8023 1034 4928",
    pagamenti2026: mensili([1, 2, 3, 4], 60),
  },
  {
    nome: "Augusto",
    cognome: "Castroagudin",
    piano: "PLAN MATERIAL",
    prezzoPiano: 55,
    pagamento: "MENSILE",
    stato: "ATTIVO",
    iban: "ES66 0049 2340 4225 1509 8959",
    pagamenti2026: mensili([1, 2, 3, 4], 55),
  },
  {
    nome: "Pepe",
    cognome: "Oltra",
    piano: "PLAN MATERIAL",
    prezzoPiano: 55,
    pagamento: "MENSILE",
    stato: "ATTIVO",
    iban: "ES38 0081 0312 2500 0138 2244",
    pagamenti2026: mensili([1, 2, 3, 4], 55),
  },
  {
    nome: "Victor",
    cognome: "Morilla",
    piano: "PLAN VARADA",
    prezzoPiano: 60,
    pagamento: "MENSILE",
    stato: "ATTIVO",
    iban: "ES47 0182 4609 9002 0854 7665",
    pagamenti2026: mensili([1, 2, 3, 4], 60),
  },
  {
    nome: "David",
    cognome: "Watzstein",
    piano: "PLAN VARADA",
    prezzoPiano: 60,
    pagamento: "MENSILE",
    stato: "ATTIVO",
    iban: "ES64 2100 0501 9402 0032 4142",
    pagamenti2026: mensili([1, 2, 3, 4], 60),
  },
  {
    nome: "Alex",
    cognome: "Turov",
    piano: "PLAN VARADA",
    prezzoPiano: 648,
    pagamento: "ANNUALE",
    stato: "ATTIVO",
    iban: null,
    // Pagato in un'unica rata a Gennaio
    pagamenti2026: [{ mese: 1, importo: 648 }],
  },
  {
    nome: "Santi",
    cognome: "Rodriguez",
    piano: "PLAN VARADA",
    prezzoPiano: 648,
    pagamento: "ANNUALE",
    stato: "ATTIVO",
    iban: null,
    // Matricola pagata a Gennaio 2026 (era la prima colonna TRUE nell'Excel,
    // interpretata erroneamente come pagamento mensile).
    // Quota annuale pagata in unica rata ad Aprile.
    matricolaPagata: true,
    matricolaMesePagamento: "Gennaio 2026",
    pagamenti2026: [{ mese: 4, importo: 648 }],
  },
];

async function main() {
  console.log(`\n🏄  Import ${SOCI.length} soci Molokai...\n`);

  let created = 0;
  let skipped = 0;
  let paymentsCreated = 0;

  for (const s of SOCI) {
    // Skip se già presente (nome+cognome identici)
    const existing = await prisma.socio.findFirst({
      where: { nome: s.nome, cognome: s.cognome },
    });
    if (existing) {
      console.log(
        `⏭   ${s.nome} ${s.cognome} già presente (id=${existing.id}), skip`,
      );
      skipped++;
      continue;
    }

    const socio = await prisma.socio.create({
      data: {
        nome: s.nome,
        cognome: s.cognome,
        piano: s.piano,
        pianoDescrizione: s.pianoDescrizione ?? null,
        prezzoPiano: s.prezzoPiano,
        pagamento: s.pagamento,
        stato: s.stato,
        iban: s.iban,
        matricolaPagata: s.matricolaPagata ?? false,
        matricolaMesePagamento: s.matricolaMesePagamento ?? null,
      },
    });

    for (const p of s.pagamenti2026) {
      await prisma.pagamentoSocio.create({
        data: {
          socioId: socio.id,
          anno: ANNO,
          mese: p.mese,
          pagato: true,
          importo: p.importo,
          data: new Date(ANNO, p.mese - 1, 1),
        },
      });
      paymentsCreated++;
    }

    console.log(
      `✓  ${s.nome} ${s.cognome} (${s.piano}, ${s.pagamento}, €${s.prezzoPiano}) — ${s.pagamenti2026.length} pagamenti`,
    );
    created++;
  }

  console.log(
    `\n✅  Fatto. Creati: ${created}, skipped: ${skipped}, pagamenti: ${paymentsCreated}\n`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error("\n❌  Errore import:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
