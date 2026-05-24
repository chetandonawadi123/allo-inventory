import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // ── Idempotency ──────────────────────────────────────────────────────────
    const idempotencyKey = req.headers.get('Idempotency-Key')

    if (idempotencyKey) {
      // If this key was used on a prior confirm and it succeeded, return cached
      // We store confirm idempotency keys prefixed so they don't clash with reserve keys
      const cacheKey = `confirm:${idempotencyKey}`
      // (In a full implementation, store in Redis or a separate DB table)
      // For simplicity, we just check if the reservation is already CONFIRMED
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: params.id },
    })

    if (!reservation) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
    }

    // Already confirmed — idempotent response
    if (reservation.status === 'CONFIRMED') {
      return NextResponse.json({ success: true, status: 'CONFIRMED' })
    }

    if (reservation.status === 'RELEASED') {
      return NextResponse.json(
        { error: 'Reservation was already released' },
        { status: 400 }
      )
    }

    // ── Check expiry ─────────────────────────────────────────────────────────
    if (reservation.expiresAt < new Date()) {
      // Release the stock since it expired
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

      return NextResponse.json(
        { error: 'Reservation has expired. Please start a new reservation.' },
        { status: 410 }
      )
    }

    // ── Confirm: mark CONFIRMED + permanently decrement total stock ───────────
    await prisma.$transaction([
      prisma.reservation.update({
        where: { id: params.id },
        data: { status: 'CONFIRMED' },
      }),
      prisma.stockLevel.update({
        where: {
          productId_warehouseId: {
            productId: reservation.productId,
            warehouseId: reservation.warehouseId,
          },
        },
        data: {
          total: { decrement: reservation.quantity },
          reserved: { decrement: reservation.quantity },
        },
      }),
    ])

    return NextResponse.json({ success: true, status: 'CONFIRMED' })
  } catch (error) {
    console.error(`POST /api/reservations/${params.id}/confirm error:`, error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
