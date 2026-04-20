import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const pagamenti = await prisma.pagamentoSocio.findMany({
    where: { socioId: parseInt(id) },
    orderBy: [{ anno: "desc" }, { mese: "asc" }],
  });
  return NextResponse.json(pagamenti);
}

// PUT: toggle/upsert pagamento per un (socio, anno, mese).
// Body: { anno, mese, pagato, importo? }
// Ritorna la lista aggiornata dei pagamenti del socio.
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const socioId = parseInt(id);
  const body = await request.json();
  const anno = parseInt(body.anno);
  const mese = parseInt(body.mese);
  const pagato = Boolean(body.pagato);
  const importo =
    body.importo === null || body.importo === undefined || body.importo === ""
      ? null
      : parseFloat(body.importo);

  if (!anno || !mese || mese < 1 || mese > 12) {
    return NextResponse.json(
      { error: "anno/mese non validi" },
      { status: 400 },
    );
  }

  await prisma.pagamentoSocio.upsert({
    where: { socioId_anno_mese: { socioId, anno, mese } },
    create: {
      socioId,
      anno,
      mese,
      pagato,
      importo,
      data: pagato ? new Date() : null,
    },
    update: {
      pagato,
      importo,
      data: pagato ? new Date() : null,
    },
  });

  const pagamenti = await prisma.pagamentoSocio.findMany({
    where: { socioId },
    orderBy: [{ anno: "desc" }, { mese: "asc" }],
  });
  return NextResponse.json(pagamenti);
}
