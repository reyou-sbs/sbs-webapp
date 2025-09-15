import { Hono } from 'hono'
import type { Env } from './types'

const auth = new Hono<Env>()

auth.post('/login', async (c) => {
  const { email } = await c.req.json()
  return c.json({ ok: true, email })
})

export default auth
