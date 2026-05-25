import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/prodotti/reorder
// Body: { items: [{ id, ordine, categoria? }, ...] }
// Una sola transazione che aggiorna ordine e (opzionalmente) categoria, così
// il drop cross-card è atomico — niente stato parziale tra le due card.
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const items = Array.isArray(body?.items) ? body.items : [];
  const updates: { id: number; ordine: number; categoria?: string }[] = [];
  for (const it of items) {
    const id = Number(it?.id);
    const ordine = Number(it?.ordine);
    if (!Number.isFinite(id) || !Number.isFinite(ordine)) continue;
    const u: { id: number; ordine: number; categoria?: string } = { id, ordine };
    if (typeof it?.categoria === "string" && it.categoria.trim()) {
      u.categoria = it.categoria.trim();
    }
    updates.push(u);
  }
  if (updates.length === 0) {
    return NextResponse.json({ ok: true, updated: 0 });
  }
  await prisma.$transaction(
    updates.map((u) =>
      prisma.prodotto.update({
        where: { id: u.id },
        data: u.categoria
          ? { ordine: u.ordine, categoria: u.categoria }
          : { ordine: u.ordine },
      }),
    ),
  );
  return NextResponse.json({ ok: true, updated: updates.length });
}
