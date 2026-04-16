import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()

    let subtotale: number | undefined
    let totale: number | undefined

    if (body.voci !== undefined) {
      const vociArr: { servizio: string; descrizione: string; quantita: number; prezzoUnitario: number }[] = body.voci
      subtotale = vociArr.reduce((s, v) => s + v.quantita * v.prezzoUnitario, 0)
      const iva = body.iva ?? 21
      totale = subtotale * (1 + iva / 100)
    }

    const preventivo = await prisma.preventivo.update({
      where: { id: parseInt(id) },
      data: {
        ...(body.nomeCliente !== undefined && { nomeCliente: body.nomeCliente }),
        ...(body.emailCliente !== undefined && { emailCliente: body.emailCliente }),
        ...(body.aziendaCliente !== undefined && { aziendaCliente: body.aziendaCliente }),
        ...(body.azienda !== undefined && { azienda: body.azienda }),
        ...(body.oggetto !== undefined && { oggetto: body.oggetto }),
        ...(body.voci !== undefined && { voci: JSON.stringify(body.voci) }),
        ...(body.iva !== undefined && { iva: body.iva }),
        ...(subtotale !== undefined && { subtotale }),
        ...(totale !== undefined && { totale }),
        ...(body.feeCommerciale !== undefined && { feeCommerciale: Number(body.feeCommerciale) }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.note !== undefined && { note: body.note }),
        ...(body.condizioni !== undefined && { condizioni: body.condizioni }),
        ...(body.dataScadenza !== undefined && {
          dataScadenza: body.dataScadenza ? new Date(body.dataScadenza) : null,
        }),
      },
    })
    return NextResponse.json(preventivo)
  } catch (e) {
    console.error('[PATCH /api/preventivi/[id]]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.preventivo.delete({ where: { id: parseInt(id) } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[DELETE /api/preventivi/[id]]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
