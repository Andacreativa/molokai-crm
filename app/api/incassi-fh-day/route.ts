import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const annoParam = searchParams.get("anno");
    const where: { anno?: number } = {};
    if (annoParam) where.anno = parseInt(annoParam, 10);
    const rows = await prisma.incassoFareHarbor.findMany({
      where,
      orderBy: { data: "asc" },
    });
    return NextResponse.json(rows);
  } catch (e) {
    console.error("[GET /api/incassi-fh-day]", e);
    return NextResponse.json([], { status: 500 });
  }
}

// POST può essere:
// - { righe: [{data, importo, ...}] } → batch upsert (per import CSV)
// - { data, importo, ... } → upsert singolo (per inserimento manuale)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const items = Array.isArray(body.righe) ? body.righe : [body];
    let ok = 0;
    const errors: string[] = [];
    for (const r of items) {
      try {
        if (!r.data) {
          errors.push(`riga senza data`);
          continue;
        }
        const d = new Date(r.data);
        if (isNaN(d.getTime())) {
          errors.push(`data non valida: ${r.data}`);
          continue;
        }
        const netto = Number(r.netto ?? r.importo ?? 0) || 0;
        const fee = Math.abs(Number(r.fee ?? 0) || 0);
        const lordo = Number(r.lordo ?? 0) || 0;
        await prisma.incassoFareHarbor.upsert({
          where: { data: d },
          create: {
            data: d,
            mese: d.getMonth() + 1,
            anno: d.getFullYear(),
            netto,
            fee,
            lordo,
            note: r.note || null,
          },
          update: {
            netto,
            fee,
            lordo,
            mese: d.getMonth() + 1,
            anno: d.getFullYear(),
            ...(r.note !== undefined && { note: r.note || null }),
          },
        });
        ok++;
      } catch (e) {
        errors.push(`${r.data}: ${String(e)}`);
      }
    }
    if (items.length === 1 && ok === 1) {
      // Restituisce il singolo record creato/aggiornato per le chiamate puntuali
      const d = new Date(items[0].data);
      const created = await prisma.incassoFareHarbor.findUnique({
        where: { data: d },
      });
      return NextResponse.json(created);
    }
    return NextResponse.json({ ok, errors });
  } catch (e) {
    console.error("[POST /api/incassi-fh-day]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
