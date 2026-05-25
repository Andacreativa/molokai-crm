import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const annoParam = searchParams.get("anno");
  const canale = searchParams.get("canale");

  // Build where filter additivamente: anno + canale entrambi opzionali. Se
  // non passi anno, ritorna tutte le vendite (utile per dedup cross-anno
  // su import CSV per canale).
  const where: {
    data?: { gte: Date; lt: Date };
    canale?: string;
  } = {};
  if (annoParam) {
    const anno = Number(annoParam);
    where.data = {
      gte: new Date(`${anno}-01-01`),
      lt: new Date(`${anno + 1}-01-01`),
    };
  }
  if (canale) where.canale = canale;

  const vendite = await prisma.venditaProdotto.findMany({
    where,
    include: { prodotto: true },
    orderBy: { data: "desc" },
  });
  return NextResponse.json(vendite);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const vendita = await prisma.venditaProdotto.create({
    data: {
      ...body,
      data: new Date(body.data),
    },
    include: { prodotto: true },
  });
  return NextResponse.json(vendita, { status: 201 });
}
