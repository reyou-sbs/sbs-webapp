import { Hono } from 'hono'
import type { Env } from './types'
import { requireRole } from './mw'

const approval = new Hono<Env>()

approval.post('/lock', requireRole(['HQ','AGENCY']), async (c) => {
  const { store_id, date } = await c.req.json<any>()
  if (!store_id || !date) return c.json({ error:'store_id and date required' }, 400)
  const row = await c.env.Bindings.DB.prepare('SELECT id FROM daily_reports WHERE store_id=? AND date=?').bind(store_id, date).first<{id:number}>()
  if (!row) return c.json({ error:'report not found' }, 404)
  await c.env.Bindings.DB.prepare('UPDATE daily_reports SET locked=1 WHERE id=?').bind(row.id).run()
  await c.env.Bindings.DB.prepare('INSERT INTO audit_logs (user_id, action, store_id, report_id, date, details) VALUES (?,?,?,?,?,?)')
    .bind(0, 'lock', store_id, row.id, date, 'locked by approval').run()
  return c.json({ ok: true })
})

approval.post('/unlock', requireRole('HQ'), async (c) => {
  const { store_id, date } = await c.req.json<any>()
  if (!store_id || !date) return c.json({ error:'store_id and date required' }, 400)
  const row = await c.env.Bindings.DB.prepare('SELECT id FROM daily_reports WHERE store_id=? AND date=?').bind(store_id, date).first<{id:number}>()
  if (!row) return c.json({ error:'report not found' }, 404)
  await c.env.Bindings.DB.prepare('UPDATE daily_reports SET locked=0 WHERE id=?').bind(row.id).run()
  await c.env.Bindings.DB.prepare('INSERT INTO audit_logs (user_id, action, store_id, report_id, date, details) VALUES (?,?,?,?,?,?)')
    .bind(0, 'unlock', store_id, row.id, date, 'unlocked by HQ').run()
  return c.json({ ok: true })
})

approval.get('/audit', requireRole('HQ'), async (c) => {
  const { store_id, date } = { store_id: c.req.query('store_id'), date: c.req.query('date') }
  let sql = 'SELECT * FROM audit_logs WHERE 1=1'
  const params:any[] = []
  if (store_id) { sql += ' AND store_id=?'; params.push(Number(store_id)) }
  if (date) { sql += ' AND date=?'; params.push(date) }
  sql += ' ORDER BY created_at DESC'
  const rows = await c.env.Bindings.DB.prepare(sql).bind(...params).all()
  return c.json(rows.results ?? [])
})

export default approval
