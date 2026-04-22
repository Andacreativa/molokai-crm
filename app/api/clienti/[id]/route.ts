import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const cliente = await prisma.cliente.update({
    where: { id: parseInt(id) },
    data: {
      ...(body.nome !== undefined && { nome: body.nome }),
      ...(body.cognome !== undefined && { cognome: body.cognome || null }),
      ...(body.dni !== undefined && { dni: body.dni || null }),
      ...(body.tipo !== undefined && { tipo: body.tipo || "privato" }),
      ...(body.paese !== undefined && { paese: body.paese }),
      ...(body.email !== undefined && { email: body.email || null }),
      ...(body.telefono !== undefined && { telefono: body.telefono || null }),
      ...(body.partitaIva !== undefined && {
        partitaIva: body.partitaIva || null,
      }),
      ...(body.via !== undefined && { via: body.via || null }),
      ...(body.cap !== undefined && { cap: body.cap || null }),
      ...(body.citta !== undefined && { citta: body.citta || null }),
      ...(body.provincia !== undefined && {
        provincia: body.provincia || null,
      }),
      ...(body.iban !== undefined && { iban: body.iban || null }),
      ...(body.tipoImposta !== undefined && {
        tipoImposta: body.tipoImposta || "IVA 21%",
      }),
      ...(body.note !== undefined && { note: body.note || null }),
    },
  });
  return NextResponse.json(cliente);
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.cliente.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ ok: true });
}
