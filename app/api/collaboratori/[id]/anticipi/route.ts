import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const anticipi = await prisma.anticipoColl.findMany({
    where: { collaboratoreId: parseInt(id) },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(anticipi);
}

// POST: aggiungi anticipo. body: { mese (string), importo, restituito? }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const collaboratoreId = parseInt(id);
  const body = await request.json();

  const anticipo = await prisma.anticipoColl.create({
    data: {
      collaboratoreId,
      mese: String(body.mese || ""),
      importo: round2(parseFloat(String(body.importo)) || 0),
      restituito: Boolean(body.restituito),
    },
  });
  return NextResponse.json(anticipo);
}

// PUT: aggiorna anticipo esistente.
// body: { id, mese?, importo?, restituito? }
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const collaboratoreId = parseInt(id);
  const body = await request.json();
  const anticipoId = parseInt(String(body.id));
  if (!anticipoId) {
    return NextResponse.json({ error: "id mancante" }, { status: 400 });
  }

  // Verifica appartenenza
  const before = await prisma.anticipoColl.findUnique({
    where: { id: anticipoId },
  });
  if (!before || before.collaboratoreId !== collaboratoreId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (body.mese !== undefined) data.mese = String(body.mese);
  if (body.importo !== undefined) {
    data.importo = round2(parseFloat(String(body.importo)) || 0);
  }
  if (body.restituito !== undefined) data.restituito = Boolean(body.restituito);

  const anticipo = await prisma.anticipoColl.update({
    where: { id: anticipoId },
    data,
  });
  return NextResponse.json(anticipo);
}

// DELETE: rimuove anticipo. body: { id }
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const collaboratoreId = parseInt(id);
  const body = await request.json().catch(() => ({}));
  const anticipoId = parseInt(String(body.id));
  if (!anticipoId) {
    return NextResponse.json({ error: "id mancante" }, { status: 400 });
  }
  const before = await prisma.anticipoColl.findUnique({
    where: { id: anticipoId },
  });
  if (!before || before.collaboratoreId !== collaboratoreId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.anticipoColl.delete({ where: { id: anticipoId } });
  return NextResponse.json({ ok: true });
}
