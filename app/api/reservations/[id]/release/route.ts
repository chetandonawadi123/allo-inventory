import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: params.id },
    })

    if (!reservation) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
    }

    // Already released — idempotent
    if (reservation.status === 'RELEASED') {
      return NextResponse.json({ success: true, status: 'RELEASED' })
    }

    if (reservation.status === 'CONFIRMED') {
      return NextResponse.json(
        { error: 'Cannot release a confirmed reservation' },
        { status: 400 }
      )
    }

    // Release: set status + give stock back
    await prisma.$transaction([
      prisma.reservation.update({
        where: { id: params.id },
        data: { status: 'RELEASED' },
      }),
      prisma.stockLevel.update({
        where: {
          productId_warehouseId: {
            productId: reservation.productId,
            warehouseId: reservation.warehouseId,
          },
        },
        data: { reserved: { decrement: reservation.quantity } },
      }),
    ])

    return NextResponse.json({ success: true, status: 'RELEASED' })
  } catch (error) {
    console.error(`POST /api/reservations/${params.id}/release error:`, error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
