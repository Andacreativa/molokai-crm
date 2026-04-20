import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const buoni = await prisma.buono.findMany({
    orderBy: [{ createdAt: "desc" }],
  });
  return NextResponse.json(buoni);
}

export async function POST(request: Request) {
  const body = await request.json();
  const buono = await prisma.buono.create({
    data: {
      nome: body.nome,
      cognome: body.cognome || null,
      cellulare: body.cellulare || null,
      email: body.email || null,
      socioId: body.socioId ? parseInt(body.socioId) : null,
      tipoBuono: body.tipoBuono || "BONO CLASE",
      prezzoBuono: parseFloat(body.prezzoBuono) || 0,
      pagato: Boolean(body.pagato),
      mesePagamento: body.mesePagamento || null,
      stato: body.stato || "Attivo",
      sessioniTotali:
        body.sessioniTotali === null ||
        body.sessioniTotali === undefined ||
        body.sessioniTotali === ""
          ? null
          : parseInt(body.sessioniTotali),
      sessioniUsate: parseInt(body.sessioniUsate) || 0,
      note: body.note || null,
    },
  });
  return NextResponse.json(buono);
}
