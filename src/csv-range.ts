import { Hono } from 'hono'
import type { Env } from './types'

const csvRange = new Hono<Env>()

// Agency range monthly summary per store
csvRange.get('/agency-range', async (c) => {
  const agencyId = Number(c.req.query('agencyId'))
  const start = c.req.query('start')
  const end = c.req.query('end')
  if (!agencyId || !start || !end) return c.text('agencyId, start, end required (YYYY-MM)', 400)
  const rows = await c.env.Bindings.DB.prepare(
    `SELECT s.name as store, substr(dr.date,1,7) as ym,
            SUM(dr.sales_total) as sales, SUM(dr.expense_total) as expense,
            SUM(dr.profit) as profit, SUM(dr.royalty) as royalty,
            SUM(ac.amount) as agency_reward
       FROM stores s
       JOIN daily_reports dr ON dr.store_id = s.id
       LEFT JOIN agency_commissions ac ON ac.report_id = dr.id AND ac.agency_id = s.agency_id
       WHERE s.agency_id = ? AND substr(dr.date,1,7) BETWEEN ? AND ?
       GROUP BY s.name, ym
       ORDER BY s.name, ym`
  ).bind(agencyId, start, end).all()
  const header = ['store','ym','sales','expense','profit','royalty','agency_reward']
  const data = (rows.results ?? []).map((r:any)=>[
    r.store, r.ym, r.sales||0, r.expense||0, r.profit||0, r.royalty||0, r.agency_reward||0
  ])
  const body = [header, ...data].map(r=>r.join(',')).join('\n')
  return new Response(body, { headers: { 'Content-Type': 'text/csv; charset=utf-8' } })
})

// HQ range monthly summary per store
csvRange.get('/hq-range', async (c) => {
  const start = c.req.query('start')
  const end = c.req.query('end')
  if (!start || !end) return c.text('start, end required (YYYY-MM)', 400)
  const rows = await c.env.Bindings.DB.prepare(
    `SELECT a.name as agency, s.name as store, substr(dr.date,1,7) as ym,
            SUM(dr.sales_total) as sales, SUM(dr.expense_total) as expense,
            SUM(dr.profit) as profit, SUM(dr.royalty) as royalty
       FROM daily_reports dr
       JOIN stores s ON s.id = dr.store_id
       JOIN agencies a ON a.id = s.agency_id
       WHERE substr(dr.date,1,7) BETWEEN ? AND ?
       GROUP BY a.name, s.name, ym
       ORDER BY a.name, s.name, ym`
  ).bind(start, end).all()
  const header = ['agency','store','ym','sales','expense','profit','royalty']
  const data = (rows.results ?? []).map((r:any)=>[
    r.agency, r.store, r.ym, r.sales||0, r.expense||0, r.profit||0, r.royalty||0
  ])
  const body = [header, ...data].map(r=>r.join(',')).join('\n')
  return new Response(body, { headers: { 'Content-Type': 'text/csv; charset=utf-8' } })
})

// Store range daily rows
csvRange.get('/store-range', async (c) => {
  const storeId = Number(c.req.query('storeId'))
  const start = c.req.query('start')
  const end = c.req.query('end')
  if (!storeId || !start || !end) return c.text('storeId, start, end required (YYYY-MM)', 400)
  const rows = await c.env.Bindings.DB.prepare(
    `SELECT date, sales_total, expense_total, profit, royalty
       FROM daily_reports
       WHERE store_id=? AND substr(date,1,7) BETWEEN ? AND ?
       ORDER BY date`
  ).bind(storeId, start, end).all()
  const header = ['date','sales','expense','profit','royalty']
  const data = (rows.results ?? []).map((r:any)=>[
    r.date, r.sales_total||0, r.expense_total||0, r.profit||0, r.royalty||0
  ])
  const body = [header, ...data].map(r=>r.join(',')).join('\n')
  return new Response(body, { headers: { 'Content-Type': 'text/csv; charset=utf-8' } })
})

export default csvRange
