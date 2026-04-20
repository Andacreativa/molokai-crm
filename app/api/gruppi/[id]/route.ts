import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const gruppo = await prisma.gruppo.findUnique({
    where: { id: parseInt(id) },
    include: { sessioni: { orderBy: { data: "asc" } } },
  });
  if (!gruppo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(gruppo);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const data: Record<string, unknown> = {};
  if (body.nome !== undefined) data.nome = body.nome;
  if (body.tipo !== undefined) data.tipo = body.tipo;
  if (body.contatto !== undefined) data.contatto = body.contatto || null;
  if (body.email !== undefined) data.email = body.email || null;
  if (body.telefono !== undefined) data.telefono = body.telefono || null;
  if (body.note !== undefined) data.note = body.note || null;

  const gruppo = await prisma.gruppo.update({
    where: { id: parseInt(id) },
    data,
    include: { sessioni: { orderBy: { data: "asc" } } },
  });
  return NextResponse.json(gruppo);
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // Cascade configurato sullo schema → elimina anche le sessioni
  await prisma.gruppo.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ ok: true });
}
