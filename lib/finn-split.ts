import type { PrismaClient } from "@prisma/client";

interface FinnFattura {
  id: number;
  importo: number;
  mese: number;
  anno: number;
  pagato: boolean;
  cliente?: { nome: string } | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export const isFinnCommerciale = (commerciale: string | null | undefined) =>
  (commerciale ?? "").toLowerCase().includes("finn");

export const isFinnRitenuta = (a: {
  fonte?: string | null;
  descrizione?: string | null;
}) => a.fonte === "Finn" && a.descrizione === "Ritenuta spese gestione Anda";

export async function applyFinnSplit(prisma: PrismaClient, f: FinnFattura) {
  const quota15 = round2(f.importo * 0.15);
  const quota85 = round2(f.importo * 0.85);
  const clienteNome = f.cliente?.nome ?? null;

  await prisma.altroIngresso.create({
    data: {
      fonte: "Finn",
      azienda: "Spagna",
      aziendaNota: null,
      descrizione: "Ritenuta spese gestione Anda",
      mese: f.mese,
      anno: f.anno,
      importo: quota15,
      incassato: true,
      dataIncasso: new Date(),
      fatturaId: f.id,
    },
  });

  await prisma.spesa.create({
    data: {
      azienda: "Spagna",
      fornitore: "Finn Kalbhenn",
      categoria: "Soci",
      descrizione: clienteNome,
      mese: f.mese,
      anno: f.anno,
      importo: quota85,
      fatturaId: f.id,
    },
  });
}

export async function deleteFinnSplitForFattura(
  prisma: PrismaClient,
  fatturaId: number,
) {
  const altri = await prisma.altroIngresso.deleteMany({
    where: { fatturaId },
  });
  const spese = await prisma.spesa.deleteMany({
    where: { fatturaId },
  });
  return { altri: altri.count, spese: spese.count };
}

export async function deleteAllFinnSplits(prisma: PrismaClient) {
  const altri = await prisma.altroIngresso.deleteMany({
    where: {
      OR: [
        { fatturaId: { not: null } },
        { fonte: "Finn", descrizione: "Ritenuta spese gestione Anda" },
      ],
    },
  });
  const spese = await prisma.spesa.deleteMany({
    where: {
      OR: [
        { fatturaId: { not: null } },
        { fornitore: "Finn Kalbhenn", categoria: "Soci" },
      ],
    },
  });
  return { altri: altri.count, spese: spese.count };
}
