import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RigaCSV {
  data: string; // ISO YYYY-MM-DD o DD/MM/YYYY
  totaleGiorno?: number | string; // SALE
  totVendite?: number | string; // TOTALSALES
  rimborsi?: number | string; // REFUND
  note?: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Parse data: supporta ISO (YYYY-MM-DD) e DD/MM/YYYY.
function parseData(s: string): Date | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }
  const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    const d = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const anno = searchParams.get("anno");
  const mese = searchParams.get("mese");

  const where: { anno?: number; mese?: number } = {};
  if (anno) where.anno = parseInt(anno);
  if (mese) where.mese = parseInt(mese);

  const rows = await prisma.pagamentoInScuola.findMany({
    where,
    orderBy: { data: "asc" },
  });
  return NextResponse.json(rows);
}

// POST bulk upsert.
// Body: { righe: RigaCSV[] } — dati parsati client-side dal CSV.
// Upsert per data: riga esistente viene sovrascritta.
export async function POST(request: Request) {
  const body = await request.json();
  const righe: RigaCSV[] = Array.isArray(body.righe) ? body.righe : [];

  const results: { ok: number; skipped: number; errors: string[] } = {
    ok: 0,
    skipped: 0,
    errors: [],
  };

  for (const r of righe) {
    const data = parseData(String(r.data ?? ""));
    if (!data) {
      results.skipped++;
      results.errors.push(`Data non valida: "${r.data}"`);
      continue;
    }
    const totaleGiorno = round2(parseFloat(String(r.totaleGiorno ?? 0)) || 0);
    const totVendite = round2(parseFloat(String(r.totVendite ?? 0)) || 0);
    const rimborsi = round2(parseFloat(String(r.rimborsi ?? 0)) || 0);
    const mese = data.getMonth() + 1;
    const anno = data.getFullYear();

    await prisma.pagamentoInScuola.upsert({
      where: { data },
      create: {
        data,
        mese,
        anno,
        totaleGiorno,
        totVendite,
        rimborsi,
        note: r.note || null,
      },
      update: {
        mese,
        anno,
        totaleGiorno,
        totVendite,
        rimborsi,
        note: r.note || null,
      },
    });
    results.ok++;
  }

  return NextResponse.json(results);
}
