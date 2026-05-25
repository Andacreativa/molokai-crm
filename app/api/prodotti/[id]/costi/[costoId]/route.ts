import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const round2 = (n: number) => Math.round(n * 100) / 100;
const TIPI_VALIDI = new Set(["fisso", "percentuale"]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; costoId: string }> },
) {
  const { costoId } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body?.nome === "string") {
    const n = body.nome.trim();
    if (n) data.nome = n;
  }
  if (typeof body?.tipo === "string") {
    const t = body.tipo.trim();
    if (TIPI_VALIDI.has(t)) data.tipo = t;
  }
  if (body?.valore !== undefined) {
    data.valore = round2(parseFloat(String(body.valore)) || 0);
  }
  const costo = await prisma.costoProdotto.update({
    where: { id: Number(costoId) },
    data,
  });
  return NextResponse.json(costo);
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string; costoId: string }> },
) {
  const { costoId } = await params;
  await prisma.costoProdotto.delete({ where: { id: Number(costoId) } });
  return NextResponse.json({ ok: true });
}
