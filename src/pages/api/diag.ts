import type { NextApiRequest, NextApiResponse } from 'next'
import https from 'https'

// Debug endpoint V2 - signature: "DIAG-V2-MARKER-12345"
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL
  const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN
  
  const result: any = {
    diagVersion: 'V2-12345',
    nodeVersion: process.version,
    hasUrl: !!UPSTASH_URL,
    urlPrefix: UPSTASH_URL ? UPSTASH_URL.substring(0, 40) + '...' : null,
    hasToken: !!UPSTASH_TOKEN,
    tokenLen: UPSTASH_TOKEN?.length ?? 0,
  }
  
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    return res.status(500).json({ ...result, error: 'env vars missing' })
  }
  
  // Test 1: fetch
  try {
    const testKey = `__t_${Date.now()}`
    const testVal = 'hi'
    const setRes = await fetch(`${UPSTASH_URL}/set/${testKey}/${testVal}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      signal: AbortSignal.timeout(8000),
    })
    result.fetchStatus = setRes.status
    result.fetchOk = true
  } catch (e: any) {
    result.fetchOk = false
    result.fetchErrName = e.name
    result.fetchErrMessage = e.message
    result.fetchErrCause = e.cause ? {
      code: e.cause.code,
      message: e.cause.message,
      syscall: e.cause.syscall,
      address: e.cause.address,
      port: e.cause.port,
    } : null
  }
  
  // Test 2: node:https
  try {
    const url = new URL(UPSTASH_URL)
    const hostname = url.hostname
    await new Promise<void>((resolve, reject) => {
      const req = https.request({
        hostname,
        port: 443,
        path: '/ping',
        method: 'GET',
        timeout: 8000,
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      }, (resp) => {
        result.httpsStatus = resp.statusCode
        result.httpsOk = true
        resp.resume()
        resp.on('end', () => resolve())
        resp.on('error', reject)
      })
      req.on('error', (e: any) => {
        result.httpsOk = false
        result.httpsErr = {
          code: e.code,
          message: e.message,
        }
        reject(e)
      })
      req.on('timeout', () => {
        result.httpsOk = false
        result.httpsErr = { code: 'TIMEOUT' }
        req.destroy()
        reject(new Error('timeout'))
      })
      req.end()
    })
  } catch (e: any) {
    if (!result.httpsErr) {
      result.httpsErr = { message: e.message }
    }
  }
  
  res.status(200).json(result)
}
