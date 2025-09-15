import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import api from './api'
import csv from './csv'
import auth from './auth'
import cron from './cron'
import { renderer } from './renderer'
import settings from './settings'
import subs from './subscriptions'
import admin from './admin'
import approval from './approval'
import type { Env } from './types'
import { requireAuth, requireRole } from './mw'

const app = new Hono<Env>()

// Middlewares
app.use('/api/*', cors())
app.use('/static/*', serveStatic({ root: './public' }))
app.use(renderer)

// Routes
app.route('/auth', auth)
app.use('/api/*', requireAuth)
app.use('/csv/*', requireAuth)
app.use('/settings*', requireAuth)
app.use('/subs*', requireAuth)
app.use('/admin*', requireAuth)
app.use('/approval*', requireAuth)
app.route('/api', api)
app.route('/csv', csv)
app.route('/settings', settings)
app.route('/subs', subs)
app.route('/admin', admin)
app.route('/approval', approval)
app.route('/__cron', cron)

// Home
app.get('/', (c) => {
  return c.render(
    <div>
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-2xl font-bold"><i class="fas fa-store mr-2"></i> 売上報告・管理</h1>
        <div class="flex items-center gap-2">
          <input id="login-email" type="email" placeholder="email" class="border rounded px-2 py-1" />
          <input id="login-pass" type="password" placeholder="password" class="border rounded px-2 py-1" />
          <button id="login-btn" class="text-sm px-3 py-1 bg-black text-white rounded">ログイン</button>
          <button id="logout-btn" class="text-sm px-3 py-1 bg-gray-600 text-white rounded hidden">ログアウト</button>
        </div>
      </div>

      <div class="bg-white rounded shadow p-4 mb-6">
        <h2 class="font-semibold mb-3">日次入力</h2>
        <div class="flex items-center gap-3 mb-3">
          <label class="text-sm">日付</label>
          <input id="date" type="date" class="border rounded px-2 py-1" />
          <button id="add-sale" class="ml-auto text-sm px-3 py-1 bg-blue-600 text-white rounded">売上報告</button>
          <button id="add-expense" class="text-sm px-3 py-1 bg-emerald-600 text-white rounded">経費報告</button>
          <button id="save" class="text-sm px-4 py-1 bg-indigo-700 text-white rounded">保存</button>
        </div>

        <div id="totals-preview" class="text-sm text-gray-600 mb-2"></div>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <h3 class="font-medium">売上</h3>
            <table id="sales-table" class="w-full text-sm">
              <thead>
                <tr class="text-left text-gray-500">
                  <th>メニュー</th><th>数量</th><th>金額</th><th>メモ</th><th></th>
                </tr>
              </thead>
              <tbody id="sales-rows"></tbody>
            </table>
          </div>
          <div>
            <h3 class="font-medium">経費</h3>
            <table id="expense-table" class="w-full text-sm">
              <thead>
                <tr class="text-left text-gray-500">
                  <th>カテゴリ</th><th>金額</th><th>メモ</th><th></th>
                </tr>
              </thead>
              <tbody id="expense-rows"></tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="bg-white rounded shadow p-4 lg:col-span-2">
          <h2 class="font-semibold mb-3">HQダッシュボード</h2>
          <div id="hq-total" class="text-sm text-gray-600 mb-2"></div>
          <div class="overflow-x-auto"><table class="w-full text-sm">
            <thead><tr class="text-left text-gray-500"><th>店舗</th><th>売上</th><th>経費</th><th>利益</th><th>ロイヤリティ</th></tr></thead>
            <tbody id="hq-rows"></tbody>
          </table></div>
        </div>
        <div class="bg-white rounded shadow p-4">
          <h2 class="font-semibold mb-3">分析（月次）</h2>
          <div class="h-48"><canvas id="chart"></canvas></div>
        </div>
      </div>

      <div class="bg-white rounded shadow p-4 mt-6">
        <h2 class="font-semibold mb-3">代理店ダッシュボード</h2>
        <div id="ag-total" class="text-sm text-gray-600"></div>
      </div>

      <div class="bg-white rounded shadow p-4 mt-6">
        <div class="flex items-center justify-between mb-2">
          <h2 class="font-semibold">通知・設定（HQのみ）</h2>
          <div class="flex items-center gap-2 text-sm">
            <select id="csv_agency" class="border rounded px-2 py-1"></select>
            <input id="csv_year" type="number" class="border rounded px-2 py-1 w-24" placeholder="2025"/>
            <input id="csv_month" type="number" class="border rounded px-2 py-1 w-20" placeholder="9"/>
            <a id="csv_link" class="text-blue-700 underline" href="#" target="_blank">CSVダウンロード（代理店）</a>
          </div>
        </div>
        <div id="hq-only" class="text-xs text-gray-500 mb-4">HQでログイン時のみ編集できます</div>
        <form id="settings-form" class="space-y-2">
          <div>
            <label class="text-sm mr-2">通知先メール</label>
            <input id="notify_email" type="email" class="border rounded px-2 py-1 w-80" placeholder="hq@example.com" />
          </div>
          <div class="flex gap-3">
            <div>
              <div class="text-sm text-gray-500">単日売上テンプレ(subject/body)</div>
              <input id="tpl_sale_subject" class="border rounded px-2 py-1 w-96 mb-1" placeholder="売上確定: {{store}} {{date}}"/>
              <textarea id="tpl_sale_body" class="border rounded px-2 py-1 w-96 h-24" placeholder="{{store}} の {{date}} 売上は {{sales_total}} 円でした。"></textarea>
            </div>
            <div>
              <div class="text-sm text-gray-500">月商達成テンプレ(subject/body)</div>
              <input id="tpl_month_subject" class="border rounded px-2 py-1 w-96 mb-1" placeholder="月商達成: {{store}}"/>
              <textarea id="tpl_month_body" class="border rounded px-2 py-1 w-96 h-24" placeholder="{{store}} の {{year}}/{{month}} 月商が {{amount}} 円に到達！"></textarea>
            </div>
          </div>
          <button id="save-settings" type="button" class="text-sm px-3 py-1 bg-slate-700 text-white rounded">保存</button>
        </form>
      </div>
    </div>
  )
})

export default app
