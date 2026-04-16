import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const anno = parseInt(searchParams.get('anno') || '2025')
  const azienda = searchParams.get('azienda') || undefined

  const fatture = await prisma.fattura.findMany({
    where: { anno, ...(azienda ? { azienda } : {}) },
    include: { cliente: true },
    orderBy: [{ mese: 'asc' }, { createdAt: 'desc' }],
  })

  return NextResponse.json(fatture)
}

export async function POST(request: Request) {
  const body = await request.json()
  const fattura = await prisma.fattura.create({
    data: {
      clienteId: body.clienteId,
      azienda: body.azienda || 'Spagna',
      aziendaNota: body.aziendaNota || null,
      descrizione: body.descrizione || null,
      mese: body.mese,
      anno: body.anno || 2025,
      importo: parseFloat(body.importo),
      pagato: body.pagato || false,
      scadenza: body.scadenza ? new Date(body.scadenza) : null,
    },
    include: { cliente: true },
  })
  return NextResponse.json(fattura)
}
