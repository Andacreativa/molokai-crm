import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface CheckRow {
  fornitore: string;
  importo: number;
  mese: number;
  anno?: number;
}

const normalize = (f: string) => f.toLowerCase().trim();
const key = (fornitore: string, importo: number, mese: number, anno: number) =>
  `${normalize(fornitore)}|${importo.toFixed(2)}|${mese}|${anno}`;

// POST body: { rows: CheckRow[] }
// Risponde: { duplicati: boolean[] } — stesso ordine di input
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rows: CheckRow[] = Array.isArray(body.rows) ? body.rows : [];
    if (rows.length === 0) return NextResponse.json({ duplicati: [] });

    const anni = Array.from(
      new Set(rows.map((r) => r.anno ?? new Date().getFullYear())),
    );
    const existing = await prisma.spesa.findMany({
      where: { anno: { in: anni } },
      select: { fornitore: true, importo: true, mese: true, anno: true },
    });
    const set = new Set(
      existing.map((s) => key(s.fornitore, s.importo, s.mese, s.anno)),
    );

    const duplicati = rows.map((r) =>
      set.has(
        key(
          r.fornitore,
          Number(r.importo),
          r.mese,
          r.anno ?? new Date().getFullYear(),
        ),
      ),
    );
    return NextResponse.json({ duplicati });
  } catch (e) {
    console.error("[POST /api/spese/check-duplicati]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
