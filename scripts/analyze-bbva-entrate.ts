// Parsa l'Excel BBVA e somma le entrate (IMPORTE > 0) per mese,
// poi confronta con ciò che c'è nel DB (Soci + Matricole + Buoni +
// FareHarbor + Stripe + GYG + Cassa + Gruppi + AltroIngresso).
//
// Uso: npx tsx scripts/analyze-bbva-entrate.ts [path-xlsx]

import "dotenv/config";
import { readFileSync } from "fs";
import * as XLSX from "xlsx";
import { prisma } from "../lib/prisma";

const path =
  process.argv[2] ||
  "/Users/b16451536/Downloads/BBVA Histórico movimientos (1).xlsx";
const ANNO = 2026;

const round2 = (n: number) => Math.round(n * 100) / 100;

interface BankRow {
  data: string;
  concepto: string;
  beneficiario: string;
  importo: number;
  mese: number;
  anno: number;
}

const pick = (r: Record<string, unknown>, ...keys: string[]) => {
  const norm = Object.fromEntries(
    Object.entries(r).map(([k, v]) => [k.toUpperCase().trim(), v]),
  );
  for (const k of keys) {
    const v = norm[k.toUpperCase().trim()];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return null;
};

const toIso = (v: unknown): string | null => {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (m) {
    const d = m[1].padStart(2, "0");
    const mm = m[2].padStart(2, "0");
    let y = m[3];
    if (y.length === 2) y = `20${y}`;
    return `${y}-${mm}-${d}`;
  }
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
};

const parseImporto = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v;
  let s = String(v).trim().replace(/[€\s]/g, "");
  if (/,\d{1,2}$/.test(s) && s.indexOf(".") < s.lastIndexOf(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
};

async function main() {
  console.log(`\n📂  Parsing: ${path}\n`);
  const buf = readFileSync(path);
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });

  const sheetName =
    wb.SheetNames.find((n) => /^hist[óo]rico$/i.test(n)) || wb.SheetNames[0];
  console.log(`Foglio: "${sheetName}"\n`);
  const ws = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    range: 15,
    raw: false,
    dateNF: "yyyy-mm-dd",
    defval: "",
  });

  const entrate: BankRow[] = [];
  const uscite: BankRow[] = [];
  for (const r of raw) {
    const importo = parseImporto(pick(r, "IMPORTE", "IMPORT"));
    if (importo === null || importo === 0) continue;
    const iso = toIso(pick(r, "F.CONTABLE", "F. CONTABLE", "FECHA"));
    if (!iso) continue;
    const d = new Date(iso);
    const row: BankRow = {
      data: iso,
      concepto: String(pick(r, "CONCEPTO") ?? "").trim(),
      beneficiario: String(
        pick(r, "BENEFICIARIO/ORDENANTE", "BENEFICIARIO") ?? "",
      ).trim(),
      importo,
      mese: d.getMonth() + 1,
      anno: d.getFullYear(),
    };
    if (importo > 0) entrate.push(row);
    else uscite.push(row);
  }

  // ── Entrate per mese (bank) ──
  const bankEntrateByMese: Record<number, number> = {};
  for (const e of entrate) {
    if (e.anno !== ANNO) continue;
    bankEntrateByMese[e.mese] = round2(
      (bankEntrateByMese[e.mese] ?? 0) + e.importo,
    );
  }

  // ── Dettaglio entrate bank per mese (concepto) ──
  console.log(`═══ BANCA - Entrate per mese (${ANNO}) ═══\n`);
  for (let m = 1; m <= 12; m++) {
    const rows = entrate.filter((e) => e.mese === m && e.anno === ANNO);
    if (rows.length === 0) continue;
    console.log(`── Mese ${m} · €${bankEntrateByMese[m].toFixed(2)} ──`);
    for (const r of rows) {
      const label = (r.beneficiario || r.concepto).slice(0, 50);
      console.log(`   ${r.data}  €${r.importo.toFixed(2).padStart(10)}  ${label}`);
    }
    console.log();
  }

  const bankTot = Object.values(bankEntrateByMese).reduce((a, b) => a + b, 0);
  console.log(`Totale entrate BANCA ${ANNO}: €${bankTot.toFixed(2)}`);

  // ── Uscite bank per confronto ──
  const bankUsciteByMese: Record<number, number> = {};
  for (const u of uscite) {
    if (u.anno !== ANNO) continue;
    bankUsciteByMese[u.mese] = round2(
      (bankUsciteByMese[u.mese] ?? 0) + Math.abs(u.importo),
    );
  }
  const bankUsc = Object.values(bankUsciteByMese).reduce((a, b) => a + b, 0);
  console.log(`Totale uscite BANCA ${ANNO}: €${bankUsc.toFixed(2)}`);
  console.log(`Flusso netto BANCA ${ANNO}: €${(bankTot - bankUsc).toFixed(2)}`);

  // ── Confronto diretto dal DB ──
  console.log(`\n═══ CONFRONTO bank vs DB per mese ═══`);
  const [soci, altriIngressi, stripe, gyg, fh, buoni, cassa, sessioniGruppi] =
    await Promise.all([
      prisma.socio.findMany({
        include: { pagamentiMensili: { where: { anno: ANNO, pagato: true } } },
      }),
      prisma.altroIngresso.findMany({ where: { anno: ANNO, incassato: true } }),
      prisma.prenotazioneStripe.findMany({ where: { anno: ANNO } }),
      prisma.prenotazioneGetYourGuide.findMany({ where: { anno: ANNO } }),
      prisma.prenotazioneFareHarbor.findMany({ where: { anno: ANNO } }),
      prisma.buono.findMany({ where: { pagato: true } }),
      prisma.pagamentoInScuola.findMany({ where: { anno: ANNO } }),
      prisma.sessioneGruppo.findMany({
        where: { anno: ANNO, incassato: true },
      }),
    ]);

  // Aggrega CRM per mese
  const crmPerMese: Record<number, number> = {};
  const add = (mese: number, v: number) => {
    crmPerMese[mese] = round2((crmPerMese[mese] ?? 0) + v);
  };

  for (const s of soci) {
    for (const p of s.pagamentiMensili) {
      add(p.mese, p.importo ?? s.prezzoPiano);
    }
    if (s.matricolaPagata && !s.matricolaGratuita) {
      const m = s.matricolaMesePagamento;
      if (m) {
        const idx = [
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
        ].findIndex((x) => m.toLowerCase().startsWith(x));
        if (idx >= 0) add(idx + 1, s.matricolaImporto);
      }
    }
  }
  for (const b of buoni) {
    const m = b.mesePagamento;
    if (m) {
      const idx = [
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
      ].findIndex((x) => m.toLowerCase().startsWith(x));
      if (idx >= 0 && m.includes(String(ANNO))) add(idx + 1, b.prezzoBuono);
    }
  }
  for (const r of stripe) add(r.mese, r.netto);
  for (const r of gyg) add(r.mese, r.netto);
  for (const r of fh) add(r.mese, r.totale);
  for (const c of cassa) add(c.mese, c.totaleGiorno);
  for (const s of sessioniGruppi) add(s.mese, s.totale);
  for (const a of altriIngressi) add(a.mese, a.importo);

  console.log();
  console.log(
    `${"Mese".padEnd(6)} ${"Banca".padStart(11)} ${"CRM".padStart(11)} ${"Diff (Banca-CRM)".padStart(18)}`,
  );
  let totalB = 0,
    totalC = 0;
  for (let m = 1; m <= 12; m++) {
    const b = bankEntrateByMese[m] ?? 0;
    const c = crmPerMese[m] ?? 0;
    if (b === 0 && c === 0) continue;
    const diff = round2(b - c);
    const sign = diff > 0 ? "+" : "";
    console.log(
      `${String(m).padEnd(6)} ${("€" + b.toFixed(2)).padStart(11)} ${("€" + c.toFixed(2)).padStart(11)} ${(sign + "€" + diff.toFixed(2)).padStart(18)}`,
    );
    totalB += b;
    totalC += c;
  }
  const diffTot = round2(totalB - totalC);
  console.log(
    `${"TOT".padEnd(6)} ${("€" + totalB.toFixed(2)).padStart(11)} ${("€" + totalC.toFixed(2)).padStart(11)} ${((diffTot > 0 ? "+" : "") + "€" + diffTot.toFixed(2)).padStart(18)}`,
  );

  // ── Righe banca non presenti nel CRM (candidati da aggiungere) ──
  console.log(`\n═══ Voci banca NON tracciate nel CRM ═══\n`);
  const knownPatterns: RegExp[] = [
    /ALEXANDRU TUROV/i, // già in Soci (Gen)
    /LLAR I SALUT/i, // già AltroIngresso Apr
    /MAURIZIO BOGLIOLO/i, // già AltroIngresso
    /BOGLIOLO MAURIZIO/i,
    /KALBHENN FINN/i,
    /LORENZO VANGHETTI/i,
    /STRIPE|Stripe/,
    /GETYOURGUIDE/i,
    /LIQUIDACION REMESA/i, // FareHarbor/Cassa card
    /ABONO REMESA DE ADEUDOS/i, // quote soci SEPA
  ];
  const unknowns: BankRow[] = [];
  for (const e of entrate) {
    if (e.anno !== ANNO) continue;
    const label = e.beneficiario || e.concepto;
    if (!knownPatterns.some((re) => re.test(label))) unknowns.push(e);
  }
  let totUnk = 0;
  for (const u of unknowns) {
    const label = (u.beneficiario || u.concepto).slice(0, 60);
    console.log(
      `   ${u.data}  €${u.importo.toFixed(2).padStart(9)}  ${label}`,
    );
    totUnk += u.importo;
  }
  console.log(`\n   Totale voci non tracciate: €${totUnk.toFixed(2)}`);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error("❌", e);
    await prisma.$disconnect();
    process.exit(1);
  });
