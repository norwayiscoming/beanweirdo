import type { VercelRequest, VercelResponse } from '@vercel/node'

export type Handler = (req: VercelRequest, res: VercelResponse) => void | Promise<void>

/**
 * Every method the admin app actually sends.
 *
 * `PUT` was missing, and the two endpoints that use it — reordering modules and
 * reordering posts inside a module — were dead in the browser: the preflight
 * answered without `PUT` in this list, so the request never left. No error
 * reached the server and no response reached `apiClient`, so the CMS showed the
 * new order optimistically and the site kept the old one.
 */
export const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const

/** How long a browser may reuse a preflight answer, in seconds. */
export const PREFLIGHT_MAX_AGE_S = 600

/**
 * Sets CORS headers on every response and short-circuits OPTIONS preflight
 * requests with a 204. Every route in this app is wrapped with `withCors` so
 * none of them can forget it.
 */
export function applyCorsHeaders(req: VercelRequest, res: VercelResponse): void {
  const origin = process.env.ADMIN_ALLOWED_ORIGIN ?? ''
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS.join(', '))
  /*
   * Without this, every single admin request costs two round trips.
   *
   * The admin app and this API are separate deployments, so every call is
   * cross-origin, and `request` in apiClient sends `Authorization` on all of
   * them. That header is not CORS-safelisted, so the browser preflights even
   * GETs. With no Max-Age, Chrome remembers a preflight for five seconds: any
   * two clicks further apart than that pay for the OPTIONS again. And OPTIONS
   * is answered by this function, not at the edge (see `withCors` below), so
   * the wasted trip can cold-start a lambda of its own.
   *
   * Ten minutes, not a day. The headers and methods above never change at
   * runtime, but they do change between deploys: when PUT was added, browsers
   * kept the old answer for up to two hours (Chrome's cap on a day-long
   * Max-Age), and the owner had to hard-reload to see the fix. Ten minutes
   * still spares every click inside a working session a second round trip.
   */
  res.setHeader('Access-Control-Max-Age', String(PREFLIGHT_MAX_AGE_S))
}

export function withCors(handler: Handler): Handler {
  return async (req, res) => {
    applyCorsHeaders(req, res)
    if (req.method === 'OPTIONS') {
      res.status(204).end()
      return
    }
    await handler(req, res)
  }
}
