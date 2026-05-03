import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const annoParam = searchParams.get("anno");
    const meseParam = searchParams.get("mese");
    const where: { anno?: number; mese?: number } = {};
    if (annoParam) where.anno = parseInt(annoParam, 10);
    if (meseParam) where.mese = parseInt(meseParam, 10);

    const fatture = await prisma.fatturaFornitore.findMany({
      where,
      include: { fornitore: true },
      orderBy: [{ anno: "desc" }, { mese: "desc" }, { createdAt: "desc" }],
      omit: { fileData: true },
    });
    return NextResponse.json(fatture);
  } catch (e) {
    console.error("[GET /api/fatture-fornitori]", e);
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ct = request.headers.get("content-type") || "";

    if (ct.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const fornitoreId = formData.get("fornitoreId") as string | null;
      const mese = formData.get("mese") as string | null;
      const anno = formData.get("anno") as string | null;
      const importo = formData.get("importo") as string | null;
      const dataFatturaStr = formData.get("dataFattura") as string | null;

      if (!file) {
        return NextResponse.json(
          { error: "Nessun file ricevuto" },
          { status: 400 },
        );
      }
      if (!fornitoreId) {
        return NextResponse.json(
          { error: "fornitoreId mancante" },
          { status: 400 },
        );
      }
      if (!mese) {
        return NextResponse.json({ error: "mese mancante" }, { status: 400 });
      }

      const arrayBuf = await file.arrayBuffer();
      const fileData = Buffer.from(arrayBuf).toString("base64");

      const fattura = await prisma.fatturaFornitore.create({
        data: {
          fileName: file.name,
          fileData,
          fileMimeType: file.type || "application/octet-stream",
          filePath: null,
          fornitoreId: parseInt(fornitoreId, 10),
          mese: parseInt(mese, 10),
          anno: (anno ? parseInt(anno, 10) : null) || new Date().getFullYear(),
          importo: importo ? parseFloat(importo) || 0 : 0,
          dataFattura: dataFatturaStr ? new Date(dataFatturaStr) : null,
        },
        include: { fornitore: true },
        omit: { fileData: true },
      });
      return NextResponse.json(fattura);
    }

    // JSON legacy
    const body = await request.json();
    if (!body.fileName || !body.fornitoreId || !body.mese) {
      return NextResponse.json(
        { error: "Campi obbligatori mancanti" },
        { status: 400 },
      );
    }
    const fattura = await prisma.fatturaFornitore.create({
      data: {
        fileName: body.fileName,
        filePath: body.filePath || null,
        fileData: body.fileData || null,
        fileMimeType: body.fileMimeType || null,
        fornitoreId: parseInt(body.fornitoreId, 10),
        mese: parseInt(body.mese, 10),
        anno: parseInt(body.anno, 10) || new Date().getFullYear(),
        importo: parseFloat(body.importo) || 0,
        dataFattura: body.dataFattura ? new Date(body.dataFattura) : null,
      },
      include: { fornitore: true },
      omit: { fileData: true },
    });
    return NextResponse.json(fattura);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[POST /api/fatture-fornitori]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
