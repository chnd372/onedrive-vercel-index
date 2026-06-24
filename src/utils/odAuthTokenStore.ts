// Persistent key-value store is provided by Redis, hosted on Upstash
// https://vercel.com/integrations/upstash
// Use REST API for serverless reliability (no persistent connection needed)

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

async function redisGet(key: string): Promise<string | null> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null
  try {
    const res = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.result
  } catch (e) {
    console.error('Redis GET error:', e)
    return null
  }
}

async function redisSet(key: string, value: string, expirySeconds?: number): Promise<void> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return
  try {
    // EX option for expiry (in seconds)
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
      console.error('Redis SET error:', res.status, text)
    }
  } catch (e) {
    console.error('Redis SET error:', e)
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
  // Note: URLSearchParams strips the value, so we need to encode the token in the URL
  await redisSet(`${siteConfig.kvPrefix}access_token`, accessToken, accessTokenExpiry)
  await redisSet(`${siteConfig.kvPrefix}refresh_token`, refreshToken)
}

import siteConfig from '../../config/site.config'
