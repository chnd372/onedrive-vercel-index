import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL
  const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN
  
  const result: any = {
    hasUrl: !!UPSTASH_URL,
    urlPrefix: UPSTASH_URL ? UPSTASH_URL.substring(0, 30) + '...' : null,
    hasToken: !!UPSTASH_TOKEN,
    tokenLen: UPSTASH_TOKEN?.length ?? 0,
  }
  
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    return res.status(500).json({ ...result, error: 'Upstash env vars missing' })
  }
  
  try {
    // Test 1: PING (Upstash REST doesn't have PING, try SET/GET)
    const testKey = `__test_${Date.now()}`
    const testVal = `hello_${Math.random()}`
    
    const setRes = await fetch(`${UPSTASH_URL}/set/${testKey}/${testVal}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      signal: AbortSignal.timeout(8000),
    })
    const setText = await setRes.text()
    result.setStatus = setRes.status
    result.setBody = setText.substring(0, 200)
    
    if (setRes.ok) {
      const getRes = await fetch(`${UPSTASH_URL}/get/${testKey}`, {
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
        signal: AbortSignal.timeout(8000),
      })
      const getJson = await getRes.json()
      result.getStatus = getRes.status
      result.getValue = getJson.result
      result.matches = getJson.result === testVal
    }
    
    res.status(200).json(result)
  } catch (e: any) {
    res.status(500).json({ ...result, error: e.message, stack: e.stack })
  }
}
