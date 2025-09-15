import { Hono } from 'hono'
import type { Env } from './types'
import { requireRole } from './mw'

const csvhq = new Hono<Env>()

csvhq.get('/hq-monthly', requireRole('HQ'), async (c) => {
  const { year, month } = { year: c.req.query('year'), month: c.req.query('month') }
  if (!year || !month) return c.text('year, month required', 400)
  const ym = `${year}-${String(month).padStart(2,'0')}`
  const rows = await c.env.Bindings.DB.prepare(
    `SELECT s.name as store, a.name as agency, substr(dr.date,1,7) as ym,
            SUM(dr.sales_total) as sales, SUM(dr.expense_total) as expense, SUM(dr.profit) as profit, SUM(dr.royalty) as royalty
       FROM daily_reports dr
       JOIN stores s ON s.id = dr.store_id
       JOIN agencies a ON a.id = s.agency_id
       WHERE substr(dr.date,1,7)=?
       GROUP BY s.id, s.name, a.name, ym
       ORDER BY a.name, s.name`
  ).bind(ym).all()
  const header = ['agency','store','year','month','sales','expense','profit','royalty']
  const data = (rows.results ?? []).map((r:any)=>[
    r.agency, r.store, ym.slice(0,4), ym.slice(5,7), r.sales||0, r.expense||0, r.profit||0, r.royalty||0
  ])
  const body = [header, ...data].map(r=>r.join(',')).join('\n')
  return new Response(body, { headers: { 'Content-Type': 'text/csv; charset=utf-8' } })
})

export default csvhq
