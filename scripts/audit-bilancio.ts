import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  // 1) Ritiri Contante registrati come Spesa (giri conto, non vere spese)
  console.log("\n═══ 1. Ritiri Contante in Spese ═══");
  const ritiri = await prisma.spesa.findMany({
    where: { OR: [{ categoria: "Ritiro Contante" }, { fornitore: { contains: "ritiro", mode: "insensitive" } }] },
    orderBy: { data: "asc" },
  });
  for (const s of ritiri) {
    console.log(`  id=${s.id} ${s.data.toISOString().slice(0,10)} m${s.mese} €${s.importo.toFixed(2)} ${s.categoria} - ${s.fornitore}`);
  }
  console.log(`  Totale: €${ritiri.reduce((a,b) => a + b.importo, 0).toFixed(2)} (questi sono giri conto, non uscite)`);

  // 2) Affitto: doppio conteggio Spesa variabile + SpesaFissa
  console.log("\n═══ 2. Affitto: Spese variabili VS SpeseFisse ═══");
  const affittoSp = await prisma.spesa.findMany({
    where: { categoria: "Affitto", anno: 2026 },
    orderBy: { mese: "asc" },
  });
  const affittoFisse = await prisma.spesaFissa.findMany({
    where: { OR: [{ tipo: { contains: "affitto", mode: "insensitive" } }, { categoria: "Affitto" }] },
  });
  console.log(`  Spesa variabili "Affitto": ${affittoSp.length}`);
  let totSp = 0;
  for (const s of affittoSp) {
    console.log(`    id=${s.id} m${s.mese} €${s.importo.toFixed(2)} - ${s.fornitore} ${s.note ? `(${s.note})` : ""}`);
    totSp += s.importo;
  }
  console.log(`    Tot Spese variabili Affitto: €${totSp.toFixed(2)}`);
  console.log(`  SpesaFissa attive di tipo Affitto: ${affittoFisse.length}`);
  for (const s of affittoFisse) {
    console.log(`    id=${s.id} ${s.tipo} costoMensile=€${s.costoMensile} attiva=${s.attiva}`);
  }
  const today = new Date();
  const mesiAttivi = today.getFullYear() === 2026 ? today.getMonth() + 1 : 12;
  const totFisse = affittoFisse.filter(x => x.attiva).reduce((a,b) => a + b.costoMensile, 0) * mesiAttivi;
  console.log(`    Tot SpeseFisse Affitto applicato (× ${mesiAttivi} mesi): €${totFisse.toFixed(2)}`);
  console.log(`  ⚠  DOPPIO CONTEGGIO totale: €${(totSp + totFisse).toFixed(2)} contro 1 affitto reale di €969/mese × ${mesiAttivi} = €${(969 * mesiAttivi).toFixed(2)}`);

  // 3) Spese con mese != month(data)
  console.log("\n═══ 3. Spese con mese != month(data) ═══");
  const all = await prisma.spesa.findMany({ where: { anno: 2026 } });
  const inconsistent = all.filter(s => {
    const mFromData = s.data.getUTCMonth() + 1;
    return mFromData !== s.mese;
  });
  if (inconsistent.length === 0) {
    console.log("  Nessuna inconsistenza");
  } else {
    for (const s of inconsistent) {
      console.log(`  id=${s.id} data=${s.data.toISOString().slice(0,10)} mese campo=${s.mese} (mese da data=${s.data.getUTCMonth()+1}) €${s.importo} ${s.fornitore}`);
    }
  }

  // 4) SpeseFisse attive: lista
  console.log("\n═══ 4. SpeseFisse attive ═══");
  const fisse = await prisma.spesaFissa.findMany({ where: { attiva: true }, orderBy: { tipo: "asc" } });
  for (const s of fisse) {
    console.log(`  ${s.tipo.padEnd(25)} costoMensile=€${s.costoMensile.toFixed(2).padStart(8)} categoria=${s.categoria ?? "—"}`);
  }
  console.log(`  Somma costoMensile: €${fisse.reduce((a,b)=>a+b.costoMensile,0).toFixed(2)}`);
  console.log(`  × ${mesiAttivi} mesi attivi = €${(fisse.reduce((a,b)=>a+b.costoMensile,0)*mesiAttivi).toFixed(2)}`);

  // 5) PagamentoCollaboratore - eventuali doppi su Spese
  console.log("\n═══ 5. PagamentoCollaboratore ═══");
  const collab = await prisma.pagamentoCollaboratore.findMany({ where: { anno: 2026 } });
  console.log(`  ${collab.length} pagamenti, totale "pagato" €${collab.reduce((a,b)=>a+b.pagato,0).toFixed(2)}`);
  for (const c of collab) {
    console.log(`    id=${c.id} m${c.mese} €${c.pagato.toFixed(2)} (campo="pagato" = importo pagato)`);
  }

  // 6) PagamentoDipendente collegati a Spesa (no double-count check)
  console.log("\n═══ 6. PagamentoDipendente ↔ Spesa ═══");
  const dip = await prisma.pagamentoDipendente.findMany({ where: { anno: 2026 } });
  console.log(`  ${dip.length} pagamenti dipendenti`);
  for (const d of dip) {
    if (d.spesaId) {
      const sp = await prisma.spesa.findUnique({ where: { id: d.spesaId } });
      console.log(`    id=${d.id} m${d.mese} tipo=${d.tipo} → Spesa id=${d.spesaId} €${sp?.importo} (OK, contato 1 sola volta nelle Spese)`);
    } else {
      console.log(`    id=${d.id} m${d.mese} tipo=${d.tipo} senza Spesa collegata (NOT contato nel bilancio)`);
    }
  }
}
main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
