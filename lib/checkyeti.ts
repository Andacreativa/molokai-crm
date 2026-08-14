// CheckYeti trattiene il 21,5% sull'importo della prenotazione, più il 21%
// di IVA spagnola sulla commissione stessa. Il payout è quindi
// importo − (commissione + IVA). Fonte: fattura CheckYeti ES-2607900 del
// 30-06-2026 (105,00 lordo → 22,61 commissione + 4,76 IVA = 27,37 →
// payout 77,63 €).
export const CHECKYETI_COMMISSION_RATE = 0.215;
export const CHECKYETI_IVA_RATE = 0.21;

const round2 = (n: number) => Math.round(n * 100) / 100;

// Commissione lorda (IVA inclusa) su un singolo importo. CheckYeti arrotonda
// a 2 decimali per prenotazione, non sul totale mensile: applicare la stessa
// granularità è l'unico modo per far tornare l'import al centesimo con la
// fattura (7 × 15,00 € → 7 × 3,91 € = 27,37 €, non 27,32 €).
export function commissioneCheckYeti(importo: number): number {
  const netta = round2(importo * CHECKYETI_COMMISSION_RATE);
  return round2(netta * (1 + CHECKYETI_IVA_RATE));
}
