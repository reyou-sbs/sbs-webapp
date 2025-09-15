import { Hono } from 'hono'
import type { Env } from './types'

const subs = new Hono<Env>()

subs.get('/subscriptions', async (c) => {
  const storeId = Number(c.req.query('store_id')||'1')
  const rows = await c.env.Bindings.DB.prepare(
    `SELECT s.*, m.name as menu_name FROM subscriptions s
     JOIN menus m ON m.id = s.menu_id
     WHERE s.store_id=?
     ORDER BY s.next_charge_date`
  ).bind(storeId).all()
  return c.json(rows.results ?? [])
})

subs.post('/subscriptions', async (c) => {
  const b = await c.req.json<any>()
  const { store_id, customer_name, menu_id, price, cycle_type, cycle_days, specific_day, next_charge_date } = b
  if (!store_id || !menu_id || !price || !cycle_type || !next_charge_date) return c.json({ error:'missing fields' }, 400)
  if (!['days','monthly','month_end'].includes(cycle_type)) return c.json({ error:'invalid cycle_type' }, 400)
  const res = await c.env.Bindings.DB.prepare(
    `INSERT INTO subscriptions (store_id, customer_name, menu_id, price, cycle_type, cycle_days, specific_day, next_charge_date, active)
     VALUES (?,?,?,?,?,?,?,?,1)`
  ).bind(store_id, customer_name ?? null, menu_id, price, cycle_type, cycle_days ?? null, specific_day ?? null, next_charge_date).run()
  // @ts-ignore
  const id = res.meta?.last_row_id
  const row = await c.env.Bindings.DB.prepare('SELECT * FROM subscriptions WHERE id=?').bind(id).first()
  return c.json({ ok:true, id, subscription: row })
})

subs.put('/subscriptions/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const b = await c.req.json<any>()
  const allowed = ['customer_name','menu_id','price','cycle_type','cycle_days','specific_day','next_charge_date','active'] as const
  const sets:string[] = []
  const vals:any[] = []
  for (const k of allowed) {
    if (k in b) { sets.push(`${k}=?`); vals.push(b[k]) }
  }
  if (!sets.length) return c.json({ error:'no fields' }, 400)
  vals.push(id)
  await c.env.Bindings.DB.prepare(`UPDATE subscriptions SET ${sets.join(', ')} WHERE id=?`).bind(...vals).run()
  const row = await c.env.Bindings.DB.prepare('SELECT * FROM subscriptions WHERE id=?').bind(id).first()
  return c.json({ ok:true, subscription: row })
})

subs.post('/subscriptions/:id/toggle', async (c) => {
  const id = Number(c.req.param('id'))
  const row = await c.env.Bindings.DB.prepare('SELECT active FROM subscriptions WHERE id=?').bind(id).first<{active:number}>()
  if (!row) return c.json({ error:'not found' }, 404)
  const next = row.active ? 0 : 1
  await c.env.Bindings.DB.prepare('UPDATE subscriptions SET active=? WHERE id=?').bind(next, id).run()
  return c.json({ ok:true, active: next })
})

export default subs
