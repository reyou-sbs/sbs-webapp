;(function(){
  const $ = (sel, el=document) => el.querySelector(sel)
  const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel))

  function toast(msg){
    const t = document.createElement('div')
    t.className = 'fixed bottom-4 right-4 bg-black text-white px-3 py-2 rounded shadow'
    t.textContent = msg
    document.body.appendChild(t)
    setTimeout(()=>t.remove(), 2000)
  }

  function getToken(){ return localStorage.getItem('token')||'' }
  async function fetchJSON(url, opts={}){
    const headers = Object.assign({ 'Content-Type':'application/json' }, (opts.headers||{}))
    const token = getToken()
    if(token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(url, Object.assign({ headers }, opts))
    if(!res.ok){
      const txt = await res.text()
      throw new Error(`${res.status}:${txt}`)
    }
    const ct = res.headers.get('content-type')||''
    return ct.includes('application/json') ? res.json() : res.text()
  }

  function Sheet(){
    const state = {
      store_id: 1,
      date: new Date().toISOString().slice(0,10),
      sales: [],
      expenses: []
    }

    async function loadMasters(){
      const [menus, cats, agencies, stores] = await Promise.all([
        fetchJSON('/api/menus'),
        fetchJSON('/api/expense-categories'),
        fetchJSON('/api/agencies'),
        fetchJSON('/api/stores')
      ])
      return { menus, cats, agencies, stores }
    }

    function rowSalesTpl(menus){
      const opts = menus.map(m=>`<option value="${m.id}">${m.name} (${m.price}円)</option>`).join('')
      return `<tr>
        <td>
          <select class="menu_id border rounded px-2 py-1">${opts}</select>
        </td>
        <td><input type="number" class="qty border rounded px-2 py-1 w-24" value="1" min="1" /></td>
        <td><input type="number" class="amount border rounded px-2 py-1 w-32" placeholder="金額" /></td>
        <td><input type="text" class="note border rounded px-2 py-1 w-64" placeholder="メモ" /></td>
        <td><button class="del text-red-600">削除</button></td>
      </tr>`
    }

    function rowExpenseTpl(cats){
      const opts = cats.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')
      return `<tr>
        <td>
          <select class="category_id border rounded px-2 py-1">${opts}</select>
        </td>
        <td><input type="number" class="amount border rounded px-2 py-1 w-32" placeholder="金額" /></td>
        <td><input type="text" class="note border rounded px-2 py-1 w-64" placeholder="メモ" /></td>
        <td><button class="del text-red-600">削除</button></td>
      </tr>`
    }

    async function mount(){
      const masters = await loadMasters()
      const salesTbody = $('#sales-rows')
      const expTbody = $('#expense-rows')

      $('#date').value = state.date
      // 店舗セレクタ
      const stSel = document.getElementById('store_select')
      stSel.innerHTML = masters.stores.map(s=>`<option value="${s.id}">${s.name}</option>`).join('')
      stSel.value = String(state.store_id)
      stSel.onchange = ()=>{ state.store_id = Number(stSel.value) }

      $('#add-sale').onclick = ()=>{
        salesTbody.insertAdjacentHTML('beforeend', rowSalesTpl(masters.menus))
      }
      $('#add-expense').onclick = ()=>{
        expTbody.insertAdjacentHTML('beforeend', rowExpenseTpl(masters.cats))
      }
      $('#sales-table').addEventListener('click', (e)=>{
        if(e.target.classList.contains('del')) e.target.closest('tr').remove()
      })
      $('#expense-table').addEventListener('click', (e)=>{
        if(e.target.classList.contains('del')) e.target.closest('tr').remove()
      })

      async function updateTotalsPreview(){
        const salesSum = $$('#sales-rows tr').reduce((acc,tr)=> acc + Number($('.amount', tr).value||'0'), 0)
        const expSum = $$('#expense-rows tr').reduce((acc,tr)=> acc + Number($('.amount', tr).value||'0'), 0)
        const profit = Math.max(0, salesSum - expSum)
        const royalty = Math.floor(profit * 0.5)
        $('#totals-preview').textContent = `売上合計 ${salesSum} / 経費合計 ${expSum} / 利益 ${profit} / ロイヤリティ ${royalty}`
      }
      $('#sales-table').addEventListener('input', updateTotalsPreview)
      $('#expense-table').addEventListener('input', updateTotalsPreview)

      $('#save').onclick = async ()=>{
        state.date = $('#date').value
        const sales = $$('#sales-rows tr').map(tr=>{
          const menuId = Number($('.menu_id', tr).value)
          const qty = Number($('.qty', tr).value||'1')
          let amount = Number($('.amount', tr).value||'0')
          // 金額未入力ならメニュー価格×数量で自動補完
          const m = (masters.menus||[]).find(x=>x.id===menuId)
          if(amount<=0 && m){ amount = Number(m.price||0) * (qty||1) }
          return {
            menu_id: menuId,
            quantity: qty,
            amount,
            note: $('.note', tr).value
          }
        }).filter(r=>r.amount>0)
        const expenses = $$('#expense-rows tr').map(tr=>({
          category_id: Number($('.category_id', tr).value),
          amount: Number($('.amount', tr).value||'0'),
          note: $('.note', tr).value
        })).filter(r=>r.amount>0)
        try{
          const out = await fetchJSON('/api/reports/upsert', { method:'POST', body: JSON.stringify({ store_id: state.store_id, date: state.date, sales, expenses }) })
          toast(`保存しました: 売上 ${out.sales_total} 経費 ${out.expense_total} 収益 ${out.profit} ロイヤリティ ${out.royalty}`)
          await renderDashboards()
        }catch(err){
          toast(`保存に失敗: ${err.message||err}`)
          console.error(err)
        }
      }

      document.getElementById('ym_input').value = currentYM
      document.getElementById('ym_refresh').onclick = async ()=>{
        currentYM = document.getElementById('ym_input').value || currentYM
        await renderDashboards()
      }

      await renderDashboards()
      await mountSettings()
      await mountSubs()
      await mountCsvUi()
      await mountCsvRangeUi()
    }

    async function mountCsvUi(){
      try{
        const agencies = await fetchJSON('/api/agencies')
        const sel = document.getElementById('csv_agency')
        sel.innerHTML = agencies.map(a=>`<option value="${a.id}">${a.name}</option>`).join('')
        const year = new Date().getFullYear()
        const month = new Date().getMonth()+1
        document.getElementById('csv_year').value = year
        document.getElementById('csv_month').value = month
        const build = ()=>{
          const aid = document.getElementById('csv_agency').value
          const y = document.getElementById('csv_year').value
          const m = document.getElementById('csv_month').value
          document.getElementById('csv_link').href = `/csv/agency-summary?agencyId=${aid}&year=${y}&month=${m}`
        }
        document.getElementById('csv_agency').onchange = build
        document.getElementById('csv_year').oninput = build
        document.getElementById('csv_month').oninput = build
        build()
      }catch(e){ console.warn('csv ui init failed', e) }
    }

    async function mountCsvRangeUi(){
      try{
        const role = localStorage.getItem('role')||''
        if(role!=='HQ') return
        const wrap = document.createElement('div')
        wrap.className = 'bg-white rounded shadow p-4 mt-6'
        wrap.innerHTML = `
          <h2 class="font-semibold mb-2">CSV（範囲指定）</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <div class="mb-1">代理店範囲（月単位、店舗別）</div>
              <div class="flex items-center gap-2">
                <input id="r_agency" type="number" class="border rounded px-2 py-1 w-24" placeholder="agencyId"/>
                <input id="r_start" type="month" class="border rounded px-2 py-1"/>
                <input id="r_end" type="month" class="border rounded px-2 py-1"/>
                <a id="r_agency_link" class="text-blue-700 underline" target="_blank">DL</a>
              </div>
            </div>
            <div>
              <div class="mb-1">HQ範囲（月単位、店舗別）</div>
              <div class="flex items-center gap-2">
                <input id="rh_start" type="month" class="border rounded px-2 py-1"/>
                <input id="rh_end" type="month" class="border rounded px-2 py-1"/>
                <a id="r_hq_link" class="text-blue-700 underline" target="_blank">DL</a>
              </div>
            </div>
            <div>
              <div class="mb-1">店舗範囲（日別）</div>
              <div class="flex items-center gap-2">
                <input id="rs_store" type="number" class="border rounded px-2 py-1 w-24" placeholder="storeId"/>
                <input id="rs_start" type="month" class="border rounded px-2 py-1"/>
                <input id="rs_end" type="month" class="border rounded px-2 py-1"/>
                <a id="r_store_link" class="text-blue-700 underline" target="_blank">DL</a>
              </div>
            </div>
          </div>
        `
        document.querySelector('.max-w-6xl').appendChild(wrap)
        const y = new Date().getFullYear(); const m = String(new Date().getMonth()+1).padStart(2,'0')
        document.getElementById('r_start').value = `${y}-${m}`
        document.getElementById('r_end').value = `${y}-${m}`
        document.getElementById('rh_start').value = `${y}-${m}`
        document.getElementById('rh_end').value = `${y}-${m}`
        document.getElementById('rs_start').value = `${y}-${m}`
        document.getElementById('rs_end').value = `${y}-${m}`
        const build = ()=>{
          const aid = document.getElementById('r_agency').value
          const s = document.getElementById('r_start').value
          const e = document.getElementById('r_end').value
          document.getElementById('r_agency_link').href = `/csv/agency-range?agencyId=${aid}&start=${s}&end=${e}`
          const hs = document.getElementById('rh_start').value
          const he = document.getElementById('rh_end').value
          document.getElementById('r_hq_link').href = `/csv/hq-range?start=${hs}&end=${he}`
          const rsId = document.getElementById('rs_store').value
          const rs = document.getElementById('rs_start').value
          const re = document.getElementById('rs_end').value
          document.getElementById('r_store_link').href = `/csv/store-range?storeId=${rsId}&start=${rs}&end=${re}`
        }
        document.querySelectorAll('#r_agency,#r_start,#r_end,#rh_start,#rh_end,#rs_store,#rs_start,#rs_end').forEach(el=>{
          el.addEventListener('input', build)
        })
        build()
      }catch(e){ console.warn('csv range ui init failed', e) }
    }

    async function mountSettings(){
      try{
        const rows = await fetchJSON('/settings')
        const map = Object.fromEntries(rows.map(r=>[r.key, r.value]))
        if(map.notify_email) document.getElementById('notify_email').value = map.notify_email
        if(map.tpl_sale_subject) document.getElementById('tpl_sale_subject').value = map.tpl_sale_subject
        if(map.tpl_sale_body) document.getElementById('tpl_sale_body').value = map.tpl_sale_body
        if(map.tpl_month_subject) document.getElementById('tpl_month_subject').value = map.tpl_month_subject
        if(map.tpl_month_body) document.getElementById('tpl_month_body').value = map.tpl_month_body
      }catch(e){ console.warn('settings load failed', e) }
      document.getElementById('save-settings').onclick = async ()=>{
        try{
          const payload = {
            notify_email: document.getElementById('notify_email').value,
            tpl_sale_subject: document.getElementById('tpl_sale_subject').value,
            tpl_sale_body: document.getElementById('tpl_sale_body').value,
            tpl_month_subject: document.getElementById('tpl_month_subject').value,
            tpl_month_body: document.getElementById('tpl_month_body').value,
          }
          await fetchJSON('/settings', { method:'POST', body: JSON.stringify(payload) })
          // Also persist templates table
          await fetchJSON('/settings/templates', { method:'POST', body: JSON.stringify({ key:'sale_confirmed', subject: payload.tpl_sale_subject, body: payload.tpl_sale_body }) })
          await fetchJSON('/settings/templates', { method:'POST', body: JSON.stringify({ key:'month_milestone', subject: payload.tpl_month_subject, body: payload.tpl_month_body }) })
          toast('設定を保存しました')
        }catch(err){ toast('設定保存に失敗しました'); console.error(err) }
      }
    }

    async function mountSubs(){
      const wrap = document.createElement('div')
      wrap.className = 'bg-white rounded shadow p-4 mt-6'
      wrap.innerHTML = `
        <h2 class="font-semibold mb-3">サブスク管理</h2>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <div class="text-sm text-gray-600 mb-2">登録フォーム</div>
            <div class="space-y-2">
              <input id="sub_customer" class="border rounded px-2 py-1 w-72" placeholder="顧客名(任意)"/>
              <input id="sub_price" type="number" class="border rounded px-2 py-1 w-40" placeholder="価格"/>
              <select id="sub_menu" class="border rounded px-2 py-1 w-72"></select>
              <select id="sub_cycle" class="border rounded px-2 py-1 w-48">
                <option value="days">日数</option>
                <option value="monthly">毎月の特定日</option>
                <option value="month_end">月末</option>
              </select>
              <input id="sub_days" type="number" class="border rounded px-2 py-1 w-32" placeholder="日数(例30)"/>
              <input id="sub_specific" type="number" class="border rounded px-2 py-1 w-32" placeholder="日(例15)"/>
              <input id="sub_next" type="date" class="border rounded px-2 py-1"/>
              <button id="sub_create" class="text-sm px-3 py-1 bg-indigo-700 text-white rounded">作成</button>
            </div>
          </div>
          <div>
            <div class="text-sm text-gray-600 mb-2">一覧</div>
            <table class="w-full text-sm">
              <thead><tr class="text-left text-gray-500"><th>顧客</th><th>メニュー</th><th>価格</th><th>周期</th><th>次回</th><th>状態</th><th></th></tr></thead>
              <tbody id="subs-rows"></tbody>
            </table>
          </div>
        </div>
      `
      document.querySelector('.max-w-6xl').appendChild(wrap)

      const menus = await fetchJSON('/api/menus')
      const sel = document.getElementById('sub_menu')
      sel.innerHTML = menus.map(m=>`<option value="${m.id}">${m.name} (${m.price})</option>`).join('')

      async function loadList(){
        const list = await fetchJSON('/subs/subscriptions?store_id=1')
        const tb = document.getElementById('subs-rows')
        tb.innerHTML = ''
        for(const s of list){
          const cyc = s.cycle_type==='days'? `${s.cycle_days}日`: (s.cycle_type==='monthly'? `毎月${s.specific_day}日`: '月末')
          tb.insertAdjacentHTML('beforeend', `<tr>
            <td class="px-2 py-1">${s.customer_name||''}</td>
            <td class="px-2 py-1">${s.menu_name}</td>
            <td class="px-2 py-1 text-right">${s.price}</td>
            <td class="px-2 py-1">${cyc}</td>
            <td class="px-2 py-1">${s.next_charge_date}</td>
            <td class="px-2 py-1">${s.active? '稼働':'停止'}</td>
            <td class="px-2 py-1"><button data-id="${s.id}" class="toggle text-blue-600">切替</button></td>
          </tr>`)
        }
      }

      document.getElementById('sub_create').onclick = async ()=>{
        const payload = {
          store_id: 1,
          customer_name: document.getElementById('sub_customer').value || null,
          price: Number(document.getElementById('sub_price').value||'0'),
          menu_id: Number(document.getElementById('sub_menu').value),
          cycle_type: document.getElementById('sub_cycle').value,
          cycle_days: Number(document.getElementById('sub_days').value||'0')||null,
          specific_day: Number(document.getElementById('sub_specific').value||'0')||null,
          next_charge_date: document.getElementById('sub_next').value
        }
        try{
          await fetchJSON('/subs/subscriptions', { method:'POST', body: JSON.stringify(payload) })
          toast('作成しました')
          await loadList()
        }catch(e){ toast('作成に失敗'); console.error(e) }
      }

      // 承認/ロックUI（簡易）
      const lockBox = document.createElement('div')
      lockBox.className = 'mt-4 text-sm'
      lockBox.innerHTML = `
        <div class="flex items-center gap-2">
          <input id="lock_date" type="date" class="border rounded px-2 py-1"/>
          <button id="btn-lock" class="px-3 py-1 bg-zinc-700 text-white rounded">ロック</button>
          <button id="btn-unlock" class="px-3 py-1 bg-zinc-500 text-white rounded">ロック解除(HQ)</button>
        </div>`
      wrap.appendChild(lockBox)
      document.getElementById('btn-lock').onclick = async ()=>{
        const date = document.getElementById('lock_date').value
        if(!date) return
        try{ await fetchJSON('/approval/lock', { method:'POST', body: JSON.stringify({ store_id:1, date }) }); toast('ロックしました') }catch(e){ toast('ロック失敗'); console.error(e) }
      }
      document.getElementById('btn-unlock').onclick = async ()=>{
        const date = document.getElementById('lock_date').value
        if(!date) return
        try{ await fetchJSON('/approval/unlock', { method:'POST', body: JSON.stringify({ store_id:1, date }) }); toast('解除しました') }catch(e){ toast('解除失敗'); console.error(e) }
      }

      document.getElementById('subs-rows').addEventListener('click', async (e)=>{
        const btn = e.target.closest('button.toggle')
        if(!btn) return
        const id = btn.getAttribute('data-id')
        try{
          await fetchJSON(`/subs/subscriptions/${id}/toggle`, { method:'POST' })
          toast('切替しました')
          await loadList()
        }catch(err){ toast('切替失敗'); console.error(err) }
      })

      await loadList()
    }

    let currentYM = new Date().toISOString().slice(0,7)
    async function renderDashboards(){
      const ym = currentYM
      const hq = await fetchJSON(`/api/dashboard/hq?ym=${ym}`)
      const ag = await fetchJSON(`/api/dashboard/agency/1?ym=${ym}`)
      $('#hq-total').textContent = `総売上 ${hq.total.sales_total||0} / 総利益 ${hq.total.profit||0} / ロイヤリティ ${hq.total.royalty||0}`
      $('#ag-total').textContent = `代理店報酬 ${ag.total.agency_reward||0}`
      const tbody = $('#hq-rows')
      tbody.innerHTML = ''
      for(const r of (hq.per_store||[])){
        tbody.insertAdjacentHTML('beforeend', `<tr>
          <td class="px-2 py-1">${r.store_name}</td>
          <td class="px-2 py-1 text-right">${r.sales_total||0}</td>
          <td class="px-2 py-1 text-right">${r.expense_total||0}</td>
          <td class="px-2 py-1 text-right">${r.profit||0}</td>
          <td class="px-2 py-1 text-right">${r.royalty||0}</td>
        </tr>`)
      }
      const an = await fetchJSON('/api/analytics/summary')
      renderChart(an)
    }

    function renderChart(an){
      const ctx = $('#chart')
      if(!ctx) return
      const labels = (an.monthly||[]).map(r=>r.ym)
      const data = (an.monthly||[]).map(r=>r.sales)
      if(window.__ch){ window.__ch.destroy() }
      window.__ch = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets: [{ label:'月次売上', data, borderColor:'#2563eb', backgroundColor:'rgba(37,99,235,0.2)' }] },
        options: { responsive: true, maintainAspectRatio:false }
      })
    }

    return { mount }
  }

  function setAuthUI(){
    const token = getToken()
    const loggedIn = !!token
    document.getElementById('login-email').classList.toggle('hidden', loggedIn)
    document.getElementById('login-pass').classList.toggle('hidden', loggedIn)
    document.getElementById('login-btn').classList.toggle('hidden', loggedIn)
    document.getElementById('logout-btn').classList.toggle('hidden', !loggedIn)
    // lock forms
    const disabled = !loggedIn
    ;['date','add-sale','add-expense','save','save-settings'].forEach(id=>{
      const el = document.getElementById(id)
      if(el){ el.disabled = disabled; el.classList.toggle('opacity-50', disabled) }
    })
  }

  async function refreshRole(){
    const token = getToken()
    if(!token){ localStorage.removeItem('role'); return }
    try{
      const me = await fetchJSON('/auth/me')
      localStorage.setItem('role', me.user.role)
    }catch{ localStorage.removeItem('role') }
  }

  function mountAuth(){
    document.getElementById('login-btn').onclick = async ()=>{
      try{
        const email = document.getElementById('login-email').value
        const password = document.getElementById('login-pass').value
        const res = await fetchJSON('/auth/login', { method:'POST', body: JSON.stringify({ email, password }) })
        localStorage.setItem('token', res.token)
        await refreshRole()
        toast('ログインしました')
        setAuthUI()
        location.reload()
      }catch(e){ toast('ログイン失敗'); console.error(e) }
    }
    document.getElementById('logout-btn').onclick = ()=>{
      localStorage.removeItem('token')
      localStorage.removeItem('role')
      toast('ログアウトしました')
      setAuthUI()
      location.reload()
    }
    setAuthUI()
    refreshRole().then(()=>{
      const role = localStorage.getItem('role')||''
      const hqOnly = document.getElementById('hq-only')
      if(hqOnly) hqOnly.classList.toggle('hidden', role==='HQ')
      const link = document.getElementById('csv_link')
      if(link) link.classList.toggle('hidden', role!=='HQ')
      // 設定や管理UIのボタン制御を将来ここに追加
    })
  }

  function mountApp(){
    if(!document.getElementById('app')) return
    mountAuth()
    const sheet = Sheet()
    sheet.mount()
  }

  document.addEventListener('DOMContentLoaded', mountApp)
})()
