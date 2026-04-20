import { fmt } from "./constants";

// ── Excel ──────────────────────────────────────────────────────────────

export async function exportExcel(
  data: Record<string, unknown>[],
  filename: string,
) {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dati");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// ── PDF tabellare generico (bilancio / spese export) ──────────────────

export async function exportPDF(
  title: string,
  columns: string[],
  rows: (string | number)[][],
  filename: string,
) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape" });

  doc.setFontSize(16);
  doc.setTextColor(14, 165, 233);
  doc.text("molokai!", 14, 16);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("Molokai Experience SL — Gestionale Interno", 14, 22);
  doc.setFontSize(13);
  doc.setTextColor(30);
  doc.text(title, 14, 30);

  autoTable(doc, {
    head: [columns],
    body: rows,
    startY: 35,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: {
      fillColor: [14, 165, 233],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [240, 247, 255] },
  });

  doc.save(`${filename}.pdf`);
}

// ── Spese helpers (Excel) ─────────────────────────────────────────────

export function speseToExcel(
  spese: {
    fornitore: string;
    categoria: string;
    mese: number;
    anno: number;
    importo: number;
    descrizione: string | null;
    note: string | null;
  }[],
  MESI: string[],
) {
  return spese.map((s) => ({
    Fornitore: s.fornitore,
    Categoria: s.categoria,
    Mese: MESI[s.mese - 1],
    Anno: s.anno,
    Importo: s.importo,
    Descrizione: s.descrizione || "",
    Note: s.note || "",
  }));
}

// ── Fattura PDF (layout Molokai) ──────────────────────────────────────

interface RigaPDF {
  descrizione: string;
  quantita: number;
  prezzoUnitario: number;
}

interface FatturaPDFData {
  numero: string | null;
  data: string | null;
  scadenza: string | null;
  righe: string; // JSON
  baseImponibile: number;
  iva: number;
  totale: number;
  metodoPagamento: string | null;
  note: string | null;
}

interface ClientePDFData {
  nome: string;
  cognome: string | null;
  partitaIva: string | null;
  dni: string | null;
  via: string | null;
  cap: string | null;
  citta: string | null;
  provincia: string | null;
  paese: string | null;
  email: string | null;
}

const AZIENDA_PDF = {
  nome: "MOLOKAI EXPERIENCE SL",
  cif: "B24878712",
  via: "Carrer De Meer, 39",
  cap: "08003",
  citta: "Barcelona",
  iban: "ES64 0182 0205 9902 0209 0802",
  swift: "BBVAESMMXXX",
  email: "aloha@molokaisupcenter.com",
  tel: "+34 654082099",
};

const SKY: [number, number, number] = [14, 165, 233];
const DARK: [number, number, number] = [30, 41, 59];
const MUTED: [number, number, number] = [100, 116, 139];
const LIGHT: [number, number, number] = [148, 163, 184];
const BG_SOFT: [number, number, number] = [241, 245, 249];

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-ES");
}

export async function exportFatturaPDF(
  f: FatturaPDFData,
  c: ClientePDFData | null,
) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210,
    ML = 14,
    MR = 14;
  const CW = W - ML - MR;

  // Header: "molokai!" branded logo (left) + company info (right)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(...SKY);
  doc.text("molokai!", ML, 22);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.text(AZIENDA_PDF.nome, W - MR, 14, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(`CIF: ${AZIENDA_PDF.cif}`, W - MR, 19, { align: "right" });
  doc.text(AZIENDA_PDF.via, W - MR, 23.5, { align: "right" });
  doc.text(`${AZIENDA_PDF.cap}, ${AZIENDA_PDF.citta}`, W - MR, 28, {
    align: "right",
  });
  doc.text(AZIENDA_PDF.email, W - MR, 32.5, { align: "right" });

  // Separator
  doc.setDrawColor(...LIGHT);
  doc.setLineWidth(0.3);
  doc.line(ML, 38, W - MR, 38);

  // Two boxes: CLIENTE (left) and FACTURA (right)
  const boxY = 44;
  const boxH = 32;
  const col1X = ML;
  const col2X = ML + CW / 2 + 4;
  const colW = CW / 2 - 4;

  // CLIENTE box
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...SKY);
  doc.text("CLIENTE", col1X, boxY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  const nomeCliente = c
    ? `${c.nome}${c.cognome ? " " + c.cognome : ""}`
    : "—";
  doc.text(nomeCliente, col1X, boxY + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);

  let yC = boxY + 11;
  const idFiscale = c?.partitaIva || c?.dni;
  if (idFiscale) {
    doc.text(`CIF/NIF: ${idFiscale}`, col1X, yC);
    yC += 4;
  }
  if (c?.via) {
    doc.text(c.via, col1X, yC);
    yC += 4;
  }
  const localita = [c?.cap, c?.citta, c?.provincia].filter(Boolean).join(" ");
  if (localita) {
    doc.text(localita, col1X, yC);
    yC += 4;
  }
  if (c?.paese) {
    doc.text(c.paese, col1X, yC);
  }

  // FACTURA box
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...SKY);
  doc.text("FACTURA", col2X, boxY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...DARK);
  doc.text(f.numero ?? "—", col2X, boxY + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(`Fecha: ${formatDate(f.data)}`, col2X, boxY + 14);
  doc.text(`Vencimiento: ${formatDate(f.scadenza)}`, col2X, boxY + 19);

  // Righe table
  let righeArr: RigaPDF[] = [];
  try {
    const parsed = JSON.parse(f.righe || "[]");
    if (Array.isArray(parsed)) righeArr = parsed;
  } catch {
    righeArr = [];
  }

  const tableStartY = boxY + boxH + 4;
  autoTable(doc, {
    startY: tableStartY,
    head: [["CONCEPTO", "CANT.", "PRECIO UNI.", "IVA", "TOTAL"]],
    body: righeArr.map((r) => [
      r.descrizione,
      String(r.quantita),
      fmt(r.prezzoUnitario),
      `${f.iva}%`,
      fmt((Number(r.quantita) || 0) * (Number(r.prezzoUnitario) || 0)),
    ]),
    margin: { left: ML, right: MR },
    styles: {
      fontSize: 9,
      cellPadding: 3,
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: SKY,
      textColor: 255,
      fontStyle: "bold",
      fontSize: 9,
    },
    alternateRowStyles: { fillColor: BG_SOFT },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "right", cellWidth: 18 },
      2: { halign: "right", cellWidth: 30 },
      3: { halign: "right", cellWidth: 16 },
      4: { halign: "right", cellWidth: 30 },
    },
  });

  // Totals box (aligned right under the table)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastY = (doc as any).lastAutoTable?.finalY ?? tableStartY;
  const totY = lastY + 6;
  const totBoxX = W - MR - 80;
  const totBoxW = 80;
  const totBoxH = 26;
  const ivaImporto = Math.round(f.baseImponibile * (f.iva / 100) * 100) / 100;

  doc.setFillColor(...BG_SOFT);
  doc.rect(totBoxX, totY, totBoxW, totBoxH, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text("Base Imponible", totBoxX + 3, totY + 6);
  doc.text(`IVA ${f.iva}%`, totBoxX + 3, totY + 12);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  doc.text(fmt(f.baseImponibile), totBoxX + totBoxW - 3, totY + 6, {
    align: "right",
  });
  doc.text(fmt(ivaImporto), totBoxX + totBoxW - 3, totY + 12, {
    align: "right",
  });

  doc.setDrawColor(...LIGHT);
  doc.setLineWidth(0.2);
  doc.line(totBoxX + 3, totY + 15, totBoxX + totBoxW - 3, totY + 15);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...SKY);
  doc.text("TOTAL", totBoxX + 3, totY + 22);
  doc.setTextColor(...DARK);
  doc.text(fmt(f.totale), totBoxX + totBoxW - 3, totY + 22, {
    align: "right",
  });

  // Métodos de pago footer
  const fooY = totY + totBoxH + 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...SKY);
  doc.text("MÉTODOS DE PAGO", ML, fooY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  doc.text(`Transferencia: ${AZIENDA_PDF.iban}`, ML, fooY + 5);
  doc.setTextColor(...MUTED);
  doc.text(`SWIFT: ${AZIENDA_PDF.swift}`, ML, fooY + 10);
  doc.text("Tarjeta de crédito · Bizum · Efectivo", ML, fooY + 15);

  // Notes if present
  if (f.note) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...SKY);
    doc.text("NOTAS", ML, fooY + 25);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    const split = doc.splitTextToSize(f.note, CW);
    doc.text(split, ML, fooY + 30);
  }

  const safeNum = (f.numero ?? "fattura").replace(/[/\\]/g, "-");
  doc.save(`${safeNum}.pdf`);
}
