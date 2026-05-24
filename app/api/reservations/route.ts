import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { acquireLock, releaseLock } from '@/lib/lock'
import { z } from 'zod'

const reserveSchema = z.object({
  productId: z.string().min(1),
  warehouseId: z.string().min(1),
  quantity: z.number().int().positive().max(100),
})

export async function POST(req: NextRequest) {
  try {
    // ── Idempotency (bonus) ──────────────────────────────────────────────────
    const idempotencyKey = req.headers.get('Idempotency-Key')

    if (idempotencyKey) {
      const existing = await prisma.reservation.findUnique({
        where: { idempotencyKey },
        include: { product: true, warehouse: true },
      })
      if (existing) {
        // Return original response without repeating the side effect
        return NextResponse.json(existing, { status: 200 })
      }
    }

    // ── Validate body ────────────────────────────────────────────────────────
    const body = await req.json()
    const parsed = reserveSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { productId, warehouseId, quantity } = parsed.data

    // ── Acquire distributed lock ─────────────────────────────────────────────
    // Lock key is per product+warehouse so we only block concurrent requests
    // for the SAME SKU. Different products can proceed in parallel.
    const lockKey = `stock:${productId}:${warehouseId}`
    const locked = await acquireLock(lockKey, 8000)

    if (!locked) {
      return NextResponse.json(
        { error: 'Another request is being processed. Please retry in a moment.' },
        { status: 429 }
      )
    }

    try {
      // ── Check available stock ──────────────────────────────────────────────
      const stock = await prisma.stockLevel.findUnique({
        where: { productId_warehouseId: { productId, warehouseId } },
      })

      if (!stock) {
        return NextResponse.json(
          { error: 'Product not available in this warehouse' },
          { status: 404 }
        )
      }

      const available = stock.total - stock.reserved

      if (available < quantity) {
        return NextResponse.json(
          {
            error: 'Not enough stock available',
            available,
            requested: quantity,
          },
          { status: 409 }
        )
      }

      // ── Atomic: increment reserved + create reservation ────────────────────
      // Using a transaction ensures both writes succeed or both fail.
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

      const [reservation] = await prisma.$transaction([
        prisma.reservation.create({
          data: {
            productId,
            warehouseId,
            quantity,
            expiresAt,
            status: 'PENDING',
            ...(idempotencyKey ? { idempotencyKey } : {}),
          },
          include: { product: true, warehouse: true },
        }),
        prisma.stockLevel.update({
          where: { productId_warehouseId: { productId, warehouseId } },
          data: { reserved: { increment: quantity } },
        }),
      ])

      return NextResponse.json(reservation, { status: 201 })
    } finally {
      // Always release lock, even if an error occurred
      await releaseLock(lockKey)
    }
  } catch (error) {
    console.error('POST /api/reservations error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
