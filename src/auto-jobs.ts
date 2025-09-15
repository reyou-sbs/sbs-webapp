import type { Bindings } from './types'
import { addDaysISO, monthEnd, toSpecificDayNextOrSame, todayISO } from './date-utils'

export async function runDailyJobs(env: Bindings) {
  const today = todayISO()

  // 1) 0円日補完: 全店舗の前日分で日報が無ければ0円で作成
  const stores = await env.DB.prepare('SELECT id FROM stores').all<{id:number}>()
  const yesterday = addDaysISO(today, -1)
  for (const s of stores.results ?? []) {
    const r = await env.DB.prepare('SELECT id FROM daily_reports WHERE store_id=? AND date=?').bind((s as any).id, yesterday).first()
    if (!r) {
      const ins = await env.DB.prepare('INSERT INTO daily_reports (store_id, date, sales_total, expense_total, profit, royalty, agency_commission) VALUES (?,?,?,?,?,?,?)')
        .bind((s as any).id, yesterday, 0, 0, 0, 0, 0).run()
      // ensure agency_commission row as 0
      const info = await env.DB.prepare('SELECT s.agency_id FROM stores s WHERE s.id=?').bind((s as any).id).first<{agency_id:number|null}>()
      if (info?.agency_id) {
        // @ts-ignore
        const reportId = ins.meta?.last_row_id
        await env.DB.prepare('INSERT OR IGNORE INTO agency_commissions (report_id, agency_id, amount) VALUES (?,?,0)')
          .bind(reportId, info.agency_id).run()
      }
    }
  }

  // 2) サブスク課金生成
  const subs = await env.DB.prepare('SELECT * FROM subscriptions WHERE active=1 AND next_charge_date<=?').bind(today).all<any>()
  for (const sub of subs.results ?? []) {
    // create or get report for today
    const rep = await env.DB.prepare('SELECT id FROM daily_reports WHERE store_id=? AND date=?').bind(sub.store_id, today).first<{id:number}>()
    let reportId = rep?.id
    if (!reportId) {
      const r = await env.DB.prepare('INSERT INTO daily_reports (store_id, date) VALUES (?, ?)').bind(sub.store_id, today).run()
      // @ts-ignore
      reportId = r.meta?.last_row_id
    }
    // insert sales_items & subscription_charges
    await env.DB.prepare('INSERT INTO sales_items (report_id, menu_id, quantity, amount, note) VALUES (?,?,?,?,?)')
      .bind(reportId, sub.menu_id, 1, sub.price, 'subscription').run()
    await env.DB.prepare('INSERT INTO subscription_charges (subscription_id, report_id, charge_date, amount) VALUES (?,?,?,?)')
      .bind(sub.id, reportId, today, sub.price).run()

    // recompute
    const sales = await env.DB.prepare('SELECT COALESCE(SUM(amount),0) as total FROM sales_items WHERE report_id=?').bind(reportId).first<{ total: number }>()
    const expense = await env.DB.prepare('SELECT COALESCE(SUM(amount),0) as total FROM expense_items WHERE report_id=?').bind(reportId).first<{ total: number }>()
    const sales_total = sales?.total ?? 0
    const expense_total = expense?.total ?? 0
    const profit = Math.max(0, sales_total - expense_total)
    const settings = await env.DB.prepare('SELECT key, value FROM settings WHERE key IN ("royalty_rate","agency_commission_rate")').all<{key:string,value:string}>()
    const map = new Map(settings.results?.map((r:any)=>[r.key, Number(r.value)]) ?? [])
    const royalty = Math.floor(profit * (map.get('royalty_rate') ?? 0.5))
    const agency_commission = Math.floor(royalty * (map.get('agency_commission_rate') ?? 0.1))
    await env.DB.prepare('UPDATE daily_reports SET sales_total=?, expense_total=?, profit=?, royalty=?, agency_commission=? WHERE id=?')
      .bind(sales_total, expense_total, profit, royalty, agency_commission, reportId).run()

    const ag = await env.DB.prepare('SELECT s.agency_id FROM daily_reports dr JOIN stores s ON s.id=dr.store_id WHERE dr.id=?').bind(reportId).first<{agency_id:number|null}>()
    if (ag?.agency_id) {
      await env.DB.prepare('INSERT INTO agency_commissions (report_id, agency_id, amount) VALUES (?,?,?) ON CONFLICT(report_id, agency_id) DO UPDATE SET amount=excluded.amount')
        .bind(reportId, ag.agency_id, agency_commission).run()
    }

    // advance next_charge_date
    let next = today
    if (sub.cycle_type === 'days') {
      next = addDaysISO(today, sub.cycle_days || 30)
    } else if (sub.cycle_type === 'monthly') {
      const day = sub.specific_day || 1
      next = toSpecificDayNextOrSame(addDaysISO(today, 1), day) // 翌月または今月の指定日
    } else if (sub.cycle_type === 'month_end') {
      next = monthEnd(addDaysISO(today, 1))
    }
    await env.DB.prepare('UPDATE subscriptions SET next_charge_date=? WHERE id=?').bind(next, sub.id).run()
  }

  return { ok: true, ranAt: new Date().toISOString(), processed: (subs.results ?? []).length }
}
