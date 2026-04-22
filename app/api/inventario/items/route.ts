import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cat = searchParams.get("categoriaId");
    const where = cat ? { categoriaId: parseInt(cat) } : {};
    const rows = await prisma.inventarioItem.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
    });
    return NextResponse.json(rows);
  } catch (e) {
    console.error("[GET /api/inventario/items]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.categoriaId) {
      return NextResponse.json(
        { error: "categoriaId obbligatorio" },
        { status: 400 },
      );
    }
    const row = await prisma.inventarioItem.create({
      data: {
        categoriaId: parseInt(body.categoriaId),
        marca: body.marca || null,
        modello: body.modello || null,
        taglia: body.taglia || null,
        lunghezza: body.lunghezza || null,
        volume: body.volume || null,
        numeroSerie: body.numeroSerie || null,
        colore: body.colore || null,
        quantita: parseInt(body.quantita) || 1,
        stato: body.stato || "Nuovo",
        note: body.note || null,
        dataAcquisto: body.dataAcquisto ? new Date(body.dataAcquisto) : null,
        costoAcquisto:
          body.costoAcquisto !== undefined && body.costoAcquisto !== null &&
          body.costoAcquisto !== ""
            ? parseFloat(body.costoAcquisto)
            : null,
      },
    });
    return NextResponse.json(row);
  } catch (e) {
    console.error("[POST /api/inventario/items]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
