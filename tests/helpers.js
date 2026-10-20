// Test harness: loads the real index.html + app.js in jsdom with an in-memory Supabase mock.
const path = require('path');
const { JSDOM, ResourceLoader, VirtualConsole } = require('jsdom');
const ROOT = path.join(__dirname, '..');
const DOMAIN = 'daftar-auth.app';

function makeDb(over = {}) {
  const db = {
    tables: {
      debtors: [
        { id: 1, name: 'عميل أول', type: 'individual', company_number: '', cr_number: '', phone: '+974 5511 2233', total: 1000, paid: 200, due: '2026-01-01', notes: '', rep_id: 1 },
        { id: 2, name: 'عميل ثان', type: 'company', company_number: 'C1', cr_number: '9', phone: '', total: 5000, paid: 0, due: '2030-01-01', notes: '', rep_id: 2 },
      ],
      debtors_activity: [], reps: [{ id: 1, name: 'مندوب 1', phone: '', area: '' }, { id: 2, name: 'مندوب 2', phone: '', area: '' }],
      quotations: [], quotations_activity: [], quotation_files: [], audit_log: [],
      app_settings: [{ id: 1, settings: { reminderDays: 7, theme: 'gold', palette: 'navy' } }, { id: 2, settings: { smsApiKey: 'SECRET', emailApiKey: '' } }],
      profiles: [
        { id: 'u-admin', username: 'admin', role: 'admin', rep_id: null, permissions: null, prefs: { mode: 'light', language: 'en' } },
        { id: 'u-col', username: 'collector', role: 'collector', rep_id: 1, permissions: null, prefs: {} },
        { id: 'u-view', username: 'viewer', role: 'viewer', rep_id: null, permissions: null, prefs: {} },
      ],
    },
    auth: { [`admin@${DOMAIN}`]: { id: 'u-admin', password: 'Admin#1234' }, [`collector@${DOMAIN}`]: { id: 'u-col', password: 'Coll#1234' }, [`viewer@${DOMAIN}`]: { id: 'u-view', password: 'View#1234' } },
    log: [], failLoad: false, authDown: false,
    ...over,
  };
  return db;
}

function mockClient(db) {
  const rec = (e) => db.log.push(e);
  function from(table) {
    const q = { table, filters: [], op: 'select' };
    const b = {
      select() { return b; },
      eq(c, v) { q.filters.push(r => String(r[c]) === String(v)); return b; },
      in(c, vals) { q.filters.push(r => vals.map(String).includes(String(r[c]))); return b; },
      upsert(rows, o) { q.op = 'upsert'; q.rows = [].concat(rows); q.key = (o && o.onConflict) || 'id'; return b; },
      insert(rows) { q.op = 'insert'; q.rows = [].concat(rows); return b; },
      delete() { q.op = 'delete'; return b; },
      maybeSingle() { q.maybe = true; return b; },
      single() { q.single = true; return b; },
      then(res, rej) { return Promise.resolve(exec()).then(res, rej); },
    };
    function exec() {
      const rows = (db.tables[table] = db.tables[table] || []);
      if (q.op === 'select') {
        rec({ op: 'select', table });
        if (db.failLoad && table === 'debtors' && q.filters.length === 0) { db.failLoad = false; return { data: null, error: { message: 'boom' } }; }  // fail the first load only
        const out = rows.filter(r => q.filters.every(f => f(r)));
        if (q.maybe || q.single) return { data: out[0] || null, error: null };
        return { data: out, error: null, count: out.length };
      }
      rec({ op: q.op, table, rows: q.rows });
      if (q.op === 'upsert') q.rows.forEach(r => { const i = rows.findIndex(x => x[q.key] === r[q.key]); if (i >= 0) rows[i] = { ...rows[i], ...r }; else rows.push(r); });
      if (q.op === 'insert') q.rows.forEach(r => rows.push(r));
      if (q.op === 'delete') db.tables[table] = rows.filter(r => !q.filters.every(f => f(r)));
      return { data: q.single ? (q.rows || [])[0] : null, error: null };
    }
    return b;
  }
  const listeners = [];
  return {
    from,
    rpc: async (name, args) => { rec({ op: 'rpc', name, args }); return { data: null, error: null }; },
    functions: { invoke: async (name, { body }) => { rec({ op: 'fn', name, body }); return { data: body.action === 'create' ? { user: { id: 'u-new', username: body.username, role: body.role, rep_id: null, permissions: body.permissions } } : { ok: true }, error: null }; } },
    storage: { from: () => ({ createSignedUrl: async (p) => ({ data: { signedUrl: 'https://signed.test/' + p }, error: null }), upload: async () => ({ error: null }), remove: async () => ({ error: null }) }) },
    auth: {
      signInWithPassword: async ({ email, password }) => {
        rec({ op: 'signIn', email });
        if (db.authDown) return { data: null, error: { status: 0, message: 'network' } };
        const u = db.auth[email];
        if (!u || u.password !== password) return { data: null, error: { status: 400, message: 'Invalid login credentials' } };
        return { data: { user: { id: u.id } }, error: null };
      },
      signOut: async () => { rec({ op: 'signOut' }); return { error: null }; },
      onAuthStateChange: (cb) => { listeners.push(cb); return { data: { subscription: { unsubscribe() {} } } }; },
    },
  };
}

async function boot(over) {
  const db = makeDb(over);
  const storage = { get: 0, set: 0, remove: 0, clear: 0, key: 0 };
  const fakeStorage = { getItem() { storage.get++; return null; }, setItem() { storage.set++; }, removeItem() { storage.remove++; }, clear() { storage.clear++; }, key() { storage.key++; return null; }, length: 0 };
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!/Not implemented/.test(e.message)) errors.push(e.message); });
  class Loader extends ResourceLoader {
    fetch(url, o) {
      if (/vendor\/supabase\.js|591\.supabase/.test(url)) return Promise.resolve(Buffer.from(''));
      if (/chart\.umd/.test(url)) return Promise.resolve(Buffer.from('window.Chart=function(){this.destroy=function(){};this.update=function(){};};window.Chart.register=function(){};'));
      if (/xlsx|jspdf|html2canvas|fonts\.css/.test(url)) return Promise.resolve(Buffer.from(''));
      return super.fetch(url, o);
    }
  }
  const dom = await JSDOM.fromFile(path.join(ROOT, 'index.html'), {
    runScripts: 'dangerously', resources: new Loader(), pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      Object.defineProperty(w, 'localStorage', { get: () => fakeStorage });
      Object.defineProperty(w, 'sessionStorage', { get: () => fakeStorage });
      w.TextEncoder = require('util').TextEncoder;
      w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
      w.HTMLCanvasElement.prototype.getContext = () => null;
      const client = mockClient(db);
      w.supabase = { createClient: () => client };
      w.alert = () => {};
    },
  });
  const w = dom.window;
  await new Promise(r => { if (w.document.readyState === 'complete') r(); else w.addEventListener('load', r); });
  await tick(50);
  return { w, db, storage, errors, ev: (code) => w.eval(code) };
}
const tick = (ms = 20) => new Promise(r => setTimeout(r, ms));

async function login(ctx, user, pass) {
  const { w } = ctx;
  w.document.getElementById('login_user').value = user;
  w.document.getElementById('login_pass').value = pass;
  w.document.getElementById('loginBtn').click();
  await tick(120);
}
module.exports = { boot, login, tick, DOMAIN, ROOT };
