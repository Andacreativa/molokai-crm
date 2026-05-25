import "dotenv/config";
import { prisma } from "../lib/prisma";

// Seed/sync del catalogo Molokai (idempotente).
// - Cerca ogni prodotto per nome (case-insensitive, trim).
// - Se NON esiste → lo crea con prezzoVendita=0, feePerc/feeFissa=null,
//   attivo=true, categoria + ordine come da spec.
// - Se ESISTE → aggiorna SOLO categoria + ordine (non tocca prezzo/fee/
//   attivo per non sovrascrivere modifiche fatte dall'utente in UI).
// - Non rimuove prodotti extra non in lista (l'utente può crearne altri).

const CATALOGO: { nome: string; categoria: "singolo" | "pack" }[] = [
  // Singoli (ordine 1..8)
  { nome: "Sunrise SUP Experience", categoria: "singolo" },
  { nome: "Sunset SUP Experience", categoria: "singolo" },
  { nome: "Yoga SUP Experience", categoria: "singolo" },
  { nome: "SUP Private Lesson", categoria: "singolo" },
  { nome: "eFoil Session - Audi e-tron by Aerofoils", categoria: "singolo" },
  { nome: "Board Rental", categoria: "singolo" },
  { nome: "Member Rental", categoria: "singolo" },
  { nome: "SURF Private Lesson", categoria: "singolo" },
  // Pack (ordine 1..4)
  { nome: "SUP Board Pack - 4 or 8 Sessions", categoria: "pack" },
  { nome: "SUP Training Program - 4 Lessons", categoria: "pack" },
  { nome: "SURF Training Program - 4 Lessons", categoria: "pack" },
  { nome: "CLUB MEMBER - Monthly", categoria: "pack" },
];

async function main() {
  const tutti = await prisma.prodotto.findMany({
    select: { id: true, nome: true },
  });
  const byNameLower = new Map<string, number>();
  for (const p of tutti) byNameLower.set(p.nome.trim().toLowerCase(), p.id);

  let creati = 0;
  let aggiornati = 0;
  // Conta progressiva per ogni categoria (1..N per categoria)
  const counters: Record<"singolo" | "pack", number> = {
    singolo: 0,
    pack: 0,
  };

  for (const item of CATALOGO) {
    counters[item.categoria]++;
    const ordine = counters[item.categoria];
    const existingId = byNameLower.get(item.nome.trim().toLowerCase());
    if (existingId) {
      await prisma.prodotto.update({
        where: { id: existingId },
        data: { categoria: item.categoria, ordine },
      });
      console.log(
        `↻ id=${existingId} "${item.nome}" → categoria=${item.categoria} ordine=${ordine}`,
      );
      aggiornati++;
    } else {
      const p = await prisma.prodotto.create({
        data: {
          nome: item.nome,
          prezzoVendita: 0,
          feePerc: null,
          feeFissa: null,
          attivo: true,
          categoria: item.categoria,
          ordine,
        },
      });
      console.log(
        `✓ id=${p.id} "${p.nome}" → categoria=${item.categoria} ordine=${ordine}`,
      );
      creati++;
    }
  }

  // Verifica prodotti extra non in lista (informativo, non li tocca)
  const cataloghiSet = new Set(
    CATALOGO.map((c) => c.nome.trim().toLowerCase()),
  );
  const extra = tutti.filter((p) => !cataloghiSet.has(p.nome.trim().toLowerCase()));
  if (extra.length > 0) {
    console.log(
      `\nNota: ${extra.length} prodotti extra non in lista (non modificati):`,
    );
    for (const e of extra) console.log(`  · id=${e.id} "${e.nome}"`);
  }

  console.log(
    `\nFatto. Creati: ${creati} · Aggiornati: ${aggiornati} · Extra: ${extra.length}`,
  );
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
