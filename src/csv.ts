import { Hono } from 'hono'
import type { Env } from './types'

const csv = new Hono<Env>()

csv.get('/agency-summary', async (c) => {
  const rows = [
    ['store','year','month','sales','royalty'],
    ['Demo', '2025', '09', '100000', '50000']
  ]
  const body = rows.map(r => r.join(',')).join('\n')
  return new Response(body, { headers: { 'Content-Type': 'text/csv; charset=utf-8' } })
})

export default csv
