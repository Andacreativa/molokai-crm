import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const pagamenti = await prisma.pagamentoCollaboratore.findMany({
    where: { collaboratoreId: parseInt(id) },
    orderBy: [{ anno: "asc" }, { mese: "asc" }],
  });
  return NextResponse.json(pagamenti);
}

// PUT upsert per (collab, anno, mese).
// body: { anno, mese, dovuto?, pagato?, data?, note? }
// Se pagato === 0 e nessun altro dato → elimina record (toggle off).
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const collaboratoreId = parseInt(id);
  const body = await request.json();
  const anno = parseInt(String(body.anno));
  const mese = parseInt(String(body.mese));
  if (!anno || !mese || mese < 1 || mese > 12) {
    return NextResponse.json(
      { error: "anno/mese non validi" },
      { status: 400 },
    );
  }

  const dovuto = round2(parseFloat(String(body.dovuto ?? 0)) || 0);
  const pagato = round2(parseFloat(String(body.pagato ?? 0)) || 0);
  const dataPagamento = pagato > 0 ? new Date() : null;

  // Toggle off: se pagato=0 e il record esiste, eliminalo.
  if (pagato === 0 && body.dovuto === undefined && body.note === undefined) {
    await prisma.pagamentoCollaboratore.deleteMany({
      where: { collaboratoreId, anno, mese },
    });
    const all = await prisma.pagamentoCollaboratore.findMany({
      where: { collaboratoreId },
      orderBy: [{ anno: "asc" }, { mese: "asc" }],
    });
    return NextResponse.json(all);
  }

  await prisma.pagamentoCollaboratore.upsert({
    where: {
      collaboratoreId_anno_mese: { collaboratoreId, anno, mese },
    },
    create: {
      collaboratoreId,
      anno,
      mese,
      dovuto,
      pagato,
      data: dataPagamento,
      note: body.note || null,
    },
    update: {
      dovuto,
      pagato,
      data: dataPagamento,
      ...(body.note !== undefined && { note: body.note || null }),
    },
  });

  const all = await prisma.pagamentoCollaboratore.findMany({
    where: { collaboratoreId },
    orderBy: [{ anno: "asc" }, { mese: "asc" }],
  });
  return NextResponse.json(all);
}
