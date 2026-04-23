// Trova potenziali duplicati nelle Spese raggruppando per importo.
// Mostra gruppi con >= 2 record, così si può decidere se accorpare.
//
// Uso: npx tsx scripts/check-duplicati-spese.ts

import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  const all = await prisma.spesa.findMany({
    orderBy: [{ importo: "asc" }, { data: "asc" }],
  });

  // Raggruppa per importo (arrotondato a 2 decimali)
  const byImporto = new Map<string, typeof all>();
  for (const s of all) {
    const key = s.importo.toFixed(2);
    if (!byImporto.has(key)) byImporto.set(key, []);
    byImporto.get(key)!.push(s);
  }

  const dup = [...byImporto.entries()].filter(([, rows]) => rows.length >= 2);
  if (dup.length === 0) {
    console.log("✅  Nessun importo duplicato trovato");
    return;
  }

  console.log(`\n⚠  Trovati ${dup.length} importi con più di una spesa:\n`);

  // Ordina per importo decrescente così i più grandi (più rilevanti) vanno in alto
  dup.sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]));

  for (const [imp, rows] of dup) {
    console.log(`\n─── €${imp} · ${rows.length} record ───`);
    for (const r of rows) {
      const d = r.data.toISOString().slice(0, 10);
      console.log(
        `  id=${r.id.toString().padStart(3)}  ${d}  m${r.mese}/${r.anno}  ${r.categoria.padEnd(22)} ${r.fornitore}`,
      );
    }

    // Analisi: stesso fornitore? stesso mese?
    const fornitori = new Set(rows.map((r) => r.fornitore.toLowerCase().trim()));
    const mesi = new Set(rows.map((r) => `${r.mese}/${r.anno}`));
    const verdicts: string[] = [];
    if (fornitori.size === 1) verdicts.push("STESSO fornitore");
    if (mesi.size === 1) verdicts.push("STESSO mese");
    if (verdicts.length > 0) {
      console.log(`  → ${verdicts.join(" + ")} — probabile duplicato`);
    } else if (fornitori.size < rows.length) {
      console.log(
        `  → fornitori: ${[...fornitori].join(" | ")} — verificare se variante dello stesso`,
      );
    }
  }

  console.log();
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error("❌", e);
    await prisma.$disconnect();
    process.exit(1);
  });
