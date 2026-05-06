import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const round2 = (n: number) => Math.round(n * 100) / 100;

function parseData(s: string): Date | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }
  const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    const d = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const rowId = parseInt(id);
  const body = await request.json();

  const data: Record<string, unknown> = {};

  if (body.data !== undefined) {
    const parsed = parseData(String(body.data));
    if (!parsed) {
      return NextResponse.json({ error: "Data non valida" }, { status: 400 });
    }
    data.data = parsed;
    data.mese = parsed.getMonth() + 1;
    data.anno = parsed.getFullYear();
  }
  if (body.importo !== undefined) {
    data.importo = round2(parseFloat(String(body.importo)) || 0);
  }
  if (body.descrizione !== undefined) {
    const s =
      typeof body.descrizione === "string" && body.descrizione.trim()
        ? body.descrizione.trim()
        : null;
    data.descrizione = s;
  }

  const row = await prisma.incassoContanti.update({
    where: { id: rowId },
    data,
  });
  return NextResponse.json(row);
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.incassoContanti.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ ok: true });
}
