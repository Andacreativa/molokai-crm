import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const row = await prisma.altroIngresso.findUnique({
      where: { id: parseInt(id) },
    });
    if (!row)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(row);
  } catch (e) {
    console.error("[GET /api/altri-ingressi/[id]]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const row = await prisma.altroIngresso.update({
      where: { id: parseInt(id) },
      data: {
        ...(body.fonte !== undefined && { fonte: body.fonte }),
        ...(body.descrizione !== undefined && {
          descrizione: body.descrizione || null,
        }),
        ...(body.mese !== undefined && { mese: body.mese }),
        ...(body.anno !== undefined && { anno: body.anno }),
        ...(body.importo !== undefined && {
          importo: parseFloat(body.importo) || 0,
        }),
        ...(body.incassato !== undefined && {
          incassato: Boolean(body.incassato),
        }),
        ...(body.dataIncasso !== undefined && {
          dataIncasso: body.dataIncasso ? new Date(body.dataIncasso) : null,
        }),
      },
    });
    return NextResponse.json(row);
  } catch (e) {
    console.error("[PUT /api/altri-ingressi/[id]]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await prisma.altroIngresso.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[DELETE /api/altri-ingressi/[id]]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
