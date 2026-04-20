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

// PUT: aggiorna singola riga. Campi accettati: data, totaleGiorno, totVendite, rimborsi.
// Se data cambia, mese/anno vengono ricalcolati automaticamente.
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
  if (body.totaleGiorno !== undefined) {
    data.totaleGiorno = round2(parseFloat(String(body.totaleGiorno)) || 0);
  }
  if (body.totVendite !== undefined) {
    data.totVendite = round2(parseFloat(String(body.totVendite)) || 0);
  }
  if (body.rimborsi !== undefined) {
    data.rimborsi = round2(parseFloat(String(body.rimborsi)) || 0);
  }

  try {
    const row = await prisma.pagamentoInScuola.update({
      where: { id: rowId },
      data,
    });
    return NextResponse.json(row);
  } catch (e) {
    // Unique constraint violation sulla data
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Unique constraint") || msg.includes("P2002")) {
      return NextResponse.json(
        { error: "Esiste già una riga con questa data" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.pagamentoInScuola.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ ok: true });
}
