// Smoke-test del parser BBVA con la nuova logica column-index.
// Replica la stessa pipeline del modal client-side.
//
// Uso: npx tsx scripts/test-bbva-parser.ts [path-xlsx]

import { readFileSync } from "fs";
import * as XLSX from "xlsx";

const path =
  process.argv[2] ||
  "/Users/b16451536/Downloads/BBVA Histórico movimientos (1).xlsx";

const BBVA_RULES: Array<[RegExp, string]> = [
  [/ALQUILER/i, "Affitto"],
  [/OCTOPUS|AIGUES|DIGI/i, "Utenze"],
  [/IMPUESTOS|TRIBUTOS|TGSS|SEGURIDAD\s*SOCIAL/i, "Tasse"],
  [/ALLIANZ|OCCIDENT|SEGURO/i, "Assicurazione"],
  [/DISPOSICION\s*DE\s*EFECTIVO/i, "Ritiro Contante"],
  [/BOARDS\s*MORE/i, "Materiale Sportivo"],
  [/TRANSFERENCIAS/i, "Rimborsi Soci"],
];

const categorizza = (c: string, b: string, o: string) => {
  const text = `${c} ${b} ${o}`;
  for (const [re, cat] of BBVA_RULES) if (re.test(text)) return cat;
  return "Scuola";
};

const cleanText = (v: unknown) =>
  String(v ?? "")
    .replace(/\s+/g, " ")
    .trim();

const toIsoDate = (v: unknown): string | null => {
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

// SpeseFisse fittizie per il dry-run (riproducono lo stato attuale del DB)
const FISSE_ATTIVE = [
  { tipo: "Affitto", categoria: "Affitto", costoMensile: 969 },
  { tipo: "Digi", categoria: "Utenze", costoMensile: 13 },
  { tipo: "Ionos Hosting", categoria: "Utenze", costoMensile: 10.89 },
];

function buildFisseMap() {
  const m = new Map<string, string[]>();
  for (const f of FISSE_ATTIVE) {
    const info = `${f.tipo} €${f.costoMensile.toFixed(2)}/mese`;
    for (const key of [f.tipo, f.categoria]) {
      const k = key.toLowerCase().trim();
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(info);
    }
  }
  return m;
}

function main() {
  console.log(`\n📂  Parsing: ${path}\n`);
  const wb = XLSX.read(readFileSync(path), { type: "buffer", cellDates: true });
  const sheetName =
    wb.SheetNames.find((n) => /^hist[óo]rico$/i.test(n)) || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: false,
    dateNF: "yyyy-mm-dd",
    defval: "",
  });
  const dataRows = aoa.slice(16);

  console.log(`Foglio: "${sheetName}" · ${dataRows.length} righe dopo header\n`);

  const fisseMap = buildFisseMap();

  const out: Array<{
    data: string;
    categoria: string;
    fornitore: string;
    importo: number;
    inFissa: boolean;
    fissaInfo: string;
  }> = [];

  for (const row of dataRows) {
    if (!row || row.length === 0) continue;
    const imp = parseImporto(row[8]);
    if (imp === null || isNaN(imp) || imp >= 0) continue;
    const iso = toIsoDate(row[2]);
    if (!iso) continue;
    const concepto = cleanText(row[5]);
    const beneficiario = cleanText(row[6]);
    const observaciones = cleanText(row[7]);
    const fornitore =
      beneficiario || observaciones.slice(0, 30).trim() || concepto || "—";
    const categoria = categorizza(concepto, beneficiario, observaciones);
    const matches = fisseMap.get(categoria.toLowerCase().trim()) ?? [];
    out.push({
      data: iso,
      categoria,
      fornitore,
      importo: Math.abs(imp),
      inFissa: matches.length > 0,
      fissaInfo: Array.from(new Set(matches)).join(", "),
    });
  }

  console.log(`USCITE TROVATE: ${out.length}\n`);
  console.log(
    `${"Data".padEnd(11)} ${"€".padStart(9)}  ${"Categoria".padEnd(20)} ${"Fornitore".padEnd(40)}`,
  );
  console.log("─".repeat(95));
  for (const r of out) {
    const flag = r.inFissa ? "⚠" : " ";
    console.log(
      `${flag} ${r.data.padEnd(11)} ${r.importo.toFixed(2).padStart(9)}  ${r.categoria.padEnd(20)} ${r.fornitore.slice(0, 35).padEnd(35)} ${r.fissaInfo ? "← " + r.fissaInfo : ""}`,
    );
  }
  const fisseCount = out.filter((r) => r.inFissa).length;
  console.log(`\nRighe segnalate "Già in Spese Fisse": ${fisseCount}/${out.length}`);

  // Distribuzione per categoria
  const byCat: Record<string, { count: number; total: number }> = {};
  for (const r of out) {
    if (!byCat[r.categoria])
      byCat[r.categoria] = { count: 0, total: 0 };
    byCat[r.categoria].count += 1;
    byCat[r.categoria].total += r.importo;
  }
  console.log("\nDistribuzione per categoria:");
  for (const [cat, info] of Object.entries(byCat).sort((a, b) =>
    b[1].total - a[1].total,
  )) {
    console.log(
      `  ${cat.padEnd(22)} ${String(info.count).padStart(3)} righe  €${info.total.toFixed(2).padStart(9)}`,
    );
  }
  console.log();
}
main();
