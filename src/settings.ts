import { Hono } from 'hono'
import type { Env } from './types'

const settings = new Hono<Env>()

settings.get('/', async (c) => {
  const res = await c.env.Bindings.DB.prepare('SELECT key, value FROM settings').all<{key:string,value:string}>()
  return c.json(res.results ?? [])
})

settings.post('/', async (c) => {
  const body = await c.req.json<Record<string, string>>()
  for (const [k, v] of Object.entries(body)) {
    await c.env.Bindings.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(k, v).run()
  }
  return c.json({ ok: true })
})

settings.post('/templates', async (c) => {
  const body = await c.req.json<{ key:string, subject:string, body:string }>()
  await c.env.Bindings.DB.prepare('INSERT INTO notification_templates (key, subject, body) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET subject=excluded.subject, body=excluded.body')
    .bind(body.key, body.subject, body.body).run()
  return c.json({ ok: true })
})

export default settings
