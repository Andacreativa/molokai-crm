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

interface MeseAgg {
  mese: number;
  entrate: number;
  uscite: number;
  bilancio: number;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const anno = parseInt(
    searchParams.get("anno") || String(new Date().getFullYear()),
  );

  const today = new Date();
  const meseCorrente = today.getMonth() + 1;
  const isCurrentYear = anno === today.getFullYear();
  const mesiAttiviFisse = isCurrentYear ? meseCorrente : 12;

  // Fetch parallelo
  const [
    soci,
    sociAttiviCount,
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
    ultimiSoci,
    ultimeSpese,
  ] = await Promise.all([
    prisma.socio.findMany({
      include: { pagamentiMensili: { where: { anno, pagato: true } } },
    }),
    prisma.socio.count({ where: { stato: "ATTIVO" } }),
    prisma.buono.findMany({ where: { pagato: true } }),
    prisma.prenotazioneFareHarbor.findMany({ where: { anno } }),
    prisma.prenotazioneStripe.findMany({ where: { anno } }),
    prisma.prenotazioneGetYourGuide.findMany({ where: { anno } }),
    prisma.pagamentoInScuola.findMany({ where: { anno } }),
    prisma.sessioneGruppo.findMany({ where: { anno } }),
    prisma.altroIngresso.findMany({ where: { anno, incassato: true } }),
    prisma.spesa.findMany({ where: { anno } }),
    prisma.spesaFissa.findMany({ where: { attiva: true } }),
    prisma.pagamentoCollaboratore.findMany({ where: { anno } }),
    prisma.socio.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        nome: true,
        cognome: true,
        piano: true,
        prezzoPiano: true,
        stato: true,
        createdAt: true,
      },
    }),
    prisma.spesa.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        data: true,
        fornitore: true,
        categoria: true,
        importo: true,
        createdAt: true,
      },
    }),
  ]);

  // ── Aggregate per mese ──
  const entratePerMese = Array(12).fill(0) as number[];
  const uscitePerMese = Array(12).fill(0) as number[];

  // Soci pagamenti + matricole
  const breakdownEntrate = {
    Soci: 0,
    Buoni: 0,
    FareHarbor: 0,
    Stripe: 0,
    "Get Your Guide": 0,
    Cassa: 0,
    Gruppi: 0,
    "Altri Ingressi": 0,
  };

  for (const s of soci) {
    for (const p of s.pagamentiMensili) {
      const v = p.importo ?? s.prezzoPiano;
      entratePerMese[p.mese - 1] += v;
      breakdownEntrate.Soci += v;
    }
    if (s.matricolaPagata && !s.matricolaGratuita) {
      const parsed = parseMeseAnnoStringa(s.matricolaMesePagamento);
      if (parsed && parsed.anno === anno) {
        entratePerMese[parsed.mese - 1] += s.matricolaImporto;
        breakdownEntrate.Soci += s.matricolaImporto;
      }
    }
  }
  for (const b of buoni) {
    const parsed = parseMeseAnnoStringa(b.mesePagamento);
    if (parsed && parsed.anno === anno) {
      entratePerMese[parsed.mese - 1] += b.prezzoBuono;
      breakdownEntrate.Buoni += b.prezzoBuono;
    }
  }
  for (const r of fareharbor) {
    entratePerMese[r.mese - 1] += r.totale;
    breakdownEntrate.FareHarbor += r.totale;
  }
  for (const r of stripe) {
    entratePerMese[r.mese - 1] += r.netto;
    breakdownEntrate.Stripe += r.netto;
  }
  for (const r of gyg) {
    entratePerMese[r.mese - 1] += r.netto;
    breakdownEntrate["Get Your Guide"] += r.netto;
  }
  for (const c of cassa) {
    entratePerMese[c.mese - 1] += c.totaleGiorno;
    breakdownEntrate.Cassa += c.totaleGiorno;
  }
  for (const s of sessioniGruppi) {
    entratePerMese[s.mese - 1] += s.totale;
    breakdownEntrate.Gruppi += s.totale;
  }
  for (const a of altriIngressi) {
    entratePerMese[a.mese - 1] += a.importo;
    breakdownEntrate["Altri Ingressi"] += a.importo;
  }

  // Uscite
  for (const sp of spese) uscitePerMese[sp.mese - 1] += sp.importo;
  const totaleFisseMese = round2(
    speseFisse.reduce((s, x) => s + x.costoMensile, 0),
  );
  for (let m = 1; m <= mesiAttiviFisse; m++) {
    uscitePerMese[m - 1] += totaleFisseMese;
  }
  for (const p of pagamentiCollab) uscitePerMese[p.mese - 1] += p.pagato;

  const mensili: MeseAgg[] = entratePerMese.map((e, i) => {
    const u = round2(uscitePerMese[i]);
    const er = round2(e);
    return { mese: i + 1, entrate: er, uscite: u, bilancio: round2(er - u) };
  });

  const totEntrate = round2(mensili.reduce((s, m) => s + m.entrate, 0));
  const totUscite = round2(mensili.reduce((s, m) => s + m.uscite, 0));
  const bilancioAnno = round2(totEntrate - totUscite);

  const meseIdx = Math.min(meseCorrente - 1, 11);
  const meseObj = mensili[meseIdx];

  // Round breakdown
  for (const k of Object.keys(breakdownEntrate)) {
    const key = k as keyof typeof breakdownEntrate;
    breakdownEntrate[key] = round2(breakdownEntrate[key]);
  }

  return NextResponse.json({
    anno,
    meseCorrente,
    sociAttivi: sociAttiviCount,
    meseCorrenteData: {
      entrate: meseObj.entrate,
      uscite: meseObj.uscite,
      bilancio: meseObj.bilancio,
    },
    annoData: {
      entrate: totEntrate,
      uscite: totUscite,
      bilancio: bilancioAnno,
    },
    mensili,
    breakdownEntrate,
    ultimiSoci,
    ultimeSpese,
  });
}
