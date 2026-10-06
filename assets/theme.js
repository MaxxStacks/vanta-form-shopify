document.documentElement.classList.remove('no-js');

(() => {
'use strict';

const emitVF = (name, detail = {}) => {
  window.dispatchEvent(new CustomEvent(`vf:${name}`, { detail }));
  if (Array.isArray(window.dataLayer)) window.dataLayer.push({ event: `vf_${name}`, ...detail });
};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const store = {
  get(k) { try { return localStorage.getItem('vf_' + k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem('vf_' + k, v); } catch (e) { /* storage unavailable */ } }
};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let CFG = { freeShipping: 0, moneyFormat: '${{amount}}', routes: { cart: '/cart', cartAdd: '/cart/add.js', cartChange: '/cart/change.js', search: '/search', predictive: '/search/suggest' }, upsells: [] };
try { CFG = Object.assign(CFG, JSON.parse($('[data-vf-config]')?.textContent || '{}')); } catch (e) { /* defaults */ }

const money = (cents) => {
  const n = (Number(cents) || 0) / 100;
  const fmt = (v, d, ts, ds) => { const [i, f] = v.toFixed(d).split('.'); return i.replace(/\B(?=(\d{3})+(?!\d))/g, ts) + (d ? ds + f : ''); };
  return CFG.moneyFormat.replace(/\{\{\s*(\w+)\s*\}\}/, (_, k) => ({
    amount: fmt(n, 2, ',', '.'), amount_no_decimals: fmt(n, 0, ',', '.'),
    amount_with_comma_separator: fmt(n, 2, '.', ','), amount_no_decimals_with_comma_separator: fmt(n, 0, '.', ','),
    amount_with_apostrophe_separator: fmt(n, 2, "'", '.'), amount_with_space_separator: fmt(n, 2, ' ', ',')
  }[k] ?? fmt(n, 2, ',', '.'))).replace(/<[^>]*>/g, '');
};

const toastEl = $('[data-vf-toast]'); let toastT;
const toast = (m) => { if (!toastEl) return; toastEl.textContent = m; toastEl.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { toastEl.hidden = true; }, 2800); };

/* ---------- layers ---------- */
let openLayer = null, lastFocus = null;
const lock = (on) => document.documentElement.classList.toggle('vf-locked', on);
function open(name) {
  const el = $(`[data-vf-layer="${name}"]`); if (!el) return;
  if (openLayer) close(true);
  lastFocus = document.activeElement; el.hidden = false; openLayer = el; lock(true);
  if (name === 'bag') refreshBag();
  if (name === 'search') setTimeout(() => $('[data-vf-q]')?.focus(), 30);
  else setTimeout(() => (el.querySelector('input[type=email]') || el.querySelector('[data-vf-close].ib') || el.querySelector('button'))?.focus(), 30);
  if (name === 'nl') store.set('nl_seen', '1');
  emitVF('open_' + name);
}
function close(silent) {
  if (!openLayer) return; openLayer.hidden = true; openLayer = null; lock(false);
  if (!silent && lastFocus) try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
}
document.addEventListener('click', (e) => {
  const o = e.target.closest('[data-vf-open]'); if (o) { e.preventDefault(); open(o.dataset.vfOpen); return; }
  if (e.target.closest('[data-vf-close]')) { e.preventDefault(); close(); return; }
  const t = e.target.closest('[data-vf-event]'); if (t) emitVF(t.dataset.vfEvent);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

/* ---------- age gate ---------- */
const gate = $('[data-vf-gate]');
if (gate && CFG.gate && !store.get('age')) { gate.hidden = false; lock(true); setTimeout(() => $('[data-vf-gate-yes]')?.focus(), 30); }
$('[data-vf-gate-yes]')?.addEventListener('click', () => { store.set('age', '1'); gate.hidden = true; lock(false); armNl(); });
$('[data-vf-gate-no]')?.addEventListener('click', () => { const m = $('[data-vf-gate-msg]'); if (m) m.hidden = false; });

/* ---------- Inner Circle popup ---------- */
function armNl() {
  if (!$('[data-vf-layer="nl"]')) return;
  if ($('[data-vf-nl-success]')) { open('nl'); return; }
  if (!CFG.nlPopup || store.get('nl_seen')) return;
  setTimeout(() => { if (!openLayer && !(gate && !gate.hidden)) open('nl'); }, (CFG.nlDelay || 15) * 1000);
}
if (!gate || gate.hidden) armNl();

/* ---------- bag ---------- */
const setCount = (n) => { $$('[data-vf-count]').forEach((el) => { el.textContent = n; if (el.classList.contains('bdg')) el.dataset.n = n; }); };
async function getCart() { const r = await fetch(CFG.routes.cart + '.js', { headers: { Accept: 'application/json' } }); return r.json(); }
async function changeLine(line, quantity) {
  const r = await fetch(CFG.routes.cartChange, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ line, quantity }) });
  return r.json();
}
async function addItems(items) {
  const r = await fetch(CFG.routes.cartAdd, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ items }) });
  const j = await r.json(); if (!r.ok) throw new Error(j.description || j.message || 'Could not add to bag'); return j;
}
const thumb = (src, alt) => `<div class="slot mini">${src ? `<img src="${esc(src)}" alt="${esc(alt || '')}" loading="lazy" width="168" height="168">` : '<span class="ca" aria-hidden="true"><b>Image</b></span>'}</div>`;
function renderBag(cart) {
  setCount(cart.item_count);
  const body = $('[data-vf-bag-body]'), foot = $('[data-vf-bag-foot]'); if (!body) return;
  if (!cart.item_count) {
    body.innerHTML = `<div style="text-align:center;padding-block:56px;display:grid;gap:14px"><p class="cap h3">Your bag is empty</p><p class="sm">Find your fit, or explore the collection.</p><a class="btn" href="/pages/fit-lab">Find your fit</a><a class="btn o" href="/collections/all">Shop the collection</a></div>`;
    foot.innerHTML = ''; return;
  }
  const sub = cart.total_price, th = CFG.freeShipping || 0;
  const bar = th ? `<div style="display:grid;gap:8px;margin-bottom:6px"><p style="font-size:14px">${sub >= th ? '<b class="pop">Free discreet shipping unlocked</b>' : `<b>${money(th - sub)}</b> away from free discreet shipping`}</p><div class="ship"><i style="width:${Math.min(100, sub / th * 100)}%"></i></div></div>` : '';
  const lines = cart.items.map((it, i) => `<div class="ln">${thumb(it.image ? it.image + (it.image.includes('?') ? '&' : '?') + 'width=200' : '', it.product_title)}<div style="min-width:0;display:grid;gap:4px"><div class="sum"><a href="${esc(it.url)}" style="text-decoration:none"><b style="text-transform:uppercase">${esc(it.product_title)}</b></a><span>${money(it.final_line_price)}</span></div>${it.variant_title ? `<p class="sm" style="font-size:13px">${esc(it.variant_title)}</p>` : ''}${(it.properties && Object.keys(it.properties).length) ? `<p class="sm" style="font-size:12px">${Object.entries(it.properties).filter(([k]) => !k.startsWith('_')).map(([k, v]) => esc(k + ': ' + v)).join(' · ')}</p>` : ''}<div class="sum" style="align-items:center;margin-top:6px"><div class="qty"><button type="button" data-vf-line="${i + 1}" data-vf-qty="${it.quantity - 1}" aria-label="One fewer">−</button><span>${it.quantity}</span><button type="button" data-vf-line="${i + 1}" data-vf-qty="${it.quantity + 1}" aria-label="One more">+</button></div><button class="tl" type="button" data-vf-line="${i + 1}" data-vf-qty="0">Remove</button></div></div></div>`).join('');
  const inCart = new Set(cart.items.map((x) => x.variant_id));
  const ups = (CFG.upsells || []).filter((u) => u.available && !inCart.has(u.variant)).slice(0, 2);
  const upsHtml = ups.length ? `<p class="k" style="margin:24px 0 10px">Often added</p><div style="display:grid;gap:8px">${ups.map((u) => `<div class="ups">${thumb(u.image, u.title)}<div><b style="font-size:14px;text-transform:uppercase">${esc(u.title)}</b><p class="sm" style="font-size:13px">${money(u.price)}${u.desc ? ' · ' + esc(u.desc) : ''}</p></div><button class="btn o" type="button" style="min-height:40px;padding:0 14px;font-size:11px" data-vf-upsell="${u.variant}">Add</button></div>`).join('')}</div>` : '';
  body.innerHTML = bar + lines + upsHtml;
  const disc = cart.cart_level_discount_applications?.length || cart.items.some((x) => x.line_level_discount_allocations?.length);
  foot.innerHTML = `<form data-vf-promo style="display:flex;gap:8px"><label class="sr" for="vf-promo">Promo code</label><input id="vf-promo" class="inp" placeholder="Promo code" style="min-height:46px;text-transform:uppercase" autocomplete="off"><button class="btn o" type="submit" style="min-height:46px;padding:0 18px">Apply</button></form>${disc ? '<p class="sm pop">Discount applied</p>' : ''}<div class="sum"><span class="sm">Subtotal</span><b>${money(sub)}</b></div><p class="sm" style="font-size:13px">${esc(CFG.cartNote || '')} Taxes and shipping calculated at checkout.</p><a class="btn full" href="/checkout" style="min-height:58px">Checkout · ${money(sub)}</a>`;
}
async function refreshBag() { try { renderBag(await getCart()); } catch (e) { const b = $('[data-vf-bag-body]'); if (b) b.innerHTML = '<p class="sm">Your bag could not load. <a href="/cart">Open the bag page</a>.</p>'; } }
document.addEventListener('click', async (e) => {
  const q = e.target.closest('[data-vf-qty]');
  if (q) { e.preventDefault(); q.disabled = true; try { renderBag(await changeLine(+q.dataset.vfLine, Math.max(0, +q.dataset.vfQty))); } catch (err) { toast('Could not update your bag'); } return; }
  const u = e.target.closest('[data-vf-upsell]');
  if (u) { e.preventDefault(); u.disabled = true; try { await addItems([{ id: +u.dataset.vfUpsell, quantity: 1 }]); await refreshBag(); emitVF('add_to_cart', { variant_id: +u.dataset.vfUpsell, source: 'upsell' }); } catch (err) { toast(err.message); u.disabled = false; } }
  const a = e.target.closest('[data-vf-add-variant]');
  if (a) { e.preventDefault(); a.disabled = true; try { await addItems([{ id: +a.dataset.vfAddVariant, quantity: 1 }]); open('bag'); emitVF('add_to_cart', { variant_id: +a.dataset.vfAddVariant }); } catch (err) { toast(err.message); } a.disabled = false; }
});
document.addEventListener('submit', (e) => {
  const p = e.target.closest('[data-vf-promo]');
  if (p) { e.preventDefault(); const code = (p.querySelector('input').value || '').trim(); if (code) window.location.href = '/discount/' + encodeURIComponent(code) + '?redirect=' + encodeURIComponent(CFG.routes.cart); }
});

/* ---------- product ---------- */
$$('[data-vf-product]').forEach((root) => {
  const form = root.querySelector('[data-vf-product-form]'); if (!form) return;
  let variants = []; try { variants = JSON.parse(root.querySelector('[data-vf-variants]').textContent); } catch (e) { return; }
  const idInput = form.querySelector('[name="id"]');
  const priceEls = $$('[data-vf-price]'), compareEl = root.querySelector('[data-vf-compare]');
  const addBtns = $$('[data-vf-add]');
  const sel = () => [...form.querySelectorAll('[data-vf-option]')].map((g) => { const c = g.querySelector('input:checked'); const v = c ? c.value : ''; const d = g.querySelector('[data-vf-option-value]'); if (d) d.textContent = v; return v; });
  const update = () => {
    const opts = sel();
    const v = variants.find((x) => x.options.every((val, i) => val === opts[i]));
    $$('[data-vf-option]', form).forEach((g, gi) => g.querySelectorAll('input').forEach((inp) => {
      const test = opts.slice(); test[gi] = inp.value;
      const m = variants.find((x) => x.options.every((val, i) => val === test[i]));
      inp.closest('.o')?.classList.toggle('na', !m || !m.available);
    }));
    if (!v) { addBtns.forEach((b) => { b.disabled = true; b.querySelector('[data-vf-add-label]').textContent = 'Unavailable'; }); return; }
    idInput.value = v.id;
    priceEls.forEach((el) => { el.textContent = v.priceFormatted; });
    if (compareEl) { const sale = v.compareAtPrice > v.price; compareEl.textContent = sale ? v.compareAtPriceFormatted : ''; compareEl.hidden = !sale; }
    addBtns.forEach((b) => { b.disabled = !v.available; const l = b.querySelector('[data-vf-add-label]'); if (l) l.textContent = v.available ? (b.dataset.short ? 'Add to bag' : 'Add to bag · ' + v.priceFormatted) : 'Sold out'; });
    const url = new URL(window.location.href); url.searchParams.set('variant', v.id); window.history.replaceState({}, '', url);
    if (v.featuredMediaId) { const t = root.querySelector(`[data-vf-thumb][data-media="${v.featuredMediaId}"]`); if (t) t.click(); }
    emitVF('variant_change', { variant_id: v.id, available: v.available });
  };
  form.addEventListener('change', (e) => { if (e.target.closest('[data-vf-option]')) update(); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[data-vf-add]'); if (btn) btn.disabled = true;
    try {
      const fd = new FormData(form);
      const item = { id: +fd.get('id'), quantity: +(fd.get('quantity') || 1) };
      const props = {}; for (const [k, v] of fd.entries()) { const m = k.match(/^properties\[(.+)\]$/); if (m && v) props[m[1]] = v; }
      if (Object.keys(props).length) item.properties = props;
      await addItems([item]); open('bag'); emitVF('add_to_cart', { variant_id: item.id });
    } catch (err) { toast(err.message); }
    if (btn) btn.disabled = false; update();
  });
  $$('[data-vf-add-proxy]').forEach((b) => b.addEventListener('click', () => form.requestSubmit()));
  update();
  /* gallery */
  const slides = $$('.gmain .slide', root), thumbs = $$('[data-vf-thumb]', root);
  thumbs.forEach((t) => t.addEventListener('click', () => { const i = +t.dataset.vfThumb; slides.forEach((s, si) => s.classList.toggle('on', si === i)); thumbs.forEach((x, xi) => x.setAttribute('aria-current', String(xi === i))); }));
  /* sticky bar */
  const sbar = $('[data-vf-sbar]'), main = root.querySelector('[data-vf-add]');
  if (sbar && main && 'IntersectionObserver' in window) new IntersectionObserver(([en]) => sbar.classList.toggle('on', !en.isIntersecting && en.boundingClientRect.top < 0)).observe(main);
});

/* ---------- predictive search ---------- */
const q = $('[data-vf-q]'), qr = $('[data-vf-results]'); let qT;
if (q && qr) q.addEventListener('input', () => {
  clearTimeout(qT); const term = q.value.trim(); if (term.length < 2) { qr.innerHTML = ''; return; }
  qT = setTimeout(async () => {
    try {
      const r = await fetch(`${CFG.routes.predictive}.json?q=${encodeURIComponent(term)}&resources[type]=product,collection,page,article&resources[limit]=6`);
      const j = await r.json(); const R = j.resources?.results || {};
      const rows = [...(R.collections || []).map((c) => ({ t: c.title, u: c.url, s: 'Collection', img: c.featured_image?.url })), ...(R.products || []).map((p) => ({ t: p.title, u: p.url, s: money(Math.round(parseFloat(p.price) * 100)), img: p.image })), ...(R.pages || []).map((p) => ({ t: p.title, u: p.url, s: 'Page' })), ...(R.articles || []).map((a) => ({ t: a.title, u: a.url, s: 'Journal', img: a.image }))];
      qr.innerHTML = rows.length ? rows.map((x) => `<a class="res" href="${esc(x.u)}">${thumb(x.img, x.t)}<span><h4 style="font-size:16px;font-weight:800;text-transform:uppercase;margin:0">${esc(x.t)}</h4></span><span class="sm">${esc(x.s)}</span></a>`).join('') + `<p style="margin-top:14px"><a class="lnk" href="${CFG.routes.search}?q=${encodeURIComponent(term)}">All results</a></p>` : `<p class="sm" style="padding:16px 0">Nothing matches “${esc(term)}”. Try discreet, flat or keyholder.</p>`;
    } catch (e) { qr.innerHTML = ''; }
  }, 220);
});

/* ---------- fit finder ---------- */
$$('[data-vf-fit]').forEach((root) => {
  let C; try { C = JSON.parse(root.querySelector('[data-vf-fit-data]').textContent); } catch (e) { return; }
  const S = { step: 1, want: '', exp: '', m1: +(store.get('m1') || 140) };
  const base = (m) => (m < 120 ? 'A' : m < 145 ? 'B' : m < 170 ? 'C' : 'D');
  const stage = root.querySelector('[data-vf-fit-stage]');
  const pick = () => { const w = C.wants.find((x) => x.id === S.want); if (!w || !w.products.length) return { w, p: null }; const ps = w.products; const p = S.exp === 'first' ? ps[0] : S.exp === 'exp' ? ps[ps.length - 1] : ps[Math.min(1, ps.length - 1)]; return { w, p }; };
  const render = () => {
    let b = '';
    if (S.step === 1) b = `<h1 class="cap h1">${esc(C.h1)}</h1><div class="fo" role="group" aria-label="What you want most">${C.wants.map((w) => `<button type="button" class="fopt" data-k="want" data-v="${esc(w.id)}" aria-pressed="${S.want === w.id}"><b>${esc(w.label)}</b><span>${esc(w.desc)}</span></button>`).join('')}</div>`;
    else if (S.step === 2) b = `<h1 class="cap h1">How much<br><span class="pop">experience?</span></h1><div class="fo" role="group" aria-label="Experience">${C.exp.map((w) => `<button type="button" class="fopt" data-k="exp" data-v="${w[0]}" aria-pressed="${S.exp === w[0]}"><b>${esc(w[1])}</b><span>${esc(w[2])}</span></button>`).join('')}</div>`;
    else if (S.step === 3) b = `<h1 class="cap h1">Your <span class="pop">base.</span></h1><p class="body" style="margin-top:18px">Wrap a strip of paper around the base, at rest, mark the overlap and measure it in millimetres.</p><div class="rng"><label class="lbl" for="vf-m1">Base circumference</label><output id="vf-m1o" for="vf-m1">${S.m1}<small>mm</small></output><input id="vf-m1" class="r" type="range" min="80" max="220" value="${S.m1}" aria-valuetext="${S.m1} millimetres"><div class="sum sm"><span>80 mm</span><span>Base <b id="vf-bo" style="color:var(--ink)">${base(S.m1)}</b></span><span>220 mm</span></div></div><p class="sm" style="margin-top:20px">Your measurement stays on this device. <a class="tl" href="${esc(C.guide)}">How to measure</a></p>`;
    else {
      const { w, p } = pick(); store.set('m1', S.m1);
      b = p ? `<p class="k pop">Your fit</p><h1 class="cap h1" style="margin-top:12px">${esc(p.title)}</h1><div class="result">${thumb(p.image, p.title).replace('slot mini', 'slot')}<div style="display:grid;gap:20px"><p class="body">${esc(w.who || w.desc)}</p><div class="box" style="grid-template-columns:1fr 1fr"><div><b>Base</b><span class="sm">${base(S.m1)} · from ${S.m1} mm</span></div><div><b>Price</b><span class="sm">${money(p.price)}</span></div></div><div style="display:grid;gap:10px">${p.available ? `<button class="btn" type="button" data-vf-add-variant="${p.variant}">Add to bag</button>` : ''}<a class="btn o" href="${esc(p.url)}">See it and customize</a></div><p class="sm">Recommended base: ${base(S.m1)}. Fit guidance is a starting point, not medical advice.</p></div></div>`
        : `<h1 class="cap h1">${esc(w ? w.label : '')}</h1><p class="body" style="margin-top:18px">Products for this direction are being released. <a class="tl" href="${esc(w ? w.url : '/collections/all')}">View the collection</a>.</p>`;
    }
    const can = { 1: !!S.want, 2: !!S.exp, 3: true }[S.step];
    stage.innerHTML = `<p class="k">Find your fit · ${S.step} of 4</p><div class="prog" aria-hidden="true">${[1, 2, 3, 4].map((i) => `<i class="${i <= S.step ? 'on' : ''}"></i>`).join('')}</div><div style="margin-top:56px">${b}</div>${S.step < 4 ? `<div style="display:flex;gap:10px;margin-top:40px">${S.step > 1 ? '<button class="btn o" type="button" data-nav="back">Back</button>' : ''}<button class="btn" type="button" style="flex:1;max-width:320px" data-nav="next" ${can ? '' : 'disabled'}>${S.step === 3 ? 'See my fit' : 'Continue'}</button></div>` : '<button class="tl" type="button" style="margin-top:32px" data-nav="reset">Start again</button>'}`;
  };
  root.addEventListener('click', (e) => {
    const o = e.target.closest('[data-k]'); if (o) { S[o.dataset.k] = o.dataset.v; render(); root.querySelector(`[data-k="${o.dataset.k}"][data-v="${o.dataset.v}"]`)?.focus(); return; }
    const n = e.target.closest('[data-nav]'); if (!n) return;
    if (n.dataset.nav === 'next') { S.step++; emitVF('fit_step', { step: S.step }); } else if (n.dataset.nav === 'back') S.step = Math.max(1, S.step - 1); else Object.assign(S, { step: 1, want: '', exp: '' });
    render(); root.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  root.addEventListener('input', (e) => { if (e.target.id === 'vf-m1') { S.m1 = +e.target.value; $('#vf-m1o').innerHTML = S.m1 + '<small>mm</small>'; $('#vf-bo').textContent = base(S.m1); e.target.setAttribute('aria-valuetext', S.m1 + ' millimetres'); } });
  render();
});
})();
