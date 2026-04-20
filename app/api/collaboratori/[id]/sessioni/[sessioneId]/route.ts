import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; sessioneId: string }> },
) {
  const { id, sessioneId } = await params;
  const collaboratoreId = parseInt(id);
  const sId = parseInt(sessioneId);
  const before = await prisma.sessioneCollaboratore.findUnique({
    where: { id: sId },
  });
  if (!before) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = await request.json();

  const newData = body.data ? new Date(body.data) : before.data;
  const newOre =
    body.ore !== undefined
      ? round2(parseFloat(String(body.ore)) || 0)
      : before.ore;
  const newTipo =
    body.tipoAttivita !== undefined
      ? String(body.tipoAttivita).trim()
      : before.tipoAttivita;

  let newCosto: number;
  if (body.costo !== undefined && body.costo !== null) {
    newCosto = round2(parseFloat(String(body.costo)) || 0);
  } else if (body.ore !== undefined || body.tipoAttivita !== undefined) {
    const tariffa = await prisma.tariffaCollaboratore.findUnique({
      where: {
        collaboratoreId_tipoAttivita: {
          collaboratoreId,
          tipoAttivita: newTipo,
        },
      },
    });
    newCosto = round2(newOre * (tariffa?.tariffaOraria ?? 0));
  } else {
    newCosto = before.costo;
  }

  const sessione = await prisma.sessioneCollaboratore.update({
    where: { id: sId },
    data: {
      data: newData,
      mese: newData.getMonth() + 1,
      anno: newData.getFullYear(),
      tipoAttivita: newTipo,
      ore: newOre,
      costo: newCosto,
      ...(body.note !== undefined && { note: body.note || null }),
    },
  });
  return NextResponse.json(sessione);
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string; sessioneId: string }> },
) {
  const { sessioneId } = await params;
  await prisma.sessioneCollaboratore.delete({
    where: { id: parseInt(sessioneId) },
  });
  return NextResponse.json({ ok: true });
}
