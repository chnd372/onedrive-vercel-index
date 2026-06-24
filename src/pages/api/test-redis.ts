import type { NextApiRequest, NextApiResponse } from 'next'
import https from 'https'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL
  const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN
  
  const result: any = {
    hasUrl: !!UPSTASH_URL,
    urlPrefix: UPSTASH_URL ? UPSTASH_URL.substring(0, 40) + '...' : null,
    hasToken: !!UPSTASH_TOKEN,
    tokenLen: UPSTASH_TOKEN?.length ?? 0,
    nodeVersion: process.version,
  }
  
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    return res.status(500).json({ ...result, error: 'env vars missing' })
  }
  
  // Test 1: Try fetch with detailed error
  try {
    const testKey = `__test_${Date.now()}`
    const testVal = 'hi'
    const setRes = await fetch(`${UPSTASH_URL}/set/${testKey}/${testVal}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      signal: AbortSignal.timeout(8000),
    })
    result.fetchOk = true
    result.fetchStatus = setRes.status
  } catch (e: any) {
    result.fetchOk = false
    result.fetchError = {
      name: e.name,
      message: e.message,
      cause: e.cause ? {
        name: e.cause.name,
        message: e.cause.message,
        code: e.cause.code,
        syscall: e.cause.syscall,
        address: e.cause.address,
        port: e.cause.port,
      } : null,
      stack: e.stack?.substring(0, 500),
    }
  }
  
  // Test 2: Try node:https
  try {
    const url = new URL(UPSTASH_URL)
    const hostname = url.hostname
    const port = url.port ? parseInt(url.port) : 443
    
    await new Promise<void>((resolve, reject) => {
      const req = https.request({
        hostname,
        port,
        path: '/ping',
        method: 'GET',
        timeout: 8000,
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      }, (resp) => {
        result.httpsStatus = resp.statusCode
        result.httpsHeaders = {
          server: resp.headers['server'],
          via: resp.headers['via'],
        }
        resp.resume()
        resp.on('end', () => resolve())
        resp.on('error', reject)
      })
      req.on('error', (e) => {
        result.httpsError = {
          code: (e as any).code,
          message: e.message,
        }
        reject(e)
      })
      req.on('timeout', () => {
        result.httpsError = { code: 'TIMEOUT', message: 'node:https timed out' }
        req.destroy()
        reject(new Error('timeout'))
      })
      req.end()
    })
  } catch (e: any) {
    result.httpsFailed = true
    result.httpsErrMessage = e.message
  }
  
  res.status(200).json(result)
}
