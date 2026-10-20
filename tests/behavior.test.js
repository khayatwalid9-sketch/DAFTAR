const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { boot, login, tick, ROOT } = require('./helpers');

const writes = (db, pred = () => true) => db.log.filter(e => ['upsert', 'insert', 'delete'].includes(e.op) && pred(e));

test('boot: login screen shown, brand theme applied, NO data requested before sign-in', async () => {
  const c = await boot();
  assert.equal(c.w.document.getElementById('loginScreen').style.display !== 'none', true);
  assert.equal(c.w.document.documentElement.dataset.theme, 'brand');
  assert.equal(c.w.document.documentElement.dataset.palette, 'brand');
  assert.equal(c.db.log.filter(e => e.op === 'select').length, 0, 'anonymous visitors must not read any table');
  assert.deepEqual(c.errors, []);
});

test('nothing is ever read from or written to localStorage/sessionStorage', async () => {
  const c = await boot();
  await login(c, 'admin', 'Admin#1234');
  c.w.document.getElementById('themeToggleBtn').click();
  c.w.document.getElementById('langArBtn').click();
  await tick(500);
  assert.equal(c.storage.get, 0); assert.equal(c.storage.set, 0); assert.equal(c.storage.remove, 0);
});

test('wrong password: error shown, still signed out; 5 failures lock for 30s', async () => {
  const c = await boot();
  await login(c, 'admin', 'nope');
  assert.match(c.w.document.getElementById('loginError').textContent, /غير صحيحة|Invalid/);
  assert.equal(c.ev('currentUser'), null);
  for (let i = 0; i < 4; i++) await login(c, 'admin', 'nope');
  await login(c, 'admin', 'Admin#1234');
  assert.match(c.w.document.getElementById('loginError').textContent, /محاولات كثيرة|Too many/);
  assert.equal(c.ev('currentUser'), null);
});

test('network outage is reported as unavailable, not as a bad password', async () => {
  const c = await boot({ authDown: true });
  await login(c, 'admin', 'Admin#1234');
  assert.match(c.w.document.getElementById('loginError').textContent, /غير متاحة|unavailable/);
});

test('admin sign-in loads data, applies per-user prefs, hides legacy shared theme', async () => {
  const c = await boot();
  await login(c, 'admin', 'Admin#1234');
  assert.equal(c.ev('currentUser.role'), 'admin');
  assert.equal(c.ev('debtors.length'), 2);
  assert.equal(c.ev('users.length'), 3);
  assert.equal(c.w.document.documentElement.dataset.mode, 'light');      // from profile prefs
  assert.equal(c.ev('currentLang'), 'en');
  assert.equal(c.w.document.documentElement.dataset.theme, 'brand');     // legacy shared "gold" ignored
  assert.equal(c.w.document.getElementById('loginScreen').style.display, 'none');
  assert.equal(c.ev('typeof users[0].password'), 'undefined');           // no passwords in memory
  assert.ok(c.db.log.some(e => e.op === 'insert' && e.table === 'audit_log'));
});

test('admin sync: writes debtors/reps and settings rows 1+2; never touches users or upserts audit_log', async () => {
  const c = await boot();
  await login(c, 'admin', 'Admin#1234');
  c.db.log.length = 0;
  c.ev("debtors[0].notes='changed'; reps[0].area='north'; syncToSupabase()");
  await tick(150);
  const tables = writes(c.db).map(e => `${e.op}:${e.table}`);
  assert.ok(tables.includes('upsert:debtors'));
  assert.ok(tables.includes('upsert:reps'));
  const s = writes(c.db, e => e.table === 'app_settings')[0];
  assert.deepEqual(s.rows.map(r => r.id), [1, 2]);
  assert.equal('smsApiKey' in s.rows[0].settings, false, 'API keys must not be in the shared row');
  assert.equal('smsApiKey' in s.rows[1].settings, true);
  for (const k of ['language', 'mode', 'theme', 'palette']) assert.equal(k in s.rows[0].settings, false);
  assert.equal(tables.some(t => /users|upsert:audit_log/.test(t)), false);
});

test('viewer: sees data but produces zero writes', async () => {
  const c = await boot();
  await login(c, 'viewer', 'View#1234');
  assert.equal(c.ev('debtors.length'), 2);
  c.db.log.length = 0;
  c.ev("debtors[0].notes='x'; syncToSupabase()");
  await tick(100);
  assert.equal(writes(c.db, e => e.table !== 'audit_log').length, 0);
});

test('collector: syncs debtors but never reps/settings (admin-only tables)', async () => {
  const c = await boot();
  await login(c, 'collector', 'Coll#1234');
  c.db.log.length = 0;
  c.ev("debtors[0].notes='x'; syncToSupabase()");
  await tick(100);
  const t = writes(c.db).map(e => e.table);
  assert.ok(t.includes('debtors'));
  assert.equal(t.includes('reps'), false); assert.equal(t.includes('app_settings'), false);
});

test('safety: if the initial load fails, sync is blocked so server data cannot be wiped', async () => {
  const c = await boot({ failLoad: true });
  await login(c, 'admin', 'Admin#1234');
  assert.equal(c.ev('dataLoaded'), false);
  c.db.log.length = 0;
  const r = await c.ev('syncToSupabase()');
  assert.equal(r, false);
  assert.equal(writes(c.db).length, 0);
});

test('preferences are saved to the profile via RPC (debounced), not to the browser', async () => {
  const c = await boot();
  await login(c, 'collector', 'Coll#1234');
  c.db.log.length = 0;
  c.w.document.getElementById('themeToggleBtn').click();
  await tick(600);
  const rpc = c.db.log.find(e => e.op === 'rpc' && e.name === 'set_my_prefs');
  assert.ok(rpc); assert.equal(rpc.args.p.mode, 'light');
  assert.equal(c.storage.set, 0);
});

test('user management goes through the admin Edge Function; passwords are never stored in tables', async () => {
  const c = await boot();
  await login(c, 'admin', 'Admin#1234');
  c.w.document.getElementById('u_name').value = 'newguy';
  c.w.document.getElementById('u_password').value = 'LongPass#99';
  c.w.document.getElementById('u_role').value = 'viewer';
  c.w.document.getElementById('addUserBtn').click();
  await tick(100);
  const fn = c.db.log.find(e => e.op === 'fn');
  assert.equal(fn.name, 'admin-users'); assert.equal(fn.body.action, 'create');
  assert.equal(c.ev('users.some(u=>u.username==="newguy")'), true);
  assert.equal(JSON.stringify(c.db.log.filter(e => e.table)).includes('LongPass'), false);
});

test('attachments open through short-lived signed URLs', async () => {
  const c = await boot();
  await login(c, 'admin', 'Admin#1234');
  const url = await c.ev('getQuotationFileUrl({storagePath:"1/a.pdf"})');
  assert.match(url, /^https:\/\/signed\.test\/1\/a\.pdf$/);
});

test('dashboard: no fabricated trend numbers; rate meter is driven by real data', async () => {
  const c = await boot();
  await login(c, 'admin', 'Admin#1234');
  const d = c.w.document;
  for (const id of ['statTotalTrend', 'statOverdueTrend', 'statActiveTrend']) assert.equal(d.getElementById(id).textContent, '');
  assert.equal(d.getElementById('statRateBar').style.width, '3%'.replace('3%', d.getElementById('statCollectionRate').textContent));
});

test('accessibility: nav items are real buttons; dialogs have role + aria-modal; skip link exists', async () => {
  const c = await boot();
  const d = c.w.document;
  const navs = [...d.querySelectorAll('.nav-item')];
  assert.equal(navs.length, 9);
  assert.ok(navs.every(n => n.tagName === 'BUTTON'));
  assert.ok(d.querySelector('.skip-link'));
  const dialogs = [...d.querySelectorAll('.overlay .modal, .drawer')];
  assert.ok(dialogs.length > 0 && dialogs.every(x => x.getAttribute('role') === 'dialog' && x.getAttribute('aria-modal') === 'true'));
  navs[1].click();
  assert.equal(navs[1].getAttribute('aria-current'), 'page');
  assert.equal(d.querySelector('.bnav-item[data-page="debtors"]').classList.contains('active'), true);
});

test('static: no browser-storage APIs beyond the legacy purge; no inline handlers; no plaintext password code', () => {
  const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const hits = app.split('\n').filter(l => /localStorage|sessionStorage|indexedDB|document\.cookie/.test(l) && !/^\s*\/\//.test(l));
  assert.equal(hits.length, 2, 'only the two legacy-purge lines may mention storage: ' + hits.join(' | '));
  assert.ok(hits.every(l => /\.clear\(\)/.test(l)));
  assert.equal(/ on(click|change|input|load|error)=/i.test(html), false);
  assert.equal(/ on(click|change)=/i.test(app), false);
  assert.equal(/from\('users'\)/.test(app), false);
  assert.equal(/\.eq\('password'/.test(app), false);
});

test('static: security headers/CSP configured; config has a single source', () => {
  const v = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  const headers = JSON.stringify(v);
  for (const h of ['Content-Security-Policy', 'X-Frame-Options', 'Strict-Transport-Security', 'X-Content-Type-Options', 'Referrer-Policy']) assert.match(headers, new RegExp(h));
  assert.match(headers, /script-src 'self'/);
  assert.equal(/'unsafe-inline'[^"]*script|script-src[^;]*'unsafe-inline'/.test(headers), false);
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.equal(html.includes('anonKey'), false);
  assert.equal(/https:\/\/(cdn|fonts)/.test(html), false, 'no third-party CDN hosts');
});

test('static: app.js talks to no third-party host except Supabase and the wa.me link', () => {
  const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  const hosts = [...app.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map(m => m[1].toLowerCase()).filter(h => !/(^|\.)w3\.org$/.test(h));
  const allowed = new Set(['wa.me']);
  assert.deepEqual([...new Set(hosts)].filter(h => !allowed.has(h)), []);
});

test('row-level sync: only changed rows are sent; rows added by another user are never deleted', async () => {
  const c = await boot();
  await login(c, 'admin', 'Admin#1234');
  // another user adds a debtor on the server after we loaded
  c.db.tables.debtors.push({ id: 99, name: 'من مستخدم آخر', type: 'individual', total: 1, paid: 0, due: '2030-01-01', rep_id: 1 });
  c.db.log.length = 0;
  c.ev("debtors[0].notes='edited'; syncToSupabase()");
  await tick(150);
  const up = writes(c.db, e => e.op === 'upsert' && e.table === 'debtors');
  assert.equal(up.length, 1); assert.deepEqual(up[0].rows.map(r => r.id), [1]);
  assert.equal(writes(c.db, e => e.op === 'delete').length, 0);
  assert.ok(c.db.tables.debtors.some(r => r.id === 99), 'foreign row must survive');
});

test('row-level sync: an unchanged state produces no writes; a local delete removes only that id', async () => {
  const c = await boot();
  await login(c, 'admin', 'Admin#1234');
  c.db.log.length = 0;
  await c.ev('syncToSupabase()');
  assert.equal(writes(c.db, e => ['debtors', 'debtors_activity', 'reps'].includes(e.table)).length, 0);
  c.ev('debtors = debtors.filter(d=>d.id!==2); syncToSupabase()');
  await tick(150);
  const del = writes(c.db, e => e.op === 'delete' && e.table === 'debtors');
  assert.equal(del.length, 1);
  assert.equal(c.db.tables.debtors.some(r => r.id === 2), false);
  assert.equal(c.db.tables.debtors.some(r => r.id === 1), true);
});
