import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const buono = await prisma.buono.findUnique({
    where: { id: parseInt(id) },
    include: { socio: true },
  });
  if (!buono) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(buono);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const buono = await prisma.buono.update({
    where: { id: parseInt(id) },
    data: {
      ...(body.nome !== undefined && { nome: body.nome }),
      ...(body.cognome !== undefined && { cognome: body.cognome || null }),
      ...(body.cellulare !== undefined && {
        cellulare: body.cellulare || null,
      }),
      ...(body.email !== undefined && { email: body.email || null }),
      ...(body.socioId !== undefined && {
        socioId: body.socioId ? parseInt(body.socioId) : null,
      }),
      ...(body.tipoBuono !== undefined && { tipoBuono: body.tipoBuono }),
      ...(body.prezzoBuono !== undefined && {
        prezzoBuono: parseFloat(body.prezzoBuono) || 0,
      }),
      ...(body.pagato !== undefined && { pagato: Boolean(body.pagato) }),
      ...(body.mesePagamento !== undefined && {
        mesePagamento: body.mesePagamento || null,
      }),
      ...(body.stato !== undefined && { stato: body.stato }),
      ...(body.sessioniTotali !== undefined && {
        sessioniTotali:
          body.sessioniTotali === null || body.sessioniTotali === ""
            ? null
            : parseInt(body.sessioniTotali),
      }),
      ...(body.sessioniUsate !== undefined && {
        sessioniUsate: parseInt(body.sessioniUsate) || 0,
      }),
      ...(body.note !== undefined && { note: body.note || null }),
    },
  });
  return NextResponse.json(buono);
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.buono.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ ok: true });
}
