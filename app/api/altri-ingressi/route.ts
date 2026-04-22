import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const anno = parseInt(
      searchParams.get("anno") || String(new Date().getFullYear()),
    );
    const rows = await prisma.altroIngresso.findMany({
      where: { anno },
      orderBy: [{ mese: "asc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(rows);
  } catch (e) {
    console.error("[GET /api/altri-ingressi]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const row = await prisma.altroIngresso.create({
      data: {
        fonte: body.fonte,
        descrizione: body.descrizione || null,
        mese: body.mese,
        anno: body.anno || new Date().getFullYear(),
        importo: parseFloat(body.importo) || 0,
        incassato: Boolean(body.incassato),
        dataIncasso: body.dataIncasso ? new Date(body.dataIncasso) : null,
      },
    });
    return NextResponse.json(row);
  } catch (e) {
    console.error("[POST /api/altri-ingressi]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
