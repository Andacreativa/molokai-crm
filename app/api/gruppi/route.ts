import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const round2 = (n: number) => Math.round(n * 100) / 100;

// Normalizza un array di scaglioni { da, a, prezzo } → riga valida o null se
// l'input non è un array sensato. Filtra righe non parseabili e ordina per `da`.
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const annoParam = searchParams.get("anno");
  const anno = annoParam ? parseInt(annoParam) : null;

  const gruppi = await prisma.gruppo.findMany({
    include: { sessioni: { orderBy: { data: "asc" } } },
    orderBy: { nome: "asc" },
  });

  // Per ogni gruppo aggiunge totaleIncassato + daIncassare.
  // Se ?anno= è passato, filtra le sessioni su quell'anno, altrimenti tutte.
  const withTotals = gruppi.map((g) => {
    const sessioni =
      anno !== null ? g.sessioni.filter((s) => s.anno === anno) : g.sessioni;
    const totaleIncassato = round2(
      sessioni.filter((s) => s.incassato).reduce((a, b) => a + b.totale, 0),
    );
    const daIncassare = round2(
      sessioni.filter((s) => !s.incassato).reduce((a, b) => a + b.totale, 0),
    );
    return { ...g, totaleIncassato, daIncassare };
  });

  return NextResponse.json(withTotals);
}

export async function POST(request: Request) {
  const body = await request.json();
  const prezzoRaw = parseFloat(String(body.prezzoPP ?? ""));
  const prezzoPP = Number.isFinite(prezzoRaw) && prezzoRaw > 0 ? round2(prezzoRaw) : null;
  const prezziScaglioni = normalizeScaglioni(body.prezziScaglioni);
  const gruppo = await prisma.gruppo.create({
    data: {
      nome: body.nome,
      tipo: body.tipo || "scuola",
      contatto: body.contatto || null,
      email: body.email || null,
      telefono: body.telefono || null,
      prezzoPP,
      prezziScaglioni: prezziScaglioni ?? undefined,
      note: body.note || null,
    },
    include: { sessioni: true },
  });
  return NextResponse.json(gruppo);
}
