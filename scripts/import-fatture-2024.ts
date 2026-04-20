import { prisma } from "../lib/prisma";

const PAESE_MAP: Record<string, string> = {
  ITALIA: "Italia",
  SPAGNA: "Spagna",
};

const FATTURE = [
  [
    "INV-1",
    "04/07/2024",
    "ACE SAS",
    "01835400274",
    "ITALIA",
    1800,
    true,
    "11/07/2024",
  ],
  [
    "INV-2",
    "05/08/2024",
    "ANGELO IORLANO",
    "Y9132102N",
    "SPAGNA",
    800,
    true,
    "12/08/2024",
  ],
  [
    "INV-3",
    "26/09/2024",
    "ANGELO IORLANO",
    "Y9132102N",
    "SPAGNA",
    1050,
    true,
    "03/10/2024",
  ],
  [
    "INV-4",
    "01/10/2024",
    "IMMOBILIARE MAAB",
    "01792460931",
    "ITALIA",
    400,
    true,
    "08/10/2024",
  ],
  [
    "INV-5",
    "12/11/2024",
    "IL CALICE SAS",
    "04860540261",
    "ITALIA",
    500,
    true,
    "19/11/2024",
  ],
  [
    "INV-6",
    "30/12/2024",
    "IL CALICE SAS",
    "04860540261",
    "ITALIA",
    500,
    true,
    "06/01/2025",
  ],
] as const;

const parseDmy = (s: string): Date => {
  const [dd, mm, yyyy] = s.split("/").map(Number);
  return new Date(yyyy, mm - 1, dd);
};

async function main() {
  let createdClienti = 0;
  let inserted = 0;
  const skipped: string[] = [];

  for (const row of FATTURE) {
    const [numero, dataStr, nome, nif, paeseRaw, importo, pagato, scadStr] =
      row;
    const paese = PAESE_MAP[paeseRaw] ?? "Italia";
    const data = parseDmy(dataStr);
    const scadenza = parseDmy(scadStr);

    const existsFatt = await prisma.fattura.findFirst({ where: { numero } });
    if (existsFatt) {
      skipped.push(`${numero} già presente`);
      continue;
    }

    let cliente = await prisma.cliente.findFirst({
      where: { partitaIva: nif },
    });
    if (!cliente) {
      cliente = await prisma.cliente.findFirst({
        where: { nome: { equals: nome, mode: "insensitive" } },
      });
    }
    if (!cliente) {
      cliente = await prisma.cliente.create({
        data: { nome, partitaIva: nif, paese },
      });
      createdClienti++;
      console.log(`  + Cliente creato: ${nome} (${nif})`);
    }

    await prisma.fattura.create({
      data: {
        numero,
        data,
        clienteId: cliente.id,
        azienda: paese,
        mese: data.getMonth() + 1,
        anno: data.getFullYear(),
        importo,
        tipoIva: "igic_exenta",
        iva: 0,
        pagato,
        scadenza,
      },
    });
    inserted++;
    console.log(
      `✓ ${numero} ${dataStr} — ${nome} — €${importo} — scad. ${scadStr}`,
    );
  }

  console.log(
    `\n✓ Inserite ${inserted} fatture 2024, ${createdClienti} clienti nuovi.`,
  );
  if (skipped.length) console.log(`Saltate: ${skipped.join(", ")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
