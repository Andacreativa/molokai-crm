import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const round2 = (n: number) => Math.round(n * 100) / 100;
const GYG_COMMISSION_RATE = 0.25;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const anno = parseInt(
    searchParams.get("anno") || String(new Date().getFullYear()),
  );
  const rows = await prisma.prenotazioneGetYourGuide.findMany({
    where: { anno },
    orderBy: { mese: "asc" },
  });
  return NextResponse.json(rows);
}

// POST upsert per (anno, mese).
// Body: { anno, mese, lordo }
// Commissioni = lordo * 25%, Netto = lordo - commissioni.
export async function POST(request: Request) {
  const body = await request.json();
  const anno = parseInt(body.anno);
  const mese = parseInt(body.mese);
  if (!anno || !mese || mese < 1 || mese > 12) {
    return NextResponse.json({ error: "anno/mese non validi" }, { status: 400 });
  }
  const lordo = parseFloat(body.lordo) || 0;
  const commissioni = round2(lordo * GYG_COMMISSION_RATE);
  const netto = round2(lordo - commissioni);

  const row = await prisma.prenotazioneGetYourGuide.upsert({
    where: { anno_mese: { anno, mese } },
    create: { anno, mese, lordo, commissioni, netto },
    update: { lordo, commissioni, netto },
  });
  return NextResponse.json(row);
}
