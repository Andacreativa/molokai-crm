import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const round2 = (n: number) => Math.round(n * 100) / 100;

function computeIva(importo: number, aliquota: number, deducibile: boolean): number {
  if (!deducibile || aliquota <= 0) return 0;
  const rate = aliquota / 100;
  return round2((importo / (1 + rate)) * rate);
}

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const spesa = await prisma.spesa.findUnique({
    where: { id: parseInt(id) },
  });
  if (!spesa) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(spesa);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const rowId = parseInt(id);
  const before = await prisma.spesa.findUnique({ where: { id: rowId } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();

  const updateData: Record<string, unknown> = {};

  if (body.data !== undefined) {
    const d = body.data ? new Date(body.data) : null;
    if (d) {
      updateData.data = d;
      updateData.mese = d.getMonth() + 1;
      updateData.anno = d.getFullYear();
    }
  }
  if (body.fornitore !== undefined) updateData.fornitore = body.fornitore;
  if (body.categoria !== undefined) updateData.categoria = body.categoria;
  if (body.descrizione !== undefined)
    updateData.descrizione = body.descrizione || null;
  if (body.mese !== undefined) updateData.mese = parseInt(String(body.mese));
  if (body.anno !== undefined) updateData.anno = parseInt(String(body.anno));
  if (body.ricevutaPath !== undefined)
    updateData.ricevutaPath = body.ricevutaPath || null;
  if (body.note !== undefined) updateData.note = body.note || null;

  // Gestione IVA: se cambia importo/aliquota/deducibile e ivaRecuperabile non
  // è esplicito nel body, ricalcoliamo automaticamente.
  const importoChanged = body.importo !== undefined;
  const aliquotaChanged = body.aliquotaIva !== undefined;
  const deducibileChanged = body.ivaDeducibile !== undefined;
  const newImporto = importoChanged
    ? round2(parseFloat(String(body.importo)) || 0)
    : before.importo;
  const newAliquota = aliquotaChanged
    ? parseFloat(String(body.aliquotaIva)) || 0
    : before.aliquotaIva;
  const newDeducibile = deducibileChanged
    ? Boolean(body.ivaDeducibile)
    : before.ivaDeducibile;

  if (importoChanged) updateData.importo = newImporto;
  if (aliquotaChanged) updateData.aliquotaIva = newAliquota;
  if (deducibileChanged) updateData.ivaDeducibile = newDeducibile;

  if (body.ivaRecuperabile !== undefined && body.ivaRecuperabile !== null) {
    updateData.ivaRecuperabile = round2(
      parseFloat(String(body.ivaRecuperabile)) || 0,
    );
  } else if (importoChanged || aliquotaChanged || deducibileChanged) {
    updateData.ivaRecuperabile = computeIva(
      newImporto,
      newAliquota,
      newDeducibile,
    );
  }

  const spesa = await prisma.spesa.update({
    where: { id: rowId },
    data: updateData,
  });
  return NextResponse.json(spesa);
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.spesa.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ ok: true });
}
