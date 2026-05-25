export const IVA = 0.21;

export function calcolaMargini(p: {
  prezzoVendita: number;
  feePerc?: number | null;
  feeFissa?: number | null;
}) {
  const iva = p.prezzoVendita * (IVA / (1 + IVA));
  const fee =
    p.feePerc != null
      ? p.prezzoVendita * (p.feePerc / 100)
      : (p.feeFissa ?? 0);
  const netto = p.prezzoVendita - iva - fee;
  const margine = (netto / p.prezzoVendita) * 100;
  return { iva, fee, netto, margine };
}
