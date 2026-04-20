import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const socio = await prisma.socio.findUnique({
    where: { id: parseInt(id) },
    include: { pagamentiMensili: true, buoni: true },
  });
  if (!socio) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(socio);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const socio = await prisma.socio.update({
    where: { id: parseInt(id) },
    data: {
      ...(body.nome !== undefined && { nome: body.nome }),
      ...(body.cognome !== undefined && { cognome: body.cognome || null }),
      ...(body.dni !== undefined && { dni: body.dni || null }),
      ...(body.cellulare !== undefined && {
        cellulare: body.cellulare || null,
      }),
      ...(body.email !== undefined && { email: body.email || null }),
      ...(body.piano !== undefined && { piano: body.piano }),
      ...(body.pianoDescrizione !== undefined && {
        pianoDescrizione: body.pianoDescrizione || null,
      }),
      ...(body.prezzoPiano !== undefined && {
        prezzoPiano: parseFloat(body.prezzoPiano) || 0,
      }),
      ...(body.pagamento !== undefined && { pagamento: body.pagamento }),
      ...(body.iban !== undefined && { iban: body.iban || null }),
      ...(body.stato !== undefined && { stato: body.stato }),
      ...(body.matricola !== undefined && {
        matricola: body.matricola || null,
      }),
      ...(body.matricolaImporto !== undefined && {
        matricolaImporto: parseFloat(body.matricolaImporto) || 0,
      }),
      ...(body.matricolaGratuita !== undefined && {
        matricolaGratuita: Boolean(body.matricolaGratuita),
        // Quando si attiva "gratuita", azzera l'importo automaticamente
        ...(Boolean(body.matricolaGratuita) && { matricolaImporto: 0 }),
      }),
      ...(body.matricolaPagata !== undefined && {
        matricolaPagata: Boolean(body.matricolaPagata),
      }),
      ...(body.matricolaMesePagamento !== undefined && {
        matricolaMesePagamento: body.matricolaMesePagamento || null,
      }),
      ...(body.note !== undefined && { note: body.note || null }),
    },
    include: { pagamentiMensili: true },
  });
  return NextResponse.json(socio);
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.socio.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ ok: true });
}
