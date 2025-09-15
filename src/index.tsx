import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import api from './api'
import csv from './csv'
import auth from './auth'
import cron from './cron'
import { renderer } from './renderer'
import type { Env } from './types'

const app = new Hono<Env>()

// Middlewares
app.use('/api/*', cors())
app.use('/static/*', serveStatic({ root: './public' }))
app.use(renderer)

// Routes
app.route('/api', api)
app.route('/csv', csv)
app.route('/auth', auth)
app.route('/__cron', cron)

// Home
app.get('/', (c) => {
  return c.render(
    <div>
      <h1 class="text-2xl font-bold mb-4"><i class="fas fa-store mr-2"></i> 売上報告・管理</h1>

      <div class="bg-white rounded shadow p-4 mb-6">
        <h2 class="font-semibold mb-3">日次入力</h2>
        <div class="flex items-center gap-3 mb-3">
          <label class="text-sm">日付</label>
          <input id="date" type="date" class="border rounded px-2 py-1" />
          <button id="add-sale" class="ml-auto text-sm px-3 py-1 bg-blue-600 text-white rounded">売上行を追加</button>
          <button id="add-expense" class="text-sm px-3 py-1 bg-emerald-600 text-white rounded">経費行を追加</button>
          <button id="save" class="text-sm px-4 py-1 bg-indigo-700 text-white rounded">保存</button>
        </div>

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
    </div>
  )
})

export default app
