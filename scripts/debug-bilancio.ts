// Debug completo del bilancio 2026. Replica esattamente la logica di
// /api/bilancio/route.ts ma stampa il breakdown dettagliato per categoria
// e mese, così da verificare ogni singolo contributo.
//
// Uso: npx tsx scripts/debug-bilancio.ts [anno]

import "dotenv/config";
import { prisma } from "../lib/prisma";

const ANNO = parseInt(process.argv[2] || "2026");
const round2 = (n: number) => Math.round(n * 100) / 100;

const MESI = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];

function parseMeseAnnoStringa(
  s: string | null | undefined,
): { mese: number; anno: number } | null {
  if (!s) return null;
  const lower = s.trim().toLowerCase();
  const idx = MESI.findIndex((m) => lower.startsWith(m));
  if (idx < 0) return null;
  const annoMatch = s.match(/\d{4}/);
  if (!annoMatch) return null;
  return { mese: idx + 1, anno: parseInt(annoMatch[0]) };
}

function euro(n: number): string {
  return `€${n.toFixed(2).padStart(9)}`;
}

async function main() {
  console.log(`\n${"═".repeat(80)}`);
  console.log(`  DEBUG BILANCIO ${ANNO}`);
  console.log(`${"═".repeat(80)}\n`);

  const today = new Date();
  const mesiAttiviFisse = ANNO === today.getFullYear() ? today.getMonth() + 1 : 12;

  const [
    soci,
    buoni,
    fareharbor,
    stripe,
    gyg,
    cassa,
    sessioniGruppi,
    altriIngressi,
    spese,
    speseFisse,
    pagamentiCollab,
    pagamentiDipendenti,
  ] = await Promise.all([
    prisma.socio.findMany({
      include: { pagamentiMensili: { where: { anno: ANNO, pagato: true } } },
    }),
    prisma.buono.findMany({ where: { pagato: true } }),
    prisma.prenotazioneFareHarbor.findMany({ where: { anno: ANNO } }),
    prisma.prenotazioneStripe.findMany({ where: { anno: ANNO } }),
    prisma.prenotazioneGetYourGuide.findMany({ where: { anno: ANNO } }),
    prisma.pagamentoInScuola.findMany({ where: { anno: ANNO } }),
    prisma.sessioneGruppo.findMany({
      where: { anno: ANNO, incassato: true },
    }),
    prisma.altroIngresso.findMany({ where: { anno: ANNO, incassato: true } }),
    prisma.spesa.findMany({ where: { anno: ANNO } }),
    prisma.spesaFissa.findMany({ where: { attiva: true } }),
    prisma.pagamentoCollaboratore.findMany({ where: { anno: ANNO } }),
    prisma.pagamentoDipendente.findMany({ where: { anno: ANNO } }),
  ]);

  // Init buckets
  const bk = {
    soci: new Array(12).fill(0),
    matricole: new Array(12).fill(0),
    buoni: new Array(12).fill(0),
    cassa: new Array(12).fill(0),
    fh: new Array(12).fill(0),
    stripe: new Array(12).fill(0),
    gyg: new Array(12).fill(0),
    gruppi: new Array(12).fill(0),
    altri: new Array(12).fill(0),
    spese: new Array(12).fill(0),
    speseFisse: new Array(12).fill(0),
    collab: new Array(12).fill(0),
    dipendenti: new Array(12).fill(0),
  };

  // Soci + Matricole
  for (const s of soci) {
    for (const p of s.pagamentiMensili) {
      bk.soci[p.mese - 1] += p.importo ?? s.prezzoPiano;
    }
    if (s.matricolaPagata && !s.matricolaGratuita) {
      const parsed = parseMeseAnnoStringa(s.matricolaMesePagamento);
      if (parsed && parsed.anno === ANNO) {
        bk.matricole[parsed.mese - 1] += s.matricolaImporto;
      }
    }
  }

  // Buoni
  for (const b of buoni) {
    const parsed = parseMeseAnnoStringa(b.mesePagamento);
    if (parsed && parsed.anno === ANNO) bk.buoni[parsed.mese - 1] += b.prezzoBuono;
  }

  // Cassa
  for (const c of cassa) bk.cassa[c.mese - 1] += c.totaleGiorno;

  // FH / Stripe / GYG
  for (const r of fareharbor) bk.fh[r.mese - 1] += r.totale;
  for (const r of stripe) bk.stripe[r.mese - 1] += r.netto;
  for (const r of gyg) bk.gyg[r.mese - 1] += r.netto;

  // Gruppi (solo incassati)
  for (const s of sessioniGruppi) bk.gruppi[s.mese - 1] += s.totale;

  // AltroIngresso (solo incassati)
  for (const a of altriIngressi) bk.altri[a.mese - 1] += a.importo;

  // Spese variabili
  for (const sp of spese) bk.spese[sp.mese - 1] += sp.importo;

  // SpeseFisse: costoMensile totale × mesi attivi
  const totaleFisseMese = round2(
    speseFisse.reduce((s, x) => s + x.costoMensile, 0),
  );
  for (let m = 1; m <= mesiAttiviFisse; m++) {
    bk.speseFisse[m - 1] = totaleFisseMese;
  }

  // Collaboratori
  for (const p of pagamentiCollab) bk.collab[p.mese - 1] += p.pagato;

  // Dipendenti (informativo — contato già nelle Spese come Stipendio/Seguridad)
  for (const p of pagamentiDipendenti) {
    // PagamentoDipendente non ha un campo "importo" diretto; usiamo la Spesa
    // collegata per informazione se presente
    const sp = p.spesaId ? spese.find((x) => x.id === p.spesaId) : null;
    if (sp) bk.dipendenti[p.mese - 1] += sp.importo;
  }

  // ── Stampa per mese ──
  console.log(
    `${"Mese".padEnd(6)}  ${"Soci".padStart(10)} ${"Matricole".padStart(10)} ${"Buoni".padStart(10)} ${"Cassa".padStart(10)} ${"FareH.".padStart(10)} ${"Stripe".padStart(10)} ${"GYG".padStart(10)} ${"Gruppi".padStart(10)} ${"Altri".padStart(10)}  ${"ENTRATE".padStart(11)}`,
  );
  console.log("─".repeat(150));
  let tot = {
    soci: 0,
    matricole: 0,
    buoni: 0,
    cassa: 0,
    fh: 0,
    stripe: 0,
    gyg: 0,
    gruppi: 0,
    altri: 0,
  };
  for (let i = 0; i < 12; i++) {
    const entrate = round2(
      bk.soci[i] +
        bk.matricole[i] +
        bk.buoni[i] +
        bk.cassa[i] +
        bk.fh[i] +
        bk.stripe[i] +
        bk.gyg[i] +
        bk.gruppi[i] +
        bk.altri[i],
    );
    if (entrate === 0) continue;
    console.log(
      `${String(i + 1).padEnd(6)}  ${euro(bk.soci[i])} ${euro(bk.matricole[i])} ${euro(bk.buoni[i])} ${euro(bk.cassa[i])} ${euro(bk.fh[i])} ${euro(bk.stripe[i])} ${euro(bk.gyg[i])} ${euro(bk.gruppi[i])} ${euro(bk.altri[i])}  ${euro(entrate)}`,
    );
    tot.soci += bk.soci[i];
    tot.matricole += bk.matricole[i];
    tot.buoni += bk.buoni[i];
    tot.cassa += bk.cassa[i];
    tot.fh += bk.fh[i];
    tot.stripe += bk.stripe[i];
    tot.gyg += bk.gyg[i];
    tot.gruppi += bk.gruppi[i];
    tot.altri += bk.altri[i];
  }
  console.log("─".repeat(150));
  const totEntrate = round2(
    tot.soci +
      tot.matricole +
      tot.buoni +
      tot.cassa +
      tot.fh +
      tot.stripe +
      tot.gyg +
      tot.gruppi +
      tot.altri,
  );
  console.log(
    `${"TOT".padEnd(6)}  ${euro(tot.soci)} ${euro(tot.matricole)} ${euro(tot.buoni)} ${euro(tot.cassa)} ${euro(tot.fh)} ${euro(tot.stripe)} ${euro(tot.gyg)} ${euro(tot.gruppi)} ${euro(tot.altri)}  ${euro(totEntrate)}`,
  );

  // ── Uscite ──
  console.log("\n");
  console.log(
    `${"Mese".padEnd(6)}  ${"Spese".padStart(12)} ${"SpFisse".padStart(12)} ${"Collab.".padStart(12)} ${"(Dipend.ℹ)".padStart(14)}  ${"USCITE".padStart(12)}`,
  );
  console.log("─".repeat(80));
  const totU = { spese: 0, fisse: 0, collab: 0, dipendenti: 0 };
  for (let i = 0; i < 12; i++) {
    const u = round2(bk.spese[i] + bk.speseFisse[i] + bk.collab[i]);
    if (u === 0) continue;
    console.log(
      `${String(i + 1).padEnd(6)}  ${euro(bk.spese[i])} ${euro(bk.speseFisse[i])} ${euro(bk.collab[i])} ${euro(bk.dipendenti[i])}  ${euro(u)}`,
    );
    totU.spese += bk.spese[i];
    totU.fisse += bk.speseFisse[i];
    totU.collab += bk.collab[i];
    totU.dipendenti += bk.dipendenti[i];
  }
  console.log("─".repeat(80));
  const totUscite = round2(totU.spese + totU.fisse + totU.collab);
  console.log(
    `${"TOT".padEnd(6)}  ${euro(totU.spese)} ${euro(totU.fisse)} ${euro(totU.collab)} ${euro(totU.dipendenti)}  ${euro(totUscite)}`,
  );

  console.log(`\nℹ  Colonna "Dipendenti" è informativa (PagamentoDipendente collegati`);
  console.log(`   a Spesa via spesaId). Gli importi sono già inclusi in "Spese".\n`);

  // ── Totali finali ──
  console.log(`${"═".repeat(80)}`);
  console.log(`  TOTALI ANNO ${ANNO}`);
  console.log(`${"═".repeat(80)}`);
  console.log(`  Entrate totali  : €${totEntrate.toFixed(2)}`);
  console.log(`  Uscite totali   : €${totUscite.toFixed(2)}`);
  console.log(
    `  BILANCIO        : €${round2(totEntrate - totUscite).toFixed(2)}`,
  );
  console.log(`${"═".repeat(80)}`);

  // ── Context: number of rows per collection ──
  console.log(`\nRighe considerate:`);
  console.log(`  PagamentoSocio (pagato=true, ${ANNO}): ${soci.reduce((a, b) => a + b.pagamentiMensili.length, 0)}`);
  console.log(`  Soci con matricolaPagata e !gratuita: ${soci.filter((s) => s.matricolaPagata && !s.matricolaGratuita).length}`);
  console.log(`  Buoni pagati (qualsiasi anno): ${buoni.length}`);
  console.log(`  PagamentoInScuola (${ANNO}): ${cassa.length}`);
  console.log(`  PrenotazioneFareHarbor (${ANNO}): ${fareharbor.length}`);
  console.log(`  PrenotazioneStripe (${ANNO}): ${stripe.length}`);
  console.log(`  PrenotazioneGetYourGuide (${ANNO}): ${gyg.length}`);
  console.log(
    `  SessioneGruppo incassate (${ANNO}): ${sessioniGruppi.length}`,
  );
  console.log(
    `  AltroIngresso incassati (${ANNO}): ${altriIngressi.length}`,
  );
  console.log(`  Spesa (${ANNO}): ${spese.length}`);
  console.log(
    `  SpesaFissa attive: ${speseFisse.length} × ${mesiAttiviFisse} mesi = €${(totaleFisseMese * mesiAttiviFisse).toFixed(2)}`,
  );
  console.log(`  PagamentoCollaboratore (${ANNO}): ${pagamentiCollab.length}`);
  console.log(
    `  PagamentoDipendente (${ANNO}, collegati a Spesa): ${pagamentiDipendenti.filter((p) => p.spesaId).length}/${pagamentiDipendenti.length}`,
  );
  console.log();
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error("❌", e);
    await prisma.$disconnect();
    process.exit(1);
  });
