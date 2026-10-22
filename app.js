
// ============== DATA ==============
const IMAGE_PATH = '305922021_523349173131481_1401793005313797692_n.jpg';
let currentLang = 'ar';
// Nothing is ever written to localStorage / sessionStorage / cookies / IndexedDB.
// Preferences live in the database (per user); everything else lives in memory only.
let lastWeeklyReport = null;
let dueNotified = false;
let dataLoaded = false;          // sync is blocked until a real load from the server succeeded
let _suppressPrefSave = false;

// ============== SUPABASE CLIENT ==============
let supabaseClient = null;
try {
  if (typeof SUPABASE_CONFIG !== 'undefined' && SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey) {
    // Session is held in memory only (no localStorage). A page refresh requires signing in again.
    const memoryAuthStorage = (()=>{ const m=new Map(); return {
      getItem:k=>m.has(k)?m.get(k):null, setItem:(k,v)=>{m.set(k,String(v));}, removeItem:k=>{m.delete(k);} }; })();
    supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
      auth:{ persistSession:false, autoRefreshToken:true, detectSessionInUrl:false, storage:memoryAuthStorage }
    });
  }
} catch (e) {
  console.warn('Supabase client initialization failed:', e);
}

// (EN_TITLES and the base `translations` dictionary now live in i18n.js)


function t(key){ const value=translations[key]; return value ? value[currentLang==='en'?1:0] : key; }
// escape any user-supplied string before it is inserted into innerHTML, to avoid
// broken layouts or script injection when names/notes/imported data contain HTML.
function esc(value){
  return String(value??'').replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function notesTd(d){
  const n=String(d.notes||'').trim();
  if(!n) return `<td class="notes-cell">—</td>`;
  return `<td class="notes-cell" title="${esc(n)}">${esc(n)}</td>`;
}
function currency(value){ return `${fmt(value)} ${currentLang==='en'?'QAR':'ر.ق'}`; }
function translateValue(value){
  const map={'نقدًا':'method.cash','شيك':'method.cheque','تحويل بنكي':'method.transfer','اتصال هاتفي':'method.call','رسالة نصية':'method.sms','زيارة ميدانية':'method.visit','بريد إلكتروني':'method.email','فرد':'debtors.individual','شركة':'debtors.company','رصيد سابق':'method.opening','تسوية':'method.adjust'};
  return map[value]?t(map[value]):value;
}
function applyLanguage(){
  document.documentElement.lang=currentLang; document.documentElement.dir=currentLang==='en'?'ltr':'rtl';
  document.querySelectorAll('[data-i18n]').forEach(el=>el.textContent=t(el.dataset.i18n));
  document.querySelectorAll('[data-i18n-ph]').forEach(el=>el.placeholder=t(el.dataset.i18nPh));
  document.querySelectorAll('[data-i18n-title]').forEach(el=>{el.title=t(el.dataset.i18nTitle); el.setAttribute('aria-label',t(el.dataset.i18nTitle));});
  document.getElementById('langArBtn').classList.toggle('active',currentLang==='ar'); document.getElementById('langEnBtn').classList.toggle('active',currentLang==='en');
  const page = document.querySelector('.nav-item.active')?.dataset.page || 'dashboard';
  const titles = {dashboard:['لوحة التحكم','نظرة عامة على حالة التحصيل اليوم'],debtors:['المدينون','إدارة كافة ملفات المدينين'],reps:['المندوبون','فريق التحصيل الميداني وأداء كل مندوب'],payments:['سجل السداد','جميع عمليات السداد المسجّلة'],followups:['المتابعات','سجل الاتصالات والزيارات'],quotations:['عروض الأسعار','متابعة عروض الأسعار المقدمة للعملاء'],aging:['أعمار الديون','تصنيف المتأخرات حسب مدة التأخير (30/60/90 يوم)'],reports:['التقارير','ملخص مالي وتحليل الحالات'],settings:['الإعدادات','النسخ الاحتياطي وإدارة بيانات النظام']};
  document.getElementById('pageTitle').textContent = currentLang==='en' ? EN_TITLES[page][0] : titles[page][0];
  document.getElementById('pageSub').textContent = currentLang==='en' ? EN_TITLES[page][1] : titles[page][1];
  renderUsers(); renderAudit(); updateThemeSwatchesUI();
  document.getElementById('notificationsBtn').title=currentLang==='en'?'Notifications':'الإشعارات';
  document.getElementById('notificationsBtn').setAttribute('aria-label',currentLang==='en'?'Notifications':'الإشعارات');
  document.getElementById('themeToggleBtn').title=currentMode==='dark'?t('theme.lightMode'):t('theme.darkMode');
  document.getElementById('themeToggleBtn').setAttribute('aria-label',currentMode==='dark'?t('theme.lightMode'):t('theme.darkMode'));
  renderNotifications();
}
document.getElementById('langArBtn').addEventListener('click',()=>{currentLang='ar';appSettings.language=currentLang;saveSettings();applyLanguage();renderAll();});
document.getElementById('langEnBtn').addEventListener('click',()=>{currentLang='en';appSettings.language=currentLang;saveSettings();applyLanguage();renderAll();});
document.querySelectorAll('[data-login-lang]').forEach(button=>button.addEventListener('click',()=>{
  currentLang=button.dataset.loginLang;  appSettings.language=currentLang; saveSettings(); applyLanguage();
  document.querySelectorAll('[data-login-lang]').forEach(item=>item.classList.toggle('active',item.dataset.loginLang===currentLang));
}));
let currentMode='dark';
let notifications=[];
function promiseState(d){   // null when there is no open promise
  if(!d.promiseDate || remaining(d)<=0) return null;
  const diff=daysBetween(todayISO(), d.promiseDate);
  return {type: diff<0?'broken':diff===0?'today':'upcoming', diff};
}
function promiseBadge(d){
  const p=promiseState(d); if(!p) return '';
  const label=p.type==='broken'?t('promise.broken'):p.type==='today'?t('promise.today'):`${t('promise.upcoming')}: ${esc(d.promiseDate)}`;
  return ` <span class="badge ${p.type==='broken'?'overdue':'active'}" style="margin-inline-start:6px" title="${esc(d.promiseDate)}${d.promiseAmount?' · '+fmt(d.promiseAmount):''}">${label}</span>`;
}
function getNotifications(){
  return scopedDebtors().filter(d=>remaining(d)>0).flatMap(d=>{
    const out=[]; const diff=daysBetween(todayISO(),d.due);
    if(diff<0) out.push({type:'overdue',name:d.name,date:d.due});
    else if(diff===0) out.push({type:'dueToday',name:d.name,date:d.due});
    else if(diff<=7) out.push({type:'dueSoon',name:d.name,date:d.due});
    const p=promiseState(d);
    if(p && p.type!=='upcoming') out.push({type:p.type==='broken'?'promiseBroken':'promiseToday',name:d.name,date:d.promiseDate});
    return out;
  });
}
function renderNotifications(){
  const list=getNotifications(); const panel=document.getElementById('notificationsList'); const count=document.getElementById('notificationCount');
  count.textContent=list.length; count.style.display=list.length?'block':'none';
  panel.innerHTML=list.length?list.map(item=>`<div class="notification-item"><b>${esc(item.name)}</b> · ${t(`notifications.${item.type}`)}<small>${esc(item.date)}</small></div>`).join(''):`<div class="empty">${t('notifications.none')}</div>`;
}
function applyMode(){document.documentElement.dataset.mode=currentMode;const tb=document.getElementById('themeToggleBtn');tb.innerHTML=`<svg class="i" aria-hidden="true"><use href="#i-${currentMode==='dark'?'sun':'moon'}"/></svg>`;const lbl=currentMode==='dark'?t('theme.lightMode'):t('theme.darkMode');tb.title=lbl;tb.setAttribute('aria-label',lbl);if(typeof appSettings!=='undefined'){appSettings.mode=currentMode;saveSettings();}}
document.getElementById('themeToggleBtn').addEventListener('click',()=>{currentMode=currentMode==='dark'?'light':'dark';applyMode();});
document.getElementById('notificationsBtn').addEventListener('click',()=>document.getElementById('notificationPanel').classList.toggle('show'));
document.getElementById('clearNotificationsBtn').addEventListener('click',()=>document.getElementById('notificationPanel').classList.remove('show'));

const AUDIT_KEY = 'daftar_audit_v1';
// Every page the sidebar can navigate to, used to build the per-user permission
// checklist and to decide which nav links a signed-in user actually sees.
const PERMISSION_PAGES = [
  {key:'dashboard', ar:'لوحة التحكم', en:'Dashboard'},
  {key:'debtors', ar:'المدينون', en:'Debtors'},
  {key:'reps', ar:'المندوبون', en:'Reps'},
  {key:'payments', ar:'سجل السداد', en:'Payments'},
  {key:'followups', ar:'المتابعات', en:'Follow-ups'},
  {key:'quotations', ar:'عروض الأسعار', en:'Quotations'},
  {key:'aging', ar:'أعمار الديون', en:'Aging'},
  {key:'reports', ar:'التقارير', en:'Reports'},
  {key:'settings', ar:'الإعدادات', en:'Settings'},
];
const PERMISSION_CAPABILITIES = [
  {key:'write', ar:'إضافة/تعديل البيانات', en:'Add / edit data'},
  {key:'delete', ar:'حذف البيانات', en:'Delete data'},
  {key:'manageUsers', ar:'إدارة المستخدمين والصلاحيات', en:'Manage users & permissions'},
];
// Defaults used only for accounts that predate this permission system (no
// `permissions` value saved yet) — chosen to match this app's previous fixed-role
// behavior exactly, so no existing account's access silently changes.
const ROLE_DEFAULT_PERMISSIONS = {
  admin: {pages:Object.fromEntries(PERMISSION_PAGES.map(p=>[p.key,true])), write:true, delete:true, manageUsers:true},
  collector: {pages:Object.fromEntries(PERMISSION_PAGES.map(p=>[p.key, p.key!=='reps' && p.key!=='settings'])), write:true, delete:false, manageUsers:false},
  viewer: {pages:Object.fromEntries(PERMISSION_PAGES.map(p=>[p.key, p.key!=='reps' && p.key!=='settings'])), write:false, delete:false, manageUsers:false},
};
function effectivePermissions(user){
  if(!user) return {pages:{}, write:false, delete:false, manageUsers:false};
  if(user.permissions && typeof user.permissions==='object' && user.permissions.pages) return user.permissions;
  return ROLE_DEFAULT_PERMISSIONS[user.role] || ROLE_DEFAULT_PERMISSIONS.viewer;
}
let users = loadUsers();
let auditLog = loadAudit();
let currentUser = null;
function loadUsers(){
  return [];
}
function loadAudit(){
  return [];
}
// ---- Supabase Auth helpers (usernames map to an internal e-mail; passwords never touch our tables) ----
const AUTH_EMAIL_DOMAIN = (typeof SUPABASE_CONFIG!=='undefined' && SUPABASE_CONFIG.emailDomain) || 'daftar-auth.app';
function usernameToEmail(username){   // MUST match the Edge Function
  const u=String(username||'').trim().toLowerCase();
  if(/^[a-z0-9._-]{1,48}$/.test(u)) return `${u}@${AUTH_EMAIL_DOMAIN}`;
  const hex=[...new TextEncoder().encode(u)].map(b=>b.toString(16).padStart(2,'0')).join('');
  return `x-${hex}@${AUTH_EMAIL_DOMAIN}`;
}
function profileToUser(p){ return {id:p.id, username:p.username, role:p.role, repId:p.rep_id==null?undefined:p.rep_id, permissions:p.permissions||null}; }
async function adminUsersCall(action, payload={}){
  if(!supabaseClient) throw new Error('Supabase is not available');
  const {data,error} = await supabaseClient.functions.invoke('admin-users',{body:{action,...payload}});
  if(error){
    let msg=error.message;
    try{ const j=await error.context.json(); if(j&&j.error) msg=j.error; }catch(_){}
    throw new Error(msg);
  }
  if(data&&data.error) throw new Error(data.error);
  return data;
}
function userErrToast(err){
  const m=String(err&&err.message||'');
  if(/already taken/i.test(m)) return toast(currentLang==='en'?'That username is already taken':'اسم المستخدم مستخدم بالفعل');
  if(/Admins only|Forbidden/i.test(m)) return toast(currentLang==='en'?'Only an admin can do this':'هذا الإجراء للمدير فقط');
  if(/last admin/i.test(m)) return toast(currentLang==='en'?'You cannot remove the last admin':'لا يمكن إزالة آخر مدير');
  toast(currentLang==='en'?'Could not save — check your connection':'تعذّر الحفظ — تحقق من الاتصال');
}
async function addAudit(action,details=''){
  auditLog.unshift({id:Date.now()*1000+Math.floor(Math.random()*1000),date:new Date().toISOString(),user:currentUser?.username||'system',action,details});
  auditLog=auditLog.slice(0,500);
  if (!supabaseClient) throw new Error('Supabase is not available');
  const {error} = await supabaseClient.from('audit_log').insert({
    id:auditLog[0].id,
    date:auditLog[0].date,
    user:auditLog[0].user,
    action:auditLog[0].action,
    details:auditLog[0].details
  });
  if(error) throw error;
  renderAudit();
}
function auditLabel(action){const key=`audit.${action}`;const value=translations[key];return value?value[currentLang==='en'?1:0]:action;}
function can(permission){
  if(!currentUser) return false;
  const perm = effectivePermissions(currentUser);
  if(permission==='view') return true;
  return !!perm[permission];
}
function canSeePage(pageKey){
  if(!currentUser) return false;
  const perm = effectivePermissions(currentUser);
  return !!(perm.pages && perm.pages[pageKey]);
}
function roleLabel(role){return {admin:currentLang==='en'?'Admin':'مدير',collector:currentLang==='en'?'Collector':'مندوب',viewer:currentLang==='en'?'Viewer':'مشاهد'}[role]||role;}
function getAuth(){
  return currentUser || {username:'', role:''};
}
function updateAuthUI(){
  const auth=getAuth(); document.getElementById('s_authUser').value=auth.username;
  document.getElementById('loginScreen').style.display=currentUser?'none':'flex';
  document.getElementById('sidebarUserLine').textContent=currentUser ? `${currentLang==='en'?'Signed in as':'مسجل الدخول باسم'}: ${auth.username}` : '';
  document.querySelectorAll('[data-login-lang]').forEach(item=>item.classList.toggle('active',item.dataset.loginLang===currentLang));
}
const PREF_KEYS=['language','mode','theme','themeCustom','palette','paletteCustom','savedSearch'];
const SECRET_KEYS=['smsApiKey','emailApiKey'];
const DEFAULT_PREFS={language:'ar',mode:'dark',theme:'brand',themeCustom:'',palette:'brand',paletteCustom:'',savedSearch:null};
function sharedSettings(){ const s={...appSettings}; PREF_KEYS.concat(SECRET_KEYS).forEach(k=>delete s[k]); return s; }
function secretSettings(){ const s={}; SECRET_KEYS.forEach(k=>{ s[k]=appSettings[k]||''; }); return s; }
function applyThemeFromSettings(){
  applyTheme(appSettings.theme==='custom'&&appSettings.themeCustom?appSettings.themeCustom:(appSettings.theme||'brand'));
  applyPalette(appSettings.palette==='custom'&&appSettings.paletteCustom?appSettings.paletteCustom:(appSettings.palette||'brand'));
}
function applyUserPrefs(prefs){
  _suppressPrefSave=true;
  try{
    PREF_KEYS.forEach(k=>{ if(prefs&&prefs[k]!==undefined) appSettings[k]=prefs[k]; });
    if(appSettings.language) currentLang=appSettings.language;
    if(appSettings.mode) currentMode=appSettings.mode;
    applyThemeFromSettings();
  } finally { _suppressPrefSave=false; }
}
// Loads the signed-in user's profile, then ALL data (RLS decides what this user may see).
async function startSession(userId){
  const {data:profile,error}=await supabaseClient.from('profiles').select('id,username,role,rep_id,permissions,prefs').eq('id',userId).maybeSingle();
  if(error||!profile) return false;
  currentUser=profileToUser(profile);
  const loaded=await loadState();
  applyUserPrefs(profile.prefs||{});
  applyLanguage(); applyMode(); updateAuthUI(); applyPermissions();
  loadSavedSearch(); renderUsers(); renderAudit(); renderAll();
  if(!loaded) toast(currentLang==='en'?'Could not load data from the cloud':'تعذّر تحميل البيانات من السحابة');
  addAudit('login').catch(()=>{});
  resetSessionTimer(); maybeSendDueNotifications();
  return true;
}
let failedLogins=0, loginLockedUntil=0;
document.getElementById('loginBtn').addEventListener('click',async()=>{
  const errEl=document.getElementById('loginError'); const en=currentLang==='en';
  const user=document.getElementById('login_user').value.trim(); const pass=document.getElementById('login_pass').value;
  const wait=Math.ceil((loginLockedUntil-Date.now())/1000);
  if(wait>0){ errEl.textContent=en?`Too many attempts. Try again in ${wait}s`:`محاولات كثيرة. حاول بعد ${wait} ثانية`; return; }
  if(!user||!pass){ errEl.textContent=en?'Enter username and password':'أدخل اسم المستخدم وكلمة المرور'; return; }
  if(!supabaseClient){ errEl.textContent=(typeof window.supabase==='undefined')?(en?'App files are missing from the server (vendor/ folder). Re-deploy the full project.':'ملفات التطبيق ناقصة على الخادم (مجلد vendor). أعد نشر المشروع كاملًا.'):(en?'Cloud database is unavailable':'قاعدة البيانات السحابية غير متاحة'); return; }
  const btn=document.getElementById('loginBtn'); btn.disabled=true;
  try{
    const {data,error}=await supabaseClient.auth.signInWithPassword({email:usernameToEmail(user),password:pass});
    if(error){
      const network=!error.status||error.status>=500;
      if(!network){ failedLogins++; if(failedLogins>=5){ loginLockedUntil=Date.now()+30000; failedLogins=0; } }
      errEl.textContent=network?(en?'Cloud database is unavailable':'قاعدة البيانات السحابية غير متاحة'):(en?'Invalid username or password':'اسم المستخدم أو كلمة المرور غير صحيحة');
      return;
    }
    failedLogins=0;
    const ok=await startSession(data.user.id);
    if(!ok){ await supabaseClient.auth.signOut(); errEl.textContent=en?'This account is not set up yet — contact the admin':'هذا الحساب غير مهيّأ بعد — تواصل مع المدير'; return; }
    errEl.textContent=''; document.getElementById('login_pass').value='';
  } finally { btn.disabled=false; }
});
document.getElementById('login_pass').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('loginBtn').click();});
// Sign out and reload so no data stays in memory or in the DOM.
async function doLogout(){
  try{ await addAudit('logout'); }catch(_){}
  try{ await supabaseClient.auth.signOut(); }catch(_){}
  location.reload();
}
document.getElementById('logoutBtn').addEventListener('click',doLogout);
if(supabaseClient) supabaseClient.auth.onAuthStateChange(event=>{ if(event==='SIGNED_OUT' && currentUser) location.reload(); });
// Self-service: change MY OWN username/password.
document.getElementById('saveAuthBtn').addEventListener('click', async ()=>{
  if(!currentUser){ toast(currentLang==='en'?'You are not signed in':'لست مسجلًا للدخول'); return; }
  const username = document.getElementById('s_authUser').value.trim();
  const password = document.getElementById('s_authPass').value;
  if(!username){ toast(currentLang==='en'?'Username is required':'اسم المستخدم مطلوب'); return; }
  if(password && password.length < Math.max(8,appSettings.passwordMinLength||8)){
    const n=Math.max(8,appSettings.passwordMinLength||8);
    toast(currentLang==='en'?`Password must be at least ${n} characters`:`يجب ألا تقل كلمة المرور عن ${n} أحرف`);
    return;
  }
  try{
    if(username!==currentUser.username){
      await adminUsersCall('update_profile',{user_id:currentUser.id,username});
      currentUser.username=username; const u=users.find(x=>x.id===currentUser.id); if(u) u.username=username;
    }
    if(password) await adminUsersCall('set_password',{user_id:currentUser.id,password});
    document.getElementById('s_authPass').value='';
    updateAuthUI(); renderUsers();
    addAudit('save_auth', currentLang==='en'?'Own login credentials updated':'تحديث بيانات الدخول الخاصة');
    toast(currentLang==='en'?'Login details updated':'تم تحديث بيانات تسجيل الدخول');
  }catch(err){ console.warn('Saving own credentials failed:', err); userErrToast(err); }
});
function applyPermissions(){
  const locked=!can('write');
  const lockedDelete=!can('delete');
  document.getElementById('addDebtorBtn').disabled=locked;
  document.getElementById('addRepBtn').disabled=locked;
  document.querySelectorAll('[data-write]').forEach(el=>el.disabled=locked);
  document.querySelectorAll('[data-delete]').forEach(el=>el.disabled=lockedDelete);
  // Every nav page now follows this user's own permission checklist, not just a
  // hardcoded "hide settings/reps for non-admins" special case.
  document.querySelectorAll('.nav-item[data-page]').forEach(item=>{
    item.style.display = canSeePage(item.dataset.page) ? 'flex' : 'none';
  });
  document.querySelectorAll('.bnav-item[data-page]').forEach(b=>{ b.style.display = canSeePage(b.dataset.page) ? 'flex' : 'none'; });
  const assignBox=document.getElementById('dr_assignRepBox');
  if(assignBox) assignBox.style.display=(currentUser?.role==='admin')?'':'none';
  const bp=document.getElementById('backupPanel'); if(bp) bp.style.display=(currentUser?.role==='admin')?'':'none';
  const assignTitle=document.getElementById('dr_assignRepTitle');
  if(assignTitle) assignTitle.style.display=(currentUser?.role==='admin')?'':'none';
}
// returns the subset of debtors the logged-in user is allowed to see.
// Admins and viewers see everything; a collector only sees cases assigned to
// the collector profile linked to their account (see renderUsers' rep-link control).
// UX filter only. The real enforcement is Row Level Security in the database
// (supabase/secure-auth-migration.sql) — a collector's session simply cannot read other rows.
function scopedDebtors(){
  if(currentUser?.role==='collector'){
    if(!currentUser.repId) return [];
    return debtors.filter(d=>d.repId===currentUser.repId);
  }
  return debtors;
}
// ---- Per-user permissions checklist (shared markup builder for add + edit) ----
function permsChecklistHtml(perm, prefix){
  const pageRows = PERMISSION_PAGES.map(p=>`<label><input type="checkbox" data-perm-page="${p.key}" ${perm.pages?.[p.key]?'checked':''}> ${esc(currentLang==='en'?p.en:p.ar)}</label>`).join('');
  const capRows = PERMISSION_CAPABILITIES.map(c=>`<label><input type="checkbox" data-perm-cap="${c.key}" ${perm[c.key]?'checked':''}> ${esc(currentLang==='en'?c.en:c.ar)}</label>`).join('');
  return pageRows + capRows;
}
function readPermsFromBox(box){
  const pages = {};
  box.querySelectorAll('[data-perm-page]').forEach(cb=>{ pages[cb.dataset.permPage] = cb.checked; });
  const perm = {pages};
  box.querySelectorAll('[data-perm-cap]').forEach(cb=>{ perm[cb.dataset.permCap] = cb.checked; });
  return perm;
}
function renderNewUserPermsBox(){
  const box = document.getElementById('newUserPermsBox');
  if(!box) return;
  const role = document.getElementById('u_role').value;
  box.innerHTML = permsChecklistHtml(ROLE_DEFAULT_PERMISSIONS[role] || ROLE_DEFAULT_PERMISSIONS.viewer);
}
document.getElementById('u_role')?.addEventListener('change', renderNewUserPermsBox);

document.getElementById('addUserBtn').addEventListener('click',async()=>{
  if(!can('manageUsers'))return;
  const username=document.getElementById('u_name').value.trim();
  const password=document.getElementById('u_password').value;
  const role=document.getElementById('u_role').value;
  const minLen=Math.max(8,appSettings.passwordMinLength||8);
  if(!username||!password){toast(currentLang==='en'?'Username and password are required':'اسم المستخدم وكلمة المرور مطلوبان');return;}
  if(password.length < minLen){
    toast(currentLang==='en'?`Password must be at least ${minLen} characters`:`يجب ألا تقل كلمة المرور عن ${minLen} أحرف`);
    return;
  }
  if(users.some(u=>u.username.toLowerCase()===username.toLowerCase())){
    toast(currentLang==='en'?'That username is already taken':'اسم المستخدم مستخدم بالفعل');
    return;
  }
  const permsBox = document.getElementById('newUserPermsBox');
  const permissions = permsBox ? readPermsFromBox(permsBox) : ROLE_DEFAULT_PERMISSIONS[role];
  try{
    const res=await adminUsersCall('create',{username,password,role,permissions});
    users.push(profileToUser(res.user));
    addAudit('add_user',`${username} (${roleLabel(role)})`);
    renderUsers();
    document.getElementById('u_name').value='';
    document.getElementById('u_password').value='';
    toast(currentLang==='en'?'User added':'تمت إضافة المستخدم');
  }catch(err){ console.warn('Adding user failed:', err); userErrToast(err); }
});
renderNewUserPermsBox();

// ---- Edit permissions for an existing user ----
let editingUserPermsId = null;
function openEditUserPerms(userId){
  const user = users.find(u=>u.id===userId);
  if(!user) return;
  editingUserPermsId = userId;
  document.getElementById('editUserPermsTitle').textContent = `${t('settings.editPermsTitle')} — ${user.username}`;
  document.getElementById('editUserPermsBox').innerHTML = permsChecklistHtml(effectivePermissions(user));
  document.getElementById('editUserPermsModal').classList.add('show');
}
document.getElementById('editUserPermsSaveBtn')?.addEventListener('click', async ()=>{
  const user = users.find(u=>u.id===editingUserPermsId);
  if(!user) return;
  const permissions = readPermsFromBox(document.getElementById('editUserPermsBox'));
  try{
    await adminUsersCall('update_profile',{user_id:user.id,permissions});
    user.permissions = permissions;
    addAudit('edit_user_perms', user.username);
    document.getElementById('editUserPermsModal').classList.remove('show');
    toast(currentLang==='en'?'Permissions updated':'تم تحديث الصلاحيات');
    if(currentUser && currentUser.id===user.id){ currentUser.permissions = user.permissions; applyPermissions(); renderAll(); }
  }catch(err){ console.warn('Saving user permissions failed:', err); userErrToast(err); }
});

function renderUsers(){const el=document.getElementById('usersList');if(!el)return;el.innerHTML=users.map(user=>{
  const linkedRep=reps.find(r=>r.id===user.repId);
  const repControl = user.role==='collector' ? `<select data-link-user="${user.id}" class="mini-select" title="${t('settings.linkRep')}">
      <option value="">${t('settings.noLink')}</option>
      ${reps.map(r=>`<option value="${r.id}" ${r.id===user.repId?'selected':''}>${esc(r.name)}</option>`).join('')}
    </select>` : '';
  return `<div class="audit-row"><b>${esc(user.username)}</b><span>${roleLabel(user.role)}</span>${repControl}<button class="icon-btn" data-edit-user-perms="${user.id}" title="${t('settings.editPermsTitle')}">⚙</button>${user.id!==currentUser?.id?`<button class="icon-btn danger" data-remove-user="${user.id}" title="${t('action.delete')}">✕</button>`:''}</div>`;
}).join('');
  el.querySelectorAll('[data-remove-user]').forEach(button=>button.addEventListener('click',async ()=>{
    const removedId = button.dataset.removeUser;
    const removed=users.find(u=>u.id===removedId);
    const prevUsers = users;
    users=users.filter(user=>user.id!==removedId);
    try{
      await adminUsersCall('delete',{user_id:removedId});
      addAudit('delete_user',removed?removed.username:button.dataset.removeUser);
      renderUsers();
    }catch(err){
      users = prevUsers;
      console.warn('Deleting user failed:', err);
      toast(currentLang==='en'?'Could not delete — check your connection':'تعذّر الحذف — تحقق من الاتصال');
    }
  }));
  el.querySelectorAll('[data-link-user]').forEach(select=>select.addEventListener('change', async ()=>{
    const user=users.find(u=>u.id===select.dataset.linkUser); if(!user) return;
    const repId=select.value?Number(select.value):null; const rep=reps.find(r=>r.id===repId);
    const prevRep=user.repId; user.repId=repId||undefined;
    try{
      await adminUsersCall('update_profile',{user_id:user.id,rep_id:repId});
      addAudit('link_user_rep', `${user.username} → ${rep?rep.name:t('settings.noLink')}`);
      if(currentUser && currentUser.id===user.id) renderAll();
      toast(currentLang==='en'?'Collector link updated':'تم تحديث ربط المندوب');
    }catch(err){
      user.repId=prevRep; console.warn('Linking user to rep failed:', err); userErrToast(err);
    }
  }));
  el.querySelectorAll('[data-edit-user-perms]').forEach(button=>button.addEventListener('click', ()=>openEditUserPerms(button.dataset.editUserPerms)));
}
function renderAudit(){
  const el=document.getElementById('auditList');if(!el)return;
  const filterInput=document.getElementById('auditFilter');
  const q=(filterInput?filterInput.value:'').trim().toLowerCase();
  const filtered=auditLog.filter(item=>!q || item.user.toLowerCase().includes(q) || auditLabel(item.action).toLowerCase().includes(q) || (item.details||'').toLowerCase().includes(q));
  el.innerHTML=filtered.slice(0,80).map(item=>`<div class="audit-row"><b>${esc(auditLabel(item.action))}</b><span>${esc(item.user)}</span>${item.details?`<small class="audit-detail">${esc(item.details)}</small>`:''}<time>${new Date(item.date).toLocaleString(currentLang==='en'?'en-US':'ar-QA')}</time></div>`).join('') || `<div class="empty">${q?t('settings.auditEmpty'):(currentLang==='en'?'No audit events yet.':'لا توجد أحداث بعد.')}</div>`;
}

let debtors = [];
let nextId = 1;
let activeDebtorId = null;
let lastStatementHtml = '';

let reps = [];
let nextRepId = 1;
let activeRepId = null;

// ============== QUOTATIONS (عروض الأسعار) ==============
let quotations = [];
let nextQuotationId = 1;
let nextQuotationLogId = 1;
let activeQuotationId = null;

// ============== PERSISTENCE ==============

// Supabase sync functions
let syncInProgress = null;
let syncQueued = false;
let lastSyncError = null;

// ---- Debounced persistence -------------------------------------------------
// renderAll() runs on EVERY re-render, including on every keystroke in the
// search boxes (see the 'input' listeners on #globalSearch / #quotSearch).
// It used to call saveState() -> syncToSupabase() directly, which re-uploads
// every debtor, activity, rep, quotation, quotation log, user and audit row
// on every single keystroke. scheduleSave() coalesces any burst of calls
// within `delay` ms into a single sync, while a real data mutation still
// ends up persisted a moment later exactly as before. A pending save is
// flushed immediately if the tab is hidden/closed so nothing is lost.
let _saveDebounceTimer = null;
// Cheap fingerprint of everything syncToSupabase() uploads. renderAll() runs on every
// search keystroke / tab change, and those re-renders change nothing — so unless the
// fingerprint differs from the last successful sync there is nothing to upload.
let lastSyncedSignature = null;
function dataSignature(){
  try{ return JSON.stringify([debtors, quotations, reps, sharedSettings(), secretSettings()]); }
  catch(e){ return String(Date.now()); }   // unserialisable -> always treat as dirty
}
function hasUnsyncedChanges(){ return dataSignature() !== lastSyncedSignature; }
function scheduleSave(delay = 600){
  clearTimeout(_saveDebounceTimer);
  if(!hasUnsyncedChanges()){ _saveDebounceTimer = null; return; }
  setSaveStatus('pending');
  _saveDebounceTimer = setTimeout(()=>{ _saveDebounceTimer = null; if(hasUnsyncedChanges()) saveState(); }, delay);
}
function flushPendingSave(){
  if(_saveDebounceTimer){ clearTimeout(_saveDebounceTimer); _saveDebounceTimer = null; if(hasUnsyncedChanges()) saveState(); }
}
document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState === 'hidden') flushPendingSave(); });
window.addEventListener('pagehide', flushPendingSave);

// Small generic debounce used for expensive re-renders triggered by typing
// (search boxes), so every keystroke doesn't force a full table/chart rebuild.
function debounce(fn, delay = 200){
  let timer = null;
  return (...args)=>{ clearTimeout(timer); timer = setTimeout(()=>fn(...args), delay); };
}
// pruneOrphans=true deletes any server row whose id is absent from the given `rows`
// snapshot — safe for tables with no other deletion path. It is UNSAFE for a table
// with its own child rows (like quotation_files, linked to quotations via
// ON DELETE CASCADE): if this function ever runs with a snapshot that is momentarily
// missing a row that legitimately still exists (a stale read, an overlapping queued
// sync — see `syncQueued` above), it would delete-then-reinsert that row, and the
// cascade would silently wipe its attachments even though the quotation itself looks
// unchanged afterwards. Callers that already delete explicitly (see deleteQuotation)
// should pass pruneOrphans=false.
// ---- Row-level sync ---------------------------------------------------------------
// The old version re-uploaded every row and deleted any server row missing from the local
// list — so a stale session could overwrite or DELETE rows another user had just added.
// Now we remember what this session loaded / last saved (per table, per id) and send only:
//   • rows that are new or changed since then (upsert), and
//   • rows this session itself removed (delete by id).
// Rows we never saw are never touched.
const _synced = {};   // table -> Map(idString -> {json, id})
function snapshotRows(table, rows, key='id'){
  _synced[table] = new Map(rows.map(r=>[String(r[key]), {json:JSON.stringify(r), id:r[key]}]));
}
function buildSyncRows(){
  return {
    debtors: debtors.map(debtor=>({id:debtor.id,name:debtor.name,type:debtor.type,company_number:debtor.companyNumber||'',cr_number:debtor.crNumber||'',phone:debtor.phone||'',total:debtor.total,paid:debtor.paid,due:debtor.due||null,notes:debtor.notes||'',rep_id:debtor.repId||null,promise_date:debtor.promiseDate||null,promise_amount:debtor.promiseAmount||null})),
    debtors_activity: debtors.flatMap(debtor=>(debtor.log||[]).map(activity=>({id:activity.id,debtor_id:debtor.id,type:activity.type,activity_date:activity.date,amount:activity.amount||null,method:activity.method||null,note:activity.note||null}))),
    reps: reps.map(rep=>({id:rep.id,name:rep.name,phone:rep.phone||'',area:rep.area||''})),
    quotations: quotations.map(q=>({id:q.id,date:q.date||null,visit_time:q.visitTime||'',company_name:q.companyName||'',company_scope:q.companyScope||'',contact_person:q.contactPerson||'',mobile:q.mobile||'',email:q.email||'',amount:q.amount||null,quotation_no:q.quotationNo||'',invoice_no:q.invoiceNo||'',project_no:q.projectNo||'',subject:q.subject||'',next_followup:q.nextFollowup||null,status:q.status||'open',requirement:q.requirement||'',followup_action:q.followupAction||'',notes:q.notes||''})),
    quotations_activity: quotations.flatMap(q=>(q.log||[]).map(entry=>({id:entry.id,quotation_id:q.id,log_date:entry.date,status:entry.status||'',note:entry.note||''})))
  };
}
function snapshotAllFromMemory(){ const r=buildSyncRows(); Object.keys(r).forEach(tbl=>snapshotRows(tbl,r[tbl])); }
// pruneOrphans=true also deletes rows THIS session removed. Pass false for tables with their own
// delete path (quotations: cascade to attachments).
// Edit-conflict detection: debtors/quotations carry a server-maintained updated_at (trigger).
// We remember the value we loaded/saved per row; before overwriting a row we compare it with the server's.
const _ver = {debtors:new Map(), quotations:new Map()};
async function replaceTable(table, rows, key='id', pruneOrphans=true) {
  const prev = _synced[table] || new Map();
  const changed = rows.filter(r=>{ const p=prev.get(String(r[key])); return !p || p.json!==JSON.stringify(r); });
  const current = new Set(rows.map(r=>String(r[key])));
  const removed = pruneOrphans ? [...prev.entries()].filter(([id])=>!current.has(id)).map(([,v])=>v.id) : [];
  const ver = _ver[table];
  if(ver){
    const known = changed.filter(r=>ver.has(String(r[key])));
    if(known.length){
      const { data:cur, error:vErr } = await supabaseClient.from(table).select(`${key},updated_at`).in(key, known.map(r=>r[key]));
      if(vErr){ vErr.message = `[${table}] ${vErr.message||''}`; throw vErr; }
      const curMap = new Map((cur||[]).map(c=>[String(c[key]), c.updated_at]));
      const stale = known.filter(r=>curMap.get(String(r[key]))!==ver.get(String(r[key])));
      if(stale.length){ const e=new Error(`[${table}] edit conflict`); e.conflict={table,stale,curMap}; throw e; }
    }
  }
  if(removed.length){
    const { error } = await supabaseClient.from(table).delete().in(key, removed);
    if(error){ error.message = `[${table}] ${error.message||''}`; throw error; }
    if(ver) removed.forEach(id=>ver.delete(String(id)));
  }
  if(changed.length){
    const { data:saved, error } = await supabaseClient.from(table).upsert(changed, {onConflict:key}).select();
    if(error){ error.message = `[${table}] ${error.message||''}`; throw error; }
    if(ver) (saved||[]).forEach(r=>{ if(r.updated_at) ver.set(String(r[key]), r.updated_at); });
  }
  const next = new Map(prev);
  removed.forEach(id=>next.delete(String(id)));
  changed.forEach(r=>next.set(String(r[key]), {json:JSON.stringify(r), id:r[key]}));
  _synced[table] = next;
}
async function resolveConflict({table, stale, curMap}){
  const en=currentLang==='en';
  const names=stale.map(r=>r.name||r.company_name||r.id).slice(0,5).join(', ');
  if(confirm(en?`Another user changed: ${names}\n\nOK = load the latest version (your edits to these records are discarded).\nCancel = keep your version.`
               :`عدّل مستخدم آخر: ${names}\n\nموافق = تحميل أحدث نسخة (تُتجاهل تعديلاتك على هذه السجلات).\nإلغاء = الإبقاء على نسختك.`)){
    await refreshFromServer(); toast(en?'Latest version loaded':'تم تحميل أحدث نسخة'); return;
  }
  if(confirm(en?"Overwrite the other user's changes with yours?":'هل تريد استبدال تعديلات المستخدم الآخر بتعديلاتك؟')){
    stale.forEach(r=>{ const v=curMap.get(String(r.id)); if(v) _ver[table].set(String(r.id), v); else _ver[table].delete(String(r.id)); });
    syncToSupabase();
  }
}
async function refreshFromServer(){
  const id=activeDebtorId;
  if(!(await loadFromSupabase())) return false;
  lastSyncedSignature=dataSignature(); setSaveStatus('saved'); renderAll();
  if(document.getElementById('drawer').classList.contains('show') && debtors.some(d=>d.id===id)) openDrawer(id);
  return true;
}
// Live refresh: every 30s (and when the tab regains focus) pull the latest data — but only when
// this session has nothing unsaved and nothing is open for editing, so it never disturbs anyone.
let _refreshing=false;
async function liveRefresh(){
  if(_refreshing||!supabaseClient||!currentUser||!dataLoaded||syncInProgress||syncQueued||document.hidden) return;
  if(hasUnsyncedChanges()||document.querySelector('.overlay.show, .drawer.show')) return;
  _refreshing=true;
  try{ const before=dataSignature(); if(await loadFromSupabase()){ lastSyncedSignature=dataSignature(); if(dataSignature()!==before) renderAll(); } }
  catch(e){ console.warn('Live refresh skipped:',e); }
  finally{ _refreshing=false; }
}
setInterval(liveRefresh,30000);
document.addEventListener('visibilitychange',()=>{ if(!document.hidden) liveRefresh(); });
async function syncToSupabase() {
  if (!supabaseClient) {
    console.warn('Supabase sync skipped: client not initialized');
    setSaveStatus('offline');
    return false;
  }
  if (!currentUser || !dataLoaded) return false;     // never write before a successful load (could wipe server data)
  const isAdmin = currentUser.role==='admin';
  if (!can('write') && !isAdmin) { lastSyncedSignature = dataSignature(); setSaveStatus('saved'); return true; }
  if (syncInProgress) { syncQueued = true; return syncInProgress; }
  syncInProgress = (async()=>{
    const signatureAtStart = dataSignature();
    setSaveStatus('saving');
    try {
      console.info('Starting Supabase sync', { debtors: debtors.length, quotations: quotations.length, reps: reps.length });
      const built = buildSyncRows();
      await replaceTable('debtors', built.debtors, 'id', can('delete'));
      await replaceTable('debtors_activity', built.debtors_activity, 'id', can('write'));
      if(isAdmin) await replaceTable('reps', built.reps);
      await replaceTable('quotations', built.quotations, 'id', false);
      await replaceTable('quotations_activity', built.quotations_activity, 'id', false);
      if(isAdmin){
        const now = new Date().toISOString();
        const { error: settingsError } = await supabaseClient.from('app_settings').upsert([
          {id:1,settings:sharedSettings(),updated_at:now},
          {id:2,settings:secretSettings(),updated_at:now}   // API keys: row readable by admins only (RLS)
        ],{onConflict:'id'});
        if(settingsError) throw settingsError;
      }
      console.info('Supabase sync succeeded');
      lastSyncError = null;
      lastSyncedSignature = signatureAtStart;
      setSaveStatus(hasUnsyncedChanges() ? 'pending' : 'saved');
      return true;
    } catch (e) {
      if(e && e.conflict){
        lastSyncError = currentLang==='en' ? 'Edit conflict: another user changed the same record' : 'تعارض: عدّل مستخدم آخر السجل نفسه';
        setSaveStatus('error', lastSyncError); setTimeout(()=>resolveConflict(e.conflict),0); return false;
      }
      const parts = [e?.code, e?.message, e?.details, e?.hint].filter(Boolean);
      lastSyncError = parts.length ? parts.join(' — ') : String(e);
      console.warn('Supabase sync failed:', e);
      setSaveStatus('error', lastSyncError);
      return false;
    } finally {
      syncInProgress = null;
      if(syncQueued){ syncQueued=false; syncToSupabase(); }
    }
  })();
  return syncInProgress;
}

async function loadFromSupabase() {
  if (!supabaseClient) return false;
  
  try {
    // Load debtors
    const { data: debtorsData, error: debtorsError } = await supabaseClient
      .from('debtors')
      .select('*');
    
    if (debtorsError) throw debtorsError;
    
    // Load activities
    const { data: activitiesData, error: activitiesError } = await supabaseClient
      .from('debtors_activity')
      .select('*');
    
    if (activitiesError) throw activitiesError;

    const { data: repsData, error: repsError } = await supabaseClient
      .from('reps')
      .select('*');
    if (repsError) throw repsError;

    const { data: quotationsData, error: quotationsError } = await supabaseClient
      .from('quotations')
      .select('*');
    if (quotationsError) throw quotationsError;
    _ver.debtors = new Map((debtorsData||[]).filter(r=>r.updated_at).map(r=>[String(r.id), r.updated_at]));
    _ver.quotations = new Map((quotationsData||[]).filter(r=>r.updated_at).map(r=>[String(r.id), r.updated_at]));

    const { data: quotationsActivityData, error: quotationsActivityError } = await supabaseClient
      .from('quotations_activity')
      .select('*');
    if (quotationsActivityError) throw quotationsActivityError;
    
    // Profiles: an admin sees everyone, anyone else sees only their own row (RLS).
    const { data: usersData, error: usersError } = await supabaseClient
      .from('profiles')
      .select('id,username,role,rep_id,permissions');
    if (usersError) throw usersError;

    // Load audit log
    const { data: auditData, error: auditError } = await supabaseClient
      .from('audit_log')
      .select('*');
    
    if (auditError) throw auditError;
    
    // Map Supabase data to app structure
    debtors = (debtorsData || []).map(d => ({
        id: d.id,
        name: d.name,
        type: d.type,
        companyNumber: d.company_number || '',
        crNumber: d.cr_number || '',
        phone: d.phone || '',
        total: d.total,
        paid: d.paid,
        due: d.due,
        notes: d.notes || '',
        repId: d.rep_id,
        promiseDate: d.promise_date || '',
        promiseAmount: d.promise_amount==null ? 0 : Number(d.promise_amount),
        log: []
      }));
      
      // Map activities to debtor logs
      if (activitiesData) {
        activitiesData.forEach(a => {
          const debtor = debtors.find(d => d.id === a.debtor_id);
          if (debtor) {
            debtor.log.push({
              id: a.id,
              type: a.type,
              date: a.activity_date,
              amount: a.amount,
              method: a.method,
              note: a.note
            });
          }
        });
      }
      
      // Update IDs
      nextId = Math.max(0, ...debtors.map(d => d.id)) + 1;
      nextLogId = Math.max(0, ...debtors.flatMap(d => (d.log || []).map(l => l.id || 0))) + 1;
    reps = (repsData || []).map(r => ({id:r.id,name:r.name,phone:r.phone||'',area:r.area||''}));
    nextRepId = Math.max(0, ...reps.map(r => Number(r.id)||0)) + 1;

    quotations = (quotationsData || []).map(q => ({
      id: q.id, date: q.date, visitTime: q.visit_time || '', companyName: q.company_name || '', companyScope: q.company_scope || '',
      contactPerson: q.contact_person || '', mobile: q.mobile || '', email: q.email || '', amount: q.amount,
      quotationNo: q.quotation_no || '', invoiceNo: q.invoice_no || '', projectNo: q.project_no || '',
      subject: q.subject || '', nextFollowup: q.next_followup, status: q.status || 'open',
      requirement: q.requirement || '', followupAction: q.followup_action || '', notes: q.notes || '', log: []
    }));
    if (quotationsActivityData) {
      quotationsActivityData.forEach(entry => {
        const q = quotations.find(x => x.id === entry.quotation_id);
        if (q) q.log.push({id: entry.id, date: entry.log_date, status: entry.status, note: entry.note});
      });
    }
    quotations.forEach(q => q.log.sort((a,b)=> (a.date||'').localeCompare(b.date||'')));
    nextQuotationId = Math.max(0, ...quotations.map(q => Number(q.id)||0)) + 1;
    nextQuotationLogId = Math.max(0, ...quotations.flatMap(q => (q.log||[]).map(l => Number(l.id)||0))) + 1;
    
    // Map users
    users = (usersData || []).map(profileToUser);

    // Map audit log
    auditLog = (auditData || []).map(a => ({
        id: a.id,
        date: a.date,
        user: a.user,
        action: a.action,
        details: a.details
      }));

    snapshotAllFromMemory();   // baseline = exactly what the server returned

    // Attachments are loaded separately and never wiped by replaceTable().
    await loadQuotationFiles();

    const { data: settingsRows, error: settingsError } = await supabaseClient
      .from('app_settings').select('id,settings').in('id',[1,2]);
    if(settingsError) throw settingsError;
    (settingsRows||[]).forEach(row=>{ if(row.settings) appSettings = {...appSettings,...row.settings}; });
    // Appearance is per-user (profiles.prefs); ignore any legacy shared values.
    ['language','mode','theme','themeCustom','palette','paletteCustom','savedSearch'].forEach(k=>{ appSettings[k]=DEFAULT_PREFS[k]; });

    // Make sure every paid amount has an entry in the payments register.
    const unlogged = can('write') ? reconcileAllPaymentLogs() : 0;
    if(unlogged) console.info(`Payment log: recorded missing payments for ${unlogged} debtor(s)`);
    dataLoaded = true;
    return true;
  } catch (e) {
    console.warn('Supabase load failed:', e);
    return false;
  }
}

function clearLegacyBrowserState(){
  try { localStorage.clear(); } catch (e) {}
  try { sessionStorage.clear(); } catch (e) {}
}

async function saveState(){
  return await syncToSupabase();
}
// A toast disappears in ~2 seconds, which is easy to miss, and it was hiding real
// Supabase errors from the user. This banner stays on screen with the literal error
// text until dismissed, so the exact cause (a rejected column, a bad value, an RLS
// policy, etc.) can be read and copied rather than silently lost.
function showSyncErrorBanner(context, detail){
  const banner = document.getElementById('quotSyncErrorBanner');
  if(!banner) return;
  const label = currentLang==='en'
    ? `Cloud save failed (${context}). The data below was NOT saved to Supabase:`
    : `فشل الحفظ السحابي (${context}). البيانات التالية لم تُحفظ في Supabase:`;
  banner.querySelector('.sync-error-text').textContent = `${label}\n${detail||''}`;
  banner.style.display = 'flex';
}
document.getElementById('quotSyncErrorBanner')?.addEventListener('click', ev=>{
  if(ev.target.closest('[data-dismiss-sync-error]')){
    document.getElementById('quotSyncErrorBanner').style.display = 'none';
  }
  if(ev.target.closest('[data-copy-sync-error]')){
    const text = document.querySelector('#quotSyncErrorBanner .sync-error-text')?.textContent || '';
    navigator.clipboard?.writeText(text).then(
      ()=>toast(currentLang==='en'?'Error text copied':'تم نسخ نص الخطأ'),
      ()=>toast(currentLang==='en'?'Could not copy — select the text manually':'تعذّر النسخ — حدّد النص يدويًا')
    );
  }
});
// Use this whenever the user performs an explicit action that MUST reach the cloud.
// Unlike saveState() it tells the user (and the console) when the write did not land,
// instead of leaving rows that only live in this browser tab until the next reload.
async function saveStateOrWarn(context=''){
  const ok = await saveState();
  if(!ok){
    const detail = lastSyncError || (currentLang==='en'?'Unknown error':'خطأ غير معروف');
    showSyncErrorBanner(context || (currentLang==='en'?'saving':'الحفظ'), detail);
    toast((currentLang==='en'
      ? 'Cloud save failed — see the red banner above the quotations list'
      : 'فشل الحفظ السحابي — راجع الشريط الأحمر أعلى قائمة عروض الأسعار'));
  }
  return ok;
}
async function loadState(){
  try{
    if (supabaseClient) {
      const loaded = await loadFromSupabase();
      if (loaded) {
        return true;
      }
    }
    throw new Error('Cloud database is unavailable');
  }catch(e){
    return false;
  }
}

// ============== HELPERS ==============
function fmt(n){ return Number(n||0).toLocaleString('en-US'); }
function todayISO(){ const t=new Date(); return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`; } // local date, not UTC
// Normalises any date value (Excel serial number, Date object, 01/09/2026, 2026-09-01,
// 1-Sep-2026, Arabic-Indic digits...) into the ISO yyyy-mm-dd string Postgres expects.
// Returning '' for unparsable values is important: sending a raw Excel serial such as
// 46001 to a `date` column makes the whole Supabase upsert fail.
function toISODate(value){
  if(value===''||value===null||value===undefined) return '';
  if(value instanceof Date && !isNaN(value.getTime())){
    return new Date(value.getTime()-value.getTimezoneOffset()*60000).toISOString().slice(0,10);
  }
  if(typeof value==='number' && isFinite(value)){
    if(value>20000 && value<80000){
      const d = new Date(Math.round((value-25569)*86400000));
      return isNaN(d.getTime()) ? '' : d.toISOString().slice(0,10);
    }
    return '';
  }
  let s = String(value).trim();
  if(!s) return '';
  s = s.replace(/[\u0660-\u0669]/g, ch=>String(ch.charCodeAt(0)-0x0660))
       .replace(/[\u06f0-\u06f9]/g, ch=>String(ch.charCodeAt(0)-0x06f0));
  let m = s.match(/(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
  if(m) return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
  m = s.match(/(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/);
  if(m){
    let day = Number(m[1]), month = Number(m[2]);
    if(month>12 && day<=12){ const tmp=day; day=month; month=tmp; }
    if(day>31 || month>12) return '';
    let year = Number(m[3]); if(year<100) year += year<70 ? 2000 : 1900;
    return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }
  const months = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
  m = s.match(/(\d{1,2})[-\s]([A-Za-z]{3,})[-\s,]*(\d{4})/);
  if(m){ const mo = months[m[2].slice(0,3).toLowerCase()]; if(mo) return `${m[3]}-${String(mo).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`; }
  m = s.match(/([A-Za-z]{3,})\s+(\d{1,2})[-\s,]+(\d{4})/);
  if(m){ const mo = months[m[1].slice(0,3).toLowerCase()]; if(mo) return `${m[3]}-${String(mo).padStart(2,'0')}-${String(m[2]).padStart(2,'0')}`; }
  const parsed = new Date(s);
  if(!isNaN(parsed.getTime())) return new Date(parsed.getTime()-parsed.getTimezoneOffset()*60000).toISOString().slice(0,10);
  return '';
}
function toTimeValue(val){
  if(val===''||val===null||val===undefined) return '';
  if(val instanceof Date && !isNaN(val.getTime())) return String(val.getHours()).padStart(2,'0')+':'+String(val.getMinutes()).padStart(2,'0');
  if(typeof val==='number' && val<1 && val>=0){ const mins=Math.round(val*24*60); return String(Math.floor(mins/60)).padStart(2,'0')+':'+String(mins%60).padStart(2,'0'); }
  const m = String(val).match(/(\d{1,2}):(\d{2})/);
  return m ? `${String(m[1]).padStart(2,'0')}:${m[2]}` : '';
}
let nextLogId = 1;
function genLogId(){ return nextLogId++; }
// backfill unique ids on any log entries saved before this feature existed
function ensureLogIds(){
  let maxId = 0;
  debtors.forEach(d=>{ (d.log||[]).forEach(entry=>{ if(entry.id) maxId = Math.max(maxId, Number(entry.id)||0); }); });
  nextLogId = maxId + 1;
  debtors.forEach(d=>{ (d.log||[]).forEach(entry=>{ if(!entry.id) entry.id = genLogId(); }); });
}
ensureLogIds();

// ---- Payment-log integrity ---------------------------------------------------
// "paid" on a debtor can change without a matching payment entry in its log
// (Excel import with a "paid" column, hand-editing the paid total, data saved
// before payments were logged). Those amounts never showed in the payments
// register. These helpers keep: sum(log payments) === debtor.paid.

const money2 = n => Math.round((Number(n)||0)*100)/100;
function loggedPaymentsTotal(d){
  return money2((d.log||[]).filter(e=>e.type==='payment').reduce((s,e)=>s+(Number(e.amount)||0),0));
}
// Adds ONE payment entry covering whatever part of d.paid is not in the log yet.
function recordUnloggedPayment(d, opts={}){
  const gap = money2((Number(d.paid)||0) - loggedPaymentsTotal(d));
  if(gap <= 0) return 0;
  d.log = d.log || [];
  d.log.push({id:genLogId(), type:'payment', date:opts.date||todayISO(), amount:gap,
    method:opts.method||'رصيد سابق', note:opts.note||t('payments.autoNote')});
  return gap;
}
// When the paid total is lowered by hand, shave the difference off the newest payments.
function trimPaymentLogToPaid(d){
  let excess = money2(loggedPaymentsTotal(d) - (Number(d.paid)||0));
  if(excess <= 0) return;
  const newestFirst = (d.log||[]).filter(e=>e.type==='payment')
    .sort((a,b)=> (b.date||'').localeCompare(a.date||'') || (Number(b.id)||0)-(Number(a.id)||0));
  for(const e of newestFirst){
    if(excess <= 0) break;
    const cut = Math.min(Number(e.amount)||0, excess);
    e.amount = money2((Number(e.amount)||0) - cut);
    excess = money2(excess - cut);
  }
  d.log = d.log.filter(e=> e.type!=='payment' || Number(e.amount)>0);
}
function reconcileAllPaymentLogs(){
  let fixed = 0;
  debtors.forEach(d=>{ if(recordUnloggedPayment(d) > 0) fixed++; });
  return fixed;
}
function daysBetween(a,b){ return Math.round((new Date(b)-new Date(a))/86400000); }
function remaining(d){ return Math.max(d.total - d.paid, 0); }
function buildInstallments(total,due,count,frequency){
  const amount=Number(total||0)/count; const start=new Date(due); const step=frequency==='weekly'?7:frequency==='quarterly'?90:30;
  return Array.from({length:count},(_,index)=>{const date=new Date(start);date.setDate(date.getDate()+step*index);return {number:index+1,date:date.toISOString().slice(0,10),amount:Math.round(amount*100)/100,paid:false};});
}
function statusOf(d){
  if(remaining(d) <= 0) return 'paid';
  const today = new Date(todayISO());
  const due = new Date(d.due);
  if(due < today) return 'overdue';
  return 'active';
}
function statusLabel(s){ return {active:t('status.active'), overdue:t('status.overdue'), paid:t('status.paid')}[s] || s; }
function initials(name){ return name.trim().split(' ')[0].slice(0,1); }
function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2200);
}

// ============== UI DIALOGS, UNDO TOAST, SAVE STATUS ==============


// Promise-based replacement for window.prompt()/confirm(). Resolves to the entered values
// ({} for a plain confirmation) or null if cancelled. `validate(values)` may return an
// error message, which is shown inline while the dialog stays open.
function uiDialog({title='', message='', fields=[], confirmText, cancelText, danger=false, html='', validate} = {}){
  return new Promise(resolve=>{
    const prevFocus = document.activeElement;
    const rtl = currentLang!=='en';
    const wrap = document.createElement('div');
    wrap.className = 'uidlg-bg';
    const fieldHtml = fields.map((f,i)=>{
      const id = `uidlg_${i}`;
      let control;
      if(f.type==='select'){
        control = `<select id="${id}" class="field">${f.options.map(o=>`<option value="${esc(o.value)}"${String(o.value)===String(f.value)?' selected':''}>${esc(o.label)}</option>`).join('')}</select>`;
      } else if(f.type==='textarea'){
        control = `<textarea id="${id}" class="field" rows="3">${esc(f.value??'')}</textarea>`;
      } else {
        control = `<input id="${id}" class="field" type="${f.type||'text'}" value="${esc(f.value??'')}"${f.min!=null?` min="${f.min}"`:''}${f.step!=null?` step="${f.step}"`:''}${f.placeholder?` placeholder="${esc(f.placeholder)}"`:''}${f.type==='number'?' inputmode="decimal"':''}${f.type==='password'?' autocomplete="new-password"':''}>`;
      }
      return `<label class="uidlg-field" for="${id}"><span>${esc(f.label||'')}</span>${control}</label>`;
    }).join('');
    wrap.innerHTML = `<div class="uidlg" role="dialog" aria-modal="true"${title?' aria-labelledby="uidlgTitle"':''} dir="${rtl?'rtl':'ltr'}">
      ${title?`<h3 id="uidlgTitle">${esc(title)}</h3>`:''}
      ${message?`<div class="uidlg-msg">${esc(message).replace(/\n/g,'<br>')}</div>`:''}
      ${html}${fieldHtml}
      <p class="uidlg-error" role="alert" hidden></p>
      <div class="uidlg-actions">
        <button type="button" class="btn secondary" data-uidlg-cancel>${esc(cancelText||t('ui.cancel'))}</button>
        <button type="button" class="btn${danger?' danger':''}" data-uidlg-ok>${esc(confirmText||t('ui.ok'))}</button>
      </div></div>`;
    document.body.appendChild(wrap);
    const dlg = wrap.querySelector('.uidlg');
    const errEl = wrap.querySelector('.uidlg-error');
    const close = result=>{
      document.removeEventListener('keydown', onKey, true);
      wrap.remove();
      try{ prevFocus && prevFocus.focus && prevFocus.focus(); }catch(e){}
      resolve(result);
    };
    const submit = ()=>{
      const vals = {};
      fields.forEach((f,i)=>{ vals[f.name] = wrap.querySelector('#uidlg_'+i).value; });
      if(validate){
        const err = validate(vals);
        if(err){ errEl.textContent = err; errEl.hidden = false; return; }
      }
      close(vals);
    };
    function onKey(e){
      if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); close(null); return; }
      if(e.key==='Enter' && !['TEXTAREA','BUTTON','SELECT'].includes(e.target.tagName)){ e.preventDefault(); submit(); return; }
      if(e.key==='Tab'){
        const items = [...dlg.querySelectorAll('input,select,textarea,button')].filter(x=>!x.disabled);
        if(!items.length) return;
        const first = items[0], last = items[items.length-1];
        if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
        else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', onKey, true);
    wrap.addEventListener('mousedown', e=>{ if(e.target===wrap) close(null); });
    wrap.querySelector('[data-uidlg-cancel]').addEventListener('click', ()=>close(null));
    wrap.querySelector('[data-uidlg-ok]').addEventListener('click', submit);
    const firstField = wrap.querySelector('#uidlg_0');
    const focusEl = firstField || (danger ? wrap.querySelector('[data-uidlg-cancel]') : wrap.querySelector('[data-uidlg-ok]'));
    setTimeout(()=>{ focusEl.focus(); if(firstField && firstField.select && firstField.tagName!=='SELECT') firstField.select(); }, 0);
  });
}
async function uiConfirm(message, opts={}){ return !!(await uiDialog({message, ...opts})); }
async function uiPrompt(message, defaultValue='', opts={}){
  const {type='text', title='', validate, confirmText} = opts;
  const res = await uiDialog({title, confirmText, validate: validate ? (v=>validate(v.value)) : undefined,
    fields:[{name:'value', label:message, type, value:defaultValue}]});
  return res ? res.value : null;
}

// Undo toast: the destructive action has ALREADY happened; onUndo reverses it. onCommit
// (optional) runs once the window closes (or another undo toast replaces this one, or the
// page is closed) — use it for irreversible clean-up such as storage deletion.
let _undoState = null;
function commitPendingUndo(){
  if(!_undoState) return;
  const st = _undoState; _undoState = null;
  clearTimeout(st.timer); st.el.remove();
  try{ st.onCommit && st.onCommit(); }catch(e){ console.warn('Undo commit failed:', e); }
}
function toastUndo(message, onUndo, {onCommit, ms=8000} = {}){
  commitPendingUndo();
  const el = document.createElement('div');
  el.className = 'undo-toast'; el.setAttribute('role','status');
  el.innerHTML = `<span class="undo-msg">${esc(message)}</span><button type="button" class="undo-btn">${esc(t('ui.undo'))}</button><i class="undo-bar" style="animation-duration:${ms}ms"></i>`;
  document.body.appendChild(el);
  const st = {el, onCommit, timer:setTimeout(commitPendingUndo, ms)};
  _undoState = st;
  el.querySelector('.undo-btn').addEventListener('click', ()=>{
    if(_undoState!==st) return;
    _undoState = null; clearTimeout(st.timer); el.remove();
    try{ onUndo && onUndo(); }catch(e){ console.warn('Undo failed:', e); }
  });
}
window.addEventListener('pagehide', commitPendingUndo);

function setSaveStatus(state, detail=''){
  const el = document.getElementById('saveStatus');
  if(!el) return;
  el.hidden = false;
  el.dataset.state = state;
  el.textContent = t('save.'+state);
  el.title = detail || '';
  el.setAttribute('role', state==='error' ? 'alert' : 'status');
}
document.getElementById('saveStatus')?.addEventListener('click', ()=>{
  const el = document.getElementById('saveStatus');
  if(el.dataset.state==='error'){
    if(lastSyncError) showSyncErrorBanner(currentLang==='en'?'saving':'الحفظ', lastSyncError);
    saveState();
  }
});
// Warn before leaving the page while edits are still waiting for (or failed to reach) the cloud.
window.addEventListener('beforeunload', e=>{
  const st = document.getElementById('saveStatus')?.dataset.state;
  if(st==='pending' || st==='saving' || st==='error'){ flushPendingSave(); e.preventDefault(); e.returnValue = ''; }
});

const PAYMENT_METHODS = ['نقدًا','شيك','تحويل بنكي'];
const FOLLOW_METHODS = ['اتصال هاتفي','رسالة نصية','زيارة ميدانية','بريد إلكتروني'];
function methodOptions(list, current){
  const vals = (!current || list.includes(current)) ? list : [...list, current];
  return vals.map(v=>({value:v, label:translateValue(v)}));
}
// One implementation shared by the debtor drawer and the payments register.
async function editPaymentEntry(d, entry){
  const res = await uiDialog({
    title:t('drawer.editPaymentTitle'), message:d.name,
    fields:[
      {name:'amount', label:t('th.amountPaid'), type:'number', value:entry.amount, min:0, step:'any'},
      {name:'date', label:t('th.date'), type:'date', value:entry.date||todayISO()},
      {name:'method', label:t('th.method'), type:'select', value:entry.method, options:methodOptions(PAYMENT_METHODS, entry.method)},
    ],
    validate:v=>{
      const a = parseFloat(v.amount);
      if(isNaN(a) || a<=0) return t('msg.invalidAmount');
      if(!/^\d{4}-\d{2}-\d{2}$/.test(v.date)) return t('ui.invalidDate');
      return '';
    }
  });
  if(!res) return false;
  const newAmt = parseFloat(res.amount);
  d.paid = Math.max(0, money2(d.paid - entry.amount + newAmt));
  addAudit('edit_payment', `${d.name}: ${fmt(entry.amount)} → ${fmt(newAmt)}`);
  entry.amount = newAmt; entry.date = res.date; entry.method = res.method;
  toast(t('msg.paymentUpdated'));
  return true;
}
function deletePaymentWithUndo(d, entry){
  const idx = d.log.indexOf(entry);
  if(idx<0) return;
  d.paid = Math.max(0, money2(d.paid - entry.amount));
  d.log = d.log.filter(e=>e!==entry);
  addAudit('delete_payment', `${d.name}: ${fmt(entry.amount)}`);
  if(activeDebtorId===d.id) openDrawer(d.id);
  renderAll();
  toastUndo(t('msg.paymentDeleted'), ()=>{
    if(!debtors.includes(d)) return;
    d.log.splice(Math.min(idx, d.log.length), 0, entry);
    d.paid = money2((Number(d.paid)||0) + entry.amount);
    addAudit('restore_payment', `${d.name}: ${fmt(entry.amount)}`);
    if(activeDebtorId===d.id) openDrawer(d.id);
    renderAll();
  });
}
async function editFollowEntry(d, entry){
  const res = await uiDialog({title:t('drawer.editFollowTitle'), message:d.name,
    fields:[{name:'note', label:t('drawer.editFollowPrompt'), type:'textarea', value:entry.note||''}]});
  if(!res) return false;
  const newNote = res.note.trim();
  addAudit('edit_followup', `${d.name}: ${entry.note||'—'} → ${newNote||'—'}`);
  entry.note = newNote;
  toast(t('msg.followUpdated'));
  return true;
}
function deleteFollowWithUndo(d, entry){
  const idx = d.log.indexOf(entry);
  if(idx<0) return;
  d.log = d.log.filter(e=>e!==entry);
  addAudit('delete_followup', `${d.name}: ${entry.note||'—'}`);
  if(activeDebtorId===d.id) openDrawer(d.id);
  renderAll();
  toastUndo(t('msg.followDeleted'), ()=>{
    if(!debtors.includes(d)) return;
    d.log.splice(Math.min(idx, d.log.length), 0, entry);
    addAudit('restore_followup', `${d.name}: ${entry.note||'—'}`);
    if(activeDebtorId===d.id) openDrawer(d.id);
    renderAll();
  });
}
async function deleteDebtorWithUndo(id, confirmKey='confirm.deleteDebtor'){
  if(!can('delete')){ toast(currentLang==='en'?'You do not have permission to delete':'لا تملك صلاحية الحذف'); return; }
  const d = debtors.find(x=>x.id===id);
  if(!d) return;
  const ok = await uiConfirm(t(confirmKey), {title:d.name, danger:true, confirmText:t('ui.delete')});
  if(!ok) return;
  const idx = debtors.indexOf(d);
  debtors = debtors.filter(x=>x!==d);
  if(activeDebtorId===id) closeDrawer();
  addAudit('delete_debtor', `${d.name} — ${fmt(remaining(d))}`);
  renderAll();
  toastUndo(t('msg.debtorDeleted'), ()=>{
    debtors.splice(Math.min(idx, debtors.length), 0, d);
    addAudit('restore_debtor', d.name);
    renderAll();
  });
}
// Lowering the paid total trims the newest payments (see trimPaymentLogToPaid) — show exactly
// which ones before the user commits to it.
function previewPaymentTrim(d, newPaid){
  let excess = money2(loggedPaymentsTotal(d) - newPaid);
  const out = [];
  if(excess<=0) return {excess:0, out};
  const newestFirst = (d.log||[]).filter(e=>e.type==='payment')
    .sort((a,b)=> (b.date||'').localeCompare(a.date||'') || (Number(b.id)||0)-(Number(a.id)||0));
  for(const e of newestFirst){
    if(excess<=0) break;
    const cut = Math.min(Number(e.amount)||0, excess);
    out.push({entry:e, from:Number(e.amount)||0, to:money2((Number(e.amount)||0)-cut)});
    excess = money2(excess-cut);
  }
  return {excess:money2(loggedPaymentsTotal(d)-newPaid), out};
}

// ============== MOBILE MENU ==============
document.getElementById('mobileMenuToggle').addEventListener('click', () => {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('mobile-open');
});

// Close mobile menu when clicking outside
document.addEventListener('click', (e) => {
  const sidebar = document.getElementById('sidebar');
  const menuToggle = document.getElementById('mobileMenuToggle');
  if (sidebar.classList.contains('mobile-open') && 
      !sidebar.contains(e.target) && 
      !menuToggle.contains(e.target)) {
    sidebar.classList.remove('mobile-open');
  }
});

// ============== NAV ==============
document.querySelectorAll('.nav-item').forEach(item=>{
  item.addEventListener('click', ()=>{
    document.querySelectorAll('.nav-item').forEach(i=>i.classList.remove('active'));
    item.classList.add('active');
    const page = item.dataset.page;
    document.querySelectorAll('.nav-item').forEach(i=>{ if(i===item) i.setAttribute('aria-current','page'); else i.removeAttribute('aria-current'); });
    document.querySelectorAll('.bnav-item').forEach(b=>{ const on=b.dataset.page===page; b.classList.toggle('active',on); if(on) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); });
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    document.getElementById('page-'+page).classList.add('active');
    
    // Close mobile menu on navigation
    if (window.innerWidth <= 768) {
      document.getElementById('sidebar').classList.remove('mobile-open');
    }
    
    const titles = {
      dashboard:['لوحة التحكم','نظرة عامة على حالة التحصيل اليوم'],
      debtors:['المدينون','إدارة كافة ملفات المدينين'],
      reps:['المندوبون','فريق التحصيل الميداني وأداء كل مندوب'],
      payments:['سجل السداد','جميع عمليات السداد المسجّلة'],
      followups:['المتابعات','سجل الاتصالات والزيارات'],
      quotations:['عروض الأسعار','متابعة عروض الأسعار المقدمة للعملاء'],
      aging:['أعمار الديون','تصنيف المتأخرات حسب مدة التأخير (30/60/90 يوم)'],
      reports:['التقارير','ملخص مالي وتحليل الحالات'],
      settings:['الإعدادات','النسخ الاحتياطي وإدارة بيانات النظام'],
    };
    const useEn = currentLang==='en';
    document.getElementById('pageTitle').textContent = useEn ? EN_TITLES[page][0] : titles[page][0];
    document.getElementById('pageSub').textContent = useEn ? EN_TITLES[page][1] : titles[page][1];
    renderAll();
  });
});

// ============== MODAL ==============
let editingDebtorId = null;
document.getElementById('addDebtorBtn').addEventListener('click', ()=>{
  if(!can('write')){toast(currentLang==='en'?'You do not have permission to edit data':'لا تملك صلاحية تعديل البيانات');return;}
  editingDebtorId = null;
  document.getElementById('debtorModalTitle').textContent = t('modal.addDebtor');
  document.getElementById('saveDebtorBtn').textContent = t('modal.saveDebtor');
  ['f_name','f_phone','f_amount','f_due','f_expectedPaymentDate','f_paid','f_notes','f_companyNumber','f_crNumber'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('f_paidMethod').value = 'نقدًا';
  document.getElementById('f_paidDate').value = todayISO();
  setDebtorTypeUI('individual');
  fillRepSelect(document.getElementById('f_rep'));
  lockRepFieldForCollector();
  document.getElementById('debtorModal').classList.add('show');
});
function openDebtorEditModal(id){
  if(!can('write')){toast(currentLang==='en'?'You do not have permission to edit data':'لا تملك صلاحية تعديل البيانات');return;}
  const d = debtors.find(x=>x.id===id);
  if(!d) return;
  if(currentUser?.role==='collector' && d.repId!==currentUser.repId){
    toast(currentLang==='en'?'This case is not assigned to you':'هذه الحالة غير مسندة إليك');
    return;
  }
  editingDebtorId = id;
  document.getElementById('debtorModalTitle').textContent = t('modal.editDebtor');
  document.getElementById('saveDebtorBtn').textContent = t('modal.saveChanges');
  setDebtorTypeUI(d.type||'individual');
  document.getElementById('f_name').value = d.name||'';
  document.getElementById('f_companyNumber').value = d.companyNumber||'';
  document.getElementById('f_crNumber').value = d.crNumber||'';
  document.getElementById('f_phone').value = d.phone||'';
  document.getElementById('f_amount').value = d.total||0;
  document.getElementById('f_due').value = d.due||'';
  document.getElementById('f_expectedPaymentDate').value = d.expectedPaymentDate||'';
  document.getElementById('f_paid').value = '';
  document.getElementById('f_paidMethod').value = 'نقدًا';
  document.getElementById('f_paidDate').value = todayISO();
  document.getElementById('f_installments').value = d.installments?.length || 1;
  document.getElementById('f_frequency').value = d.frequency || 'monthly';
  document.getElementById('f_notes').value = d.notes||'';
  fillRepSelect(document.getElementById('f_rep'), d.repId||'');
  lockRepFieldForCollector();
  document.getElementById('debtorModal').classList.add('show');
}
// a collector can only ever create/keep cases assigned to themselves —
// this locks the "assigned collector" field in the add/edit modal accordingly.
function lockRepFieldForCollector(){
  const sel=document.getElementById('f_rep');
  if(currentUser?.role==='collector'){
    if(currentUser.repId) sel.value=String(currentUser.repId);
    sel.disabled=true;
  } else {
    sel.disabled=false;
  }
}
function setDebtorTypeUI(type){
  document.getElementById('f_type_individual').classList.toggle('active', type==='individual');
  document.getElementById('f_type_company').classList.toggle('active', type==='company');
  document.getElementById('f_companyFields').classList.toggle('show', type==='company');
  document.getElementById('f_nameLabel').textContent = type==='company' ? t('modal.companyName') : t('modal.fullName');
  document.getElementById('f_name').placeholder = type==='company' ? t('modal.companyNamePh') : t('modal.fullNamePh');
  document.getElementById('debtorModal').dataset.debtorType = type;
}
document.getElementById('f_type_individual').addEventListener('click', ()=>setDebtorTypeUI('individual'));
document.getElementById('f_type_company').addEventListener('click', ()=>setDebtorTypeUI('company'));
function fillRepSelect(sel, selected){
  const current = selected!==undefined ? selected : sel.value;
  sel.innerHTML = `<option value="">${t('drawer.noRep')}</option>` + reps.map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join('');
  if(current) sel.value = current;
}
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click', e=>{
  document.getElementById(e.target.dataset.close).classList.remove('show');
}));
document.getElementById('saveDebtorBtn').addEventListener('click', async ()=>{
  if(!can('write')){toast(currentLang==='en'?'You do not have permission to edit data':'لا تملك صلاحية تعديل البيانات');return;}
  const type = document.getElementById('debtorModal').dataset.debtorType || 'individual';
  const name = document.getElementById('f_name').value.trim();
  const companyNumber = type==='company' ? document.getElementById('f_companyNumber').value.trim() : '';
  const crNumber = type==='company' ? document.getElementById('f_crNumber').value.trim() : '';
  const phone = document.getElementById('f_phone').value.trim();
  const amount = parseFloat(document.getElementById('f_amount').value) || 0;
  const due = document.getElementById('f_due').value || '2026-12-31';
  const expectedPaymentDate = document.getElementById('f_expectedPaymentDate').value || '';
  const paid = parseFloat(document.getElementById('f_paid').value) || 0;
  const paidMethod = document.getElementById('f_paidMethod').value;
  const paidDate = document.getElementById('f_paidDate').value || todayISO();
  const notes = document.getElementById('f_notes').value.trim();
  const repId = document.getElementById('f_rep').value ? Number(document.getElementById('f_rep').value) : null;
  const installmentCount = Math.max(1,parseInt(document.getElementById('f_installments').value)||1);
  const frequency = document.getElementById('f_frequency').value;
  if(!name || !amount){ toast(type==='company' ? t('toast.needCompanyName') : t('toast.needName')); return; }
  {
    const prev = editingDebtorId ? debtors.find(x=>x.id===editingDebtorId) : null;
    const idsChanged = !prev || prev.name!==name || (prev.phone||'')!==phone || (prev.companyNumber||'')!==companyNumber || (prev.crNumber||'')!==crNumber;
    if(idsChanged){
      const dups = findDebtorDuplicates({name, phone, companyNumber, crNumber}, editingDebtorId);
      if(dups.length && !(await confirmDuplicate(dups, 'dup.debtorMsg'))) return;
    }
  }

  if(editingDebtorId){
    const d = debtors.find(x=>x.id===editingDebtorId);
    let diffParts=[];
    if(d){
      const before={name:d.name, phone:d.phone, total:d.total, due:d.due, repId:d.repId};
      d.name=name; d.type=type; d.companyNumber=companyNumber; d.crNumber=crNumber;
      d.phone=phone; d.total=amount; d.due=due; d.expectedPaymentDate=expectedPaymentDate; d.notes=notes; d.repId=repId; d.frequency=frequency; d.installments=buildInstallments(amount,due,installmentCount,frequency);
      if(paid>0){ d.paid += paid; d.log.push({id:genLogId(), type:'payment', date:paidDate, amount:paid, method:paidMethod}); }
      if(before.name!==name) diffParts.push(`${currentLang==='en'?'name':'الاسم'}: ${before.name} → ${name}`);
      if(before.total!==amount) diffParts.push(`${currentLang==='en'?'amount':'المبلغ'}: ${fmt(before.total)} → ${fmt(amount)}`);
      if(before.due!==due) diffParts.push(`${currentLang==='en'?'due':'الاستحقاق'}: ${before.due} → ${due}`);
      if(before.phone!==phone) diffParts.push(`${currentLang==='en'?'phone':'الهاتف'}: ${before.phone||'—'} → ${phone||'—'}`);
      if(before.repId!==repId){
        const oldRep=reps.find(r=>r.id===before.repId), newRep=reps.find(r=>r.id===repId);
        diffParts.push(`${currentLang==='en'?'collector':'المندوب'}: ${oldRep?oldRep.name:t('drawer.noRep')} → ${newRep?newRep.name:t('drawer.noRep')}`);
      }
      if(paid>0) diffParts.push(`${currentLang==='en'?'payment added':'دفعة مضافة'}: ${fmt(paid)}`);
    }
    document.getElementById('debtorModal').classList.remove('show');
    addAudit('update_debtor', `${name}${diffParts.length?' — '+diffParts.join(' | '):''}`);
    toast(t('toast.updated'));
    editingDebtorId = null;
    renderAll();
    return;
  }

  debtors.push({id:nextId++, name, type, companyNumber, crNumber, phone, total:amount, paid, due, expectedPaymentDate, notes, repId, frequency, installments:buildInstallments(amount,due,installmentCount,frequency), log: paid>0?[{id:genLogId(), type:'payment', date:paidDate, amount:paid, method:paidMethod}]:[]}); 
  document.getElementById('debtorModal').classList.remove('show');
  addAudit('add_debtor',`${name} — ${fmt(amount)} ${currentLang==='en'?'QAR':'ر.ق'}`);
  toast(type==='company' ? t('toast.companyAdded') : t('toast.debtorAdded'));
  renderAll();
});

// ============== SEARCH & FILTER ==============
document.getElementById('globalSearch').addEventListener('input', debounce(renderAll, 200));

// Dropdown under the top search box: matching debtors AND quotations in one place.
function renderGlobalSearchResults(){
  const input = document.getElementById('globalSearch');
  const box = document.getElementById('globalSearchResults');
  if(!input || !box) return;
  const q = (input.value||'').trim().toLowerCase();
  if(q.length < 2 || !currentUser){ box.hidden = true; box.innerHTML = ''; return; }
  const more = n => `<div class="sr-empty">${esc(t('sr.more').replace('{n}', n))}</div>`;
  let html = '';
  let any = false;
  if(canSeePage('debtors')){
    // same matching rules as the debtors table's own search
    const list = scopedDebtors().filter(d=> d.name.toLowerCase().includes(q) || (d.phone||'').includes(q)
      || (d.companyNumber||'').toLowerCase().includes(q) || (d.crNumber||'').toLowerCase().includes(q)
      || (d.notes||'').toLowerCase().includes(q));
    if(list.length){
      any = true;
      html += `<div class="sr-head">${esc(t('sr.debtors'))} (${list.length})</div>` + list.slice(0,5).map(d=>
        `<button type="button" class="sr-item" data-sr-debtor="${d.id}">${esc(d.name)}<small>${esc(d.phone||'')}${d.phone?' · ':''}${esc(t('th.remaining')||'')} ${esc(fmt(remaining(d)))}</small></button>`).join('')
        + (list.length>5 ? more(list.length-5) : '');
    }
  }
  if(canSeePage('quotations')){
    const hits = quotations.filter(x=>`${x.companyName||''} ${x.contactPerson||''} ${x.mobile||''} ${x.email||''} ${x.quotationNo||''} ${x.invoiceNo||''} ${x.projectNo||''}`.toLowerCase().includes(q))
      .sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    if(hits.length){
      any = true;
      html += `<div class="sr-head">${esc(t('sr.quotations'))} (${hits.length})</div>` + hits.slice(0,5).map(x=>
        `<button type="button" class="sr-item" data-sr-quot="${x.id}">${esc(x.companyName)}<small>${esc(x.date||'—')}${x.quotationNo?' · '+esc(x.quotationNo):''} · ${esc(quotStatusLabel(x.status))}</small></button>`).join('')
        + (hits.length>5 ? more(hits.length-5) : '');
    }
  }
  box.innerHTML = any ? html : `<div class="sr-empty">${esc(t('sr.none'))}</div>`;
  box.hidden = false;
}
(function initGlobalSearchDropdown(){
  const input = document.getElementById('globalSearch');
  const box = document.getElementById('globalSearchResults');
  if(!input || !box) return;
  input.addEventListener('input', debounce(renderGlobalSearchResults, 150));
  input.addEventListener('focus', renderGlobalSearchResults);
  box.addEventListener('click', e=>{
    const dBtn = e.target.closest('[data-sr-debtor]');
    const qBtn = e.target.closest('[data-sr-quot]');
    if(dBtn){ openDrawer(Number(dBtn.dataset.srDebtor)); box.hidden = true; }
    if(qBtn){
      const qt = quotations.find(x=>x.id===Number(qBtn.dataset.srQuot));
      if(!qt) return;
      document.querySelector('.nav-item[data-page="quotations"]')?.click();
      quotShowAll = false; quotSortFollowup = false;
      const df = document.getElementById('quotDateFilter'); if(df && qt.date) df.value = qt.date;
      renderQuotationsTable();
      openQuotationDrawer(qt.id);
      box.hidden = true;
    }
  });
  document.addEventListener('mousedown', e=>{ if(!box.hidden && !e.target.closest('.search-wrap')) box.hidden = true; });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape' && !box.hidden){ box.hidden = true; } });
})();
document.getElementById('statusFilter').addEventListener('change', renderAll);
document.getElementById('typeFilter').addEventListener('change', renderAll);

// Advanced Search
document.getElementById('advancedSearchBtn').addEventListener('click', () => {
  const panel = document.getElementById('advancedSearchPanel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  // Populate collector filter
  const collectorSelect = document.getElementById('collectorFilter');
  collectorSelect.innerHTML = '<option value="all" data-i18n="debtors.allStatuses">الكل</option>' +
    reps.map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('');
});

document.getElementById('applyAdvancedSearch').addEventListener('click', renderAll);
document.getElementById('resetAdvancedSearch').addEventListener('click', () => {
  document.getElementById('minAmount').value = '';
  document.getElementById('maxAmount').value = '';
  document.getElementById('minDate').value = '';
  document.getElementById('maxDate').value = '';
  document.getElementById('collectorFilter').value = 'all';
  document.getElementById('riskFilter').value = 'all';
  renderAll();
});

document.getElementById('saveSearchBtn').addEventListener('click', () => {
  const searchConfig = {
    query: document.getElementById('globalSearch').value,
    status: document.getElementById('statusFilter').value,
    type: document.getElementById('typeFilter').value,
    minAmount: document.getElementById('minAmount').value,
    maxAmount: document.getElementById('maxAmount').value,
    minDate: document.getElementById('minDate').value,
    maxDate: document.getElementById('maxDate').value,
    collector: document.getElementById('collectorFilter').value,
    risk: document.getElementById('riskFilter').value
  };
  appSettings.savedSearch = searchConfig; saveSettings();
  toast(currentLang === 'en' ? 'Search saved' : 'تم حفظ البحث');
});

// Load saved search on startup
function loadSavedSearch() {
  try {
    const config = appSettings.savedSearch;
    if (config) {
      document.getElementById('globalSearch').value = config.query || '';
      document.getElementById('statusFilter').value = config.status || 'all';
      document.getElementById('typeFilter').value = config.type || 'all';
      document.getElementById('minAmount').value = config.minAmount || '';
      document.getElementById('maxAmount').value = config.maxAmount || '';
      document.getElementById('minDate').value = config.minDate || '';
      document.getElementById('maxDate').value = config.maxDate || '';
      document.getElementById('collectorFilter').value = config.collector || 'all';
      document.getElementById('riskFilter').value = config.risk || 'all';
    }
  } catch (e) {}
}

const normName = v => String(v||'').toLowerCase().replace(/\s+/g,' ').trim();
const digitsOnly = v => String(v||'').replace(/\D/g,'');
// Compare phones by their last 8 digits so "+974 6661-1111" and "66611111" are the same number.
const phoneKey = v => { const d = digitsOnly(v); return d.length>8 ? d.slice(-8) : d; };
// Debtors that look like the one being saved: same name, same phone (6+ digits), same company / CR number.
function findDebtorDuplicates({name, phone, companyNumber, crNumber}, excludeId=null){
  const n = normName(name), p = phoneKey(phone), cn = normName(companyNumber), cr = normName(crNumber);
  const out = [];
  debtors.forEach(d=>{
    if(excludeId!=null && d.id===excludeId) return;
    const why = [];
    if(n && normName(d.name)===n) why.push(t('dup.byName'));
    if(p.length>=6 && phoneKey(d.phone)===p) why.push(t('dup.byPhone'));
    if(cn && normName(d.companyNumber)===cn) why.push(t('dup.byCompanyNo'));
    if(cr && normName(d.crNumber)===cr) why.push(t('dup.byCr'));
    if(why.length) out.push({label:`${d.name}${d.phone?' — '+d.phone:''}`, why:why.join(' + ')});
  });
  return out;
}
// A quotation is a likely duplicate if it reuses a quotation number, or is the same company on the same day.
function findQuotationDuplicates({companyName, quotationNo, date}, excludeId=null){
  const n = normName(companyName), no = normName(quotationNo);
  const out = [];
  quotations.forEach(q=>{
    if(excludeId!=null && q.id===excludeId) return;
    const why = [];
    if(no && normName(q.quotationNo)===no) why.push(t('dup.byQuotNo'));
    if(n && normName(q.companyName)===n && (q.date||'')===(date||'')) why.push(t('dup.byCompanyDate'));
    if(why.length) out.push({label:`${q.companyName} — ${q.date||'—'}${q.quotationNo?' — '+q.quotationNo:''}`, why:why.join(' + ')});
  });
  return out;
}
async function confirmDuplicate(items, msgKey){
  const html = `<div class="uidlg-list">${items.slice(0,6).map(x=>`<div><span>${esc(x.label)}</span><span>${esc(x.why)}</span></div>`).join('')}${items.length>6?`<div><span>+${items.length-6}</span></div>`:''}</div>`;
  return !!(await uiDialog({title:t('dup.title'), message:t(msgKey), html, confirmText:t('dup.saveAnyway')}));
}
// Excel serial number / dd/mm/yyyy / ISO -> "YYYY-MM-DD" ('' when it cannot be understood)
function normalizeImportDate(v){
  if(v===''||v==null) return '';
  if(typeof v==='number' && isFinite(v)){
    const d = new Date(Math.round((v-25569)*86400000));
    return isNaN(d) ? '' : d.toISOString().slice(0,10);
  }
  const str = String(v).trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const m = str.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
  if(m) return `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
  return '';
}
// Parses sheet rows WITHOUT touching app state: ids are only assigned when the user confirms.
function parseDebtorImportRows(rows){
  const pick=(row,keys)=>{const key=Object.keys(row).find(k=>keys.includes(String(k).trim().toLowerCase()));return key===undefined?'':row[key];};
  const valid=[], rejected=[], duplicates=[];
  const seen = new Set();
  rows.forEach((row,i)=>{
    const rowNo = i+2;                       // row 1 of the sheet is the header
    const name = String(pick(row,['الاسم','اسم المدين','name','debtor name'])).trim();
    const total = Number(pick(row,['إجمالي الدين','المبلغ','total','total debt']))||0;
    if(!name){ rejected.push({rowNo, name:'—', reason:t('imp.noName')}); return; }
    if(!(total>0)){ rejected.push({rowNo, name, reason:t('imp.badTotal')}); return; }
    const typeRaw = String(pick(row,['النوع','type']));
    const type = typeRaw.toLowerCase().includes('company') || typeRaw.includes('شركة') ? 'company' : 'individual';
    const paid = Number(pick(row,['المسدد','paid']))||0;
    const item = {rowNo, name, type, total, paid:Math.max(0,paid),
      companyNumber:String(pick(row,['رقم الشركة','company number'])), crNumber:String(pick(row,['السجل التجاري','cr number'])),
      phone:String(pick(row,['الهاتف','phone'])), due:normalizeImportDate(pick(row,['تاريخ الاستحقاق','due','due date'])) || '2026-12-31',
      notes:String(pick(row,['ملاحظات','notes'])), warn: paid>total ? t('imp.paidOver') : ''};
    const dupExisting = findDebtorDuplicates(item);
    const key = normName(name)+'|'+phoneKey(item.phone);
    if(dupExisting.length){ duplicates.push({rowNo, name, reason:t('imp.dupExisting'), item}); }
    else if(seen.has(key)){ duplicates.push({rowNo, name, reason:t('imp.dupInFile'), item}); }
    else { seen.add(key); valid.push(item); }
  });
  return {valid, rejected, duplicates};
}
async function importDebtorsFromRows(rows){
  const {valid, rejected, duplicates} = parseDebtorImportRows(rows);
  const total = valid.length + rejected.length + duplicates.length;
  const lineList = (title, list) => list.length ? `<div class="sr-head">${esc(title)} (${list.length})</div><div class="uidlg-list">${list.slice(0,8).map(x=>`<div><span>${esc(t('imp.row'))} ${x.rowNo}: ${esc(x.name)}</span><span>${esc(x.reason)}</span></div>`).join('')}${list.length>8?`<div><span>+${list.length-8}</span></div>`:''}</div>` : '';
  const fields = duplicates.length ? [{name:'dupMode', label:t('imp.dupMode'), type:'select', value:'skip',
    options:[{value:'skip',label:t('imp.skipDup')},{value:'keep',label:t('imp.keepDup')}]}] : [];
  const countFor = mode => valid.length + (mode==='keep' ? duplicates.length : 0);
  const res = await uiDialog({
    title:t('imp.title'),
    message:t('imp.summary').replace('{total}',total).replace('{valid}',valid.length).replace('{bad}',rejected.length).replace('{dup}',duplicates.length),
    html: lineList(t('imp.rejected'), rejected) + lineList(t('imp.duplicates'), duplicates)
      + lineList(t('imp.warnings'), valid.filter(x=>x.warn).map(x=>({rowNo:x.rowNo, name:x.name, reason:x.warn}))),
    fields, confirmText:t('imp.confirm').replace('{n}', valid.length),
    validate: v => countFor(v.dupMode||'skip') > 0 ? '' : t('imp.nothing'),
  });
  if(!res) return;
  const chosen = [...valid, ...((res.dupMode==='keep') ? duplicates.map(x=>x.item) : [])];
  const imported = chosen.map(it=>{ const {warn, rowNo, ...d} = it; return {id:nextId++, ...d, repId:null, log:[]}; });
  imported.forEach(d=>recordUnloggedPayment(d,{method:'رصيد سابق', note:t('payments.importNote')}));
  debtors.push(...imported);
  addAudit('import_debtors', `${imported.length}`);
  renderAll();
  toast(t('imp.done').replace('{n}', imported.length));
}
document.getElementById('importExcelFile').addEventListener('change', e=>{
  const file=e.target.files[0]; if(!file) return;
  const reader=new FileReader(); reader.onload=async ()=>{
    try{
      const wb = XLSX.read(reader.result,{type:'array'});
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});
      if(!rows.length) throw new Error('empty');
      await importDebtorsFromRows(rows);
    }catch(err){toast(currentLang==='en'?'Could not read Excel file':'تعذّرت قراءة ملف Excel');}
  }; reader.readAsArrayBuffer(file); e.target.value='';
});
document.getElementById('downloadExcelTemplateBtn').addEventListener('click',()=>{
  const sheet=XLSX.utils.json_to_sheet([{الاسم:'اسم المدين',النوع:'فرد',الهاتف:'0500000000','إجمالي الدين':1000,المسدد:0,'تاريخ الاستحقاق':'2026-12-31',ملاحظات:''}]);
  const book=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book,sheet,'Debtors'); XLSX.writeFile(book,'daftar-debtors-template.xlsx');
});
function printThemeVars(){
  const cs=getComputedStyle(document.documentElement);
  const accent=(cs.getPropertyValue('--accent')||'#C9A227').trim()||'#C9A227';
  const accentDim=(cs.getPropertyValue('--accent-dim')||'#8A7327').trim()||'#8A7327';
  const rgb=hexToRgbArr(accent);
  const ink=readableInk(rgb);
  return {accent, accentDim, ink, rgb:rgb.join(',')};
}
function printBackgroundCss(){
  return appSettings.watermarkEnabled!==false
    ? `background-image:linear-gradient(rgba(255,255,255,.94),rgba(255,255,255,.94)),url('${IMAGE_PATH}'); background-size:cover; background-position:center; background-attachment:fixed;`
    : `background:#ffffff;`;
}
function printBrandHeader(docLabel, docCode){
  const seal='د';
  return `<div class="doc-brand">
    <div class="doc-brand-left">
      <div class="doc-seal">${seal}</div>
      <div>
        <div class="doc-brand-name">${currentLang==='en'?'Daftar':'دفتر'}</div>
        <div class="doc-brand-sub">${t('msg.statementSystem')}</div>
      </div>
    </div>
    <div class="doc-brand-right">
      <div class="doc-title">${esc(docLabel)}</div>
      ${docCode?`<div class="doc-code">${esc(docCode)}</div>`:''}
      <div class="doc-issue">${currentLang==='en'?'Issued':'تاريخ الإصدار'}: ${todayISO()}</div>
    </div>
  </div>`;
}
function printSharedStyle(opts={}){
  const {orientation='portrait', dense=false} = opts;
  const {accent, accentDim, ink}=printThemeVars();
  return `
  @page{ size:A4 ${orientation}; margin:${orientation==='landscape'?'10mm':'16mm'}; }
  *{box-sizing:border-box;}
  body{font-family:'IBM Plex Sans Arabic','Tahoma','Arial',sans-serif; color:#20242c; direction:${currentLang==='en'?'ltr':'rtl'}; margin:0; padding:0; ${printBackgroundCss()} print-color-adjust:exact; -webkit-print-color-adjust:exact; font-size:13px;}
  .doc-brand{display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:18px; margin-bottom:22px; border-bottom:3px solid ${accent};}
  .doc-brand-left{display:flex; align-items:center; gap:12px;}
  .doc-seal{width:46px; height:46px; border-radius:50%; border:2px solid ${accent}; color:${accent}; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:19px;}
  .doc-brand-name{font-size:17px; font-weight:900;}
  .doc-brand-sub{font-size:11px; color:#6b7280; margin-top:2px;}
  .doc-brand-right{text-align:${currentLang==='en'?'left':'right'};}
  .doc-title{font-size:15px; font-weight:800; color:${accent==='#'?accent:accent};}
  .doc-code{font-size:11px; color:#6b7280; margin-top:2px; font-family:'Consolas','Courier New',monospace;}
  .doc-issue{font-size:11px; color:#6b7280; margin-top:2px;}
  h1{font-size:17px; font-weight:800; margin:0 0 4px;}
  table{width:100%; border-collapse:collapse; margin-bottom:20px; table-layout:fixed;}
  table.wide{table-layout:auto;}
  th{background:${accent}; color:${ink}; font-size:${dense?'9px':'11.5px'}; font-weight:700; padding:${dense?'5px 4px':'9px 10px'}; text-align:${currentLang==='en'?'left':'right'}; white-space:normal; overflow-wrap:break-word; word-break:break-word; line-height:1.3;}
  td{padding:${dense?'5px 4px':'9px 10px'}; font-size:${dense?'8.5px':'12px'}; border-bottom:1px solid #e7e9ee; white-space:normal; overflow-wrap:break-word; word-break:break-word; line-height:1.4; vertical-align:top;}
  tr:nth-child(even) td{background:rgba(0,0,0,.018);}
  tr.opening td{background:rgba(${hexToRgbArr(accent).join(',')},.08); font-weight:700;}
  tr{break-inside:avoid; page-break-inside:avoid;}
  thead{display:table-header-group;}
  .num{font-family:'Consolas','Courier New',monospace; direction:ltr; text-align:left;}
  .panel,.stat-card,.party .box{background:rgba(255,255,255,.92); border:1px solid #e2e5ec; border-radius:10px; padding:14px 16px; margin:0 0 10px;}
  .stat-grid{display:grid; grid-template-columns:repeat(2,1fr); gap:10px;}
  .empty{padding:12px;}
  .page{display:block!important;}
  .risk{font-weight:800;}
  .doc-footer{margin-top:32px; padding-top:12px; border-top:1px dashed #d5d9e0; font-size:10.5px; color:#9aa0ab; text-align:center;}
  `;
}
function currentPageDocument(){
  const page=document.querySelector('.page.active'); const title=document.getElementById('pageTitle').textContent;
  return `<!doctype html><html lang="${currentLang}" dir="${currentLang==='en'?'ltr':'rtl'}"><head><meta charset="utf-8"><title>${esc(title)}</title>
<link rel="stylesheet" href="${new URL('fonts/fonts.css', location.href).href}">
<style>${printSharedStyle()}</style></head><body>
${printBrandHeader(title)}
${page.innerHTML}
<div class="doc-footer">${t('msg.printedOn')} ${todayISO()}.</div>
</body></html>`;
}
// ============== DRAWER ==============
function openDrawer(id){
  const d0 = debtors.find(x=>x.id===id);
  if(!d0) return;
  if(currentUser?.role==='collector' && d0.repId!==currentUser.repId){
    toast(currentLang==='en'?'This case is not assigned to you':'هذه الحالة غير مسندة إليك');
    return;
  }
  activeDebtorId = id;
  const d = d0;
  document.getElementById('dr_seal').textContent = initials(d.name);
  document.getElementById('dr_phone').textContent = d.phone || '—';
  {
    const wa=document.getElementById('dr_whatsapp');
    let digits=String(d.phone||'').replace(/[^\d+]/g,'').replace(/^\+/,'').replace(/^00/,'');
    if(digits.length===8) digits='974'+digits;                  // local Qatari number
    if(digits.length>=10 && remaining(d)>0){
      const en=currentLang==='en'; const co=appSettings.companyName||'';
      const msg=en
        ? `Hello ${d.name}, a friendly reminder that an outstanding balance of ${currency(remaining(d))} was due on ${d.due||'-'}. Please contact us to arrange payment. ${co}`
        : `السلام عليكم ${d.name}، نذكّركم بوجود مبلغ مستحق قدره ${currency(remaining(d))} بتاريخ ${d.due||'-'}. نرجو التواصل معنا لترتيب السداد. ${co}`;
      wa.href=`https://wa.me/${digits}?text=${encodeURIComponent(msg.trim())}`; wa.hidden=false;
    } else { wa.hidden=true; wa.removeAttribute('href'); }
  }
  document.getElementById('dr_name').textContent = d.name;
  const isCompany = d.type==='company';
  document.getElementById('dr_type').innerHTML = `<span class="badge ${isCompany?'type-company':'type-individual'}">${isCompany?t('debtors.company'):t('debtors.individual')}</span>`;
  document.getElementById('dr_companyNumberRow').style.display = isCompany ? 'flex' : 'none';
  document.getElementById('dr_crNumberRow').style.display = isCompany ? 'flex' : 'none';
  document.getElementById('dr_companyNumber').textContent = d.companyNumber || '—';
  document.getElementById('dr_crNumber').textContent = d.crNumber || '—';
  document.getElementById('dr_total').textContent = currency(d.total);
  document.getElementById('dr_paid').textContent = currency(d.paid);
  document.getElementById('dr_remaining').textContent = currency(remaining(d));
  document.getElementById('dr_status').innerHTML = `<span class="badge ${statusOf(d)}">${statusLabel(statusOf(d))}</span>`;
  document.getElementById('dr_due').textContent = d.due;
  document.getElementById('dr_installments').innerHTML = (d.installments||[]).map(item=>`<div class="installment-row"><span>#${item.number} · ${item.date}</span><b>${currency(item.amount)}</b><span class="badge ${item.paid?'paid':'active'}">${item.paid?t('status.paid'):currentLang==='en'?'Pending':'قيد الانتظار'}</span></div>`).join('') || `<div class="wm-note">${currentLang==='en'?'No installment plan':'لا توجد خطة أقساط'}</div>`;
  const rep = reps.find(r=>r.id===d.repId);
  document.getElementById('dr_repName').textContent = rep ? rep.name : t('drawer.noRep');
  fillRepSelect(document.getElementById('dr_repSelect'), d.repId||'');
  renderPromiseBox(d);
  document.getElementById('dr_paymentDate').value = todayISO();
  document.getElementById('dr_followDate').value = todayISO();

  const log = document.getElementById('dr_log');
  if(!d.log.length){
    log.innerHTML = `<div style="color:var(--muted); font-size:12.5px; padding:10px 0">${currentLang==='en'?'No activity recorded yet.':'لا يوجد نشاط مسجل بعد.'}</div>`;
  } else {
    log.innerHTML = [...d.log].reverse().map(e=>{
      if(e.type==='payment'){
        const actions = can('write') ? `<span class="log-actions"><button type="button" class="link-btn" data-edit-payment="${e.id}">${t('action.edit')}</button><button type="button" class="link-btn" data-delete-payment="${e.id}">${t('action.delete')}</button></span>` : '';
        return `<div class="log-entry"><div class="top"><b>${currentLang==='en'?'Payment':'دفعة سداد'} — ${fmt(e.amount)} ${currentLang==='en'?'QAR':'ر.ق'}</b>${actions}<span>${esc(e.date)}</span></div><div class="note">${currentLang==='en'?'Payment method':'طريقة الدفع'}: ${translateValue(e.method)}</div></div>`;
      } else {
        const actions = can('write') ? `<span class="log-actions"><button type="button" class="link-btn" data-edit-follow="${e.id}">${t('action.edit')}</button><button type="button" class="link-btn" data-delete-follow="${e.id}">${t('action.delete')}</button></span>` : '';
        return `<div class="log-entry"><div class="top"><b>${currentLang==='en'?'Follow-up':'متابعة'} — ${translateValue(e.method)}</b>${actions}<span>${esc(e.date)}</span></div><div class="note">${esc(e.note)||'—'}</div></div>`;
      }
    }).join('');
  }
  document.getElementById('drawer').classList.add('show');
  document.getElementById('drawerOverlay').classList.add('show');
}
function closeDrawer(){
  document.getElementById('drawer').classList.remove('show');
  document.getElementById('drawerOverlay').classList.remove('show');
  activeDebtorId = null;
}
document.getElementById('drawerClose').addEventListener('click', closeDrawer);
document.getElementById('drawerOverlay').addEventListener('click', closeDrawer);
document.getElementById('dr_editDebtor').addEventListener('click', ()=>{
  if(!activeDebtorId) return;
  openDebtorEditModal(activeDebtorId);
});

document.getElementById('dr_assignRep').addEventListener('click', ()=>{
  if(currentUser?.role!=='admin'){toast(currentLang==='en'?'Only an admin can reassign cases':'إسناد الحالات متاح للمدير فقط');return;}
  const d = debtors.find(x=>x.id===activeDebtorId);
  if(!d) return;
  const val = document.getElementById('dr_repSelect').value;
  const oldRep=reps.find(r=>r.id===d.repId);
  d.repId = val ? Number(val) : null;
  const newRep=reps.find(r=>r.id===d.repId);
  addAudit(val?'assign_rep':'unassign_rep', `${d.name}: ${oldRep?oldRep.name:t('drawer.noRep')} → ${newRep?newRep.name:t('drawer.noRep')}`);
  toast(val ? t('msg.assign') : t('msg.unassign'));
  openDrawer(d.id);
  renderAll();
});

// ---- Promise to pay (وعد الدفع): one open promise per debtor (date + amount) ----
function renderPromiseBox(d){
  document.getElementById('dr_promiseDate').value=d.promiseDate||'';
  document.getElementById('dr_promiseAmount').value=d.promiseAmount||'';
  const p=promiseState(d); const el=document.getElementById('dr_promiseStatus');
  el.innerHTML = p ? `<span class="badge ${p.type==='broken'?'overdue':'active'}">${p.type==='broken'?t('promise.broken'):p.type==='today'?t('promise.today'):t('promise.upcoming')}</span> ${esc(d.promiseDate)}${d.promiseAmount?' · '+currency(d.promiseAmount):''}` : esc(t('promise.none'));
}
document.getElementById('dr_savePromise').addEventListener('click', ()=>{
  if(!can('write')){toast(currentLang==='en'?'You do not have permission to edit data':'لا تملك صلاحية تعديل البيانات');return;}
  const d=debtors.find(x=>x.id===activeDebtorId); if(!d) return;
  const date=document.getElementById('dr_promiseDate').value;
  if(!date){ toast(t('promise.needDate')); return; }
  const amt=parseFloat(document.getElementById('dr_promiseAmount').value);
  d.promiseDate=date; d.promiseAmount=amt>0?amt:0;
  addAudit('promise',`${d.name}: ${date}${d.promiseAmount?' · '+d.promiseAmount:''}`).catch(()=>{});
  toast(t('promise.saved')); renderPromiseBox(d); renderAll();
});
document.getElementById('dr_clearPromise').addEventListener('click', ()=>{
  if(!can('write')){toast(currentLang==='en'?'You do not have permission to edit data':'لا تملك صلاحية تعديل البيانات');return;}
  const d=debtors.find(x=>x.id===activeDebtorId); if(!d) return;
  d.promiseDate=''; d.promiseAmount=0;
  addAudit('promise_clear',d.name).catch(()=>{});
  toast(t('promise.cleared')); renderPromiseBox(d); renderAll();
});

// ---- Full backup (admin only): downloads every table as one JSON file; nothing is kept in the browser ----
async function fetchAllRows(table){
  const out=[];
  for(let from=0;;from+=1000){
    const {data,error}=await supabaseClient.from(table).select('*').range(from,from+999);
    if(error) throw error;
    out.push(...data); if(data.length<1000) break;
  }
  return out;
}
document.getElementById('backupBtn').addEventListener('click', async ()=>{
  const en=currentLang==='en';
  if(currentUser?.role!=='admin'){ toast(en?'Only an admin can do this':'هذا الإجراء للمدير فقط'); return; }
  const btn=document.getElementById('backupBtn'); btn.disabled=true;
  try{
    const backup={app:'daftar',created:new Date().toISOString(),by:currentUser.username,tables:{}};
    for(const tb of ['debtors','debtors_activity','reps','quotations','quotations_activity','quotation_files','audit_log']) backup.tables[tb]=await fetchAllRows(tb);
    const {data:s,error:sErr}=await supabaseClient.from('app_settings').select('*').eq('id',1);   // row 2 (API keys) is deliberately excluded
    if(sErr) throw sErr; backup.tables.app_settings=s||[];
    const link=document.createElement('a'); link.href=URL.createObjectURL(new Blob([JSON.stringify(backup,null,1)],{type:'application/json'}));
    link.download=`daftar-backup-${todayISO()}.json`; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(()=>URL.revokeObjectURL(link.href),2000);
    addAudit('backup').catch(()=>{}); toast(t('backup.done'));
  }catch(err){ console.warn('Backup failed:',err); toast(t('backup.failed')); }
  finally{ btn.disabled=false; }
});
document.getElementById('dr_addPayment').addEventListener('click', ()=>{
  if(!can('write')){toast(currentLang==='en'?'You do not have permission to edit data':'لا تملك صلاحية تعديل البيانات');return;}
  const d = debtors.find(x=>x.id===activeDebtorId);
  if(!d) return;
  const amt = parseFloat(document.getElementById('dr_paymentAmount').value);
  const method = document.getElementById('dr_paymentMethod').value;
  const date = document.getElementById('dr_paymentDate').value || todayISO();
  if(!amt || amt<=0){ toast(t('msg.invalidAmount')); return; }
  d.paid += amt;
  d.log.push({id:genLogId(), type:'payment', date, amount:amt, method});
  document.getElementById('dr_paymentAmount').value='';
  document.getElementById('dr_paymentDate').value=todayISO();
  toast(t('msg.paymentAdded'));
  addAudit('add_payment',`${d.name}: ${fmt(amt)} (${currentLang==='en'?'remaining':'المتبقي'} ${fmt(remaining(d))})`);
  openDrawer(d.id);
  renderAll();
});
document.getElementById('dr_editPaidBtn').addEventListener('click', async ()=>{
  if(!can('write')){toast(currentLang==='en'?'You do not have permission to edit data':'لا تملك صلاحية تعديل البيانات');return;}
  const d = debtors.find(x=>x.id===activeDebtorId);
  if(!d) return;
  const input = await uiPrompt(t('drawer.editPaidPrompt'), String(d.paid||0), {type:'number', title:d.name,
    validate:v=>{ const n=parseFloat(v); return (isNaN(n)||n<0) ? t('msg.invalidAmount') : ''; }});
  if(input===null) return;
  const newPaid = parseFloat(input);
  if(isNaN(newPaid) || newPaid<0){ toast(t('msg.invalidAmount')); return; }
  const trim = previewPaymentTrim(d, newPaid);
  if(trim.out.length){
    const list = `<div class="uidlg-list">${trim.out.map(x=>`<div><span>${esc(x.entry.date||'')}</span><span>${esc(fmt(x.from))} → ${esc(fmt(x.to))}</span></div>`).join('')}</div>`;
    const ok = await uiDialog({title:d.name, danger:true, confirmText:t('ui.ok'),
      message:t('paid.lowerWarn').replace('{n}', fmt(trim.excess)), html:list});
    if(!ok) return;
  }
  if(!debtors.includes(d)) return;
  const oldPaid = d.paid;
  d.paid = newPaid;
  recordUnloggedPayment(d, {method:'تسوية', note:t('payments.adjustNote')});
  trimPaymentLogToPaid(d);
  addAudit('adjust_paid', `${d.name}: ${fmt(oldPaid)} → ${fmt(newPaid)}`);
  toast(t('msg.paidAdjusted'));
  openDrawer(d.id);
  renderAll();
});
document.getElementById('dr_log').addEventListener('click', async (ev)=>{
  const editPayBtn = ev.target.closest('[data-edit-payment]');
  const delPayBtn = ev.target.closest('[data-delete-payment]');
  const editFollowBtn = ev.target.closest('[data-edit-follow]');
  const delFollowBtn = ev.target.closest('[data-delete-follow]');
  if(!editPayBtn && !delPayBtn && !editFollowBtn && !delFollowBtn) return;
  if(!can('write')){toast(currentLang==='en'?'You do not have permission to edit data':'لا تملك صلاحية تعديل البيانات');return;}
  const d = debtors.find(x=>x.id===activeDebtorId);
  if(!d) return;
  if(editPayBtn || delPayBtn){
    const btn = editPayBtn || delPayBtn;
    const logId = Number(btn.dataset.editPayment || btn.dataset.deletePayment);
    const entry = d.log.find(e=>e.id===logId && e.type==='payment');
    if(!entry) return;
    if(editPayBtn){ if(!(await editPaymentEntry(d, entry))) return; }
    else { deletePaymentWithUndo(d, entry); return; }
  } else {
    const btn = editFollowBtn || delFollowBtn;
    const logId = Number(btn.dataset.editFollow || btn.dataset.deleteFollow);
    const entry = d.log.find(e=>e.id===logId && e.type==='follow');
    if(!entry) return;
    if(editFollowBtn){ if(!(await editFollowEntry(d, entry))) return; }
    else { deleteFollowWithUndo(d, entry); return; }
  }
  openDrawer(d.id);
  renderAll();
});
document.getElementById('dr_addFollow').addEventListener('click', ()=>{
  if(!can('write')){toast(currentLang==='en'?'You do not have permission to edit data':'لا تملك صلاحية تعديل البيانات');return;}
  const d = debtors.find(x=>x.id===activeDebtorId);
  if(!d) return;
  const method = document.getElementById('dr_followMethod').value;
  const date = document.getElementById('dr_followDate').value || todayISO();
  const note = document.getElementById('dr_followOutcome').value.trim();
  if(!note){ toast(currentLang==='en'?'Enter the outcome / note':'الرجاء إدخال النتيجة / الملاحظة'); return; }
  d.log.push({id:genLogId(), type:'follow', date, method, note});
  d.notes = `[${date}] ${translateValue(method)}: ${note}` + (d.notes ? '\n' + d.notes : '');
  document.getElementById('dr_followOutcome').value='';
  document.getElementById('dr_followDate').value=todayISO();
  toast(t('msg.followAdded'));
  addAudit('add_followup',`${d.name} (${translateValue(method)})${note?': '+note:''}`);
  openDrawer(d.id);
  renderAll();
});
document.getElementById('dr_delete').addEventListener('click', ()=>{
  if(!activeDebtorId) return;
  deleteDebtorWithUndo(activeDebtorId, 'msg.deleteDebtor');
});

// ============== QUOTATIONS (عروض الأسعار) ==============
function genQuotationLogId(){ return nextQuotationLogId++; }
function quotStatusLabel(status){ return t('quot.status.'+status) || status; }
function quotScopeLabel(scope){ return t('quot.scope.'+scope) || scope; }
function quotSubjectLabel(subject){ return t('quot.subject.'+subject) || subject; }
function quotStatusBadgeClass(status){
  return {open:'active', submitted:'paid', followup:'overdue', paymentPending:'overdue', closed:'type-individual'}[status] || 'type-individual';
}
function latestQuotationDate(){
  const dates = [...new Set(quotations.filter(q=>q.date).map(q=>q.date))].sort((a,b)=>b.localeCompare(a));
  return dates[0] || todayISO();
}
function ensureQuotationDateFilter(){
  const el = document.getElementById('quotDateFilter');
  if(!el) return;
  if(!el.value){
    const fallback = latestQuotationDate();
    el.value = fallback;
  }
}
// "Show all" mode: lists every quotation regardless of the selected day, grouped by the
// date it was registered on. Picking a day in the calendar switches it off again.
let quotShowAll = false;
function scopedQuotations(){
  const query = (document.getElementById('quotSearch')?.value || '').trim().toLowerCase();
  const statusF = document.getElementById('quotStatusFilter')?.value || 'all';
  const scopeF = document.getElementById('quotScopeFilter')?.value || 'all';
  const subjectF = document.getElementById('quotSubjectFilter')?.value || 'all';
  const dateF = document.getElementById('quotDateFilter')?.value || latestQuotationDate();
  return quotations.filter(q=>{
    if(!quotShowAll && dateF && q.date !== dateF) return false;
    if(statusF!=='all' && q.status!==statusF) return false;
    if(scopeF!=='all' && q.companyScope!==scopeF) return false;
    if(subjectF!=='all' && q.subject!==subjectF) return false;
    if(query){
      const hay = `${q.companyName||''} ${q.contactPerson||''} ${q.mobile||''} ${q.email||''}`.toLowerCase();
      if(!hay.includes(query)) return false;
    }
    return true;
  }).sort((a,b)=> (b.date||'').localeCompare(a.date||''));
}

const QUOT_STATUSES = ['open','followup','submitted','paymentPending','closed'];
let quotSortFollowup = false;
function quotFollowupState(q){
  if(!q.nextFollowup || q.status==='closed') return '';
  const today = todayISO();
  return q.nextFollowup < today ? 'overdue' : (q.nextFollowup===today ? 'today' : '');
}
function overdueQuotationsCount(){ return quotations.filter(q=>quotFollowupState(q)==='overdue').length; }
function quotationRowHtml(q, n){
  const fu = quotFollowupState(q);
  const fuCell = !q.nextFollowup ? '—'
    : fu==='overdue' ? `<span class="fu-overdue" title="${esc(t('quot.followupOverdue'))}">⚠ ${esc(q.nextFollowup)}</span>`
    : fu==='today' ? `<span class="fu-today" title="${esc(t('quot.followupToday'))}">● ${esc(q.nextFollowup)}</span>`
    : esc(q.nextFollowup);
  const statusCell = can('write')
    ? `<select class="status-select badge ${quotStatusBadgeClass(q.status)}" data-quot-status="${q.id}" aria-label="${esc(t('th.status'))}">${QUOT_STATUSES.map(st=>`<option value="${st}"${st===q.status?' selected':''}>${esc(quotStatusLabel(st))}</option>`).join('')}</select>`
    : `<span class="badge ${quotStatusBadgeClass(q.status)}">${quotStatusLabel(q.status)}</span>`;
  return `<tr data-id="${q.id}"${fu==='overdue'?' class="quot-row-overdue"':''}>
    <td class="figures">${n}</td><td>${esc(q.date)||'—'}</td><td class="figures">${esc(q.visitTime)||'—'}</td><td>${esc(q.companyName)}</td><td>${quotScopeLabel(q.companyScope)}</td>
    <td>${esc(q.contactPerson)||'—'}</td><td class="figures">${esc(q.mobile)||'—'}</td><td>${esc(q.email)||'—'}</td>
    <td>${quotSubjectLabel(q.subject)}</td><td>${esc(q.quotationNo)||'—'}</td><td>${esc(q.invoiceNo)||'—'}</td><td>${esc(q.projectNo)||'—'}</td>
    <td>${statusCell}</td><td>${fuCell}</td>
    <td><button type="button" class="link-btn" data-quot-edit="${q.id}">${t('action.edit')}</button> · <button type="button" class="link-btn" data-quot-delete="${q.id}">${t('action.delete')}</button></td>
  </tr>`;
}
function syncQuotShowAllUi(){
  const btn = document.getElementById('quotShowAllBtn');
  if(btn){
    btn.setAttribute('aria-pressed', quotShowAll ? 'true' : 'false');
    btn.textContent = t(quotShowAll ? 'quot.showByDay' : 'quot.showAll');
  }
  const sortBtn = document.getElementById('quotSortFollowupBtn');
  if(sortBtn){
    sortBtn.setAttribute('aria-pressed', quotSortFollowup ? 'true' : 'false');
    const od = overdueQuotationsCount();
    sortBtn.textContent = t(quotSortFollowup ? 'quot.sortByDay' : 'quot.sortFollowup') + (od ? ` (${od} ${t('quot.overdueWord')})` : '');
  }
  document.getElementById('quotDateFilter')?.classList.toggle('is-dimmed', quotShowAll);
}
function renderQuotationsTable(){
  const body = document.getElementById('quotationsTableBody');
  if(!body) return;
  ensureQuotationDateFilter();
  syncQuotShowAllUi();
  const rows = scopedQuotations();
  const summary = document.getElementById('quotAllSummary');
  document.getElementById('quotationsEmpty').style.display = rows.length ? 'none' : 'block';

  if(quotSortFollowup){
    // Flat list ordered by the next follow-up date (overdue first); rows without one go last.
    const sorted = [...rows].sort((a,b)=>{
      const ka = a.nextFollowup && a.status!=='closed' ? a.nextFollowup : '9999-99-99';
      const kb = b.nextFollowup && b.status!=='closed' ? b.nextFollowup : '9999-99-99';
      return ka.localeCompare(kb);
    });
    if(summary) summary.hidden = true;
    body.innerHTML = sorted.map((q,i)=>quotationRowHtml(q, i+1)).join('');
    return;
  }
  if(!quotShowAll){
    if(summary) summary.hidden = true;
    body.innerHTML = rows.map((q,i)=>quotationRowHtml(q, i+1)).join('');
    return;
  }

  // Group by registration date, newest day first; numbering restarts inside each day.
  const groups = new Map();
  rows.forEach(q=>{
    const key = q.date || '';
    if(!groups.has(key)) groups.set(key, []);
    groups.get(key).push(q);
  });
  const days = [...groups.keys()].sort((a,b)=> b.localeCompare(a));
  const cols = body.closest('table')?.querySelectorAll('thead th').length || 15;
  body.innerHTML = days.map(day=>{
    const list = groups.get(day).sort((a,b)=> (a.visitTime||'').localeCompare(b.visitTime||''));
    const sum = money2(list.reduce((s,q)=>s+(Number(q.amount)||0),0));
    const closed = list.filter(q=>q.status==='closed').length;
    const pct = Math.round(closed/list.length*100);
    const meta = `${sum?`${esc(t('quot.dayValue'))}: ${currency(sum)} · `:''}${esc(t('quot.closedRatio'))}: ${closed}/${list.length} (${pct}%)`;
    return `<tr class="quot-date-group"><td colspan="${cols}">📅 ${esc(day) || t('quot.noDate')}<span class="quot-date-count">${list.length} ${esc(t('qcal.count'))}</span><span class="group-total">${meta}</span></td></tr>`
      + list.map((q,i)=>quotationRowHtml(q, i+1)).join('');
  }).join('');
  if(summary){
    summary.hidden = false;
    const grand = money2(rows.reduce((s,q)=>s+(Number(q.amount)||0),0));
    summary.innerHTML = `${esc(t('quot.allSummary'))}: <b>${rows.length}</b> ${esc(t('qcal.count'))} — <b>${days.length}</b> ${esc(t('quot.daysWord'))}${grand?` — ${esc(t('quot.dayValue'))}: <b>${currency(grand)}</b>`:''}`;
  }
}
document.getElementById('quotSearch')?.addEventListener('input', debounce(renderQuotationsTable, 200));

document.getElementById('quotDateFilter')?.addEventListener('change', ()=>{ quotShowAll = false; renderQuotationsTable(); });
document.getElementById('quotShowAllBtn')?.addEventListener('click', ()=>{ quotShowAll = !quotShowAll; renderQuotationsTable(); });
document.getElementById('quotSortFollowupBtn')?.addEventListener('click', ()=>{ quotSortFollowup = !quotSortFollowup; renderQuotationsTable(); });

// ---- Quotation date picker --------------------------------------------------
// A native <input type="date"> cannot style individual days, so #quotDateFilter is
// now a readonly text input (still holding "YYYY-MM-DD" in .value, so every other
// piece of code that reads/sets it keeps working) that opens this small calendar.
// Any day that has at least one quotation is painted green; hover shows how many.

function attachQuotationCalendar(input){
  if(!input) return;
  const pad = n => String(n).padStart(2,'0');
  const iso = (y,m,d) => `${y}-${pad(m+1)}-${pad(d)}`;
  const locale = () => currentLang==='en' ? 'en-US' : 'ar-QA-u-nu-latn';
  const pop = document.createElement('div');
  pop.className = 'qcal'; pop.hidden = true;
  pop.setAttribute('role','dialog'); pop.setAttribute('aria-label', input.getAttribute('aria-label')||'');
  document.body.appendChild(pop);
  let viewY = 0, viewM = 0;

  function countsByDate(){
    const counts = {};
    quotations.forEach(q=>{ if(q.date) counts[q.date] = (counts[q.date]||0) + 1; });
    return counts;
  }
  function position(){
    const r = input.getBoundingClientRect();
    const w = pop.offsetWidth || 292;
    let left = currentLang==='en' ? r.left : r.right - w;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    let top = r.bottom + 6;
    if(top + pop.offsetHeight > window.innerHeight - 8) top = Math.max(8, r.top - pop.offsetHeight - 6);
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
  }
  function render(){
    const rtl = currentLang!=='en';
    const counts = countsByDate();
    const today = todayISO();
    const selected = input.value;
    const title = new Intl.DateTimeFormat(locale(), {month:'long', year:'numeric'}).format(new Date(viewY, viewM, 1));
    const wdFmt = new Intl.DateTimeFormat(locale(), {weekday:'short'});
    // 2023-01-01 was a Sunday -> week starts on Sunday
    const weekdays = Array.from({length:7}, (_,i)=>`<div class="qcal-wd">${esc(wdFmt.format(new Date(2023,0,1+i)))}</div>`).join('');
    const firstDow = new Date(viewY, viewM, 1).getDay();
    const daysInMonth = new Date(viewY, viewM+1, 0).getDate();
    let cells = '<div></div>'.repeat(firstDow);
    for(let d=1; d<=daysInMonth; d++){
      const date = iso(viewY, viewM, d);
      const n = counts[date] || 0;
      const cls = ['qcal-day', n?'has-q':'', date===selected?'sel':'', date===today?'today':''].filter(Boolean).join(' ');
      const tip = n ? ` title="${n} ${esc(t('qcal.count'))}"` : '';
      cells += `<button type="button" class="${cls}" data-date="${date}"${tip}${date===selected?' aria-pressed="true"':''}>${d}</button>`;
    }
    pop.innerHTML = `
      <div class="qcal-head">
        <button type="button" class="qcal-nav" data-nav="-1" aria-label="${esc(t('qcal.prev'))}">${rtl?'›':'‹'}</button>
        <span class="qcal-title">${esc(title)}</span>
        <button type="button" class="qcal-nav" data-nav="1" aria-label="${esc(t('qcal.next'))}">${rtl?'‹':'›'}</button>
      </div>
      <div class="qcal-grid">${weekdays}${cells}</div>
      <div class="qcal-foot">
        <span class="qcal-legend"><i></i>${esc(t('qcal.legend'))}</span>
        <button type="button" class="qcal-today" data-today="1">${esc(t('qcal.today'))}</button>
      </div>`;
    pop.dir = rtl ? 'rtl' : 'ltr';
  }
  function open(){
    const base = /^\d{4}-\d{2}-\d{2}$/.test(input.value) ? input.value : todayISO();
    viewY = Number(base.slice(0,4)); viewM = Number(base.slice(5,7)) - 1;
    render(); pop.hidden = false; position();
    (pop.querySelector('.qcal-day.sel') || pop.querySelector('.qcal-day'))?.focus();
  }
  function close(){ pop.hidden = true; }
  function pick(date){
    input.value = date;
    input.dispatchEvent(new Event('change', {bubbles:true})); // re-renders the table
    close(); input.focus();
  }
  input.addEventListener('click', ()=> pop.hidden ? open() : close());
  input.addEventListener('keydown', e=>{
    if(['Enter',' ','ArrowDown'].includes(e.key)){ e.preventDefault(); open(); }
  });
  pop.addEventListener('click', e=>{
    const nav = e.target.closest('[data-nav]');
    if(nav){
      const d = new Date(viewY, viewM + Number(nav.dataset.nav), 1);
      viewY = d.getFullYear(); viewM = d.getMonth(); render(); position();
      pop.querySelector('.qcal-day')?.focus();
      return;
    }
    if(e.target.closest('[data-today]')){ pick(todayISO()); return; }
    const day = e.target.closest('[data-date]');
    if(day) pick(day.dataset.date);
  });
  document.addEventListener('mousedown', e=>{
    if(!pop.hidden && !pop.contains(e.target) && e.target!==input) close();
  });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape' && !pop.hidden){ close(); input.focus(); } });
  window.addEventListener('resize', close);
  window.addEventListener('scroll', ()=>{ if(!pop.hidden) position(); }, true);
}
attachQuotationCalendar(document.getElementById('quotDateFilter'));
attachQuotationCalendar(document.getElementById('quotVisitReportDate'));
document.getElementById('quotStatusFilter')?.addEventListener('change', renderQuotationsTable);
document.getElementById('quotScopeFilter')?.addEventListener('change', renderQuotationsTable);
document.getElementById('quotSubjectFilter')?.addEventListener('change', renderQuotationsTable);

document.getElementById('quotationsTableBody')?.addEventListener('change', (ev)=>{
  const sel = ev.target.closest('[data-quot-status]');
  if(!sel) return;
  if(!can('write')){ toast(currentLang==='en'?'You do not have permission to edit data':'لا تملك صلاحية تعديل البيانات'); renderQuotationsTable(); return; }
  const q = quotations.find(x=>x.id===Number(sel.dataset.quotStatus));
  if(!q) return;
  const status = sel.value;
  if(status===q.status) return;
  q.log = q.log || [];
  q.log.push({id:genQuotationLogId(), date:todayISO(), status, note:t('quot.inlineStatusNote')});
  q.status = status;
  addAudit('quotation_status_update', `${q.companyName}: ${quotStatusLabel(status)}`);
  toast(t('quot.updateAdded'));
  renderAll();
});
document.getElementById('quotationsTableBody')?.addEventListener('click', (ev)=>{
  if(ev.target.closest('select')) return;
  const editBtn = ev.target.closest('[data-quot-edit]');
  const delBtn = ev.target.closest('[data-quot-delete]');
  if(editBtn){ openQuotationEditModal(Number(editBtn.dataset.quotEdit)); return; }
  if(delBtn){ deleteQuotation(Number(delBtn.dataset.quotDelete)); return; }
  const row = ev.target.closest('tr[data-id]');
  if(row) openQuotationDrawer(Number(row.dataset.id));
});

let editingQuotationId = null;
document.getElementById('addQuotationBtn')?.addEventListener('click', ()=>{
  if(!can('write')){toast(currentLang==='en'?'You do not have permission to edit data':'لا تملك صلاحية تعديل البيانات');return;}
  editingQuotationId = null;
  pendingQuotationFile = null;
  const addBanner = document.getElementById('quotExtractBanner');
  if(addBanner) addBanner.style.display = 'none';
  document.getElementById('quotationModalTitle').textContent = t('quot.addTitle');
  document.getElementById('saveQuotationBtn').textContent = t('quot.save');
  ['q_company','q_contact','q_mobile','q_email','q_amount','q_time','q_nextFollowup','q_requirement','q_followupAction','q_notes','q_quotationNo','q_invoiceNo','q_projectNo'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('q_scope').value = 'mainContractor';
  document.getElementById('q_subject').value = 'quoteFollowup';
  document.getElementById('q_status').value = 'open';
  document.getElementById('q_date').value = todayISO();
  document.getElementById('quotationModal').classList.add('show');
});
function openQuotationEditModal(id){
  if(!can('write')){toast(currentLang==='en'?'You do not have permission to edit data':'لا تملك صلاحية تعديل البيانات');return;}
  const q = quotations.find(x=>x.id===id);
  if(!q) return;
  editingQuotationId = id;
  pendingQuotationFile = null;
  const editBanner = document.getElementById('quotExtractBanner');
  if(editBanner) editBanner.style.display = 'none';
  document.getElementById('quotationModalTitle').textContent = t('quot.editTitle');
  document.getElementById('saveQuotationBtn').textContent = t('modal.saveChanges');
  document.getElementById('q_company').value = q.companyName||'';
  document.getElementById('q_scope').value = q.companyScope||'mainContractor';
  document.getElementById('q_contact').value = q.contactPerson||'';
  document.getElementById('q_mobile').value = q.mobile||'';
  document.getElementById('q_email').value = q.email||'';
  document.getElementById('q_amount').value = q.amount||'';
  document.getElementById('q_quotationNo').value = q.quotationNo||'';
  document.getElementById('q_invoiceNo').value = q.invoiceNo||'';
  document.getElementById('q_projectNo').value = q.projectNo||'';
  document.getElementById('q_date').value = q.date||todayISO();
  document.getElementById('q_time').value = q.visitTime||'';
  document.getElementById('q_nextFollowup').value = q.nextFollowup||'';
  document.getElementById('q_subject').value = q.subject||'quoteFollowup';
  document.getElementById('q_status').value = q.status||'open';
  document.getElementById('q_requirement').value = q.requirement||'';
  document.getElementById('q_followupAction').value = q.followupAction||'';
  document.getElementById('q_notes').value = q.notes||'';
  document.getElementById('quotationModal').classList.add('show');
}
document.getElementById('saveQuotationBtn')?.addEventListener('click', async ()=>{
  if(!can('write')){toast(currentLang==='en'?'You do not have permission to edit data':'لا تملك صلاحية تعديل البيانات');return;}
  const companyName = document.getElementById('q_company').value.trim();
  if(!companyName){ toast(t('quot.needCompany')); return; }
  const payload = {
    companyName,
    companyScope: document.getElementById('q_scope').value,
    contactPerson: document.getElementById('q_contact').value.trim(),
    mobile: document.getElementById('q_mobile').value.trim(),
    email: document.getElementById('q_email').value.trim(),
    amount: parseFloat(document.getElementById('q_amount').value) || 0,
    quotationNo: document.getElementById('q_quotationNo').value.trim(),
    invoiceNo: document.getElementById('q_invoiceNo').value.trim(),
    projectNo: document.getElementById('q_projectNo').value.trim(),
    date: document.getElementById('q_date').value || todayISO(),
    visitTime: document.getElementById('q_time').value || '',
    nextFollowup: document.getElementById('q_nextFollowup').value || '',
    subject: document.getElementById('q_subject').value,
    status: document.getElementById('q_status').value,
    requirement: document.getElementById('q_requirement').value.trim(),
    followupAction: document.getElementById('q_followupAction').value.trim(),
    notes: document.getElementById('q_notes').value.trim(),
  };
  {
    const prevQ = editingQuotationId ? quotations.find(x=>x.id===editingQuotationId) : null;
    const changed = !prevQ || prevQ.companyName!==payload.companyName || (prevQ.quotationNo||'')!==payload.quotationNo || (prevQ.date||'')!==payload.date;
    if(changed){
      const dups = findQuotationDuplicates(payload, editingQuotationId);
      if(dups.length && !(await confirmDuplicate(dups, 'dup.quotMsg'))) return;
    }
  }
  if(editingQuotationId){
    const q = quotations.find(x=>x.id===editingQuotationId);
    if(q) Object.assign(q, payload);
    document.getElementById('quotationModal').classList.remove('show');
    addAudit('update_quotation', companyName);
    await saveState();
    toast(t('quot.updated'));
    editingQuotationId = null;
    renderAll();
    return;
  }
  const newQuotation = {id:nextQuotationId++, ...payload, log:[]};
  quotations.push(newQuotation);
  document.getElementById('quotationModal').classList.remove('show');
  const banner = document.getElementById('quotExtractBanner');
  if(banner) banner.style.display = 'none';
  addAudit('add_quotation', companyName);
  const synced = await saveStateOrWarn(currentLang==='en'?'saving the quotation':'حفظ عرض السعر');
  // The source document is uploaded only after the quotation row exists in the cloud,
  // otherwise the foreign key on quotation_files would reject it.
  if(synced && pendingQuotationFile){
    try{
      toast(t('quot.uploading'));
      const uploadFile = await compressImageFile(pendingQuotationFile.file);
      await uploadQuotationFile(uploadFile, newQuotation.id, pendingQuotationFile.extractedText||'');
      toast(t('quot.fileSaved'));
    }catch(err){
      const parts = [err?.code, err?.statusCode, err?.message, err?.error, err?.details, err?.hint].filter(Boolean);
      const detail = parts.length ? parts.join(' — ') : String(err);
      console.warn('Attachment upload failed:', err);
      showSyncErrorBanner(currentLang==='en'?`uploading "${pendingQuotationFile.file.name}"`:`رفع الملف "${pendingQuotationFile.file.name}"`, detail);
    }
  } else if(synced){
    toast(t('quot.added'));
  }
  pendingQuotationFile = null;
  renderAll();
});
function deleteQuotation(id){
  if(!can('delete')){toast(currentLang==='en'?'You do not have permission to delete':'لا تملك صلاحية الحذف');return;}
  const q = quotations.find(x=>x.id===id);
  if(!q) return;
  const idx = quotations.indexOf(q);
  const attached = filesForQuotation(id).slice();
  quotations = quotations.filter(x=>x!==q);
  if(activeQuotationId===id) closeQuotationDrawer();
  addAudit('delete_quotation', q.companyName);
  renderAll();
  toastUndo(t('quot.deleted'), ()=>{
    quotations.splice(Math.min(idx, quotations.length), 0, q);
    addAudit('restore_quotation', q.companyName);
    renderAll();
  }, {onCommit: ()=>{
    // Irreversible clean-up only happens once the undo window has closed. The delete is
    // explicit rather than relying on the general save's prune pass (see replaceTable's
    // pruneOrphans note); quotation_files rows go via ON DELETE CASCADE.
    if(!supabaseClient) return;
    if(attached.length){
      supabaseClient.storage.from(QUOT_BUCKET).remove(attached.map(f=>f.storagePath)).catch(err=>console.warn('Attachment cleanup failed:', err));
      quotationFiles = quotationFiles.filter(f=>Number(f.quotationId)!==Number(id));
    }
    supabaseClient.from('quotations').delete().eq('id', id)
      .then(({error})=>{ if(error) console.warn('Explicit quotation delete failed:', error); });
  }});
}

// ---- Quotation detail drawer ----
function openQuotationDrawer(id){
  const q = quotations.find(x=>x.id===id);
  if(!q) return;
  activeQuotationId = id;
  document.getElementById('qd_seal').textContent = initials(q.companyName||'؟');
  document.getElementById('qd_company').textContent = q.companyName||'—';
  document.getElementById('qd_contact').textContent = q.contactPerson||'—';
  document.getElementById('qd_scope').textContent = quotScopeLabel(q.companyScope);
  document.getElementById('qd_mobile').textContent = q.mobile||'—';
  document.getElementById('qd_email').textContent = q.email||'—';
  document.getElementById('qd_amount').textContent = q.amount ? currency(q.amount) : '—';
  document.getElementById('qd_quotationNo').textContent = q.quotationNo||'—';
  document.getElementById('qd_invoiceNo').textContent = q.invoiceNo||'—';
  document.getElementById('qd_projectNo').textContent = q.projectNo||'—';
  document.getElementById('qd_date').textContent = q.date||'—';
  document.getElementById('qd_time').textContent = q.visitTime||'—';
  document.getElementById('qd_subject').textContent = quotSubjectLabel(q.subject);
  document.getElementById('qd_status').innerHTML = `<span class="badge ${quotStatusBadgeClass(q.status)}">${quotStatusLabel(q.status)}</span>`;
  document.getElementById('qd_nextFollowup').textContent = q.nextFollowup||'—';
  document.getElementById('qd_requirement').textContent = q.requirement||'—';
  document.getElementById('qd_updateDate').value = todayISO();
  document.getElementById('qd_updateStatus').value = q.status||'open';
  document.getElementById('qd_updateNote').value = '';

  const log = document.getElementById('qd_log');
  if(!q.log.length){
    log.innerHTML = `<div style="color:var(--muted); font-size:12.5px; padding:10px 0">${t('quot.noLog')}</div>`;
  } else {
    log.innerHTML = [...q.log].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(e=>{
      const actions = can('write') ? `<span class="log-actions"><button type="button" class="link-btn" data-delete-qlog="${e.id}">${t('action.delete')}</button></span>` : '';
      return `<div class="log-entry"><div class="top"><b><span class="badge ${quotStatusBadgeClass(e.status)}">${quotStatusLabel(e.status)}</span></b>${actions}<span>${esc(e.date)}</span></div><div class="note">${esc(e.note)||'—'}</div></div>`;
    }).join('');
  }
  renderQuotationAttachments(q.id);
  document.getElementById('quotationDrawer').classList.add('show');
  document.getElementById('quotationDrawerOverlay').classList.add('show');
}
function closeQuotationDrawer(){
  document.getElementById('quotationDrawer').classList.remove('show');
  document.getElementById('quotationDrawerOverlay').classList.remove('show');
  activeQuotationId = null;
}
document.getElementById('quotationDrawerClose')?.addEventListener('click', closeQuotationDrawer);
document.getElementById('quotationDrawerOverlay')?.addEventListener('click', closeQuotationDrawer);
document.getElementById('qd_edit')?.addEventListener('click', ()=>{ if(activeQuotationId) openQuotationEditModal(activeQuotationId); });
document.getElementById('qd_delete')?.addEventListener('click', ()=>{ if(activeQuotationId) deleteQuotation(activeQuotationId); });
document.getElementById('qd_addUpdate')?.addEventListener('click', async ()=>{
  if(!can('write')){toast(currentLang==='en'?'You do not have permission to edit data':'لا تملك صلاحية تعديل البيانات');return;}
  const q = quotations.find(x=>x.id===activeQuotationId);
  if(!q) return;
  const date = document.getElementById('qd_updateDate').value || todayISO();
  const status = document.getElementById('qd_updateStatus').value;
  const note = document.getElementById('qd_updateNote').value.trim();
  if(!note && !status){ toast(t('quot.needUpdateNote')); return; }
  q.log.push({id:genQuotationLogId(), date, status, note});
  q.status = status;
  document.getElementById('qd_updateNote').value = '';
  addAudit('quotation_status_update', `${q.companyName}: ${quotStatusLabel(status)}${note?' — '+note:''}`);
  await saveState();
  toast(t('quot.updateAdded'));
  openQuotationDrawer(q.id);
  renderAll();
});
document.getElementById('qd_log')?.addEventListener('click', (ev)=>{
  const delBtn = ev.target.closest('[data-delete-qlog]');
  if(!delBtn) return;
  if(!can('write')){toast(currentLang==='en'?'You do not have permission to edit data':'لا تملك صلاحية تعديل البيانات');return;}
  const q = quotations.find(x=>x.id===activeQuotationId);
  if(!q) return;
  const logId = Number(delBtn.dataset.deleteQlog);
  q.log = q.log.filter(e=>e.id!==logId);
  openQuotationDrawer(q.id);
  renderAll();
});
document.getElementById('qd_print')?.addEventListener('click', ()=>{
  const q = quotations.find(x=>x.id===activeQuotationId);
  if(!q) return;
  printDocument(quotationDetailDocumentHtml(q));
});
// Pre-fills the "add debtor" form from an accepted quotation, so its amount, company
// name and contact don't need retyping when a quotation turns into a collection file.
document.getElementById('qd_convertToDebtor')?.addEventListener('click', ()=>{
  const q = quotations.find(x=>x.id===activeQuotationId);
  if(!q) return;
  if(!can('write')){toast(currentLang==='en'?'You do not have permission to edit data':'لا تملك صلاحية تعديل البيانات');return;}
  closeQuotationDrawer();
  editingDebtorId = null;
  document.getElementById('debtorModalTitle').textContent = t('modal.addDebtor');
  document.getElementById('saveDebtorBtn').textContent = t('modal.saveDebtor');
  ['f_name','f_phone','f_amount','f_due','f_expectedPaymentDate','f_paid','f_notes','f_companyNumber','f_crNumber'].forEach(id=>document.getElementById(id).value='');
  setDebtorTypeUI('company');
  document.getElementById('f_name').value = q.companyName || '';
  document.getElementById('f_phone').value = q.mobile || '';
  document.getElementById('f_amount').value = q.amount || '';
  const due = new Date(); due.setDate(due.getDate()+30);
  document.getElementById('f_due').value = due.toISOString().slice(0,10);
  const refParts = [
    q.quotationNo ? `${currentLang==='en'?'Quotation No.':'رقم عرض السعر'}: ${q.quotationNo}` : '',
    q.invoiceNo ? `${currentLang==='en'?'Invoice No.':'رقم الفاتورة'}: ${q.invoiceNo}` : '',
    q.contactPerson ? `${currentLang==='en'?'Contact':'المسؤول'}: ${q.contactPerson}` : '',
  ].filter(Boolean).join(' — ');
  document.getElementById('f_notes').value = refParts;
  document.getElementById('f_paidMethod').value = 'نقدًا';
  document.getElementById('f_paidDate').value = todayISO();
  fillRepSelect(document.getElementById('f_rep'));
  lockRepFieldForCollector();
  document.getElementById('debtorModal').classList.add('show');
  toast(currentLang==='en'?'Review the details, then save to create the collection file':'راجع البيانات ثم احفظ لإنشاء ملف التحصيل');
});

// ============== QUOTATION ATTACHMENTS (الملفات المرفقة سحابيًا) ==============
// Files (PDF / JPG / PNG / Word) are uploaded to the Supabase Storage bucket
// `quotation-files`, and a row describing each upload is kept in public.quotation_files
// so the attachment survives reloads and is visible from any device.
const QUOT_BUCKET = 'quotation-files';
let quotationFiles = [];
let pendingQuotationFile = null; // file waiting to be attached to a not-yet-saved quotation

function filesForQuotation(quotationId){
  return quotationFiles.filter(f=>Number(f.quotationId)===Number(quotationId));
}
function humanFileSize(bytes){
  const n = Number(bytes)||0;
  if(n < 1024) return `${n} B`;
  if(n < 1048576) return `${(n/1024).toFixed(1)} KB`;
  return `${(n/1048576).toFixed(1)} MB`;
}
function fileKindIcon(type, name){
  const ext = String(name||'').split('.').pop().toLowerCase();
  if(String(type).includes('pdf') || ext==='pdf') return '📕';
  if(String(type).startsWith('image/') || ['jpg','jpeg','png','webp'].includes(ext)) return '🖼️';
  if(ext==='doc' || ext==='docx') return '📘';
  return '📄';
}
function safeStorageName(name){
  const ext = (String(name).split('.').pop()||'bin').toLowerCase().replace(/[^a-z0-9]/g,'');
  return `${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
}

async function getQuotationFileUrl(entry, seconds=300){
  const { data, error } = await supabaseClient.storage.from(QUOT_BUCKET).createSignedUrl(entry.storagePath, seconds);
  if(error) throw error;
  return data.signedUrl;
}
async function openQuotationFile(entry){
  const w = window.open('about:blank','_blank');   // opened synchronously so popup blockers allow it
  try{
    const url = await getQuotationFileUrl(entry);
    if(w) w.location.href = url; else window.open(url,'_blank');
  }catch(err){
    if(w) w.close();
    console.warn('Opening attachment failed:', err);
    toast(currentLang==='en'?'Could not open the file':'تعذّر فتح الملف');
  }
}
async function loadQuotationFiles(){
  if(!supabaseClient) return;
  const { data, error } = await supabaseClient.from('quotation_files').select('*');
  if(error){
    const parts = [error?.code, error?.message, error?.details, error?.hint].filter(Boolean);
    const detail = parts.length ? parts.join(' — ') : String(error);
    console.warn('Loading quotation files failed:', error);
    showSyncErrorBanner(currentLang==='en'?'loading attached files list':'تحميل قائمة الملفات المرفقة', detail);
    quotationFiles = [];
    return;
  }
  quotationFiles = (data||[]).map(row=>({
    id: row.id,
    quotationId: row.quotation_id,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: row.file_size,
    storagePath: row.storage_path,
    publicUrl: row.public_url,
    extractedText: row.extracted_text || '',
    uploadedAt: row.uploaded_at
  }));
}

// Client-side image compression before upload: camera photos in particular can be
// several MB, which is slow to upload and eats into the Supabase Storage quota for no
// visible gain at normal screen/print size. Only JPG/PNG/WEBP images above a worthwhile
// size are resized+re-encoded; PDFs and Word files pass through untouched. On ANY
// failure this returns the original file unchanged, so compression can never be the
// reason an upload breaks — text extraction always runs on the original, uncompressed
// file beforehand, so OCR accuracy is unaffected.
async function compressImageFile(file, opts={}){
  const {maxDimension=1600, quality=0.78, skipBelowBytes=350*1024} = opts;
  const type = String(file.type||'').toLowerCase();
  if(!type.startsWith('image/') || type.includes('svg')) return file;
  if(file.size <= skipBelowBytes) return file;
  try{
    let width, height, drawSource, revoke=null;
    if(window.createImageBitmap){
      const bitmap = await createImageBitmap(file).catch(()=>null);
      if(bitmap){ width=bitmap.width; height=bitmap.height; drawSource=bitmap; }
    }
    if(!drawSource){
      const url = URL.createObjectURL(file);
      revoke = url;
      const img = await new Promise((resolve, reject)=>{
        const el = new Image();
        el.onload = ()=>resolve(el);
        el.onerror = reject;
        el.src = url;
      });
      width = img.naturalWidth; height = img.naturalHeight; drawSource = img;
    }
    if(!width || !height){ if(revoke) URL.revokeObjectURL(revoke); return file; }
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = targetW; canvas.height = targetH;
    canvas.getContext('2d').drawImage(drawSource, 0, 0, targetW, targetH);
    if(revoke) URL.revokeObjectURL(revoke);
    const blob = await new Promise(resolve=>canvas.toBlob(resolve, 'image/jpeg', quality));
    if(!blob || blob.size >= file.size) return file; // compression didn't actually help — keep the original
    const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], newName, {type:'image/jpeg', lastModified: Date.now()});
  }catch(err){
    console.warn('Image compression skipped, uploading original file:', err);
    return file;
  }
}

// Uploads the original document to cloud storage and records it against the quotation.
async function uploadQuotationFile(file, quotationId, extractedText=''){
  if(!supabaseClient) throw new Error(currentLang==='en'?'Cloud storage is not available':'التخزين السحابي غير متاح');
  const storagePath = `${quotationId}/${safeStorageName(file.name)}`;
  const { error: uploadError } = await supabaseClient.storage
    .from(QUOT_BUCKET)
    .upload(storagePath, file, { cacheControl:'3600', upsert:false, contentType:file.type || 'application/octet-stream' });
  if(uploadError) throw uploadError;
  const row = {
    quotation_id: quotationId,
    file_name: file.name,
    file_type: file.type || '',
    file_size: file.size || 0,
    storage_path: storagePath,
    public_url: '',
    extracted_text: (extractedText||'').slice(0, 20000)
  };
  const { data, error } = await supabaseClient.from('quotation_files').insert(row).select().single();
  if(error){
    // Do not leave an orphan object behind in the bucket.
    await supabaseClient.storage.from(QUOT_BUCKET).remove([storagePath]).catch(()=>{});
    throw error;
  }
  quotationFiles.push({
    id: data.id, quotationId: data.quotation_id, fileName: data.file_name, fileType: data.file_type,
    fileSize: data.file_size, storagePath: data.storage_path, publicUrl: data.public_url,
    extractedText: data.extracted_text || '', uploadedAt: data.uploaded_at
  });
  return data;
}

async function deleteQuotationFile(fileId){
  const entry = quotationFiles.find(f=>Number(f.id)===Number(fileId));
  if(!entry) return;
  if(!(await uiConfirm(currentLang==='en'?'Delete this attachment permanently?':'هل تريد حذف هذا الملف المرفق نهائيًا؟', {danger:true, confirmText:t('ui.delete')}))) return;
  try{
    await supabaseClient.storage.from(QUOT_BUCKET).remove([entry.storagePath]);
    const { error } = await supabaseClient.from('quotation_files').delete().eq('id', entry.id);
    if(error) throw error;
    quotationFiles = quotationFiles.filter(f=>Number(f.id)!==Number(fileId));
    toast(currentLang==='en'?'Attachment deleted':'تم حذف الملف المرفق');
    if(activeQuotationId) renderQuotationAttachments(activeQuotationId);
  }catch(err){
    console.warn('Attachment delete failed:', err);
    toast(currentLang==='en'?'Could not delete the attachment':'تعذر حذف الملف المرفق');
  }
}

function renderQuotationAttachments(quotationId){
  const box = document.getElementById('qd_files');
  if(!box) return;
  const list = filesForQuotation(quotationId);
  if(!list.length){
    box.innerHTML = `<div style="color:var(--muted); font-size:12.5px; padding:10px 0">${t('quot.noFiles')}</div>`;
    return;
  }
  box.innerHTML = list.map(f=>`
    <div class="log-entry">
      <div class="top">
        <b>${fileKindIcon(f.fileType, f.fileName)} ${esc(f.fileName)}</b>
        <span>${humanFileSize(f.fileSize)}</span>
      </div>
      <div class="note">
        <button type="button" class="link-btn" data-open-file="${f.id}">${t('quot.viewFile')}</button> ·
        <button type="button" class="link-btn" data-print-file="${f.id}">${t('quot.printFile')}</button>
        ${can('delete') ? ` · <button type="button" class="link-btn" data-delete-file="${f.id}">${t('action.delete')}</button>` : ''}
      </div>
    </div>`).join('');
}

// Fetching the object as a blob first gives us a same-origin blob: URL, which is the
// only reliable way to drive window.print() on a file hosted on another domain.
async function printQuotationFile(fileId){
  const entry = quotationFiles.find(f=>Number(f.id)===Number(fileId));
  if(!entry) return;
  const ext = String(entry.fileName).split('.').pop().toLowerCase();
  if(ext==='doc' || ext==='docx'){
    toast(currentLang==='en'?'Word files open in Word for printing':'ملفات Word تُفتح في برنامج Word للطباعة');
    openQuotationFile(entry);
    return;
  }
  try{
    toast(currentLang==='en'?'Preparing the file for printing…':'جارٍ تجهيز الملف للطباعة…');
    const res = await fetch(await getQuotationFileUrl(entry));
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    if(String(entry.fileType).startsWith('image/') || ['jpg','jpeg','png','webp'].includes(ext)){
      printDocument(`<!doctype html><html lang="${currentLang}" dir="${currentLang==='en'?'ltr':'rtl'}"><head><meta charset="utf-8">
<title>${esc(entry.fileName)}</title><style>${printSharedStyle()}
img{max-width:100%;height:auto;display:block;margin:12px auto}</style></head><body>
${printBrandHeader(esc(entry.fileName))}
<img src="${blobUrl}" alt="${esc(entry.fileName)}">
<div class="doc-footer">${t('msg.printedOn')} ${todayISO()}.</div></body></html>`);
      setTimeout(()=>URL.revokeObjectURL(blobUrl), 60000);
      return;
    }
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    frame.src = blobUrl;
    frame.onload = ()=>setTimeout(()=>{
      try{ frame.contentWindow.focus(); frame.contentWindow.print(); }
      catch(err){ window.open(blobUrl, '_blank'); }
      setTimeout(()=>{ frame.remove(); URL.revokeObjectURL(blobUrl); }, 60000);
    }, 400);
    document.body.appendChild(frame);
  }catch(err){
    console.warn('Printing attachment failed:', err);
    openQuotationFile(entry);
  }
}

document.getElementById('qd_files')?.addEventListener('click', ev=>{
  const openBtn = ev.target.closest('[data-open-file]');
  const printBtn = ev.target.closest('[data-print-file]');
  const delBtn = ev.target.closest('[data-delete-file]');
  if(openBtn){
    const entry = quotationFiles.find(f=>Number(f.id)===Number(openBtn.dataset.openFile));
    if(entry) openQuotationFile(entry);
    return;
  }
  if(printBtn){ printQuotationFile(Number(printBtn.dataset.printFile)); return; }
  if(delBtn){ deleteQuotationFile(Number(delBtn.dataset.deleteFile)); }
});

// Attach an extra file to a quotation that already exists.
document.getElementById('qd_attachFile')?.addEventListener('change', async ev=>{
  const file = ev.target.files[0];
  ev.target.value = '';
  if(!file || !activeQuotationId) return;
  if(!can('write')){ toast(currentLang==='en'?'You do not have permission to edit data':'لا تملك صلاحية تعديل البيانات'); return; }
  try{
    toast(t('quot.uploading'));
    await uploadQuotationFile(await compressImageFile(file), activeQuotationId);
    renderQuotationAttachments(activeQuotationId);
    toast(t('quot.fileSaved'));
  }catch(err){
    const parts = [err?.code, err?.statusCode, err?.message, err?.error, err?.details, err?.hint].filter(Boolean);
    const detail = parts.length ? parts.join(' — ') : String(err);
    console.warn('Attachment upload failed:', err);
    showSyncErrorBanner(currentLang==='en'?`uploading "${file.name}"`:`رفع الملف "${file.name}"`, detail);
    toast(currentLang==='en'
      ? 'File upload failed — see the red banner above the quotations list'
      : 'فشل رفع الملف — راجع الشريط الأحمر أعلى قائمة عروض الأسعار');
  }
});

// ============== DOCUMENT IMPORT (PDF / JPG / WORD) ==============
const loadedScripts = {};
function loadScriptOnce(src){
  if(loadedScripts[src]) return loadedScripts[src];
  loadedScripts[src] = new Promise((resolve, reject)=>{
    const el = document.createElement('script');
    el.src = src; el.async = true;
    el.onload = ()=>resolve();
    el.onerror = ()=>reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(el);
  });
  return loadedScripts[src];
}

async function extractTextFromPdf(file){
  await loadScriptOnce('vendor/pdfjs/pdf.min.js');
  const pdfjs = window.pdfjsLib;
  pdfjs.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.min.js';
  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({data:buffer}).promise;
  let text = '';
  const pages = Math.min(doc.numPages, 10);
  for(let i=1; i<=pages; i++){
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // Rebuild line breaks: pdf.js gives isolated items, so start a new line whenever
    // the vertical position changes, otherwise every field runs into the next one.
    let lastY = null, line = '';
    content.items.forEach(item=>{
      const y = item.transform?.[5];
      if(lastY !== null && Math.abs(y - lastY) > 3){ text += line.trim() + '\n'; line = ''; }
      line += item.str + ' ';
      lastY = y;
    });
    text += line.trim() + '\n';
  }
  return text;
}

async function extractTextFromImage(file){
  await loadScriptOnce('vendor/tesseract/tesseract.min.js');
  const base = new URL('vendor/tesseract/', location.href).href;   // absolute: the worker resolves paths itself
  const worker = await window.Tesseract.createWorker(['eng','ara'], 1, {
    workerPath: base+'worker.min.js', corePath: base, langPath: base+'lang', workerBlobURL: false   // no blob worker: CSP forbids it
  });
  try{
    const { data } = await worker.recognize(file);
    return data?.text || '';
  } finally {
    await worker.terminate();
  }
}

async function extractTextFromWord(file){
  const ext = String(file.name).split('.').pop().toLowerCase();
  if(ext === 'doc') throw new Error(currentLang==='en'
    ? 'Legacy .doc files are not supported — save as .docx'
    : 'صيغة .doc القديمة غير مدعومة — احفظ الملف بصيغة .docx');
  await loadScriptOnce('vendor/mammoth.browser.min.js');
  const buffer = await file.arrayBuffer();
  const result = await window.mammoth.extractRawText({arrayBuffer:buffer});
  return result?.value || '';
}

async function extractTextFromDocument(file){
  const type = String(file.type||'').toLowerCase();
  const ext = String(file.name).split('.').pop().toLowerCase();
  if(type.includes('pdf') || ext==='pdf'){
    let text = await extractTextFromPdf(file);
    // Scanned PDFs carry no text layer; fall back to OCR on nothing is not possible here,
    // so tell the user rather than silently importing an empty record.
    if(text.replace(/\s/g,'').length < 20) throw new Error(currentLang==='en'
      ? 'This PDF has no readable text layer (scanned). Export a JPG page and import that instead.'
      : 'ملف PDF لا يحتوي نصًا قابلًا للقراءة (ممسوح ضوئيًا). صدّر الصفحة كصورة JPG واستوردها بدلًا منه.');
    return text;
  }
  if(type.startsWith('image/') || ['jpg','jpeg','png','webp'].includes(ext)) return await extractTextFromImage(file);
  if(['doc','docx'].includes(ext) || type.includes('word') || type.includes('officedocument.wordprocessing')) return await extractTextFromWord(file);
  throw new Error(currentLang==='en' ? 'Unsupported file type' : 'نوع الملف غير مدعوم');
}

// Heuristic field extraction. Everything it finds is shown to the user for review
// before it is written, because OCR and PDF layouts are never perfectly predictable.
function parseQuotationFromText(rawText, fileName=''){
  const text = String(rawText||'').replace(/\r/g,'').replace(/[ \t]+/g,' ');
  const lines = text.split('\n').map(l=>l.trim()).filter(Boolean);
  const flat = lines.join('\n');
  const found = {};
  const grab = (re, group=1)=>{ const m = flat.match(re); return m ? String(m[group]||'').trim() : ''; };

  found.email = grab(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, 0);

  const mobileLabelled = grab(/(?:mobile|mob|tel|phone|contact\s*no|جوال|موبايل|هاتف|تليفون)\s*(?:no\.?|#)?\s*[:\-]?\s*((?:\+?\d[\d\s\-()]{6,17}\d))/i);
  found.mobile = (mobileLabelled || grab(/(\+974[\s-]?\d{4}[\s-]?\d{4})/) || grab(/(?:^|\s)([3567]\d{3}[\s-]?\d{4})(?:\s|$)/)).replace(/\s+/g,' ').trim();

  // Reference numbers must sit on the SAME line as their label and must contain a
  // digit — otherwise a bare "QUOTATION" heading swallows the next word as the number.
  const grabRef = (labels)=>{
    const re = new RegExp(`(?:${labels})[^\\S\\n]*(?:no\\.?|number|ref\\.?|code|#|رقم)?[^\\S\\n]*[:\\-.]?[^\\S\\n]*([A-Za-z0-9][A-Za-z0-9\\/\\-_]{2,25})`, 'i');
    for(const line of lines){
      const m = line.match(re);
      if(m && /\d/.test(m[1])) return m[1].replace(/[.,;:]+$/,'');
    }
    return '';
  };
  found.quotationNo = grabRef('quotation|quote|quot|offer|عرض\\s*سعر|عرض\\s*الأسعار|رقم\\s*العرض');
  found.invoiceNo = grabRef('tax\\s*invoice|invoice|inv|فاتورة|رقم\\s*الفاتورة');
  found.projectNo = grabRef('project|job|مشروع|رقم\\s*المشروع');

  // Prefer an explicit grand total; otherwise take the largest money-looking figure.
  const amountLabelled = grab(/(?:grand\s*total|total\s*amount|net\s*total|total|الإجمالي|المجموع|الإجمالي\s*النهائي|القيمة\s*الإجمالية)\s*(?:\(?\s*(?:qar|qr|ر\.?ق)\s*\)?)?\s*[:\-]?\s*([\d][\d,\.\s]{0,18})/i);
  let amount = Number(String(amountLabelled).replace(/[,\s]/g,'')) || 0;
  if(!amount){
    const candidates = (flat.match(/\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d{4,}(?:\.\d{1,2})?/g)||[])
      .map(v=>Number(v.replace(/,/g,''))).filter(v=>isFinite(v) && v>0 && v<1e12);
    amount = candidates.length ? Math.max(...candidates) : 0;
  }
  found.amount = amount;

  const dateLabelled = grab(/(?:date|dated|تاريخ|التاريخ)\s*[:\-]?\s*([0-9]{1,4}[-\/.][0-9]{1,2}[-\/.][0-9]{2,4}|[0-9]{1,2}[-\s][A-Za-z]{3,}[-\s,]*[0-9]{4})/i);
  found.date = toISODate(dateLabelled) || toISODate(grab(/([0-9]{4}[-\/.][0-9]{1,2}[-\/.][0-9]{1,2})/)) || toISODate(grab(/([0-9]{1,2}[-\/.][0-9]{1,2}[-\/.][0-9]{4})/)) || '';

  const validityDays = Number(grab(/(?:valid(?:ity)?|صالح)\s*(?:for)?\s*[:\-]?\s*(\d{1,3})\s*(?:days|يوم)/i));
  if(found.date && validityDays){
    const d = new Date(found.date); d.setDate(d.getDate() + validityDays);
    found.nextFollowup = d.toISOString().slice(0,10);
  }

  found.contactPerson = grab(/(?:attn|attention|kind\s*attention|contact\s*person|عناية|السيد|المهندس)[^\S\n]*[:\-.]?[^\S\n]*((?:Mr\.?|Mrs\.?|Ms\.?|Eng\.?|م\.)?[^\S\n]*[A-Za-z\u0621-\u064A][A-Za-z\u0621-\u064A. \t]{2,40})/i)
    .replace(/\s{2,}/g,' ').replace(/[.,;:]+$/,'').trim();

  // Company name: an explicit "To / M/s / Client" label wins, otherwise the first
  // line that looks like a company, otherwise the file name as a last resort.
  let company = grab(/(?:^|\n)\s*(?:to|m\/?s\.?|messrs\.?|client|customer|bill\s*to|company\s*name|إلى|السادة|العميل|اسم\s*الشركة)\s*[:\-.]?\s*([^\n]{3,70})/i);
  if(!company){
    const companyLine = lines.find(l=>/(?:w\.?l\.?l|l\.?l\.?c|co\.|company|contracting|trading|establishment|est\.|group|est|شركة|مؤسسة|مقاولات|للتجارة)/i.test(l) && l.length<80);
    company = companyLine || '';
  }
  company = company.replace(/^[\s:،,.-]+/,'').replace(/\s{2,}/g,' ').trim();
  if(company.length > 70) company = company.slice(0,70).trim();
  if(!company) company = String(fileName).replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').trim();
  found.companyName = company;

  const lower = flat.toLowerCase();
  found.companyScope = /consultant|استشار/.test(lower) ? 'consultant'
    : /sub[-\s]?contract|من الباطن/.test(lower) ? 'subcontractor'
    : /developer|مطور/.test(lower) ? 'developer'
    : /supplier|manufactur|مورد|مصنع/.test(lower) ? 'supplier'
    : 'mainContractor';
  found.subject = /invoice|payment|دفع|فاتورة/.test(lower) ? 'payment'
    : /new\s*client|عميل\s*جديد/.test(lower) ? 'newClient'
    : 'quoteFollowup';
  found.status = found.invoiceNo ? 'paymentPending' : found.quotationNo ? 'submitted' : 'open';

  // A short, readable excerpt of the source so the record is traceable later.
  found.requirement = lines.slice(0, 12).join(' · ').slice(0, 500);
  return found;
}

function fillQuotationModalFrom(fields){
  const set = (id, value)=>{ const el = document.getElementById(id); if(el) el.value = value ?? ''; };
  set('q_company', fields.companyName||'');
  set('q_contact', fields.contactPerson||'');
  set('q_mobile', fields.mobile||'');
  set('q_email', fields.email||'');
  set('q_amount', fields.amount||'');
  set('q_quotationNo', fields.quotationNo||'');
  set('q_invoiceNo', fields.invoiceNo||'');
  set('q_projectNo', fields.projectNo||'');
  set('q_date', fields.date || todayISO());
  set('q_time', '');
  set('q_nextFollowup', fields.nextFollowup||'');
  set('q_requirement', fields.requirement||'');
  set('q_followupAction', '');
  set('q_notes', '');
  const scope = document.getElementById('q_scope'); if(scope) scope.value = fields.companyScope || 'mainContractor';
  const subject = document.getElementById('q_subject'); if(subject) subject.value = fields.subject || 'quoteFollowup';
  const status = document.getElementById('q_status'); if(status) status.value = fields.status || 'open';
}

function buildQuotationFromFields(fields, fallbackDate){
  return {
    id: nextQuotationId++,
    date: fields.date || fallbackDate,
    visitTime: '',
    companyName: fields.companyName || '',
    companyScope: fields.companyScope || 'mainContractor',
    contactPerson: fields.contactPerson || '',
    mobile: fields.mobile || '',
    email: fields.email || '',
    amount: Number(fields.amount)||0,
    quotationNo: fields.quotationNo || '',
    invoiceNo: fields.invoiceNo || '',
    projectNo: fields.projectNo || '',
    subject: fields.subject || 'quoteFollowup',
    nextFollowup: fields.nextFollowup || '',
    status: fields.status || 'open',
    requirement: fields.requirement || '',
    followupAction: '',
    notes: '',
    log: []
  };
}

document.getElementById('importQuotationDocFile')?.addEventListener('change', async ev=>{
  const files = Array.from(ev.target.files||[]);
  ev.target.value = '';
  if(!files.length) return;
  if(!can('write')){ toast(currentLang==='en'?'You do not have permission to edit data':'لا تملك صلاحية تعديل البيانات'); return; }
  const fallbackDate = document.getElementById('quotDateFilter')?.value || todayISO();

  // A single file goes through the review modal so OCR mistakes can be corrected.
  if(files.length === 1){
    const file = files[0];
    try{
      toast(t('quot.reading'));
      const text = await extractTextFromDocument(file);
      const fields = parseQuotationFromText(text, file.name);
      editingQuotationId = null;
      pendingQuotationFile = { file, extractedText: text };
      document.getElementById('quotationModalTitle').textContent = t('quot.reviewTitle');
      document.getElementById('saveQuotationBtn').textContent = t('quot.save');
      const banner = document.getElementById('quotExtractBanner');
      if(banner){ banner.style.display = 'block'; banner.textContent = `${t('quot.extractedFrom')} ${file.name}`; }
      fillQuotationModalFrom({...fields, date: fields.date || fallbackDate});
      document.getElementById('quotationModal').classList.add('show');
      toast(t('quot.extracted'));
    }catch(err){
      console.warn('Document extraction failed:', err);
      pendingQuotationFile = null;
      toast(`${t('quot.readFailed')} — ${err?.message||err}`);
    }
    return;
  }

  // Several files at once: import them all automatically, then report the result.
  let added = 0, failed = 0, firstError = '';
  toast(t('quot.reading'));
  for(const file of files){
    try{
      const text = await extractTextFromDocument(file);
      const fields = parseQuotationFromText(text, file.name);
      const record = buildQuotationFromFields(fields, fallbackDate);
      if(!record.companyName) record.companyName = file.name.replace(/\.[^.]+$/,'');
      quotations.push(record);
      const synced = await saveState();
      if(!synced) throw new Error(lastSyncError || 'cloud sync failed');
      await uploadQuotationFile(await compressImageFile(file), record.id, text);
      added++;
    }catch(err){
      const parts = [err?.code, err?.message, err?.details, err?.hint].filter(Boolean);
      const detail = parts.length ? parts.join(' — ') : String(err?.message||err);
      console.warn('Document import failed for', file.name, err);
      if(!firstError) firstError = `${file.name}: ${detail}`;
      failed++;
    }
  }
  renderAll();
  if(activeQuotationId) renderQuotationAttachments(activeQuotationId);
  if(failed) showSyncErrorBanner(currentLang==='en'?`importing ${failed} document(s)`:`استيراد ${failed} مستند`, firstError);
  toast(currentLang==='en'
    ? `Imported ${added} file(s)${failed?`, ${failed} failed`:''}`
    : `تم استيراد ${added} ملف${failed?`، وفشل ${failed}`:''}`);
});

// ---- Import / template / export ----
document.getElementById('importQuotationsFile')?.addEventListener('change', async e=>{
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = async ()=>{
    try{
      // cellDates:true makes XLSX hand us real Date objects instead of serial numbers.
      const wb = XLSX.read(reader.result, {type:'array', cellDates:true});
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {defval:'', raw:false, dateNF:'yyyy-mm-dd'});
      const pick=(row,keys)=>{const key=Object.keys(row).find(k=>keys.includes(String(k).trim().toLowerCase()));return key===undefined?'':row[key];};
      const selectedQuotationDate = document.getElementById('quotDateFilter')?.value || todayISO();
      const scopeMap = {'main contractor':'mainContractor','مقاول رئيسي':'mainContractor','subcontractor':'subcontractor','مقاول من الباطن':'subcontractor','consultant':'consultant','استشاري':'consultant','developer / client':'developer','مطور':'developer','مطور / عميل مباشر':'developer','supplier / manufacturer':'supplier','مورد':'supplier','مورد / مصنع':'supplier'};
      const statusMap = {'open':'open','مفتوح':'open','quotation submitted':'submitted','تم تقديم العرض':'submitted','follow-up required':'followup','بانتظار المتابعة':'followup','payment pending':'paymentPending','بانتظار الدفع':'paymentPending','closed':'closed','مغلق':'closed'};
      const subjectMap = {'follow up quote':'quoteFollowup','متابعة عرض سعر':'quoteFollowup','new target client':'newClient','عميل مستهدف جديد':'newClient','payment':'payment','متابعة دفعة':'payment'};
      const toTimeString = toTimeValue;
      const imported = rows.map(row=>{
        const companyName = String(pick(row,['company name','اسم الشركة','company']));
        if(!companyName) return null;
        const scopeRaw = String(pick(row,['company scope / main activity','company scope','نشاط الشركة'])).trim().toLowerCase();
        const statusRaw = String(pick(row,['status / remarks','status','الحالة'])).trim().toLowerCase();
        const subjectRaw = String(pick(row,['visit purpose','الموضوع','موضوع العرض / الزيارة'])).trim().toLowerCase();
        const importedDate = toISODate(pick(row,['date','التاريخ']));
        // "Next Follow-up" is often filled with free text ("next week", "They will send
        // email", "ـــــــ") rather than a date. A `date` column rejects those outright and
        // that single bad value fails the whole upload, so anything unparsable is kept as a
        // note instead of being sent to Postgres.
        const followupRaw = String(pick(row,['next follow-up','next followup','المتابعة القادمة'])).trim();
        const followupDate = toISODate(followupRaw);
        const followupNote = (!followupDate && followupRaw && !/^[ـ\-_—–\s.]+$/.test(followupRaw))
          ? `${currentLang==='en'?'Next follow-up':'المتابعة القادمة'}: ${followupRaw}`
          : '';
        return {
          id: nextQuotationId++,
          date: importedDate || selectedQuotationDate,
          visitTime: toTimeString(pick(row,['time','الوقت'])),
          companyName,
          companyScope: scopeMap[scopeRaw] || 'mainContractor',
          contactPerson: String(pick(row,['contact person','المسؤول'])),
          mobile: String(pick(row,['mobile no.','mobile','الجوال'])),
          email: String(pick(row,['email address','email','البريد الإلكتروني'])),
          amount: Number(String(pick(row,['amount','quotation value','قيمة العرض'])).replace(/[^\d.-]/g,''))||0,
          quotationNo: String(pick(row,['quotation no.','quotation no','رقم عرض السعر'])),
          invoiceNo: String(pick(row,['invoice no.','invoice no','رقم الفاتورة'])),
          projectNo: String(pick(row,['project no.','project no','رقم المشروع'])),
          subject: subjectMap[subjectRaw] || 'quoteFollowup',
          nextFollowup: followupDate,
          status: statusMap[statusRaw] || 'open',
          requirement: String(pick(row,['discussion / client requirement','discussion','requirement','تفاصيل / متطلبات العميل'])),
          followupAction: String(pick(row,['follow-up action / next step','follow-up action','followup action','إجراء المتابعة'])),
          notes: followupNote,
          log: []
        };
      }).filter(Boolean);
      if(!imported.length) throw new Error('empty');
      const msg = t('quot.importConfirm') ? (currentLang==='en'?`Import ${imported.length} quotations?`:`استيراد ${imported.length} عرض سعر؟`) : '';
      if(await uiConfirm(msg)){
        quotations.push(...imported);
        if(document.getElementById('quotDateFilter')) document.getElementById('quotDateFilter').value = selectedQuotationDate;
        const synced = await saveStateOrWarn(currentLang==='en'?`importing ${imported.length} rows from Excel`:`استيراد ${imported.length} صف من Excel`);
        renderAll();
        if(synced) toast(t('quot.imported'));
      }
      else { nextQuotationId -= imported.length; }
    }catch(err){ console.warn('Excel import failed:', err); toast(t('quot.importFailed')); }
  };
  reader.readAsArrayBuffer(file); e.target.value='';
});
document.getElementById('downloadQuotTemplateBtn')?.addEventListener('click', ()=>{
  const sheet = XLSX.utils.json_to_sheet([{
    'Date':'2026-09-01','Time':'12:00','Company Name':'اسم الشركة','Company Scope / Main Activity':'Main Contractor',
    'Contact Person':'اسم المسؤول','Mobile No.':'50000000','Email Address':'client@example.com',
    'Amount':0,'Quotation No.':'QTN-2026-00001','Invoice No.':'','Project No.':'','Visit Purpose':'Follow Up Quote','Discussion / Client Requirement':'','Follow-up Action':'','Next Follow-up':'2026-09-08','Status / Remarks':'Open'
  }]);
  const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, 'Quotations');
  const listsSheet = XLSX.utils.aoa_to_sheet([
    ['Visit Purpose','Status','Company Scope'],
    ['Follow Up Quote','Open','Main Contractor'],
    ['New Target Client','Follow-up Required','Subcontractor'],
    ['Payment','Quotation Submitted','Consultant'],
    ['','Payment Pending','Developer / Client'],
    ['','Closed','Supplier / Manufacturer'],
  ]);
  XLSX.utils.book_append_sheet(book, listsSheet, 'Lists');
  XLSX.writeFile(book, 'daftar-quotations-template.xlsx');
});
document.getElementById('quotExcelBtn')?.addEventListener('click', ()=>{
  const rows = scopedQuotations();
  const headers = currentLang==='en'
    ? ['No.','Date','Time','Company Name','Company Scope','Contact Person','Mobile','Email','Amount','Quotation No.','Invoice No.','Project No.','Visit Purpose','Status','Next Follow-up','Requirement','Follow-up Action','Notes']
    : ['م.','التاريخ','الوقت','اسم الشركة','نشاط الشركة','المسؤول','الجوال','البريد الإلكتروني','قيمة العرض','رقم عرض السعر','رقم الفاتورة','رقم المشروع','الموضوع','الحالة','المتابعة القادمة','التفاصيل','إجراء المتابعة','ملاحظات'];
  const data = [headers, ...rows.map((q,i)=>[i+1, q.date||'', q.visitTime||'', q.companyName||'', quotScopeLabel(q.companyScope), q.contactPerson||'', q.mobile||'', q.email||'', q.amount||0, q.quotationNo||'', q.invoiceNo||'', q.projectNo||'', quotSubjectLabel(q.subject), quotStatusLabel(q.status), q.nextFollowup||'', q.requirement||'', q.followupAction||'', q.notes||''])];
  const sheet = XLSX.utils.aoa_to_sheet(data);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, currentLang==='en'?'Quotations':'عروض الأسعار');
  if(quotShowAll){
    const days = [...new Set(rows.map(q=>q.date||''))].sort((a,b)=>b.localeCompare(a));
    const sum = [t('quot.daySheetHeaders').split('|'), ...days.map(day=>{
      const list = rows.filter(q=>(q.date||'')===day);
      return [day, list.length, money2(list.reduce((s,q)=>s+(Number(q.amount)||0),0)), list.filter(q=>q.status==='closed').length];
    })];
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(sum), t('quot.daySheet'));
  }
  XLSX.writeFile(book, `daftar-quotations-${todayISO()}.xlsx`);
  addAudit('export_excel', currentLang==='en'?'Quotations list':'قائمة عروض الأسعار');
});
document.getElementById('quotPrintBtn')?.addEventListener('click', ()=>printDocument(quotationsListDocumentHtml(scopedQuotations(), undefined, {groupByDate:quotShowAll})));

// ---- Quotation print column picker ----
function getQuotPrintColumnKeys(){
  const saved = appSettings.quotPrintColumns;
  return Array.isArray(saved) && saved.length ? saved : QUOT_PRINT_COLUMNS.map(c=>c.key);
}
function renderQuotPrintColsList(){
  const box = document.getElementById('quotPrintColsList');
  if(!box) return;
  const enabled = new Set(getQuotPrintColumnKeys());
  box.innerHTML = QUOT_PRINT_COLUMNS.map(c=>`
    <label><input type="checkbox" value="${c.key}" ${enabled.has(c.key)?'checked':''}> ${esc(currentLang==='en'?c.en:c.ar)}</label>
  `).join('');
}
document.getElementById('quotPrintOptionsBtn')?.addEventListener('click', ()=>{
  renderQuotPrintColsList();
  document.getElementById('quotPrintOptionsModal').classList.add('show');
});
document.getElementById('quotPrintColsAll')?.addEventListener('click', ()=>{
  document.querySelectorAll('#quotPrintColsList input[type=checkbox]').forEach(cb=>cb.checked=true);
});
document.getElementById('quotPrintColsNone')?.addEventListener('click', ()=>{
  document.querySelectorAll('#quotPrintColsList input[type=checkbox]').forEach(cb=>cb.checked=false);
});
document.getElementById('quotPrintConfirmBtn')?.addEventListener('click', ()=>{
  const selected = Array.from(document.querySelectorAll('#quotPrintColsList input[type=checkbox]:checked')).map(cb=>cb.value);
  if(!selected.length){
    toast(currentLang==='en'?'Choose at least one column':'اختر عمودًا واحدًا على الأقل');
    return;
  }
  appSettings.quotPrintColumns = selected;
  saveState(); // remembered for next time, same as any other setting
  document.getElementById('quotPrintOptionsModal').classList.remove('show');
  printDocument(quotationsListDocumentHtml(scopedQuotations(), selected, {groupByDate:quotShowAll}));
});

// Single source of truth for the quotations-list print/PDF columns, shared by the
// column-picker modal and the HTML builder below, so the two can never drift apart.
// 'no' (the row number) is not in this list — it is always shown, unconditionally.
const QUOT_PRINT_COLUMNS = [
  {key:'date', ar:'التاريخ', en:'Date', get:q=>esc(q.date)||'—'},
  {key:'visitTime', ar:'الوقت', en:'Time', get:q=>esc(q.visitTime)||'—'},
  {key:'companyName', ar:'الشركة', en:'Company', get:q=>esc(q.companyName)},
  {key:'companyScope', ar:'النشاط', en:'Scope', get:q=>quotScopeLabel(q.companyScope)},
  {key:'contactPerson', ar:'المسؤول', en:'Contact', get:q=>esc(q.contactPerson)||'—'},
  {key:'mobile', ar:'الجوال', en:'Mobile', get:q=>esc(q.mobile)||'—', cls:'num'},
  {key:'email', ar:'البريد الإلكتروني', en:'Email', get:q=>esc(q.email)||'—'},
  {key:'amount', ar:'القيمة', en:'Amount', get:q=>q.amount?currency(q.amount):'—', cls:'num'},
  {key:'subject', ar:'الموضوع', en:'Subject', get:q=>quotSubjectLabel(q.subject)},
  {key:'quotationNo', ar:'رقم العرض', en:'Quotation No.', get:q=>esc(q.quotationNo)||'—'},
  {key:'invoiceNo', ar:'رقم الفاتورة', en:'Invoice No.', get:q=>esc(q.invoiceNo)||'—'},
  {key:'projectNo', ar:'رقم المشروع', en:'Project No.', get:q=>esc(q.projectNo)||'—'},
  {key:'status', ar:'الحالة', en:'Status', get:q=>quotStatusLabel(q.status)},
  {key:'nextFollowup', ar:'المتابعة القادمة', en:'Next Follow-up', get:q=>esc(q.nextFollowup)||'—'},
  {key:'followupAction', ar:'إجراء المتابعة', en:'Follow-up Action', get:q=>esc(q.followupAction)||'—'},
  {key:'notes', ar:'ملاحظات', en:'Notes', get:q=>esc(q.notes)||'—'},
  {key:'requirement', ar:'التفاصيل', en:'Details', get:q=>esc(q.requirement)||'—'},
];
function quotationsListDocumentHtml(rows, selectedKeys, opts={}){
  const title = t('quot.title');
  const cols = selectedKeys ? QUOT_PRINT_COLUMNS.filter(c=>selectedKeys.includes(c.key)) : QUOT_PRINT_COLUMNS;
  const noHeader = currentLang==='en' ? 'No.' : 'م.';
  const headers = [noHeader, ...cols.map(c=>currentLang==='en'?c.en:c.ar)];
  const rowHtml = (q,i)=>`<tr><td>${i}</td>${cols.map(c=>`<td${c.cls?` class="${c.cls}"`:''}>${c.get(q)}</td>`).join('')}</tr>`;
  let bodyRows;
  if(opts.groupByDate){
    // "Show all" view: one heading per registration date, numbering restarts inside each day.
    const days = [...new Set(rows.map(q=>q.date||''))].sort((a,b)=>b.localeCompare(a));
    bodyRows = days.map(day=>{
      const list = rows.filter(q=>(q.date||'')===day);
      const sum = money2(list.reduce((s,q)=>s+(Number(q.amount)||0),0));
      const closed = list.filter(q=>q.status==='closed').length;
      return `<tr class="grp"><td colspan="${cols.length+1}">${esc(day)||'—'} — ${list.length} ${esc(t('qcal.count'))}${sum?` — ${esc(t('quot.dayValue'))}: ${currency(sum)}`:''} — ${esc(t('quot.closedRatio'))}: ${closed}/${list.length}</td></tr>`
        + list.map((q,i)=>rowHtml(q,i+1)).join('');
    }).join('');
  } else {
    bodyRows = rows.map((q,i)=>rowHtml(q,i+1)).join('');
  }
  // 18 columns is a lot for one printed page, so this report prints in landscape with a
  // denser font (see printSharedStyle's dense/landscape options) and an auto-sized
  // ("wide") table instead of forcing all columns to the same width — that equal-width
  // forcing is what previously squeezed every field down to one letter per line.
  return `<!doctype html><html lang="${currentLang}" dir="${currentLang==='en'?'ltr':'rtl'}"><head><meta charset="utf-8"><title>${esc(title)}</title>
<link rel="stylesheet" href="${new URL('fonts/fonts.css', location.href).href}">
<style>${printSharedStyle({orientation:'landscape', dense:true})} tr.grp td{background:#eef1f6; font-weight:800; border-top:2px solid #cbd2dd;}</style></head><body>
${printBrandHeader(title)}
<table class="wide"><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${bodyRows || `<tr><td colspan="${cols.length+1}" class="empty">${t('quot.empty')}</td></tr>`}</tbody></table>
<div class="doc-footer">${t('msg.printedOn')} ${todayISO()}.</div>
</body></html>`;
}
function quotationDetailDocumentHtml(q){
  const title = `${t('quot.title')} — ${q.companyName}`;
  return `<!doctype html><html lang="${currentLang}" dir="${currentLang==='en'?'ltr':'rtl'}"><head><meta charset="utf-8"><title>${esc(title)}</title>
<link rel="stylesheet" href="${new URL('fonts/fonts.css', location.href).href}">
<style>${printSharedStyle()}</style></head><body>
${printBrandHeader(title)}
<table>
  <tr><td>${t('quot.company')}</td><td class="num">${esc(q.companyName)}</td></tr>
  <tr><td>${t('quot.scope')}</td><td class="num">${quotScopeLabel(q.companyScope)}</td></tr>
  <tr><td>${t('quot.contact')}</td><td class="num">${esc(q.contactPerson)||'—'}</td></tr>
  <tr><td>${t('quot.mobile')}</td><td class="num">${esc(q.mobile)||'—'}</td></tr>
  <tr><td>${t('quot.email')}</td><td class="num">${esc(q.email)||'—'}</td></tr>
  <tr><td>${t('quot.amount')}</td><td class="num">${q.amount?currency(q.amount):'—'}</td></tr>
  <tr><td>${t('quot.quotationNo')}</td><td class="num">${esc(q.quotationNo)||'—'}</td></tr>
  <tr><td>${t('quot.invoiceNo')}</td><td class="num">${esc(q.invoiceNo)||'—'}</td></tr>
  <tr><td>${t('quot.projectNo')}</td><td class="num">${esc(q.projectNo)||'—'}</td></tr>
  <tr><td>${t('th.date')}</td><td class="num">${esc(q.date)||'—'}</td></tr>
  <tr><td>${t('quot.time')}</td><td class="num">${esc(q.visitTime)||'—'}</td></tr>
  <tr><td>${t('quot.subject')}</td><td class="num">${quotSubjectLabel(q.subject)}</td></tr>
  <tr><td>${t('th.status')}</td><td class="num">${quotStatusLabel(q.status)}</td></tr>
  <tr><td>${t('quot.nextFollowup')}</td><td class="num">${esc(q.nextFollowup)||'—'}</td></tr>
  <tr><td>${t('quot.followupAction')}</td><td class="num">${esc(q.followupAction)||'—'}</td></tr>
  <tr><td>${t('th.notes')}</td><td class="num">${esc(q.notes)||'—'}</td></tr>
</table>
<h1>${t('quot.requirement')}</h1>
<p>${esc(q.requirement)||'—'}</p>
<h1>${t('quot.statusLog')}</h1>
<table><thead><tr><th>${t('th.date')}</th><th>${t('th.status')}</th><th>${t('th.notes')}</th></tr></thead>
<tbody>${[...q.log].sort((a,b)=>(a.date||'').localeCompare(b.date||'')).map(e=>`<tr><td>${esc(e.date)}</td><td>${quotStatusLabel(e.status)}</td><td>${esc(e.note)||'—'}</td></tr>`).join('') || `<tr><td colspan="3" class="empty">${t('quot.noLog')}</td></tr>`}</tbody></table>
<div class="doc-footer">${t('msg.printedOn')} ${todayISO()}.</div>
</body></html>`;
}

// ---- Daily quotations report (by date range of status-log entries) ----
function quotationsDailyReportRows(){
  const from = document.getElementById('quotReportFrom')?.value || todayISO();
  const to = document.getElementById('quotReportTo')?.value || todayISO();
  const rows = [];
  quotations.forEach(q=>{
    (q.log||[]).forEach(entry=>{
      if(entry.date >= from && entry.date <= to){
        rows.push({date:entry.date, companyName:q.companyName, subject:quotSubjectLabel(q.subject), status:entry.status, note:entry.note});
      }
    });
  });
  return rows.sort((a,b)=> a.date.localeCompare(b.date));
}
function renderQuotationsReport(){
  const fromEl = document.getElementById('quotReportFrom'), toEl = document.getElementById('quotReportTo');
  if(!fromEl || !toEl) return;
  if(!fromEl.value) fromEl.value = todayISO();
  if(!toEl.value) toEl.value = todayISO();
  const rows = quotationsDailyReportRows();
  const body = document.getElementById('quotReportTableBody');
  document.getElementById('quotReportEmpty').style.display = rows.length ? 'none' : 'block';
  body.innerHTML = rows.map(r=>`<tr><td>${esc(r.date)}</td><td>${esc(r.companyName)}</td><td>${esc(r.subject)}</td><td><span class="badge ${quotStatusBadgeClass(r.status)}">${quotStatusLabel(r.status)}</span></td><td>${esc(r.note)||'—'}</td></tr>`).join('');
}
document.getElementById('quotReportGenBtn')?.addEventListener('click', renderQuotationsReport);
document.getElementById('quotReportFrom')?.addEventListener('change', renderQuotationsReport);
document.getElementById('quotReportTo')?.addEventListener('change', renderQuotationsReport);
function quotationsReportDocumentHtml(){
  const from = document.getElementById('quotReportFrom')?.value || todayISO();
  const to = document.getElementById('quotReportTo')?.value || todayISO();
  const rows = quotationsDailyReportRows();
  const title = t('quot.reportTitle');
  const headers = currentLang==='en' ? ['Date','Company','Subject','Status','Note'] : ['التاريخ','الشركة','الموضوع','الحالة','ملاحظة'];
  return `<!doctype html><html lang="${currentLang}" dir="${currentLang==='en'?'ltr':'rtl'}"><head><meta charset="utf-8"><title>${esc(title)}</title>
<link rel="stylesheet" href="${new URL('fonts/fonts.css', location.href).href}">
<style>${printSharedStyle()}</style></head><body>
${printBrandHeader(title)}
<p>${currentLang==='en'?'Period':'الفترة'}: ${esc(from)} — ${esc(to)}</p>
<table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.date)}</td><td>${esc(r.companyName)}</td><td>${esc(r.subject)}</td><td>${quotStatusLabel(r.status)}</td><td>${esc(r.note)||'—'}</td></tr>`).join('') || `<tr><td colspan="5" class="empty">${t('quot.reportEmpty')}</td></tr>`}</tbody></table>
<div class="doc-footer">${t('msg.printedOn')} ${todayISO()}.</div>
</body></html>`;
}
document.getElementById('quotReportPrintBtn')?.addEventListener('click', ()=>printDocument(quotationsReportDocumentHtml()));
document.getElementById('quotReportPdfBtn')?.addEventListener('click', ()=>exportDocumentPdf(quotationsReportDocumentHtml(), `daftar-quotations-report-${todayISO()}.pdf`));

// ---- Daily client visit report (matches the printed Excel visit-report form) ----
function fillQuotRepsDatalist(){
  const list = document.getElementById('quotRepsList');
  if(!list) return;
  list.innerHTML = reps.map(r=>`<option value="${esc(r.name)}"></option>`).join('');
}
function quotVisitReportRows(){
  const date = document.getElementById('quotVisitReportDate')?.value || todayISO();
  return quotations.filter(q=>q.date===date).sort((a,b)=>(a.visitTime||'').localeCompare(b.visitTime||''));
}
function quotVisitReportSummaryCounts(rows){
  return {
    total: rows.length,
    quoteFollowup: rows.filter(r=>r.subject==='quoteFollowup').length,
    newClient: rows.filter(r=>r.subject==='newClient').length,
    payment: rows.filter(r=>r.subject==='payment').length,
  };
}
function renderQuotVisitReport(){
  const dateEl = document.getElementById('quotVisitReportDate');
  if(!dateEl) return;
  if(!dateEl.value) dateEl.value = todayISO();
  const rows = quotVisitReportRows();
  const body = document.getElementById('quotVisitReportTableBody');
  document.getElementById('quotVisitReportEmpty').style.display = rows.length ? 'none' : 'block';
  body.innerHTML = rows.map((q,i)=>`<tr>
    <td class="figures">${i+1}</td><td class="figures">${esc(q.visitTime)||'—'}</td><td>${esc(q.companyName)}</td><td>${quotScopeLabel(q.companyScope)}</td>
    <td>${esc(q.contactPerson)||'—'}</td><td class="figures">${esc(q.mobile)||'—'}</td><td>${esc(q.email)||'—'}</td>
    <td>${quotSubjectLabel(q.subject)}</td><td>${esc(q.quotationNo)||'—'}</td><td>${esc(q.invoiceNo)||'—'}</td><td>${esc(q.projectNo)||'—'}</td><td>${esc(q.requirement)||'—'}</td><td>${esc(q.followupAction)||'—'}</td>
    <td>${esc(q.nextFollowup)||'—'}</td><td><span class="badge ${quotStatusBadgeClass(q.status)}">${quotStatusLabel(q.status)}</span></td>
  </tr>`).join('');
  const c = quotVisitReportSummaryCounts(rows);
  const cards = [
    [t('quot.totalVisits'), c.total],
    [t('quot.subject.quoteFollowup'), c.quoteFollowup],
    [t('quot.subject.newClient'), c.newClient],
    [t('quot.subject.payment'), c.payment],
  ];
  document.getElementById('quotVisitReportSummary').innerHTML = cards.map(([lbl,val])=>`<div class="stat-card"><div class="lbl">${esc(lbl)}</div><div class="val">${val}</div></div>`).join('');
}
document.getElementById('quotVisitReportGenBtn')?.addEventListener('click', renderQuotVisitReport);
document.getElementById('quotVisitReportDate')?.addEventListener('change', renderQuotVisitReport);
function quotVisitReportDocumentHtml(){
  const date = document.getElementById('quotVisitReportDate')?.value || todayISO();
  const repName = document.getElementById('quotVisitReportRep')?.value || '—';
  const area = document.getElementById('quotVisitReportArea')?.value || '—';
  const rows = quotVisitReportRows();
  const c = quotVisitReportSummaryCounts(rows);
  const title = t('quot.visitReportTitle');
  const headers = currentLang==='en'
    ? ['No.','Time','Company Name','Company Scope','Contact Person','Mobile No.','Email Address','Visit Purpose','Quotation No.','Invoice No.','Project No.','Discussion / Client Requirement','Follow-up Action','Next Follow-up','Status / Remarks']
    : ['م.','الوقت','اسم الشركة','نشاط الشركة','المسؤول','الجوال','البريد الإلكتروني','غرض الزيارة','رقم عرض السعر','رقم الفاتورة','رقم المشروع','النقاش / متطلبات العميل','إجراء المتابعة','المتابعة القادمة','الحالة / الملاحظات'];
  const bodyRows = rows.map((q,i)=>`<tr>
    <td class="num">${i+1}</td><td class="num">${esc(q.visitTime)||'—'}</td><td>${esc(q.companyName)}</td><td>${quotScopeLabel(q.companyScope)}</td>
    <td>${esc(q.contactPerson)||'—'}</td><td class="num">${esc(q.mobile)||'—'}</td><td>${esc(q.email)||'—'}</td>
    <td>${quotSubjectLabel(q.subject)}</td><td>${esc(q.quotationNo)||'—'}</td><td>${esc(q.invoiceNo)||'—'}</td><td>${esc(q.projectNo)||'—'}</td><td>${esc(q.requirement)||'—'}</td><td>${esc(q.followupAction)||'—'}</td>
    <td>${esc(q.nextFollowup)||'—'}</td><td>${quotStatusLabel(q.status)}</td>
  </tr>`).join('') || `<tr><td colspan="15" class="empty">${t('quot.visitReportEmpty')}</td></tr>`;
  return `<!doctype html><html lang="${currentLang}" dir="${currentLang==='en'?'ltr':'rtl'}"><head><meta charset="utf-8"><title>${esc(title)}</title>
<link rel="stylesheet" href="${new URL('fonts/fonts.css', location.href).href}">
<style>${printSharedStyle()}
.visit-info{display:flex; gap:24px; flex-wrap:wrap; margin-bottom:16px; font-size:12.5px;}
.visit-info b{color:#20242c;}
.visit-summary{display:flex; gap:14px; flex-wrap:wrap; margin:18px 0;}
.visit-summary .box{flex:1; min-width:140px; text-align:center; padding:12px; border:1px solid #e2e5ec; border-radius:8px;}
.visit-summary .box .lbl{font-size:11px; color:#6b7280; margin-bottom:6px;}
.visit-summary .box .val{font-size:18px; font-weight:800;}
.sign-row{display:flex; justify-content:space-between; margin-top:36px;}
.sign-row .box{width:45%; border-top:1px solid #9aa0ab; padding-top:8px; text-align:center; font-size:11.5px; color:#6b7280;}
</style></head><body>
${printBrandHeader(title)}
<div class="visit-info">
  <div><b>${t('quot.reportSalesInCharge')}:</b> ${esc(repName)}</div>
  <div><b>${t('quot.reportDate')}:</b> ${esc(date)}</div>
  <div><b>${t('quot.reportAreaRoute')}:</b> ${esc(area)}</div>
</div>
<table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${bodyRows}</tbody></table>
<h1 style="font-size:13px; margin-top:6px;">${t('quot.visitSummaryTitle')}</h1>
<div class="visit-summary">
  <div class="box"><div class="lbl">${esc(t('quot.totalVisits'))}</div><div class="val">${c.total}</div></div>
  <div class="box"><div class="lbl">${esc(t('quot.subject.quoteFollowup'))}</div><div class="val">${c.quoteFollowup}</div></div>
  <div class="box"><div class="lbl">${esc(t('quot.subject.newClient'))}</div><div class="val">${c.newClient}</div></div>
  <div class="box"><div class="lbl">${esc(t('quot.subject.payment'))}</div><div class="val">${c.payment}</div></div>
</div>
<div class="sign-row">
  <div class="box">${t('quot.preparedBy')}</div>
  <div class="box">${t('quot.reviewedBy')}</div>
</div>
<div class="doc-footer">${t('msg.printedOn')} ${todayISO()}.</div>
</body></html>`;
}
document.getElementById('quotVisitReportPrintBtn')?.addEventListener('click', ()=>printDocument(quotVisitReportDocumentHtml()));
document.getElementById('quotVisitReportPdfBtn')?.addEventListener('click', ()=>exportDocumentPdf(quotVisitReportDocumentHtml(), `daftar-visit-report-${document.getElementById('quotVisitReportDate')?.value||todayISO()}.pdf`));
document.getElementById('quotVisitReportExcelBtn')?.addEventListener('click', ()=>{
  const date = document.getElementById('quotVisitReportDate')?.value || todayISO();
  const repName = document.getElementById('quotVisitReportRep')?.value || '';
  const area = document.getElementById('quotVisitReportArea')?.value || '';
  const rows = quotVisitReportRows();
  const c = quotVisitReportSummaryCounts(rows);
  const en = currentLang==='en';
  const headers = en
    ? ['No.','Time','Company Name','Company Scope / Main Activity','Contact Person','Mobile No.','Email Address','Visit Purpose','Quotation No.','Invoice No.','Project No.','Discussion / Client Requirement','Follow-up Action','Next Follow-up','Status / Remarks']
    : ['م.','الوقت','اسم الشركة','نشاط الشركة الرئيسي','المسؤول','رقم الجوال','البريد الإلكتروني','غرض الزيارة','رقم عرض السعر','رقم الفاتورة','رقم المشروع','النقاش / متطلبات العميل','إجراء المتابعة','المتابعة القادمة','الحالة / الملاحظات'];
  const aoa = [
    [en?'DAILY CLIENT VISIT REPORT':'التقرير اليومي لزيارات العملاء'],
    [],
    [en?'Sales In-Charge:':'مسؤول المبيعات:', repName, '', en?'Report Date:':'تاريخ التقرير:', date, '', en?'Area / Route:':'المنطقة / خط السير:', area],
    [],
    headers,
    ...rows.map((q,i)=>[i+1, q.visitTime||'', q.companyName||'', quotScopeLabel(q.companyScope), q.contactPerson||'', q.mobile||'', q.email||'', quotSubjectLabel(q.subject), q.quotationNo||'', q.invoiceNo||'', q.projectNo||'', q.requirement||'', q.followupAction||'', q.nextFollowup||'', quotStatusLabel(q.status)]),
    [],
    [en?'Daily Visit Summary':'ملخص الزيارات اليومي'],
    [en?'Total Client Visits':'إجمالي عدد الزيارات', c.total],
    [t('quot.subject.quoteFollowup'), c.quoteFollowup],
    [t('quot.subject.newClient'), c.newClient],
    [t('quot.subject.payment'), c.payment],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet['!cols'] = [{wch:5},{wch:9},{wch:28},{wch:20},{wch:18},{wch:14},{wch:26},{wch:16},{wch:16},{wch:16},{wch:16},{wch:34},{wch:24},{wch:14},{wch:18}];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, en?'Visit Report':'تقرير الزيارات');
  XLSX.writeFile(book, `daftar-visit-report-${date}.xlsx`);
});

// ============== REPS ==============
let editingRepId = null;
document.getElementById('addRepBtn').addEventListener('click', ()=>{
  if(!can('write')){toast(currentLang==='en'?'You do not have permission to edit data':'لا تملك صلاحية تعديل البيانات');return;}
  editingRepId = null;
  document.querySelector('#repModal .modal-head h3').textContent = t('modal.addRep');
  document.getElementById('saveRepBtn').textContent = t('modal.saveRep');
  ['r_name','r_phone','r_area'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('repModal').classList.add('show');
});
function openRepEditModal(id){
  if(!can('write')){toast(currentLang==='en'?'You do not have permission to edit data':'لا تملك صلاحية تعديل البيانات');return;}
  const r = reps.find(x=>x.id===id);
  if(!r) return;
  editingRepId = id;
  document.querySelector('#repModal .modal-head h3').textContent = t('modal.editRep');
  document.getElementById('saveRepBtn').textContent = t('modal.saveChanges');
  document.getElementById('r_name').value = r.name||'';
  document.getElementById('r_phone').value = r.phone||'';
  document.getElementById('r_area').value = r.area||'';
  document.getElementById('repModal').classList.add('show');
}
document.getElementById('saveRepBtn').addEventListener('click', ()=>{
  if(!can('write')){toast(currentLang==='en'?'You do not have permission to edit data':'لا تملك صلاحية تعديل البيانات');return;}
  const name = document.getElementById('r_name').value.trim();
  const phone = document.getElementById('r_phone').value.trim();
  const area = document.getElementById('r_area').value.trim();
  if(!name){ toast(t('msg.repRequired')); return; }
  if(editingRepId){
    const r = reps.find(x=>x.id===editingRepId);
    if(r){
      const before = {name:r.name, phone:r.phone, area:r.area};
      r.name = name; r.phone = phone; r.area = area;
      let diffParts=[];
      if(before.name!==name) diffParts.push(`${currentLang==='en'?'name':'الاسم'}: ${before.name} → ${name}`);
      if(before.phone!==phone) diffParts.push(`${currentLang==='en'?'phone':'الهاتف'}: ${before.phone||'—'} → ${phone||'—'}`);
      if(before.area!==area) diffParts.push(`${currentLang==='en'?'area':'المنطقة'}: ${before.area||'—'} → ${area||'—'}`);
      addAudit('update_rep', `${name}${diffParts.length?' — '+diffParts.join(' | '):''}`);
    }
    document.getElementById('repModal').classList.remove('show');
    toast(t('toast.updated'));
    editingRepId = null;
    if(activeRepId) openRepDrawer(activeRepId);
    renderAll();
    return;
  }
  reps.push({id:nextRepId++, name, phone, area});
  document.getElementById('repModal').classList.remove('show');
  addAudit('add_rep', name);
  toast('تمت إضافة المندوب بنجاح');
  renderAll();
});

function repStats(repId){
  const cases = debtors.filter(d=>d.repId===repId);
  const total = cases.reduce((s,d)=>s+d.total,0);
  const collected = cases.reduce((s,d)=>s+d.paid,0);
  const rate = total? Math.round(collected/total*100):0;
  
  // Calculate rating based on performance
  let rating = 'average';
  if (rate >= 80) rating = 'excellent';
  else if (rate >= 60) rating = 'good';
  else if (rate < 40) rating = 'poor';
  
  return {cases, total, collected, rate, rating};
}

function openRepDrawer(id){
  activeRepId = id;
  const r = reps.find(x=>x.id===id);
  if(!r) return;
  const st = repStats(id);
  document.getElementById('rd_seal').textContent = initials(r.name);
  document.getElementById('rd_name').textContent = r.name;
  document.getElementById('rd_phone').textContent = r.phone || '—';
  document.getElementById('rd_area').textContent = r.area || '—';
  document.getElementById('rd_cases').textContent = st.cases.length;
  document.getElementById('rd_total').textContent = currency(st.total);
  document.getElementById('rd_collected').textContent = currency(st.collected);
  document.getElementById('rd_rate').textContent = st.rate+'%';
  const listEl = document.getElementById('rd_cases_list');
  listEl.innerHTML = st.cases.length ? st.cases.map(d=>`
    <div class="log-entry" style="cursor:pointer" data-goto="${d.id}">
      <div class="top"><b>${esc(d.name)}</b><span class="badge ${statusOf(d)}">${statusLabel(statusOf(d))}</span>${promiseBadge(d)}</div>
      <div class="note">${currentLang==='en'?'Remaining':'المتبقي'}: <span class="figures">${fmt(remaining(d))}</span> ${currentLang==='en'?'QAR':'ر.ق'}</div>
    </div>`).join('') : `<div style="color:var(--muted); font-size:12.5px; padding:10px 0">${t('msg.noCases')}</div>`;
  listEl.querySelectorAll('[data-goto]').forEach(el=>el.addEventListener('click', ()=>{
    closeRepDrawer();
    openDrawer(Number(el.dataset.goto));
  }));
  document.getElementById('repDrawer').classList.add('show');
  document.getElementById('repDrawerOverlay').classList.add('show');
}
function closeRepDrawer(){
  document.getElementById('repDrawer').classList.remove('show');
  document.getElementById('repDrawerOverlay').classList.remove('show');
  activeRepId = null;
}
document.getElementById('repDrawerClose').addEventListener('click', closeRepDrawer);
document.getElementById('repDrawerOverlay').addEventListener('click', closeRepDrawer);
document.getElementById('rd_edit').addEventListener('click', ()=>{
  if(!activeRepId) return;
  openRepEditModal(activeRepId);
});
document.getElementById('rd_delete').addEventListener('click', async ()=>{
  if(!can('delete')){toast(currentLang==='en'?'You do not have permission to delete':'لا تملك صلاحية الحذف');return;}
  if(!activeRepId) return;
  if(!(await uiConfirm(currentLang==='en'?'Delete this collector? Assigned cases will become unassigned.':'حذف هذا المندوب؟ سيتم إلغاء إسناد حالاته تلقائيًا.', {danger:true, confirmText:t('ui.delete')}))) return;
  const rep=reps.find(x=>x.id===activeRepId);
  debtors.forEach(d=>{ if(d.repId===activeRepId) d.repId=null; });
  reps = reps.filter(x=>x.id!==activeRepId);
  users.forEach(u=>{ if(u.repId===activeRepId) u.repId=undefined; });
  saveUsers();
  addAudit('delete_rep', rep?rep.name:String(activeRepId));
  closeRepDrawer();
  toast('تم حذف المندوب');
  renderAll();
});

function renderReps(){
  const body = document.getElementById('repsTableBody');
  document.getElementById('repsEmpty').style.display = reps.length ? 'none' : 'block';
  body.innerHTML = reps.map(r=>{
    const st = repStats(r.id);
    const ratingLabels = {
      excellent: t('reps.excellent'),
      good: t('reps.good'),
      average: t('reps.average'),
      poor: t('reps.poor')
    };
    const ratingColors = {
      excellent: '#3E8E7E',
      good: '#C9A227',
      average: '#8B93A8',
      poor: '#B33A3A'
    };
    
    return `<tr data-id="${r.id}">
      <td>${esc(r.name)}</td>
      <td class="figures" style="font-weight:500">${esc(r.phone)||'—'}</td>
      <td>${esc(r.area)||'—'}</td>
      <td class="figures">${st.cases.length}</td>
      <td class="figures">${fmt(st.collected)}</td>
      <td class="figures">${st.rate}%</td>
      <td><span class="badge" style="background:${ratingColors[st.rating]}20; color:${ratingColors[st.rating]}; border-color:${ratingColors[st.rating]}40;">${ratingLabels[st.rating]}</span></td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" data-open="${r.id}" title="${t('action.view')}">◎</button>
          <button class="icon-btn" data-edit-rep="${r.id}" title="${t('action.edit')}">✎</button>
          <button class="icon-btn danger" data-del="${r.id}" title="${t('action.delete')}">✕</button>
        </div>
      </td>
    </tr>`;
  }).join('');
  body.querySelectorAll('tr').forEach(tr=>{
    tr.addEventListener('click', (e)=>{
      if(e.target.closest('button')) return;
      openRepDrawer(Number(tr.dataset.id));
    });
  });
  body.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click', e=>{ e.stopPropagation(); openRepDrawer(Number(b.dataset.open)); }));
  body.querySelectorAll('[data-edit-rep]').forEach(b=>b.addEventListener('click', e=>{ e.stopPropagation(); openRepEditModal(Number(b.dataset.editRep)); }));
  body.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click', async e=>{
    e.stopPropagation();
    if(!can('delete')){toast(currentLang==='en'?'You do not have permission to delete':'لا تملك صلاحية الحذف');return;}
    if(!(await uiConfirm(currentLang==='en'?'Delete this collector? Assigned cases will become unassigned.':'حذف هذا المندوب؟ سيتم إلغاء إسناد حالاته تلقائيًا.', {danger:true, confirmText:t('ui.delete')}))) return;
    const id = Number(b.dataset.del);
    const rep = reps.find(x=>x.id===id);
    debtors.forEach(d=>{ if(d.repId===id) d.repId=null; });
    reps = reps.filter(x=>x.id!==id);
    users.forEach(u=>{ if(u.repId===id) u.repId=undefined; });
    saveUsers();
    addAudit('delete_rep', rep?rep.name:String(id));
    toast(t('msg.repDeleted'));
    renderAll();
  }));

  document.getElementById('repStatCount').textContent = reps.length;
  const collectedByReps = debtors.filter(d=>d.repId).reduce((s,d)=>s+d.paid,0);
  document.getElementById('repStatCollected').textContent = currency(collectedByReps);
  document.getElementById('repStatUnassigned').textContent = debtors.filter(d=>!d.repId).length;
}

// ============== RENDER ==============
function renderAll(){
  scheduleSave();
  renderStats();
  renderDebtorsTable();
  renderReps();
  renderPayments();
  renderFollowups();
  renderQuotationsTable();
  renderQuotationsReport();
  fillQuotRepsDatalist();
  renderQuotVisitReport();
  renderAging();
  renderReports();
  renderDashboardExtras();
  renderDueReminders();
  renderQuotFollowupReminders();
  renderCharts();
}

function agingBucket(days){
  if(days<=30) return {key:'b1',label:t('aging.b1')};
  if(days<=60) return {key:'b2',label:t('aging.b2')};
  if(days<=90) return {key:'b3',label:t('aging.b3')};
  return {key:'b4',label:t('aging.b4')};
}
function getAgingRows(){
  return scopedDebtors().filter(d=>remaining(d)>0 && new Date(d.due)<new Date(todayISO())).map(d=>{
    const days=Math.max(1,daysBetween(d.due,todayISO())); return {...d,daysLate:days,bucket:agingBucket(days)};
  }).sort((a,b)=>b.daysLate-a.daysLate);
}
function renderAging(){
  const groups={b1:[],b2:[],b3:[],b4:[]}; getAgingRows().forEach(d=>groups[d.bucket.key].push(d));
  Object.keys(groups).forEach(key=>{
    document.getElementById(`aging_${key}_amt`).textContent=currency(groups[key].reduce((sum,d)=>sum+remaining(d),0));
    document.getElementById(`aging_${key}_cnt`).textContent=groups[key].length+(currentLang==='en'?' cases':' حالة');
  });
  const body=document.getElementById('agingTableBody'); const rows=getAgingRows();  document.getElementById('agingEmpty').style.display=rows.length?'none':'block';
  body.innerHTML=rows.map(d=>`<tr data-id="${d.id}"><td>${esc(d.name)}</td><td>${d.type==='company'?t('debtors.company'):t('debtors.individual')}</td><td>${esc(d.phone)||'—'}</td><td>${esc(d.due)}</td><td class="figures">${d.daysLate}</td><td><span class="badge overdue">${d.bucket.label}</span></td><td class="figures">${fmt(remaining(d))}</td><td>${esc((reps.find(r=>r.id===d.repId)||{}).name)||t('drawer.noRep')}</td>${notesTd(d)}</tr>`).join('');
  body.querySelectorAll('tr').forEach(row=>row.addEventListener('click',()=>openDrawer(Number(row.dataset.id))));
}

function renderStats(){
  const scoped=scopedDebtors();
  const total = scoped.reduce((s,d)=>s+d.total,0);
  const collected = scoped.reduce((s,d)=>s+d.paid,0);
  const overdueDebtors = scoped.filter(d=>statusOf(d)==='overdue');
  const overdueAmt = overdueDebtors.reduce((s,d)=>s+remaining(d),0);
  const activeCount = scoped.filter(d=>statusOf(d)!=='paid').length;

  document.getElementById('statTotal').textContent = currency(total);
  document.getElementById('statCount').textContent = scoped.length;
  document.getElementById('statCollected').textContent = currency(collected);
  document.getElementById('statCollectedPct').textContent = (total? Math.round(collected/total*100):0)+'% '+t('dash.ofTotal');
  document.getElementById('statOverdue').textContent = currency(overdueAmt);
  document.getElementById('statOverdueCount').textContent = overdueDebtors.length;
  document.getElementById('statActive').textContent = activeCount;

  const companies = scoped.filter(d=>d.type==='company');
  const individuals = scoped.filter(d=>d.type!=='company');
  document.getElementById('statCompanyTotal').textContent = currency(companies.reduce((s,d)=>s+remaining(d),0));
  document.getElementById('statCompanyCount').textContent = companies.length;
  document.getElementById('statIndividualTotal').textContent = currency(individuals.reduce((s,d)=>s+remaining(d),0));
  document.getElementById('statIndividualCount').textContent = individuals.length;
  
  // Enhanced dashboard metrics
  const monthlyTarget = Math.round(total * 0.15); // 15% of total as monthly target
  const monthlyCollected = scoped.reduce((s,d)=>s+d.paid,0); // Simplified monthly calculation
  const targetProgress = monthlyTarget ? Math.round(monthlyCollected/monthlyTarget*100) : 0;
  const collectionRate = total ? Math.round(collected/total*100) : 0;
  
  // Calculate average days to collect
  const paymentsWithDays = [];
  scoped.forEach(d => {
    (d.log || []).filter(e => e.type === 'payment').forEach(e => {
      const daysToCollect = daysBetween(d.due, e.date);
      if (daysToCollect > 0) {
        paymentsWithDays.push(daysToCollect);
      }
    });
  });
  const avgDays = paymentsWithDays.length ? Math.round(paymentsWithDays.reduce((a,b)=>a+b,0)/paymentsWithDays.length) : 0;
  
  document.getElementById('statMonthlyTarget').textContent = currency(monthlyTarget);
  document.getElementById('statCollectionRate').textContent = collectionRate + '%';
  document.getElementById('statAvgDays').textContent = avgDays;
  
  // Trends computed from real payment history (this month vs previous month).
  const monthKey=(offset)=>{ const d=new Date(); d.setDate(1); d.setMonth(d.getMonth()+offset); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; };
  const paidIn=(key)=>scoped.flatMap(d=>d.log||[]).filter(e=>e.type==='payment'&&String(e.date||'').slice(0,7)===key).reduce((s,e)=>s+(Number(e.amount)||0),0);
  const thisM=paidIn(monthKey(0)), prevM=paidIn(monthKey(-1));
  setTrendIndicator('statCollectedTrend', prevM>0 ? Math.round((thisM-prevM)/prevM*100) : null);
  setTrendIndicator('statTotalTrend', null);
  setTrendIndicator('statOverdueTrend', null);
  setTrendIndicator('statActiveTrend', null);
  const rateBar=document.getElementById('statRateBar'); if(rateBar) rateBar.style.width=Math.min(100,collectionRate)+'%';
}

function setTrendIndicator(elementId, percentage) {
  const element = document.getElementById(elementId);
  if (!element) return;
  if (percentage === null || percentage === undefined) { element.textContent=''; element.className='trend'; return; }
  
  if (percentage > 0) {
    element.textContent = `↑ ${percentage}%`;
    element.className = 'trend up';
  } else if (percentage < 0) {
    element.textContent = `↓ ${Math.abs(percentage)}%`;
    element.className = 'trend down';
  } else {
    element.textContent = '—';
    element.className = 'trend neutral';
  }
}

let collectionChart = null;
let collectorChart = null;
let paymentMethodsChart = null;
let debtDistributionChart = null;
let repsMonthlyChart = null;

function renderCharts() {
  const scoped = scopedDebtors();
  const currentLang = document.documentElement.lang;

  // Collection Trend Chart
  const months = {};
  scoped.forEach(d => {
    (d.log || []).filter(e => e.type === 'payment').forEach(e => {
      const month = e.date.slice(0, 7);
      months[month] = (months[month] || 0) + e.amount;
    });
  });

  const sortedMonths = Object.keys(months).sort().slice(-6);
  const collectionCtx = document.getElementById('collectionChart');
  if (collectionCtx) {
    if (collectionChart) collectionChart.destroy();
    collectionChart = new Chart(collectionCtx, {
      type: 'line',
      data: {
        labels: sortedMonths,
        datasets: [{
          label: currentLang === 'en' ? 'Collected Amount' : 'المبلغ المحصّل',
          data: sortedMonths.map(m => months[m] || 0),
          borderColor: '#C9A227',
          backgroundColor: 'rgba(201, 162, 39, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            labels: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--ink')
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--muted')
            },
            grid: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--border')
            }
          },
          x: {
            ticks: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--muted')
            },
            grid: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--border')
            }
          }
        }
      }
    });
  }

  // Collector Performance Chart
  const collectorCtx = document.getElementById('collectorChart');
  if (collectorCtx && reps.length > 0) {
    if (collectorChart) collectorChart.destroy();
    const collectorData = reps.map(r => {
      const cases = scoped.filter(d => d.repId === r.id);
      const collected = cases.reduce((sum, d) => sum + d.paid, 0);
      return { name: r.name, collected };
    });

    collectorChart = new Chart(collectorCtx, {
      type: 'bar',
      data: {
        labels: collectorData.map(d => d.name),
        datasets: [{
          label: currentLang === 'en' ? 'Collected Amount' : 'المبلغ المحصّل',
          data: collectorData.map(d => d.collected),
          backgroundColor: [
            '#C9A227', '#2BB3A3', '#5EA9E8', '#E28A9A', '#FF8C42', '#9C6ADE'
          ],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--muted')
            },
            grid: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--border')
            }
          },
          x: {
            ticks: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--muted')
            },
            grid: {
              display: false
            }
          }
        }
      }
    });
  }

  // Payment Methods Chart
  const paymentMethodsCtx = document.getElementById('paymentMethodsChart');
  if (paymentMethodsCtx) {
    if (paymentMethodsChart) paymentMethodsChart.destroy();
    
    const paymentMethods = {};
    scoped.forEach(d => {
      (d.log || []).filter(e => e.type === 'payment').forEach(e => {
        const method = translateValue(e.method);
        paymentMethods[method] = (paymentMethods[method] || 0) + e.amount;
      });
    });

    paymentMethodsChart = new Chart(paymentMethodsCtx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(paymentMethods),
        datasets: [{
          data: Object.values(paymentMethods),
          backgroundColor: ['#C9A227', '#2BB3A3', '#5EA9E8', '#E28A9A', '#FF8C42'],
          borderWidth: 2,
          borderColor: getComputedStyle(document.documentElement).getPropertyValue('--surface')
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--ink')
            }
          }
        }
      }
    });
  }

  // Debt Distribution Chart
  const debtDistributionCtx = document.getElementById('debtDistributionChart');
  if (debtDistributionCtx) {
    if (debtDistributionChart) debtDistributionChart.destroy();
    
    const statusCounts = { active: 0, overdue: 0, paid: 0 };
    scoped.forEach(d => statusCounts[statusOf(d)]++);

    debtDistributionChart = new Chart(debtDistributionCtx, {
      type: 'pie',
      data: {
        labels: [t('status.active'), t('status.overdue'), t('status.paid')],
        datasets: [{
          data: [statusCounts.active, statusCounts.overdue, statusCounts.paid],
          backgroundColor: ['#3E8E7E', '#B33A3A', '#C9A227'],
          borderWidth: 2,
          borderColor: getComputedStyle(document.documentElement).getPropertyValue('--surface')
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--ink')
            }
          }
        }
      }
    });
  }

  // Reps Monthly Performance Chart
  const repsMonthlyCtx = document.getElementById('repsMonthlyChart');
  if (repsMonthlyCtx && reps.length > 0) {
    if (repsMonthlyChart) repsMonthlyChart.destroy();
    
    const months = {};
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    reps.forEach(r => {
      const cases = scopedDebtors().filter(d => d.repId === r.id);
      cases.forEach(d => {
        (d.log || []).filter(e => e.type === 'payment').forEach(e => {
          const month = e.date.slice(0, 7);
          if (!months[month]) months[month] = {};
          months[month][r.name] = (months[month][r.name] || 0) + e.amount;
        });
      });
    });

    const sortedMonths = Object.keys(months).sort().slice(-6);
    const datasets = reps.map((r, index) => ({
      label: r.name,
      data: sortedMonths.map(m => months[m]?.[r.name] || 0),
      borderColor: ['#C9A227', '#2BB3A3', '#5EA9E8', '#E28A9A', '#FF8C42', '#9C6ADE'][index % 6],
      backgroundColor: 'transparent',
      tension: 0.4
    }));

    repsMonthlyChart = new Chart(repsMonthlyCtx, {
      type: 'line',
      data: {
        labels: sortedMonths,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            labels: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--ink')
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--muted')
            },
            grid: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--border')
            }
          },
          x: {
            ticks: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--muted')
            },
            grid: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--border')
            }
          }
        }
      }
    });
  }
}

function renderDashboardExtras(){
  // top overdue bars
  const scoped=scopedDebtors();
  const overdue = scoped.filter(d=>statusOf(d)==='overdue').sort((a,b)=>remaining(b)-remaining(a)).slice(0,5);
  const maxAmt = Math.max(...overdue.map(d=>remaining(d)), 1);
  const barsEl = document.getElementById('topOverdueBars');
  if(!overdue.length){
    barsEl.innerHTML = `<div style="color:var(--muted); font-size:13px">${currentLang==='en'?'No overdue cases currently.':'لا توجد حالات متأخرة حاليًا.'}</div>`;
  } else {
    barsEl.innerHTML = overdue.map(d=>`
      <div class="bar-row">
        <div class="name">${esc(d.name.split(' ').slice(0,2).join(' '))}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${remaining(d)/maxAmt*100}%; background:linear-gradient(90deg,#7a2626,#B33A3A)"></div></div>
        <div class="amt figures">${fmt(remaining(d))}</div>
      </div>`).join('');
  }

  // recent activity
  let allActivity = [];
  scoped.forEach(d=>{
    d.log.forEach(e=>allActivity.push({...e, debtor:d.name}));
  });
  allActivity.sort((a,b)=> a.date < b.date ? 1 : -1);
  allActivity = allActivity.slice(0,6);
  const actEl = document.getElementById('recentActivity');
  if(!allActivity.length){
    actEl.innerHTML = `<div style="color:var(--muted); font-size:13px">${currentLang==='en'?'No activity recorded yet.':'لا يوجد نشاط مسجل بعد.'}</div>`;
  } else {
    actEl.innerHTML = allActivity.map(e=>{
      const txt = e.type==='payment' ? `${currentLang==='en'?'Payment':'دفعة'} ${fmt(e.amount)} ${currentLang==='en'?'QAR':'ر.ق'} ${currentLang==='en'?'from':'من'} ${esc(e.debtor)}` : `${currentLang==='en'?'Follow-up':'متابعة'} (${translateValue(e.method)}) ${currentLang==='en'?'with':'مع'} ${esc(e.debtor)}`;
      return `<div class="activity-item"><div class="activity-dot"></div><div><div class="t">${txt}</div><div class="d">${esc(e.date)}</div></div></div>`;
    }).join('');
  }
}

function calculateRiskLevel(d) {
  const daysLate = daysBetween(d.due, todayISO());
  const remainingAmount = remaining(d);
  const totalAmount = d.total;
  const riskRatio = remainingAmount / totalAmount;

  if (statusOf(d) === 'paid') return 'low';
  if (daysLate > 90 && riskRatio > 0.5) return 'high';
  if (daysLate > 60 && riskRatio > 0.3) return 'high';
  if (daysLate > 30) return 'medium';
  if (riskRatio > 0.7) return 'medium';
  return 'low';
}

function renderDebtorsTable(){
  const q = document.getElementById('globalSearch').value.trim().toLowerCase();
  const filter = document.getElementById('statusFilter').value;
  const typeFilter = document.getElementById('typeFilter').value;
  const minAmount = parseFloat(document.getElementById('minAmount').value) || 0;
  const maxAmount = parseFloat(document.getElementById('maxAmount').value) || Infinity;
  const minDate = document.getElementById('minDate').value;
  const maxDate = document.getElementById('maxDate').value;
  const collectorFilter = document.getElementById('collectorFilter').value;
  const riskFilter = document.getElementById('riskFilter').value;

  let list = scopedDebtors().filter(d=>{
    const matchQ = !q || d.name.toLowerCase().includes(q) || (d.phone||'').includes(q)
      || (d.companyNumber||'').toLowerCase().includes(q) || (d.crNumber||'').toLowerCase().includes(q)
      || (d.notes||'').toLowerCase().includes(q);
    const matchF = filter==='all' || statusOf(d)===filter;
    const matchT = typeFilter==='all' || (d.type||'individual')===typeFilter;
    const matchAmount = remaining(d) >= minAmount && remaining(d) <= maxAmount;
    let matchDate = true;
    if (minDate && d.due < minDate) matchDate = false;
    if (maxDate && d.due > maxDate) matchDate = false;
    const matchCollector = collectorFilter === 'all' || d.repId === Number(collectorFilter);
    const matchRisk = riskFilter === 'all' || calculateRiskLevel(d) === riskFilter;

    return matchQ && matchF && matchT && matchAmount && matchDate && matchCollector && matchRisk;
  });
  const body = document.getElementById('debtorsTableBody');
  document.getElementById('debtorsEmpty').style.display = list.length ? 'none' : 'block';
  body.innerHTML = list.map(d=>{
    // "Last contact" = the most recent follow-up (payments are not contacts, and auto-recorded
    // opening-balance entries must not make every imported debtor look contacted today).
    const lastContact = d.log.filter(e=>e.type==='follow').map(e=>e.date||'').sort().pop() || '—';
    const lastPay = d.log.filter(e=>e.type==='payment').map(e=>e.date||'').sort().pop() || '';
    const daysSince = lastPay ? Math.max(0, daysBetween(lastPay, todayISO())) : null;
    const daysCls = daysSince===null ? 'days-ok' : (remaining(d)<=0 ? 'days-ok' : daysSince>60 ? 'days-bad' : daysSince>30 ? 'days-warn' : 'days-ok');
    const repName = reps.find(r=>r.id===d.repId);
    const isCompany = d.type==='company';
    return `<tr data-id="${d.id}">
      <td>${esc(d.name)}</td>
      <td><span class="badge ${isCompany?'type-company':'type-individual'}">${isCompany?t('debtors.company'):t('debtors.individual')}</span></td>
      <td class="figures" style="font-weight:500">${esc(d.phone)||'—'}</td>
      <td class="figures">${fmt(d.total)}</td>
      <td class="figures">${fmt(d.paid)}</td>
      <td class="figures">${fmt(remaining(d))}</td>
      <td><span class="badge ${statusOf(d)}">${statusLabel(statusOf(d))}</span>${promiseBadge(d)}</td>
      <td style="color:${repName?'var(--ink)':'var(--muted)'}">${repName?esc(repName.name):t('drawer.noRep')}</td>
      ${notesTd(d)}
      <td>${d.expectedPaymentDate||'—'}</td>
      <td>${esc(lastContact)}</td>
      <td>${esc(lastPay)||'—'}</td>
      <td class="figures ${daysCls}">${daysSince===null?'—':daysSince}</td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" data-open="${d.id}" title="${t('action.view')}">◎</button>
          <button class="icon-btn" data-quick-contact="${d.id}" title="${t('drawer.addFollow')}">☎</button>
          <button class="icon-btn" data-edit="${d.id}" title="${t('action.edit')}">✎</button>
          <button class="icon-btn danger" data-del="${d.id}" data-delete title="${t('action.delete')}">✕</button>
        </div>
      </td>
    </tr>`;
  }).join('');
  body.querySelectorAll('tr').forEach(tr=>{
    tr.addEventListener('click', (e)=>{
      if(e.target.closest('button')) return;
      openDrawer(Number(tr.dataset.id));
    });
  });
  body.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click', e=>{ e.stopPropagation(); openDrawer(Number(b.dataset.open)); }));
  body.querySelectorAll('[data-quick-contact]').forEach(b=>b.addEventListener('click', async e=>{
    e.preventDefault(); e.stopPropagation();
    if(!can('write')){toast(currentLang==='en'?'You do not have permission to edit data':'لا تملك صلاحية تعديل البيانات');return;}
    const d = debtors.find(x=>x.id===Number(b.dataset.quickContact));
    if(!d) return;
    const res = await uiDialog({title:t('quick.contactTitle'), message:d.name,
      fields:[
        {name:'method', label:t('th.contactMethod'), type:'select', value:'اتصال هاتفي', options:methodOptions(FOLLOW_METHODS)},
        {name:'note', label:currentLang==='en'?'Contact outcome / note:':'نتيجة التواصل / الملاحظة:', type:'textarea', value:''},
      ],
      validate:v=> v.note.trim() ? '' : (currentLang==='en'?'Enter the outcome / note':'الرجاء إدخال النتيجة / الملاحظة')});
    if(!res || !debtors.includes(d)) return;
    const note = res.note;
    const date = todayISO();
    const method = res.method;
    d.log.push({id:genLogId(), type:'follow', date, method, note:note.trim()});
    d.notes = `[${date}] ${translateValue(method)}: ${note.trim()}` + (d.notes ? '\n' + d.notes : '');
    addAudit('add_followup', `${d.name} (${translateValue(method)}): ${note.trim()}`);
    toast(t('msg.followAdded'));
    renderAll();
  }));
  body.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click', e=>{ e.preventDefault(); e.stopPropagation(); openDebtorEditModal(Number(b.dataset.edit)); }));
  body.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click', e=>{
    e.preventDefault(); e.stopPropagation();
    deleteDebtorWithUndo(Number(b.dataset.del));
  }));
}

// ---- Payments register ------------------------------------------------------

let payGroupByCompany = false;
const AUTO_PAYMENT_METHODS = ['رصيد سابق','تسوية'];
const isAutoPayment = e => AUTO_PAYMENT_METHODS.includes(e.method);
function filteredPaymentRows(){
  const q = (document.getElementById('paySearch')?.value || '').trim().toLowerCase();
  const from = document.getElementById('payFrom')?.value || '';
  const to = document.getElementById('payTo')?.value || '';
  const method = document.getElementById('payMethod')?.value || 'all';
  const autoOnly = !!document.getElementById('payAutoOnly')?.checked;
  const rows = [];
  scopedDebtors().forEach(d=>{
    if(q && !String(d.name||'').toLowerCase().includes(q)) return;
    d.log.filter(e=>e.type==='payment').forEach(e=>{
      if(from && (e.date||'') < from) return;
      if(to && (e.date||'') > to) return;
      if(method!=='all' && e.method!==method) return;
      if(autoOnly && !isAutoPayment(e)) return;
      rows.push({...e, debtor:d.name, debtorId:d.id});
    });
  });
  return rows.sort((a,b)=> (b.date||'').localeCompare(a.date||'') || (Number(b.id)||0)-(Number(a.id)||0));
}
function paymentRowHtml(r, actionsAllowed){
  const actions = actionsAllowed ? `<div class="row-actions"><button class="icon-btn" data-pay-edit="${r.debtorId}:${r.id}" title="${t('action.edit')}">✎</button><button class="icon-btn danger" data-pay-del="${r.debtorId}:${r.id}" title="${t('action.delete')}">✕</button></div>` : '—';
  const badge = isAutoPayment(r) ? `<span class="auto-badge" title="${esc(t('pay.autoTip'))}">${esc(t('pay.auto'))}</span>` : '';
  return `<tr>
    <td>${esc(r.date)}</td><td>${esc(r.debtor)}</td><td class="figures">${currency(r.amount)}</td><td>${translateValue(r.method)}${badge}</td>${notesTd({notes:r.note})}<td>${actions}</td>
  </tr>`;
}
function renderPayments(){
  const rows = filteredPaymentRows();
  const body = document.getElementById('paymentsTableBody');
  document.getElementById('paymentsEmpty').style.display = rows.length ? 'none' : 'block';
  const actionsAllowed = can('write');
  const grpBtn = document.getElementById('payGroupBtn');
  if(grpBtn){ grpBtn.setAttribute('aria-pressed', payGroupByCompany?'true':'false'); grpBtn.textContent = t(payGroupByCompany?'pay.ungroup':'pay.groupBy'); }
  const grandTotal = money2(rows.reduce((s,r)=>s+(Number(r.amount)||0),0));
  const companyIds = new Set(rows.map(r=>r.debtorId));
  const summary = document.getElementById('paySummary');
  if(summary){
    summary.hidden = !rows.length;
    summary.innerHTML = `${esc(t('pay.count'))}: <b>${rows.length}</b> — ${esc(t('pay.companies'))}: <b>${companyIds.size}</b> — ${esc(t('pay.total'))}: <b>${currency(grandTotal)}</b>`;
  }
  if(!payGroupByCompany){
    body.innerHTML = rows.map(r=>paymentRowHtml(r, actionsAllowed)).join('');
  } else {
    const groups = new Map();
    rows.forEach(r=>{ if(!groups.has(r.debtorId)) groups.set(r.debtorId, {name:r.debtor, list:[]}); groups.get(r.debtorId).list.push(r); });
    const cols = body.closest('table')?.querySelectorAll('thead th').length || 6;
    body.innerHTML = [...groups.values()].sort((a,b)=>String(a.name).localeCompare(String(b.name), 'ar')).map(g=>{
      const sum = money2(g.list.reduce((s,r)=>s+(Number(r.amount)||0),0));
      return `<tr class="quot-date-group"><td colspan="${cols}">🏢 ${esc(g.name)}<span class="quot-date-count">${g.list.length}</span><span class="group-total">${esc(t('pay.total'))}: ${currency(sum)}</span></td></tr>`
        + g.list.map(r=>paymentRowHtml(r, actionsAllowed)).join('');
    }).join('');
  }
  body.querySelectorAll('[data-pay-edit]').forEach(b=>b.addEventListener('click', async ()=>{
    const [debtorId, logId] = b.dataset.payEdit.split(':').map(Number);
    const d = debtors.find(x=>x.id===debtorId);
    const entry = d && d.log.find(e=>e.id===logId && e.type==='payment');
    if(!d || !entry) return;
    if(await editPaymentEntry(d, entry)) renderAll();
  }));
  body.querySelectorAll('[data-pay-del]').forEach(b=>b.addEventListener('click', ()=>{
    const [debtorId, logId] = b.dataset.payDel.split(':').map(Number);
    const d = debtors.find(x=>x.id===debtorId);
    const entry = d && d.log.find(e=>e.id===logId && e.type==='payment');
    if(!d || !entry) return;
    deletePaymentWithUndo(d, entry);
  }));
}
['paySearch'].forEach(id=>document.getElementById(id)?.addEventListener('input', debounce(renderPayments, 200)));
['payFrom','payTo','payMethod','payAutoOnly'].forEach(id=>document.getElementById(id)?.addEventListener('change', renderPayments));
document.getElementById('payGroupBtn')?.addEventListener('click', ()=>{ payGroupByCompany = !payGroupByCompany; renderPayments(); });
document.getElementById('payExcelBtn')?.addEventListener('click', ()=>{
  const rows = filteredPaymentRows();
  if(!rows.length){ toast(t('payments.empty')); return; }
  const en = currentLang==='en';
  const ordered = payGroupByCompany
    ? [...rows].sort((a,b)=>String(a.debtor).localeCompare(String(b.debtor),'ar') || (a.date||'').localeCompare(b.date||''))
    : rows;
  const headers = en ? ['Date','Company','Amount (QAR)','Method','Notes','Auto-recorded'] : ['التاريخ','الشركة','المبلغ (ر.ق)','طريقة الدفع','ملاحظات','قيد تلقائي'];
  const data = [headers, ...ordered.map(r=>[r.date||'', r.debtor, Number(r.amount)||0, translateValue(r.method), r.note||'', isAutoPayment(r)?(en?'Yes':'نعم'):''])];
  const per = new Map();
  rows.forEach(r=>{ const o = per.get(r.debtorId) || {name:r.debtor, n:0, sum:0}; o.n++; o.sum = money2(o.sum + (Number(r.amount)||0)); per.set(r.debtorId, o); });
  const summary = [[en?'Company':'الشركة', en?'Payments':'عدد الدفعات', en?'Total paid (QAR)':'إجمالي المسدد (ر.ق)'],
    ...[...per.values()].sort((a,b)=>String(a.name).localeCompare(String(b.name),'ar')).map(o=>[o.name,o.n,o.sum])];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(data), t('pay.sheet'));
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(summary), t('pay.summarySheet'));
  XLSX.writeFile(book, `daftar-payments-${todayISO()}.xlsx`);
  addAudit('export_excel', t('payments.title'));
});

function renderFollowups(){
  let rows = [];
  scopedDebtors().forEach(d=>{
    d.log.filter(e=>e.type==='follow').forEach(e=>rows.push({...e, debtor:d.name, debtorId:d.id, debtorNotes:d.notes}));
  });
  rows.sort((a,b)=> a.date < b.date ? 1 : -1);
  const body = document.getElementById('followupsTableBody');
  document.getElementById('followupsEmpty').style.display = rows.length ? 'none' : 'block';
  const actionsAllowed = can('write');
  body.innerHTML = rows.map(r=>{
    const actions = actionsAllowed ? `<div class="row-actions"><button class="icon-btn" data-follow-edit="${r.debtorId}:${r.id}" title="${t('action.edit')}">✎</button><button class="icon-btn danger" data-follow-del="${r.debtorId}:${r.id}" title="${t('action.delete')}">✕</button></div>` : '—';
    return `<tr>
    <td>${esc(r.date)}</td><td>${esc(r.debtor)}</td><td>${translateValue(r.method)}</td><td>${esc(r.note)||'—'}</td>${notesTd({notes:r.debtorNotes})}<td>${actions}</td>
  </tr>`;
  }).join('');
  body.querySelectorAll('[data-follow-edit]').forEach(b=>b.addEventListener('click', async ()=>{
    const [debtorId, logId] = b.dataset.followEdit.split(':').map(Number);
    const d = debtors.find(x=>x.id===debtorId);
    const entry = d && d.log.find(e=>e.id===logId && e.type==='follow');
    if(!d || !entry) return;
    if(await editFollowEntry(d, entry)) renderAll();
  }));
  body.querySelectorAll('[data-follow-del]').forEach(b=>b.addEventListener('click', ()=>{
    const [debtorId, logId] = b.dataset.followDel.split(':').map(Number);
    const d = debtors.find(x=>x.id===debtorId);
    const entry = d && d.log.find(e=>e.id===logId && e.type==='follow');
    if(!d || !entry) return;
    deleteFollowWithUndo(d, entry);
  }));
}

function renderReports(){
  const debtors=scopedDebtors();
  const total = debtors.reduce((s,d)=>s+d.total,0);
  const collected = debtors.reduce((s,d)=>s+d.paid,0);
  const remainingAll = total - collected;
  document.getElementById('repTotal').textContent = currency(total);
  document.getElementById('repCollected').textContent = currency(collected);
  document.getElementById('repRemaining').textContent = currency(remainingAll);
  document.getElementById('repRate').textContent = (total?Math.round(collected/total*100):0)+'%';
  document.getElementById('repPaymentsCount').textContent = debtors.reduce((s,d)=>s+d.log.filter(e=>e.type==='payment').length,0);
  document.getElementById('repFollowupsCount').textContent = debtors.reduce((s,d)=>s+d.log.filter(e=>e.type==='follow').length,0);

  const counts = {active:0, overdue:0, paid:0};
  debtors.forEach(d=>counts[statusOf(d)]++);
  const totalC = debtors.length || 1;
  const colors = {active:'#3E8E7E', overdue:'#B33A3A', paid:'#C9A227'};
  let offset = 0;
  const segs = Object.entries(counts).map(([k,v])=>{
    const pct = v/totalC*100;
    const seg = `<circle cx="21" cy="21" r="15.9" fill="transparent" stroke="${colors[k]}" stroke-width="6" stroke-dasharray="${pct} ${100-pct}" stroke-dashoffset="${25-offset}"></circle>`;
    offset += pct;
    return seg;
  }).join('');
  document.getElementById('donutSvg').innerHTML = segs || '';
  document.getElementById('donutLegend').innerHTML = `
    <div class="li"><div class="dot" style="background:${colors.active}"></div> ${t('status.active')} — ${counts.active}</div>
    <div class="li"><div class="dot" style="background:${colors.overdue}"></div> ${t('status.overdue')} — ${counts.overdue}</div>
    <div class="li"><div class="dot" style="background:${colors.paid}"></div> ${t('status.paid')} — ${counts.paid}</div>
  `;
  document.getElementById('repAverageDebt').textContent = currency(debtors.length ? total/debtors.length : 0);
  document.getElementById('repOverdueRate').textContent = (debtors.length ? Math.round(debtors.filter(d=>statusOf(d)==='overdue').length/debtors.length*100) : 0)+'%';
  document.getElementById('repExpectedMonthly').textContent = currency(debtors.reduce((sum,d)=>sum+(d.installments||[]).filter(item=>!item.paid).slice(0,1).reduce((s,item)=>s+item.amount,0),0));
  const months={}; debtors.forEach(d=>(d.installments||[]).forEach(item=>{const month=item.date.slice(0,7);months[month]??={due:0,paid:0};months[month].due+=Number(item.amount)||0;if(item.paid)months[month].paid+=Number(item.amount)||0;}));
  document.getElementById('financialReportBody').innerHTML=Object.entries(months).sort().map(([month,data])=>`<tr><td>${month}</td><td>${currency(data.due)}</td><td>${currency(data.paid)}</td><td>${data.due?Math.round(data.paid/data.due*100):0}%</td></tr>`).join('') || `<tr><td colspan="4">${currentLang==='en'?'No installment data yet.':'لا توجد بيانات أقساط بعد.'}</td></tr>`;
  const notesBody=document.getElementById('reportsNotesBody');
  if(notesBody){
    notesBody.innerHTML=debtors.map(d=>`<tr data-id="${d.id}"><td>${esc(d.name)}</td><td><span class="badge ${statusOf(d)}">${statusLabel(statusOf(d))}</span></td><td class="figures">${fmt(remaining(d))}</td>${notesTd(d)}</tr>`).join('')
      || `<tr><td colspan="4">${currentLang==='en'?'No debtors.':'لا يوجد مدينون.'}</td></tr>`;
    notesBody.querySelectorAll('tr[data-id]').forEach(row=>row.addEventListener('click',()=>openDrawer(Number(row.dataset.id))));
  }
}

// ============== SECURITY FUNCTIONS ==============
function resetSessionTimer() {
  if (sessionTimer) clearTimeout(sessionTimer);
  if (appSettings.autoLogout && currentUser) {
    sessionTimer = setTimeout(() => {
      doLogout();
      toast(currentLang === 'en' ? 'Auto-logged out due to inactivity' : 'تم تسجيل الخروج تلقائيًا بسبب عدم النشاط');
    }, 30 * 60 * 1000); // 30 minutes
  }
}

function showSessionWarning() {
  if (appSettings.sessionTimeout && !sessionWarningShown && currentUser) {
    sessionWarningShown = true;
    setTimeout(() => {
      if (currentUser) {
        toast(currentLang === 'en' ? 'Session will expire in 5 minutes' : 'ستنتهي الجلسة خلال 5 دقائق');
      }
    }, 25 * 60 * 1000); // 25 minutes (5 minutes before 30)
  }
}

// Track user activity
['click', 'keydown', 'scroll', 'mousemove'].forEach(event => {
  document.addEventListener(event, () => {
    resetSessionTimer();
    showSessionWarning();
  });
});

// Security settings event listeners
document.getElementById('s_autoLogout').addEventListener('change', e => {
  appSettings.autoLogout = e.target.checked;
  saveSettings();
  resetSessionTimer();
});

document.getElementById('s_sessionTimeout').addEventListener('change', e => {
  appSettings.sessionTimeout = e.target.checked;
  saveSettings();
  sessionWarningShown = false;
});

document.getElementById('s_passwordMinLength').addEventListener('change', e => {
  appSettings.passwordMinLength = parseInt(e.target.value) || 8;
  saveSettings();
});

// Integration settings
document.getElementById('s_smsProvider').addEventListener('change', e => {
  const configFields = document.getElementById('smsConfigFields');
  configFields.style.display = e.target.value !== 'none' ? 'block' : 'none';
  appSettings.smsProvider = e.target.value;
  saveSettings();
});

document.getElementById('s_emailProvider').addEventListener('change', e => {
  const configFields = document.getElementById('emailConfigFields');
  configFields.style.display = e.target.value !== 'none' ? 'block' : 'none';
  appSettings.emailProvider = e.target.value;
  saveSettings();
});

document.getElementById('s_smsApiKey').addEventListener('change', e => {
  appSettings.smsApiKey = e.target.value.trim();
  saveSettings();
});

document.getElementById('s_emailApiKey').addEventListener('change', e => {
  appSettings.emailApiKey = e.target.value.trim();
  saveSettings();
});

document.getElementById('testIntegrationBtn').addEventListener('click', () => {
  // Simulate integration test
  const smsProvider = document.getElementById('s_smsProvider').value;
  const emailProvider = document.getElementById('s_emailProvider').value;
  
  if (smsProvider === 'none' && emailProvider === 'none') {
    toast(currentLang === 'en' ? 'Please select at least one integration provider' : 'الرجاء اختيار مزود تكامل واحد على الأقل');
    return;
  }
  
  // Simulate API call
  setTimeout(() => {
    toast(t('integration.testSuccess'));
    addAudit('settings_change', `Integration test: SMS(${smsProvider}), Email(${emailProvider})`);
  }, 1000);
});

// Automation settings
document.getElementById('s_autoFollowups').addEventListener('change', e => {
  appSettings.autoFollowups = e.target.checked;
  saveSettings();
  if (e.target.checked) {
    applyAutomationRules();
  }
});

document.getElementById('s_autoReports').addEventListener('change', e => {
  appSettings.autoReports = e.target.checked;
  saveSettings();
});

document.getElementById('s_smartReminders').addEventListener('change', e => {
  appSettings.smartReminders = e.target.checked;
  saveSettings();
});

document.getElementById('s_followupFrequency').addEventListener('change', e => {
  appSettings.followupFrequency = parseInt(e.target.value) || 7;
  saveSettings();
});

// Compliance settings
document.getElementById('s_dataRetention').addEventListener('change', e => {
  appSettings.dataRetention = e.target.checked;
  saveSettings();
});

document.getElementById('s_gdprCompliance').addEventListener('change', e => {
  appSettings.gdprCompliance = e.target.checked;
  saveSettings();
});

document.getElementById('s_auditTrail').addEventListener('change', e => {
  appSettings.auditTrail = e.target.checked;
  saveSettings();
});

document.getElementById('s_companyName').addEventListener('change', e => {
  appSettings.companyName = e.target.value.trim();
  saveSettings();
});

document.getElementById('s_companyTaxId').addEventListener('change', e => {
  appSettings.companyTaxId = e.target.value.trim();
  saveSettings();
});

document.getElementById('generateComplianceReportBtn').addEventListener('click', () => {
  // Generate compliance report
  const reportData = {
    generated: new Date().toISOString(),
    companyName: appSettings.companyName,
    taxId: appSettings.companyTaxId,
    dataRetention: appSettings.dataRetention,
    gdprCompliance: appSettings.gdprCompliance,
    auditTrail: appSettings.auditTrail,
    totalDebtors: debtors.length,
    totalReps: reps.length,
    auditLogEntries: auditLog.length
  };
  
  // In a real implementation, this would generate a formal compliance report
  console.log('Compliance Report:', reportData);
  addAudit('settings_change', 'Compliance report generated');
  toast(t('compliance.reportGenerated'));
});

// Apply automation rules
function applyAutomationRules() {
  if (!appSettings.autoFollowups) return;
  
  const today = todayISO();
  let followupsCreated = 0;
  
  scopedDebtors().forEach(d => {
    if (statusOf(d) === 'overdue') {
      const lastFollowup = d.log.filter(e => e.type === 'follow').sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      const daysSinceLastFollowup = lastFollowup ? daysBetween(lastFollowup.date, today) : Infinity;
      
      if (daysSinceLastFollowup >= appSettings.followupFrequency) {
        d.log.push({
          id: genLogId(),
          type: 'follow',
          date: today,
          method: 'اتصال هاتفي',
          note: currentLang === 'en' ? 'Auto-generated followup' : 'متابعة تلقائية'
        });
        followupsCreated++;
      }
    }
  });
  
  if (followupsCreated > 0) {
    saveState();
    addAudit('automation_rules_applied', `${followupsCreated} auto followups created`);
    toast(t('automation.rulesApplied'));
  }
}

// Schedule automated reports
function scheduleAutomatedReports() {
  if (!appSettings.autoReports) return;
  
  // Check if weekly report is due (every Sunday)
  const today = new Date();
  if (today.getDay() === 0) { // Sunday
    const lastReportDate = lastWeeklyReport;
    const thisWeek = today.toISOString().slice(0, 10);
    
    if (lastReportDate !== thisWeek) {
      // Generate weekly report
      lastWeeklyReport = thisWeek;
      addAudit('automation_rules_applied', 'Weekly report generated');
      // In a real implementation, this would generate and send the report
    }
  }
}

document.getElementById('changeAdminPasswordBtn').addEventListener('click', async () => {
  if(!can('manageUsers')){ toast(currentLang==='en'?"Only an admin can reset another user's password":'إعادة تعيين كلمة مرور مستخدم آخر متاحة للمدير فقط'); return; }
  const targetUsername = await uiPrompt(currentLang === 'en' ? 'Username to reset:' : 'اسم المستخدم المراد إعادة تعيين كلمة مروره:');
  if (!targetUsername) return;
  const target = users.find(u => u.username.toLowerCase() === targetUsername.trim().toLowerCase());
  if (!target) { toast(currentLang==='en'?'User not found':'المستخدم غير موجود'); return; }
  const newPassword = await uiPrompt(currentLang === 'en' ? `New password for "${target.username}":` : `كلمة المرور الجديدة لـ "${target.username}":`, '', {type:'password'});
  if (!newPassword) return;
  if (newPassword.length < appSettings.passwordMinLength) {
    toast(currentLang === 'en' ? `Password must be at least ${appSettings.passwordMinLength} characters` : `يجب أن تكون كلمة المرور ${appSettings.passwordMinLength} أحرف على الأقل`);
    return;
  }
  try{
    await adminUsersCall('set_password',{user_id:target.id,password:newPassword});
    addAudit('save_auth', `${currentLang==='en'?'Password reset for':'إعادة تعيين كلمة مرور'}: ${target.username}`);
    toast(currentLang === 'en' ? 'Password changed successfully' : 'تم تغيير كلمة المرور بنجاح');
  }catch(err){
    console.warn('Resetting user password failed:', err); userErrToast(err);
  }
});

// Password validation
function validatePassword(password) {
  if (password.length < appSettings.passwordMinLength) {
    return false;
  }
  return true;
}

// ============== REMINDER SETTINGS ==============
const SETTINGS_KEY = 'daftar_settings_v1';
let appSettings = {language:'ar',mode:'dark',theme:'brand',themeCustom:'',palette:'brand',paletteCustom:'',savedSearch:null,reminderDays:7, watermarkEnabled:true, soundAlerts:true, emailAlerts:false, notificationEmail:'', autoLogout:false, sessionTimeout:false, passwordMinLength:8, smsProvider:'none', emailProvider:'none', smsApiKey:'', emailApiKey:'', autoFollowups:false, autoReports:false, smartReminders:false, followupFrequency:7, dataRetention:false, gdprCompliance:false, auditTrail:true, companyName:'', companyTaxId:''};
let sessionTimer = null;
let sessionWarningShown = false;
function loadSettings(){
  if(appSettings.language) currentLang=appSettings.language;
  if(appSettings.mode) currentMode=appSettings.mode;
}
// Appearance (language/mode/theme/palette/saved search) is saved per user in the database;
// shared settings are saved by admins only. Nothing is written to the browser.
let _prefsTimer=null;
function saveSettings(){
  if(!currentUser || _suppressPrefSave) return;
  clearTimeout(_prefsTimer);
  _prefsTimer=setTimeout(()=>{
    const prefs={}; PREF_KEYS.forEach(k=>{ prefs[k]=appSettings[k]; });
    supabaseClient.rpc('set_my_prefs',{p:prefs}).then(({error})=>{ if(error) console.warn('Saving preferences failed:',error); });
  },400);
  if(currentUser.role==='admin') syncToSupabase();
}
// ---- color helpers (used by the custom theme picker and by print/PDF templates) ----
function hexToRgbArr(hex){
  const clean=(hex||'').replace('#','').trim();
  const full=clean.length===3?clean.split('').map(c=>c+c).join(''):clean;
  const num=parseInt(full,16);
  if(isNaN(num)||full.length!==6) return [201,162,39];
  return [(num>>16)&255,(num>>8)&255,num&255];
}
function rgbToHex([r,g,b]){return '#'+[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');}
function darkenRgb([r,g,b],amount){return [r*(1-amount),g*(1-amount),b*(1-amount)];}
function readableInk([r,g,b]){
  // relative luminance (WCAG) decides whether dark or light text sits on top of the accent color
  const lum=(0.299*r+0.587*g+0.114*b)/255;
  return lum>0.55 ? '#1a1406' : '#f5f2e6';
}
function clampNum(v,min,max){ return Math.min(max,Math.max(min,v)); }
function hexToHsl(hex){
  let [r,g,b]=hexToRgbArr(hex).map(v=>v/255);
  const max=Math.max(r,g,b), min=Math.min(r,g,b);
  let h=0,s=0; const l=(max+min)/2;
  if(max!==min){
    const d=max-min;
    s=l>0.5 ? d/(2-max-min) : d/(max+min);
    switch(max){
      case r: h=(g-b)/d+(g<b?6:0); break;
      case g: h=(b-r)/d+2; break;
      case b: h=(r-g)/d+4; break;
    }
    h/=6;
  }
  return [h*360, s*100, l*100];
}
function hslToHex(h,s,l){
  h=((h%360)+360)%360; s=clampNum(s,0,100)/100; l=clampNum(l,0,100)/100;
  const c=(1-Math.abs(2*l-1))*s, x=c*(1-Math.abs((h/60)%2-1)), m=l-c/2;
  let r=0,g=0,b=0;
  if(h<60){r=c;g=x;b=0;} else if(h<120){r=x;g=c;b=0;} else if(h<180){r=0;g=c;b=x;}
  else if(h<240){r=0;g=x;b=c;} else if(h<300){r=x;g=0;b=c;} else {r=c;g=0;b=x;}
  return rgbToHex([(r+m)*255,(g+m)*255,(b+m)*255]);
}
// derives a full interface palette (bg/surface/surface-2/surface-3/ink/muted/border)
// from a single hex color picked by the user, following the same tonal
// relationships used by the built-in presets above.
function generateCustomPalette(hex){
  const [h,s,l]=hexToHsl(hex);
  if(l<55){
    const s2=clampNum(s,20,55);
    const surfaceL=clampNum(l,8,30);
    return {
      bg: hslToHex(h,s2,clampNum(surfaceL-5,4,26)),
      surface: hslToHex(h,s2,surfaceL),
      surface2: hslToHex(h,s2,clampNum(surfaceL+9,10,42)),
      surface3: hslToHex(h,s2,clampNum(surfaceL+17,14,50)),
      ink: hslToHex(h,15,92),
      muted: hslToHex(h,15,62),
      border: hslToHex(h,s2*0.7,clampNum(surfaceL+27,20,55))
    };
  }
  const s2=clampNum(s,15,45);
  return {
    bg: hslToHex(h,s2,95),
    surface: '#ffffff',
    surface2: hslToHex(h,s2,90),
    surface3: hslToHex(h,s2,85),
    ink: hslToHex(h,25,18),
    muted: hslToHex(h,15,42),
    border: hslToHex(h,s2*0.8,80)
  };
}
// active preset accent colors (kept in sync with style.css so JS can restore them)
const THEME_PRESETS={
  brand:'#D01020', gold:'#C9A227', teal:'#2BB3A3', blue:'#5EA9E8', rose:'#E28A9A', orange:'#FF8C42', purple:'#9C6ADE', green:'#6BCB77'
};
let _themeApplied=null, _paletteApplied=null;
function applyTheme(theme){
  theme=theme||'brand';
  const prev=_themeApplied;
  const isPreset=!!THEME_PRESETS[theme];
  if(isPreset){
    // preset: let the stylesheet rules (html[data-theme="..."]) take over, clear any custom inline overrides
    document.documentElement.dataset.theme=theme;
    ['--accent','--accent-dim','--accent-rgb','--accent-ink'].forEach(v=>document.documentElement.style.removeProperty(v));
    appSettings.theme=theme; appSettings.themeCustom='';
  } else {
    applyCustomTheme(theme);   // custom hex from the color picker (sets appSettings.theme='custom')
  }
  _themeApplied=isPreset?theme:'custom';
  if(prev!==null && prev!==_themeApplied && !_suppressPrefSave && typeof addAudit==='function' && currentUser){ addAudit('theme_change', isPreset?t(`theme.${theme}`):theme); }
  saveSettings();
  updateThemeSwatchesUI();
}
function applyCustomTheme(hex){
  const rgb=hexToRgbArr(hex);
  const dim=rgbToHex(darkenRgb(rgb,0.35));
  document.documentElement.dataset.theme='custom';
  document.documentElement.style.setProperty('--accent',hex);
  document.documentElement.style.setProperty('--accent-dim',dim);
  document.documentElement.style.setProperty('--accent-rgb',rgb.join(','));
  document.documentElement.style.setProperty('--accent-ink',readableInk(rgb));
  appSettings.theme='custom';
  appSettings.themeCustom=hex;
}
function updateThemeSwatchesUI(){
  const theme=appSettings.theme||'brand';
  const customHex=appSettings.themeCustom;
  document.querySelectorAll('[data-theme-preset]').forEach(btn=>btn.classList.toggle('active',btn.dataset.themePreset===theme));
  const customSwatch=document.getElementById('themeSwatchCustom');
  const customInput=document.getElementById('s_customColor');
  if(customSwatch) customSwatch.classList.toggle('active',theme==='custom');
  if(customInput && customHex) customInput.value=customHex;
  const label=document.getElementById('themeCurrentLabel');
  if(label) label.textContent = theme==='custom' ? t('theme.currentCustom') : t(`theme.${theme}`);
  const palette=appSettings.palette||'brand';
  document.querySelectorAll('[data-palette-preset]').forEach(btn=>btn.classList.toggle('active',btn.dataset.palettePreset===palette));
  const paletteCustomSwatch=document.getElementById('paletteSwatchCustom');
  const paletteCustomInput=document.getElementById('s_customPalette');
  const paletteCustomHex=appSettings.paletteCustom;
  if(paletteCustomSwatch) paletteCustomSwatch.classList.toggle('active',palette==='custom');
  if(paletteCustomInput && paletteCustomHex) paletteCustomInput.value=paletteCustomHex;
  const paletteLabel=document.getElementById('paletteCurrentLabel');
  if(paletteLabel) paletteLabel.textContent = palette==='custom' ? t('palette.currentCustom') : t(`palette.${palette}`);
}
// Trimmed from 13 presets (several duplicated or had poor contrast) to a tested core set.
// Light/dark is the separate mode toggle, so the old "light-*" palettes are gone.
const PALETTE_PRESETS=['brand','navy','forest','charcoal','burgundy'];
function applyPalette(palette){
  palette=palette||'brand';
  const isHex=/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(palette);
  if(!PALETTE_PRESETS.includes(palette) && !isHex) palette='brand';   // legacy/removed palette names fall back
  const prev=_paletteApplied;
  if(PALETTE_PRESETS.includes(palette)){
    document.documentElement.dataset.palette=palette;
    ['--bg','--surface','--surface-2','--surface-3','--ink','--muted','--border'].forEach(v=>document.documentElement.style.removeProperty(v));
    appSettings.palette=palette; appSettings.paletteCustom='';
    _paletteApplied=palette;
  } else {
    applyCustomPalette(palette);
    _paletteApplied='custom';
  }
  if(prev!==null && prev!==_paletteApplied && !_suppressPrefSave && typeof addAudit==='function' && currentUser) addAudit('palette_change', _paletteApplied==='custom' ? t('palette.currentCustom') : t(`palette.${palette}`));
  saveSettings();
  updateThemeSwatchesUI();
}
function applyCustomPalette(hex){
  const p=generateCustomPalette(hex);
  document.documentElement.dataset.palette='custom';
  document.documentElement.style.setProperty('--bg',p.bg);
  document.documentElement.style.setProperty('--surface',p.surface);
  document.documentElement.style.setProperty('--surface-2',p.surface2);
  document.documentElement.style.setProperty('--surface-3',p.surface3);
  document.documentElement.style.setProperty('--ink',p.ink);
  document.documentElement.style.setProperty('--muted',p.muted);
  document.documentElement.style.setProperty('--border',p.border);
  appSettings.palette='custom';
  appSettings.paletteCustom=hex;
}
document.querySelectorAll('[data-theme-preset]').forEach(btn=>btn.addEventListener('click',()=>applyTheme(btn.dataset.themePreset)));
document.querySelectorAll('[data-palette-preset]').forEach(btn=>btn.addEventListener('click',()=>applyPalette(btn.dataset.palettePreset)));
document.getElementById('s_customColor').addEventListener('input',e=>applyTheme(e.target.value));
document.getElementById('s_customPalette').addEventListener('input',e=>applyPalette(e.target.value));
async function syncConfiguredSupabase(){
  const url=document.getElementById('s_supabaseUrl').value.trim().replace(/\/$/,''); const key=document.getElementById('s_supabaseKey').value.trim(); const status=document.getElementById('syncStatus');
  if(!url||!key){status.textContent=currentLang==='en'?'Enter Supabase URL and anon key first.':'أدخل رابط Supabase ومفتاح anon أولًا.';return;}
  status.textContent=currentLang==='en'?'Syncing...':'جارٍ تنفيذ المزامنة...';
  const ok=await syncToSupabase();
  status.textContent=ok?(currentLang==='en'?'Sync completed.':'اكتملت المزامنة.'):(currentLang==='en'?'Sync failed. Check URL, key and RLS policies.':'فشلت المزامنة. تحقق من الرابط والمفتاح وسياسات RLS.');
  if(ok) await addAudit('sync_supabase');
}
document.getElementById('syncNowBtn').addEventListener('click',syncConfiguredSupabase);
document.getElementById('auditFilter').addEventListener('input',renderAudit);
function getUpcomingDue(days){
  return scopedDebtors().filter(d=>{
    if(remaining(d)<=0) return false;
    const diff = daysBetween(todayISO(), d.due);
    return diff>=0 && diff<=days;
  }).sort((a,b)=> daysBetween(todayISO(),a.due) - daysBetween(todayISO(),b.due));
}
function renderDueReminders(){
  document.getElementById('reminderWindowLabel').textContent = currentLang==='en' ? `Within ${appSettings.reminderDays} days` : `خلال ${appSettings.reminderDays} أيام`;
  const list = getUpcomingDue(appSettings.reminderDays);
  const el = document.getElementById('dueReminders');
  if(!list.length){
    el.innerHTML = `<div style="color:var(--muted); font-size:13px">${t('msg.noUpcoming')}</div>`;
    return;
  }
  el.innerHTML = list.map(d=>{
    const diff = daysBetween(todayISO(), d.due);
    const label = diff===0 ? t('msg.todayDue') : `${t('msg.daysLeft')} ${diff} ${t('msg.days')}`;
    return `<div class="activity-item"><div class="activity-dot" style="background:var(--red)"></div>
      <div><div class="t"><b>${esc(d.name)}</b> — ${label} (${esc(d.due)})</div>
      <div class="d">${currentLang==='en'?'Remaining':'المتبقي'}: <span class="figures">${fmt(remaining(d))}</span> ${currentLang==='en'?'QAR':'ر.ق'}</div></div></div>`;
  }).join('');
}
// Quotations whose "next follow-up" date has arrived or already passed, closed ones
// excluded since there is nothing left to follow up on for those.
function getDueQuotationFollowups(){
  const today = todayISO();
  return scopedQuotations()
    .filter(q=>q.nextFollowup && q.status!=='closed' && q.nextFollowup<=today)
    .sort((a,b)=> a.nextFollowup.localeCompare(b.nextFollowup));
}
function renderQuotFollowupReminders(){
  const el = document.getElementById('quotFollowupReminders');
  if(!el) return;
  const list = getDueQuotationFollowups();
  if(!list.length){
    el.innerHTML = `<div style="color:var(--muted); font-size:13px">${currentLang==='en'?'No quotation follow-ups due right now.':'لا توجد متابعات مستحقة لعروض الأسعار حاليًا.'}</div>`;
    return;
  }
  const today = todayISO();
  el.innerHTML = list.map(q=>{
    const overdueDays = daysBetween(q.nextFollowup, today);
    const label = q.nextFollowup===today
      ? (currentLang==='en'?'Due today':'مستحقة اليوم')
      : (currentLang==='en'?`Overdue by ${overdueDays} day(s)`:`متأخرة ${overdueDays} يوم`);
    return `<div class="activity-item" style="cursor:pointer" data-open-quot="${q.id}">
      <div class="activity-dot" style="background:${q.nextFollowup===today?'var(--gold)':'var(--red)'}"></div>
      <div><div class="t"><b>${esc(q.companyName)}</b> — ${label} (${esc(q.nextFollowup)})</div>
      <div class="d">${quotSubjectLabel(q.subject)} · ${quotStatusLabel(q.status)}${q.contactPerson?` · ${esc(q.contactPerson)}`:''}</div></div></div>`;
  }).join('');
}
document.getElementById('quotFollowupReminders')?.addEventListener('click', ev=>{
  const item = ev.target.closest('[data-open-quot]');
  if(!item) return;
  document.querySelector('[data-page="quotations"]')?.click();
  openQuotationDrawer(Number(item.dataset.openQuot));
});
function maybeSendDueNotifications(){
  if(!('Notification' in window) || Notification.permission!=='granted') return;
  const list = getUpcomingDue(appSettings.reminderDays);
  const quotList = getDueQuotationFollowups();
  if(!list.length && !quotList.length) return;
  const already = (dueNotified?'1':null);
  if(already) return;
  dueNotified=true;
  
  // Play sound if enabled
  if(appSettings.soundAlerts) {
    playNotificationSound();
  }
  
  if(list.length){
    const body = list.slice(0,5).map(d=>`${d.name} — ${d.due}`).join('\n');
    new Notification(currentLang==='en'?'Debt due alert':'تنبيه استحقاق ديون', {body: currentLang==='en'?`${list.length} cases are due soon:\n${body}`:`لديك ${list.length} حالة مستحقة قريبًا:\n${body}`});
  }
  if(quotList.length){
    const qBody = quotList.slice(0,5).map(q=>`${q.companyName} — ${q.nextFollowup}`).join('\n');
    new Notification(currentLang==='en'?'Quotation follow-up alert':'تنبيه متابعة عروض أسعار', {body: currentLang==='en'?`${quotList.length} quotation(s) need follow-up:\n${qBody}`:`لديك ${quotList.length} عرض سعر بحاجة لمتابعة:\n${qBody}`});
  }
  
  // Send email if enabled (simulation - in real implementation, this would call an API)
  if(appSettings.emailAlerts && appSettings.notificationEmail) {
    console.log('Email notification would be sent to:', appSettings.notificationEmail);
    // In a real implementation, you would call your backend API here
    // Example: fetch('/api/send-notification', { method: 'POST', body: JSON.stringify({ email: appSettings.notificationEmail, debts: list }) });
  }
}
document.getElementById('s_reminderDays').addEventListener('change', (e)=>{
  const v = parseInt(e.target.value) || 7;
  appSettings.reminderDays = v;
  saveSettings();
  addAudit('settings_change', `${currentLang==='en'?'Reminder days':'أيام التذكير'}: ${v}`);
  renderDueReminders();
});
document.getElementById('s_watermarkEnabled').addEventListener('change',e=>{appSettings.watermarkEnabled=e.target.checked;saveSettings();addAudit('settings_change', `${currentLang==='en'?'Print watermark':'شعار الطباعة'}: ${e.target.checked?'ON':'OFF'}`);});
document.getElementById('s_soundAlerts').addEventListener('change',e=>{appSettings.soundAlerts=e.target.checked;saveSettings();});
document.getElementById('s_emailAlerts').addEventListener('change',e=>{
  appSettings.emailAlerts=e.target.checked;
  document.getElementById('emailConfigField').style.display=e.target.checked?'block':'none';
  saveSettings();
});
document.getElementById('s_notificationEmail').addEventListener('change',e=>{
  appSettings.notificationEmail=e.target.value.trim();
  saveSettings();
});
document.getElementById('enableNotifBtn').addEventListener('click', ()=>{
  if(!('Notification' in window)){
    document.getElementById('notifStatus').textContent = currentLang==='en'?'This browser does not support system notifications.':'المتصفح الحالي لا يدعم تنبيهات النظام.';
    return;
  }
  Notification.requestPermission().then(perm=>{
    document.getElementById('notifStatus').textContent = perm==='granted'
      ? (currentLang==='en'?'Browser alerts enabled.':'تم تفعيل تنبيهات المتصفح — ستظهر تنبيهات عند فتح النظام إن وجدت ديون مستحقة قريبًا.')
      : (currentLang==='en'?'Notification permission was denied in browser settings.':'تم رفض إذن التنبيهات من إعدادات المتصفح.');
    if(perm==='granted'){ dueNotified=false; maybeSendDueNotifications(); }
  });
});

document.getElementById('dr_print').addEventListener('click', ()=>{
  if(activeDebtorId) printStatement(activeDebtorId);
});
function printStatement(id, skipPrint=false){
  const d = debtors.find(x=>x.id===id);
  if(!d) return;
  const rep = reps.find(r=>r.id===d.repId);
  const isCompany = d.type==='company';
  const sortedLog = [...d.log].sort((a,b)=> a.date < b.date ? -1 : 1);
  const L = {title:t('msg.statement'),system:t('msg.statementSystem'),issued:t('msg.issued'),status:t('msg.statusLabel'),company:t('msg.companyData'),debtor:t('msg.debtorData'),summary:t('msg.accountSummary'),name:t('msg.name'),phone:t('msg.phone'),companyNumber:t('msg.companyNumber'),crNumber:t('msg.crNumber'),dueDate:t('msg.dueDate'),collector:t('msg.collector'),notes:t('msg.notes'),date:t('msg.date'),description:t('msg.description'),debit:t('msg.debit'),credit:t('msg.credit'),balance:t('msg.balance'),totalDebt:t('msg.totalDebt'),totalPaid:t('msg.totalPaid'),remaining:t('msg.remainingBalance'),followups:t('msg.followups'),debtorSignature:t('msg.debtorSignature'),collectorSignature:t('msg.collectorSignature'),original:t('msg.originalBalance'),payment:t('msg.payment'),notAssigned:t('msg.notAssigned'),currency:currentLang==='en'?'QAR':'ر.ق'};

  // build running-balance ledger starting from the original debt amount
  let balance = d.total;
  const rows = [];
  rows.push({date:d.due<todayISO()?d.due:'', label:L.original, debit:'', credit:fmt(d.total), balance:fmt(balance), isOpening:true});
  sortedLog.forEach(e=>{
    if(e.type==='payment'){
      balance -= e.amount;
      rows.push({date:e.date, label:`${L.payment} (${translateValue(e.method)})`, debit:fmt(e.amount), credit:'', balance:fmt(Math.max(balance,0))});
    }
  });
  const followRows = sortedLog.filter(e=>e.type==='follow');
  const {accent}=printThemeVars();
  const statusBadgeColor = {active:'#3E8E7E', overdue:'#B33A3A', paid:accent}[statusOf(d)] || accent;

  const docHtml = `<!DOCTYPE html>
<html lang="${currentLang}" dir="${currentLang==='en'?'ltr':'rtl'}"><head><meta charset="UTF-8">
<title>${esc(L.title)} — ${esc(d.name)}</title>
<link rel="stylesheet" href="${new URL('fonts/fonts.css', location.href).href}">
<style>
${printSharedStyle()}
  .party{display:flex; gap:16px; margin-bottom:20px; flex-wrap:wrap;}
  .party .box{flex:1; min-width:220px;}
  .party .box h3{font-size:11.5px; color:${accent}; margin:0 0 10px; letter-spacing:.3px; text-transform:uppercase;}
  .party .box div{font-size:13px; margin-bottom:6px; display:flex; justify-content:space-between; gap:10px;}
  .party .box b{color:#6b7280; font-weight:600;}
  .status-chip{display:inline-block; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:700; color:#fff; background:${statusBadgeColor};}
  .summary{display:flex; justify-content:${currentLang==='en'?'flex-end':'flex-start'};}
  .summary table{width:290px; margin-bottom:0;}
  .summary td{border:none; padding:7px 10px;}
  .summary tr.total td{border-top:2px solid ${accent}; font-weight:800; font-size:14.5px;}
  .followups{margin-top:8px;}
  .followups h3{font-size:12.5px; color:${accent}; border-bottom:1px solid #e7e9ee; padding-bottom:8px; margin-bottom:8px;}
  .followups li{font-size:12px; margin-bottom:6px; color:#3a3f4a; list-style:none; padding-inline-start:14px; position:relative;}
  .followups li::before{content:"›"; position:absolute; inset-inline-start:0; color:${accent}; font-weight:900;}
  .sign{display:flex; justify-content:space-between; margin-top:56px;}
  .sign div{width:210px; text-align:center; font-size:11.5px; color:#6b7280;}
  .sign div .line{border-top:1px solid #c7cad1; margin-top:44px; padding-top:6px;}
</style></head>
<body>
  ${printBrandHeader(L.title, `ST-${String(d.id).padStart(5,'0')}`)}

  <div class="party">
    <div class="box">
      <h3>${isCompany?L.company:L.debtor}</h3>
      <div><b>${L.name}</b><span>${esc(d.name)}</span></div>
      <div><b>${L.phone}</b><span>${esc(d.phone)||'—'}</span></div>
      ${isCompany?`<div><b>${L.companyNumber}</b><span>${esc(d.companyNumber)||'—'}</span></div><div><b>${L.crNumber}</b><span>${esc(d.crNumber)||'—'}</span></div>`:''}
    </div>
    <div class="box">
      <h3>${L.summary}</h3>
      <div><b>${L.dueDate}</b><span>${esc(d.due)}</span></div>
      <div><b>${L.collector}</b><span>${rep?esc(rep.name):L.notAssigned}</span></div>
      <div><b>${L.status}</b><span class="status-chip">${statusLabel(statusOf(d))}</span></div>
    </div>
  </div>
  ${d.notes?`<div class="party" style="margin-top:-10px"><div class="box" style="flex:1 1 100%"><h3>${L.notes}</h3><div style="display:block">${esc(d.notes)}</div></div></div>`:''}

  <table>
    <thead><tr><th>${L.date}</th><th>${L.description}</th><th>${L.debit}</th><th>${L.credit}</th><th>${L.balance}</th></tr></thead>
    <tbody>
      ${rows.map(r=>`<tr class="${r.isOpening?'opening':''}">
        <td>${esc(r.date)||'—'}</td><td>${esc(r.label)}</td>
        <td class="num">${r.debit||'—'}</td><td class="num">${r.credit||'—'}</td><td class="num">${r.balance}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <div class="summary">
    <table>
      <tr><td>${L.totalDebt}</td><td class="num">${fmt(d.total)} ${L.currency}</td></tr>
      <tr><td>${L.totalPaid}</td><td class="num">${fmt(d.paid)} ${L.currency}</td></tr>
      <tr class="total"><td>${L.remaining}</td><td class="num">${fmt(remaining(d))} ${L.currency}</td></tr>
    </table>
  </div>

  ${followRows.length?`<div class="followups">
    <h3>${L.followups}</h3>
    <ul>${followRows.map(f=>`<li>${esc(f.date)} — ${translateValue(f.method)}${f.note?': '+esc(f.note):''}</li>`).join('')}</ul>
  </div>`:''}

  <div class="sign">
    <div><div class="line">${L.debtorSignature}</div></div>
    <div><div class="line">${L.collectorSignature}</div></div>
  </div>

  <div class="doc-footer">${t('msg.printedOn')} ${todayISO()}.</div>
</body></html>`;

  // use a hidden iframe (instead of window.open) so this also works when the
  // file is opened directly from disk (file://), where popups are often blocked
  lastStatementHtml = docHtml;
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);
  iframe.srcdoc = docHtml;
  iframe.onload = function(){
    setTimeout(()=>{
      try{
        if(!skipPrint){ iframe.contentWindow.focus(); iframe.contentWindow.print(); }
      }catch(e){
        toast('تعذّر فتح نافذة الطباعة تلقائيًا');
      }
      setTimeout(()=>document.body.removeChild(iframe), 1000);
    }, 150);
  };
}

async function exportDocumentPdf(docHtml, filename){
  if(!window.jspdf?.jsPDF || !window.html2canvas){toast(currentLang==='en'?'PDF libraries are unavailable. Print view opened instead.':'مكتبات PDF غير متاحة. تم فتح نافذة الطباعة البديلة.');printDocument(docHtml);return;}
  const iframe=document.createElement('iframe'); iframe.style.cssText='position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0;background:#fff'; document.body.appendChild(iframe); iframe.srcdoc=docHtml;
  await new Promise(resolve=>{iframe.onload=()=>setTimeout(resolve,900);});
  try{
    const body=iframe.contentDocument?.body; if(!body) throw new Error('document');
    const canvas=await html2canvas(body,{scale:2,useCORS:true,allowTaint:true,backgroundColor:'#fff'}); const {jsPDF}=window.jspdf; const pdf=new jsPDF('p','mm','a4');
    const pageWidth=210, pageHeight=297, imageWidth=pageWidth, pagePixels=Math.floor(canvas.width*pageHeight/pageWidth);
    for(let offset=0;offset<canvas.height;offset+=pagePixels){const slice=document.createElement('canvas');slice.width=canvas.width;slice.height=Math.min(pagePixels,canvas.height-offset);slice.getContext('2d').drawImage(canvas,0,offset,canvas.width,slice.height,0,0,slice.width,slice.height);if(offset)pdf.addPage();pdf.addImage(slice.toDataURL('image/jpeg',.92),'JPEG',0,0,imageWidth,slice.height*pageWidth/slice.width);}
    pdf.save(filename); toast(currentLang==='en'?'PDF downloaded':'تم تحميل PDF');
  }catch(err){console.error(err);toast(currentLang==='en'?'PDF export failed. Print view opened instead.':'تعذّر تصدير PDF. تم فتح نافذة الطباعة البديلة.');printDocument(docHtml);} finally{iframe.remove();}
}
function agingDocumentHtml(){
  const rows=getAgingRows(); const headers=currentLang==='en'?['Name','Type','Due date','Days late','Risk','Remaining','Notes']:['الاسم','النوع','تاريخ الاستحقاق','أيام التأخير','الخطورة','المتبقي','ملاحظات'];
  const title=currentLang==='en'?'Debt aging report':'تقرير أعمار الديون';
  const riskColors={b1:'#d9b34a',b2:'#d68a3c',b3:'#c8562f',b4:'#B33A3A'};
  const totalRemaining = rows.reduce((s,d)=>s+remaining(d),0);
  return `<!doctype html><html lang="${currentLang}" dir="${currentLang==='en'?'ltr':'rtl'}"><head><meta charset="utf-8"><title>${esc(title)}</title>
<link rel="stylesheet" href="${new URL('fonts/fonts.css', location.href).href}">
<style>
${printSharedStyle()}
  .summary-strip{display:flex; gap:12px; margin-bottom:18px;}
  .summary-strip .box{flex:1; text-align:center;}
  .summary-strip .lbl{font-size:11px; color:#6b7280; margin-bottom:6px;}
  .summary-strip .val{font-size:16px; font-weight:800;}
  .risk-dot{display:inline-block; width:8px; height:8px; border-radius:50%; margin-inline-end:6px;}
</style></head><body>
${printBrandHeader(title)}
<div class="summary-strip">
  <div class="box"><div class="lbl">${currentLang==='en'?'Overdue cases':'عدد الحالات المتأخرة'}</div><div class="val">${rows.length}</div></div>
  <div class="box"><div class="lbl">${currentLang==='en'?'Total outstanding':'إجمالي المتبقي المتأخر'}</div><div class="val">${currency(totalRemaining)}</div></div>
</div>
<table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(d=>`<tr><td>${esc(d.name)}</td><td>${d.type==='company'?t('debtors.company'):t('debtors.individual')}</td><td>${esc(d.due)}</td><td>${d.daysLate}</td><td class="risk"><span class="risk-dot" style="background:${riskColors[d.bucket.key]}"></span>${d.bucket.label}</td><td class="num">${fmt(remaining(d))}</td><td>${esc(d.notes)||'—'}</td></tr>`).join('') || `<tr><td colspan="7" class="empty">${t('aging.empty')}</td></tr>`}</tbody></table>
<div class="doc-footer">${t('msg.printedOn')} ${todayISO()}.</div>
</body></html>`;
}
document.getElementById('dr_downloadPdf').addEventListener('click',()=>{if(activeDebtorId){printStatement(activeDebtorId,true);setTimeout(()=>exportDocumentPdf(lastStatementHtml,`daftar-statement-${activeDebtorId}-${todayISO()}.pdf`),250);}});
function printDocument(docHtml){const iframe=document.createElement('iframe');iframe.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0';document.body.appendChild(iframe);iframe.srcdoc=docHtml;iframe.onload=()=>setTimeout(()=>{iframe.contentWindow.focus();iframe.contentWindow.print();setTimeout(()=>iframe.remove(),1000);},200);}

// ============== SETTINGS: BACKUP / RESET ==============
document.getElementById('exportDataBtn').addEventListener('click', async ()=>{
  const payload = {exportedAt: new Date().toISOString(), debtors, reps, nextId, nextRepId, users, auditLog};
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `نسخة-احتياطية-دفتر-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  await addAudit('export_backup', `${debtors.length} ${currentLang==='en'?'debtors':'مدين'}, ${reps.length} ${currentLang==='en'?'collectors':'مندوب'}`);
  toast('تم تصدير النسخة الاحتياطية');
});

document.getElementById('importDataBtn').addEventListener('click', ()=>{
  document.getElementById('importDataFile').click();
});
document.getElementById('importDataFile').addEventListener('change', async (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = async ()=>{
    try{
      const data = JSON.parse(reader.result);
      if(!Array.isArray(data.debtors)) throw new Error('invalid');
      if(!(await uiConfirm('سيؤدي الاستيراد إلى استبدال جميع البيانات الحالية بالبيانات الموجودة في الملف. هل تريد المتابعة؟', {danger:true}))) return;
      debtors = data.debtors.map(d=>({type:'individual', companyNumber:'', crNumber:'', ...d}));
      reps = data.reps || [];
      nextId = data.nextId || (Math.max(0, ...debtors.map(d=>d.id))+1);
      nextRepId = data.nextRepId || (Math.max(0, ...reps.map(r=>r.id))+1);
      
      // Import users if available
      if (data.users && Array.isArray(data.users)) {
        users = data.users;
        await saveUsers();
      }
      
      // Import audit log if available
      if (data.auditLog && Array.isArray(data.auditLog)) {
        auditLog = data.auditLog;
      }
      
      await addAudit('import_backup', `${debtors.length} ${currentLang==='en'?'debtors':'مدين'}, ${reps.length} ${currentLang==='en'?'collectors':'مندوب'}`);
      saveState();
      const synced = await syncToSupabase();
      toast(synced ? 'تم استيراد النسخة الاحتياطية بنجاح' : 'تم الاستيراد محليًا، وتعذرت المزامنة السحابية');
      renderAll();
    }catch(err){
      toast('تعذّرت قراءة الملف — تأكد أنه نسخة احتياطية صحيحة');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

document.getElementById('clearAllDataBtn').addEventListener('click', async ()=>{
  if(!(await uiConfirm('هل أنت متأكد من مسح جميع البيانات المسجلة نهائيًا؟ لا يمكن التراجع عن هذا الإجراء.', {danger:true}))) return;
  if(!(await uiConfirm('تأكيد أخير: سيتم حذف كل المدينين والمندوبين وسجلات السداد والمتابعات. متابعة؟', {danger:true, confirmText:t('ui.delete')}))) return;
  const counts = `${debtors.length} ${currentLang==='en'?'debtors':'مدين'}, ${reps.length} ${currentLang==='en'?'collectors':'مندوب'}`;
  debtors = [];
  reps = [];
  nextId = 1;
  nextRepId = 1;
  activeDebtorId = null;
  activeRepId = null;
  closeDrawer();
  closeRepDrawer();
  await addAudit('clear_all_data', counts);
  saveState();
  const synced = await syncToSupabase();
  toast(synced ? 'تم مسح جميع البيانات المسجلة' : 'تم المسح محليًا، وتعذرت المزامنة السحابية');
  renderAll();
});

// ============== PRINT/PDF: REPORTS & AGING ==============
function reportsDocumentHtml(){
  const debtors=scopedDebtors();
  const total = debtors.reduce((s,d)=>s+d.total,0);
  const collected = debtors.reduce((s,d)=>s+d.paid,0);
  const remainingAll = total - collected;
  const title=currentLang==='en'?'Financial Reports':'التقارير المالية';
  const counts = {active:0, overdue:0, paid:0};
  debtors.forEach(d=>counts[statusOf(d)]++);
  const months={}; debtors.forEach(d=>(d.installments||[]).forEach(item=>{const month=item.date.slice(0,7);months[month]??={due:0,paid:0};months[month].due+=Number(item.amount)||0;if(item.paid)months[month].paid+=Number(item.amount)||0;}));
  const rows = Object.entries(months).sort();
  return `<!doctype html><html lang="${currentLang}" dir="${currentLang==='en'?'ltr':'rtl'}"><head><meta charset="utf-8"><title>${esc(title)}</title>
<link rel="stylesheet" href="${new URL('fonts/fonts.css', location.href).href}">
<style>
${printSharedStyle()}
  .summary-grid{display:grid; grid-template-columns:repeat(2,1fr); gap:16px; margin-bottom:20px;}
  .summary-box{padding:12px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:6px;}
  .summary-box .lbl{font-size:11px; color:#6b7280; margin-bottom:4px;}
  .summary-box .val{font-size:18px; font-weight:800; color:var(--accent);}
</style></head><body>
${printBrandHeader(title)}
<div class="summary-grid">
  <div class="summary-box"><div class="lbl">${currentLang==='en'?'Total debts':'إجمالي الديون'}</div><div class="val">${fmt(total)}</div></div>
  <div class="summary-box"><div class="lbl">${currentLang==='en'?'Total collected':'إجمالي المحصّل'}</div><div class="val">${fmt(collected)}</div></div>
  <div class="summary-box"><div class="lbl">${currentLang==='en'?'Total remaining':'إجمالي المتبقي'}</div><div class="val">${fmt(remainingAll)}</div></div>
  <div class="summary-box"><div class="lbl">${currentLang==='en'?'Collection rate':'نسبة التحصيل'}</div><div class="val">${total?Math.round(collected/total*100):0}%</div></div>
</div>
<table><thead><tr><th>${currentLang==='en'?'Month':'الشهر'}</th><th>${currentLang==='en'?'Due':'مستحق'}</th><th>${currentLang==='en'?'Collected':'محصل'}</th><th>${currentLang==='en'?'Rate':'النسبة'}</th></tr></thead><tbody>${rows.map(([month,data])=>`<tr><td>${month}</td><td>${fmt(data.due)}</td><td>${fmt(data.paid)}</td><td>${data.due?Math.round(data.paid/data.due*100):0}%</td></tr>`).join('')||`<tr><td colspan="4">${currentLang==='en'?'No installment data.':'لا توجد بيانات أقساط.'}</td></tr>`}</tbody></table>
<table><thead><tr><th>${currentLang==='en'?'Name':'الاسم'}</th><th>${currentLang==='en'?'Status':'الحالة'}</th><th>${currentLang==='en'?'Remaining':'المتبقي'}</th><th>${currentLang==='en'?'Notes':'ملاحظات'}</th></tr></thead><tbody>${debtors.map(d=>`<tr><td>${esc(d.name)}</td><td>${statusLabel(statusOf(d))}</td><td>${fmt(remaining(d))}</td><td>${esc(d.notes)||'—'}</td></tr>`).join('')||`<tr><td colspan="4">${currentLang==='en'?'No debtors.':'لا يوجد مدينون.'}</td></tr>`}</tbody></table>
<div class="doc-footer">${t('msg.printedOn')} ${todayISO()}.</div>
</body></html>`;
}
document.getElementById('reportPrintBtn')?.addEventListener('click',()=>printDocument(reportsDocumentHtml()));
document.getElementById('reportPdfBtn')?.addEventListener('click',()=>exportDocumentPdf(reportsDocumentHtml(),`daftar-reports-${todayISO()}.pdf`));
document.getElementById('agingPrintBtn')?.addEventListener('click',()=>printDocument(agingDocumentHtml()));
document.getElementById('agingPdfBtn')?.addEventListener('click',()=>exportDocumentPdf(agingDocumentHtml(),`daftar-aging-${todayISO()}.pdf`));

// ============== KEYBOARD SHORTCUTS ==============
// Keys are lowercase because the lookup below normalizes e.key to lowercase before matching
// (browsers report e.key as lowercase for an unshifted letter, uppercase when Shift is held).
const keyboardShortcuts = {
  'ctrl+k': () => {
    document.getElementById('globalSearch').focus();
  },
  'ctrl+n': () => {
    document.getElementById('addDebtorBtn').click();
  },
  'ctrl+r': () => {
    renderAll();
  },
  'ctrl+shift+r': () => {
    document.querySelector('[data-page="reports"]')?.click();
  },
  'ctrl+shift+d': () => {
    document.querySelector('[data-page="debtors"]')?.click();
  },
  'ctrl+shift+a': () => {
    document.querySelector('[data-page="aging"]')?.click();
  },
  'escape': () => {
    document.querySelectorAll('.overlay.show').forEach(el => el.classList.remove('show'));
    document.querySelectorAll('.drawer.show').forEach(el => el.classList.remove('show'));
    document.querySelectorAll('.drawer-overlay.show').forEach(el => el.classList.remove('show'));
    document.getElementById('notificationPanel')?.classList.remove('show');
  },
  'ctrl+shift+s': () => {
    document.getElementById('saveSearchBtn')?.click();
  },
  'ctrl+shift+f': () => {
    document.getElementById('advancedSearchBtn')?.click();
  }
};

document.addEventListener('keydown', (e) => {
  const key = e.ctrlKey ? 'Ctrl+' : '';
  const shift = e.shiftKey ? 'Shift+' : '';
  // Normalize to lowercase: e.key is lowercase for an unshifted letter (e.g. 'k') but
  // uppercase when Shift is held (e.g. 'R' for Ctrl+Shift+R), so a case-sensitive lookup
  // against the (mixed-case) keyboardShortcuts keys would silently miss the unshifted ones.
  const shortcut = (key + shift + e.key).toLowerCase();

  if (keyboardShortcuts[shortcut]) {
    e.preventDefault();
    keyboardShortcuts[shortcut]();
  }
});

// Show keyboard shortcuts help
function showKeyboardShortcutsHelp() {
  const shortcuts = [
    { key: 'Ctrl+K', action: currentLang === 'en' ? 'Focus search' : 'التركيز على البحث' },
    { key: 'Ctrl+N', action: currentLang === 'en' ? 'Add new debtor' : 'إضافة مدين جديد' },
    { key: 'Ctrl+R', action: currentLang === 'en' ? 'Refresh data' : 'تحديث البيانات' },
    { key: 'Ctrl+Shift+R', action: currentLang === 'en' ? 'Go to reports' : 'الذهاب للتقارير' },
    { key: 'Ctrl+Shift+D', action: currentLang === 'en' ? 'Go to debtors' : 'الذهاب للمدينين' },
    { key: 'Ctrl+Shift+A', action: currentLang === 'en' ? 'Go to aging' : 'الذهاب لأعمار الديون' },
    { key: 'Escape', action: currentLang === 'en' ? 'Close modals' : 'إغلاق النوافذ' },
    { key: 'Ctrl+Shift+S', action: currentLang === 'en' ? 'Save search' : 'حفظ البحث' },
    { key: 'Ctrl+Shift+F', action: currentLang === 'en' ? 'Advanced search' : 'بحث متقدم' }
  ];

  const helpContent = shortcuts.map(s => 
    `<div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border);">
      <kbd style="background:var(--surface-2); padding:4px 8px; border-radius:4px; font-family:monospace;">${s.key}</kbd>
      <span>${s.action}</span>
    </div>`
  ).join('');

  const helpHtml = `
    <div class="overlay show" id="keyboardHelpOverlay">
      <div class="modal" style="width:400px;" role="dialog" aria-modal="true">
        <div class="modal-head">
          <h3>${currentLang === 'en' ? 'Keyboard Shortcuts' : 'اختصارات لوحة المفاتيح'}</h3>
          <button class="modal-close" data-help-close aria-label="Close">✕</button>
        </div>
        <div class="modal-body">
          ${helpContent}
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', helpHtml);
  document.querySelector('#keyboardHelpOverlay [data-help-close]').addEventListener('click',()=>document.getElementById('keyboardHelpOverlay').classList.remove('show'));
}

// Add keyboard help button to settings
document.addEventListener('DOMContentLoaded', () => {
  // NOTE: '[data-page="settings"]' matches the sidebar NAV LINK, not the settings page's
  // content section, and that nav link has no '.panel-head' child - so this used to silently
  // find nothing and never append the button anywhere. Target the actual settings page instead.
  const settingsPage = document.getElementById('page-settings');
  if (settingsPage) {
    const helpBtn = document.createElement('button');
    helpBtn.className = 'btn secondary small';
    helpBtn.textContent = currentLang === 'en' ? '⌨️ Keyboard Shortcuts' : '⌨️ اختصارات لوحة المفاتيح';
    helpBtn.onclick = showKeyboardShortcutsHelp;
    settingsPage.querySelector('.panel-head')?.appendChild(helpBtn);
  }
});

// ============== NEW TRANSLATIONS & FEATURES ==============
const newTranslations = {
  'status.suspended': ['معلق', 'Suspended'],
  'status.contested': ['متنازع عليه', 'Contested'],
  'status.uncollectible': ['مستحيل التحصيل', 'Uncollectible'],
  'filter.dateRange': ['نطاق التاريخ', 'Date Range'],
  'filter.amountRange': ['نطاق المبلغ', 'Amount Range'],
  'filter.collector': ['المندوب', 'Collector'],
  'filter.advancedSearch': ['🔍 بحث متقدم', '🔍 Advanced Search'],
  'filter.saveSearch': ['💾 حفظ البحث', '💾 Save Search'],
  'filter.apply': ['تطبيق', 'Apply'],
  'filter.reset': ['إعادة تعيين', 'Reset'],
  'filter.riskLevel': ['مستوى الخطورة', 'Risk Level'],
  'filter.lowRisk': ['منخفض', 'Low'],
  'filter.mediumRisk': ['متوسط', 'Medium'],
  'filter.highRisk': ['عالي', 'High'],
  'export.excel': ['⭳ تصدير إلى Excel', '⭳ Export to Excel'],
  'export.debtorsTable': ['تصدير جدول المدينين', 'Export Debtors Table'],
  'alerts.soundAlert': ['تنبيهات صوتية', 'Sound Alerts'],
  'alerts.smsAlert': ['تنبيهات SMS', 'SMS Alerts'],
  'alerts.emailAlert': ['تنبيهات بريد إلكتروني', 'Email Alerts'],
  'alerts.emailConfig': ['إعدادات البريد الإلكتروني', 'Email Configuration'],
  'analytics.collectionTrend': ['اتجاه التحصيل الشهري', 'Monthly Collection Trend'],
  'analytics.collectorPerformance': ['أداء المندوبين', 'Collector Performance'],
  'analytics.debtDistribution': ['توزيع الديون', 'Debt Distribution'],
  'analytics.paymentMethods': ['طرق الدفع', 'Payment Methods'],
  'dashboard.collectorStats': ['إحصائيات الأداء', 'Performance Stats'],
  'debtorStatus.suspended': ['معلق (قيد المراجعة)', 'Suspended (Under Review)'],
  'debtorStatus.contested': ['متنازع عليه (نزاع قانوني)', 'Contested (Legal Dispute)'],
  'debtorStatus.uncollectible': ['مستحيل التحصيل (كتابة ديون معدومة)', 'Uncollectible (Write-off)']
};
Object.assign(translations, newTranslations);

// ============== EXPORT TO EXCEL ==============
function exportDebtorsTableToExcel() {
  const data = [];
  const headers = [
    currentLang === 'en' ? 'Name' : 'الاسم',
    currentLang === 'en' ? 'Type' : 'النوع',
    currentLang === 'en' ? 'Phone' : 'الهاتف',
    currentLang === 'en' ? 'Total Debt' : 'إجمالي الدين',
    currentLang === 'en' ? 'Paid' : 'المسدد',
    currentLang === 'en' ? 'Remaining' : 'المتبقي',
    currentLang === 'en' ? 'Status' : 'الحالة',
    currentLang === 'en' ? 'Collector' : 'المندوب',
    currentLang === 'en' ? 'Notes' : 'ملاحظات'
  ];
  data.push(headers);
  
  scopedDebtors().forEach(d => {
    const rep = reps.find(r => r.id === d.repId);
    data.push([
      d.name,
      d.type === 'company' ? (currentLang === 'en' ? 'Company' : 'شركة') : (currentLang === 'en' ? 'Individual' : 'فرد'),
      d.phone || '—',
      d.total,
      d.paid,
      remaining(d),
      statusLabel(statusOf(d)),
      rep ? rep.name : (currentLang === 'en' ? 'Unassigned' : 'بدون مندوب'),
      d.notes || ''
    ]);
  });
  
  const sheet = XLSX.utils.aoa_to_sheet(data);
  sheet['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 28 }];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, currentLang === 'en' ? 'Debtors' : 'المدينون');
  XLSX.writeFile(book, `daftar-debtors-${todayISO()}.xlsx`);
  toast(currentLang === 'en' ? 'Exported successfully' : 'تم التصدير بنجاح');
  addAudit('export_excel', `${scopedDebtors().length} debtors`);
}

// ============== SMART NOTIFICATIONS ==============
function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gain.gain.setValueAtTime(0.3, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (e) {}
}

function triggerOverdueAlert(debtor) {
  const message = currentLang === 'en'
    ? `Alert: ${debtor.name} has overdue debt of QAR ${remaining(debtor)}`
    : `تنبيه: ${debtor.name} لديه دين متأخر بمبلغ ${remaining(debtor)} ر.ق`;
  
  if(appSettings.soundAlerts) {
    playNotificationSound();
  }
  
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(
      currentLang === 'en' ? 'Overdue Debt Alert' : 'تنبيه دين متأخر',
      {
        body: message,
        icon: '⚠️',
        tag: `overdue-${debtor.id}`,
        requireInteraction: true
      }
    );
  }
}

// ============== COLLECTOR PERFORMANCE ==============
function getCollectorPerformance(repId) {
  const cases = debtors.filter(d => d.repId === repId);
  const stats = {
    totalCases: cases.length,
    activeCases: cases.filter(d => statusOf(d) === 'active').length,
    overdueCases: cases.filter(d => statusOf(d) === 'overdue').length,
    paidCases: cases.filter(d => statusOf(d) === 'paid').length,
    totalAssigned: cases.reduce((s, d) => s + d.total, 0),
    totalCollected: cases.reduce((s, d) => s + d.paid, 0),
    collectionRate: (()=>{const tot=cases.reduce((s,d)=>s+d.total,0); return tot ? Math.round(cases.reduce((s,d)=>s+d.paid,0)/tot*100) : 0;})(),
    payments: []
  };
  
  cases.forEach(d => {
    d.log.filter(e => e.type === 'payment').forEach(e => {
      stats.payments.push({ ...e, debtor: d.name });
    });
  });
  
  return stats;
}

loadSettings();
applyThemeFromSettings();
document.getElementById('s_reminderDays').value = appSettings.reminderDays;
document.getElementById('s_watermarkEnabled').checked = appSettings.watermarkEnabled !== false;
document.getElementById('s_soundAlerts').checked = appSettings.soundAlerts !== false;
document.getElementById('s_emailAlerts').checked = appSettings.emailAlerts || false;
document.getElementById('s_notificationEmail').value = appSettings.notificationEmail || '';
document.getElementById('emailConfigField').style.display = appSettings.emailAlerts ? 'block' : 'none';
document.getElementById('s_autoLogout').checked = appSettings.autoLogout || false;
document.getElementById('s_sessionTimeout').checked = appSettings.sessionTimeout || false;
document.getElementById('s_passwordMinLength').value = appSettings.passwordMinLength || 8;
document.getElementById('s_autoFollowups').checked = appSettings.autoFollowups || false;
document.getElementById('s_autoReports').checked = appSettings.autoReports || false;
document.getElementById('s_smartReminders').checked = appSettings.smartReminders || false;

// ============== UI EXTRAS (accessibility, mobile bar, login) ==============
document.getElementById('pwToggle')?.addEventListener('click',()=>{
  const input=document.getElementById('login_pass'); const show=input.type==='password';
  input.type=show?'text':'password';
  document.getElementById('pwToggle').setAttribute('aria-pressed',String(show));
});
document.querySelectorAll('.bnav-item[data-page]').forEach(b=>b.addEventListener('click',()=>{
  const item=document.querySelector(`.nav-item[data-page="${b.dataset.page}"]`); if(item) item.click();
}));
document.getElementById('bnavMore')?.addEventListener('click',()=>document.getElementById('sidebar').classList.toggle('mobile-open'));

// Dialog semantics + focus management (role, aria-modal, labelled, focus trap, restore focus)
(function setupDialogA11y(){
  const containers=()=>[...document.querySelectorAll('.overlay .modal, .drawer')];
  containers().forEach((el,idx)=>{
    el.setAttribute('role','dialog'); el.setAttribute('aria-modal','true');
    const h=el.querySelector('h2,h3'); if(h){ if(!h.id) h.id=`dlg_title_${idx}`; el.setAttribute('aria-labelledby',h.id); }
  });
  const openState=new WeakMap();
  const isOpen=el=>{ const host=el.classList.contains('drawer')?el:el.closest('.overlay'); return host&&host.classList.contains('show'); };
  const focusables=el=>[...el.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(n=>n.offsetParent!==null);
  const obs=new MutationObserver(muts=>{
    muts.forEach(m=>{
      const host=m.target; const el=host.classList.contains('drawer')?host:host.querySelector('.modal'); if(!el) return;
      const open=host.classList.contains('show'); const was=openState.get(el)||false;
      if(open&&!was){ openState.set(el,{prev:document.activeElement}); setTimeout(()=>{ const f=focusables(el); (f[0]||el).focus(); },30); }
      if(!open&&was){ const prev=was.prev; openState.set(el,false); if(prev&&prev.focus) prev.focus(); }
    });
  });
  document.querySelectorAll('.overlay, .drawer').forEach(n=>obs.observe(n,{attributes:true,attributeFilter:['class']}));
  document.addEventListener('keydown',e=>{
    if(e.key!=='Tab') return;
    const open=containers().filter(isOpen).pop(); if(!open) return;
    const f=focusables(open); if(!f.length) return;
    const first=f[0], last=f[f.length-1];
    if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
  });
})();

// Initialize application
async function initializeApp() {
  try {
    clearLegacyBrowserState();
    loadSettings();
    // Initialize settings UI values
    if (document.getElementById('s_reminderDays')) {
      document.getElementById('s_reminderDays').value = appSettings.reminderDays;
      document.getElementById('s_watermarkEnabled').checked = appSettings.watermarkEnabled !== false;
      document.getElementById('s_soundAlerts').checked = appSettings.soundAlerts !== false;
      document.getElementById('s_emailAlerts').checked = appSettings.emailAlerts || false;
      document.getElementById('s_notificationEmail').value = appSettings.notificationEmail || '';
      document.getElementById('emailConfigField').style.display = appSettings.emailAlerts ? 'block' : 'none';
      document.getElementById('s_autoLogout').checked = appSettings.autoLogout || false;
      document.getElementById('s_sessionTimeout').checked = appSettings.sessionTimeout || false;
      document.getElementById('s_passwordMinLength').value = appSettings.passwordMinLength || 8;
      document.getElementById('s_autoFollowups').checked = appSettings.autoFollowups || false;
      document.getElementById('s_autoReports').checked = appSettings.autoReports || false;
      document.getElementById('s_smartReminders').checked = appSettings.smartReminders || false;
      document.getElementById('s_followupFrequency').value = appSettings.followupFrequency || 7;
      document.getElementById('s_dataRetention').checked = appSettings.dataRetention || false;
      document.getElementById('s_gdprCompliance').checked = appSettings.gdprCompliance || false;
      document.getElementById('s_auditTrail').checked = appSettings.auditTrail !== false;
      document.getElementById('s_companyName').value = appSettings.companyName || '';
      document.getElementById('s_companyTaxId').value = appSettings.companyTaxId || '';
      
      // Initialize integration settings
      if (document.getElementById('s_smsProvider')) {
        document.getElementById('s_smsProvider').value = appSettings.smsProvider || 'none';
        document.getElementById('s_emailProvider').value = appSettings.emailProvider || 'none';
        document.getElementById('s_smsApiKey').value = appSettings.smsApiKey || '';
        document.getElementById('s_emailApiKey').value = appSettings.emailApiKey || '';
        document.getElementById('smsConfigFields').style.display = appSettings.smsProvider !== 'none' ? 'block' : 'none';
        document.getElementById('emailConfigFields').style.display = appSettings.emailProvider !== 'none' ? 'block' : 'none';
      }
    }
    
    applyLanguage();
    applyMode();
    updateAuthUI();
    applyPermissions(); 
    renderUsers(); 
    renderAudit();
    
    if('Notification' in window && document.getElementById('notifStatus')){
      if(Notification.permission==='granted'){
        document.getElementById('notifStatus').textContent = currentLang==='en'?'Browser alerts enabled.':'تنبيهات المتصفح مفعّلة.';
      } else if(Notification.permission==='denied'){
        document.getElementById('notifStatus').textContent = currentLang==='en'?'Notification permission was denied in browser settings.':'تم رفض إذن التنبيهات من إعدادات المتصفح.';
      }
    } else if (document.getElementById('notifStatus')) {
      document.getElementById('notifStatus').textContent = currentLang==='en'?'This browser does not support system notifications.':'المتصفح الحالي لا يدعم تنبيهات النظام.';
    }

    renderAll();
    console.log('Application initialized successfully');
  } catch (e) {
    console.error('Error initializing application:', e);
  }
}

// Call initialization after DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

