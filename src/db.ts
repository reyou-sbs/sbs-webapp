import type { Bindings } from './types'

export const sql = async <T = unknown>(env: Bindings, query: string, params: any[] = []) => {
  const stmt = env.DB.prepare(query)
  const bound = params.length ? stmt.bind(...params) : stmt
  const { results } = await bound.all<T>()
  return results
}

export const run = async (env: Bindings, query: string, params: any[] = []) => {
  const stmt = env.DB.prepare(query)
  const bound = params.length ? stmt.bind(...params) : stmt
  return await bound.run()
}
