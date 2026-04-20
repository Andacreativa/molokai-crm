import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const round2 = (n: number) => Math.round(n * 100) / 100;

function computeCostoMensile(costo: number, cadenza: string): number {
  const c = (cadenza || "mensile").toLowerCase();
  if (c === "annuale") return round2(costo / 12);
  if (c === "trimestrale") return round2(costo / 3);
  return round2(costo);
}

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const row = await prisma.spesaFissa.findUnique({
    where: { id: parseInt(id) },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const rowId = parseInt(id);
  const before = await prisma.spesaFissa.findUnique({ where: { id: rowId } });
  if (!before) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = await request.json();

  const data: Record<string, unknown> = {};
  if (body.tipo !== undefined) data.tipo = body.tipo;
  if (body.categoria !== undefined) data.categoria = body.categoria || null;
  if (body.dataPagamento !== undefined)
    data.dataPagamento = body.dataPagamento || "";
  if (body.ordine !== undefined)
    data.ordine = parseInt(String(body.ordine)) || 0;
  if (body.attiva !== undefined) data.attiva = Boolean(body.attiva);
  if (body.note !== undefined) data.note = body.note || null;

  // Se cambia costo o cadenza, ricalcola costoMensile
  const newCosto =
    body.costo !== undefined
      ? round2(parseFloat(String(body.costo)) || 0)
      : before.costo;
  const newCadenza = body.cadenza !== undefined ? body.cadenza : before.cadenza;
  if (body.costo !== undefined || body.cadenza !== undefined) {
    data.costo = newCosto;
    data.cadenza = newCadenza;
    data.costoMensile = computeCostoMensile(newCosto, newCadenza);
  }

  const row = await prisma.spesaFissa.update({ where: { id: rowId }, data });
  return NextResponse.json(row);
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.spesaFissa.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ ok: true });
}
