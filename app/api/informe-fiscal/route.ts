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

// Stesso filtro usato in /api/bilancio: solo fonti che entrano davvero
// nel bilancio (Recibo/Bonifico/null). TPV e Contanti sono già coperti
// da PagamentoInScuola / IncassoContanti.
const fonteEntraInBilancio = (f: string | null | undefined) =>
  f == null || f === "Recibo" || f === "Bonifico";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const anno = parseInt(
    searchParams.get("anno") || String(new Date().getFullYear()),
  );
  const trimestre = parseInt(searchParams.get("trimestre") || "1");
  if (![1, 2, 3, 4].includes(trimestre)) {
    return NextResponse.json(
      { error: "Trimestre non valido (attesi 1..4)" },
      { status: 400 },
    );
  }
  const meseStart = (trimestre - 1) * 3 + 1;
  const mesiTrim = [meseStart, meseStart + 1, meseStart + 2];

  // Solo canali richiesti dal commercialista. ESCLUSI: Gruppi (statistici),
  // Altri Ingressi (non fiscali), Buoni (non richiesti).
  const [soci, fatture, fareharbor, stripe, gyg, cassa, contanti] =
    await Promise.all([
      prisma.socio.findMany({
        include: {
          pagamentiMensili: {
            where: { anno, pagato: true, mese: { in: mesiTrim } },
          },
        },
      }),
      // Solo fatture vere e proprie: proforma/preventivi esclusi.
      prisma.fattura.findMany({
        where: {
          anno,
          pagato: true,
          tipo: "fattura",
          mese: { in: mesiTrim },
        },
      }),
      prisma.incassoFareHarbor.findMany({
        where: { anno, mese: { in: mesiTrim } },
      }),
      prisma.prenotazioneStripe.findMany({
        where: { anno, mese: { in: mesiTrim } },
      }),
      prisma.prenotazioneGetYourGuide.findMany({
        where: { anno, mese: { in: mesiTrim } },
      }),
      prisma.pagamentoInScuola.findMany({
        where: { anno, mese: { in: mesiTrim } },
      }),
      prisma.incassoContanti.findMany({
        where: { anno, mese: { in: mesiTrim } },
      }),
    ]);

  const porMese: Record<number, number> = {
    [mesiTrim[0]]: 0,
    [mesiTrim[1]]: 0,
    [mesiTrim[2]]: 0,
  };

  // ─── Detalle diario per canale ──────────────────────────────────────
  // Alcuni canali (Stripe, GYG, matricole soci, pagamentiSocio senza data)
  // sono aggregati mensili: emettiamo una riga sul primo del mese come
  // placeholder — il commercialista vede comunque il movimento nel periodo.
  interface DetalleRow {
    fecha: string; // YYYY-MM-DD
    canal: string;
    base: number | null;
    iva: number | null;
    total: number;
  }
  const detalleMap = new Map<string, DetalleRow>();
  const yyyymmdd = (d: Date): string => d.toISOString().slice(0, 10);
  const firstOfMonth = (a: number, m: number): string =>
    `${a}-${String(m).padStart(2, "0")}-01`;
  const addDetalle = (
    fecha: string,
    canal: string,
    total: number,
    base: number | null = null,
    iva: number | null = null,
  ) => {
    if (total === 0 && base == null && iva == null) return;
    const key = `${fecha}|${canal}`;
    const cur = detalleMap.get(key);
    if (cur) {
      cur.total = round2(cur.total + total);
      if (base != null) cur.base = round2((cur.base ?? 0) + base);
      if (iva != null) cur.iva = round2((cur.iva ?? 0) + iva);
    } else {
      detalleMap.set(key, {
        fecha,
        canal,
        base: base != null ? round2(base) : null,
        iva: iva != null ? round2(iva) : null,
        total: round2(total),
      });
    }
  };

  // Facturas emitidas: base + IVA + total (unici a splittare l'IVA)
  let facturasBase = 0;
  let facturasTotal = 0;
  for (const f of fatture) {
    facturasBase += f.baseImponibile;
    facturasTotal += f.totale;
    porMese[f.mese] = (porMese[f.mese] ?? 0) + f.totale;
    const fecha = f.data ? yyyymmdd(f.data) : firstOfMonth(f.anno, f.mese);
    const ivaAmount = round2(f.totale - f.baseImponibile);
    addDetalle(fecha, "Facturas emitidas", f.totale, f.baseImponibile, ivaAmount);
  }
  const facturasIVA = round2(facturasTotal - facturasBase);

  // FareHarbor + Stripe + GYG: aggregati in un unico canale "Ingresos Web"
  // (nessun IVA-split disponibile per questi canali).
  const WEB_LABEL = "Ingresos Web";
  let webTotal = 0;
  for (const r of fareharbor) {
    webTotal += r.netto;
    porMese[r.mese] = (porMese[r.mese] ?? 0) + r.netto;
    // FareHarbor ha data giornaliera
    addDetalle(yyyymmdd(r.data), WEB_LABEL, r.netto);
  }
  for (const r of stripe) {
    webTotal += r.netto;
    porMese[r.mese] = (porMese[r.mese] ?? 0) + r.netto;
    // Stripe è aggregato mensile: riga sul 1° del mese
    addDetalle(firstOfMonth(r.anno, r.mese), WEB_LABEL, r.netto);
  }
  for (const r of gyg) {
    webTotal += r.netto;
    porMese[r.mese] = (porMese[r.mese] ?? 0) + r.netto;
    // GYG è aggregato mensile: riga sul 1° del mese
    addDetalle(firstOfMonth(r.anno, r.mese), WEB_LABEL, r.netto);
  }

  // Ingresos escuela: TPV (PagamentoInScuola.totaleGiorno) + Efectivo (IncassoContanti.importo)
  const ESCUELA_LABEL = "Ingresos escuela (TPV + Efectivo)";
  let escuelaTotal = 0;
  for (const c of cassa) {
    escuelaTotal += c.totaleGiorno;
    porMese[c.mese] = (porMese[c.mese] ?? 0) + c.totaleGiorno;
    addDetalle(yyyymmdd(c.data), ESCUELA_LABEL, c.totaleGiorno);
  }
  for (const c of contanti) {
    escuelaTotal += c.importo;
    porMese[c.mese] = (porMese[c.mese] ?? 0) + c.importo;
    addDetalle(yyyymmdd(c.data), ESCUELA_LABEL, c.importo);
  }

  // Socios/Club: pagamenti mensili + matricole (solo fonti che entrano in bilancio)
  let sociosTotal = 0;
  for (const s of soci) {
    for (const p of s.pagamentiMensili) {
      if (!fonteEntraInBilancio(p.fontePagamento)) continue;
      const importo = p.importo ?? s.prezzoPiano;
      sociosTotal += importo;
      porMese[p.mese] = (porMese[p.mese] ?? 0) + importo;
      const fecha = p.data ? yyyymmdd(p.data) : firstOfMonth(anno, p.mese);
      addDetalle(fecha, "Socios/Club", importo);
    }
    if (
      s.matricolaPagata &&
      !s.matricolaGratuita &&
      fonteEntraInBilancio(s.matricolaFontePagamento)
    ) {
      const parsed = parseMeseAnnoStringa(s.matricolaMesePagamento);
      if (parsed && parsed.anno === anno && mesiTrim.includes(parsed.mese)) {
        sociosTotal += s.matricolaImporto;
        porMese[parsed.mese] =
          (porMese[parsed.mese] ?? 0) + s.matricolaImporto;
        addDetalle(
          firstOfMonth(anno, parsed.mese),
          "Socios/Club",
          s.matricolaImporto,
        );
      }
    }
  }

  // Ordina per fecha ASC, poi per canale ASC
  const detalleDiario = Array.from(detalleMap.values()).sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
    return a.canal.localeCompare(b.canal);
  });

  const canali = [
    {
      canal: "Facturas emitidas",
      base: round2(facturasBase),
      iva: facturasIVA,
      total: round2(facturasTotal),
    },
    { canal: WEB_LABEL, base: null, iva: null, total: round2(webTotal) },
    {
      canal: "Ingresos escuela (TPV + Efectivo)",
      base: null,
      iva: null,
      total: round2(escuelaTotal),
    },
    { canal: "Socios/Club", base: null, iva: null, total: round2(sociosTotal) },
  ];

  const totalGenerale = round2(canali.reduce((s, c) => s + c.total, 0));

  return NextResponse.json({
    anno,
    trimestre,
    mesi: mesiTrim,
    canali,
    porMes: mesiTrim.map((m) => ({ mese: m, total: round2(porMese[m] ?? 0) })),
    detalleDiario,
    totali: {
      base: round2(facturasBase),
      iva: facturasIVA,
      total: totalGenerale,
    },
  });
}
