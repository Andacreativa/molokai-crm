import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const appunto = await prisma.appuntoCall.create({
    data: { leadId: parseInt(id), testo: body.testo },
  })
  return NextResponse.json(appunto)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  await prisma.appuntoCall.delete({ where: { id: body.appuntoId, leadId: parseInt(id) } })
  return NextResponse.json({ ok: true })
}
