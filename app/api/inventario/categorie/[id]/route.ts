import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const nome = (body.nome || "").trim();
    if (!nome) {
      return NextResponse.json({ error: "Nome obbligatorio" }, { status: 400 });
    }
    const row = await prisma.categoriaInventario.update({
      where: { id: parseInt(id) },
      data: {
        nome,
        ...(body.ordine !== undefined && { ordine: body.ordine }),
      },
    });
    return NextResponse.json(row);
  } catch (e: unknown) {
    const msg = String(e);
    if (msg.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "Esiste già una categoria con questo nome" },
        { status: 409 },
      );
    }
    console.error("[PUT /api/inventario/categorie/[id]]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const categoriaId = parseInt(id);
    const count = await prisma.inventarioItem.count({ where: { categoriaId } });
    if (count > 0) {
      return NextResponse.json(
        {
          error: `Impossibile eliminare: la categoria contiene ${count} ${count === 1 ? "item" : "items"}`,
        },
        { status: 400 },
      );
    }
    await prisma.categoriaInventario.delete({ where: { id: categoriaId } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[DELETE /api/inventario/categorie/[id]]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
