// Shared types and Cloudflare Bindings
export type Bindings = {
  DB: D1Database
  RESEND_API_KEY?: string
}

export type Env = {
  Bindings: Bindings
}

export type UserRole = 'HQ' | 'AGENCY' | 'STORE'

export interface User {
  id: number
  email: string
  password_hash: string
  role: UserRole
  agency_id?: number | null
  store_id?: number | null
  verified: number
  created_at?: string
}
