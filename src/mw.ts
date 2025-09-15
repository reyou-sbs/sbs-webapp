import type { Env } from './types'
import { verifyJWT } from './crypto'
import type { Context, Next } from 'hono'

export async function requireAuth(c: Context<Env>, next: Next) {
  const authz = c.req.header('authorization') || ''
  const token = authz.startsWith('Bearer ')? authz.slice(7): ''
  if (!token) return c.json({ error:'unauthorized' }, 401)
  const payload = await verifyJWT(token, c.env.Bindings.JWT_SECRET || 'dev-secret')
  if (!payload) return c.json({ error:'unauthorized' }, 401)
  c.set('user', payload)
  await next()
}

export function requireRole(role: 'HQ'|'AGENCY'|'STORE' | Array<'HQ'|'AGENCY'|'STORE'>) {
  const roles = Array.isArray(role) ? role : [role]
  return async (c: Context<Env>, next: Next) => {
    const user = c.get('user') as any
    if (!user || !roles.includes(user.role)) return c.json({ error:'forbidden' }, 403)
    await next()
  }
}
