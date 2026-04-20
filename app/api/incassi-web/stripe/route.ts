import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const anno = parseInt(
    searchParams.get("anno") || String(new Date().getFullYear()),
  );
  const rows = await prisma.prenotazioneStripe.findMany({
    where: { anno },
    orderBy: { mese: "asc" },
  });
  return NextResponse.json(rows);
}

// POST upsert per (anno, mese).
// Body: { anno, mese, lordo, commissioni, rimborsi, netto? }
// Se netto non fornito, calcolato come lordo - commissioni - rimborsi (UI manuale).
// Se fornito (import CSV con Σ Net per-transaction), usato as-is per evitare
// deriva floating-point.
export async function POST(request: Request) {
  const body = await request.json();
  const anno = parseInt(body.anno);
  const mese = parseInt(body.mese);
  if (!anno || !mese || mese < 1 || mese > 12) {
    return NextResponse.json({ error: "anno/mese non validi" }, { status: 400 });
  }
  const lordo = parseFloat(body.lordo) || 0;
  const commissioni = parseFloat(body.commissioni) || 0;
  const rimborsi = parseFloat(body.rimborsi) || 0;
  const netto =
    body.netto !== undefined && body.netto !== null
      ? round2(parseFloat(String(body.netto)) || 0)
      : round2(lordo - commissioni - rimborsi);

  const row = await prisma.prenotazioneStripe.upsert({
    where: { anno_mese: { anno, mese } },
    create: { anno, mese, lordo, commissioni, rimborsi, netto },
    update: { lordo, commissioni, rimborsi, netto },
  });
  return NextResponse.json(row);
}
