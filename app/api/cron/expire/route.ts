import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Cron endpoint: releases all expired PENDING reservations.
 *
 * In production (Vercel), configure in vercel.json:
 *   { "crons": [{ "path": "/api/cron/expire", "schedule": "* * * * *" }] }
 *
 * This runs every minute. Vercel free tier allows 2 cron jobs.
 * Add CRON_SECRET env var to protect this endpoint.
 */
export async function GET(req: Request) {
  // Protect the endpoint in production
  const authHeader = req.headers.get('authorization')
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()

    // Find all expired pending reservations
    const expired = await prisma.reservation.findMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: now },
      },
    })

    if (expired.length === 0) {
      return NextResponse.json({ released: 0, message: 'No expired reservations' })
    }

    // Release each one in a transaction to restore stock
    let released = 0
    for (const r of expired) {
      try {
        await prisma.$transaction([
          prisma.reservation.update({
            where: { id: r.id },
            data: { status: 'RELEASED' },
          }),
          prisma.stockLevel.update({
            where: {
              productId_warehouseId: {
                productId: r.productId,
                warehouseId: r.warehouseId,
              },
            },
            data: { reserved: { decrement: r.quantity } },
          }),
        ])
        released++
      } catch (err) {
        console.error(`Failed to release reservation ${r.id}:`, err)
      }
    }

    console.log(`Cron: released ${released} expired reservations`)
    return NextResponse.json({ released })
  } catch (error) {
    console.error('Cron expire error:', error)
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 })
  }
}
