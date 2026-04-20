import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const gruppi = await prisma.gruppo.findMany({
    include: { sessioni: { orderBy: { data: "asc" } } },
    orderBy: { nome: "asc" },
  });
  return NextResponse.json(gruppi);
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
