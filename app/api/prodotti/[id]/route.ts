import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const prodotto = await prisma.prodotto.update({
    where: { id: Number(id) },
    data: body,
  });
  return NextResponse.json(prodotto);
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.prodotto.update({
    where: { id: Number(id) },
    data: { attivo: false },
  });
  return NextResponse.json({ ok: true });
}
