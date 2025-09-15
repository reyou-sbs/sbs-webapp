import { Hono } from 'hono'
import type { Env } from './types'

const cron = new Hono<Env>()

cron.post('/', async (c) => {
  const { runDailyJobs } = await import('./auto-jobs')
  const result = await runDailyJobs(c.env.Bindings)
  return c.json(result)
})

export default cron
