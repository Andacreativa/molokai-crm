import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// Chiave intera arbitraria per il pg_advisory_xact_lock — serve solo a
// serializzare le creazioni di socio che richiedono auto-matricola.
// Stesso valore usato sempre, qualsiasi int costante va bene.
const MATRICOLA_LOCK_KEY = 84211123;

// Genera la prossima matricola progressiva per l'anno passato dentro la
// transazione corrente (tx). Va chiamata SOLO dopo aver acquisito il lock.
async function nextMatricolaIn(
  tx: Prisma.TransactionClient,
  anno: number,
): Promise<string> {
  const prefix = `MOL-${anno}-`;
  const last = await tx.socio.findFirst({
    where: { matricola: { startsWith: prefix } },
    orderBy: { matricola: "desc" },
    select: { matricola: true },
  });
  let next = 1;
  if (last?.matricola) {
    const m = last.matricola.match(/-(\d+)$/);
    if (m) next = parseInt(m[1]) + 1;
  }
  return `${prefix}${String(next).padStart(3, "0")}`;
}

export async function GET() {
  const soci = await prisma.socio.findMany({
    include: { pagamentiMensili: true },
    orderBy: [{ cognome: "asc" }, { nome: "asc" }],
  });
  return NextResponse.json(soci);
}

export async function POST(request: Request) {
  const body = await request.json();
  const matricolaGratuita = Boolean(body.matricolaGratuita);
  const customMatricola =
    body.matricola && String(body.matricola).trim()
      ? String(body.matricola).trim()
      : null;

  const baseData = {
    nome: body.nome,
    cognome: body.cognome || null,
    dni: body.dni || null,
    cellulare: body.cellulare || null,
    email: body.email || null,
    piano: body.piano || "PLAN VARADA",
    pianoDescrizione: body.pianoDescrizione || null,
    prezzoPiano: parseFloat(body.prezzoPiano) || 0,
    pagamento: body.pagamento || "MENSILE",
    iban: body.iban || null,
    stato: body.stato || "ATTIVO",
    matricolaImporto: matricolaGratuita
      ? 0
      : body.matricolaImporto !== undefined && body.matricolaImporto !== ""
        ? parseFloat(body.matricolaImporto) || 0
        : 50,
    matricolaGratuita,
    matricolaPagata: Boolean(body.matricolaPagata),
    matricolaMesePagamento: body.matricolaMesePagamento || null,
    note: body.note || null,
  };

  // Quando l'utente fornisce una matricola custom non serve il lock.
  // Quando l'auto-genera, serializza con un advisory lock Postgres che dura
  // per la transazione, così richieste concorrenti calcolano il "next"
  // una alla volta (no race condition).
  const socio = customMatricola
    ? await prisma.socio.create({
        data: { ...baseData, matricola: customMatricola },
        include: { pagamentiMensili: true },
      })
    : await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${MATRICOLA_LOCK_KEY})`;
        const matricola = await nextMatricolaIn(tx, new Date().getFullYear());
        return tx.socio.create({
          data: { ...baseData, matricola },
          include: { pagamentiMensili: true },
        });
      });

  return NextResponse.json(socio);
}
