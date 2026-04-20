import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sessioni = await prisma.sessioneGruppo.findMany({
    where: { gruppoId: parseInt(id) },
    orderBy: { data: "asc" },
  });
  return NextResponse.json(sessioni);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const gruppoId = parseInt(id);
  const body = await request.json();

  const data = body.data ? new Date(body.data) : new Date();
  const partecipanti = parseInt(String(body.partecipanti)) || 0;
  const prezzoPP = round2(parseFloat(String(body.prezzoPP)) || 0);
  const totale = round2(partecipanti * prezzoPP);

  const sessione = await prisma.sessioneGruppo.create({
    data: {
      gruppoId,
      data,
      mese: data.getMonth() + 1,
      anno: data.getFullYear(),
      partecipanti,
      prezzoPP,
      totale,
      note: body.note || null,
    },
  });
  return NextResponse.json(sessione);
}
