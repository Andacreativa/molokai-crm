import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const FONTI = ["Recibo", "TPV", "Contanti", "Bonifico"] as const;
function normalizeFonte(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return (FONTI as readonly string[]).includes(s) ? s : null;
}

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const pagamenti = await prisma.pagamentoSocio.findMany({
    where: { socioId: parseInt(id) },
    orderBy: [{ anno: "desc" }, { mese: "asc" }],
  });
  return NextResponse.json(pagamenti);
}

// PUT dispatcher:
// - body.tipo === "matricola": aggiorna campi matricola su Socio
//   body: { tipo: "matricola", pagata: boolean, mesePagamento?: string, importo?: number }
// - altrimenti (default "mensile"): upsert su PagamentoSocio
//   body: { anno, mese, pagato, importo? }
// Ritorna sempre il Socio aggiornato con pagamentiMensili inclusi.
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const socioId = parseInt(id);
  const body = await request.json();

  if (body.tipo === "matricola") {
    const pagata = Boolean(body.pagata);
    const data: Record<string, unknown> = {
      matricolaPagata: pagata,
      matricolaMesePagamento: pagata ? body.mesePagamento || null : null,
    };
    if (body.importo !== undefined && body.importo !== "") {
      data.matricolaImporto = parseFloat(body.importo) || 0;
    }
    if (body.fontePagamento !== undefined) {
      // Quando matricola viene segnata pagata, la fonte è obbligatoria con
      // default "Recibo"; quando viene smarcata, restiamo neutri (null).
      const f = normalizeFonte(body.fontePagamento);
      data.matricolaFontePagamento = pagata ? (f ?? "Recibo") : null;
    } else if (pagata) {
      data.matricolaFontePagamento = "Recibo";
    } else {
      data.matricolaFontePagamento = null;
    }
    await prisma.socio.update({
      where: { id: socioId },
      data,
    });
  } else {
    const anno = parseInt(body.anno);
    const mese = parseInt(body.mese);
    const pagato = Boolean(body.pagato);
    const importo =
      body.importo === null || body.importo === undefined || body.importo === ""
        ? null
        : parseFloat(body.importo);

    if (!anno || !mese || mese < 1 || mese > 12) {
      return NextResponse.json(
        { error: "anno/mese non validi" },
        { status: 400 },
      );
    }

    // Fonte pagamento: default "Recibo" quando si segna pagato. Se l'utente
    // smarca, azzeriamo a null per non lasciare uno stato inconsistente.
    const fonteRaw = normalizeFonte(body.fontePagamento);
    const fontePagamento = pagato ? (fonteRaw ?? "Recibo") : null;

    await prisma.pagamentoSocio.upsert({
      where: { socioId_anno_mese: { socioId, anno, mese } },
      create: {
        socioId,
        anno,
        mese,
        pagato,
        importo,
        data: pagato ? new Date() : null,
        fontePagamento,
      },
      update: {
        pagato,
        importo,
        data: pagato ? new Date() : null,
        fontePagamento,
      },
    });
  }

  const socio = await prisma.socio.findUnique({
    where: { id: socioId },
    include: {
      pagamentiMensili: { orderBy: [{ anno: "desc" }, { mese: "asc" }] },
    },
  });
  return NextResponse.json(socio);
}
