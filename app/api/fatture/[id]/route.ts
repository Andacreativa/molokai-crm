import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RigaInput {
  descrizione: string;
  quantita: number;
  prezzoUnitario: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const fattura = await prisma.fattura.findUnique({
    where: { id: parseInt(id) },
    include: { cliente: true },
  });
  if (!fattura) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(fattura);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const fatturaId = parseInt(id);
  const body = await request.json();

  const before = await prisma.fattura.findUnique({ where: { id: fatturaId } });
  if (!before) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};

  if (body.numero !== undefined) data.numero = body.numero || null;
  if (body.data !== undefined)
    data.data = body.data ? new Date(body.data) : null;
  if (body.scadenza !== undefined)
    data.scadenza = body.scadenza ? new Date(body.scadenza) : null;
  if (body.clienteId !== undefined)
    data.clienteId = body.clienteId ? parseInt(body.clienteId) : null;
  if (body.pagato !== undefined) data.pagato = Boolean(body.pagato);
  if (body.metodoPagamento !== undefined)
    data.metodoPagamento = body.metodoPagamento || null;
  if (body.mese !== undefined) data.mese = parseInt(body.mese);
  if (body.anno !== undefined) data.anno = parseInt(body.anno);
  if (body.note !== undefined) data.note = body.note || null;

  // Se cambiano righe o iva, ricalcolo baseImponibile e totale
  const righeChanged = body.righe !== undefined;
  const ivaChanged = body.iva !== undefined;
  if (righeChanged || ivaChanged) {
    const righe: RigaInput[] = righeChanged
      ? Array.isArray(body.righe)
        ? body.righe
        : []
      : JSON.parse(before.righe || "[]");
    const iva = ivaChanged ? Number(body.iva) : before.iva;
    const baseImponibile = round2(
      righe.reduce(
        (s, r) =>
          s + (Number(r.quantita) || 0) * (Number(r.prezzoUnitario) || 0),
        0,
      ),
    );
    const totale = round2(baseImponibile * (1 + iva / 100));

    if (righeChanged) data.righe = JSON.stringify(righe);
    data.iva = iva;
    data.baseImponibile = baseImponibile;
    data.totale = totale;
  }

  const fattura = await prisma.fattura.update({
    where: { id: fatturaId },
    data,
    include: { cliente: true },
  });
  return NextResponse.json(fattura);
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.fattura.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ ok: true });
}
