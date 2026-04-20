import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const round2 = (n: number) => Math.round(n * 100) / 100;

// Calcola costoMensile da costo + cadenza
function computeCostoMensile(costo: number, cadenza: string): number {
  const c = (cadenza || "mensile").toLowerCase();
  if (c === "annuale") return round2(costo / 12);
  if (c === "trimestrale") return round2(costo / 3);
  return round2(costo);
}

export async function GET() {
  const rows = await prisma.spesaFissa.findMany({
    orderBy: [{ ordine: "asc" }, { tipo: "asc" }],
  });
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const body = await request.json();
  const costo = round2(parseFloat(String(body.costo)) || 0);
  const cadenza = body.cadenza || "mensile";
  const costoMensile = computeCostoMensile(costo, cadenza);
  const row = await prisma.spesaFissa.create({
    data: {
      tipo: body.tipo,
      categoria: body.categoria || null,
      cadenza,
      dataPagamento: body.dataPagamento || "",
      costo,
      costoMensile,
      ordine: parseInt(String(body.ordine ?? 0)) || 0,
      attiva: body.attiva !== undefined ? Boolean(body.attiva) : true,
      note: body.note || null,
    },
  });
  return NextResponse.json(row);
}
