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
  const tipo = searchParams.get("tipo"); // opzionale: fattura|proforma|preventivo
  const fatture = await prisma.fattura.findMany({
    where: { anno, ...(tipo ? { tipo } : {}) },
    include: { cliente: true },
    orderBy: [{ data: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(fatture);
}

const TIPI_VALIDI = new Set(["fattura", "proforma", "preventivo"]);
const PREFIX_NUMERO: Record<string, string> = {
  fattura: "F",
  proforma: "PRO",
  preventivo: "PRV",
};

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

  // Tipo: "fattura" (default), "proforma" o "preventivo"
  const tipoRaw = String(body.tipo ?? "fattura").toLowerCase().trim();
  const tipo = TIPI_VALIDI.has(tipoRaw) ? tipoRaw : "fattura";
  // Proforma e preventivi non hanno stato pagamento.
  const pagato = tipo === "fattura" ? Boolean(body.pagato) : false;
  // Stato workflow: solo per proforma/preventivo. Default "in_attesa";
  // se il client passa esplicitamente un valore valido lo usiamo, altrimenti
  // il default per le fatture vere è null.
  const STATI_VALIDI = new Set(["in_attesa", "accettato", "rifiutato"]);
  const statoRaw = typeof body.stato === "string" ? body.stato.trim() : "";
  const stato =
    tipo === "fattura"
      ? null
      : STATI_VALIDI.has(statoRaw)
        ? statoRaw
        : "in_attesa";
  // Riferimento al documento origine (solo se passato esplicitamente — es.
  // quando una fattura viene creata convertendo un proforma).
  const daDocumentoOrigine =
    typeof body.daDocumentoOrigine === "string" && body.daDocumentoOrigine.trim()
      ? body.daDocumentoOrigine.trim()
      : null;

  // Numero auto con prefix per tipo. Conteggio separato per tipo+anno
  // così proforma e preventivi hanno la loro serie.
  let numero = body.numero as string | undefined;
  if (!numero) {
    const count = await prisma.fattura.count({ where: { anno, tipo } });
    const prefix = PREFIX_NUMERO[tipo] ?? "F";
    numero = `${prefix}-${count + 1}/${anno}`;
  }

  const fattura = await prisma.fattura.create({
    data: {
      numero,
      data: dataFattura,
      scadenza,
      clienteId: body.clienteId ? parseInt(body.clienteId) : null,
      righe: JSON.stringify(righe),
      prezzoConIva,
      tipo,
      stato,
      daDocumentoOrigine,
      baseImponibile,
      iva,
      totale,
      pagato,
      metodoPagamento: body.metodoPagamento || null,
      mese,
      anno,
      note: body.note || null,
    },
    include: { cliente: true },
  });
  return NextResponse.json(fattura);
}
