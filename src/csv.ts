import { Hono } from 'hono'
import type { Env } from './types'

const csv = new Hono<Env>()

csv.get('/agency-summary', async (c) => {
  const env = c.env.Bindings
  const agencyId = Number(c.req.query('agencyId'))
  const year = c.req.query('year')
  const month = c.req.query('month')
  if (!agencyId || !year || !month) return c.text('agencyId, year, month are required', 400)
  const ym = `${year}-${month.padStart(2,'0')}`
  const rows: string[][] = [[ 'store','year','month','sales','expense','profit','royalty','agency_reward' ]]
  const data = await env.DB.prepare(
    `SELECT s.name as store, substr(dr.date,1,4) as year, substr(dr.date,6,2) as month,
            SUM(dr.sales_total) as sales, SUM(dr.expense_total) as expense,
            SUM(dr.profit) as profit, SUM(dr.royalty) as royalty,
            SUM(ac.amount) as agency_reward
       FROM stores s
       JOIN daily_reports dr ON dr.store_id = s.id
       LEFT JOIN agency_commissions ac ON ac.report_id = dr.id AND ac.agency_id = s.agency_id
       WHERE s.agency_id = ? AND substr(dr.date,1,7)=?
       GROUP BY s.name, year, month
       ORDER BY s.name`
  ).bind(agencyId, ym).all()
  for (const r of data.results ?? []) {
    rows.push([
      String((r as any).store), String((r as any).year), String((r as any).month),
      String((r as any).sales ?? 0), String((r as any).expense ?? 0), String((r as any).profit ?? 0),
      String((r as any).royalty ?? 0), String((r as any).agency_reward ?? 0)
    ])
  }
  const body = rows.map(r => r.join(',')).join('\n')
  return new Response(body, { headers: { 'Content-Type': 'text/csv; charset=utf-8' } })
})

export default csv
