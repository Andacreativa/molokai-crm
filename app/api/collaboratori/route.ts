import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const round2 = (n: number) => Math.round(n * 100) / 100;

interface TariffaInput {
  tipoAttivita: string;
  tariffaOraria: number | string;
}

export async function GET() {
  const collab = await prisma.collaboratore.findMany({
    orderBy: [{ attivo: "desc" }, { nome: "asc" }],
    include: {
      tariffe: { orderBy: { tipoAttivita: "asc" } },
      sessioni: { orderBy: { data: "asc" } },
      pagamenti: { orderBy: [{ anno: "asc" }, { mese: "asc" }] },
      anticipi: { orderBy: { createdAt: "desc" } },
    },
  });
  return NextResponse.json(collab);
}

// POST: crea collaboratore + tariffe iniziali (in bulk).
// body: { ...anagrafica, tariffe?: [{tipoAttivita, tariffaOraria}] }
export async function POST(request: Request) {
  const body = await request.json();
  const tariffe: TariffaInput[] = Array.isArray(body.tariffe)
    ? body.tariffe
    : [];

  const collab = await prisma.collaboratore.create({
    data: {
      nome: body.nome,
      cognome: body.cognome || null,
      dni: body.dni || null,
      cellulare: body.cellulare || null,
      email: body.email || null,
      iban: body.iban || null,
      ruolo: body.ruolo,
      note: body.note || null,
      attivo: body.attivo !== undefined ? Boolean(body.attivo) : true,
      tariffe: {
        create: tariffe
          .filter((t) => t.tipoAttivita)
          .map((t) => ({
            tipoAttivita: String(t.tipoAttivita).trim(),
            tariffaOraria: round2(parseFloat(String(t.tariffaOraria)) || 0),
          })),
      },
    },
    include: {
      tariffe: true,
      sessioni: true,
      pagamenti: true,
      anticipi: true,
    },
  });
  return NextResponse.json(collab);
}
