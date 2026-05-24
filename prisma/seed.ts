import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Clean up existing data
  await prisma.reservation.deleteMany()
  await prisma.stockLevel.deleteMany()
  await prisma.product.deleteMany()
  await prisma.warehouse.deleteMany()

  // Create warehouses
  const delhi = await prisma.warehouse.create({
    data: { name: 'Delhi Hub', location: 'New Delhi' },
  })
  const mumbai = await prisma.warehouse.create({
    data: { name: 'Mumbai Hub', location: 'Mumbai' },
  })
  const bangalore = await prisma.warehouse.create({
    data: { name: 'Bangalore Hub', location: 'Bangalore' },
  })

  // Create products
  const vitD = await prisma.product.create({
    data: {
      name: 'Vitamin D3 5000 IU',
      description: 'High-potency Vitamin D3 for bone health and immunity. 60 softgels.',
      price: 299,
      imageUrl: null,
    },
  })

  const zinc = await prisma.product.create({
    data: {
      name: 'Zinc + Magnesium',
      description: 'Essential minerals for testosterone support and recovery. 30 capsules.',
      price: 449,
      imageUrl: null,
    },
  })

  const omega = await prisma.product.create({
    data: {
      name: 'Omega-3 Fish Oil',
      description: 'Ultra-pure fish oil for cardiovascular and cognitive health. 90 softgels.',
      price: 599,
      imageUrl: null,
    },
  })

  const ashwa = await prisma.product.create({
    data: {
      name: 'Ashwagandha KSM-66',
      description: 'Clinically proven adaptogen for stress and vitality. 60 capsules.',
      price: 799,
      imageUrl: null,
    },
  })

  const coq10 = await prisma.product.create({
    data: {
      name: 'CoQ10 200mg',
      description: 'Cellular energy and antioxidant support. 30 softgels.',
      price: 999,
      imageUrl: null,
    },
  })

  // Create stock levels (some intentionally low to demo 409s)
  await prisma.stockLevel.createMany({
    data: [
      // Vitamin D3
      { productId: vitD.id, warehouseId: delhi.id, total: 50, reserved: 0 },
      { productId: vitD.id, warehouseId: mumbai.id, total: 30, reserved: 0 },
      { productId: vitD.id, warehouseId: bangalore.id, total: 2, reserved: 0 }, // low stock

      // Zinc
      { productId: zinc.id, warehouseId: delhi.id, total: 20, reserved: 0 },
      { productId: zinc.id, warehouseId: mumbai.id, total: 1, reserved: 0 }, // critical stock

      // Omega-3
      { productId: omega.id, warehouseId: delhi.id, total: 0, reserved: 0 }, // out of stock
      { productId: omega.id, warehouseId: bangalore.id, total: 15, reserved: 0 },

      // Ashwagandha
      { productId: ashwa.id, warehouseId: mumbai.id, total: 8, reserved: 0 },
      { productId: ashwa.id, warehouseId: bangalore.id, total: 12, reserved: 0 },

      // CoQ10
      { productId: coq10.id, warehouseId: delhi.id, total: 5, reserved: 0 },
      { productId: coq10.id, warehouseId: mumbai.id, total: 3, reserved: 0 },
    ],
  })

  console.log('✅ Seed complete!')
  console.log(`   ${5} products`)
  console.log(`   ${3} warehouses`)
  console.log(`   ${11} stock levels`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
