import { Hono } from 'hono'
import type { Env } from './types'
import { requireRole } from './mw'

const csvStore = new Hono<Env>()

csvStore.get('/store-monthly', async (c) => {
  const { storeId, year, month } = { storeId: c.req.query('storeId'), year: c.req.query('year'), month: c.req.query('month') }
  if (!storeId || !year || !month) return c.text('storeId, year, month required', 400)
  const ym = `${year}-${String(month).padStart(2,'0')}`
  const rows = await c.env.Bindings.DB.prepare(
    `SELECT date, sales_total, expense_total, profit, royalty
       FROM daily_reports WHERE store_id=? AND substr(date,1,7)=?
       ORDER BY date`
  ).bind(Number(storeId), ym).all()
  const header = ['date','sales','expense','profit','royalty']
  const data = (rows.results ?? []).map((r:any)=>[r.date, r.sales_total||0, r.expense_total||0, r.profit||0, r.royalty||0])
  const body = [header, ...data].map(r=>r.join(',')).join('\n')
  return new Response(body, { headers: { 'Content-Type': 'text/csv; charset=utf-8' } })
})

export default csvStore
