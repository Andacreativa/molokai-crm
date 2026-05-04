import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const before = await prisma.incassoFareHarbor.findUnique({
      where: { id: parseInt(id) },
    });
    if (!before) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const data: {
      data?: Date;
      mese?: number;
      anno?: number;
      netto?: number;
      fee?: number;
      lordo?: number;
      note?: string | null;
    } = {};
    if (body.data !== undefined) {
      const d = new Date(body.data);
      if (!isNaN(d.getTime())) {
        data.data = d;
        data.mese = d.getMonth() + 1;
        data.anno = d.getFullYear();
      }
    }
    if (body.netto !== undefined)
      data.netto = parseFloat(String(body.netto)) || 0;
    if (body.fee !== undefined)
      data.fee = Math.abs(parseFloat(String(body.fee)) || 0);
    if (body.lordo !== undefined)
      data.lordo = parseFloat(String(body.lordo)) || 0;
    if (body.note !== undefined) data.note = body.note || null;
    const row = await prisma.incassoFareHarbor.update({
      where: { id: parseInt(id) },
      data,
    });
    return NextResponse.json(row);
  } catch (e) {
    console.error("[PUT /api/incassi-fh-day/[id]]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await prisma.incassoFareHarbor.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[DELETE /api/incassi-fh-day/[id]]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
