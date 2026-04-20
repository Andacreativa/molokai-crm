import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const anno = parseInt(
    searchParams.get("anno") || String(new Date().getFullYear()),
  );
  const rows = await prisma.prenotazioneFareHarbor.findMany({
    where: { anno },
    orderBy: { mese: "asc" },
  });
  return NextResponse.json(rows);
}

// POST upsert per (anno, mese).
// Body: { anno, mese, sett1, sett2, sett3, sett4 }
// Totale calcolato server-side.
export async function POST(request: Request) {
  const body = await request.json();
  const anno = parseInt(body.anno);
  const mese = parseInt(body.mese);
  if (!anno || !mese || mese < 1 || mese > 12) {
    return NextResponse.json({ error: "anno/mese non validi" }, { status: 400 });
  }
  const sett1 = parseFloat(body.sett1) || 0;
  const sett2 = parseFloat(body.sett2) || 0;
  const sett3 = parseFloat(body.sett3) || 0;
  const sett4 = parseFloat(body.sett4) || 0;
  const totale = round2(sett1 + sett2 + sett3 + sett4);

  const row = await prisma.prenotazioneFareHarbor.upsert({
    where: { anno_mese: { anno, mese } },
    create: { anno, mese, sett1, sett2, sett3, sett4, totale },
    update: { sett1, sett2, sett3, sett4, totale },
  });
  return NextResponse.json(row);
}
