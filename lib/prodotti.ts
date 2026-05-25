export const IVA = 0.21;

export type CostoInput = {
  tipo: string; // "fisso" | "percentuale"
  valore: number;
};

export function calcolaMargini(p: {
  prezzoVendita: number;
  feePerc?: number | null;
  feeFissa?: number | null;
  costi?: CostoInput[] | null;
}) {
  const iva = p.prezzoVendita * (IVA / (1 + IVA));
  const fee =
    p.feePerc != null
      ? p.prezzoVendita * (p.feePerc / 100)
      : (p.feeFissa ?? 0);
  const netto = p.prezzoVendita - iva - fee;
  const margine =
    p.prezzoVendita > 0 ? (netto / p.prezzoVendita) * 100 : 0;

  // Costi addizionali (incidenze esterne — solo statistici, non entrano
  // mai nel bilancio del CRM). Riducono il netto e il margine.
  let costiFissi = 0;
  let costiPerc = 0;
  if (p.costi) {
    for (const c of p.costi) {
      const v = Number(c.valore) || 0;
      if (c.tipo === "fisso") costiFissi += v;
      else if (c.tipo === "percentuale") costiPerc += (v / 100) * p.prezzoVendita;
    }
  }
  const costiTotali = costiFissi + costiPerc;
  const nettoReale = netto - costiTotali;
  const margineReale =
    p.prezzoVendita > 0 ? (nettoReale / p.prezzoVendita) * 100 : 0;

  return {
    iva,
    fee,
    netto,
    margine,
    costiTotali,
    nettoReale,
    margineReale,
  };
}
