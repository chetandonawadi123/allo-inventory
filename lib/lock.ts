import { redis } from './redis'

/**
 * Acquires a distributed lock using Redis SET NX PX.
 * Returns true if the lock was acquired, false if already held.
 *
 * This prevents race conditions when two requests simultaneously
 * try to reserve the last unit of a product in a warehouse.
 */
export async function acquireLock(key: string, ttlMs = 5000): Promise<boolean> {
  if (!redis) {
    // No Redis — log warning and allow (unsafe, only for local dev without Redis)
    console.warn(`⚠️  No Redis — skipping lock for key: ${key}`)
    return true
  }

  const result = await (redis as import('ioredis').Redis).set(
    `lock:${key}`,
    '1',
    'PX',
    ttlMs,
    'NX'
  )

  return result === 'OK'
}

/**
 * Releases a distributed lock.
 */
export async function releaseLock(key: string): Promise<void> {
  if (!redis) return
  await (redis as import('ioredis').Redis).del(`lock:${key}`)
}
