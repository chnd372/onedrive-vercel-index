import siteConfig from '../../config/site.config'

// Persistent key-value store is provided by Redis, hosted on Upstash
// https://vercel.com/integrations/upstash
// Use REST API for serverless reliability (no persistent connection needed)
//
// Env vars used:
//   UPSTASH_REDIS_REST_URL    - Upstash REST endpoint (https://...)
//   UPSTASH_REDIS_REST_TOKEN  - Upstash REST token
// Optional fallback to old REDIS_URL for diagnostics.

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

if (!UPSTASH_URL || !UPSTASH_TOKEN) {
  console.warn('[odAuthTokenStore] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN env vars are not set.')
}

async function redisGet(key: string): Promise<string | null> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null
  try {
    const res = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      console.error(`[odAuthTokenStore] Redis GET ${key} returned ${res.status}`)
      return null
    }
    const data = (await res.json()) as { result?: string | null }
    return data.result ?? null
  } catch (e) {
    console.error('[odAuthTokenStore] Redis GET error:', e)
    return null
  }
}

async function redisSet(key: string, value: string, expirySeconds?: number): Promise<void> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    console.warn(`[odAuthTokenStore] Redis SET ${key} skipped (no Upstash env vars)`)
    return
  }
  try {
    const url = expirySeconds
      ? `${UPSTASH_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}?EX=${expirySeconds}`
      : `${UPSTASH_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      const text = await res.text()
      console.error(`[odAuthTokenStore] Redis SET ${key} failed: ${res.status} ${text}`)
    } else {
      console.log(`[odAuthTokenStore] Redis SET ${key} ok`)
    }
  } catch (e) {
    console.error('[odAuthTokenStore] Redis SET error:', e)
  }
}

export async function getOdAuthTokens(): Promise<{ accessToken: unknown; refreshToken: unknown }> {
  const accessToken = await redisGet(`${siteConfig.kvPrefix}access_token`)
  const refreshToken = await redisGet(`${siteConfig.kvPrefix}refresh_token`)

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
  await redisSet(`${siteConfig.kvPrefix}access_token`, accessToken, accessTokenExpiry)
  await redisSet(`${siteConfig.kvPrefix}refresh_token`, refreshToken)
}
