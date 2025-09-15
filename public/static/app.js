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

  async function fetchJSON(url, opts={}){
    const res = await fetch(url, Object.assign({ headers:{'Content-Type':'application/json'} }, opts))
    if(!res.ok) throw new Error(await res.text())
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
      const [menus, cats] = await Promise.all([
        fetchJSON('/api/menus'),
        fetchJSON('/api/expense-categories')
      ])
      return { menus, cats }
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

      $('#save').onclick = async ()=>{
        state.date = $('#date').value
        const sales = $$('#sales-rows tr').map(tr=>({
          menu_id: Number($('.menu_id', tr).value),
          quantity: Number($('.qty', tr).value||'1'),
          amount: Number($('.amount', tr).value||'0'),
          note: $('.note', tr).value
        })).filter(r=>r.amount>0)
        const expenses = $$('#expense-rows tr').map(tr=>({
          category_id: Number($('.category_id', tr).value),
          amount: Number($('.amount', tr).value||'0'),
          note: $('.note', tr).value
        })).filter(r=>r.amount>0)
        try{
          const out = await fetchJSON('/api/reports/upsert', { method:'POST', body: JSON.stringify({ store_id: state.store_id, date: state.date, sales, expenses }) })
          toast(`保存しました: 売上 ${out.sales_total} 経費 ${out.expense_total} 収益 ${out.profit}`)
          await renderDashboards()
        }catch(err){
          toast('保存に失敗しました')
          console.error(err)
        }
      }

      await renderDashboards()
      await mountSettings()
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

    async function renderDashboards(){
      const hq = await fetchJSON('/api/dashboard/hq')
      const ag = await fetchJSON('/api/dashboard/agency/1')
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

  function mountApp(){
    if(!document.getElementById('app')) return
    const sheet = Sheet()
    sheet.mount()
  }

  document.addEventListener('DOMContentLoaded', mountApp)
})()
