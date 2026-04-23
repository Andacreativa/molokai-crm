import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const annoParam = searchParams.get("anno");
  const anno = annoParam ? parseInt(annoParam) : null;

  const gruppi = await prisma.gruppo.findMany({
    include: { sessioni: { orderBy: { data: "asc" } } },
    orderBy: { nome: "asc" },
  });

  // Per ogni gruppo aggiunge totaleIncassato + daIncassare.
  // Se ?anno= è passato, filtra le sessioni su quell'anno, altrimenti tutte.
  const withTotals = gruppi.map((g) => {
    const sessioni =
      anno !== null ? g.sessioni.filter((s) => s.anno === anno) : g.sessioni;
    const totaleIncassato = round2(
      sessioni.filter((s) => s.incassato).reduce((a, b) => a + b.totale, 0),
    );
    const daIncassare = round2(
      sessioni.filter((s) => !s.incassato).reduce((a, b) => a + b.totale, 0),
    );
    return { ...g, totaleIncassato, daIncassare };
  });

  return NextResponse.json(withTotals);
}

export async function POST(request: Request) {
  const body = await request.json();
  const gruppo = await prisma.gruppo.create({
    data: {
      nome: body.nome,
      tipo: body.tipo || "scuola",
      contatto: body.contatto || null,
      email: body.email || null,
      telefono: body.telefono || null,
      note: body.note || null,
    },
    include: { sessioni: true },
  });
  return NextResponse.json(gruppo);
}
