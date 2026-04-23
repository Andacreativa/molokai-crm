// Importa le 3 entrate BBVA non tracciate:
//   1. €1.155,21 del 20 Feb  → Rimborso Assicurazione Occident
//   2. €120 del 2 Apr        → Cashback BBVA
//   3. €10 del 4 Feb         → Deposito contanti (sposta da Cassa ad AltroIngresso)
//
// Uso: npx tsx scripts/import-bbva-entrate-mancanti.ts

import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  // 1) Rimborso Occident €1.155,21
  const r1 = await prisma.altroIngresso.create({
    data: {
      fonte: "Rimborso Assicurazione",
      descrizione: "Occident GCO Seguros",
      importo: 1155.21,
      mese: 2,
      anno: 2026,
      incassato: true,
      dataIncasso: new Date("2026-02-20"),
    },
  });
  console.log(`✓  AltroIngresso id=${r1.id} · €1.155,21 · Rimborso Occident`);

  // 2) Cashback BBVA €120
  const r2 = await prisma.altroIngresso.create({
    data: {
      fonte: "Cashback Banca",
      descrizione: "Promoción Comercial BBVA",
      importo: 120.0,
      mese: 4,
      anno: 2026,
      incassato: true,
      dataIncasso: new Date("2026-04-02"),
    },
  });
  console.log(`✓  AltroIngresso id=${r2.id} · €120 · Cashback BBVA`);

  // 3) Ingresso contanti €10 — crea AltroIngresso e azzera PagamentoInScuola
  const r3 = await prisma.altroIngresso.create({
    data: {
      fonte: "Ingresso Contanti",
      descrizione: "Deposito cassa BBVA",
      importo: 10.0,
      mese: 2,
      anno: 2026,
      incassato: true,
      dataIncasso: new Date("2026-02-04"),
    },
  });
  console.log(`✓  AltroIngresso id=${r3.id} · €10 · Ingresso Contanti`);

  // Azzera il PagamentoInScuola del 2026-02-04 (era misclassificato come cassa
  // ma in realtà era un deposito di contanti).
  const zeroed = await prisma.pagamentoInScuola.updateMany({
    where: { data: new Date("2026-02-04") },
    data: { totaleGiorno: 0, totVendite: 0, rimborsi: 0 },
  });
  console.log(
    `⊘  PagamentoInScuola 2026-02-04 azzerato (${zeroed.count} riga)`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("\n✅  Fatto");
  })
  .catch(async (e) => {
    console.error("❌", e);
    await prisma.$disconnect();
    process.exit(1);
  });
