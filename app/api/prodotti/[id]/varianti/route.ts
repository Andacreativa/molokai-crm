import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const varianti = await prisma.prodottoVariante.findMany({
    where: { prodottoId: Number(id) },
    orderBy: [{ ordine: "asc" }, { id: "asc" }],
  });
  return NextResponse.json(varianti);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const prodottoId = Number(id);
  const body = await req.json();
  const nome = String(body?.nome ?? "").trim();
  const prezzoVendita = round2(parseFloat(String(body?.prezzoVendita ?? 0)) || 0);
  if (!nome) {
    return NextResponse.json({ error: "nome richiesto" }, { status: 400 });
  }
  // Assegna ordine = max(ordine) + 1 nelle varianti dello stesso prodotto
  const last = await prisma.prodottoVariante.findFirst({
    where: { prodottoId },
    orderBy: { ordine: "desc" },
    select: { ordine: true },
  });
  const ordine = (last?.ordine ?? 0) + 1;
  const variante = await prisma.prodottoVariante.create({
    data: { prodottoId, nome, prezzoVendita, ordine },
  });
  return NextResponse.json(variante, { status: 201 });
}
