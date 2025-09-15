import { Hono } from 'hono'
import type { Env } from './types'
import { hashPassword, verifyPassword, signJWT, verifyJWT } from './crypto'

const auth = new Hono<Env>()

auth.post('/register', async (c) => {
  const { email, password, role='STORE', agency_id=null, store_id=null } = await c.req.json<any>()
  if (!email || !password) return c.json({ error:'email and password required' }, 400)
  const hashed = await hashPassword(password)
  const token = crypto.randomUUID()
  try {
    await c.env.Bindings.DB.prepare('INSERT INTO users (email, password_hash, role, agency_id, store_id, verified, verify_token) VALUES (?,?,?,?,?,0,?)')
      .bind(email, hashed, role, agency_id, store_id, token).run()
  } catch (e) {
    return c.json({ error: 'email already exists' }, 409)
  }
  // Send verify email if configured
  try {
    const { maybeSendSingleSale } = await import('./notifications')
    const url = `${new URL(c.req.url).origin}/auth/verify?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`
    const payload = { store: '登録', date: '', sales_total: 0 } // reuse sender plumbing
    await fetch('https://api.resend.com/emails', { method:'POST', headers:{ 'Authorization': `Bearer ${c.env.Bindings.RESEND_API_KEY||''}`, 'Content-Type':'application/json' }, body: JSON.stringify({ from:'noreply@example.com', to: email, subject:'メール確認', html:`登録ありがとうございます。確認URL: <a href="${url}">${url}</a>` }) })
  } catch {}
  return c.json({ ok: true })
})

auth.get('/verify', async (c) => {
  const email = c.req.query('email')
  const token = c.req.query('token')
  if(!email || !token) return c.text('invalid', 400)
  const row = await c.env.Bindings.DB.prepare('SELECT id FROM users WHERE email=? AND verify_token=?').bind(email, token).first<{id:number}>()
  if(!row) return c.text('invalid token', 400)
  await c.env.Bindings.DB.prepare('UPDATE users SET verified=1, verify_token=NULL WHERE id=?').bind(row.id).run()
  return c.text('verified')
})

auth.post('/login', async (c) => {
  const { email, password } = await c.req.json<any>()
  if (!email || !password) return c.json({ error:'email and password required' }, 400)
  const user = await c.env.Bindings.DB.prepare('SELECT id, email, password_hash, role, agency_id, store_id, verified FROM users WHERE email=?').bind(email).first<any>()
  if (!user) return c.json({ error:'invalid credentials' }, 401)
  if (!(await verifyPassword(password, user.password_hash))) return c.json({ error:'invalid credentials' }, 401)
  if (!user.verified) return c.json({ error:'email not verified' }, 403)
  const secret = c.env.Bindings.JWT_SECRET || 'dev-secret'
  const token = await signJWT({ uid: user.id, role: user.role, agency_id: user.agency_id, store_id: user.store_id }, secret, 60*60*24)
  return c.json({ ok: true, token })
})

auth.get('/me', async (c) => {
  const authz = c.req.header('authorization')||''
  const token = authz.startsWith('Bearer ')? authz.slice(7): ''
  if (!token) return c.json({ error:'no token' }, 401)
  const payload = await verifyJWT(token, c.env.Bindings.JWT_SECRET || 'dev-secret')
  if (!payload) return c.json({ error:'invalid token' }, 401)
  return c.json({ ok: true, user: payload })
})

export default auth
