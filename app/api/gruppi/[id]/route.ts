import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const round2 = (n: number) => Math.round(n * 100) / 100;

function normalizeScaglioni(input: unknown):
  | { da: number; a: number; prezzo: number }[]
  | null {
  if (!Array.isArray(input)) return null;
  const out: { da: number; a: number; prezzo: number }[] = [];
  for (const r of input) {
    if (!r || typeof r !== "object") continue;
    const row = r as Record<string, unknown>;
    const da = parseInt(String(row.da));
    const a = parseInt(String(row.a));
    const prezzo = parseFloat(String(row.prezzo));
    if (
      Number.isFinite(da) &&
      Number.isFinite(a) &&
      Number.isFinite(prezzo) &&
      da >= 1 &&
      a >= da &&
      prezzo > 0
    ) {
      out.push({ da, a, prezzo: round2(prezzo) });
    }
  }
  return out.length === 0 ? null : out.sort((x, y) => x.da - y.da);
}

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
  if (body.prezzoPP !== undefined) {
    const n = parseFloat(String(body.prezzoPP));
    data.prezzoPP =
      Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
  }
  if (body.prezziScaglioni !== undefined) {
    // null/array vuoto/[] → rimuove gli scaglioni; array valido → salva.
    data.prezziScaglioni = normalizeScaglioni(body.prezziScaglioni) ?? null;
  }
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
