;(function(){
  const $ = (s, el=document)=> el.querySelector(s)
  const $$ = (s, el=document)=> Array.from(el.querySelectorAll(s))
  function mark(el, ok){ el.classList.toggle('ring-2', !ok); el.classList.toggle('ring-red-400', !ok) }
  document.addEventListener('input', (e)=>{
    const tr = e.target.closest('tr')
    if(!tr) return
    const amt = $('.amount', tr)
    if(amt){ const val = Number(amt.value||'0'); mark(amt, val>0) }
  })
})()
