import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const cliente = await prisma.cliente.update({
    where: { id: parseInt(id) },
    data: {
      ...(body.nome !== undefined && { nome: body.nome }),
      ...(body.paese !== undefined && { paese: body.paese }),
      ...(body.email !== undefined && { email: body.email }),
      ...(body.telefono !== undefined && { telefono: body.telefono }),
      ...(body.partitaIva !== undefined && { partitaIva: body.partitaIva }),
      ...(body.indirizzo !== undefined && { indirizzo: body.indirizzo }),
      ...(body.note !== undefined && { note: body.note }),
    },
  })
  return NextResponse.json(cliente)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.cliente.delete({ where: { id: parseInt(id) } })
  return NextResponse.json({ ok: true })
}
