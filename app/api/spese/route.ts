import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const round2 = (n: number) => Math.round(n * 100) / 100;

// IVA recuperabile da importo lordo (IVA inclusa).
// Se non deducibile o aliquota=0, ritorna 0.
function computeIva(importo: number, aliquota: number, deducibile: boolean): number {
  if (!deducibile || aliquota <= 0) return 0;
  const rate = aliquota / 100;
  return round2((importo / (1 + rate)) * rate);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const anno = parseInt(
    searchParams.get("anno") || String(new Date().getFullYear()),
  );
  const mese = searchParams.get("mese");
  const categoria = searchParams.get("categoria");

  const where: { anno: number; mese?: number; categoria?: string } = { anno };
  if (mese) where.mese = parseInt(mese);
  if (categoria) where.categoria = categoria;

  const spese = await prisma.spesa.findMany({
    where,
    orderBy: [{ data: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(spese);
}

export async function POST(request: Request) {
  const body = await request.json();

  const data = body.data ? new Date(body.data) : new Date();
  const mese = body.mese ?? data.getMonth() + 1;
  const anno = body.anno ?? data.getFullYear();

  const importo = round2(parseFloat(String(body.importo)) || 0);
  const ivaDeducibile =
    body.ivaDeducibile !== undefined ? Boolean(body.ivaDeducibile) : true;
  const aliquotaIva =
    body.aliquotaIva !== undefined
      ? parseFloat(String(body.aliquotaIva)) || 0
      : 21;
  // Se il client manda ivaRecuperabile esplicito, usa quello; altrimenti calcola.
  const ivaRecuperabile =
    body.ivaRecuperabile !== undefined && body.ivaRecuperabile !== null
      ? round2(parseFloat(String(body.ivaRecuperabile)) || 0)
      : computeIva(importo, aliquotaIva, ivaDeducibile);

  const spesa = await prisma.spesa.create({
    data: {
      data,
      fornitore: body.fornitore,
      categoria: body.categoria || "Altro",
      descrizione: body.descrizione || null,
      importo,
      ivaDeducibile,
      aliquotaIva,
      ivaRecuperabile,
      mese,
      anno,
      ricevutaPath: body.ricevutaPath || null,
      note: body.note || null,
    },
  });
  return NextResponse.json(spesa);
}
