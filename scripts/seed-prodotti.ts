import "dotenv/config";
import { prisma } from "../lib/prisma";

// Catalogo iniziale Molokai. Inserito con prezzoVendita=0 come placeholder
// (da aggiornare manualmente dalla pagina /finance/prodotti). attivo=true,
// feePerc/feeFissa = null. Lo script è idempotente: skip se il nome
// (case-insensitive) esiste già.
const NOMI = [
  "Sunrise SUP Experience",
  "Sunset SUP Experience",
  "Yoga SUP Experience",
  "SUP Private Lesson",
  "eFoil Session - Audi e-tron by Aerofoils",
  "Board Rental",
  "SUP Board Pack - 4 or 8 Sessions",
  "SUP Training Program - 4 Lessons",
  "CLUB MEMBER - Monthly",
  "Member Rental",
  "SURF Private Lesson",
  "SURF Training Program - 4 Lessons",
];

async function main() {
  const existing = await prisma.prodotto.findMany({
    select: { nome: true },
  });
  const existingLower = new Set(
    existing.map((p) => p.nome.trim().toLowerCase()),
  );

  let created = 0;
  let skipped = 0;
  for (const nome of NOMI) {
    if (existingLower.has(nome.toLowerCase())) {
      console.log(`⊘ skip (già presente): "${nome}"`);
      skipped++;
      continue;
    }
    const p = await prisma.prodotto.create({
      data: {
        nome,
        prezzoVendita: 0,
        feePerc: null,
        feeFissa: null,
        attivo: true,
      },
    });
    console.log(`✓ creato id=${p.id} "${p.nome}"`);
    created++;
  }
  console.log(`\nFatto. Creati: ${created} · Saltati: ${skipped}`);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
