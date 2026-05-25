import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const round2 = (n: number) => Math.round(n * 100) / 100;
const TIPI_VALIDI = new Set(["fisso", "percentuale"]);

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const costi = await prisma.costoProdotto.findMany({
    where: { prodottoId: Number(id) },
    orderBy: [{ id: "asc" }],
  });
  return NextResponse.json(costi);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const prodottoId = Number(id);
  const body = await req.json();
  const nome = String(body?.nome ?? "").trim();
  const tipo = String(body?.tipo ?? "").trim();
  const valore = round2(parseFloat(String(body?.valore ?? 0)) || 0);
  if (!nome || !TIPI_VALIDI.has(tipo)) {
    return NextResponse.json(
      { error: "nome e tipo (fisso|percentuale) richiesti" },
      { status: 400 },
    );
  }
  const costo = await prisma.costoProdotto.create({
    data: { prodottoId, nome, tipo, valore },
  });
  return NextResponse.json(costo, { status: 201 });
}
