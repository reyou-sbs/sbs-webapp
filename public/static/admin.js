;(function(){
  async function fetchJSON(url, opts={}){
    const headers = Object.assign({ 'Content-Type':'application/json' }, (opts.headers||{}))
    const token = localStorage.getItem('token')||''
    if(token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(url, Object.assign({ headers }, opts))
    if(!res.ok){
      const txt = await res.text()
      throw new Error(`${res.status}:${txt}`)
    }
    const ct = res.headers.get('content-type')||''
    return ct.includes('application/json') ? res.json() : res.text()
  }
  const $ = (s, el=document)=> el.querySelector(s)

  async function mount(){
    const role = localStorage.getItem('role')
    if(role!=='HQ') return
    const root = document.querySelector('.max-w-6xl')
    const box = document.createElement('div')
    box.className = 'bg-white rounded shadow p-4 mt-6'
    box.innerHTML = `
      <h2 class="font-semibold mb-3">マスタ管理（HQ）</h2>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div class="font-medium mb-2">代理店</div>
          <div class="flex gap-2 mb-2">
            <input id="ag-name" class="border rounded px-2 py-1" placeholder="代理店名" />
            <button id="ag-add" class="text-sm px-3 py-1 bg-indigo-700 text-white rounded">追加</button>
          </div>
          <ul id="ag-list" class="list-disc pl-5 text-sm"></ul>
        </div>
        <div>
          <div class="font-medium mb-2">店舗</div>
          <div class="flex gap-2 mb-2">
            <input id="st-name" class="border rounded px-2 py-1" placeholder="店舗名" />
            <input id="st-agency" type="number" class="border rounded px-2 py-1 w-24" placeholder="agency_id" />
            <button id="st-add" class="text-sm px-3 py-1 bg-indigo-700 text-white rounded">追加</button>
          </div>
          <ul id="st-list" class="list-disc pl-5 text-sm"></ul>
        </div>
        <div>
          <div class="font-medium mb-2">メニュー</div>
          <div class="flex gap-2 mb-2">
            <input id="mn-name" class="border rounded px-2 py-1" placeholder="メニュー名" />
            <input id="mn-price" type="number" class="border rounded px-2 py-1 w-28" placeholder="価格" />
            <button id="mn-add" class="text-sm px-3 py-1 bg-indigo-700 text-white rounded">追加</button>
          </div>
          <ul id="mn-list" class="list-disc pl-5 text-sm"></ul>
        </div>
        <div>
          <div class="font-medium mb-2">経費カテゴリ</div>
          <div class="flex gap-2 mb-2">
            <input id="ex-name" class="border rounded px-2 py-1" placeholder="カテゴリ名" />
            <button id="ex-add" class="text-sm px-3 py-1 bg-indigo-700 text-white rounded">追加</button>
          </div>
          <ul id="ex-list" class="list-disc pl-5 text-sm"></ul>
        </div>
      </div>
    `
    root.appendChild(box)

    async function refresh(){
      const [ags, sts, mns, exs] = await Promise.all([
        fetchJSON('/admin/agencies'),
        fetchJSON('/admin/stores'),
        fetchJSON('/admin/menus'),
        fetchJSON('/admin/expense-categories')
      ])
      $('#ag-list').innerHTML = ags.map(a=>`<li>#${a.id} ${a.name}</li>`).join('')
      $('#st-list').innerHTML = sts.map(s=>`<li>#${s.id} ${s.name} (agency:${s.agency_id||'-'})</li>`).join('')
      $('#mn-list').innerHTML = mns.map(m=>`<li>#${m.id} ${m.name} ${m.price}円 ${m.active? 'active':''}</li>`).join('')
      $('#ex-list').innerHTML = exs.map(e=>`<li>#${e.id} ${e.name} ${e.active? 'active':''}</li>`).join('')
    }

    $('#ag-add').onclick = async ()=>{
      const name = $('#ag-name').value
      if(!name) return
      await fetchJSON('/admin/agencies', { method:'POST', body: JSON.stringify({ name }) })
      $('#ag-name').value = ''
      await refresh()
    }
    $('#st-add').onclick = async ()=>{
      const name = $('#st-name').value
      const agency_id = Number($('#st-agency').value||'0')||null
      if(!name) return
      await fetchJSON('/admin/stores', { method:'POST', body: JSON.stringify({ name, agency_id }) })
      $('#st-name').value=''; $('#st-agency').value=''
      await refresh()
    }
    $('#mn-add').onclick = async ()=>{
      const name = $('#mn-name').value
      const price = Number($('#mn-price').value||'0')
      if(!name||price<=0) { alert('メニュー名と正の価格が必要です'); return }
      await fetchJSON('/admin/menus', { method:'POST', body: JSON.stringify({ name, price, active:1 }) })
      $('#mn-name').value=''; $('#mn-price').value=''
      await refresh()
    }
    $('#ex-add').onclick = async ()=>{
      const name = $('#ex-name').value
      if(!name) return
      await fetchJSON('/admin/expense-categories', { method:'POST', body: JSON.stringify({ name, active:1 }) })
      $('#ex-name').value=''
      await refresh()
    }

    await refresh()
  }

  document.addEventListener('DOMContentLoaded', mount)
})()
