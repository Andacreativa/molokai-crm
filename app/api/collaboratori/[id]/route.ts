import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const round2 = (n: number) => Math.round(n * 100) / 100;

interface TariffaInput {
  tipoAttivita: string;
  tariffaOraria: number | string;
}

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const collab = await prisma.collaboratore.findUnique({
    where: { id: parseInt(id) },
    include: {
      tariffe: { orderBy: { tipoAttivita: "asc" } },
      sessioni: { orderBy: { data: "asc" } },
      pagamenti: { orderBy: [{ anno: "asc" }, { mese: "asc" }] },
      anticipi: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!collab) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(collab);
}

// PUT: aggiorna anagrafica. Se body.tariffe è fornito, sostituisce TUTTE le tariffe.
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const collabId = parseInt(id);
  const body = await request.json();

  const data: Record<string, unknown> = {};
  if (body.nome !== undefined) data.nome = body.nome;
  if (body.cognome !== undefined) data.cognome = body.cognome || null;
  if (body.dni !== undefined) data.dni = body.dni || null;
  if (body.cellulare !== undefined) data.cellulare = body.cellulare || null;
  if (body.email !== undefined) data.email = body.email || null;
  if (body.iban !== undefined) data.iban = body.iban || null;
  if (body.ruolo !== undefined) data.ruolo = body.ruolo;
  if (body.note !== undefined) data.note = body.note || null;
  if (body.attivo !== undefined) data.attivo = Boolean(body.attivo);

  // Se tariffe è esplicitamente fornito, replace-all
  if (body.tariffe !== undefined && Array.isArray(body.tariffe)) {
    const tariffe: TariffaInput[] = body.tariffe;
    await prisma.tariffaCollaboratore.deleteMany({
      where: { collaboratoreId: collabId },
    });
    await prisma.tariffaCollaboratore.createMany({
      data: tariffe
        .filter((t) => t.tipoAttivita)
        .map((t) => ({
          collaboratoreId: collabId,
          tipoAttivita: String(t.tipoAttivita).trim(),
          tariffaOraria: round2(parseFloat(String(t.tariffaOraria)) || 0),
        })),
    });
  }

  const collab = await prisma.collaboratore.update({
    where: { id: collabId },
    data,
    include: {
      tariffe: { orderBy: { tipoAttivita: "asc" } },
      sessioni: { orderBy: { data: "asc" } },
      pagamenti: { orderBy: [{ anno: "asc" }, { mese: "asc" }] },
      anticipi: { orderBy: { createdAt: "desc" } },
    },
  });
  return NextResponse.json(collab);
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // Cascade configurato sullo schema → elimina tariffe/sessioni/pagamenti/anticipi
  await prisma.collaboratore.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ ok: true });
}
