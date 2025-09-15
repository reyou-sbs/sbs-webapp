import type { Bindings } from './types'

export async function maybeSendSingleSale(env: Bindings, to: string, payload: Record<string,string|number>) {
  const subject = `売上確定: ${payload.store} ${payload.date}`
  const body = `${payload.store} の ${payload.date} 売上は ${payload.sales_total} 円でした。`
  await sendEmail(env, to, subject, body)
}

export async function maybeSendMonthlyMilestone(env: Bindings, to: string, payload: Record<string,string|number>) {
  const subject = `月商達成: ${payload.store}`
  const body = `${payload.year}/${payload.month} 月商が ${payload.amount} 円に到達！`
  await sendEmail(env, to, subject, body)
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
