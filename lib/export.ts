import { fmt } from "./constants";

// Logo Molokai ridimensionato a max 512×512 px ed embeddato come PNG. A
// 22mm di display 512px = ~590 DPI, ben oltre la soglia print (300 DPI):
// risoluzioni più basse (es. 80px = 92 DPI) producono un logo sgranato
// quando il PDF viewer scala. PNG mantiene la nitidezza di testo e linee
// sottili che JPEG sgranerebbe. Se per qualche motivo il PNG cresce oltre
// la soglia, fallback a JPEG q=0.9. La sorgente è un PNG 3375×4219
// (~424KB) che jsPDF altrimenti inlinerebbe verbatim, gonfiando il PDF a
// decine di MB. Cacheato a livello di modulo: una sola decodifica +
// ridimensionamento per sessione.
const LOGO_MAX_PX = 512;
const LOGO_PNG_MAX_BYTES = 250_000;
const LOGO_JPEG_FALLBACK_QUALITY = 0.9;
interface CachedLogo {
  data: string;
  format: "PNG" | "JPEG";
}
let logoCache: CachedLogo | null = null;
async function loadLogo(): Promise<CachedLogo | null> {
  if (logoCache) return logoCache;
  if (typeof window === "undefined") return null;
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = "/logo-molokai.png";
    });
    const ratio = Math.min(
      LOGO_MAX_PX / img.naturalWidth,
      LOGO_MAX_PX / img.naturalHeight,
      1,
    );
    const w = Math.round(img.naturalWidth * ratio);
    const h = Math.round(img.naturalHeight * ratio);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    const pngData = canvas.toDataURL("image/png");
    if (pngData.length <= LOGO_PNG_MAX_BYTES) {
      logoCache = { data: pngData, format: "PNG" };
      return logoCache;
    }
    // Fallback JPEG con sfondo bianco (PNG → JPEG perde alpha).
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    logoCache = {
      data: canvas.toDataURL("image/jpeg", LOGO_JPEG_FALLBACK_QUALITY),
      format: "JPEG",
    };
    return logoCache;
  } catch {
    return null;
  }
}

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

  const doc = new jsPDF({ orientation: "landscape", compress: true });

  // Logo Molokai a sinistra: width fissa, altezza calcolata in proporzione
  // dalle dimensioni naturali dell'immagine per evitare distorsioni.
  const logo = await loadLogo();
  if (logo) {
    const props = doc.getImageProperties(logo.data);
    const logoW = 14;
    const logoH = (props.height / props.width) * logoW;
    doc.addImage(logo.data, logo.format, 14, 8, logoW, logoH);
  } else {
    doc.setFontSize(16);
    doc.setTextColor(14, 165, 233);
    doc.text("molokai!", 14, 16);
  }
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("Molokai Experience SL — Gestionale Interno", 32, 18);
  doc.setFontSize(13);
  doc.setTextColor(30);
  doc.text(title, 14, 32);

  autoTable(doc, {
    head: [columns],
    body: rows,
    startY: 38,
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

// Traduce il nome del paese da italiano a spagnolo per la fattura PDF.
// Le opzioni note in lib/constants.PAESI sono in italiano; qui le mappiamo
// allo spagnolo per coerenza con il resto del template (FACTURA è in ES).
const PAESE_IT_TO_ES: Record<string, string> = {
  Spagna: "España",
  Italia: "Italia",
  Francia: "Francia",
  Germania: "Alemania",
  Portogallo: "Portugal",
  "Regno Unito": "Reino Unido",
  Irlanda: "Irlanda",
  Lussemburgo: "Luxemburgo",
  "Stati Uniti": "Estados Unidos",
  Svizzera: "Suiza",
  Olanda: "Países Bajos",
  "Paesi Bassi": "Países Bajos",
  Austria: "Austria",
  Belgio: "Bélgica",
  Danimarca: "Dinamarca",
  Svezia: "Suecia",
  Norvegia: "Noruega",
  Finlandia: "Finlandia",
  Polonia: "Polonia",
  Grecia: "Grecia",
  Brasile: "Brasil",
  Messico: "México",
};
function paeseES(p: string | null | undefined): string {
  if (!p) return "";
  return PAESE_IT_TO_ES[p.trim()] ?? p;
}

export async function exportFatturaPDF(
  f: FatturaPDFData,
  c: ClientePDFData | null,
) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });
  const W = 210,
    ML = 14,
    MR = 14;
  const CW = W - ML - MR;

  // Header: logo Molokai a sinistra (width fissa, altezza in proporzione
  // alle dimensioni naturali dell'immagine) + company info a destra.
  const logo = await loadLogo();
  if (logo) {
    const props = doc.getImageProperties(logo.data);
    const logoW = 22;
    const logoH = (props.height / props.width) * logoW;
    doc.addImage(logo.data, logo.format, ML, 8, logoW, logoH);
  } else {
    // fallback al testo se l'immagine non è raggiungibile
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.setTextColor(...SKY);
    doc.text("molokai!", ML, 22);
  }

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
  const nomeCliente = c ? `${c.nome}${c.cognome ? " " + c.cognome : ""}` : "—";
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
    doc.text(paeseES(c.paese), col1X, yC);
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

// ── Riepilogo sessioni Gruppo (PDF) ───────────────────────────────────

interface GruppoPDFData {
  nome: string;
  tipo: string;
  contatto: string | null;
  email: string | null;
}

interface SessioneGruppoPDFData {
  data: string; // ISO
  partecipanti: number;
  prezzoPP: number;
  totale: number;
  incassato: boolean;
}

type GruppoPDFLocale = "it" | "es";

interface GruppoPDFStrings {
  title: string;
  generato: (anno: number, date: string) => string;
  referente: string;
  email: string;
  tipo: string;
  colData: string;
  colPartecipanti: string;
  colPrezzoPP: string;
  colTotale: string;
  colIncassato: string;
  yes: string;
  no: string;
  nSessioni: string;
  totalePartecipanti: string;
  totaleIncassato: string;
  daIncassare: string;
  totaleGenerale: string;
  fileNamePrefix: string;
  dateLocale: string;
}

const GRUPPO_PDF_STRINGS: Record<GruppoPDFLocale, GruppoPDFStrings> = {
  it: {
    title: "RIEPILOGO SESSIONI",
    generato: (a, d) => `Anno ${a} · generato il ${d}`,
    referente: "Referente",
    email: "Email",
    tipo: "Tipo",
    colData: "DATA",
    colPartecipanti: "PARTECIPANTI",
    colPrezzoPP: "PREZZO/PP",
    colTotale: "TOTALE",
    colIncassato: "INCASSATO",
    yes: "Sì",
    no: "No",
    nSessioni: "N° Sessioni totali",
    totalePartecipanti: "Totale Partecipanti",
    totaleIncassato: "Totale Incassato",
    daIncassare: "Da Incassare",
    totaleGenerale: "TOTALE GENERALE",
    fileNamePrefix: "Sessioni",
    dateLocale: "it-IT",
  },
  es: {
    title: "RESUMEN DE SESIONES",
    generato: (a, d) => `Año ${a} · fecha de generación ${d}`,
    referente: "Responsable",
    email: "Email",
    tipo: "Tipo",
    colData: "FECHA",
    colPartecipanti: "PARTICIPANTES",
    colPrezzoPP: "PRECIO/PERSONA",
    colTotale: "TOTAL",
    colIncassato: "COBRADO",
    yes: "Sí",
    no: "No",
    nSessioni: "N° Sesiones totales",
    totalePartecipanti: "Total Participantes",
    totaleIncassato: "Total Cobrado",
    daIncassare: "Por Cobrar",
    totaleGenerale: "TOTAL GENERAL",
    fileNamePrefix: "Sesiones",
    dateLocale: "es-ES",
  },
};

export async function exportGruppoSessioniPDF(
  gruppo: GruppoPDFData,
  sessioni: SessioneGruppoPDFData[],
  anno: number,
  locale: GruppoPDFLocale = "it",
) {
  const t = GRUPPO_PDF_STRINGS[locale];
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });
  const W = 210,
    ML = 14,
    MR = 14;
  const CW = W - ML - MR;

  // Logo a sinistra (proporzionale via getImageProperties)
  const logo = await loadLogo();
  if (logo) {
    const props = doc.getImageProperties(logo.data);
    const logoW = 20;
    const logoH = (props.height / props.width) * logoW;
    doc.addImage(logo.data, logo.format, ML, 8, logoW, logoH);
  }

  // Titolo grande allineato a destra del logo
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...DARK);
  doc.text(t.title, W - MR, 16, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(
    t.generato(anno, new Date().toLocaleDateString(t.dateLocale)),
    W - MR,
    22,
    { align: "right" },
  );

  // Separator
  doc.setDrawColor(...LIGHT);
  doc.setLineWidth(0.3);
  doc.line(ML, 36, W - MR, 36);

  // Blocco gruppo
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...DARK);
  doc.text(gruppo.nome, ML, 44);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const infoLine = [
    gruppo.contatto ? `${t.referente}: ${gruppo.contatto}` : null,
    gruppo.email ? `${t.email}: ${gruppo.email}` : null,
    `${t.tipo}: ${gruppo.tipo}`,
  ]
    .filter(Boolean)
    .join("  ·  ");
  doc.text(infoLine, ML, 50);

  // Tabella sessioni
  const tableStartY = 58;
  autoTable(doc, {
    startY: tableStartY,
    head: [[t.colData, t.colPartecipanti, t.colPrezzoPP, t.colTotale, t.colIncassato]],
    body: sessioni.map((s) => [
      new Date(s.data).toLocaleDateString(t.dateLocale),
      String(s.partecipanti),
      fmt(s.prezzoPP),
      fmt(s.totale),
      s.incassato ? t.yes : t.no,
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
      0: { cellWidth: 30 },
      1: { halign: "right", cellWidth: 30 },
      2: { halign: "right", cellWidth: 32 },
      3: { halign: "right", cellWidth: 32 },
      4: { halign: "center", cellWidth: 28 },
    },
    didParseCell: (data) => {
      // Colora la colonna "INCASSATO/COBRADO" in verde/arancione
      if (data.section === "body" && data.column.index === 4) {
        const txt = String(data.cell.raw ?? "");
        if (txt === t.yes) data.cell.styles.textColor = [34, 197, 94];
        else if (txt === t.no) data.cell.styles.textColor = [249, 115, 22];
      }
    },
  });

  // Footer totali
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastY = (doc as any).lastAutoTable?.finalY ?? tableStartY;

  const totaleIncassato =
    Math.round(
      sessioni
        .filter((s) => s.incassato)
        .reduce((sum, s) => sum + s.totale, 0) * 100,
    ) / 100;
  const daIncassare =
    Math.round(
      sessioni
        .filter((s) => !s.incassato)
        .reduce((sum, s) => sum + s.totale, 0) * 100,
    ) / 100;
  const totaleGenerale = Math.round((totaleIncassato + daIncassare) * 100) / 100;
  const totalePartecipanti = sessioni.reduce(
    (sum, s) => sum + s.partecipanti,
    0,
  );

  const footY = lastY + 8;
  const boxX = ML;
  const boxW = CW;
  const boxH = 32;

  doc.setFillColor(...BG_SOFT);
  doc.rect(boxX, footY, boxW, boxH, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);

  // Riga 1: N° Sessioni
  doc.text(t.nSessioni, boxX + 4, footY + 6);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  doc.text(String(sessioni.length), boxX + boxW - 4, footY + 6, {
    align: "right",
  });

  // Riga 2: Totale Partecipanti (sopra i totali economici)
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text(t.totalePartecipanti, boxX + 4, footY + 12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  doc.text(String(totalePartecipanti), boxX + boxW - 4, footY + 12, {
    align: "right",
  });

  // Riga 3: Incassato (verde)
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text(t.totaleIncassato, boxX + 4, footY + 18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(34, 197, 94);
  doc.text(fmt(totaleIncassato), boxX + boxW - 4, footY + 18, {
    align: "right",
  });

  // Riga 4: Da Incassare (arancione)
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text(t.daIncassare, boxX + 4, footY + 24);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(249, 115, 22);
  doc.text(fmt(daIncassare), boxX + boxW - 4, footY + 24, {
    align: "right",
  });

  // Riga totale generale (sky)
  doc.setDrawColor(...LIGHT);
  doc.setLineWidth(0.2);
  doc.line(boxX + 4, footY + 26.5, boxX + boxW - 4, footY + 26.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...SKY);
  doc.text(t.totaleGenerale, boxX + 4, footY + 31);
  doc.setTextColor(...DARK);
  doc.text(fmt(totaleGenerale), boxX + boxW - 4, footY + 31, {
    align: "right",
  });

  const safeName = gruppo.nome.replace(/[/\\]/g, "-").replace(/\s+/g, "_");
  doc.save(`${t.fileNamePrefix}_${safeName}_${anno}.pdf`);
}
