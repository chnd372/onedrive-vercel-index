// Updated: 2026-06-24 17:37:40 - new Upstash DB
import siteConfig from '../../config/site.config'

// Persistent key-value store is provided by Redis, hosted on Upstash
// https://vercel.com/integrations/upstash
//
// Env vars used:
//   UPSTASH_REDIS_REST_URL    - Upstash REST endpoint (https://...)
//   UPSTASH_REDIS_REST_TOKEN  - Upstash REST token

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

// Diagnostics: log on cold start
console.log('[odAuthTokenStore] UPSTASH_URL:', UPSTASH_URL ? `${UPSTASH_URL.substring(0, 30)}...` : 'NOT SET')
console.log('[odAuthTokenStore] UPSTASH_TOKEN:', UPSTASH_TOKEN ? `${UPSTASH_TOKEN.substring(0, 10)}... (len=${UPSTASH_TOKEN.length})` : 'NOT SET')

async function redisGet(key: string): Promise<string | null> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    console.warn(`[odAuthTokenStore] redisGet(${key}): env vars missing`)
    return null
  }
  try {
    const url = `${UPSTASH_URL}/get/${encodeURIComponent(key)}`
    console.log(`[odAuthTokenStore] redisGet(${key}) → ${url}`)
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      signal: AbortSignal.timeout(8000),
    })
    console.log(`[odAuthTokenStore] redisGet(${key}) status: ${res.status}`)
    if (!res.ok) {
      const text = await res.text()
      console.error(`[odAuthTokenStore] redisGet ${key} error: ${res.status} ${text}`)
      return null
    }
    const data = (await res.json()) as { result?: string | null }
    return data.result ?? null
  } catch (e) {
    console.error(`[odAuthTokenStore] redisGet ${key} threw:`, e)
    return null
  }
}

async function redisSet(key: string, value: string, expirySeconds?: number): Promise<void> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    throw new Error(`UPSTASH_REDIS_REST_URL/TOKEN not set; cannot SET ${key}`)
  }
  try {
    const url = expirySeconds
      ? `${UPSTASH_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}?EX=${expirySeconds}`
      : `${UPSTASH_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`
    console.log(`[odAuthTokenStore] redisSet(${key}) → ${url.substring(0, 100)}...`)
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      signal: AbortSignal.timeout(8000),
    })
    const text = await res.text()
    console.log(`[odAuthTokenStore] redisSet(${key}) status: ${res.status}, body: ${text.substring(0, 100)}`)
    if (!res.ok) {
      throw new Error(`Redis SET ${key} failed: ${res.status} ${text}`)
    }
  } catch (e) {
    console.error(`[odAuthTokenStore] redisSet ${key} threw:`, e)
    throw e
  }
}

export async function getOdAuthTokens(): Promise<{ accessToken: unknown; refreshToken: unknown }> {
  const accessToken = await redisGet(`${siteConfig.kvPrefix}access_token`)
  const refreshToken = await redisGet(`${siteConfig.kvPrefix}refresh_token`)
  console.log(`[odAuthTokenStore] getOdAuthTokens: accessToken.len=${(accessToken as string)?.length ?? 0}, refreshToken.len=${(refreshToken as string)?.length ?? 0}`)
  return {
    accessToken,
    refreshToken,
  }
}

export async function storeOdAuthTokens({
  accessToken,
  accessTokenExpiry,
  refreshToken,
}: {
  accessToken: string
  accessTokenExpiry: number
  refreshToken: string
}): Promise<void> {
  console.log(`[odAuthTokenStore] storeOdAuthTokens called: accessToken.len=${accessToken.length}, refreshToken.len=${refreshToken.length}, expiry=${accessTokenExpiry}`)
  await redisSet(`${siteConfig.kvPrefix}access_token`, accessToken, accessTokenExpiry)
  await redisSet(`${siteConfig.kvPrefix}refresh_token`, refreshToken)
  console.log(`[odAuthTokenStore] storeOdAuthTokens completed`)
}
