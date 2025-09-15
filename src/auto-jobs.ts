import type { Bindings } from './types'

export async function runDailyJobs(env: Bindings) {
  // 1) 補完: 0円日（必要であれば）
  // 2) サブスク: next_charge_date <= today を生成
  // この最小版ではログだけ
  return { ok: true, ranAt: new Date().toISOString() }
}
