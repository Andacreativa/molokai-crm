import { prisma } from "../lib/prisma";
import { applyFinnSplit, deleteAllFinnSplits } from "../lib/finn-split";

async function main() {
  const fatture = await prisma.fattura.findMany({
    where: { commerciale: { contains: "finn", mode: "insensitive" } },
    include: { cliente: true },
    orderBy: { id: "asc" },
  });

  console.log(`Trovate ${fatture.length} fatture Finn:\n`);

  const del = await deleteAllFinnSplits(prisma);
  console.log(
    `Eliminate vecchie entries: ${del.altri} altri ingressi + ${del.spese} spese\n`,
  );

  let applied = 0;
  let skipped = 0;
  for (const f of fatture) {
    const cliente = f.cliente?.nome ?? "(senza cliente)";
    if (!f.pagato) {
      console.log(
        `- #${f.id} ${f.numero ?? ""} — ${cliente} — €${f.importo} [SALTATA: non pagata]`,
      );
      skipped++;
      continue;
    }
    await applyFinnSplit(prisma, f);
    const q15 = Math.round(f.importo * 0.15 * 100) / 100;
    const q85 = Math.round(f.importo * 0.85 * 100) / 100;
    console.log(
      `✓ #${f.id} ${f.numero ?? ""} — ${cliente} — €${f.importo} → AltroIngresso €${q15} (15%) + Spesa €${q85} (85%)`,
    );
    applied++;
  }

  console.log(
    `\n✓ Applicato split a ${applied} fatture pagate. Saltate ${skipped} non pagate.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
