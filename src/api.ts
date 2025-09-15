import { Hono } from 'hono'
import type { Env } from './types'
import { applyInit } from './migrations'

const api = new Hono<Env>()

api.get('/menus', async (c) => {
  const rows = await c.env.Bindings.DB.prepare('SELECT id, name, price FROM menus WHERE active=1 ORDER BY id').all()
  if (!rows || !('results' in rows)) return c.json([])
  return c.json(rows.results)
})

api.get('/expense-categories', async (c) => {
  const rows = await c.env.Bindings.DB.prepare('SELECT id, name FROM expense_categories WHERE active=1 ORDER BY id').all()
  if (!rows || !('results' in rows)) return c.json([])
  return c.json(rows.results)
})

api.post('/reports/upsert', async (c) => {
  const payload = await c.req.json<{ store_id:number, date:string, sales?: Array<{menu_id:number, quantity?:number, amount:number, note?:string}>, expenses?: Array<{category_id:number, amount:number, note?:string}> }>()
  if (!payload?.store_id || !payload?.date) return c.json({ error:'store_id and date required' }, 400)
  const env = c.env.Bindings
  const { getOrCreateReport, recomputeDailyReport } = await import('./services')
  const reportId = await getOrCreateReport(env, payload.store_id, payload.date)
  // Upsert sales
  if (payload.sales?.length) {
    for (const s of payload.sales) {
      const qty = s.quantity ?? 1
      await env.DB.prepare('INSERT INTO sales_items (report_id, menu_id, quantity, amount, note) VALUES (?,?,?,?,?)')
        .bind(reportId, s.menu_id, qty, s.amount, s.note ?? null).run()
    }
  }
  // Upsert expenses
  if (payload.expenses?.length) {
    for (const e of payload.expenses) {
      await env.DB.prepare('INSERT INTO expense_items (report_id, category_id, amount, note) VALUES (?,?,?,?)')
        .bind(reportId, e.category_id, e.amount, e.note ?? null).run()
    }
  }
  const totals = await recomputeDailyReport(env, reportId)

  // 通知（単日売上）
  try {
    const { maybeSendSingleSale, maybeSendMonthlyMilestone, shouldNotifyMilestone } = await import('./notifications')
    const { getStore, sumMonthForStore } = await import('./services')
    const store = await getStore(env, payload.store_id)
    if (store) {
      await maybeSendSingleSale(env, {
        store: store.name,
        date: payload.date,
        sales_total: totals.sales_total
      })
      // 月次達成通知（閾値は settings.goal_monthly で任意に設定）
      const ym = payload.date.slice(0,7)
      const row = await env.DB.prepare('SELECT value FROM settings WHERE key="goal_monthly"').first<{value:string}>()
      const goal = Number(row?.value || '0')
      if (goal > 0) {
        const amount = await sumMonthForStore(env, payload.store_id, ym)
        const hit = await shouldNotifyMilestone(env, payload.store_id, ym, goal, amount)
        if (hit) {
          await maybeSendMonthlyMilestone(env, {
            store: store.name,
            year: ym.slice(0,4),
            month: ym.slice(5,7),
            amount
          })
        }
      }
    }
  } catch (e) {
    console.warn('notify failed', e)
  }

  return c.json({ ok:true, report_id: reportId, ...totals })
})

api.get('/dashboard/hq', async (c) => {
  // per-store + total
  const env = c.env.Bindings
  const perStore = await env.DB.prepare(
    `SELECT s.id as store_id, s.name as store_name,
            COALESCE(SUM(dr.sales_total),0) as sales_total,
            COALESCE(SUM(dr.expense_total),0) as expense_total,
            COALESCE(SUM(dr.profit),0) as profit,
            COALESCE(SUM(dr.royalty),0) as royalty
       FROM stores s
       LEFT JOIN daily_reports dr ON dr.store_id = s.id
       GROUP BY s.id, s.name
       ORDER BY s.id`
  ).all()
  const total = await env.DB.prepare(
    'SELECT COALESCE(SUM(sales_total),0) as sales_total, COALESCE(SUM(expense_total),0) as expense_total, COALESCE(SUM(profit),0) as profit, COALESCE(SUM(royalty),0) as royalty FROM daily_reports'
  ).first()
  return c.json({ per_store: perStore.results ?? [], total: total ?? { sales_total:0, expense_total:0, profit:0, royalty:0 } })
})

api.get('/dashboard/agency/:id', async (c) => {
  const env = c.env.Bindings
  const id = Number(c.req.param('id'))
  const perStore = await env.DB.prepare(
    `SELECT s.id as store_id, s.name as store_name,
            COALESCE(SUM(dr.sales_total),0) as sales_total,
            COALESCE(SUM(dr.expense_total),0) as expense_total,
            COALESCE(SUM(dr.profit),0) as profit,
            COALESCE(SUM(dr.royalty),0) as royalty
       FROM stores s
       LEFT JOIN daily_reports dr ON dr.store_id = s.id
       WHERE s.agency_id = ?
       GROUP BY s.id, s.name
       ORDER BY s.id`
  ).bind(id).all()
  const total = await env.DB.prepare(
    `SELECT COALESCE(SUM(dr.royalty),0) as royalty, COALESCE(SUM(ac.amount),0) as agency_reward
       FROM daily_reports dr
       JOIN stores s ON s.id = dr.store_id
       LEFT JOIN agency_commissions ac ON ac.report_id = dr.id AND ac.agency_id = s.agency_id
       WHERE s.agency_id = ?`
  ).bind(id).first<{royalty:number, agency_reward:number}>()
  return c.json({ per_store: perStore.results ?? [], total: total ?? { royalty:0, agency_reward:0 } })
})

api.get('/analytics/summary', async (c) => {
  const env = c.env.Bindings
  // 簡易: 月ごと合計、メニュー別合計
  const monthly = await env.DB.prepare(
    `SELECT substr(date,1,7) as ym, SUM(sales_total) as sales, SUM(profit) as profit FROM daily_reports GROUP BY ym ORDER BY ym`
  ).all()
  const byMenu = await env.DB.prepare(
    `SELECT m.name, SUM(si.amount) as sales FROM sales_items si JOIN menus m ON m.id=si.menu_id GROUP BY m.id, m.name ORDER BY sales DESC`
  ).all()
  return c.json({ monthly: monthly.results ?? [], by_menu: byMenu.results ?? [] })
})

api.get('/expense-categories', async (c) => {
  const rows = await c.env.Bindings.DB.prepare('SELECT id, name FROM expense_categories WHERE active=1 ORDER BY id').all()
  return c.json(rows.results ?? [])
})

api.post('/init', async (c) => {
  await applyInit(c.env.Bindings)
  return c.json({ ok: true })
})

export default api
