import Redis from 'ioredis'

const globalForRedis = globalThis as unknown as { redis: Redis }

function createRedisClient() {
  const url = process.env.REDIS_URL

  if (!url) {
    console.warn('⚠️  REDIS_URL not set — locking will be skipped (not safe for production)')
    return null
  }

  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    lazyConnect: false,
  })

  client.on('error', (err) => {
    console.error('Redis error:', err)
  })

  return client
}

export const redis = globalForRedis.redis ?? createRedisClient()

if (process.env.NODE_ENV !== 'production' && redis) {
  globalForRedis.redis = redis as Redis
}
