# Allo Inventory — Take-Home Exercise

An inventory reservation system built with Next.js, Prisma, PostgreSQL, and Redis.

## Live Demo

🌐 **[your-app.vercel.app](https://your-app.vercel.app)** ← update this after deploying

---

## Running Locally

### 1. Clone and install

```bash
git clone https://github.com/your-username/allo-inventory
cd allo-inventory
npm install
```

### 2. Set up services

You need two external services (both have free tiers):

**PostgreSQL** — [Supabase](https://supabase.com) (recommended)
1. Create a new project
2. Go to Settings → Database → Connection string → URI
3. Copy the connection string

**Redis** — [Upstash](https://upstash.com)
1. Create a new Redis database
2. Go to Connect → ioredis
3. Copy the Redis URL

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```env
DATABASE_URL="postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres"
DIRECT_URL="postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres"
REDIS_URL="redis://default:PASSWORD@HOST.upstash.io:6379"
CRON_SECRET="any-random-string"
```

### 4. Run migrations and seed

```bash
# Generate Prisma client
npx prisma generate

# Run migrations (creates tables)
npx prisma migrate dev --name init

# Seed with sample data
npx prisma db seed
```

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Architecture

```
app/
├── page.tsx                          Product listing
├── reservation/[id]/page.tsx         Checkout with countdown
└── api/
    ├── products/route.ts             GET  /api/products
    ├── warehouses/route.ts           GET  /api/warehouses
    ├── reservations/route.ts         POST /api/reservations
    ├── reservations/[id]/
    │   ├── confirm/route.ts          POST /api/reservations/:id/confirm
    │   └── release/route.ts          POST /api/reservations/:id/release
    └── cron/expire/route.ts          GET  /api/cron/expire

lib/
├── prisma.ts                         Singleton Prisma client
├── redis.ts                          Singleton Redis client
└── lock.ts                           Distributed lock helpers
```

---

## How Concurrency Is Handled

This is the core of the exercise. The reservation endpoint must be correct when two requests arrive simultaneously for the last unit of a product.

**The problem without locking:**
1. Request A reads stock: `available = 1`
2. Request B reads stock: `available = 1`
3. Request A creates reservation, increments reserved
4. Request B creates reservation, increments reserved
5. Both succeed — two customers hold the same physical unit ❌

**The solution — Redis distributed lock:**

```
Request A  ──► acquireLock("stock:productId:warehouseId") → OK
Request B  ──► acquireLock("stock:productId:warehouseId") → FAIL (409)

Request A reads stock → checks available → atomic transaction:
  - CREATE reservation
  - UPDATE stockLevel SET reserved += quantity

Request A ──► releaseLock()

Request B retries → lock acquired → reads updated stock → proceeds or 409
```

`SET key 1 NX PX 8000` is Redis's atomic "set if not exists" operation. Only one of concurrent requests can get `OK`. The lock TTL (8 seconds) ensures it's always released even if the server crashes.

The `prisma.$transaction([...])` ensures the reservation row and stock increment are committed atomically — if either fails, both roll back.

---

## Reservation Expiry

Reservations have a 10-minute window (`expiresAt`). If not confirmed, units return to stock automatically.

**Two mechanisms:**

**1. Lazy cleanup (always on):** The `GET /api/products` endpoint releases expired reservations before returning stock data. This means available counts are always accurate when the user is browsing.

**2. Vercel Cron Job (production):** `vercel.json` configures `/api/cron/expire` to run every minute. This handles reservations that expired while no one was browsing.

Protected with `CRON_SECRET` env var to prevent public triggering.

---

## Idempotency (Bonus)

The `POST /api/reservations` endpoint supports an `Idempotency-Key` header.

If a client sends the same key twice (e.g. a retry after a network timeout), the server returns the original response without creating a second reservation or decrementing stock again.

Implementation: the key is stored in the `idempotencyKey` unique column on the `Reservation` table. On retry, we find the existing row and return it.

```bash
curl -X POST /api/reservations \
  -H "Idempotency-Key: client-uuid-1234" \
  -d '{"productId":"...","warehouseId":"...","quantity":1}'
```

---

## Trade-offs and What I'd Do Differently

**Trade-offs made:**
- Used `sessionStorage` to pass reservation data to the checkout page rather than a `GET /api/reservations/:id` endpoint. This avoids an extra round-trip but means the checkout page breaks on hard refresh. A `GET` endpoint would fix this.
- The distributed lock uses a simple TTL-based approach. A more robust implementation would use Redlock (the multi-node Redis algorithm) to survive Redis restarts.
- Lazy expiry runs on every product list request. Under high traffic, this should be moved entirely to the cron job to avoid adding latency to reads.

**With more time:**
- Add user authentication so reservations are tied to accounts
- Add a `GET /api/reservations/:id` endpoint
- Add optimistic UI updates (update stock counts locally on reserve)
- Add proper error boundaries and loading skeletons
- Write integration tests for the concurrency scenario (spin up two concurrent fetch calls and assert only one 201)
- Use Redlock for multi-node Redis safety

---

## Deployment

```bash
# Push to GitHub
git init && git add . && git commit -m "initial commit"
git push

# Deploy to Vercel
# 1. Import repo at vercel.com
# 2. Add env vars (DATABASE_URL, DIRECT_URL, REDIS_URL, CRON_SECRET)
# 3. Deploy

# After first deploy, run migrations against production DB:
npx prisma migrate deploy
npx prisma db seed
```
