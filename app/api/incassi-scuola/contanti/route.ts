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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const anno = searchParams.get("anno");
  const mese = searchParams.get("mese");

  const where: { anno?: number; mese?: number } = {};
  if (anno) where.anno = parseInt(anno);
  if (mese) where.mese = parseInt(mese);

  const rows = await prisma.incassoContanti.findMany({
    where,
    orderBy: { data: "asc" },
  });
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const body = await request.json();
  const data = parseData(String(body.data ?? ""));
  if (!data) {
    return NextResponse.json({ error: "Data non valida" }, { status: 400 });
  }
  const importo = round2(parseFloat(String(body.importo ?? 0)) || 0);
  const descrizione =
    typeof body.descrizione === "string" && body.descrizione.trim()
      ? body.descrizione.trim()
      : null;

  const row = await prisma.incassoContanti.create({
    data: {
      data,
      mese: data.getMonth() + 1,
      anno: data.getFullYear(),
      importo,
      descrizione,
    },
  });
  return NextResponse.json(row);
}
