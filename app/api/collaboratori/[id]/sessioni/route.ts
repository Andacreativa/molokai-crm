import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sessioni = await prisma.sessioneCollaboratore.findMany({
    where: { collaboratoreId: parseInt(id) },
    orderBy: { data: "asc" },
  });
  return NextResponse.json(sessioni);
}

// POST: crea sessione. Costo calcolato server-side da tariffa per tipo attività × ore.
// Se body.costo è esplicito, viene usato (override).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const collaboratoreId = parseInt(id);
  const body = await request.json();

  const data = body.data ? new Date(body.data) : new Date();
  const ore = round2(parseFloat(String(body.ore)) || 0);
  const tipoAttivita = String(body.tipoAttivita || "").trim();

  let costo = round2(parseFloat(String(body.costo)) || 0);
  if (!body.costo) {
    // Lookup tariffa
    const tariffa = await prisma.tariffaCollaboratore.findUnique({
      where: {
        collaboratoreId_tipoAttivita: { collaboratoreId, tipoAttivita },
      },
    });
    costo = round2(ore * (tariffa?.tariffaOraria ?? 0));
  }

  const sessione = await prisma.sessioneCollaboratore.create({
    data: {
      collaboratoreId,
      data,
      mese: data.getMonth() + 1,
      anno: data.getFullYear(),
      tipoAttivita,
      ore,
      costo,
      note: body.note || null,
    },
  });
  return NextResponse.json(sessione);
}
