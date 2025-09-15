import { Hono } from 'hono'
import type { Env } from './types'
import { applyInit } from './migrations'

const api = new Hono<Env>()

api.get('/menus', async (c) => {
  const rows = await c.env.Bindings.DB.prepare('SELECT id, name, price FROM menus ORDER BY id').all()
  if (!rows || !('results' in rows)) return c.json([])
  return c.json(rows.results)
})

api.post('/init', async (c) => {
  await applyInit(c.env.Bindings)
  return c.json({ ok: true })
})

export default api
