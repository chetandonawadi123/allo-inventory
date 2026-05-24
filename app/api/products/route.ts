export const dynamic = "force-dynamic"

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Release expired reservations lazily before returning stock
    await prisma.$executeRaw`
      UPDATE "StockLevel" sl
      SET reserved = sl.reserved - r.quantity
      FROM "Reservation" r
      WHERE r."productId" = sl."productId"
        AND r."warehouseId" = sl."warehouseId"
        AND r.status = 'PENDING'
        AND r."expiresAt" < NOW()
    `
    await prisma.reservation.updateMany({
      where: { status: 'PENDING', expiresAt: { lt: new Date() } },
      data: { status: 'RELEASED' },
    })

    const products = await prisma.product.findMany({
      include: {
        stockLevels: {
          include: { warehouse: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    const result = products.map((p) => ({
      ...p,
      stockLevels: p.stockLevels.map((s) => ({
        ...s,
        available: Math.max(0, s.total - s.reserved),
      })),
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('GET /api/products error:', error)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}
