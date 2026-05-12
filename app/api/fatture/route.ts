import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RigaInput {
  descrizione: string;
  quantita: number;
  prezzoUnitario: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const anno = parseInt(
    searchParams.get("anno") || String(new Date().getFullYear()),
  );
  const fatture = await prisma.fattura.findMany({
    where: { anno },
    include: { cliente: true },
    orderBy: [{ data: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(fatture);
}

export async function POST(request: Request) {
  const body = await request.json();

  const dataFattura = body.data ? new Date(body.data) : new Date();
  const anno = body.anno ?? dataFattura.getFullYear();
  const mese = body.mese ?? dataFattura.getMonth() + 1;

  // Scadenza default: data + 30 giorni
  const scadenza = body.scadenza
    ? new Date(body.scadenza)
    : new Date(dataFattura.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Righe + totali. Se prezzoConIva è true, i prezzoUnitario delle righe
  // sono lordi (IVA inclusa) → ricaviamo base dividendo per (1 + iva%).
  const righe: RigaInput[] = Array.isArray(body.righe) ? body.righe : [];
  const prezzoConIva = Boolean(body.prezzoConIva);
  const iva = Number(body.iva ?? 21);
  const sommaRighe = righe.reduce(
    (s, r) => s + (Number(r.quantita) || 0) * (Number(r.prezzoUnitario) || 0),
    0,
  );
  const baseImponibile = prezzoConIva
    ? round2(sommaRighe / (1 + iva / 100))
    : round2(sommaRighe);
  const totale = prezzoConIva
    ? round2(sommaRighe)
    : round2(baseImponibile * (1 + iva / 100));

  // Numero auto: F-{N}/{ANNO}, con N contatore annuale
  let numero = body.numero as string | undefined;
  if (!numero) {
    const count = await prisma.fattura.count({ where: { anno } });
    numero = `F-${count + 1}/${anno}`;
  }

  const fattura = await prisma.fattura.create({
    data: {
      numero,
      data: dataFattura,
      scadenza,
      clienteId: body.clienteId ? parseInt(body.clienteId) : null,
      righe: JSON.stringify(righe),
      prezzoConIva,
      baseImponibile,
      iva,
      totale,
      pagato: Boolean(body.pagato),
      metodoPagamento: body.metodoPagamento || null,
      mese,
      anno,
      note: body.note || null,
    },
    include: { cliente: true },
  });
  return NextResponse.json(fattura);
}
