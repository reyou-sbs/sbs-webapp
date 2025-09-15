import type { Bindings } from './types'

export async function getOrCreateReport(env: Bindings, storeId: number, date: string) {
  const existing = await env.DB.prepare(
    'SELECT id FROM daily_reports WHERE store_id=? AND date=?'
  ).bind(storeId, date).first<{ id: number }>()
  if (existing) return existing.id
  const res = await env.DB.prepare(
    'INSERT INTO daily_reports (store_id, date) VALUES (?, ?);'
  ).bind(storeId, date).run()
  // @ts-ignore
  return res.meta?.last_row_id ?? (await env.DB.prepare('SELECT id FROM daily_reports WHERE store_id=? AND date=?').bind(storeId, date).first<{id:number}>())!.id
}

export async function getSettingNumber(env: Bindings, key: string, fallback: number) {
  const row = await env.DB.prepare('SELECT value FROM settings WHERE key=?').bind(key).first<{ value: string }>()
  if (!row) return fallback
  const n = Number(row.value)
  return Number.isFinite(n) ? n : fallback
}

export async function getStore(env: Bindings, storeId: number) {
  return await env.DB.prepare('SELECT id, name, agency_id FROM stores WHERE id=?').bind(storeId).first<{id:number,name:string,agency_id:number|null}>()
}

export async function sumMonthForStore(env: Bindings, storeId: number, ym: string) {
  const row = await env.DB.prepare('SELECT COALESCE(SUM(sales_total),0) as sales FROM daily_reports WHERE store_id=? AND substr(date,1,7)=?')
    .bind(storeId, ym).first<{sales:number}>()
  return row?.sales ?? 0
}

export async function recomputeDailyReport(env: Bindings, reportId: number) {
  const sales = await env.DB.prepare('SELECT COALESCE(SUM(amount),0) as total FROM sales_items WHERE report_id=?').bind(reportId).first<{ total: number }>()
  const expense = await env.DB.prepare('SELECT COALESCE(SUM(amount),0) as total FROM expense_items WHERE report_id=?').bind(reportId).first<{ total: number }>()
  const sales_total = sales?.total ?? 0
  const expense_total = expense?.total ?? 0
  const profit = Math.max(0, sales_total - expense_total)
  const royalty_rate = await getSettingNumber(env, 'royalty_rate', 0.5)
  const agency_rate = await getSettingNumber(env, 'agency_commission_rate', 0.1)
  const royalty = Math.floor(profit * royalty_rate)
  const agency_commission = Math.floor(royalty * agency_rate)
  // 施錠中は再計算のみ許可（合計値更新は許容）
  const lockedRow = await env.DB.prepare('SELECT locked FROM daily_reports WHERE id=?').bind(reportId).first<{locked:number}>()
  await env.DB.prepare(
    'UPDATE daily_reports SET sales_total=?, expense_total=?, profit=?, royalty=?, agency_commission=? WHERE id=?'
  ).bind(sales_total, expense_total, profit, royalty, agency_commission, reportId).run()
  // maintain agency_commissions row
  const info = await env.DB.prepare(
    'SELECT dr.id as report_id, s.agency_id FROM daily_reports dr JOIN stores s ON s.id=dr.store_id WHERE dr.id=?'
  ).bind(reportId).first<{report_id:number, agency_id:number|null}>()
  if (info?.agency_id) {
    await env.DB.prepare(
      'INSERT INTO agency_commissions (report_id, agency_id, amount) VALUES (?,?,?) ON CONFLICT(report_id, agency_id) DO UPDATE SET amount=excluded.amount'
    ).bind(reportId, info.agency_id, agency_commission).run()
  }
  return { sales_total, expense_total, profit, royalty, agency_commission }
}

export function todayISO() {
  return new Date().toISOString().slice(0,10)
}

export function addDays(dateISO: string, days: number) {
  const d = new Date(dateISO + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0,10)
}
