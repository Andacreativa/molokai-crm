import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const row = await prisma.inventarioItem.update({
      where: { id: parseInt(id) },
      data: {
        ...(body.categoriaId !== undefined && {
          categoriaId: parseInt(body.categoriaId),
        }),
        ...(body.marca !== undefined && { marca: body.marca || null }),
        ...(body.modello !== undefined && { modello: body.modello || null }),
        ...(body.taglia !== undefined && { taglia: body.taglia || null }),
        ...(body.lunghezza !== undefined && {
          lunghezza: body.lunghezza || null,
        }),
        ...(body.volume !== undefined && { volume: body.volume || null }),
        ...(body.numeroSerie !== undefined && {
          numeroSerie: body.numeroSerie || null,
        }),
        ...(body.colore !== undefined && { colore: body.colore || null }),
        ...(body.quantita !== undefined && {
          quantita: parseInt(body.quantita) || 1,
        }),
        ...(body.stato !== undefined && { stato: body.stato || "Nuovo" }),
        ...(body.note !== undefined && { note: body.note || null }),
        ...(body.dataAcquisto !== undefined && {
          dataAcquisto: body.dataAcquisto ? new Date(body.dataAcquisto) : null,
        }),
        ...(body.costoAcquisto !== undefined && {
          costoAcquisto:
            body.costoAcquisto !== null && body.costoAcquisto !== ""
              ? parseFloat(body.costoAcquisto)
              : null,
        }),
      },
    });
    return NextResponse.json(row);
  } catch (e) {
    console.error("[PUT /api/inventario/items/[id]]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await prisma.inventarioItem.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[DELETE /api/inventario/items/[id]]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
