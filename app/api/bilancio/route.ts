import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MESI_LOWER = [
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

const round2 = (n: number) => Math.round(n * 100) / 100;

// Estrae (mese 1-12, anno) da una stringa "Gennaio 2026" / "gennaio 2026" / etc.
// Ritorna null se non parseable.
function parseMeseAnnoStringa(
  s: string | null | undefined,
): { mese: number; anno: number } | null {
  if (!s) return null;
  const lower = s.trim().toLowerCase();
  const idx = MESI_LOWER.findIndex((m) => lower.startsWith(m));
  if (idx < 0) return null;
  const annoMatch = s.match(/\d{4}/);
  if (!annoMatch) return null;
  return { mese: idx + 1, anno: parseInt(annoMatch[0]) };
}

interface MeseDetail {
  mese: number;
  entrate: {
    soci: number;
    matricole: number;
    buoni: number;
    fatture: number;
    fareharbor: number;
    stripe: number;
    gyg: number;
    cassa: number;
    gruppi: number;
    altri: number;
    totale: number;
  };
  uscite: {
    spese: number;
    speseFisse: number;
    collaboratori: number;
    totale: number;
  };
  bilancio: number;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const anno = parseInt(
    searchParams.get("anno") || String(new Date().getFullYear()),
  );

  // Mesi attivi per spese fisse: per l'anno corrente fino al mese corrente,
  // per anni passati/futuri tutti i 12.
  const today = new Date();
  const mesiAttiviFisse =
    anno === today.getFullYear() ? today.getMonth() + 1 : 12;

  // ─── Fetch in parallelo ─────────────────────────────────────────────
  const [
    soci,
    buoni,
    fatture,
    fareharbor,
    stripe,
    gyg,
    cassa,
    sessioniGruppi,
    altriIngressi,
    spese,
    speseFisse,
    pagamentiCollab,
  ] = await Promise.all([
    prisma.socio.findMany({
      include: { pagamentiMensili: { where: { anno, pagato: true } } },
    }),
    prisma.buono.findMany({ where: { pagato: true } }),
    prisma.fattura.findMany({ where: { anno, pagato: true } }),
    prisma.prenotazioneFareHarbor.findMany({ where: { anno } }),
    prisma.prenotazioneStripe.findMany({ where: { anno } }),
    prisma.prenotazioneGetYourGuide.findMany({ where: { anno } }),
    prisma.pagamentoInScuola.findMany({ where: { anno } }),
    prisma.sessioneGruppo.findMany({ where: { anno, incassato: true } }),
    prisma.altroIngresso.findMany({ where: { anno, incassato: true } }),
    prisma.spesa.findMany({ where: { anno } }),
    prisma.spesaFissa.findMany({ where: { attiva: true } }),
    prisma.pagamentoCollaboratore.findMany({ where: { anno } }),
  ]);

  // ─── Aggrega per mese ───────────────────────────────────────────────
  const mensili: MeseDetail[] = Array.from({ length: 12 }, (_, i) => ({
    mese: i + 1,
    entrate: {
      soci: 0,
      matricole: 0,
      buoni: 0,
      fatture: 0,
      fareharbor: 0,
      stripe: 0,
      gyg: 0,
      cassa: 0,
      gruppi: 0,
      altri: 0,
      totale: 0,
    },
    uscite: { spese: 0, speseFisse: 0, collaboratori: 0, totale: 0 },
    bilancio: 0,
  }));

  // Soci: pagamenti mensili + matricole pagate (parsate da matricolaMesePagamento)
  for (const s of soci) {
    for (const p of s.pagamentiMensili) {
      const importo = p.importo ?? s.prezzoPiano;
      mensili[p.mese - 1].entrate.soci += importo;
    }
    if (s.matricolaPagata && !s.matricolaGratuita) {
      const parsed = parseMeseAnnoStringa(s.matricolaMesePagamento);
      if (parsed && parsed.anno === anno) {
        mensili[parsed.mese - 1].entrate.matricole += s.matricolaImporto;
      }
    }
  }

  // Buoni: parsa mesePagamento → match anno
  for (const b of buoni) {
    const parsed = parseMeseAnnoStringa(b.mesePagamento);
    if (parsed && parsed.anno === anno) {
      mensili[parsed.mese - 1].entrate.buoni += b.prezzoBuono;
    }
  }

  // Fatture pagate (somma totale lordo nel mese di Fattura.mese)
  for (const f of fatture) {
    if (f.mese >= 1 && f.mese <= 12) {
      mensili[f.mese - 1].entrate.fatture += f.totale;
    }
  }

  // FareHarbor: totale del mese
  for (const r of fareharbor) {
    mensili[r.mese - 1].entrate.fareharbor += r.totale;
  }

  // Stripe: netto
  for (const r of stripe) {
    mensili[r.mese - 1].entrate.stripe += r.netto;
  }

  // GYG: netto
  for (const r of gyg) {
    mensili[r.mese - 1].entrate.gyg += r.netto;
  }

  // Cassa scuola: somma totaleGiorno
  for (const c of cassa) {
    mensili[c.mese - 1].entrate.cassa += c.totaleGiorno;
  }

  // Gruppi
  for (const s of sessioniGruppi) {
    mensili[s.mese - 1].entrate.gruppi += s.totale;
  }

  // Altri ingressi (solo incassati, coerente con Buoni.pagato)
  for (const a of altriIngressi) {
    mensili[a.mese - 1].entrate.altri += a.importo;
  }

  // Spese variabili (include Stipendio/Seguridad creati auto da pagamenti dipendenti)
  for (const sp of spese) {
    mensili[sp.mese - 1].uscite.spese += sp.importo;
  }

  // Spese fisse (totale costoMensile, applicate nei mesi attivi)
  const totaleFisseMese = round2(
    speseFisse.reduce((s, x) => s + x.costoMensile, 0),
  );
  for (let m = 1; m <= mesiAttiviFisse; m++) {
    mensili[m - 1].uscite.speseFisse = totaleFisseMese;
  }

  // Collaboratori: pagamenti
  for (const p of pagamentiCollab) {
    mensili[p.mese - 1].uscite.collaboratori += p.pagato;
  }

  // Calcoli totali per mese + cumulativo
  let cumulativo = 0;
  const cumulativoMensile: number[] = [];
  for (const m of mensili) {
    m.entrate.totale = round2(
      m.entrate.soci +
        m.entrate.matricole +
        m.entrate.buoni +
        m.entrate.fatture +
        m.entrate.fareharbor +
        m.entrate.stripe +
        m.entrate.gyg +
        m.entrate.cassa +
        m.entrate.gruppi +
        m.entrate.altri,
    );
    m.uscite.totale = round2(
      m.uscite.spese + m.uscite.speseFisse + m.uscite.collaboratori,
    );
    m.bilancio = round2(m.entrate.totale - m.uscite.totale);
    cumulativo = round2(cumulativo + m.bilancio);
    cumulativoMensile.push(cumulativo);
  }

  // ─── Totali anno ────────────────────────────────────────────────────
  const totaleEntrate = round2(
    mensili.reduce((s, m) => s + m.entrate.totale, 0),
  );
  const totaleUscite = round2(mensili.reduce((s, m) => s + m.uscite.totale, 0));
  const bilancioAnno = round2(totaleEntrate - totaleUscite);

  // ─── Breakdown per categoria ────────────────────────────────────────
  const breakdownEntrate = {
    Soci: round2(mensili.reduce((s, m) => s + m.entrate.soci, 0)),
    Matricole: round2(mensili.reduce((s, m) => s + m.entrate.matricole, 0)),
    Buoni: round2(mensili.reduce((s, m) => s + m.entrate.buoni, 0)),
    Fatture: round2(mensili.reduce((s, m) => s + m.entrate.fatture, 0)),
    FareHarbor: round2(mensili.reduce((s, m) => s + m.entrate.fareharbor, 0)),
    Stripe: round2(mensili.reduce((s, m) => s + m.entrate.stripe, 0)),
    "Get Your Guide": round2(mensili.reduce((s, m) => s + m.entrate.gyg, 0)),
    Cassa: round2(mensili.reduce((s, m) => s + m.entrate.cassa, 0)),
    Gruppi: round2(mensili.reduce((s, m) => s + m.entrate.gruppi, 0)),
    "Altri Ingressi": round2(mensili.reduce((s, m) => s + m.entrate.altri, 0)),
  };

  // Spese per categoria (somma di Spesa.importo raggruppato)
  const spesePerCategoria: Record<string, number> = {};
  for (const sp of spese) {
    spesePerCategoria[sp.categoria] = round2(
      (spesePerCategoria[sp.categoria] ?? 0) + sp.importo,
    );
  }

  const breakdownUscite = {
    ...spesePerCategoria,
    "Spese Fisse": round2(totaleFisseMese * mesiAttiviFisse),
    Collaboratori: round2(
      mensili.reduce((s, m) => s + m.uscite.collaboratori, 0),
    ),
  };

  return NextResponse.json({
    anno,
    mesiAttiviFisse,
    mensili,
    cumulativoMensile,
    totali: {
      entrate: totaleEntrate,
      uscite: totaleUscite,
      bilancio: bilancioAnno,
    },
    breakdown: { entrate: breakdownEntrate, uscite: breakdownUscite },
  });
}
