import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      appunti: { orderBy: { createdAt: 'desc' } },
      preventivi: { orderBy: { createdAt: 'desc' }, select: { id: true, numero: true, oggetto: true, subtotale: true, totale: true, feeCommerciale: true, iva: true, status: true, createdAt: true } },
    },
  })
  return NextResponse.json(leads)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const lead = await prisma.lead.create({
    data: {
      nome: body.nome,
      azienda: body.azienda || null,
      email: body.email || null,
      telefono: body.telefono || null,
      valore: body.valore ? Number(body.valore) : null,
      stage: body.stage || 'nuovo',
      note: body.note || null,
    },
    include: { appunti: true },
  })
  return NextResponse.json(lead)
}
