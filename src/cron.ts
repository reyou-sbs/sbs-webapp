import { Hono } from 'hono'
import type { Env } from './types'

const cron = new Hono<Env>()

cron.post('/', async (c) => {
  // daily jobs placeholder
  return c.json({ ok: true, ran: 'daily-jobs' })
})

export default cron
