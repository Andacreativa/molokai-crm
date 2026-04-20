import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const soci = await prisma.socio.findMany({
    include: { pagamentiMensili: true },
    orderBy: [{ cognome: "asc" }, { nome: "asc" }],
  });
  return NextResponse.json(soci);
}

export async function POST(request: Request) {
  const body = await request.json();
  const matricolaGratuita = Boolean(body.matricolaGratuita);
  const socio = await prisma.socio.create({
    data: {
      nome: body.nome,
      cognome: body.cognome || null,
      dni: body.dni || null,
      cellulare: body.cellulare || null,
      email: body.email || null,
      piano: body.piano || "PLAN VARADA",
      pianoDescrizione: body.pianoDescrizione || null,
      prezzoPiano: parseFloat(body.prezzoPiano) || 0,
      pagamento: body.pagamento || "MENSILE",
      iban: body.iban || null,
      stato: body.stato || "ATTIVO",
      matricola: body.matricola || null,
      matricolaImporto: matricolaGratuita
        ? 0
        : body.matricolaImporto !== undefined && body.matricolaImporto !== ""
          ? parseFloat(body.matricolaImporto) || 0
          : 50,
      matricolaGratuita,
      matricolaPagata: Boolean(body.matricolaPagata),
      matricolaMesePagamento: body.matricolaMesePagamento || null,
      note: body.note || null,
    },
    include: { pagamentiMensili: true },
  });
  return NextResponse.json(socio);
}
