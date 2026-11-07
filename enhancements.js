/* v4.5 enhancements — additive only (no changes to app.js logic).
   1) Ctrl/Cmd+K command palette  2) loading skeletons  3) per-debtor progress bar in the table */
(function(){
  'use strict';
  const isEn = () => (document.documentElement.lang === 'en');
  const L = (ar, en) => isEn() ? en : ar;
  const $ = (s, r=document) => r.querySelector(s);

  /* ---------- 2) Loading skeletons: shown until the first KPI render (max 6 s) ---------- */
  const root = document.documentElement;
  root.classList.add('is-loading');
  const stopLoading = () => root.classList.remove('is-loading');
  const total = document.getElementById('statTotal');
  if (total) new MutationObserver((_, o) => { stopLoading(); o.disconnect(); }).observe(total, {childList:true, characterData:true, subtree:true});
  setTimeout(stopLoading, 6000);

  const tr = document.getElementById('statCollectedTrend');
  if (tr) { const setVs = () => tr.setAttribute('data-vs', ' ' + L('عن الشهر الماضي','vs last month')); setVs(); new MutationObserver(setVs).observe(document.documentElement, {attributes:true, attributeFilter:['lang']}); }

  /* ---------- 3) Progress bar under each debtor name (status-coloured) ---------- */
  function decorateRows(){
    let list; try { list = debtors; } catch(e){ return; }
    const body = document.getElementById('debtorsTableBody'); if(!body || !Array.isArray(list)) return;
    body.querySelectorAll('tr[data-id]').forEach(tr => {
      const td = tr.firstElementChild; if(!td || td.querySelector('.mini-bar')) return;
      const d = list.find(x => String(x.id) === tr.dataset.id); if(!d || !(d.total > 0)) return;
      const pct = Math.max(0, Math.min(100, Math.round((d.paid || 0) / d.total * 100)));
      let st = 'active'; try { st = statusOf(d); } catch(e){}
      const promise = !!tr.querySelector('.promise-badge, [class*="promise"]');
      const bar = document.createElement('div');
      bar.className = 'mini-bar ' + (st === 'paid' ? 'is-paid' : st === 'overdue' ? 'is-overdue' : promise ? 'is-promise' : 'is-active');
      bar.title = pct + '%';
      const i = document.createElement('i'); i.style.width = pct + '%'; bar.appendChild(i);
      td.appendChild(bar);
    });
  }
  const tb = document.getElementById('debtorsTableBody');
  if (tb) new MutationObserver(decorateRows).observe(tb, {childList:true});

  /* ---------- 1) Command palette ---------- */
  let overlay, input, listEl, items = [], sel = 0;
  function build(){
    overlay = document.createElement('div'); overlay.className = 'cmdk-overlay';
    overlay.innerHTML = '<div class="cmdk" role="dialog" aria-modal="true"><input class="cmdk-input" type="text" autocomplete="off" spellcheck="false"><div class="cmdk-list" role="listbox"></div><div class="cmdk-foot"></div></div>';
    document.body.appendChild(overlay);
    input = $('.cmdk-input', overlay); listEl = $('.cmdk-list', overlay);
    overlay.addEventListener('mousedown', e => { if(e.target === overlay) close(); });
    input.addEventListener('input', render);
    input.addEventListener('keydown', e => {
      if(e.key === 'ArrowDown'){ e.preventDefault(); move(1); }
      else if(e.key === 'ArrowUp'){ e.preventDefault(); move(-1); }
      else if(e.key === 'Enter'){ e.preventDefault(); run(sel); }
      else if(e.key === 'Escape'){ e.preventDefault(); close(); }
    });
  }
  function pages(){
    return [...document.querySelectorAll('.nav-item[data-page]')].filter(b => b.style.display !== 'none').map(b => ({
      kind: L('انتقال','Go to'), label: (b.querySelector('span:not(.ic)') || b).textContent.trim(), run: () => b.click()
    }));
  }
  function actions(){
    const a = [];
    const add = document.getElementById('addDebtorBtn');
    if(add && !add.disabled) a.push({kind: L('إجراء','Action'), label: L('إضافة مدين جديد','Add new debtor'), run: () => add.click()});
    a.push({kind: L('إجراء','Action'), label: L('تبديل الوضع الليلي / النهاري','Toggle dark / light mode'), run: () => {
      const t = document.getElementById('themeToggleBtn'); if(t) t.click(); }});
    return a;
  }
  function debtorHits(q){
    let list; try { list = scopedDebtors(); } catch(e){ try { list = debtors; } catch(_) { list = []; } }
    const s = q.toLowerCase();
    return list.filter(d => (d.name||'').toLowerCase().includes(s) || (d.phone||'').includes(q)).slice(0, 8).map(d => {
      let rem = 0; try { rem = remaining(d); } catch(e){}
      return {kind: L('مدين','Debtor'), label: d.name, hint: (rem ? Number(rem).toLocaleString('en-US') + ' ' + L('ر.ق','QAR') : ''), run: () => openDrawer(d.id)};
    });
  }
  function render(){
    const q = input.value.trim();
    const all = [...pages(), ...actions()];
    const base = q ? all.filter(x => x.label.toLowerCase().includes(q.toLowerCase())) : all;
    items = q ? [...debtorHits(q), ...base] : base;
    sel = 0; listEl.textContent = '';
    if(!items.length){ const n = document.createElement('div'); n.className = 'cmdk-empty'; n.textContent = L('لا توجد نتائج','No results'); listEl.appendChild(n); return; }
    items.forEach((it, i) => {
      const row = document.createElement('div'); row.className = 'cmdk-item' + (i === 0 ? ' sel' : ''); row.setAttribute('role','option');
      const k = document.createElement('span'); k.className = 'cmdk-kind'; k.textContent = it.kind;
      const l = document.createElement('span'); l.className = 'cmdk-label'; l.textContent = it.label;
      row.append(k, l);
      if(it.hint){ const h = document.createElement('span'); h.className = 'cmdk-hint'; h.textContent = it.hint; row.appendChild(h); }
      row.addEventListener('mousemove', () => highlight(i));
      row.addEventListener('click', () => run(i));
      listEl.appendChild(row);
    });
  }
  function highlight(i){ sel = i; [...listEl.children].forEach((c, j) => c.classList.toggle('sel', j === i)); const c = listEl.children[i]; if(c && c.scrollIntoView) c.scrollIntoView({block:'nearest'}); }
  function move(d){ if(items.length) highlight((sel + d + items.length) % items.length); }
  function run(i){ const it = items[i]; if(!it) return; close(); setTimeout(it.run, 0); }
  function open(){
    const login = document.getElementById('loginScreen');
    if(login && getComputedStyle(login).display !== 'none') return;
    if(!overlay) build();
    input.placeholder = L('ابحث عن مدين أو صفحة أو إجراء…','Search a debtor, page or action…');
    $('.cmdk-foot', overlay).textContent = L('↑↓ للتنقل · Enter للفتح · Esc للإغلاق','↑↓ navigate · Enter open · Esc close');
    overlay.classList.add('show'); input.value = ''; render(); input.focus();
  }
  function close(){ if(overlay) overlay.classList.remove('show'); }
  document.addEventListener('keydown', e => {
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'){ e.preventDefault(); overlay && overlay.classList.contains('show') ? close() : open(); }
  });
  const btn = document.getElementById('cmdkBtn'); if(btn) btn.addEventListener('click', open);

  /* ---------- "More" menu in the quotations toolbar ---------- */
  (function(){
    const btn = document.getElementById('quotMoreBtn'), pop = document.getElementById('quotMorePop');
    if(!btn || !pop) return;
    const setOpen = o => { pop.hidden = !o; btn.setAttribute('aria-expanded', String(o)); };
    btn.addEventListener('click', e => { e.stopPropagation(); setOpen(pop.hidden); });
    document.addEventListener('click', e => { if(!pop.hidden && !pop.contains(e.target)) setOpen(false); });
    document.addEventListener('keydown', e => { if(e.key === 'Escape' && !pop.hidden){ setOpen(false); btn.focus(); } });
    pop.addEventListener('click', e => { const b = e.target.closest('button'); if(b && !b.closest('.file-btn-wrap')) setTimeout(() => setOpen(false), 0); });
    pop.addEventListener('change', () => setOpen(false));
  })();

  /* ---------- Mobile: group quotation filters under one "Filter" button ---------- */
  (function(){
    const wrap = document.getElementById('quotFilterWrap'), btn = document.getElementById('quotFilterBtn');
    if(!wrap || !btn) return;
    const selects = [...wrap.querySelectorAll('select')];
    const count = () => { const n = selects.filter(s => s.value !== 'all').length; btn.classList.toggle('has-filters', n > 0); btn.dataset.count = n; };
    selects.forEach(s => s.addEventListener('change', count)); count();
    btn.addEventListener('click', e => { e.stopPropagation(); const o = !wrap.classList.contains('open'); wrap.classList.toggle('open', o); btn.setAttribute('aria-expanded', String(o)); });
    document.addEventListener('click', e => { if(wrap.classList.contains('open') && !wrap.contains(e.target)){ wrap.classList.remove('open'); btn.setAttribute('aria-expanded','false'); } });
  })();
})();
