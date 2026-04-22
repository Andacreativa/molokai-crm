export const MESI = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];

export const CATEGORIE_SPESA = [
  "Scuola",
  "Rappresentanza",
  "Materiale Sportivo",
  "Affitto",
  "Utenze",
  "Marketing",
  "Assicurazione",
  "Commercialista",
  "Tasse",
  "Stipendio",
  "Seguridad Social",
  "Rimborsi Soci",
  "Ritiro Contante",
  "Altro",
];

export const PAESI = [
  "Italia",
  "Spagna",
  "Francia",
  "Germania",
  "Portogallo",
  "Regno Unito",
  "Altro",
];

// Palette pastello per i badge categoria. Colori morbidi da usare come sfondo
// solido con testo scuro (vedi CATEGORIA_TEXT).
export const CATEGORIE_COLORI: Record<string, string> = {
  Scuola: "#BDE3F5", // azzurro chiaro (ocean school)
  Rappresentanza: "#D4BBEE", // viola chiaro
  "Materiale Sportivo": "#B8F0C8", // verde menta (sport)
  Affitto: "#E0E0E0", // grigio chiaro
  Utenze: "#FFF0A0", // giallo pastello (energia)
  Marketing: "#FFD6D6", // rosa chiaro
  Assicurazione: "#C8E6F0", // azzurro tenue
  Commercialista: "#D4E8A0", // verde oliva chiaro
  Tasse: "#FFC9A0", // pesca pastello
  Stipendio: "#BDE3F5", // azzurro stipendio
  "Seguridad Social": "#FFAAAA", // rosso pastello
  "Rimborsi Soci": "#FFE0B3", // arancio pastello
  "Ritiro Contante": "#C8C8A0", // oliva pastello (cash)
  Altro: "#EDEDED", // grigio neutro
};

// Testo scuro uniforme per i badge categoria — leggibile su tutti i pastel.
export const CATEGORIA_TEXT = "#1f2937";

// Versioni sature delle categorie per grafici (pie/bar). I pastel di
// CATEGORIE_COLORI sono pensati per badge — troppo chiari su fette grandi.
export const CATEGORIE_COLORI_CHART: Record<string, string> = {
  Scuola: "#5BB8E8",
  Rappresentanza: "#9B6ED4",
  "Materiale Sportivo": "#4DD68C",
  Affitto: "#AAAAAA",
  Utenze: "#F5D020",
  Marketing: "#FF6B6B",
  Assicurazione: "#5BA9D8",
  Commercialista: "#8DB84A",
  Tasse: "#FF9940",
  Stipendio: "#5BB8E8",
  "Seguridad Social": "#FF6B6B",
  "Rimborsi Soci": "#FFA94D",
  "Ritiro Contante": "#8B9B5A",
  Altro: "#B0B0B0",
};

export const BRAND = "#0ea5e9";

export const TIPO_IMPOSTA_OPTIONS = ["IVA Exenta", "IVA 21%"];

// ─── Costanti dominio Molokai ──────────────────────────────────────────

export const TIPO_BUONO = ["BONO CLASE", "PACK 4 SUP", "PACK 8 SUP", "CUSTOM"];

export const RUOLI_COLLABORATORE = [
  "Istruttore Surf",
  "Istruttore SUP",
  "Insegnante Yoga",
  "Fotografo",
  "Receptionist",
  "Altro",
];

export const CATEGORIE_PRODOTTO = [
  "Esperienza",
  "Lezione",
  "Noleggio",
  "Pack",
  "Abbonamento",
];

export const CANALI_VENDITA = [
  "FareHarbor",
  "Get Your Guide",
  "Stripe",
  "Cassa",
  "Diretto",
];

export const AZIENDA = {
  nome: "MOLOKAI EXPERIENCE SL",
  cif: "B24878712",
  via: "Carrer De Meer, 39",
  cap: "08003",
  citta: "Barcelona",
  iban: "ES64 0182 0205 9902 0209 0802",
  swift: "BBVAESMMXXX",
};

// Formato europeo: punto separatore migliaia, virgola decimale, sempre 2 decimali (es. "3.250,00 €")
// Implementazione manuale per evitare problemi con dati locali ICU ridotti su Node.
export function fmt(n: number | null | undefined): string {
  const value = Number(n) || 0;
  const negative = value < 0;
  const abs = Math.abs(value);
  const [intPart, decPart] = abs.toFixed(2).split(".");
  const intWithSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "-" : ""}${intWithSep},${decPart} €`;
}

// Anni disponibili dal 2024 all'anno corrente, ordine decrescente
const ANNO_CORRENTE = new Date().getFullYear();
const ANNO_MIN = 2026;
export const ANNI = Array.from(
  { length: Math.max(1, ANNO_CORRENTE - ANNO_MIN + 1) },
  (_, i) => ANNO_CORRENTE - i,
);
