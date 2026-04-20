import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const round2 = (n: number) => Math.round(n * 100) / 100;

// GET ?anno=2026 → { anno, refundReserve }
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const anno = parseInt(
    searchParams.get("anno") || String(new Date().getFullYear()),
  );
  const row = await prisma.fareHarborConfig.findUnique({
    where: { anno },
  });
  return NextResponse.json(row ?? { anno, refundReserve: 0 });
}

// PUT body: { anno, refundReserve }
export async function PUT(request: Request) {
  const body = await request.json();
  const anno = parseInt(body.anno);
  if (!anno) {
    return NextResponse.json({ error: "anno non valido" }, { status: 400 });
  }
  const refundReserve = round2(parseFloat(String(body.refundReserve)) || 0);
  const row = await prisma.fareHarborConfig.upsert({
    where: { anno },
    create: { anno, refundReserve },
    update: { refundReserve },
  });
  return NextResponse.json(row);
}
