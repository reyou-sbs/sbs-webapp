import { Hono } from 'hono'
import type { Env } from './types'
import { applyInit } from './migrations'

const api = new Hono<Env>()

api.get('/menus', async (c) => {
  // placeholder
  return c.json([{ id: 1, name: 'Facial A', price: 8000 }])
})

api.post('/init', async (c) => {
  await applyInit(c.env.Bindings)
  return c.json({ ok: true })
})

export default api
