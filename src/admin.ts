import { Hono } from 'hono'
import type { Env } from './types'
import { requireRole } from './mw'

const admin = new Hono<Env>()

// Agencies
admin.get('/agencies', requireRole('HQ'), async (c) => {
  const rows = await c.env.Bindings.DB.prepare('SELECT * FROM agencies ORDER BY id').all()
  return c.json(rows.results ?? [])
})
admin.post('/agencies', requireRole('HQ'), async (c) => {
  const { name } = await c.req.json<any>()
  if (!name) return c.json({ error:'name required' }, 400)
  await c.env.Bindings.DB.prepare('INSERT INTO agencies (name) VALUES (?)').bind(name).run()
  return c.json({ ok: true })
})
admin.put('/agencies/:id', requireRole('HQ'), async (c) => {
  const id = Number(c.req.param('id'))
  const { name } = await c.req.json<any>()
  if (!name) return c.json({ error:'name required' }, 400)
  await c.env.Bindings.DB.prepare('UPDATE agencies SET name=? WHERE id=?').bind(name, id).run()
  return c.json({ ok: true })
})

// Stores
admin.get('/stores', requireRole('HQ'), async (c) => {
  const rows = await c.env.Bindings.DB.prepare('SELECT * FROM stores ORDER BY id').all()
  return c.json(rows.results ?? [])
})
admin.post('/stores', requireRole('HQ'), async (c) => {
  const { name, agency_id } = await c.req.json<any>()
  if (!name) return c.json({ error:'name required' }, 400)
  await c.env.Bindings.DB.prepare('INSERT INTO stores (name, agency_id) VALUES (?,?)').bind(name, agency_id ?? null).run()
  return c.json({ ok: true })
})
admin.put('/stores/:id', requireRole('HQ'), async (c) => {
  const id = Number(c.req.param('id'))
  const { name, agency_id } = await c.req.json<any>()
  await c.env.Bindings.DB.prepare('UPDATE stores SET name=?, agency_id=? WHERE id=?').bind(name ?? null, agency_id ?? null, id).run()
  return c.json({ ok: true })
})

// Menus
admin.get('/menus', requireRole('HQ'), async (c) => {
  const rows = await c.env.Bindings.DB.prepare('SELECT * FROM menus ORDER BY id').all()
  return c.json(rows.results ?? [])
})
admin.post('/menus', requireRole('HQ'), async (c) => {
  const { name, price, active=1 } = await c.req.json<any>()
  if (!name || !price) return c.json({ error:'name and price required' }, 400)
  await c.env.Bindings.DB.prepare('INSERT INTO menus (name, price, active) VALUES (?,?,?)').bind(name, price, active ? 1 : 0).run()
  return c.json({ ok: true })
})
admin.put('/menus/:id', requireRole('HQ'), async (c) => {
  const id = Number(c.req.param('id'))
  const { name, price, active } = await c.req.json<any>()
  const sets = [] as string[]; const vals = [] as any[]
  if (name!==undefined) { sets.push('name=?'); vals.push(name) }
  if (price!==undefined) { sets.push('price=?'); vals.push(price) }
  if (active!==undefined) { sets.push('active=?'); vals.push(active?1:0) }
  if (!sets.length) return c.json({ error:'no fields' }, 400)
  vals.push(id)
  await c.env.Bindings.DB.prepare(`UPDATE menus SET ${sets.join(', ')} WHERE id=?`).bind(...vals).run()
  return c.json({ ok: true })
})

// Expense Categories
admin.get('/expense-categories', requireRole('HQ'), async (c) => {
  const rows = await c.env.Bindings.DB.prepare('SELECT * FROM expense_categories ORDER BY id').all()
  return c.json(rows.results ?? [])
})
admin.post('/expense-categories', requireRole('HQ'), async (c) => {
  const { name, active=1 } = await c.req.json<any>()
  if (!name) return c.json({ error:'name required' }, 400)
  await c.env.Bindings.DB.prepare('INSERT INTO expense_categories (name, active) VALUES (?,?)').bind(name, active?1:0).run()
  return c.json({ ok: true })
})
admin.put('/expense-categories/:id', requireRole('HQ'), async (c) => {
  const id = Number(c.req.param('id'))
  const { name, active } = await c.req.json<any>()
  const sets = [] as string[]; const vals = [] as any[]
  if (name!==undefined) { sets.push('name=?'); vals.push(name) }
  if (active!==undefined) { sets.push('active=?'); vals.push(active?1:0) }
  if (!sets.length) return c.json({ error:'no fields' }, 400)
  vals.push(id)
  await c.env.Bindings.DB.prepare(`UPDATE expense_categories SET ${sets.join(', ')} WHERE id=?`).bind(...vals).run()
  return c.json({ ok: true })
})

export default admin
