import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; varianteId: string }> },
) {
  const { varianteId } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body?.nome === "string") {
    const n = body.nome.trim();
    if (n) data.nome = n;
  }
  if (body?.prezzoVendita !== undefined) {
    data.prezzoVendita = round2(parseFloat(String(body.prezzoVendita)) || 0);
  }
  if (body?.ordine !== undefined) {
    const o = Number(body.ordine);
    if (Number.isFinite(o)) data.ordine = o;
  }
  const variante = await prisma.prodottoVariante.update({
    where: { id: Number(varianteId) },
    data,
  });
  return NextResponse.json(variante);
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string; varianteId: string }> },
) {
  const { varianteId } = await params;
  await prisma.prodottoVariante.delete({
    where: { id: Number(varianteId) },
  });
  return NextResponse.json({ ok: true });
}
