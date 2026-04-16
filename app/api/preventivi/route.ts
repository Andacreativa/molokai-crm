import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const preventivi = await prisma.preventivo.findMany({ orderBy: { createdAt: 'desc' } })
    return NextResponse.json(preventivi)
  } catch (e) {
    console.error('[GET /api/preventivi]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const vociArr: { servizio: string; descrizione: string; quantita: number; prezzoUnitario: number }[] =
      body.voci || []
    const subtotale = vociArr.reduce((s, v) => s + v.quantita * v.prezzoUnitario, 0)
    const iva = body.iva ?? 21
    const totale = subtotale * (1 + iva / 100)

    const count = await prisma.preventivo.count()
    const anno = new Date().getFullYear()
    const numero = `PRE-${anno}-${String(count + 1).padStart(3, '0')}`

    const preventivo = await prisma.preventivo.create({
      data: {
        numero,
        nomeCliente: body.nomeCliente,
        emailCliente: body.emailCliente || null,
        aziendaCliente: body.aziendaCliente || null,
        azienda: body.azienda || 'Spagna',
        oggetto: body.oggetto,
        voci: JSON.stringify(vociArr),
        iva,
        subtotale,
        totale,
        status: body.status || 'attesa',
        note: body.note || null,
        condizioni: body.condizioni || null,
        dataScadenza: body.dataScadenza ? new Date(body.dataScadenza) : null,
      },
    })
    return NextResponse.json(preventivo)
  } catch (e) {
    console.error('[POST /api/preventivi]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
