import type { Bindings } from './types'

type Template = { subject: string, body: string }

async function getSetting(env: Bindings, key: string) {
  return await env.DB.prepare('SELECT value FROM settings WHERE key=?').bind(key).first<{value:string}>()
}

async function getTemplate(env: Bindings, key: string): Promise<Template | null> {
  const row = await env.DB.prepare('SELECT subject, body FROM notification_templates WHERE key=?').bind(key).first<{subject:string, body:string}>()
  return row ? { subject: row.subject, body: row.body } : null
}

function renderTemplate(tpl: string, data: Record<string, string|number>) {
  return tpl.replace(/{{\s*(\w+)\s*}}/g, (_, k) => String(data[k] ?? ''))
}

export async function maybeSendSingleSale(env: Bindings, payload: Record<string,string|number>) {
  const s = await getSetting(env, 'notify_email')
  if (!s?.value) return
  const t = (await getTemplate(env, 'sale_confirmed')) || { subject: '売上確定', body: '{{store}} の {{date}} 売上は {{sales_total}} 円でした。' }
  const subject = renderTemplate(t.subject, payload)
  const body = renderTemplate(t.body, payload)
  await sendEmail(env, s.value, subject, body)
}

export async function maybeSendMonthlyMilestone(env: Bindings, payload: Record<string,string|number>) {
  const s = await getSetting(env, 'notify_email')
  if (!s?.value) return
  const t = (await getTemplate(env, 'month_milestone')) || { subject: '月商達成', body: '{{store}} の {{year}}/{{month}} 月商が {{amount}} 円に到達！' }
  const subject = renderTemplate(t.subject, payload)
  const body = renderTemplate(t.body, payload)
  await sendEmail(env, s.value, subject, body)
}

async function sendEmail(env: Bindings, to: string, subject: string, body: string) {
  const key = env.RESEND_API_KEY
  if (!key) return
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from: 'noreply@example.com', to, subject, html: body })
  })
  if (!resp.ok) {
    console.warn('Resend failed', resp.status, await resp.text())
  }
}

export async function shouldNotifyMilestone(env: Bindings, storeId: number, ym: string, goal: number, amount: number) {
  if (!goal || amount < goal) return false
  const key = `milestone_${storeId}_${ym}`
  const existed = await env.DB.prepare('SELECT value FROM settings WHERE key=?').bind(key).first()
  if (existed) return false
  await env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').bind(key, '1').run()
  return true
}
