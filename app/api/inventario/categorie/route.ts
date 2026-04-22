import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const rows = await prisma.categoriaInventario.findMany({
      orderBy: [{ ordine: "asc" }, { nome: "asc" }],
      include: { _count: { select: { items: true } } },
    });
    return NextResponse.json(rows);
  } catch (e) {
    console.error("[GET /api/inventario/categorie]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const nome = (body.nome || "").trim();
    if (!nome) {
      return NextResponse.json({ error: "Nome obbligatorio" }, { status: 400 });
    }
    const max = await prisma.categoriaInventario.aggregate({
      _max: { ordine: true },
    });
    const row = await prisma.categoriaInventario.create({
      data: { nome, ordine: (max._max.ordine ?? 0) + 1 },
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
    console.error("[POST /api/inventario/categorie]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
