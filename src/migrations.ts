import type { Bindings } from './types'

// NOTE: Cloudflare Pages runtime cannot read files at runtime.
// We embed SQL migrations as strings and execute via /api/init.

export const INIT_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS agencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  agency_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agency_id) REFERENCES agencies(id)
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('HQ','AGENCY','STORE')),
  agency_id INTEGER,
  store_id INTEGER,
  verified INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agency_id) REFERENCES agencies(id),
  FOREIGN KEY (store_id) REFERENCES stores(id)
);

CREATE TABLE IF NOT EXISTS menus (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expense_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  sales_total INTEGER DEFAULT 0,
  expense_total INTEGER DEFAULT 0,
  profit INTEGER DEFAULT 0,
  royalty INTEGER DEFAULT 0,
  agency_commission INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(store_id, date),
  FOREIGN KEY (store_id) REFERENCES stores(id)
);

CREATE TABLE IF NOT EXISTS sales_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL,
  menu_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  note TEXT,
  FOREIGN KEY (report_id) REFERENCES daily_reports(id) ON DELETE CASCADE,
  FOREIGN KEY (menu_id) REFERENCES menus(id)
);

CREATE TABLE IF NOT EXISTS expense_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  note TEXT,
  FOREIGN KEY (report_id) REFERENCES daily_reports(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES expense_categories(id)
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL,
  customer_name TEXT,
  menu_id INTEGER NOT NULL,
  price INTEGER NOT NULL,
  cycle_type TEXT NOT NULL CHECK(cycle_type IN ('days','monthly','month_end')),
  cycle_days INTEGER,
  specific_day INTEGER,
  next_charge_date TEXT NOT NULL,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id),
  FOREIGN KEY (menu_id) REFERENCES menus(id)
);

CREATE TABLE IF NOT EXISTS subscription_charges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subscription_id INTEGER NOT NULL,
  report_id INTEGER NOT NULL,
  charge_date TEXT NOT NULL,
  amount INTEGER NOT NULL,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id),
  FOREIGN KEY (report_id) REFERENCES daily_reports(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS agency_commissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL,
  agency_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  UNIQUE(report_id, agency_id),
  FOREIGN KEY (report_id) REFERENCES daily_reports(id) ON DELETE CASCADE,
  FOREIGN KEY (agency_id) REFERENCES agencies(id)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_templates (
  key TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  body TEXT NOT NULL
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_reports_store_date ON daily_reports(store_id, date);
CREATE INDEX IF NOT EXISTS idx_sales_report ON sales_items(report_id);
CREATE INDEX IF NOT EXISTS idx_expense_report ON expense_items(report_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next ON subscriptions(next_charge_date, active);
`;

export const SEED_SQL = `
INSERT OR IGNORE INTO settings(key, value) VALUES
  ('royalty_rate','0.5'),
  ('agency_commission_rate','0.1'),
  ('notify_email','');

INSERT OR IGNORE INTO notification_templates(key, subject, body) VALUES
  ('sale_confirmed','売上確定','{{store}} の {{date}} 売上は {{sales_total}} 円でした。おめでとうございます！'),
  ('month_milestone','月商達成','{{store}} の {{year}}/{{month}} 月商が {{amount}} 円に到達しました！');

-- Seed masters
INSERT OR IGNORE INTO agencies(id, name) VALUES (1, 'HQ直営代理店');
INSERT OR IGNORE INTO stores(id, name, agency_id) VALUES (1, '本店', 1);

INSERT OR IGNORE INTO menus(id, name, price, active) VALUES
  (1,'フェイシャルA',8000,1),
  (2,'フェイシャルB',12000,1),
  (3,'小顔マッサージ',9000,1);

INSERT OR IGNORE INTO expense_categories(id, name, active) VALUES
  (1,'消耗品',1),
  (2,'家賃',1),
  (3,'水道光熱',1);

-- Seed one HQ user (password: demo)
INSERT OR IGNORE INTO users(id,email,password_hash,role,verified) VALUES
  (1,'hq@example.com','demo','HQ',1);
`;

export async function applyInit(env: Bindings) {
  const statements = INIT_SQL.split(/;\s*\n/).map(s => s.trim()).filter(Boolean)
  for (const s of statements) {
    await env.DB.prepare(s).run()
  }
  const seedStatements = SEED_SQL.split(/;\s*\n/).map(s => s.trim()).filter(Boolean)
  for (const s of seedStatements) {
    await env.DB.prepare(s).run()
  }
}
