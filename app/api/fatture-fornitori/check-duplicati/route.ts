import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const round2 = (n: number) => Math.round(n * 100) / 100;

// Ritorna YYYY-MM-DD in UTC (ignora componente ora), tollerante a Date/ISO string.
function yyyymmdd(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

interface CheckPayload {
  fornitoreId: number | null;
  fileName?: string | null;
  importo: number;
  mese: number;
  anno: number;
  dataFattura?: string | null; // ISO
}

/**
 * POST /api/fatture-fornitori/check-duplicati
 *
 * Ritorna i potenziali duplicati per la fattura in fase di upload.
 * Severity:
 *   - "red"   : stesso fornitore + stesso file/numero (upload identico)
 *   - "amber" : stesso fornitore + stesso importo + stesso mese
 *   - "amber" : stessa data + stesso importo
 */
export async function POST(request: Request) {
  const body = (await request.json()) as CheckPayload;
  const {
    fornitoreId,
    fileName,
    importo,
    mese,
    anno,
    dataFattura,
  } = body;

  if (!fornitoreId && !dataFattura) {
    return NextResponse.json({ matches: [] });
  }

  const impRound = round2(importo);

  // Recuperiamo tutti i potenziali candidati:
  //   - tutte le fatture dello stesso fornitore (bounded, tipicamente << 100)
  //   - tutte le fatture con stessa data (per criterio 3, indipendente da fornitore)
  const [byFornitore, byData] = await Promise.all([
    fornitoreId
      ? prisma.fatturaFornitore.findMany({
          where: { fornitoreId },
          include: { fornitore: { select: { nome: true } } },
          omit: { fileData: true },
        })
      : Promise.resolve([]),
    dataFattura
      ? (async () => {
          const start = new Date(`${yyyymmdd(dataFattura)}T00:00:00.000Z`);
          const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
          return prisma.fatturaFornitore.findMany({
            where: { dataFattura: { gte: start, lt: end } },
            include: { fornitore: { select: { nome: true } } },
            omit: { fileData: true },
          });
        })()
      : Promise.resolve([]),
  ]);

  const seen = new Map<number, (typeof byFornitore)[number]>();
  for (const f of [...byFornitore, ...byData]) seen.set(f.id, f);

  const newDataStr = yyyymmdd(dataFattura);
  const fileNameLower = (fileName ?? "").toLowerCase().trim();

  const matches: {
    id: number;
    fornitore: string;
    fileName: string;
    mese: number;
    anno: number;
    importo: number;
    dataFattura: string | null;
    severity: "red" | "amber";
    criterio: string;
  }[] = [];

  for (const f of seen.values()) {
    let severity: "red" | "amber" | null = null;
    let criterio = "";

    const sameFornitore =
      fornitoreId != null && f.fornitoreId === fornitoreId;
    const sameFile =
      sameFornitore &&
      fileNameLower.length > 0 &&
      f.fileName.toLowerCase() === fileNameLower;

    if (sameFile) {
      severity = "red";
      criterio = "Stesso fornitore e stesso file/numero";
    } else if (
      sameFornitore &&
      round2(f.importo) === impRound &&
      f.mese === mese &&
      f.anno === anno
    ) {
      severity = "amber";
      criterio = "Stesso fornitore, importo e mese";
    } else if (
      newDataStr &&
      f.dataFattura &&
      yyyymmdd(f.dataFattura) === newDataStr &&
      round2(f.importo) === impRound
    ) {
      severity = "amber";
      criterio = "Stessa data e stesso importo";
    }

    if (severity) {
      matches.push({
        id: f.id,
        fornitore: f.fornitore?.nome ?? "—",
        fileName: f.fileName,
        mese: f.mese,
        anno: f.anno,
        importo: f.importo,
        dataFattura: f.dataFattura
          ? new Date(f.dataFattura).toISOString()
          : null,
        severity,
        criterio,
      });
    }
  }

  // Rosso prima, poi ambra, poi per data desc
  matches.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "red" ? -1 : 1;
    const ad = a.dataFattura ?? "";
    const bd = b.dataFattura ?? "";
    return bd.localeCompare(ad);
  });

  return NextResponse.json({ matches });
}
