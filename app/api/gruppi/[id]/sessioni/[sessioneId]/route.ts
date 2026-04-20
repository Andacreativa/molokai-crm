import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; sessioneId: string }> },
) {
  const { sessioneId } = await params;
  const before = await prisma.sessioneGruppo.findUnique({
    where: { id: parseInt(sessioneId) },
  });
  if (!before) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = await request.json();

  const newData = body.data ? new Date(body.data) : before.data;
  const newPartecipanti =
    body.partecipanti !== undefined
      ? parseInt(String(body.partecipanti)) || 0
      : before.partecipanti;
  const newPrezzoPP =
    body.prezzoPP !== undefined
      ? round2(parseFloat(String(body.prezzoPP)) || 0)
      : before.prezzoPP;

  const sessione = await prisma.sessioneGruppo.update({
    where: { id: parseInt(sessioneId) },
    data: {
      data: newData,
      mese: newData.getMonth() + 1,
      anno: newData.getFullYear(),
      partecipanti: newPartecipanti,
      prezzoPP: newPrezzoPP,
      totale: round2(newPartecipanti * newPrezzoPP),
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
  await prisma.sessioneGruppo.delete({
    where: { id: parseInt(sessioneId) },
  });
  return NextResponse.json({ ok: true });
}
