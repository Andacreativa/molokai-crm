import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.pagamentoInScuola.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ ok: true });
}
