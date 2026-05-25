import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const prodotti = await prisma.prodotto.findMany({
    where: { attivo: true },
    orderBy: [{ ordine: "asc" }, { nome: "asc" }],
  });
  return NextResponse.json(prodotti);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  // Assegna ordine = max(ordine) + 1 così il nuovo prodotto va in fondo.
  const last = await prisma.prodotto.findFirst({
    orderBy: { ordine: "desc" },
    select: { ordine: true },
  });
  const ordine = (last?.ordine ?? 0) + 1;
  const prodotto = await prisma.prodotto.create({
    data: { ...body, ordine },
  });
  return NextResponse.json(prodotto, { status: 201 });
}
