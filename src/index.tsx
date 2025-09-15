import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import api from './api'
import csv from './csv'
import auth from './auth'
import cron from './cron'
import { renderer } from './renderer'
import type { Env } from './types'

const app = new Hono<Env>()

// Middlewares
app.use('/api/*', cors())
app.use('/static/*', serveStatic({ root: './public' }))
app.use(renderer)

// Routes
app.route('/api', api)
app.route('/csv', csv)
app.route('/auth', auth)
app.route('/__cron', cron)

// Home
app.get('/', (c) => {
  return c.render(
    <div class="max-w-3xl mx-auto">
      <h1 class="text-2xl font-bold mb-4">sbs-webapp</h1>
      <ul class="list-disc pl-5 space-y-2">
        <li><a class="text-blue-600 underline" href="/api/menus">GET /api/menus</a></li>
        <li><a class="text-blue-600 underline" href="/csv/agency-summary">GET /csv/agency-summary</a></li>
      </ul>
    </div>
  )
})

export default app
