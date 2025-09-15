import type { Bindings } from './types'

export const INIT_SQL = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export const SEED_SQL = `
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('royalty_rate', '0.5'),
  ('agency_commission_rate', '0.1');
`;

export async function applyInit(env: Bindings) {
  await env.DB.batch([env.DB.prepare(INIT_SQL)])
  await env.DB.batch([env.DB.prepare(SEED_SQL)])
}
